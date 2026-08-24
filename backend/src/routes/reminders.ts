import type { FastifyInstance } from 'fastify'
import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { supabaseAdmin } from '../lib/supabase.js'

function localParts(timeZone = 'Asia/Ho_Chi_Minh') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[get('weekday')] || 1
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday }
}

export async function reminderRoutes(app: FastifyInstance) {
  app.post('/jobs/study-reminders', async (request, reply) => {
    if (!config.REMINDER_JOB_SECRET || request.headers['x-job-secret'] !== config.REMINDER_JOB_SECRET) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Job secret không hợp lệ.' })
    }
    // Streak maintenance must keep running even when email delivery is
    // temporarily unavailable or SMTP has not been configured yet.
    const { error: streakError } = await supabaseAdmin.rpc('expire_inactive_streaks')
    if (streakError) request.log.warn({ streakError }, 'Could not expire inactive streaks')
    if (!config.SMTP_HOST || !config.SMTP_FROM_EMAIL) {
      return reply.code(503).send({ code: 'SMTP_NOT_CONFIGURED', message: 'Chưa cấu hình SMTP.' })
    }
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE,
      auth: config.SMTP_USER && config.SMTP_PASSWORD ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    })
    // The same scheduled tick expires chains after two full missed dates and
    // refreshes the per-user dashboard shortcut through database triggers.
    const { data: settings, error } = await supabaseAdmin.from('user_settings')
      .select('user_id, weekly_schedule, reminder_time, profiles!user_settings_user_id_fkey(display_name, timezone)')
      .eq('reminder_enabled', true)
    if (error) throw error

    let sent = 0
    for (const setting of settings || []) {
      const profile = Array.isArray(setting.profiles) ? setting.profiles[0] : setting.profiles
      const local = localParts(profile?.timezone || 'Asia/Ho_Chi_Minh')
      if (!(setting.weekly_schedule || []).includes(local.weekday)) continue
      const [hour = 20, minute = 0] = String(setting.reminder_time || '20:00').slice(0, 5).split(':').map(Number)
      if (Math.abs(local.minutes - (hour * 60 + minute)) > 7) continue
      const { data: studied } = await supabaseAdmin.from('daily_study_stats').select('minutes')
        .eq('user_id', setting.user_id).eq('study_date', local.date).maybeSingle()
      if (Number(studied?.minutes || 0) > 0) continue
      const { data: claimed } = await supabaseAdmin.from('reminder_email_deliveries')
        .insert({ user_id: setting.user_id, study_date: local.date }).select('user_id').maybeSingle()
      if (!claimed) continue
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(setting.user_id)
      if (!userData.user?.email) continue
      await transporter.sendMail({
        from: config.SMTP_FROM_EMAIL, to: userData.user.email,
        subject: 'Đến giờ học tiếng Hàn rồi! 📚',
        text: `Chào ${profile?.display_name || 'bạn'}, hôm nay bạn chưa học. Dành vài phút cùng Korean Study nhé!`,
        html: `<p>Chào <b>${profile?.display_name || 'bạn'}</b>,</p><p>Hôm nay bạn chưa học. Dành vài phút cùng <b>Korean Study</b> nhé! 📚</p>`,
      })
      sent += 1
    }
    return { ok: true, sent }
  })
}

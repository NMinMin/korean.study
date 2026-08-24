import type { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../lib/supabase.js'
import { requireAdmin } from '../plugins/admin.js'

type Status = 'draft' | 'published' | 'locked' | 'no_content'
type ReportStatus = 'pending' | 'resolved' | 'dismissed'
type SkillType = 'vocabulary_grammar' | 'dictation' | 'shadowing' | 'review'
const DASHBOARD_CACHE_VERSION = 3
const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function appDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function shiftDateKey(key: string, days: number) {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAdmin)

  app.get<{ Querystring: { days?: string; refresh?: string } }>('/admin/dashboard', async (request, reply) => {
    const days = request.query.days === '30' ? 30 : 7
    const freshAfter = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    if (request.query.refresh !== 'true') {
      const { data: cached } = await supabaseAdmin.from('admin_dashboard_cache').select('payload, refreshed_at').eq('range_days', days).gte('refreshed_at', freshAfter).maybeSingle()
      if (cached?.payload && (cached.payload as { cacheVersion?: number }).cacheVersion === DASHBOARD_CACHE_VERSION) return { data: cached.payload, cached: true }
    }
    const todayKey = appDateKey()
    const startKey = shiftDateKey(todayKey, -days + 1)
    const previousStartKey = shiftDateKey(startKey, -days)
    const [{ data: stats, error: statsError }, { data: progress, error: progressError }, { data: vocabProgress, error: vocabError }, textbookCount, lessonCount, userCount, pendingReportCount] = await Promise.all([
      supabaseAdmin.from('daily_study_stats').select('user_id, study_date, minutes').gte('study_date', previousStartKey).lte('study_date', todayKey),
      supabaseAdmin.from('lesson_progress').select('user_id, textbook_id, progress_percent, textbooks(title_ko)'),
      supabaseAdmin.from('vocabulary_progress').select('vocabulary_id, incorrect_count, correct_count, vocabulary(word_ko, meaning_vi), textbooks(title_ko)').gt('incorrect_count', 0),
      supabaseAdmin.from('textbooks').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('lessons').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    if (statsError || progressError || vocabError) return reply.code(500).send({ code: 'DASHBOARD_READ_FAILED', message: 'Không thể tải thống kê dashboard.', requestId: request.id })
    const recent = (stats ?? []).filter((item) => item.study_date >= startKey)
    const previous = (stats ?? []).filter((item) => item.study_date < startKey)
    const activeUsers = new Set(recent.map((item) => item.user_id))
    const previousUsers = new Set(previous.map((item) => item.user_id))
    const retained = [...activeUsers].filter((id) => previousUsers.has(id)).length
    const totalMinutes = recent.reduce((sum, item) => sum + Number(item.minutes || 0), 0)
    const completed = (progress ?? []).filter((item) => Number(item.progress_percent) >= 100)
    const chart = Array.from({ length: days }, (_, index) => {
      const key = shiftDateKey(startKey, index)
      return { date: key, minutes: recent.filter((item) => item.study_date === key).reduce((sum, item) => sum + Number(item.minutes || 0), 0) }
    })
    const courseMap = new Map<string, { title: string; total: number; count: number }>()
    for (const item of progress ?? []) {
      const current = courseMap.get(item.textbook_id) ?? { title: (item.textbooks as { title_ko?: string } | null)?.title_ko || 'Giáo trình', total: 0, count: 0 }
      current.total += Number(item.progress_percent || 0); current.count += 1; courseMap.set(item.textbook_id, current)
    }
    const hardMap = new Map<string, { word: string; meaning: string; course: string; incorrect: number; total: number }>()
    for (const item of vocabProgress ?? []) {
      const vocab = item.vocabulary as { word_ko?: string; meaning_vi?: string } | null
      const current = hardMap.get(item.vocabulary_id) ?? { word: vocab?.word_ko || '—', meaning: vocab?.meaning_vi || '—', course: (item.textbooks as { title_ko?: string } | null)?.title_ko || '—', incorrect: 0, total: 0 }
      current.incorrect += Number(item.incorrect_count || 0); current.total += Number(item.incorrect_count || 0) + Number(item.correct_count || 0); hardMap.set(item.vocabulary_id, current)
    }
    const payload = {
      cacheVersion: DASHBOARD_CACHE_VERSION, days, activeUsers: activeUsers.size, averageCompletedLessons: activeUsers.size ? completed.length / activeUsers.size : 0,
      averageMinutes: activeUsers.size ? totalMinutes / activeUsers.size / days : 0,
      retentionRate: previousUsers.size ? retained / previousUsers.size * 100 : 0,
      pendingReports: pendingReportCount.count ?? 0,
      totalTextbooks: textbookCount.count ?? 0, totalLessons: lessonCount.count ?? 0, totalUsers: userCount.count ?? 0,
      chart, courses: [...courseMap.values()].map((item) => ({ title: item.title, percent: item.count ? item.total / item.count : 0 })).sort((a, b) => b.percent - a.percent).slice(0, 5),
      hardVocabulary: [...hardMap.values()].map((item) => ({ ...item, errorRate: item.total ? item.incorrect / item.total * 100 : 0 })).sort((a, b) => b.errorRate - a.errorRate).slice(0, 8),
    }
    await supabaseAdmin.from('admin_dashboard_cache').upsert({ range_days: days, payload, refreshed_at: new Date().toISOString() })
    return { data: payload, cached: false }
  })

  app.get('/admin/users', async (request, reply) => {
    const [{ data: authData, error: authError }, { data: profiles, error: profileError }, { data: roles, error: roleError }, { data: snapshots, error: snapshotError }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('profiles').select('id, display_name, avatar_url, xp, level, created_at, is_locked, locked_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('user_roles').select('user_id, role'),
      supabaseAdmin.from('user_dashboard_snapshots').select('user_id, xp, level'),
    ])
    if (authError || profileError || roleError || snapshotError) return reply.code(500).send({ code: 'ADMIN_USERS_READ_FAILED', message: 'Không thể tải danh sách người dùng.', requestId: request.id })
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
    const roleMap = new Map((roles ?? []).map((role) => [role.user_id, role.role]))
    const snapshotMap = new Map((snapshots ?? []).map((snapshot) => [snapshot.user_id, snapshot]))
    return { data: authData.users.map((user) => ({
      id: user.id,
      email: user.email,
      emailConfirmedAt: user.email_confirmed_at,
      lastSignInAt: user.last_sign_in_at,
      ...profileMap.get(user.id),
      xp: Number(snapshotMap.get(user.id)?.xp ?? profileMap.get(user.id)?.xp ?? 0),
      level: Number(snapshotMap.get(user.id)?.level ?? profileMap.get(user.id)?.level ?? 1),
      role: roleMap.get(user.id) ?? 'user',
    })) }
  })

  app.patch<{ Params: { id: string }; Body: { role: 'user' | 'admin' } }>('/admin/users/:id/role', async (request, reply) => {
    const { id } = request.params
    const { role } = request.body
    if (!['user', 'admin'].includes(role)) return reply.code(400).send({ code: 'INVALID_ROLE', message: 'Vai trò không hợp lệ.', requestId: request.id })
    if (id === request.userId && role !== 'admin') return reply.code(400).send({ code: 'CANNOT_DEMOTE_SELF', message: 'Bạn không thể tự gỡ quyền admin của mình.', requestId: request.id })
    const { data, error } = await supabaseAdmin.from('user_roles').upsert({ user_id: id, role }).select().single()
    if (error) return reply.code(400).send({ code: 'ROLE_UPDATE_FAILED', message: 'Không thể cập nhật vai trò người dùng.', requestId: request.id })
    return { data }
  })

  app.patch<{ Params: { id: string }; Body: { locked: boolean } }>('/admin/users/:id/lock', async (request, reply) => {
    const { id } = request.params
    const locked = request.body?.locked
    if (typeof locked !== 'boolean') return reply.code(400).send({ code: 'INVALID_LOCK_STATE', message: 'Trạng thái khóa không hợp lệ.', requestId: request.id })
    if (id === request.userId && locked) return reply.code(400).send({ code: 'CANNOT_LOCK_SELF', message: 'Bạn không thể tự khóa tài khoản của mình.', requestId: request.id })

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: locked ? '876000h' : 'none' })
    if (authError) return reply.code(400).send({ code: 'AUTH_LOCK_FAILED', message: 'Không thể cập nhật trạng thái đăng nhập.', requestId: request.id })
    const { data, error } = await supabaseAdmin.from('profiles').update({ is_locked: locked, locked_at: locked ? new Date().toISOString() : null, locked_by: locked ? request.userId : null }).eq('id', id).select('id, is_locked, locked_at').single()
    if (error) {
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: locked ? 'none' : '876000h' })
      return reply.code(400).send({ code: 'PROFILE_LOCK_FAILED', message: 'Không thể lưu trạng thái khóa tài khoản.', requestId: request.id })
    }
    return { data }
  })

  app.get('/admin/textbooks', async (request, reply) => {
    const { data, error } = await supabaseAdmin.from('textbooks').select('*').order('sort_order')
    if (error) return reply.code(500).send({ code: 'TEXTBOOKS_READ_FAILED', message: 'Không thể tải giáo trình.', requestId: request.id })
    return { data }
  })

  app.post<{ Body: { slug: string; titleKo: string; titleVi?: string; description?: string; sortOrder?: number; status?: Status } }>('/admin/textbooks', async (request, reply) => {
    const body = request.body
    if (!body.slug?.trim() || !body.titleKo?.trim()) return reply.code(400).send({ code: 'TEXTBOOK_FIELDS_REQUIRED', message: 'Slug và tên tiếng Hàn là bắt buộc.', requestId: request.id })
    const { data, error } = await supabaseAdmin.from('textbooks').insert({ slug: body.slug.trim(), title_ko: body.titleKo.trim(), title_vi: body.titleVi?.trim() || null, description: body.description?.trim() || null, sort_order: body.sortOrder ?? 0, status: body.status ?? 'draft' }).select().single()
    if (error) return reply.code(400).send({ code: 'TEXTBOOK_CREATE_FAILED', message: error.message, requestId: request.id })
    return reply.code(201).send({ data })
  })

  app.patch<{ Params: { id: string }; Body: { slug?: string; titleKo?: string; titleVi?: string; description?: string; sortOrder?: number; status?: Status } }>('/admin/textbooks/:id', async (request, reply) => {
    const patch = { ...(request.body.slug !== undefined && { slug: request.body.slug.trim() }), ...(request.body.titleKo !== undefined && { title_ko: request.body.titleKo.trim() }), ...(request.body.titleVi !== undefined && { title_vi: request.body.titleVi.trim() || null }), ...(request.body.description !== undefined && { description: request.body.description.trim() || null }), ...(request.body.sortOrder !== undefined && { sort_order: request.body.sortOrder }), ...(request.body.status !== undefined && { status: request.body.status }), updated_at: new Date().toISOString() }
    const { data, error } = await supabaseAdmin.from('textbooks').update(patch).eq('id', request.params.id).select().single()
    if (error) return reply.code(400).send({ code: 'TEXTBOOK_UPDATE_FAILED', message: error.message, requestId: request.id })
    return { data }
  })

  app.delete<{ Params: { id: string } }>('/admin/textbooks/:id', async (request, reply) => {
    const { error } = await supabaseAdmin.from('textbooks').delete().eq('id', request.params.id)
    if (error) return reply.code(400).send({ code: 'TEXTBOOK_DELETE_FAILED', message: error.message, requestId: request.id })
    return reply.code(204).send()
  })

  app.get('/admin/lessons', async (request, reply) => {
    const { data, error } = await supabaseAdmin.from('lessons').select('*, textbooks(title_ko)').order('lesson_number')
    if (error) return reply.code(500).send({ code: 'LESSONS_READ_FAILED', message: 'Không thể tải bài học.', requestId: request.id })
    return { data }
  })

  app.post<{ Body: { textbookId: string; lessonNumber: number; titleKo: string; titleVi?: string; status?: Status } }>('/admin/lessons', async (request, reply) => {
    const body = request.body
    const { data, error } = await supabaseAdmin.from('lessons').insert({ textbook_id: body.textbookId, lesson_number: body.lessonNumber, title_ko: body.titleKo, title_vi: body.titleVi || null, status: body.status ?? 'draft' }).select().single()
    if (error) return reply.code(400).send({ code: 'LESSON_CREATE_FAILED', message: error.message, requestId: request.id })
    return reply.code(201).send({ data })
  })

  app.patch<{ Params: { id: string }; Body: { textbookId?: string; lessonNumber?: number; titleKo?: string; titleVi?: string; status?: Status } }>('/admin/lessons/:id', async (request, reply) => {
    const patch = { ...(request.body.textbookId !== undefined && { textbook_id: request.body.textbookId }), ...(request.body.lessonNumber !== undefined && { lesson_number: request.body.lessonNumber }), ...(request.body.titleKo !== undefined && { title_ko: request.body.titleKo.trim() }), ...(request.body.titleVi !== undefined && { title_vi: request.body.titleVi.trim() || null }), ...(request.body.status !== undefined && { status: request.body.status }), updated_at: new Date().toISOString() }
    const { data, error } = await supabaseAdmin.from('lessons').update(patch).eq('id', request.params.id).select().single()
    if (error) return reply.code(400).send({ code: 'LESSON_UPDATE_FAILED', message: error.message, requestId: request.id })
    return { data }
  })

  app.delete<{ Params: { id: string } }>('/admin/lessons/:id', async (request, reply) => {
    const { error } = await supabaseAdmin.from('lessons').delete().eq('id', request.params.id)
    if (error) return reply.code(400).send({ code: 'LESSON_DELETE_FAILED', message: error.message, requestId: request.id })
    return reply.code(204).send()
  })

  app.get<{ Querystring: { lessonId?: string; skillType?: SkillType } }>('/admin/exercises', async (request, reply) => {
    let query = supabaseAdmin.from('lesson_exercises').select('*, lessons(lesson_number, title_ko, textbook_id, textbooks(title_ko))').order('sort_order')
    if (request.query.lessonId) query = query.eq('lesson_id', request.query.lessonId)
    if (request.query.skillType) query = query.eq('skill_type', request.query.skillType)
    const { data, error } = await query
    if (error) return reply.code(500).send({ code: 'EXERCISES_READ_FAILED', message: 'Không thể tải danh sách bài tập. Hãy chạy migration 20260823000100_lesson_exercises.sql.', requestId: request.id })
    return { data }
  })

  app.post<{ Body: { lessonId: string; skillType: SkillType; exerciseType?: string; promptKo: string; promptVi?: string; answer?: unknown; explanationVi?: string; mediaUrl?: string; imageUrl?: string; audioUrl?: string; sortOrder?: number; status?: Status } }>('/admin/exercises', async (request, reply) => {
    const body = request.body
    if (!body.lessonId || !body.skillType || !body.promptKo?.trim()) return reply.code(400).send({ code: 'EXERCISE_FIELDS_REQUIRED', message: 'Bài học, kỹ năng và nội dung tiếng Hàn là bắt buộc.', requestId: request.id })
    const isListeningSkill = body.skillType === 'dictation' || body.skillType === 'shadowing'
    const { data, error } = await supabaseAdmin.from('lesson_exercises').insert({ lesson_id: body.lessonId, skill_type: body.skillType, exercise_type: body.exerciseType?.trim() || 'question', prompt_ko: body.promptKo.trim(), prompt_vi: body.promptVi?.trim() || null, answer: body.answer ?? {}, explanation_vi: body.explanationVi?.trim() || null, media_url: body.mediaUrl?.trim() || null, image_url: isListeningSkill ? null : body.imageUrl?.trim() || null, audio_url: body.audioUrl?.trim() || null, sort_order: body.sortOrder ?? 0, status: body.status ?? 'published' }).select().single()
    if (error) return reply.code(400).send({ code: 'EXERCISE_CREATE_FAILED', message: error.message, requestId: request.id })
    return reply.code(201).send({ data })
  })

  app.patch<{ Params: { id: string }; Body: { lessonId?: string; skillType?: SkillType; exerciseType?: string; promptKo?: string; promptVi?: string; answer?: unknown; explanationVi?: string; mediaUrl?: string; imageUrl?: string; audioUrl?: string; sortOrder?: number; status?: Status } }>('/admin/exercises/:id', async (request, reply) => {
    const body = request.body
    const listeningSkillSelected = body.skillType === 'dictation' || body.skillType === 'shadowing'
    const patch = { ...(body.lessonId !== undefined && { lesson_id: body.lessonId }), ...(body.skillType !== undefined && { skill_type: body.skillType }), ...(body.exerciseType !== undefined && { exercise_type: body.exerciseType.trim() || 'question' }), ...(body.promptKo !== undefined && { prompt_ko: body.promptKo.trim() }), ...(body.promptVi !== undefined && { prompt_vi: body.promptVi.trim() || null }), ...(body.answer !== undefined && { answer: body.answer }), ...(body.explanationVi !== undefined && { explanation_vi: body.explanationVi.trim() || null }), ...(body.mediaUrl !== undefined && { media_url: body.mediaUrl.trim() || null }), ...(listeningSkillSelected ? { image_url: null } : body.imageUrl !== undefined && { image_url: body.imageUrl.trim() || null }), ...(body.audioUrl !== undefined && { audio_url: body.audioUrl.trim() || null }), ...(body.sortOrder !== undefined && { sort_order: body.sortOrder }), ...(body.status !== undefined && { status: body.status }), updated_at: new Date().toISOString() }
    const { data, error } = await supabaseAdmin.from('lesson_exercises').update(patch).eq('id', request.params.id).select().single()
    if (error) return reply.code(400).send({ code: 'EXERCISE_UPDATE_FAILED', message: error.message, requestId: request.id })
    return { data }
  })

  app.delete<{ Params: { id: string } }>('/admin/exercises/:id', async (request, reply) => {
    const { error } = await supabaseAdmin.from('lesson_exercises').delete().eq('id', request.params.id)
    if (error) return reply.code(400).send({ code: 'EXERCISE_DELETE_FAILED', message: error.message, requestId: request.id })
    return reply.code(204).send()
  })

  app.get<{ Querystring: { status?: string; reportStatus?: string } }>('/admin/community', async (request, reply) => {
    let postsQuery = supabaseAdmin.from('posts').select('*').order('created_at', { ascending: false })
    if (request.query.status === 'visible' || request.query.status === 'hidden') postsQuery = postsQuery.eq('status', request.query.status)
    let reportsQuery = supabaseAdmin.from('content_reports').select('*').order('created_at', { ascending: false })
    const customLessonsQuery = supabaseAdmin.from('custom_lessons').select('id, creator_id, title, code, words, visibility, status, created_at').order('created_at', { ascending: false })
    if (['pending', 'resolved', 'dismissed'].includes(request.query.reportStatus || '')) reportsQuery = reportsQuery.eq('status', request.query.reportStatus as ReportStatus)
    const [{ data: posts, error: postsError }, { data: reports, error: reportsError }, { data: customLessons, error: customLessonsError }] = await Promise.all([postsQuery, reportsQuery, customLessonsQuery])
    if (postsError || reportsError || customLessonsError) {
      const databaseError = postsError ?? reportsError ?? customLessonsError
      request.log.error({ databaseError }, 'Admin community query failed')
      const migrationMissing = databaseError?.code === '42P01' || databaseError?.code === '42703' || databaseError?.code === 'PGRST205'
      return reply.code(migrationMissing ? 503 : 500).send({
        code: migrationMissing ? 'COMMUNITY_SCHEMA_NOT_READY' : 'COMMUNITY_READ_FAILED',
        message: migrationMissing
          ? 'Cơ sở dữ liệu cộng đồng chưa được cập nhật. Hãy chạy các migration cộng đồng mới nhất, gồm 20260824140000_vocabulary_sets_visibility.sql.'
          : 'Không thể tải dữ liệu quản trị cộng đồng.',
        requestId: request.id,
      })
    }
    const profileIds = [...new Set([
      ...(posts ?? []).map((post) => post.user_id),
      ...(reports ?? []).map((report) => report.reporter_id),
      ...(customLessons ?? []).map((lesson) => lesson.creator_id),
    ].filter(Boolean))]
    const { data: profiles, error: profilesError } = profileIds.length
      ? await supabaseAdmin.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
      : { data: [], error: null }
    if (profilesError) {
      request.log.error({ databaseError: profilesError }, 'Admin community profiles query failed')
      return reply.code(500).send({ code: 'COMMUNITY_PROFILES_READ_FAILED', message: 'Không thể tải thông tin người đăng.', requestId: request.id })
    }
    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
    const reportsByPost = new Map<string, typeof reports>()
    for (const report of reports ?? []) {
      if (!report.post_id) continue
      const current = reportsByPost.get(report.post_id) ?? []
      current.push({ ...report, profiles: profilesById.get(report.reporter_id) ?? null }); reportsByPost.set(report.post_id, current)
    }
    return {
      data: {
        posts: (posts ?? []).map((post) => ({ ...post, profiles: profilesById.get(post.user_id) ?? null, reports: reportsByPost.get(post.id) ?? [] })),
        reports: (reports ?? []).map((report) => ({ ...report, profiles: profilesById.get(report.reporter_id) ?? null })),
        customLessons: (customLessons ?? []).map((lesson) => ({ ...lesson, profiles: profilesById.get(lesson.creator_id) ?? null })),
      },
    }
  })

  app.patch<{ Params: { id: string }; Body: { hidden: boolean } }>('/admin/community/custom-lessons/:id', async (request, reply) => {
    const { data, error } = await supabaseAdmin.from('custom_lessons')
      .update({ status: request.body.hidden ? 'hidden' : 'visible', updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single()
    if (error) return reply.code(400).send({ code: 'CUSTOM_LESSON_MODERATION_FAILED', message: 'Không thể cập nhật bộ từ vựng.', requestId: request.id })
    return { data }
  })

  app.patch<{ Params: { id: string }; Body: { hidden?: boolean; commentsLocked?: boolean; reason?: string } }>('/admin/community/posts/:id', async (request, reply) => {
    if (request.body.hidden === undefined && request.body.commentsLocked === undefined) return reply.code(400).send({ code: 'MODERATION_ACTION_REQUIRED', message: 'Chưa chọn thao tác kiểm duyệt.', requestId: request.id })
    const patch = {
      ...(request.body.hidden !== undefined && { status: request.body.hidden ? 'hidden' : 'visible' }),
      ...(request.body.commentsLocked !== undefined && { comments_locked: request.body.commentsLocked }),
      moderation_reason: request.body.reason?.trim() || null,
      moderated_by: request.userId,
      moderated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabaseAdmin.from('posts').update(patch).eq('id', request.params.id).select('*, profiles!posts_user_id_fkey(display_name, avatar_url)').single()
    if (error) return reply.code(400).send({ code: 'POST_MODERATION_FAILED', message: 'Không thể cập nhật bài viết.', requestId: request.id })
    return { data }
  })

  app.delete<{ Params: { id: string } }>('/admin/community/posts/:id', async (request, reply) => {
    const { error } = await supabaseAdmin.from('posts').delete().eq('id', request.params.id)
    if (error) return reply.code(400).send({ code: 'POST_DELETE_FAILED', message: 'Không thể xóa bài viết.', requestId: request.id })
    return reply.code(204).send()
  })

  app.patch<{ Params: { id: string }; Body: { status: ReportStatus; note?: string } }>('/admin/community/reports/:id', async (request, reply) => {
    if (!['resolved', 'dismissed'].includes(request.body.status)) return reply.code(400).send({ code: 'INVALID_REPORT_STATUS', message: 'Trạng thái xử lý báo cáo không hợp lệ.', requestId: request.id })
    const { data, error } = await supabaseAdmin.from('content_reports').update({ status: request.body.status, resolution_note: request.body.note?.trim() || null, handled_by: request.userId, handled_at: new Date().toISOString() }).eq('id', request.params.id).select().single()
    if (error) return reply.code(400).send({ code: 'REPORT_UPDATE_FAILED', message: 'Không thể xử lý báo cáo.', requestId: request.id })
    return { data }
  })
}

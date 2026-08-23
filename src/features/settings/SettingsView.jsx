import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, Settings, Target, CalendarDays, Lightbulb, CheckCircle2,
  Bell, XCircle
} from 'lucide-react';
import { todayStr } from '../../utils/streakUtils';
import {
  isCelebrationSoundEnabled,
  getSoundVolume,
  SOUND_VOLUME_KEY,
  correctSoundUrl,
  playEffect
} from '../../services/audioService';
import {
  WEEK_DAYS,
  getDailyGoal,
  saveDailyGoal,
  getStudyPlan,
  saveStudyPlan,
} from './studyPlanService';

export default function SettingsView({ onBack, userId, lesson, vocabulary, textbookTitle, computeHomeProgress }) {
  const [goal, setGoal] = useState(null);
  const [plan, setPlan] = useState(null);
  const [overallPct, setOverallPct] = useState(0);
  const [saved, setSaved] = useState(false);
  const [notifPermNote, setNotifPermNote] = useState('');
  const [celebrationSound, setCelebrationSound] = useState(isCelebrationSoundEnabled);
  const [soundVolume, setSoundVolume] = useState(getSoundVolume);

  useEffect(() => {
    let alive = true;
    const compute = computeHomeProgress ? computeHomeProgress(lesson, userId, vocabulary) : Promise.resolve([]);
    Promise.all([getDailyGoal(userId), getStudyPlan(userId), compute]).then(([g, p, prog]) => {
      if (!alive) return;
      setGoal(g);
      setPlan(p);
      if (prog && prog.length) {
        setOverallPct(Math.round(prog.reduce((s, x) => s + x.pct, 0) / prog.length));
      }
    });
    return () => { alive = false; };
  }, [userId, lesson, vocabulary, computeHomeProgress]);

  if (!goal || !plan) return <div className="cg-empty">Đang tải...</div>;

  const daysLeft = plan.targetDate
    ? Math.ceil((new Date(plan.targetDate + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000)
    : null;

  const update = (patch) => setPlan((p) => ({ ...p, ...patch }));
  const toggleDay = (key) => update({ weeklySchedule: { ...plan.weeklySchedule, [key]: !plan.weeklySchedule[key] } });

  const save = async () => {
    const clampedGoal = { ...goal, targetMinutes: Math.max(5, Math.min(180, parseInt(goal.targetMinutes, 10) || 15)) };
    setGoal(clampedGoal);
    await saveDailyGoal(clampedGoal, userId);
    await saveStudyPlan(plan, celebrationSound, userId);
    localStorage.setItem(SOUND_VOLUME_KEY, String(soundVolume));
    if (plan.reminderEnabled && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') setNotifPermNote('Trình duyệt/khung xem trước chưa cấp quyền thông báo — nhắc nhở vẫn hiện dưới dạng banner ngay trong app khi bạn mở Trang chủ.');
        else setNotifPermNote('');
      } catch (e) { setNotifPermNote(''); }
    } else {
      setNotifPermNote('');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="cg-page wide-page settings-wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Settings size={18} color="#8B85AB" /> Cài đặt</span>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title"><span><Target size={20} /></span><div>Kế hoạch học tập<small>Tạo nhịp học phù hợp với bạn</small></div></div>
        <p className="settings-hint">Đặt mục tiêu và lịch học để duy trì động lực lâu dài — tất cả đều dựa trên tiến độ thật của bạn.</p>

        <div className="settings-row settings-goal-row">
          <div className="settings-row-label">
            <b>Mục tiêu mỗi ngày</b>
            <span>Số phút học tối thiểu bạn muốn đạt mỗi ngày</span>
          </div>
          <div className="settings-minute-input">
            <input
              type="number" min={5} max={180} value={goal.targetMinutes}
              onChange={(e) => setGoal((g) => ({ ...g, targetMinutes: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))}
              onBlur={(e) => setGoal((g) => ({ ...g, targetMinutes: Math.max(5, Math.min(180, parseInt(e.target.value, 10) || 15)) }))}
            />
            <span>phút</span>
          </div>
        </div>

        <div className="settings-row settings-date-row">
          <div className="settings-row-label">
            <b>Ngày mục tiêu hoàn thành</b>
            <span>Đặt hạn để hoàn thành {textbookTitle || 'giáo trình đang học'}</span>
          </div>
          <input
            type="date" className="settings-date-input" value={plan.targetDate || ''}
            onChange={(e) => update({ targetDate: e.target.value || null })}
          />
        </div>
        {plan.targetDate && (
          <div className={`settings-projection ${daysLeft < 0 ? 'overdue' : ''}`}>
            <CalendarDays size={14} />
            {daysLeft >= 0 ? <>Còn <b>{daysLeft}</b> ngày</> : <>Đã trễ <b>{Math.abs(daysLeft)}</b> ngày</>} · Đã hoàn thành <b>{overallPct}%</b> giáo trình
          </div>
        )}

        <div className="settings-row column settings-schedule-row">
          <div className="settings-row-label">
            <b>Lịch học trong tuần</b>
            <span>Chọn những ngày bạn dự định học</span>
          </div>
          <div className="settings-week-row">
            {WEEK_DAYS.map((d) => (
              <button key={d.key} className={`settings-day-btn ${plan.weeklySchedule[d.key] ? 'on' : ''}`} onClick={() => toggleDay(d.key)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row settings-reminder-row">
          <div className="settings-row-label">
            <b>Nhắc nhở học mỗi ngày</b>
            <span>Nhắc bạn vào khung giờ cố định nếu hôm nay chưa học</span>
          </div>
          <button className={`settings-toggle ${plan.reminderEnabled ? 'on' : ''}`} onClick={() => update({ reminderEnabled: !plan.reminderEnabled })} aria-label="Bật/tắt nhắc nhở">
            <span className="settings-toggle-knob" />
          </button>
        </div>
        {plan.reminderEnabled && (
          <div className="settings-row settings-time-row">
            <div className="settings-row-label"><b>Giờ nhắc</b></div>
            <input type="time" className="settings-time-input" value={plan.reminderTime} onChange={(e) => update({ reminderTime: e.target.value })} />
          </div>
        )}
        <div className="settings-row settings-sound-row">
          <div className="settings-row-label">
            <b>Âm thanh hiệu ứng</b>
            <span>Phát khi trả lời đúng/sai, đạt mục tiêu và hoàn thành bài học</span>
          </div>
          <button className={`settings-toggle ${celebrationSound ? 'on' : ''}`} onClick={() => setCelebrationSound((enabled) => !enabled)} aria-label="Bật/tắt âm thanh chúc mừng" aria-pressed={celebrationSound}>
            <span className="settings-toggle-knob" />
          </button>
        </div>
        <div className={`settings-row settings-volume-row ${celebrationSound ? '' : 'disabled'}`}>
          <div className="settings-row-label">
            <b>Âm lượng</b>
            <span>{Math.round(soundVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={soundVolume}
            disabled={!celebrationSound}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              setSoundVolume(nextVolume);
              localStorage.setItem(SOUND_VOLUME_KEY, String(nextVolume));
            }}
            onPointerUp={() => playEffect(correctSoundUrl)}
            aria-label="Âm lượng hiệu ứng"
          />
        </div>
        {plan.reminderEnabled && (
          <p className="settings-note">
            <Lightbulb size={13} color="#E8A93D" /> App web nên nhắc nhở chỉ hoạt động khi bạn đang mở app trên trình duyệt (hiện banner ngay trong app) — chưa gửi được thông báo khi đã đóng trình duyệt.
          </p>
        )}
        {notifPermNote && <p className="settings-note">{notifPermNote}</p>}

        <button className="cg-post-btn settings-save-btn" onClick={save}>
          {saved ? <><CheckCircle2 size={15} /> Đã lưu!</> : 'Lưu kế hoạch học tập'}
        </button>
      </div>
    </section>
  );
}

export function ReminderBanner({ userId, onGoStudy }) {
  const [show, setShow] = useState(false);
  const planRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const [p, g] = await Promise.all([getStudyPlan(userId), getDailyGoal(userId)]);
      if (!alive) return;
      planRef.current = p;
      if (!p.reminderEnabled) { setShow(false); return; }
      const [h, m] = (p.reminderTime || '20:00').split(':').map(Number);
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      const pastReminderTime = nowMinutes >= h * 60 + m;
      const studiedToday = g.todayMinutes > 0;
      const alreadyShownToday = p.lastReminderShownDate === todayStr();
      setShow(pastReminderTime && !studiedToday && !alreadyShownToday);
    };
    check();
    const id = setInterval(check, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [userId]);

  const dismiss = async () => {
    setShow(false);
    const p = planRef.current;
    if (p) await saveStudyPlan({ ...p, lastReminderShownDate: todayStr() }, isCelebrationSoundEnabled(), userId);
  };

  if (!show) return null;

  return (
    <div className="reminder-banner">
      <div className="reminder-banner-ico"><Bell size={18} color="#7C6FE4" /></div>
      <div className="reminder-banner-text">
        <b>Đã đến giờ học rồi đó! 📚</b>
        <span>Hôm nay bạn chưa học gì cả — dành vài phút ôn bài nhé.</span>
      </div>
      <button className="reminder-banner-btn" onClick={() => { onGoStudy(); dismiss(); }}>Học ngay</button>
      <button className="reminder-banner-x" onClick={dismiss} aria-label="Bỏ qua nhắc nhở hôm nay"><XCircle size={18} /></button>
    </div>
  );
}

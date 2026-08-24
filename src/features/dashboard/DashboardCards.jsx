import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Target, Edit2, Sparkles, Headphones, Mic, Trophy, ChevronRight,
  TrendingUp, BookOpen, Plus, Play, CalendarDays, Coffee, BookMarked,
  Lightbulb, Type, Flame, Check
} from 'lucide-react';
import { Bar } from '../../components/common/ProgressBar';
import { Plant } from '../../components/common/Mascots';
import {
  getDailyGoal, getStudyPlan, WEEK_DAYS,
} from '../settings/studyPlanService';
import {
  isCelebrationSoundEnabled,
  playCelebrationSound,
} from '../../services/audioService';
import { computeLeaderboard } from '../leaderboard/leaderboardApi';
import { loadVocabularyReviewSchedule } from '../../lib/reviewSchedule';

export function ConfettiBurst() {
  const pieces = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.25,
    color: ['#7C6FE4', '#F0912E', '#3FA95C', '#E5566B', '#4A90E2'][i % 5], rot: Math.random() * 360,
  })), []);
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} className="confetti-piece" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, background: p.color, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

export function DailyGoalRing({ userId, onChangeGoal }) {
  const [goal, setGoal] = useState(null);
  const [plan, setPlan] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const celebratedRef = useRef(false);

  const refresh = () => Promise.all([getDailyGoal(userId), getStudyPlan(userId)]).then(([g, p]) => {
    setGoal(g);
    setPlan(p);
  });
  useEffect(() => {
    const syncImmediately = (event) => event.detail ? setGoal(event.detail) : refresh();
    refresh();
    const id = setInterval(refresh, 5000);
    window.addEventListener('kstudy:daily-goal-updated', syncImmediately);
    return () => {
      clearInterval(id);
      window.removeEventListener('kstudy:daily-goal-updated', syncImmediately);
    };
  }, [userId]);

  useEffect(() => {
    if (!goal) return;
    const done = goal.targetMinutes > 0 && goal.todayMinutes >= goal.targetMinutes;
    const celebrationKey = `kstudy:daily-goal-celebrated:${goal.todayDate}`;
    const alreadyCelebrated = localStorage.getItem(celebrationKey) === 'true';
    if (done && !celebratedRef.current && !alreadyCelebrated) {
      celebratedRef.current = true;
      localStorage.setItem(celebrationKey, 'true');
      setShowConfetti(true);
      if (isCelebrationSoundEnabled()) playCelebrationSound();
      setTimeout(() => setShowConfetti(false), 1300);
    }
    if (!done) celebratedRef.current = false;
  }, [goal]);

  if (!goal || !plan) return null;
  const weekdayKey = WEEK_DAYS[(new Date().getDay() + 6) % 7]?.key;
  const isRestDay = plan.weeklySchedule?.[weekdayKey] === false;
  const pct = Math.min(100, Math.round((goal.todayMinutes / Math.max(1, goal.targetMinutes)) * 100));
  const r = 40, c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  const done = pct >= 100;

  return (
    <section className="card goal-card">
      <div className="card-title-row">
        <div className="card-title"><Target size={19} color="#7C6FE4" /> Mục tiêu trong ngày</div>
        <button className="link-btn" onClick={onChangeGoal}><Edit2 size={13} /> Đổi mục tiêu</button>
      </div>
      <div className="goal-ring-row">
        {showConfetti && <ConfettiBurst />}
        {isRestDay ? (
          <div className="goal-rest-day" aria-label="Hôm nay là ngày nghỉ">
            <Coffee size={34} color="#8B7BE8" />
            <div><b>Nay là ngày nghỉ</b><span>Nghỉ ngơi để mai học thật tốt nhé.</span></div>
          </div>
        ) : <>
        <svg viewBox="0 0 100 100" width="88" height="88">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#EEEBF8" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke={done ? '#3FA95C' : '#7C6FE4'} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray .4s' }}
          />
          <text x="50" y="47" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2E2A4A">{pct}%</text>
          <text x="50" y="64" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#8B85AB">{Math.round(goal.todayMinutes)}/{goal.targetMinutes} phút</text>
        </svg>
        <div className="goal-msg">
          {done
            ? <span>🎉 Chúc mừng, bạn đã đạt mục tiêu học hôm nay!</span>
            : <span>Còn khoảng {Math.max(0, Math.round(goal.targetMinutes - goal.todayMinutes))} phút nữa là đạt mục tiêu hôm nay!</span>}
        </div>
        </>}
      </div>
    </section>
  );
}

export function QuickAccessMenu({ onDictation, onShadowing, onReview }) {
  const items = [
    { label: 'Nghe chép chính tả', icon: Headphones, color: '#3FA95C', bg: '#EBF7EE', onClick: onDictation },
    { label: 'Shadowing', icon: Mic, color: '#7C6FE4', bg: '#F0EEFC', onClick: onShadowing },
    { label: 'Thi thử', icon: Target, color: '#F0912E', bg: '#FDF3E7', onClick: onReview },
  ];
  return (
    <section className="card quick-access-card">
      <div className="card-title"><Sparkles size={19} color="#7C6FE4" /> Truy cập nhanh</div>
      <div className="qa-grid">
        {items.map((it) => (
          <button key={it.label} className="qa-card" style={{ background: it.bg }} onClick={it.onClick}>
            <it.icon size={26} color={it.color} />
            <span style={{ color: it.color }}>{it.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function RankPreviewCard({ profile, onOpen }) {
  const [lb, setLb] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!profile) return;
    computeLeaderboard(profile).then((l) => { if (alive) setLb(l); });
    return () => { alive = false; };
  }, [profile]);

  return (
    <button className="rank-preview-card" onClick={onOpen}>
      <div className="rank-preview-ico"><Trophy size={22} color="#F0912E" /></div>
      <div className="rank-preview-body">
        {lb && lb.myRank ? (
          <>
            <b>Bạn đang hạng {lb.myRank}{lb.total ? ` / ${lb.total}` : ''} tuần này</b>
            <span>Cố lên nhé! Bấm để xem bảng xếp hạng đầy đủ.</span>
          </>
        ) : (
          <>
            <b>Chưa có hạng</b>
            <span>Học thêm để xuất hiện trên bảng xếp hạng!</span>
          </>
        )}
      </div>
      <ChevronRight size={18} color="#C9BCF2" />
    </button>
  );
}

export function RecentActivityCard({ profile, lesson, vocabulary, computeHomeProgress, computeAndSyncUserStats }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let alive = true;
    const progP = computeHomeProgress ? computeHomeProgress(lesson, profile?.id, vocabulary) : Promise.resolve([]);
    const statP = computeAndSyncUserStats ? computeAndSyncUserStats(profile, lesson) : Promise.resolve({ streak: 0 });
    Promise.all([progP, statP]).then(([progress, stats]) => {
      if (!alive) return;
      const best = [...(progress || [])].sort((a, b) => b.pct - a.pct)[0];
      setSummary({ best, streak: stats?.streak ?? 0 });
    });
    return () => { alive = false; };
  }, [profile, lesson, vocabulary, computeHomeProgress, computeAndSyncUserStats]);

  return (
    <section className="recent-card">
      <div className="card-title"><TrendingUp size={18} color="#7C6FE4" /> Hoạt động gần đây</div>
      <div className="recent-list">
        <div className="recent-item purple">
          <span className="recent-dot" />
          <div><span>Tiến độ tốt nhất</span><b>{summary?.best?.label || 'Chưa có hoạt động'}{summary?.best ? ` · ${summary.best.pct}%` : ''}</b></div>
        </div>
        <div className="recent-item green">
          <span className="recent-dot" />
          <div><span>Chuyên cần</span><b>Đạt chuỗi {summary?.streak ?? 0} ngày streak</b></div>
        </div>
      </div>
    </section>
  );
}

export function ContinueLearning({ onGo, textbook, lesson, hasStarted = false, plantVariant = 'mugunghwa' }) {
  const overallPct = lesson?.progressPercent ?? textbook?.progressPercent ?? 0;
  const isCompleted = overallPct >= 100 || lesson?.status === 'done';
  if (!textbook || !lesson) {
    const hasTextbook = Boolean(textbook);
    return (
      <section className="card continue continue-empty">
        <div className="card-title">Tạm nghỉ ngơi</div>
        <div className="continue-empty-body"><Coffee size={30} /><div><b>{hasTextbook ? 'Tạm chưa có bài học mới' : 'Chưa có bài học nào'}</b><span>{hasTextbook ? 'Bạn đã hoàn thành các bài hiện có. Nghỉ một chút nhé!' : 'Thêm một giáo trình vào danh sách của bạn khi sẵn sàng bắt đầu.'}</span></div></div>
        {!hasTextbook && <button className="primary-btn" onClick={onGo}><Plus size={16} /> Thêm giáo trình</button>}
      </section>
    );
  }
  return (
    <section className="card continue">
      <div className="card-title-row">
        <div className="card-title">{isCompleted ? 'Đã hoàn thành' : hasStarted ? 'Tiếp tục học' : 'Bắt đầu học'}</div>
      </div>
      <div className="cont-body">
        <div className="book-3d" style={{ '--bk': '#7C6FE4' }}>{lesson.no}과</div>
        <div className="cont-info">
          <b>Bài {lesson.no}</b>
          <span className="cont-book">{textbook.title}</span>
          <div className="cont-bar">
            <Bar pct={overallPct} color="#8B7BE8" h={8} />
            <em>{overallPct}%</em>
          </div>
        </div>
        <div className="cont-plant"><Plant progress={overallPct} variant={plantVariant} /></div>
      </div>
      <button className="primary-btn" onClick={onGo}>
        {isCompleted ? <Check size={16} /> : <Play size={16} fill="#fff" />}
        {isCompleted ? 'Đã hoàn thành hôm nay' : hasStarted ? 'Tiếp tục học' : 'Bắt đầu học'}
      </button>
    </section>
  );
}

export function RadarChart({ axes, size = 200 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 38;
  const n = axes.length;
  const angleFor = (i) => (-90 + i * (360 / n)) * (Math.PI / 180);
  const pointAt = (i, scale) => {
    const a = angleFor(i);
    return [cx + r * scale * Math.cos(a), cy + r * scale * Math.sin(a)];
  };
  const dataPoints = axes.map((ax, i) => pointAt(i, Math.max(0.04, ax.pct / 100)));
  const dataPath = dataPoints.map((p) => p.join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {[0.25, 0.5, 0.75, 1].map((lv, idx) => (
        <polygon key={idx} points={axes.map((_, i) => pointAt(i, lv).join(' '))} fill="none" stroke="#E7E3F6" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pointAt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E7E3F6" strokeWidth="1" />;
      })}
      <polygon points={dataPath} fill="rgba(124,111,228,.35)" stroke="#7C6FE4" strokeWidth="2" strokeLinejoin="round" />
      {dataPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#7C6FE4" />)}
      {axes.map((ax, i) => {
        const [lx, ly] = pointAt(i, 1.26);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="800" fill="#4B4470">
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

export function PersonalProgressSection({ profile, lesson, vocabulary, computeRadarStats }) {
  const [axes, setAxes] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!profile || !computeRadarStats) return;
    computeRadarStats(lesson, profile, vocabulary).then((d) => {
      if (!alive) return;
      setAxes(d.axes);
      setDetail(d.detail);
    });
    return () => { alive = false; };
  }, [profile, lesson, vocabulary, computeRadarStats]);

  if (!axes) return null;

  return (
    <section className="card radar-card">
      <div className="card-title-row">
        <div className="card-title"><Target size={19} color="#7C6FE4" /> Tiến độ cá nhân</div>
        <button className="link-btn" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? 'Thu gọn' : 'Xem chi tiết'} <ChevronRight size={15} className={showDetail ? 'chev-rot' : ''} />
        </button>
      </div>
      <div className={`radar-row ${showDetail ? 'with-detail' : ''}`}>
        <div className="radar-chart-wrap"><RadarChart axes={axes} size={200} /></div>
        {showDetail && detail && (
          <div className="radar-detail">
            <div className="radar-achieve-grid">
              <div className="radar-achieve"><Type size={16} color="#7C6FE4" /><span>{detail.vocab.count}/{detail.vocab.total}</span><small>Từ vựng</small></div>
              <div className="radar-achieve"><Headphones size={16} color="#4A90E2" /><span>{detail.listening.count}/{detail.listening.total}</span><small>Nghe</small></div>
              <div className="radar-achieve"><Mic size={16} color="#3FA95C" /><span>{detail.pronunciation.count}/{detail.pronunciation.total}</span><small>Phát âm</small></div>
              <div className="radar-achieve">
                <Target size={16} color="#E5566B" />
                <span>{detail.reflex ? `${detail.reflex.avgTimeLeft}s` : '—'}</span>
                <small>Phản xạ{detail.reflex ? ` (${detail.reflex.count} lượt)` : ' (chưa có)'}</small>
              </div>
              <div className="radar-achieve radar-achieve-wide">
                <Flame size={16} color="#F0642E" fill="#F79A5E" /><span>{detail.retained.count}/{detail.retained.total}</span><small>Kiến thức còn nhớ (từ nhớ lâu)</small>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ReviewSchedule({ userId, onReview }) {
  const [schedule, setSchedule] = useState([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await loadVocabularyReviewSchedule(userId, 14);
      const days = result.map((item, index) => {
        const [year, month, day] = item.dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return {
          date,
          words: item.words,
          label: index === 0 ? 'Hôm nay' : index === 1 ? 'Ngày mai' : date.toLocaleDateString('vi-VN', { weekday: 'short' }),
        };
      });
      if (alive) setSchedule(days);
    })();
    return () => { alive = false; };
  }, [userId]);

  const picked = schedule[selected];
  return (
    <section className="card review">
      <div className="card-title-row">
        <div className="card-title"><CalendarDays size={19} color="#7C6FE4" /> Lịch ôn từ vựng</div>
        <span className="review-cycle">Chu kỳ 1–3–7 ngày</span>
      </div>
      <div className="days">
        {schedule.map((d, index) => (
          <div key={d.date.toISOString()} className={`day ${index === 0 ? 'today' : ''} ${selected === index ? 'selected' : ''} ${d.words.length ? 'has-review' : 'rest-day'}`} role="button" tabIndex={0} onClick={() => setSelected(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index); } }}>
            <span className="day-name">{d.label}</span>
            <span className="day-date">{d.date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
            <span className="day-words">{d.words.length ? `${d.words.length} từ` : 'Nghỉ ngơi'}</span>
            {index === 0 && d.words.length ? (
              <button
                className="on-ngay"
                onClick={(event) => { event.stopPropagation(); if (d.words.length) onReview(d.words, d.label); }}
              >
                Ôn ngay
              </button>
            ) : <span className={`day-ico ${d.words.length ? '' : 'rest'}`}>{d.words.length ? <BookMarked size={16} /> : <Coffee size={16} />}</span>}
          </div>
        ))}
      </div>
      {picked && (
        <div className="review-selected-day">
          <div><b>{picked.label} · {picked.date.toLocaleDateString('vi-VN')}</b><span>{picked.words.length ? `${picked.words.length} từ đang chờ bạn ôn lại` : 'Ngày nghỉ — không có từ nào cần ôn'}</span></div>
          {selected === 0 && picked.words.length > 0 && <span className="review-current-note">Bấm “Ôn ngay” ở ô Hôm nay để bắt đầu</span>}
        </div>
      )}
      <div className="tip">
        <Lightbulb size={17} color="#E8A93D" fill="#F7D98B" />
        <b>Mẹo học tập</b>
        <span>Ôn từ vựng theo chu kỳ (1 ngày – 3 ngày – 7 ngày) giúp bạn ghi nhớ lâu hơn!</span>
        <ChevronRight size={16} color="#9A8FE0" />
      </div>
    </section>
  );
}

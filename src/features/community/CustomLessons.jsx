import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Copy, Link2, BookMarked, BookOpen, Sparkles, XCircle, Plus,
  Image as ImageIcon, ChevronLeft, ChevronRight, Lightbulb, Globe2, LockKeyhole, Trash2,
  BarChart3, X, Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadCloudinaryAsset } from '../../services/cloudinaryUpload';
import { requestAIJson } from '../../services/aiService';
import { playCorrectSound, playIncorrectSound } from '../../services/audioService';
import { renderKo, shuffleArr } from '../../utils/textUtils';
import { SwBunnyEmpty } from '../../components/common/Mascots';
import { useAppDialog } from '../../components/common/AppDialog';

const DEFAULT_CUSTOM_QUIZ_TYPES = ['fillblank'];

export const genLessonCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

export const mapCustomLessonRow = (row) => ({
  id: row.id,
  code: row.code,
  creatorId: row.creator_id,
  title: row.title,
  author: row.profiles?.display_name || 'Người học',
  createdAt: new Date(row.created_at).getTime(),
  words: Array.isArray(row.words) ? row.words : [],
  quizTypes: Array.isArray(row.quiz_types) ? row.quiz_types : [],
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  visibility: row.visibility || 'public',
  status: row.status || 'visible',
});

export async function generateLessonContent(words) {
  const wordList = words.map((w, i) => `${i + 1}. ${w.ko} = ${w.vi}`).join('\n');
  const prompt = `Bạn là giáo viên tiếng Hàn dạy cho người Việt. Danh sách từ vựng tiếng Hàn sau đây do một học viên tự soạn:
${wordList}

Với MỖI từ theo đúng thứ tự trên, hãy soạn:
1. "example": một câu tiếng Hàn tự nhiên, đơn giản, có dùng đúng từ đó, đánh dấu chính xác từ mục tiêu bằng ** ** (ví dụ: "저는 아침에 **커피**를 마셔요.").
2. "exampleVi": bản dịch tiếng Việt của câu ví dụ trên.
3. "mnemonic": một mẹo ghi nhớ ngắn (1 câu) bằng tiếng Việt để người Việt dễ nhớ từ này — có thể chiết tự Hán Việt nếu phù hợp, liên tưởng âm thanh, hoặc hình ảnh.
4. "wrongExamples": Mảng gồm đúng 3 câu tiếng Hàn dùng SAI từ mục tiêu đó hoặc sai ngữ pháp/ngữ cảnh (làm đáp án nhiễu cho bài trắc nghiệm "Chọn câu dùng đúng"), mỗi câu là một câu hoàn chỉnh nhưng kết hợp sai ngữ cảnh của từ này.

Trả lời CHỈ bằng JSON, không thêm markdown hay chữ nào khác, theo đúng cấu trúc:
{"items": [{"example": "...", "exampleVi": "...", "mnemonic": "...", "wrongExamples": ["...", "...", "..."]}]}

Mảng "items" phải có đúng ${words.length} phần tử, theo đúng thứ tự danh sách từ ở trên.`;

  const { value: parsed } = await requestAIJson(prompt);
  if (!Array.isArray(parsed.items) || parsed.items.length !== words.length) throw new Error('malformed AI response');
  return parsed.items;
}

function fallbackLessonContent(words) {
  return words.map((word) => ({
    example: `저는 오늘 **${word.ko}** 단어를 공부해요.`,
    exampleVi: `Hôm nay tôi học từ “${word.ko}” (${word.vi}).`,
    mnemonic: `Liên tưởng “${word.ko}” với hình ảnh hoặc tình huống quen thuộc mang nghĩa “${word.vi}”.`,
    wrongExamples: [
      `저는 ${word.ko}을/를 시원하게 마셨어요.`,
      `어제 ${word.ko}을/를 입고 학교에 갔어요.`,
      `${word.ko}이/가 너무 빨라서 따라갈 수 없어요.`
    ]
  }));
}

export function ShareCodeBox({ code, onCreateAnother }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef(null);
  const shareText = `Mình vừa tạo một bộ từ vựng tiếng Hàn trên app! Vào Cộng đồng > Khám phá rồi nhập mã: ${code}`;

  const doCopy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(shareText);
      ok = true;
    } catch (e) {
      try {
        const ta = taRef.current;
        if (ta) {
          ta.value = shareText;
          ta.style.display = 'block';
          ta.select();
          ok = document.execCommand('copy');
          ta.style.display = 'none';
        }
      } catch (e2) { ok = false; }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="cl-saved-box">
      <CheckCircle2 size={26} color="#3FA95C" />
      <p>Đã lưu bộ từ vựng! Gửi mã này để bạn bè thêm đúng bộ của bạn:</p>
      <div className="cl-code-display">{code}</div>
      <button className="cl-copy-btn" onClick={doCopy}>
        {copied ? (<><CheckCircle2 size={15} /> Đã sao chép!</>) : (<><Copy size={15} /> Sao chép nội dung mời</>)}
      </button>
      <textarea ref={taRef} readOnly style={{ position: 'absolute', left: '-9999px', display: 'none' }} />
      <button className="cl-post-btn" onClick={onCreateAnother}>Tạo bộ khác</button>
    </div>
  );
}

const STAT_COLORS = ['#7565E8', '#46B96B', '#F2B84B', '#EF7D7D', '#5CA7E8', '#A96CE0', '#50BFC2', '#E58E4D', '#8A93A8', '#D96C9D', '#BCC2D1'];

function CustomLessonStatsModal({ lesson, onClose }) {
  const [rows, setRows] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let alive = true;
    setRows(null);
    setPage(1);
    if (!supabase || !lesson?.id) return undefined;
    supabase
      .from('custom_lesson_results')
      .select('user_id, score, total, percentage, completed_at, profiles!custom_lesson_results_user_id_fkey(display_name)')
      .eq('lesson_id', lesson.id)
      .order('percentage', { ascending: false })
      .order('completed_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        setRows(error ? [] : (data || []));
      });
    return () => { alive = false; };
  }, [lesson?.id]);

  const results = rows || [];
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const pageRows = results.slice((page - 1) * pageSize, page * pageSize);
  const scoreGroups = [...results.reduce((groups, row) => {
    const score = Math.round(Number(row.percentage || 0) / 10);
    groups.set(score, (groups.get(score) || 0) + 1);
    return groups;
  }, new Map()).entries()].sort((a, b) => b[0] - a[0]);
  let cursor = 0;
  const pieSegments = scoreGroups.map(([score, count], index) => {
    const start = cursor;
    cursor += results.length ? count / results.length * 100 : 0;
    return `${STAT_COLORS[index % STAT_COLORS.length]} ${start}% ${cursor}%`;
  });

  return (
    <div className="cl-stats-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cl-stats-modal" role="dialog" aria-modal="true" aria-label={`Thống kê ${lesson.title}`}>
        <header>
          <div><BarChart3 size={20} /><span><b>Thống kê bộ từ vựng</b><small>{lesson.title}</small></span></div>
          <button type="button" onClick={onClose} aria-label="Đóng thống kê"><X size={19} /></button>
        </header>
        {rows === null ? (
          <div className="cg-loading"><Sparkles size={18} /> Đang tải thống kê...</div>
        ) : !results.length ? (
          <div className="cg-empty"><SwBunnyEmpty /><p>Chưa có học viên hoàn thành bài kiểm tra của bộ này.</p></div>
        ) : (
          <>
            <div className="cl-stats-overview">
              <div className="cl-score-pie" style={{ background: `conic-gradient(${pieSegments.join(', ')})` }}><span><b>{results.length}</b> học viên</span></div>
              <div className="cl-score-legend">
                {scoreGroups.map(([score, count], index) => (
                  <div key={score}><i style={{ background: STAT_COLORS[index % STAT_COLORS.length] }} /><span><b>{score}/10 điểm</b><small>{count} học viên · {Math.round(count / results.length * 100)}%</small></span></div>
                ))}
              </div>
            </div>
            <div className="cl-student-results">
              <h4><Users size={16} /> Danh sách học viên</h4>
              {pageRows.map((row) => (
                <div key={row.user_id}>
                  <span><b>{row.profiles?.display_name || 'Học viên'}</b><small>{new Date(row.completed_at).toLocaleString('vi-VN')}</small></span>
                  <strong>{Math.round(Number(row.percentage || 0) / 10)}/10</strong>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="cl-stats-pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
                <span>{page} / {totalPages}</span>
                <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export function CustomLessonHub({ profile, onStudy, onBack, mode = 'library' }) {
  const dialog = useAppDialog();
  const [subTab, setSubTab] = useState('browse');
  const [lessons, setLessons] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [findErr, setFindErr] = useState('');
  const [finding, setFinding] = useState(false);
  const [savedLessons, setSavedLessons] = useState(null);

  const [title, setTitle] = useState('');
  const [words, setWords] = useState([
    { ko: '', vi: '', img: '', showImg: false },
    { ko: '', vi: '', img: '', showImg: false },
    { ko: '', vi: '', img: '', showImg: false }
  ]);
  const [visibility, setVisibility] = useState('public');
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [wordUploads, setWordUploads] = useState({});
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [genError, setGenError] = useState('');
  const [savedCode, setSavedCode] = useState(null);
  const [statsLesson, setStatsLesson] = useState(null);

  const loadSavedCodes = async () => {
    try {
      if (!supabase || !profile?.id) throw new Error('Supabase chưa được cấu hình');
      const { data, error } = await supabase
        .from('custom_lesson_bookmarks')
        .select('lesson_id, custom_lessons(id, code, creator_id, title, words, quiz_types, attachments, visibility, status, created_at, profiles!custom_lessons_creator_id_fkey(display_name))')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = (data || []).map((bookmark) => bookmark.custom_lessons).filter(Boolean).map(mapCustomLessonRow);
      setSavedLessons(items);
    } catch (e) { setSavedLessons([]); }
  };

  const removeFromNotebook = async (code) => {
    try {
      if (!supabase || !profile?.id) throw new Error('Phiên đăng nhập đã hết hạn');
      const lessonId = savedLessons?.find((item) => item.code === code)?.id;
      if (!lessonId) return;
      const { error } = await supabase.from('custom_lesson_bookmarks').delete().eq('user_id', profile.id).eq('lesson_id', lessonId);
      if (error) throw error;
      setSavedLessons((items) => (items || []).filter((item) => item.code !== code));
    } catch (e) { }
  };

  const loadLessons = async () => {
    try {
      if (!supabase || !profile?.id) throw new Error('Phiên đăng nhập đã hết hạn');
      const { data, error } = await supabase
        .from('custom_lessons')
        .select('id, code, creator_id, title, words, quiz_types, attachments, visibility, status, created_at, profiles!custom_lessons_creator_id_fkey(display_name)')
        .eq('status', 'visible')
        .eq('creator_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLessons((data || []).map(mapCustomLessonRow));
    } catch (e) { setLessons([]); }
  };

  useEffect(() => { loadLessons(); loadSavedCodes(); }, [profile?.id]);

  const updateWord = (i, field, val) => { setGeneratedDraft(null); setWords((ws) => ws.map((w, idx) => (idx === i ? { ...w, [field]: val } : w))); };
  const addWordRow = () => { setGeneratedDraft(null); setWords((ws) => [...ws, { ko: '', vi: '', img: '', showImg: false }]); };
  const removeWordRow = (i) => { setGeneratedDraft(null); setWords((ws) => ws.filter((_, idx) => idx !== i)); };

  const uploadWordImage = async (i, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setUploadError('Ảnh từ vựng phải là tệp hình ảnh.');
    if (file.size > 5 * 1024 * 1024) return setUploadError('Mỗi ảnh từ vựng tối đa 5 MB.');
    setUploadError('');
    setWordUploads((state) => ({ ...state, [i]: true }));
    try {
      const asset = await uploadCloudinaryAsset(file, 'community');
      updateWord(i, 'img', asset.url);
      updateWord(i, 'showImg', true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Không tải được ảnh.');
    } finally {
      setWordUploads((state) => ({ ...state, [i]: false }));
    }
  };

  const generatePreview = async () => {
    const validWords = words.filter((w) => w.ko.trim() && w.vi.trim());
    if (!title.trim() || validWords.length < 2 || saving) return;
    setSaving(true);
    setGenError('');
    setGenStep('ai');

    let enrichedWords = validWords.map((w) => ({ ko: w.ko.trim(), vi: w.vi.trim(), img: w.img?.trim() || undefined }));
    try {
      const items = await generateLessonContent(enrichedWords);
      enrichedWords = enrichedWords.map((w, i) => ({
        ...w,
        example: items[i]?.example,
        exampleVi: items[i]?.exampleVi,
        mnemonic: items[i]?.mnemonic,
        wrongExamples: Array.isArray(items[i]?.wrongExamples) ? items[i].wrongExamples : []
      }));
    } catch (e) {
      const items = fallbackLessonContent(enrichedWords);
      enrichedWords = enrichedWords.map((w, i) => ({ ...w, ...items[i], enrichmentSource: 'fallback' }));
      setGenError('AI đang bận nên hệ thống dùng nội dung dự phòng. Bạn hãy xem trước rồi vẫn có thể lưu bình thường.');
    }

    setGeneratedDraft({ title: title.trim(), words: enrichedWords, quizTypes: DEFAULT_CUSTOM_QUIZ_TYPES, visibility });
    setGenStep('');
    setSaving(false);
  };

  const deleteOwnSet = async (lesson) => {
    if (!supabase || !profile?.id || lesson.creatorId !== profile.id) return;
    const confirmed = await dialog.confirm({
      title: 'Xóa bộ từ vựng?',
      message: `Bộ từ vựng “${lesson.title}” cùng toàn bộ nội dung sẽ bị xóa vĩnh viễn và không thể hoàn tác.`,
      variant: 'warning',
      confirmLabel: 'Xóa bộ từ vựng',
      cancelLabel: 'Giữ lại',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('custom_lessons').delete().eq('id', lesson.id);
      if (error) throw error;

      setLessons((items) => (items || []).filter((item) => item.id !== lesson.id));
      setSavedLessons((items) => (items || []).filter((item) => item.id !== lesson.id));
    } catch {
      await dialog.alert({
        title: 'Chưa thể xóa bộ từ vựng',
        message: 'Không thể xóa bộ từ vựng lúc này. Vui lòng thử lại sau.',
        variant: 'error',
      });
    }
  };

  const saveLesson = async () => {
    if (!generatedDraft || saving) return;
    setSaving(true);
    setGenError('');
    setGenStep('saving');
    const code = genLessonCode();
    try {
      if (!supabase || !profile?.id) throw new Error('Phiên đăng nhập đã hết hạn');
      const { data: createdLesson, error } = await supabase.from('custom_lessons').insert({
        code,
        creator_id: profile.id,
        title: generatedDraft.title,
        words: generatedDraft.words,
        quiz_types: generatedDraft.quizTypes,
        visibility: generatedDraft.visibility,
        attachments,
      }).select('id').single();
      if (error) throw error;
      const { error: bookmarkError } = await supabase.from('custom_lesson_bookmarks').insert({ user_id: profile.id, lesson_id: createdLesson.id });
      if (bookmarkError) throw bookmarkError;
      setSavedCode(code);
      setTitle('');
      setWords([{ ko: '', vi: '', img: '', showImg: false }, { ko: '', vi: '', img: '', showImg: false }, { ko: '', vi: '', img: '', showImg: false }]);
      setVisibility('public');
      setGeneratedDraft(null);
      setAttachments([]);
      await loadLessons();
      await loadSavedCodes();
    } catch (e) {
      setGenError('Không lưu được bộ từ vựng lúc này (có thể do mất kết nối) — vui lòng thử lại.');
    }
    setGenStep('');
    setSaving(false);
  };

  const findByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code || finding) return;
    setFinding(true);
    setFindErr('');
    try {
      if (!supabase) throw new Error('Supabase chưa được cấu hình');
      const { data: importedId, error: importError } = await supabase.rpc('import_custom_lesson_by_code', { p_code: code });
      if (importError) throw importError;
      if (!importedId) {
        setFindErr('Không tìm thấy mã này.');
        setFinding(false);
        return;
      }
      const { data, error } = await supabase
        .from('custom_lessons')
        .select('id, code, creator_id, title, words, quiz_types, attachments, visibility, status, created_at, profiles!custom_lessons_creator_id_fkey(display_name)')
        .eq('id', importedId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        await loadSavedCodes();
        if (mode === 'community') {
          setCodeInput('');
          setFindErr('Đã thêm bộ từ vựng vào mục “Bộ từ vựng khác”.');
        } else {
          onStudy(mapCustomLessonRow(data));
        }
      }
      else setFindErr('Không tìm thấy mã này.');
    } catch (e) {
      setFindErr('Không tìm thấy mã này — kiểm tra lại bạn nhé.');
    }
    setFinding(false);
  };

  if (mode === 'community') {
    const ownLessons = lessons || [];
    const otherLessons = (savedLessons || []).filter((lesson) => lesson.creatorId !== profile?.id);
    const renderCommunitySet = (lesson, own) => (
      <div key={lesson.code} className="cl-item">
        <div className="cl-item-body">
          <b>{lesson.title}</b>
          <span>{own ? 'Bộ của tôi' : `bởi ${lesson.author}`} · {lesson.words.length} từ · mã {lesson.code}</span>
        </div>
        <div className="cl-item-actions">
          {own ? (
            <button className="cl-stats-btn" onClick={() => setStatsLesson(lesson)}><BarChart3 size={15} /> Xem thống kê</button>
          ) : (
            <button className="cl-notebook-remove" onClick={() => removeFromNotebook(lesson.code)} aria-label="Bỏ bộ từ vựng đã thêm" title="Bỏ khỏi danh sách đã thêm"><XCircle size={16} /></button>
          )}
          <button className="cl-study-btn" onClick={() => onStudy(lesson)}>Học ngay</button>
        </div>
      </div>
    );

    return (
      <div className="cl-hub cl-community-discovery">
        <div className="cl-find-card">
          <div className="cl-find-copy">
            <span className="cl-find-icon"><Link2 size={19} /></span>
            <div><b>Thêm bộ từ vựng bằng mã</b><span>Nhập mã 6 ký tự do học viên khác chia sẻ.</span></div>
          </div>
          <div className="cl-find-row">
            <input className="cl-find-input" value={codeInput} onChange={(event) => setCodeInput(event.target.value.toUpperCase())} placeholder="Ví dụ: AB3XZ9" maxLength={6} />
            <button className="cl-find-btn" onClick={findByCode} disabled={!codeInput.trim() || finding}>{finding ? 'Đang thêm...' : 'Thêm bằng mã'}</button>
          </div>
          {findErr && <div className="cl-find-err">{findErr}</div>}
        </div>

        <div className="cl-section-title"><div><BookOpen size={17} /><b>Bộ từ vựng của tôi</b></div><span>Các bộ do chính bạn tạo.</span></div>
        {lessons === null ? <div className="cg-loading"><Sparkles size={18} /> Đang tải...</div> : ownLessons.length ? <div className="cl-list">{ownLessons.map((lesson) => renderCommunitySet(lesson, true))}</div> : <div className="cg-empty compact"><p>Bạn chưa tạo bộ từ vựng nào.</p></div>}

        <div className="cl-section-title"><div><BookMarked size={17} /><b>Bộ từ vựng khác</b></div><span>Các bộ của học viên khác mà bạn đã thêm bằng mã.</span></div>
        {savedLessons === null ? <div className="cg-loading"><Sparkles size={18} /> Đang tải...</div> : otherLessons.length ? <div className="cl-list">{otherLessons.map((lesson) => renderCommunitySet(lesson, false))}</div> : <div className="cg-empty compact"><p>Chưa có bộ nào được thêm bằng mã.</p></div>}
        {statsLesson && <CustomLessonStatsModal lesson={statsLesson} onClose={() => setStatsLesson(null)} />}
      </div>
    );
  }

  return (
    <div className="cl-hub">
      {onBack && (
        <div className="fc2-topbar">
          <div className="fc2-top-left">
            <button className="fc2-back" onClick={onBack} aria-label="Về Từ vựng và Ngữ pháp"><ChevronLeft size={20} /></button>
            <span className="fc2-title"><BookOpen size={18} color="#7C6FE4" /> Bộ từ vựng</span>
          </div>
        </div>
      )}
      <div className="cg-tabs mini">
        <button className={`cg-tab ${subTab === 'browse' ? 'on' : ''}`} onClick={() => setSubTab('browse')}>Thư viện</button>
        <button className={`cg-tab ${subTab === 'create' ? 'on' : ''}`} onClick={() => setSubTab('create')}>Tạo bộ từ vựng</button>
      </div>

      {subTab === 'browse' ? (
        <>
          <div className="cl-section-title">
            <div><BookOpen size={17} /> <b>Bộ từ vựng của tôi</b></div>
            <span>Chỉ hiển thị các bộ từ vựng do bạn tự tạo.</span>
          </div>

          {lessons === null ? (
            <div className="cg-loading"><Sparkles size={18} color="#7C6FE4" /> Đang tải...</div>
          ) : lessons.length === 0 ? (
            <div className="cg-empty"><SwBunnyEmpty /><p>Bạn chưa tự tạo bộ từ vựng nào.</p><button className="cg-post-btn" onClick={() => setSubTab('create')}>Tạo bộ từ vựng</button></div>
          ) : (
            <div className="cl-list">
              {lessons.map((l) => (
                <div key={l.code} className="cl-item">
                  <div className="cl-item-body">
                    <b>{l.title}</b>
                    <span>{l.words.length} từ · {l.visibility === 'private' ? 'Riêng tư' : 'Công khai'} · mã {l.code}</span>
                  </div>
                  <div className="cl-item-actions">
                    <button
                      className="cl-notebook-remove"
                      onClick={() => deleteOwnSet(l)}
                      aria-label="Xóa bộ từ vựng"
                      title="Xóa vĩnh viễn bộ từ vựng này"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button className="cl-stats-btn" onClick={() => setStatsLesson(l)}><BarChart3 size={15} /> Xem thống kê</button>
                    <button className="cl-study-btn" onClick={() => onStudy(l)}>Học ngay</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : savedCode ? (
        <ShareCodeBox code={savedCode} onCreateAnother={() => setSavedCode(null)} />
      ) : (
        <div className="cl-create-form">
          <div className="cl-create-head">
            <span><Sparkles size={20} /></span>
            <div>
              <h3>Tạo bộ từ vựng của riêng bạn</h3>
              <p>Thêm từ, chọn dạng kiểm tra, xem nội dung AI tạo rồi mới lưu và lấy mã.</p>
            </div>
          </div>
          <label className="auth-label">Tên bộ từ vựng</label>
          <input className="auth-input" value={title} onChange={(e) => { setTitle(e.target.value); setGeneratedDraft(null); }} placeholder="VD: Từ vựng du lịch của mình" />

          <label className="auth-label">Quyền riêng tư</label>
          <div className="cl-quiz-types cl-visibility-types">
            <button type="button" className={`cl-quiz-chip ${visibility === 'public' ? 'on' : ''}`} onClick={() => { setVisibility('public'); setGeneratedDraft(null); }}>
              <Globe2 size={16} /><span>Công khai<small>Có thể chia sẻ với người khác bằng mã</small></span>
            </button>
            <button type="button" className={`cl-quiz-chip ${visibility === 'private' ? 'on' : ''}`} onClick={() => { setVisibility('private'); setGeneratedDraft(null); }}>
              <LockKeyhole size={16} /><span>Riêng tư<small>Chỉ người có mã mới thêm được vào thư viện</small></span>
            </button>
          </div>

          <label className="auth-label">Danh sách từ (tối thiểu 2 từ)</label>
          {words.map((w, i) => (
            <div key={i} className="cl-word-block">
              <div className="cl-word-row">
                <span className="cl-word-number">{i + 1}</span>
                <input className="cl-word-input" lang="ko" value={w.ko} onChange={(e) => updateWord(i, 'ko', e.target.value)} placeholder="Tiếng Hàn" />
                <input className="cl-word-input" value={w.vi} onChange={(e) => updateWord(i, 'vi', e.target.value)} placeholder="Nghĩa tiếng Việt" />
                {words.length > 2 && (
                  <button className="cl-word-remove" onClick={() => removeWordRow(i)} aria-label="Xoá từ"><XCircle size={16} /></button>
                )}
              </div>
              {w.showImg ? (
                <div className="cl-word-img-row">
                  {w.img ? <img className="cl-word-img-preview" src={w.img} alt="" /> : <ImageIcon size={14} color="#8B85AB" />}
                  <input
                    className="cl-word-img-input"
                    value={w.img || ''}
                    onChange={(e) => updateWord(i, 'img', e.target.value)}
                    placeholder="Dán đường dẫn hình ảnh (URL)..."
                  />
                  <button className="cl-word-img-remove" onClick={() => { updateWord(i, 'showImg', false); updateWord(i, 'img', ''); }} aria-label="Bỏ hình">
                    <XCircle size={14} />
                  </button>
                </div>
              ) : (
                <div className="cl-image-actions">
                  <label className={`cl-add-img-link ${wordUploads[i] ? 'uploading' : ''}`}>
                    <ImageIcon size={12} /> {wordUploads[i] ? 'Đang tải lên...' : 'Tải ảnh'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={wordUploads[i]} onChange={(e) => uploadWordImage(i, e.target.files?.[0])} />
                  </label>
                  <button className="cl-add-img-link" onClick={() => updateWord(i, 'showImg', true)}><Link2 size={12} /> Dán URL</button>
                </div>
              )}
            </div>
          ))}
          <button className="cl-add-word" onClick={addWordRow}><Plus size={13} /> Thêm từ</button>

          <p className="cg-sub cl-default-quiz-note">
            <CheckCircle2 size={14} /> Bài kiểm tra được tạo tự động theo dạng trắc nghiệm 4 đáp án.
          </p>

          {uploadError && <div className="cl-find-err">{uploadError}</div>}
          {genError && <div className="cl-find-err">{genError}</div>}

          {(() => {
            const completeCount = words.filter((w) => w.ko.trim() && w.vi.trim()).length;
            const missing = [];
            if (!title.trim()) missing.push('tên bộ từ vựng');
            if (completeCount < 2) missing.push(`ít nhất 2 từ có đủ cả tiếng Hàn và nghĩa tiếng Việt (hiện có ${completeCount})`);
            if (missing.length === 0 || saving) return null;
            return (
              <div className="cl-find-err" style={{ background: '#FFF8E6', borderColor: '#F5D98A', color: '#9A7B1E' }}>
                Cần điền {missing.join(' và ')} thì mới tạo được nội dung.
              </div>
            );
          })()}

          {!generatedDraft ? (
            <button className="cg-post-btn cl-save-btn" onClick={generatePreview} disabled={!title.trim() || words.filter((w) => w.ko.trim() && w.vi.trim()).length < 2 || saving}>
              {genStep === 'ai' ? (<><Sparkles size={14} /> AI đang soạn câu ví dụ & bài kiểm tra...</>) : (<><Sparkles size={14} /> Tạo nội dung & xem trước</>)}
            </button>
          ) : (
            <div className="cl-generated-preview">
              <div className="cl-section-title"><div><Sparkles size={17} /><b>Xem trước nội dung đã tạo</b></div><span>Mỗi thể thức đã chọn sẽ có câu hỏi cho toàn bộ {generatedDraft.words.length} từ.</span></div>
              <div className="cl-preview-grid">
                {generatedDraft.words.map((word, index) => (
                  <article key={`${word.ko}:${index}`} className="cl-preview-word">
                    {word.img && <img src={word.img} alt="" />}
                    <b lang="ko">{word.ko}</b><span>{word.vi}</span>
                    <p lang="ko">{renderKo(word.example)}</p>
                    <small><Lightbulb size={12} /> {word.mnemonic}</small>
                  </article>
                ))}
              </div>
              <div className="cl-preview-actions">
                <button type="button" className="cl-find-btn" onClick={() => setGeneratedDraft(null)}>Chỉnh sửa lại</button>
                <button className="cg-post-btn" onClick={saveLesson} disabled={saving}>{genStep === 'saving' ? 'Đang lưu...' : 'Lưu & lấy mã chia sẻ'}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {statsLesson && <CustomLessonStatsModal lesson={statsLesson} onClose={() => setStatsLesson(null)} />}
    </div>
  );
}

export function CustomLessonStudyView({ lessonData, onBack, onStartQuiz }) {
  const dialog = useAppDialog();
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id && data.user.id === lessonData.creatorId) {
        setCanDelete(true);
      }
    }).catch(() => {});
  }, [lessonData.creatorId]);

  const handleDeleteFromStudy = async () => {
    if (!supabase) return;
    const confirmed = await dialog.confirm({
      title: 'Xóa bộ từ vựng?',
      message: `Bộ từ vựng “${lessonData.title}” cùng toàn bộ nội dung sẽ bị xóa vĩnh viễn và không thể hoàn tác.`,
      variant: 'warning',
      confirmLabel: 'Xóa bộ từ vựng',
      cancelLabel: 'Giữ lại',
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('custom_lessons').delete().eq('id', lessonData.id);
      if (error) throw error;
      onBack();
    } catch (e) {
      await dialog.alert({
        title: 'Chưa thể xóa bộ từ vựng',
        message: 'Không thể xóa bộ từ vựng lúc này. Vui lòng thử lại sau.',
        variant: 'error',
      });
    }
  };
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = lessonData.words.length;
  const w = lessonData.words[idx];
  const hasQuiz = lessonData.words.length > 0;

  useEffect(() => { setFlipped(false); }, [idx]);

  const next = () => { if (idx + 1 < total) setIdx((i) => i + 1); else onBack(); };
  const prev = () => { if (idx > 0) setIdx((i) => i - 1); };

  return (
    <section className="rv-page">
      <div className="rv-quiz-top">
        <button className="fc2-back" onClick={onBack} aria-label="Về Cộng đồng"><ChevronLeft size={20} /></button>
        <span className="rv-quiz-title">{lessonData.title}</span>
        {canDelete && (
          <button
            className="cl-notebook-remove"
            onClick={handleDeleteFromStudy}
            aria-label="Xóa bộ từ vựng"
            title="Xóa vĩnh viễn bộ từ vựng này"
            style={{ marginLeft: 8 }}
          >
            <Trash2 size={16} />
          </button>
        )}
        <span className="rv-quiz-count">{idx + 1} / {total}</span>
      </div>
      <div className="fc2-progress-bar"><div style={{ width: `${((idx + 1) / total) * 100}%` }} /></div>
      <p className="cg-sub" style={{ marginTop: 0 }}>Bộ từ vựng của {lessonData.author}</p>

      {hasQuiz && (
        <button className="cl-quiz-launch" onClick={() => onStartQuiz(lessonData)}>
          <Sparkles size={14} /> Làm bài kiểm tra AI tạo sẵn cho bộ này
        </button>
      )}

      <div className="cl-study-card" onClick={() => setFlipped((f) => !f)}>
        {!flipped ? (
          <>
            {w.img && <img className="cl-study-img" src={w.img} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            <span className="cl-study-word" lang="ko">{w.ko}</span>
            <span className="cl-study-hint">Bấm để xem nghĩa</span>
          </>
        ) : (
          <div className="cl-study-back">
            <span className="cl-study-meaning">{w.vi}</span>
            {w.example && (
              <div className="cl-study-example">
                <p lang="ko">{renderKo(w.example)}</p>
                {w.exampleVi && <p className="cl-study-example-vi">{w.exampleVi}</p>}
              </div>
            )}
            {w.mnemonic && (
              <div className="cl-study-mnemonic"><Lightbulb size={13} color="#F5A623" /> {w.mnemonic}</div>
            )}
          </div>
        )}
      </div>

      <div className="fc-nav">
        <button className="fc-nav-btn" disabled={idx === 0} onClick={prev}><ChevronLeft size={18} /> Câu trước</button>
        <div className="fc-dots">
          {lessonData.words.map((_, i) => (<button key={i} className={`fc-dot ${i === idx ? 'on' : ''}`} onClick={() => setIdx(i)} />))}
        </div>
        <button className="fc-nav-btn primary" onClick={next}>{idx + 1 >= total ? 'Hoàn thành' : 'Từ tiếp theo'} <ChevronRight size={18} /></button>
      </div>
    </section>
  );
}

const FALLBACK_KO_DISTRACTORS = [
  '사과', '학교', '친구', '물', '커피', '책', '가방', '식당', '선생님',
  '공부', '영화', '시간', '오늘', '내일', '병원', '날씨', '가족', '음악',
  '바다', '사진', '우유', '빵', '의자', '모자', '시계', '공원', '운동'
];

function getKoDistractors(correctKo, allWords) {
  const fromSet = shuffleArr(
    allWords.map((w) => w.ko?.trim()).filter((k) => k && k !== correctKo)
  );
  const result = [...new Set(fromSet)];
  if (result.length < 3) {
    const fromPool = shuffleArr(FALLBACK_KO_DISTRACTORS.filter((k) => k !== correctKo && !result.includes(k)));
    for (const item of fromPool) {
      result.push(item);
      if (result.length >= 3) break;
    }
  }
  return result.slice(0, 3);
}

function getUsageDistractors(w, allWords) {
  const rawList = Array.isArray(w.wrongExamples) ? w.wrongExamples.filter((s) => typeof s === 'string' && s.trim()) : [];
  const cleanCorrect = (w.example || '').replace(/\*\*/g, '').trim();
  const validWrong = rawList.filter((s) => s.trim() !== cleanCorrect);
  const result = [...new Set(validWrong)];

  if (result.length < 3) {
    const templates = [
      `저는 ${w.ko}을/를 시원하게 마셨어요.`,
      `어제 ${w.ko}을/를 입고 잠을 잤어요.`,
      `${w.ko}이/가 너무 빨라서 따라갈 수 없어요.`,
      `내일 ${w.ko}에게 편지를 보낼 거예요.`
    ];
    for (const t of shuffleArr(templates)) {
      if (t !== cleanCorrect && !result.includes(t)) {
        result.push(t);
        if (result.length >= 3) break;
      }
    }
  }
  return result.slice(0, 3);
}

export function buildCustomQuizQuestions(lessonData) {
  const words = (lessonData.words || []).filter((w) => w.ko?.trim() && w.vi?.trim());
  const types = DEFAULT_CUSTOM_QUIZ_TYPES;
  const pool = [];

  // 1. Điền từ vào câu: AI tạo câu có khuyết từ, cho 4 đáp án chọn
  if (types.includes('fillblank')) {
    words.forEach((w, i) => {
      const ex = w.example || `저는 오늘 **${w.ko}** 단어를 공부해요.`;
      const cleanTarget = w.ko.trim();
      let blanked = ex;
      if (blanked.includes('**')) {
        blanked = blanked.replace(/\*\*(.+?)\*\*/, '( _____ )');
      } else {
        blanked = blanked.replace(new RegExp(cleanTarget, 'g'), '( _____ )');
      }
      const distractors = getKoDistractors(cleanTarget, words);
      const options = shuffleArr([cleanTarget, ...distractors]);
      pool.push({
        type: 'fillblank',
        prompt: blanked,
        promptVi: w.exampleVi,
        targetKo: cleanTarget,
        targetVi: w.vi,
        correct: cleanTarget,
        options,
        mnemonic: w.mnemonic,
        key: `fb:${i}:${cleanTarget}`
      });
    });
  }

  // 2. Chọn câu dùng đúng: 4 đáp án chọn câu dùng từ & ngữ pháp chuẩn xác
  if (types.includes('usage')) {
    words.forEach((w, i) => {
      const correctSentence = (w.example || `저는 오늘 ${w.ko} 단어를 공부해요.`).replace(/\*\*/g, '').trim();
      const distractors = getUsageDistractors(w, words);
      const options = shuffleArr([correctSentence, ...distractors]);
      pool.push({
        type: 'usage',
        prompt: w.ko,
        promptVi: w.vi,
        correct: correctSentence,
        options,
        explanation: w.exampleVi ? `Câu đúng: "${correctSentence}" (${w.exampleVi})` : undefined,
        key: `us:${i}:${w.ko}`
      });
    });
  }

  const shuffledQuestions = shuffleArr(pool);

  // 3. Chọn từ - nghĩa: Nối các card tiếng Hàn với tiếng Việt
  if (types.includes('matching') && words.length >= 2) {
    const batchSize = words.length <= 6 ? words.length : 5;
    for (let b = 0; b < words.length; b += batchSize) {
      const slice = words.slice(b, b + batchSize);
      if (slice.length >= 2) {
        shuffledQuestions.push({
          type: 'matching_cards',
          pairs: slice.map((w) => ({ ko: w.ko.trim(), vi: w.vi.trim() })),
          batchIndex: Math.floor(b / batchSize) + 1,
          totalBatches: Math.ceil(words.length / batchSize),
          key: `mc:${b}`
        });
      }
    }
  }

  return shuffledQuestions;
}

export function MatchingCardGame({ pairs, onComplete }) {
  const [shuffledKo] = useState(() => shuffleArr(pairs.map((p) => p.ko)));
  const [shuffledVi] = useState(() => shuffleArr(pairs.map((p) => p.vi)));
  const [selectedKo, setSelectedKo] = useState(null);
  const [selectedVi, setSelectedVi] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [wrongPair, setWrongPair] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const checkMatch = (koVal, viVal) => {
    const pair = pairs.find((p) => p.ko === koVal);
    if (pair && pair.vi === viVal) {
      playCorrectSound();
      const nextMatched = new Set(matched);
      nextMatched.add(koVal);
      setMatched(nextMatched);
      setSelectedKo(null);
      setSelectedVi(null);
      setWrongPair(null);
      if (nextMatched.size === pairs.length) {
        setIsFinished(true);
        if (onComplete) onComplete();
      }
    } else {
      playIncorrectSound();
      setWrongPair({ ko: koVal, vi: viVal });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedKo(null);
        setSelectedVi(null);
      }, 550);
    }
  };

  const handleKoClick = (ko) => {
    if (matched.has(ko) || wrongPair) return;
    if (selectedVi) {
      checkMatch(ko, selectedVi);
    } else {
      setSelectedKo((prev) => (prev === ko ? null : ko));
    }
  };

  const handleViClick = (vi) => {
    const isMatched = pairs.some((p) => p.vi === vi && matched.has(p.ko));
    if (isMatched || wrongPair) return;
    if (selectedKo) {
      checkMatch(selectedKo, vi);
    } else {
      setSelectedVi((prev) => (prev === vi ? null : vi));
    }
  };

  return (
    <div className="cl-matching-stage">
      <div className="cl-matching-status">
        <span><Sparkles size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Nối thẻ từ vựng</span>
        <span>Đã ghép đúng: <b>{matched.size} / {pairs.length}</b></span>
      </div>

      <div className="cl-matching-columns">
        <div className="cl-matching-col">
          <div className="cl-matching-col-header">Thẻ tiếng Hàn</div>
          {shuffledKo.map((ko) => {
            const isMatched = matched.has(ko);
            const isSelected = selectedKo === ko;
            const isWrong = wrongPair && wrongPair.ko === ko;
            let cls = 'cl-match-btn ko';
            if (isMatched) cls += ' matched';
            else if (isWrong) cls += ' wrong';
            else if (isSelected) cls += ' selected';
            return (
              <button
                key={ko}
                type="button"
                className={cls}
                onClick={() => handleKoClick(ko)}
                disabled={isMatched}
              >
                {ko}
                {isMatched && <CheckCircle2 size={16} style={{ marginLeft: 6, color: '#3FA95C' }} />}
              </button>
            );
          })}
        </div>

        <div className="cl-matching-col">
          <div className="cl-matching-col-header">Thẻ nghĩa tiếng Việt</div>
          {shuffledVi.map((vi) => {
            const isMatched = pairs.some((p) => p.vi === vi && matched.has(p.ko));
            const isSelected = selectedVi === vi;
            const isWrong = wrongPair && wrongPair.vi === vi;
            let cls = 'cl-match-btn';
            if (isMatched) cls += ' matched';
            else if (isWrong) cls += ' wrong';
            else if (isSelected) cls += ' selected';
            return (
              <button
                key={vi}
                type="button"
                className={cls}
                onClick={() => handleViClick(vi)}
                disabled={isMatched}
              >
                {vi}
                {isMatched && <CheckCircle2 size={16} style={{ marginLeft: 6, color: '#3FA95C' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {isFinished && (
        <div className="cl-matching-done-box">
          <p><CheckCircle2 size={20} color="#3FA95C" /> Tuyệt vời! Bạn đã hoàn thành nối đúng tất cả các thẻ!</p>
        </div>
      )}
    </div>
  );
}

export function CustomLessonTestView({ lessonData, onBack }) {
  const [questions] = useState(() => buildCustomQuizQuestions(lessonData));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [cardStageDone, setCardStageDone] = useState(false);
  const [done, setDone] = useState(false);
  const resultSavedRef = useRef(false);
  const q = questions[idx];

  useEffect(() => {
    setPicked(null);
    setCardStageDone(false);
  }, [idx]);

  if (questions.length === 0) {
    return (
      <section className="rv-page">
        <div className="rv-quiz-top">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <span className="rv-quiz-title">{lessonData.title}</span>
        </div>
        <div className="cg-empty"><SwBunnyEmpty /><p>Bài này chưa đủ dữ liệu để tạo câu hỏi.</p></div>
      </section>
    );
  }

  const choose = (opt) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.correct) {
      setScore((s) => s + 1);
      playCorrectSound();
    } else {
      playIncorrectSound();
    }
  };

  const handleCardComplete = () => {
    setCardStageDone(true);
    setScore((s) => s + 1);
  };

  const saveResult = async () => {
    if (resultSavedRef.current || !supabase || !lessonData?.id || questions.length === 0) return;
    resultSavedRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { error } = await supabase.from('custom_lesson_results').upsert({
        lesson_id: lessonData.id,
        user_id: user.id,
        score,
        total: questions.length,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'lesson_id,user_id' });
      if (error) throw error;
    } catch (error) {
      resultSavedRef.current = false;
    }
  };

  const next = () => {
    if (idx + 1 < questions.length) {
      setIdx((i) => i + 1);
    } else {
      setDone(true);
      void saveResult();
    }
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <section className="rv-page">
        <div className="rv-result-card">
          <Sparkles size={32} color="#7C6FE4" />
          <h2 className="rv-result-grade">Hoàn thành bài kiểm tra!</h2>
          <p className="rv-result-score">{score} / {questions.length} <span>phần đúng ({pct}%)</span></p>
        </div>
        <div className="fc-nav">
          <button className="fc-nav-btn" onClick={onBack}>Về bộ từ vựng</button>
          <button className="fc-nav-btn primary" onClick={() => { resultSavedRef.current = false; setIdx(0); setPicked(null); setCardStageDone(false); setScore(0); setDone(false); }}>
            Làm lại bài kiểm tra
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rv-page">
      <div className="rv-quiz-top">
        <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
        <span className="rv-quiz-title">{lessonData.title} — Ôn tập kiểm tra</span>
        <span className="rv-quiz-count">{idx + 1} / {questions.length}</span>
      </div>
      <div className="fc2-progress-bar"><div style={{ width: `${((idx + 1) / questions.length) * 100}%` }} /></div>

      <div className="qz-question-card">
        {q.type === 'fillblank' && (
          <>
            <p className="qz-instruction">Điền từ còn thiếu vào chỗ trống trong câu:</p>
            <div className="qz-blank-sentence" lang="ko">
              {q.prompt.split('( _____ )').map((part, pIdx, arr) => (
                <React.Fragment key={pIdx}>
                  {part}
                  {pIdx < arr.length - 1 && <span className="qz-blank-spot">{picked || '( _____ )'}</span>}
                </React.Fragment>
              ))}
            </div>
            {q.promptVi && <p className="cl-study-example-vi" style={{ marginTop: 6 }}>Nghĩa câu: {q.promptVi}</p>}

            <div className="qz-options">
              {q.options.map((opt, oIdx) => {
                const letter = ['A', 'B', 'C', 'D'][oIdx] || `${oIdx + 1}`;
                const isCorrect = opt === q.correct;
                const isPicked = opt === picked;
                const cls = !picked ? '' : isCorrect ? 'correct' : isPicked ? 'wrong' : '';
                return (
                  <button
                    key={opt}
                    className={`qz-option ${cls}`}
                    lang="ko"
                    onClick={() => choose(opt)}
                    disabled={!!picked}
                  >
                    <span className="qz-option-badge">{letter}</span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{opt}</span>
                  </button>
                );
              })}
            </div>

            {picked && (
              <div className={`qz-feedback-box ${picked === q.correct ? 'correct' : 'wrong'}`}>
                <span className="qz-feedback-tag">{picked === q.correct ? 'Chính xác!' : `Đáp án đúng: ${q.correct} (${q.targetVi || ''})`}</span>
                {q.mnemonic && (
                  <p className="qz-feedback-text">
                    <Lightbulb size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#F5A623' }} />
                    Mẹo nhớ: {q.mnemonic}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {q.type === 'usage' && (
          <>
            <p className="qz-instruction">
              Chọn câu dùng từ <b>"{q.prompt}"</b> {q.promptVi ? `(${q.promptVi})` : ''} đúng ngữ pháp và ngữ cảnh:
            </p>

            <div className="qz-options">
              {q.options.map((opt, oIdx) => {
                const letter = ['A', 'B', 'C', 'D'][oIdx] || `${oIdx + 1}`;
                const isCorrect = opt === q.correct;
                const isPicked = opt === picked;
                const cls = !picked ? '' : isCorrect ? 'correct' : isPicked ? 'wrong' : '';
                return (
                  <button
                    key={opt}
                    className={`qz-option ${cls}`}
                    lang="ko"
                    onClick={() => choose(opt)}
                    disabled={!!picked}
                  >
                    <span className="qz-option-badge">{letter}</span>
                    <span style={{ lineHeight: 1.5 }}>{renderKo(opt)}</span>
                  </button>
                );
              })}
            </div>

            {picked && (
              <div className={`qz-feedback-box ${picked === q.correct ? 'correct' : 'wrong'}`}>
                <span className="qz-feedback-tag">{picked === q.correct ? 'Chính xác!' : 'Chưa đúng, hãy xem câu chuẩn xác:'}</span>
                {q.explanation && <p className="qz-feedback-text">{q.explanation}</p>}
              </div>
            )}
          </>
        )}

        {q.type === 'matching_cards' && (
          <MatchingCardGame key={q.key} pairs={q.pairs} onComplete={handleCardComplete} />
        )}

        {(picked || (q.type === 'matching_cards' && cardStageDone)) && (
          <button className="fc-nav-btn primary qz-next-btn" onClick={next}>
            {idx + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Copy, Link2, BookMarked, BookOpen, Sparkles, XCircle, Plus,
  Image as ImageIcon, ChevronLeft, ChevronRight, Lightbulb, Globe2, LockKeyhole, Flag, EyeOff
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadCloudinaryAsset } from '../../services/cloudinaryUpload';
import { requestAIJson } from '../../services/aiService';
import { playCorrectSound, playIncorrectSound } from '../../services/audioService';
import { renderKo, shuffleArr } from '../../utils/textUtils';
import { SwBunnyEmpty } from '../../components/common/Mascots';

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

Trả lời CHỈ bằng JSON, không thêm markdown hay chữ nào khác, theo đúng cấu trúc:
{"items": [{"example": "...", "exampleVi": "...", "mnemonic": "..."}]}

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
  }));
}

export function ShareCodeBox({ code, onCreateAnother }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef(null);
  const shareText = `Mình vừa tạo một bộ từ vựng tiếng Hàn trên app! Vào Cộng đồng > Bộ từ vựng rồi nhập mã: ${code}`;

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

export function CustomLessonHub({ profile, onStudy }) {
  const [subTab, setSubTab] = useState('browse');
  const [lessons, setLessons] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [findErr, setFindErr] = useState('');
  const [finding, setFinding] = useState(false);
  const [savedCodes, setSavedCodes] = useState([]);
  const [savedLessons, setSavedLessons] = useState(null);

  const [title, setTitle] = useState('');
  const [words, setWords] = useState([
    { ko: '', vi: '', img: '', showImg: false },
    { ko: '', vi: '', img: '', showImg: false },
    { ko: '', vi: '', img: '', showImg: false }
  ]);
  const [quizTypes, setQuizTypes] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [wordUploads, setWordUploads] = useState({});
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [genError, setGenError] = useState('');
  const [savedCode, setSavedCode] = useState(null);

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
      setSavedCodes(items.map((item) => item.code));
      setSavedLessons(items);
    } catch (e) { setSavedCodes([]); setSavedLessons([]); }
  };

  const saveToNotebook = async (code) => {
    if (savedCodes.includes(code)) return;
    try {
      if (!supabase || !profile?.id) throw new Error('Phiên đăng nhập đã hết hạn');
      let lessonId = lessons?.find((item) => item.code === code)?.id;
      if (!lessonId) {
        const { data, error } = await supabase.from('custom_lessons').select('id').eq('code', code).single();
        if (error) throw error;
        lessonId = data.id;
      }
      const { error } = await supabase.from('custom_lesson_bookmarks').upsert(
        { user_id: profile.id, lesson_id: lessonId },
        { onConflict: 'user_id,lesson_id', ignoreDuplicates: true },
      );
      if (error) throw error;
      await loadSavedCodes();
    } catch (e) { }
  };

  const removeFromNotebook = async (code) => {
    try {
      if (!supabase || !profile?.id) throw new Error('Phiên đăng nhập đã hết hạn');
      const lessonId = savedLessons?.find((item) => item.code === code)?.id;
      if (!lessonId) return;
      const { error } = await supabase.from('custom_lesson_bookmarks').delete().eq('user_id', profile.id).eq('lesson_id', lessonId);
      if (error) throw error;
      setSavedCodes((items) => items.filter((item) => item !== code));
      setSavedLessons((items) => (items || []).filter((item) => item.code !== code));
    } catch (e) { }
  };

  const loadLessons = async () => {
    try {
      if (!supabase) throw new Error('Supabase chưa được cấu hình');
      const { data, error } = await supabase
        .from('custom_lessons')
        .select('id, code, creator_id, title, words, quiz_types, attachments, visibility, status, created_at, profiles!custom_lessons_creator_id_fkey(display_name)')
        .eq('status', 'visible')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLessons((data || []).map(mapCustomLessonRow));
    } catch (e) { setLessons([]); }
  };

  useEffect(() => { loadLessons(); loadSavedCodes(); }, []);

  const updateWord = (i, field, val) => { setGeneratedDraft(null); setWords((ws) => ws.map((w, idx) => (idx === i ? { ...w, [field]: val } : w))); };
  const addWordRow = () => { setGeneratedDraft(null); setWords((ws) => [...ws, { ko: '', vi: '', img: '', showImg: false }]); };
  const removeWordRow = (i) => { setGeneratedDraft(null); setWords((ws) => ws.filter((_, idx) => idx !== i)); };
  const toggleQuizType = (t) => { setGeneratedDraft(null); setQuizTypes((qs) => (qs.includes(t) ? qs.filter((x) => x !== t) : [...qs, t])); };

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
    if (!title.trim() || validWords.length < 2 || quizTypes.length === 0 || saving) return;
    setSaving(true);
    setGenError('');
    setGenStep('ai');

    let enrichedWords = validWords.map((w) => ({ ko: w.ko.trim(), vi: w.vi.trim(), img: w.img?.trim() || undefined }));
    try {
      const items = await generateLessonContent(enrichedWords);
      enrichedWords = enrichedWords.map((w, i) => ({ ...w, example: items[i]?.example, exampleVi: items[i]?.exampleVi, mnemonic: items[i]?.mnemonic }));
    } catch (e) {
      const items = fallbackLessonContent(enrichedWords);
      enrichedWords = enrichedWords.map((w, i) => ({ ...w, ...items[i], enrichmentSource: 'fallback' }));
      setGenError('AI đang bận nên hệ thống dùng nội dung dự phòng. Bạn hãy xem trước rồi vẫn có thể lưu bình thường.');
    }

    setGeneratedDraft({ title: title.trim(), words: enrichedWords, quizTypes: [...quizTypes], visibility });
    setGenStep('');
    setSaving(false);
  };

  const hideOwnSet = async (lesson) => {
    if (!supabase || lesson.creatorId !== profile?.id) return;
    const { error } = await supabase.from('custom_lessons').update({ status: 'hidden' }).eq('id', lesson.id);
    if (!error) {
      setLessons((items) => (items || []).filter((item) => item.id !== lesson.id));
      setSavedLessons((items) => (items || []).map((item) => item.id === lesson.id ? { ...item, status: 'hidden' } : item));
    }
  };

  const reportSet = async (lesson) => {
    if (!supabase || !profile?.id || lesson.creatorId === profile.id) return;
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: profile.id,
      custom_lesson_id: lesson.id,
      reason: 'Bộ từ vựng có nội dung không phù hợp',
    });
    if (error) setFindErr(error.code === '23505' ? 'Bạn đã báo cáo bộ này rồi.' : 'Chưa thể gửi báo cáo lúc này.');
    else setFindErr('Đã gửi báo cáo để quản trị viên xem xét.');
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
      setQuizTypes([]);
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
        onStudy(mapCustomLessonRow(data));
      }
      else setFindErr('Không tìm thấy mã này.');
    } catch (e) {
      setFindErr('Không tìm thấy mã này — kiểm tra lại bạn nhé.');
    }
    setFinding(false);
  };

  return (
    <div className="cl-hub">
      <div className="cg-tabs mini">
        <button className={`cg-tab ${subTab === 'browse' ? 'on' : ''}`} onClick={() => setSubTab('browse')}>Khám phá & thư viện</button>
        <button className={`cg-tab ${subTab === 'create' ? 'on' : ''}`} onClick={() => setSubTab('create')}>+ Tạo bộ từ vựng</button>
      </div>

      {subTab === 'browse' ? (
        <>
          <div className="cl-find-card">
            <div className="cl-find-copy">
              <span className="cl-find-icon"><Link2 size={19} /></span>
              <div>
                <b>Thêm bộ từ vựng bằng mã</b>
                <span>Nhập mã 6 ký tự được bạn bè hoặc giáo viên chia sẻ.</span>
              </div>
            </div>
            <div className="cl-find-row">
              <input className="cl-find-input" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Ví dụ: AB3XZ9" maxLength={6} />
              <button className="cl-find-btn" onClick={findByCode} disabled={!codeInput.trim() || finding}>{finding ? 'Đang tìm...' : 'Tìm bộ từ vựng'}</button>
            </div>
            {findErr && <div className="cl-find-err">{findErr}</div>}
          </div>

          {savedLessons === null ? null : savedLessons.length > 0 && (
            <>
              <p className="cg-sub" style={{ marginTop: 4 }}>📁 Thư viện của tôi — các bộ đã tạo hoặc đã lưu:</p>
              <div className="cl-list">
                {savedLessons.map((l) => (
                  <div key={l.code} className="cl-item">
                    <div className="cl-item-body">
                      <b>{l.title}</b>
                      <span>bởi {l.author} · {l.words.length} từ · {l.visibility === 'private' ? 'Riêng tư' : 'Công khai'} · mã {l.code}</span>
                    </div>
                    <div className="cl-item-actions">
                      <button className="cl-notebook-remove" onClick={() => removeFromNotebook(l.code)} aria-label="Bỏ khỏi sổ tay" title="Bỏ khỏi sổ tay"><XCircle size={16} /></button>
                      {l.creatorId === profile?.id && l.status !== 'hidden' && <button className="cl-notebook-remove" onClick={() => hideOwnSet(l)} title="Ẩn bộ từ vựng"><EyeOff size={16} /></button>}
                      <button className="cl-study-btn" onClick={() => onStudy(l)}>Học ngay</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="cl-section-title">
            <div><BookOpen size={17} /> <b>Khám phá bộ từ vựng cộng đồng</b></div>
            <span>Các bộ công khai được đăng ngay, không cần chờ duyệt.</span>
          </div>

          {lessons === null ? (
            <div className="cg-loading"><Sparkles size={18} color="#7C6FE4" /> Đang tải...</div>
          ) : lessons.length === 0 ? (
            <div className="cg-empty"><SwBunnyEmpty /><p>Chưa có bộ từ vựng nào được chia sẻ — hãy tạo bộ đầu tiên!</p></div>
          ) : (
            <div className="cl-list">
              {lessons.map((l) => (
                <div key={l.code} className="cl-item">
                  <div className="cl-item-body">
                    <b>{l.title}</b>
                    <span>bởi {l.author} · {l.words.length} từ · mã {l.code}</span>
                  </div>
                  <div className="cl-item-actions">
                    {!savedCodes.includes(l.code) && (
                      <button className="cl-notebook-add" onClick={() => saveToNotebook(l.code)} aria-label="Lưu vào sổ tay" title="Lưu vào sổ tay của tôi">
                        <BookMarked size={16} />
                      </button>
                    )}
                    {l.creatorId !== profile?.id && <button className="cl-notebook-remove" onClick={() => reportSet(l)} title="Báo cáo"><Flag size={16} /></button>}
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
              <Globe2 size={16} /><span>Công khai<small>Hiện trong cộng đồng và có thể lưu bằng mã</small></span>
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
                    <ImageIcon size={12} /> {wordUploads[i] ? 'Đang tải lên...' : 'Tải ảnh lên Cloudinary'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={wordUploads[i]} onChange={(e) => uploadWordImage(i, e.target.files?.[0])} />
                  </label>
                  <button className="cl-add-img-link" onClick={() => updateWord(i, 'showImg', true)}><Link2 size={12} /> Dán URL</button>
                </div>
              )}
            </div>
          ))}
          <button className="cl-add-word" onClick={addWordRow}><Plus size={13} /> Thêm từ</button>

          <label className="auth-label" style={{ marginTop: 8 }}>Thể thức kiểm tra (tuỳ chọn, có thể chọn nhiều)</label>
          <p className="cg-sub" style={{ marginTop: -6, marginBottom: 2 }}>AI sẽ tự soạn câu ví dụ + mẹo ghi nhớ cho từng từ, và tạo sẵn bài kiểm tra theo các thể thức bạn chọn.</p>
          <div className="cl-quiz-types">
            {[
              { id: 'fillblank', label: 'Điền từ vào câu', note: 'Điền từ Hàn còn thiếu trong câu ví dụ' },
              { id: 'matching', label: 'Chọn từ - nghĩa', note: 'Chọn nghĩa tiếng Việt chính xác' },
              { id: 'usage', label: 'Chọn câu dùng đúng', note: 'Chọn câu ví dụ có dùng từ mục tiêu' },
            ].map((qt) => (
              <button
                key={qt.id}
                type="button"
                className={`cl-quiz-chip ${quizTypes.includes(qt.id) ? 'on' : ''}`}
                onClick={() => toggleQuizType(qt.id)}
              >
                {quizTypes.includes(qt.id) && <CheckCircle2 size={13} />} <span>{qt.label}<small>{qt.note}</small></span>
              </button>
            ))}
          </div>

          {uploadError && <div className="cl-find-err">{uploadError}</div>}
          {genError && <div className="cl-find-err">{genError}</div>}

          {(() => {
            const completeCount = words.filter((w) => w.ko.trim() && w.vi.trim()).length;
            const missing = [];
            if (!title.trim()) missing.push('tên bộ từ vựng');
            if (completeCount < 2) missing.push(`ít nhất 2 từ có đủ cả tiếng Hàn và nghĩa tiếng Việt (hiện có ${completeCount})`);
            if (quizTypes.length === 0) missing.push('ít nhất 1 thể thức kiểm tra');
            if (missing.length === 0 || saving) return null;
            return (
              <div className="cl-find-err" style={{ background: '#FFF8E6', borderColor: '#F5D98A', color: '#9A7B1E' }}>
                Cần điền {missing.join(' và ')} thì mới tạo được nội dung.
              </div>
            );
          })()}

          {!generatedDraft ? (
            <button className="cg-post-btn cl-save-btn" onClick={generatePreview} disabled={!title.trim() || words.filter((w) => w.ko.trim() && w.vi.trim()).length < 2 || quizTypes.length === 0 || saving}>
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
    </div>
  );
}

export function CustomLessonStudyView({ lessonData, onBack, onStartQuiz }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = lessonData.words.length;
  const w = lessonData.words[idx];
  const hasQuiz = Array.isArray(lessonData.quizTypes) && lessonData.quizTypes.length > 0;

  useEffect(() => { setFlipped(false); }, [idx]);

  const next = () => { if (idx + 1 < total) setIdx((i) => i + 1); else onBack(); };
  const prev = () => { if (idx > 0) setIdx((i) => i - 1); };

  return (
    <section className="rv-page">
      <div className="rv-quiz-top">
        <button className="fc2-back" onClick={onBack} aria-label="Về Cộng đồng"><ChevronLeft size={20} /></button>
        <span className="rv-quiz-title">{lessonData.title}</span>
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

export function buildCustomQuizQuestions(lessonData) {
  const words = lessonData.words || [];
  const types = lessonData.quizTypes || [];
  const pool = [];

  const viOptionsFor = (correct) => {
    const distractors = shuffleArr(words.filter((x) => x.vi !== correct).map((x) => x.vi)).slice(0, 3);
    return shuffleArr([correct, ...distractors]);
  };

  // Mỗi thể thức được chọn bao phủ toàn bộ danh sách từ, sau đó xáo trộn câu.
  types.forEach((type) => words.forEach((w, i) => {
    if (type === 'fillblank') {
      if (!w.example || !w.example.includes('**')) return;
      const blanked = w.example.replace(/\*\*(.+?)\*\*/, 'ـــــ');
      const distractors = shuffleArr(words.filter((x) => x.ko !== w.ko).map((x) => x.ko)).slice(0, 3);
      if (distractors.length < 1) return;
      pool.push({ type: 'fillblank', prompt: blanked, promptVi: w.exampleVi, correct: w.ko, options: shuffleArr([w.ko, ...distractors]), key: `fb:${i}` });
    } else if (type === 'matching') {
      const options = viOptionsFor(w.vi);
      if (options.length < 2) return;
      pool.push({ type: 'matching', prompt: w.ko, correct: w.vi, options, key: `mt:${i}` });
    } else if (type === 'usage') {
      if (!w.example) return;
      const distractors = shuffleArr(words.filter((x) => x.ko !== w.ko && x.example).map((x) => x.example)).slice(0, 3);
      const options = shuffleArr([w.example, ...distractors]);
      if (options.length < 2) return;
      pool.push({ type: 'usage', prompt: w.ko, correct: w.example, options, key: `us:${i}` });
    }
  }));
  return shuffleArr(pool);
}

export function CustomLessonTestView({ lessonData, onBack }) {
  const [questions] = useState(() => buildCustomQuizQuestions(lessonData));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[idx];

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
    if (opt === q.correct) { setScore((s) => s + 1); playCorrectSound(); }
    else playIncorrectSound();
  };
  const next = () => {
    if (idx + 1 < questions.length) { setIdx((i) => i + 1); setPicked(null); }
    else setDone(true);
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <section className="rv-page">
        <div className="rv-result-card">
          <Sparkles size={30} color="#7C6FE4" />
          <h2 className="rv-result-grade">Hoàn thành bài kiểm tra!</h2>
          <p className="rv-result-score">{score} / {questions.length} <span>câu đúng ({pct}%)</span></p>
        </div>
        <div className="fc-nav">
          <button className="fc-nav-btn" onClick={onBack}>Về bộ từ vựng</button>
          <button className="fc-nav-btn primary" onClick={() => { setIdx(0); setPicked(null); setScore(0); setDone(false); }}>Làm lại</button>
        </div>
      </section>
    );
  }

  return (
    <section className="rv-page">
      <div className="rv-quiz-top">
        <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
        <span className="rv-quiz-title">{lessonData.title} — Kiểm tra</span>
        <span className="rv-quiz-count">{idx + 1} / {questions.length}</span>
      </div>
      <div className="fc2-progress-bar"><div style={{ width: `${((idx + 1) / questions.length) * 100}%` }} /></div>

      <div className="qz-question-card">
        {q.type === 'fillblank' && (
          <>
            <p className="qz-instruction">Điền từ vào câu:</p>
            <p className="qz-prompt-ko" lang="ko">{q.prompt}</p>
            {q.promptVi && <p className="cl-study-example-vi">{q.promptVi}</p>}
          </>
        )}
        {q.type === 'matching' && (
          <>
            <p className="qz-instruction">Từ này nghĩa là gì?</p>
            <p className="qz-prompt-ko" lang="ko">{q.prompt}</p>
          </>
        )}
        {q.type === 'usage' && (
          <>
            <p className="qz-instruction">Câu nào dùng đúng từ này?</p>
            <p className="qz-prompt-ko" lang="ko">{q.prompt}</p>
          </>
        )}

        <div className="qz-options">
          {q.options.map((opt) => {
            const isCorrect = opt === q.correct;
            const isPicked = opt === picked;
            const cls = !picked ? '' : isCorrect ? 'correct' : isPicked ? 'wrong' : '';
            return (
              <button key={opt} className={`qz-option ${cls}`} lang={q.type === 'matching' ? undefined : 'ko'} onClick={() => choose(opt)} disabled={!!picked}>
                {q.type === 'usage' ? renderKo(opt) : opt}
              </button>
            );
          })}
        </div>

        {picked && (
          <button className="fc-nav-btn primary qz-next-btn" onClick={next}>
            {idx + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

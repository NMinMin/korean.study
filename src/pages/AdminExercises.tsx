import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import {
  BookOpen,
  Check,
  ChevronDown,
  Grid3X3,
  Headphones,
  Image,
  List,
  LoaderCircle,
  Mic,
  Music,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import { adminApi } from '../lib/adminApi'
import { AdminSelect } from './AdminPage'

type Status = 'draft' | 'published' | 'locked' | 'no_content'
type Skill = 'vocabulary_grammar' | 'dictation' | 'shadowing'
type VocabularyGrammarKind = 'vocabulary' | 'grammar'
type TtsVoice =
  | 'ko-KR-SunHiNeural'
  | 'ko-KR-InJoonNeural'
  | 'ko-KR-HyunsuMultilingualNeural'
  | 'ko-KR-HyunsuNeural'
  | 'ko-KR-BongJinNeural'
  | 'ko-KR-GookMinNeural'
  | 'ko-KR-JiMinNeural'
  | 'ko-KR-SeoHyeonNeural'
  | 'ko-KR-SoonBokNeural'
  | 'ko-KR-YuJinNeural'
type Textbook = { id: string; title_ko: string }
type Lesson = { id: string; textbook_id: string; lesson_number: number; title_ko: string; textbooks?: { title_ko?: string } }
type Exercise = {
  id: string
  lesson_id: string
  skill_type: Skill
  exercise_type: string
  prompt_ko: string
  prompt_vi?: string | null
  answer?: unknown
  explanation_vi?: string | null
  media_url?: string | null
  image_url?: string | null
  audio_url?: string | null
  sort_order: number
  status: Status
  lessons?: Lesson & { textbooks?: { title_ko?: string } }
}

type Draft = {
  lessonId: string
  skillType: Skill
  vocabularyGrammarKind: VocabularyGrammarKind
  promptKo: string
  promptVi: string
  answer: string
  explanationVi: string
  partOfSpeech: string
  pronunciation: string
  mnemonic: string
  note: string
  contextVi: string
  formulaLines: string[]
  imageUrl: string
  audioUrl: string
  ttsVoice: TtsVoice
  ttsSpeed: 0.75 | 1 | 1.25
}

const skills = [
  { value: 'vocabulary_grammar', label: 'Từ vựng & Ngữ pháp', icon: NotebookPen },
  { value: 'dictation', label: 'Nghe chép chính tả', icon: Headphones },
  { value: 'shadowing', label: 'Shadowing', icon: Mic },
] as const

const emptyDraft: Draft = {
  lessonId: '',
  skillType: 'vocabulary_grammar',
  vocabularyGrammarKind: 'vocabulary',
  promptKo: '',
  promptVi: '',
  answer: '',
  explanationVi: '',
  partOfSpeech: '',
  pronunciation: '',
  mnemonic: '',
  note: '',
  contextVi: '',
  formulaLines: [''],
  imageUrl: '',
  audioUrl: '',
  ttsVoice: 'ko-KR-SunHiNeural',
  ttsSpeed: 1,
}

const ttsVoices: { value: TtsVoice; label: string; gender: 'Nữ' | 'Nam'; description: string }[] = [
  { value: 'ko-KR-SunHiNeural', gender: 'Nữ', label: 'SunHi', description: 'Tự nhiên, phổ biến nhất' },
  { value: 'ko-KR-JiMinNeural', gender: 'Nữ', label: 'JiMin', description: 'Trẻ trung, thân thiện' },
  { value: 'ko-KR-SeoHyeonNeural', gender: 'Nữ', label: 'SeoHyeon', description: 'Nhẹ nhàng, tự nhiên' },
  { value: 'ko-KR-SoonBokNeural', gender: 'Nữ', label: 'SoonBok', description: 'Điềm tĩnh, chín chắn' },
  { value: 'ko-KR-YuJinNeural', gender: 'Nữ', label: 'YuJin', description: 'Tươi vui, rõ ràng' },
  { value: 'ko-KR-InJoonNeural', gender: 'Nam', label: 'InJoon', description: 'Ấm áp' },
  { value: 'ko-KR-HyunsuNeural', gender: 'Nam', label: 'Hyunsu', description: 'Tiêu chuẩn' },
  { value: 'ko-KR-HyunsuMultilingualNeural', gender: 'Nam', label: 'Hyunsu Multilingual', description: 'Đa ngôn ngữ' },
  { value: 'ko-KR-BongJinNeural', gender: 'Nam', label: 'BongJin', description: 'Truyền cảm, tự nhiên' },
  { value: 'ko-KR-GookMinNeural', gender: 'Nam', label: 'GookMin', description: 'Trầm, trang trọng' },
]

function asRecord(answer: unknown): Record<string, unknown> {
  return answer && typeof answer === 'object' && !Array.isArray(answer) ? answer as Record<string, unknown> : {}
}

function answerAsText(answer: unknown) {
  if (typeof answer === 'string') return answer
  const value = asRecord(answer)
  return String(value.text ?? value.correct ?? value.meaning ?? value.word ?? value.transcript ?? '')
}

function exerciseAnswerSummary(item: Exercise) {
  const answer = asRecord(item.answer)
  if (item.skill_type === 'vocabulary_grammar') {
    if (item.exercise_type === 'grammar') return String(answer.note ?? answer.contextVi ?? '—')
    return String(answer.mnemonic ?? answer.meaning ?? item.prompt_vi ?? '—')
  }
  return answerAsText(item.answer) || '—'
}

function inferVocabularyGrammarKind(item?: Exercise): VocabularyGrammarKind {
  if (!item || item.skill_type !== 'vocabulary_grammar') return 'vocabulary'
  if (item.exercise_type === 'grammar') return 'grammar'
  if (asRecord(item.answer).formulaLines || asRecord(item.answer).contextVi) return 'grammar'
  return 'vocabulary'
}

function normalizeTtsVoice(value: unknown): TtsVoice {
  if (ttsVoices.some((voice) => voice.value === value)) return value as TtsVoice
  if (value === 'ko-KR-HyunSuNeural') return 'ko-KR-HyunsuNeural'
  if (value === 'ko-KR-BongJinNeura') return 'ko-KR-BongJinNeural'
  return 'ko-KR-SunHiNeural'
}

async function uploadImageToApi(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('https://api-cloud-u4v8.onrender.com/upload', { method: 'POST', body })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || 'Không thể upload hình ảnh.')
  const url = data?.url || data?.secure_url || data?.data?.url
  if (!url || typeof url !== 'string') throw new Error('API upload chưa trả về URL hình ảnh.')
  return normalizeAssetUrl(url)
}

function normalizeAssetUrl(url: string): string {
  return url.replace(/^http:\/\/api-cloud-u4v8\.onrender\.com/i, 'https://api-cloud-u4v8.onrender.com')
}

function ttsFilename(text: string): string {
  const safe = text.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'korean'
  return `${Date.now()}-${safe}-speech.mp3`
}

async function generateKoreanTts(text: string, voice: TtsVoice, speed: number = 1): Promise<string> {
  const response = await fetch('https://text-to-speed.onrender.com/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, filename: ttsFilename(text), speed }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || 'Không thể tạo audio phát âm.')
  }
  const url = data?.url || data?.data?.url
  if (!url || typeof url !== 'string') throw new Error('API TTS chưa trả về URL audio.')
  return normalizeAssetUrl(url)
}

function VoiceSelect({
  value,
  onChange,
  onPreview,
  previewing,
}: {
  value: TtsVoice
  onChange: (value: TtsVoice) => void
  onPreview: (value: TtsVoice) => void
  previewing: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = ttsVoices.find((voice) => voice.value === value) || ttsVoices[0]
  const filtered = ttsVoices.filter((voice) =>
    `${voice.gender} ${voice.label} ${voice.description} ${voice.value}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  useEffect(() => {
    if (!open) return
    const positionMenu = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const maxHeight = Math.min(280, window.innerHeight - 32)
      const openUp = window.innerHeight - rect.bottom < Math.min(300, maxHeight) && rect.top > window.innerHeight - rect.bottom
      setMenuStyle({ left: rect.left, width: rect.width, maxHeight, ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) })
    }
    positionMenu()
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [open])

  const menu = open && <div className="admin-voice-menu" style={menuStyle} role="listbox">
    <label className="admin-voice-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm giọng đọc…" autoFocus /></label>
    {(['Nữ', 'Nam'] as const).map((gender) => {
      const voices = filtered.filter((voice) => voice.gender === gender)
      if (!voices.length) return null
      return <div key={gender} className="admin-voice-group">
        <div className="admin-voice-group-title">{gender}</div>
        {voices.map((voice) => <button
          type="button"
          key={voice.value}
          className={`admin-voice-option${voice.value === value ? ' selected' : ''}`}
          onClick={() => { onChange(voice.value); setOpen(false); setQuery('') }}
          role="option"
          aria-selected={voice.value === value}
        >
          <span className="admin-voice-check">{voice.value === value && <Check size={14} />}</span>
          <span className="admin-voice-copy"><strong>{voice.label}</strong><small>{voice.description}</small></span>
          <span className="admin-voice-item-preview" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onPreview(voice.value) }} aria-label={`Nghe thử ${voice.label}`}>
            {previewing ? <LoaderCircle className="spin" size={14} /> : <Volume2 size={14} />}
          </span>
        </button>)}
      </div>
    })}
    {!filtered.length && <div className="admin-voice-empty">Không tìm thấy giọng đọc phù hợp.</div>}
  </div>

  return <div className={`admin-voice-select${open ? ' open' : ''}`}>
    <button ref={triggerRef} type="button" className="admin-voice-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
      <span><strong>{selected.gender} · {selected.label}</strong><small>{selected.description}</small></span>
      <ChevronDown size={17} />
    </button>
    {menu && createPortal(menu, document.body)}
  </div>
}

function TtsPanel({
  draft,
  setDraft,
  previewVoice,
  previewing,
  showSpeed = false,
}: {
  draft: Draft
  setDraft: Dispatch<SetStateAction<Draft>>
  previewVoice: (voice?: TtsVoice) => Promise<void>
  previewing: boolean
  showSpeed?: boolean
}) {
  return <aside className="admin-tts-panel">
    <div className="admin-tts-heading"><Volume2 size={16} /><strong>{showSpeed ? 'Audio mẫu (tự sinh)' : 'Giọng đọc TTS'}</strong></div>
    <label>Giọng đọc<VoiceSelect value={draft.ttsVoice} onChange={(value) => setDraft((current) => ({ ...current, ttsVoice: value, audioUrl: '' }))} onPreview={(value) => void previewVoice(value)} previewing={previewing} /></label>
    {showSpeed && <div className="admin-speed-field"><span>Tốc độ đọc</span><div>{([0.75, 1, 1.25] as const).map((speed) => <button type="button" key={speed} className={draft.ttsSpeed === speed ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, ttsSpeed: speed, audioUrl: '' }))}>{speed}x</button>)}</div></div>}
    <button type="button" className="admin-tts-preview" disabled={previewing || !draft.promptKo.trim()} onClick={() => void previewVoice()}>{previewing ? <LoaderCircle className="spin" size={17} /> : <Volume2 size={17} />} Nghe thử</button>
    {draft.audioUrl
      ? <audio className="admin-tts-audio" controls src={draft.audioUrl} />
      : <div className="admin-tts-empty"><Mic size={25} /><span>Nhập câu tiếng Hàn rồi bấm Nghe thử</span></div>}
  </aside>
}

export default function AdminExercises() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [items, setItems] = useState<Exercise[]>([])
  const [book, setBook] = useState('all')
  const [lesson, setLesson] = useState('all')
  const [skill, setSkill] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [editing, setEditing] = useState<Exercise | null | undefined>(undefined)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState<'image' | 'audio' | null>(null)
  const [previewingVoice, setPreviewingVoice] = useState(false)
  const [pendingImage, setPendingImage] = useState<File | null>(null)

  const selectedBookId = lessons.find((item) => item.id === draft.lessonId)?.textbook_id || textbooks[0]?.id || ''
  const availableLessons = useMemo(() => lessons.filter((item) => book === 'all' || item.textbook_id === book), [book, lessons])
  const modalLessons = lessons.filter((item) => item.textbook_id === selectedBookId)
  const isVocabularyGrammar = draft.skillType === 'vocabulary_grammar'
  const isVocabularyExercise = isVocabularyGrammar && draft.vocabularyGrammarKind === 'vocabulary'
  const isGrammarExercise = isVocabularyGrammar && draft.vocabularyGrammarKind === 'grammar'
  const isDictation = draft.skillType === 'dictation'
  const isShadowing = draft.skillType === 'shadowing'

  useEffect(() => {
    if (isGrammarExercise) setDraft((current) => current.imageUrl || current.audioUrl ? { ...current, imageUrl: '', audioUrl: '' } : current)
    if (draft.skillType === 'dictation' || draft.skillType === 'shadowing') setDraft((current) => current.imageUrl ? { ...current, imageUrl: '' } : current)
  }, [draft.skillType, draft.vocabularyGrammarKind, isGrammarExercise, isVocabularyExercise])

  const load = async () => {
    try {
      const [loadedBooks, loadedLessons, loadedExercises] = await Promise.all([
        adminApi<Textbook[]>('/textbooks'),
        adminApi<Lesson[]>('/lessons'),
        adminApi<Exercise[]>('/exercises'),
      ])
      setTextbooks(loadedBooks)
      setLessons(loadedLessons)
      // Ôn tập được sinh động từ dữ liệu của ba kỹ năng, không phải học liệu
      // được quản trị/lưu riêng. Ẩn cả các bản ghi legacy nếu database còn sót.
      setItems(loadedExercises.filter((item) => skills.some((skill) => skill.value === item.skill_type)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải bài tập.')
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = items.filter((item) =>
    skills.some((option) => option.value === item.skill_type)
    && (book === 'all' || item.lessons?.textbook_id === book)
    && (lesson === 'all' || item.lesson_id === lesson)
    && (skill === 'all' || item.skill_type === skill)
    && `${item.prompt_ko} ${item.prompt_vi || ''} ${item.lessons?.title_ko || ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const open = (item?: Exercise) => {
    setPendingImage(null)
    setEditing(item || null)
    if (!item) {
      setDraft({ ...emptyDraft, lessonId: availableLessons[0]?.id || lessons[0]?.id || '' })
      return
    }
    const answer = asRecord(item.answer)
    const kind = inferVocabularyGrammarKind(item)
    setDraft({
      lessonId: item.lesson_id,
      skillType: item.skill_type,
      vocabularyGrammarKind: kind,
      promptKo: item.prompt_ko,
      promptVi: item.prompt_vi || '',
      answer: answerAsText(item.answer),
      explanationVi: item.explanation_vi || '',
      partOfSpeech: String(answer.partOfSpeech || answer.part_of_speech || ''),
      pronunciation: String(answer.pronunciation || answer.pron || ''),
      mnemonic: String(answer.mnemonic || (kind === 'vocabulary' ? answerAsText(item.answer) : '') || ''),
      note: String(answer.note || answer.notes || (kind === 'grammar' ? answerAsText(item.answer) : '') || ''),
      contextVi: String(answer.contextVi || ''),
      formulaLines: Array.isArray(answer.formulaLines) && answer.formulaLines.length
        ? answer.formulaLines.map((line) => String(line))
        : [''],
      imageUrl: item.image_url || item.media_url || '',
      audioUrl: item.audio_url || String(answer.audioUrl || ''),
      ttsVoice: normalizeTtsVoice(answer.ttsVoice),
      ttsSpeed: Number(answer.ttsSpeed) === 0.75 || Number(answer.ttsSpeed) === 1.25 ? Number(answer.ttsSpeed) as 0.75 | 1.25 : 1,
    })
  }

  const previewUpload = (kind: 'image', file?: File) => {
    if (!file) return
    if (kind === 'image' && !file.type.startsWith('image/')) return setError('Vui lòng chọn đúng tệp hình ảnh.')
    const limit = 10 * 1024 * 1024
    if (file.size > limit) return setError('Hình ảnh không được vượt quá 10 MB.')
    const previewUrl = URL.createObjectURL(file)
    setDraft((current) => {
      const field = 'imageUrl'
      const oldUrl = current[field]
      if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl)
      return { ...current, [field]: previewUrl }
    })
    setPendingImage(file)
  }

  const buildAnswer = (imageUrl: string, audioUrl: string) => {
    if (isVocabularyExercise) {
      return {
        correct: draft.promptKo.trim(),
        word: draft.promptKo.trim(),
        meaning: draft.promptVi.trim(),
        partOfSpeech: draft.partOfSpeech.trim(),
        pronunciation: draft.pronunciation.trim(),
        mnemonic: draft.mnemonic.trim(),
        imageUrl,
        audioUrl,
        ttsVoice: draft.ttsVoice,
      }
    }
    if (isGrammarExercise) {
      return {
        correct: draft.promptKo.trim(),
        note: draft.note.trim(),
        contextVi: draft.contextVi.trim(),
        formulaLines: draft.formulaLines.map((line) => line.trim()).filter(Boolean),
      }
    }
    return {
      correct: draft.promptKo.trim(),
      transcript: draft.promptKo.trim(),
      audioUrl,
      ttsVoice: draft.ttsVoice,
      ttsSpeed: draft.ttsSpeed,
      note: draft.note.trim(),
      pronunciation: draft.pronunciation.trim(),
    }
  }

  const previewVoice = async (voice: TtsVoice = draft.ttsVoice) => {
    const text = draft.promptKo.trim()
    if (!text) return setError('Nhập nội dung tiếng Hàn trước khi nghe thử.')
    setPreviewingVoice(true)
    try {
      const canReuseCurrentAudio = voice === draft.ttsVoice && draft.audioUrl && !draft.audioUrl.startsWith('blob:')
      const audioUrl = canReuseCurrentAudio
        ? draft.audioUrl
        : await generateKoreanTts(text, voice, draft.ttsSpeed)
      if (voice === draft.ttsVoice) setDraft((current) => ({ ...current, audioUrl }))
      await new Audio(audioUrl).play()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể nghe thử giọng đọc.')
    } finally {
      setPreviewingVoice(false)
    }
  }

  const save = async () => {
    if (!draft.lessonId || !draft.promptKo.trim()) return setError('Vui lòng chọn bài học và nhập nội dung bài tập.')
    setSaving(true)
    let ttsWarning = ''
    try {
      let imageUrl = isVocabularyExercise ? draft.imageUrl : ''
      let audioUrl = isVocabularyExercise || isDictation || isShadowing ? draft.audioUrl : ''
      if (isVocabularyExercise && pendingImage && imageUrl.startsWith('blob:')) {
        setUploading('image')
        imageUrl = await uploadImageToApi(pendingImage)
      }
      if ((isVocabularyExercise || isDictation || isShadowing) && draft.promptKo.trim() && !audioUrl) {
        setUploading('audio')
        try {
          audioUrl = await generateKoreanTts(draft.promptKo.trim(), draft.ttsVoice, draft.ttsSpeed)
        } catch (cause) {
          // TTS là tài nguyên bổ sung: lỗi dịch vụ không được làm mất nội dung admin vừa nhập.
          ttsWarning = cause instanceof Error ? cause.message : 'không thể tạo audio TTS.'
          audioUrl = ''
        }
      }
      const body = {
        lessonId: draft.lessonId,
        skillType: draft.skillType,
        exerciseType: isVocabularyGrammar ? draft.vocabularyGrammarKind : draft.skillType,
        promptKo: draft.promptKo,
        promptVi: draft.promptVi,
        answer: buildAnswer(imageUrl, audioUrl),
        explanationVi: isVocabularyGrammar ? '' : draft.explanationVi,
        mediaUrl: '',
        imageUrl,
        audioUrl,
        sortOrder: editing?.sort_order ?? 0,
        status: editing?.status ?? 'published',
      }
      await adminApi(`/exercises${editing?.id ? `/${editing.id}` : ''}`, {
        method: editing?.id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (draft.imageUrl.startsWith('blob:')) URL.revokeObjectURL(draft.imageUrl)
      if (draft.audioUrl.startsWith('blob:')) URL.revokeObjectURL(draft.audioUrl)
      setPendingImage(null)
      setEditing(undefined)
      await load()
      if (ttsWarning) setError(`Đã lưu bài tập, nhưng ${ttsWarning}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu bài tập.')
    } finally {
      setUploading(null)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminApi(`/exercises/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xóa bài tập.')
    } finally {
      setDeleting(false)
    }
  }

  return <div className="admin-exercises">
    <div className="admin-panel-title">
      <div><h2>Bài tập theo kỹ năng</h2><p>Nội dung được gắn với đúng giáo trình, bài học và ba kỹ năng nền tảng. Phần ôn tập được AI tạo tự động.</p></div>
      <button className="admin-primary" onClick={() => open()}><Plus size={18} /> Thêm bài tập</button>
    </div>
    {error && <div className="admin-error">{error}<button onClick={() => setError('')}><X size={18} /></button></div>}
    <div className="admin-toolbar admin-toolbar-with-filters">
      <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung bài tập…" /></label>
      <div className="admin-filter-controls">
        <AdminSelect value={book} options={[{ value: 'all', label: 'Tất cả giáo trình' }, ...textbooks.map((item) => ({ value: item.id, label: item.title_ko }))]} onChange={(value) => { setBook(value); setLesson('all') }} />
        <AdminSelect value={lesson} options={[{ value: 'all', label: 'Tất cả bài học' }, ...availableLessons.map((item) => ({ value: item.id, label: `Bài ${item.lesson_number} · ${item.title_ko}` }))]} onChange={setLesson} />
        <span>{filtered.length} mục</span>
        <div className="admin-view-switch" aria-label="Kiểu hiển thị">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} title="Dạng bảng"><List size={17} /><span>Bảng</span></button>
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Dạng lưới"><Grid3X3 size={17} /><span>Lưới</span></button>
        </div>
      </div>
    </div>
    <div className="admin-skill-filters" aria-label="Lọc theo kỹ năng">
      <button className={skill === 'all' ? 'active' : ''} onClick={() => setSkill('all')}><Grid3X3 size={17} /><span>Tất cả</span><em>{items.length}</em></button>
      {skills.map(({ value, label, icon: Icon }) => <button key={value} className={skill === value ? 'active' : ''} onClick={() => setSkill(value)}><Icon size={17} /><span>{label}</span><em>{items.filter((item) => item.skill_type === value).length}</em></button>)}
    </div>
    <div className={`admin-exercise-results view-${view}`}>
      <div className="admin-exercise-table-wrap"><table className="admin-exercise-table"><thead><tr><th>Nội dung</th><th>Giáo trình · Bài học</th><th>Kỹ năng</th><th>Dữ liệu lưu</th><th>Tệp đính kèm</th><th>Thao tác</th></tr></thead><tbody>{filtered.map((item) => {
        const meta = skills.find((option) => option.value === item.skill_type) ?? skills[0]
        const Icon = meta.icon
        return <tr key={item.id}><td><strong>{item.prompt_ko}</strong>{item.prompt_vi && <small>{item.prompt_vi}</small>}</td><td><span>{item.lessons?.textbooks?.title_ko || 'Giáo trình'}</span><small>Bài {item.lessons?.lesson_number}</small></td><td><span className="admin-skill-cell"><Icon size={16} />{meta.label}</span></td><td><span className="admin-answer-cell">{exerciseAnswerSummary(item)}</span></td><td><span className="admin-media-cell">{(item.image_url || item.media_url) && <Image size={16} />} {item.audio_url && <Music size={16} />} {!item.image_url && !item.media_url && !item.audio_url && '—'}</span></td><td><div className="admin-row-actions"><button onClick={() => open(item)} aria-label="Sửa"><Pencil size={16} /></button><button className="danger" onClick={() => setDeleteTarget(item)} aria-label="Xóa"><Trash2 size={16} /></button></div></td></tr>
      })}</tbody></table></div>
      <div className="admin-exercise-grid">{filtered.map((item) => {
        const meta = skills.find((option) => option.value === item.skill_type) ?? skills[0]
        const Icon = meta.icon
        return <article key={item.id} className="admin-exercise-card"><div className="admin-exercise-head"><span><Icon size={17} />{meta.label}</span><div><button onClick={() => open(item)} aria-label="Sửa"><Pencil size={16} /></button><button className="danger" onClick={() => setDeleteTarget(item)} aria-label="Xóa"><Trash2 size={16} /></button></div></div><small>{item.lessons?.textbooks?.title_ko || 'Giáo trình'} · Bài {item.lessons?.lesson_number}</small><h3>{item.prompt_ko}</h3>{item.prompt_vi && <p>{item.prompt_vi}</p>}<div className="admin-exercise-media">{(item.image_url || item.media_url) && <span><Image size={15} /> Hình ảnh</span>}{item.audio_url && <span><Music size={15} /> Audio</span>}</div></article>
      })}</div>
    </div>
    {!filtered.length && <div className="admin-empty">Chưa có bài tập phù hợp với bộ lọc.</div>}
    {editing !== undefined && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(undefined) }}>
      <section className={`admin-modal admin-exercise-modal${isVocabularyGrammar ? ' is-vocabulary-grammar' : ''}${isDictation ? ' is-dictation' : ''}${isShadowing ? ' is-shadowing' : ''}`}>
        <header><div><span><NotebookPen size={22} /></span><div><h2>{editing ? 'Chỉnh sửa' : 'Thêm'} bài tập</h2><p>Chọn đúng bài học, kỹ năng và tải học liệu nếu cần.</p></div></div><button onClick={() => setEditing(undefined)}><X /></button></header>
        <div className="admin-form admin-exercise-form">
          <section className="admin-form-section admin-general-section">
            <div className="admin-section-title"><span>Thông tin chung</span></div>
            <div className="admin-general-grid">
              <label>Giáo trình<AdminSelect value={selectedBookId} options={textbooks.map((item) => ({ value: item.id, label: item.title_ko }))} onChange={(value) => setDraft({ ...draft, lessonId: lessons.find((item) => item.textbook_id === value)?.id || '' })} /></label>
              <label>Bài học *<AdminSelect value={draft.lessonId} options={modalLessons.map((item) => ({ value: item.id, label: `Bài ${item.lesson_number} · ${item.title_ko}` }))} onChange={(value) => setDraft({ ...draft, lessonId: value })} /></label>
              <label>Kỹ năng *<AdminSelect value={draft.skillType} options={skills.map(({ value, label }) => ({ value, label }))} onChange={(value) => setDraft({ ...draft, skillType: value as Skill })} /></label>
            </div>
            {isVocabularyGrammar && <div className={`admin-kind-tabs is-${draft.vocabularyGrammarKind}`} role="tablist" aria-label="Phân loại nội dung">
              <span className="admin-kind-tab-indicator" aria-hidden="true" />
              <button type="button" role="tab" aria-selected={draft.vocabularyGrammarKind === 'vocabulary'} className={draft.vocabularyGrammarKind === 'vocabulary' ? 'is-active' : ''} onClick={() => setDraft({ ...draft, vocabularyGrammarKind: 'vocabulary' })}>
                <BookOpen size={17} /><span>Từ vựng</span>
              </button>
              <button type="button" role="tab" aria-selected={draft.vocabularyGrammarKind === 'grammar'} className={draft.vocabularyGrammarKind === 'grammar' ? 'is-active' : ''} onClick={() => setDraft({ ...draft, vocabularyGrammarKind: 'grammar' })}>
                <NotebookPen size={17} /><span>Ngữ pháp</span>
              </button>
            </div>}
          </section>

          <section className={`admin-form-section admin-content-section${isVocabularyExercise ? ' is-vocab' : ''}${isGrammarExercise ? ' is-grammar' : ''}`}>
            <div className="admin-section-title"><span>{isVocabularyExercise ? 'Nội dung từ vựng' : isGrammarExercise ? 'Nội dung ngữ pháp' : isDictation ? 'Nội dung nghe' : 'Câu luyện nói'}</span></div>
            {isVocabularyExercise && <>
              <div className="admin-vocab-main">
                <label className="admin-ko-field">Nội dung tiếng Hàn *<textarea rows={3} value={draft.promptKo} onChange={(event) => setDraft({ ...draft, promptKo: event.target.value, audioUrl: '' })} /></label>
                <label className="admin-vi-field">Nội dung tiếng Việt<input value={draft.promptVi} onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })} /></label>
                <label className="admin-vocab-input">Loại từ<input value={draft.partOfSpeech} onChange={(event) => setDraft({ ...draft, partOfSpeech: event.target.value })} placeholder="Ví dụ: Danh từ, Động từ…" /></label>
                <label className="admin-vocab-input">Phát âm chuẩn<input value={draft.pronunciation} onChange={(event) => setDraft({ ...draft, pronunciation: event.target.value })} placeholder="Ví dụ: [꼳따발]" /></label>
                <label className="admin-vocab-input admin-voice-field">Phát âm thanh (TTS)<div className="admin-voice-preview-row"><VoiceSelect value={draft.ttsVoice} onChange={(value) => setDraft({ ...draft, ttsVoice: value, audioUrl: '' })} onPreview={(value) => void previewVoice(value)} previewing={previewingVoice} /><button type="button" className="admin-voice-preview" disabled={previewingVoice || !draft.promptKo.trim()} onClick={() => void previewVoice()}>{previewingVoice ? <LoaderCircle className="spin" size={16} /> : <Volume2 size={16} />} Nghe thử</button></div></label>
              </div>
              <div className="admin-vocab-side">
                <div className="admin-upload-field admin-image-field"><span>Hình ảnh</span><label className={uploading === 'image' ? 'uploading' : ''}>{uploading === 'image' ? <LoaderCircle className="spin" /> : <Image />}<strong>{draft.imageUrl ? 'Đổi hình ảnh' : 'Tải hình ảnh'}</strong><small>PNG, JPG, WEBP · tối đa 10 MB</small><input type="file" accept="image/*" onChange={(event) => previewUpload('image', event.target.files?.[0])} /></label>{draft.imageUrl && <div className="admin-uploaded-file image-preview"><img src={draft.imageUrl} alt="Xem trước hình bài tập" /><a href={draft.imageUrl} target="_blank" rel="noreferrer">Xem hình đã tải</a><button onClick={() => setDraft({ ...draft, imageUrl: '' })}><X size={15} /></button></div>}{draft.audioUrl && <div className="admin-uploaded-file"><audio controls src={draft.audioUrl} /><button title="Tạo lại audio khi lưu" onClick={() => setDraft({ ...draft, audioUrl: '' })}><X size={15} /></button></div>}</div>
              </div>
              <label className="admin-mnemonic-field">Mẹo nhớ<textarea rows={2} value={draft.mnemonic} onChange={(event) => setDraft({ ...draft, mnemonic: event.target.value })} placeholder="Ví dụ: 꽃(hoa) + 다발(bó) = bó hoa" /></label>
            </>}
            {isGrammarExercise && <>
              <div className="admin-grammar-main">
                <label className="admin-ko-field">Nội dung tiếng Hàn *<textarea rows={3} value={draft.promptKo} onChange={(event) => setDraft({ ...draft, promptKo: event.target.value })} /></label>
                <label>Nội dung tiếng Việt<input value={draft.promptVi} onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })} /></label>
                <label>Bối cảnh<input value={draft.contextVi} onChange={(event) => setDraft({ ...draft, contextVi: event.target.value })} placeholder="Ví dụ: dùng khi muốn chọn một trong nhiều lựa chọn…" /></label>
              </div>
              <div className="admin-grammar-side">
                <div className="admin-formula-builder">
                  <div><span>Công thức / cách dùng</span><button type="button" onClick={() => setDraft({ ...draft, formulaLines: [...draft.formulaLines, ''] })}><Plus size={15} /> Thêm dòng</button></div>
                  {draft.formulaLines.map((line, index) => <label key={index}>
                    <input value={line} onChange={(event) => setDraft({ ...draft, formulaLines: draft.formulaLines.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} placeholder={`Cách dùng ${index + 1}`} />
                    {draft.formulaLines.length > 1 && <button type="button" onClick={() => setDraft({ ...draft, formulaLines: draft.formulaLines.filter((_, itemIndex) => itemIndex !== index) })}><X size={14} /></button>}
                  </label>)}
                </div>
              </div>
              <label className="admin-note-field">Lưu ý<textarea rows={3} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Ví dụ: dùng với danh từ, động/tính từ có quy tắc riêng…" /></label>
            </>}
            {isDictation && <>
              <div className="admin-listening-main">
                <label className="admin-ko-field"><span>Nội dung tiếng Hàn * <em>{draft.promptKo.length}/200</em></span><textarea maxLength={200} rows={4} value={draft.promptKo} onChange={(event) => setDraft({ ...draft, promptKo: event.target.value, audioUrl: '' })} placeholder="Nhập câu tiếng Hàn để học viên nghe và chép…" /><small>Nội dung này đồng thời là đáp án chuẩn để đối chiếu.</small></label>
                <label>Nội dung tiếng Việt (Bản dịch)<textarea rows={2} value={draft.promptVi} onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })} placeholder="Nhập bản dịch tiếng Việt…" /></label>
              </div>
              <TtsPanel draft={draft} setDraft={setDraft} previewVoice={previewVoice} previewing={previewingVoice} />
              <label className="admin-note-field">Ghi chú / giải thích<textarea rows={2} value={draft.explanationVi} onChange={(event) => setDraft({ ...draft, explanationVi: event.target.value })} placeholder="Nhập lưu ý ngữ pháp, từ quan trọng hoặc cách phát âm…" /></label>
            </>}
            {isShadowing && <>
              <div className="admin-listening-main">
                <label className="admin-ko-field"><span>Nội dung tiếng Hàn * <em>{draft.promptKo.length}/200</em></span><textarea maxLength={200} rows={4} value={draft.promptKo} onChange={(event) => setDraft({ ...draft, promptKo: event.target.value, audioUrl: '' })} placeholder="Nhập câu luyện Shadowing…" /><small>Đây là câu chuẩn dùng để đối chiếu phát âm.</small></label>
                <label>Nội dung tiếng Việt<textarea rows={2} value={draft.promptVi} onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })} placeholder="Nhập bản dịch tiếng Việt…" /></label>
                <label>Giải thích / lưu ý phát âm<input value={draft.pronunciation} onChange={(event) => setDraft({ ...draft, pronunciation: event.target.value })} placeholder="Ví dụ: nối âm, nhấn nhẹ cuối câu…" /></label>
              </div>
              <TtsPanel draft={draft} setDraft={setDraft} previewVoice={previewVoice} previewing={previewingVoice} showSpeed />
              <label className="admin-note-field">Ghi chú<textarea rows={2} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Lưu ý thêm cho người học…" /></label>
            </>}
          </section>
        </div>
        <footer><button className="admin-cancel" onClick={() => setEditing(undefined)}>Hủy</button><button className="admin-primary" disabled={saving || uploading !== null || !draft.lessonId || !draft.promptKo.trim()} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu bài tập'}</button></footer>
      </section>
    </div>}
    {deleteTarget && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null) }}>
      <section className="admin-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-exercise-title">
        <header>
          <span className="admin-confirm-icon"><Trash2 size={21} /></span>
          <div><h2 id="delete-exercise-title">Xóa bài tập?</h2><p>Bài tập sẽ bị gỡ khỏi luồng học của học viên ngay sau khi xóa.</p></div>
        </header>
        <div className="admin-confirm-body">
          <strong>{deleteTarget.prompt_ko || 'Bài tập chưa có nội dung'}</strong>
          {deleteTarget.prompt_vi && <small>{deleteTarget.prompt_vi}</small>}
        </div>
        <footer>
          <button className="admin-cancel" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</button>
          <button className="admin-danger" onClick={() => void remove()} disabled={deleting}>{deleting ? 'Đang xóa…' : 'Xóa bài tập'}</button>
        </footer>
      </section>
    </div>}
  </div>
}

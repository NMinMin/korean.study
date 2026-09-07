import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Grid3X3,
  GripVertical,
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
import { BlockingLoader } from '../components/common/AppDialog'

type Status = 'draft' | 'published' | 'locked' | 'no_content'
type Skill = 'vocabulary_grammar' | 'dictation' | 'shadowing'
type VocabularyGrammarKind = 'vocabulary' | 'grammar'
type TtsVoice =
  | 'ko-KR-SunHiNeural'
  | 'ko-KR-InJoonNeural'
  | 'ko-KR-HyunSuNeural'
type DialogueLine = { speaker: 'A' | 'B'; ko: string; vi: string }
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
  collocations: { ko: string; vi: string }[]
  dialogues: DialogueLine[]
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

const filterSkills = [
  { value: 'vocabulary', label: 'Từ vựng', icon: BookOpen },
  { value: 'grammar', label: 'Ngữ pháp', icon: NotebookPen },
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
  collocations: [{ ko: '', vi: '' }],
  dialogues: [{ speaker: 'A', ko: '', vi: '' }],
  note: '',
  contextVi: '',
  formulaLines: [''],
  imageUrl: '',
  audioUrl: '',
  ttsVoice: 'ko-KR-SunHiNeural',
  ttsSpeed: 1,
}

const ttsVoices: { value: TtsVoice; label: string; gender: 'Nữ' | 'Nam'; description: string; previewUrl?: string }[] = [
  {
    value: 'ko-KR-SunHiNeural', gender: 'Nữ', label: 'SunHi',
    description: 'Tiêu chuẩn, tự nhiên, phổ biến',
    previewUrl: 'http://api-cloud-u4v8.onrender.com/files/storage/1787874626792-NgheThu.mp3',
  },
  {
    value: 'ko-KR-InJoonNeural', gender: 'Nam', label: 'InJoon',
    description: 'Tiêu chuẩn, rõ ràng, phù hợp giảng dạy',
    previewUrl: 'http://api-cloud-u4v8.onrender.com/files/storage/1787874893843-NgheThu.mp3',
  },
  { value: 'ko-KR-HyunSuNeural', gender: 'Nam', label: 'HyunSu', description: 'Trẻ trung, tự nhiên' },
]

const voicePreviewCache = new Map<TtsVoice, string>()
const VOICE_PREVIEW_TEXT = '안녕하세요. 한국어 공부를 함께 시작해 볼까요?'

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

function getExerciseSkillMeta(item: Exercise) {
  if (item.skill_type === 'vocabulary_grammar') {
    const kind = inferVocabularyGrammarKind(item)
    if (kind === 'grammar') {
      return { value: 'grammar', label: 'Ngữ pháp', icon: NotebookPen }
    }
    return { value: 'vocabulary', label: 'Từ vựng', icon: BookOpen }
  }
  if (item.skill_type === 'dictation') {
    return { value: 'dictation', label: 'Nghe chép chính tả', icon: Headphones }
  }
  return { value: 'shadowing', label: 'Shadowing', icon: Mic }
}

function normalizeTtsVoice(value: unknown): TtsVoice {
  if (ttsVoices.some((voice) => voice.value === value)) return value as TtsVoice
  if (value === 'ko-KR-HyunsuNeural' || value === 'ko-KR-HyunsuMultilingualNeural') return 'ko-KR-HyunSuNeural'
  if (value === 'ko-KR-BongJinNeural' || value === 'ko-KR-BongJinNeura' || value === 'ko-KR-GookMinNeural') return 'ko-KR-InJoonNeural'
  return 'ko-KR-SunHiNeural'
}

function normalizeCollocations(value: unknown): { ko: string; vi: string }[] {
  if (!Array.isArray(value)) return [{ ko: '', vi: '' }]
  const rows = value.map((entry) => {
    const row = asRecord(entry)
    return {
      ko: String(row.ko ?? row.korean ?? row.phrase ?? ''),
      vi: String(row.vi ?? row.meaning ?? row.meaningVi ?? ''),
    }
  }).filter((row) => row.ko || row.vi)
  return rows.length ? rows : [{ ko: '', vi: '' }]
}

function normalizeDialogues(value: unknown, fallbackKo = '', fallbackVi = ''): DialogueLine[] {
  const rows = (Array.isArray(value) ? value : []).map((entry) => {
    const row = asRecord(entry)
    return {
      speaker: row.speaker === 'B' ? 'B' as const : 'A' as const,
      ko: String(row.ko ?? row.korean ?? ''),
      vi: String(row.vi ?? row.vietnamese ?? row.meaning ?? ''),
    }
  }).filter((row) => row.ko || row.vi)
  if (rows.length) return rows
  return [{ speaker: 'A', ko: fallbackKo, vi: fallbackVi }]
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

export async function deleteStorageAsset(url?: string | null): Promise<void> {
  if (!url || typeof url !== 'string') return
  const match = url.match(/^(https?:\/\/api-cloud-u4v8\.onrender\.com)\/files\/(.+)$/i)
  if (!match) return
  const deleteUrl = `${match[1].replace(/^http:/i, 'https:')}/delete/${match[2]}`
  try {
    await fetch(deleteUrl, { method: 'DELETE' })
  } catch (err) {
    console.warn('Lỗi khi xóa file storage trên cloud:', deleteUrl, err)
  }
}

function extractExerciseStorageUrls(item?: Exercise | null): string[] {
  if (!item) return []
  const urls: (string | null | undefined)[] = [
    item.audio_url,
    item.image_url,
    item.media_url,
  ]
  if (item.answer && typeof item.answer === 'object') {
    const ans = item.answer as Record<string, any>
    urls.push(ans.audioUrl, ans.imageUrl, ans.mediaUrl)
  }
  return urls.filter((u): u is string => typeof u === 'string' && /api-cloud-u4v8\.onrender\.com\/files\//i.test(u))
}

function ttsFilename(text: string): string {
  const safe = text.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'korean'
  return `${Date.now()}-${safe}-speech.mp3`
}

async function generateKoreanTts(text: string, voice: TtsVoice, speed: number = 1): Promise<string> {
  const apiVoice = voice === 'ko-KR-HyunSuNeural' ? 'ko-KR-HyunsuNeural' : voice
  const response = await fetch('https://text-to-speed.onrender.com/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: apiVoice, filename: ttsFilename(text), speed }),
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
      const desktop = window.matchMedia('(min-width: 901px)').matches
      const availableBelow = Math.max(120, window.innerHeight - rect.bottom - 16)
      const maxHeight = Math.min(280, desktop ? availableBelow : window.innerHeight - 32)
      const openUp = !desktop && window.innerHeight - rect.bottom < Math.min(300, maxHeight) && rect.top > window.innerHeight - rect.bottom
      setMenuStyle(openUp
        ? { left: rect.left, width: rect.width, maxHeight, bottom: window.innerHeight - rect.top + 8, top: 'auto' }
        : { left: rect.left, width: rect.width, maxHeight, top: rect.bottom + 8, bottom: 'auto' })
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
    <div className="admin-tts-heading">
      <span className="admin-tts-icon-badge"><Volume2 size={15} /></span>
      <div>
        <strong>Audio mẫu</strong>
        <small>Tự động tạo khi lưu bài</small>
      </div>
    </div>
    <div className="admin-tts-body">
      <label className="admin-tts-label"><span>Giọng đọc</span>
        <VoiceSelect
          value={draft.ttsVoice}
          onChange={(value) => setDraft((current) => ({ ...current, ttsVoice: value, audioUrl: '' }))}
          onPreview={(value) => void previewVoice(value)}
          previewing={previewing}
        />
      </label>
      {showSpeed && (
        <div className="admin-speed-field">
          <span>Tốc độ đọc</span>
          <div>
            {([0.75, 1, 1.25] as const).map((speed) => (
              <button
                type="button"
                key={speed}
                className={draft.ttsSpeed === speed ? 'active' : ''}
                onClick={() => setDraft((current) => ({ ...current, ttsSpeed: speed, audioUrl: '' }))}
              >
                {speed === 1 ? '1x (chuẩn)' : `${speed}x`}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="admin-tts-preview"
        disabled={previewing || !draft.promptKo.trim()}
        onClick={() => void previewVoice()}
      >
        {previewing ? <LoaderCircle className="spin" size={16} /> : <Volume2 size={16} />}
        {previewing ? 'Đang tạo…' : 'Nghe thử câu này'}
      </button>
      {draft.audioUrl
        ? <div className="admin-tts-audio-wrap"><audio className="admin-tts-audio" controls src={draft.audioUrl} /><button type="button" className="admin-tts-audio-clear" title="Xóa audio, tạo lại khi lưu" onClick={() => { if (draft.audioUrl && !draft.audioUrl.startsWith('blob:')) void deleteStorageAsset(draft.audioUrl); setDraft((cur) => ({ ...cur, audioUrl: '' })) }}><X size={13} /></button></div>
        : <p className="admin-tts-empty"><Music size={14} /> Chưa có audio · hệ thống sẽ tạo sau khi lưu</p>
      }
    </div>
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
  const [playingPreviewVoice, setPlayingPreviewVoice] = useState<TtsVoice | null>(null)
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [draggedFormulaIndex, setDraggedFormulaIndex] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveBookId, setMoveBookId] = useState('')
  const [moveLessonId, setMoveLessonId] = useState('')
  const [moving, setMoving] = useState(false)
  const [collapsedExerciseGroups, setCollapsedExerciseGroups] = useState<Set<string>>(new Set())

  const moveFormulaLine = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setDraft((current) => {
      const formulaLines = [...current.formulaLines]
      const [movedLine] = formulaLines.splice(fromIndex, 1)
      formulaLines.splice(toIndex, 0, movedLine)
      return { ...current, formulaLines }
    })
  }

  const selectedBookId = lessons.find((item) => item.id === draft.lessonId)?.textbook_id || textbooks[0]?.id || ''
  const availableLessons = useMemo(() => lessons.filter((item) => book === 'all' || item.textbook_id === book), [book, lessons])
  const lessonFilterOptions = useMemo(() => {
    const textbookOrder = new Map(textbooks.map((item, index) => [item.id, index]))
    const textbookTitles = new Map(textbooks.map((item) => [item.id, item.title_ko]))
    return [...availableLessons]
      .sort((left, right) => {
        const textbookDifference = (textbookOrder.get(left.textbook_id) ?? Number.MAX_SAFE_INTEGER) - (textbookOrder.get(right.textbook_id) ?? Number.MAX_SAFE_INTEGER)
        return textbookDifference || left.lesson_number - right.lesson_number || left.title_ko.localeCompare(right.title_ko, 'ko')
      })
      .map((item) => {
        const textbookTitle = textbookTitles.get(item.textbook_id) || item.textbooks?.title_ko || 'Giáo trình khác'
        return {
          value: item.id,
          label: `Bài ${item.lesson_number} · ${item.title_ko}`,
          group: book === 'all' ? textbookTitle : undefined,
          searchText: textbookTitle,
        }
      })
  }, [availableLessons, book, textbooks])
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
    (book === 'all' || item.lessons?.textbook_id === book)
    && (lesson === 'all' || item.lesson_id === lesson)
    && (
      skill === 'all'
      || (skill === 'vocabulary' && item.skill_type === 'vocabulary_grammar' && inferVocabularyGrammarKind(item) === 'vocabulary')
      || (skill === 'grammar' && item.skill_type === 'vocabulary_grammar' && inferVocabularyGrammarKind(item) === 'grammar')
      || (skill === item.skill_type)
    )
    && `${item.prompt_ko} ${item.prompt_vi || ''} ${item.lessons?.title_ko || ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )
  const gridGroups = filterSkills
    .map((group) => ({
      ...group,
      items: filtered.filter((item) => getExerciseSkillMeta(item).value === group.value),
    }))
    .filter((group) => group.items.length > 0)
  const moveLessons = lessons.filter((item) => item.textbook_id === moveBookId)
  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id))

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allFilteredSelected) filtered.forEach((item) => next.delete(item.id))
      else filtered.forEach((item) => next.add(item.id))
      return next
    })
  }

  const toggleExerciseGroup = (groupItems: Exercise[]) => {
    const allSelected = groupItems.length > 0 && groupItems.every((item) => selectedIds.has(item.id))
    setSelectedIds((current) => {
      const next = new Set(current)
      groupItems.forEach((item) => {
        if (allSelected) next.delete(item.id)
        else next.add(item.id)
      })
      return next
    })
  }

  const toggleCollapsedExerciseGroup = (groupValue: string) => {
    setCollapsedExerciseGroups((current) => {
      const next = new Set(current)
      if (next.has(groupValue)) next.delete(groupValue)
      else next.add(groupValue)
      return next
    })
  }

  const openMoveDialog = () => {
    const initialBookId = book !== 'all' ? book : textbooks[0]?.id || ''
    const initialLessonId = lessons.find((item) => item.textbook_id === initialBookId)?.id || ''
    setMoveBookId(initialBookId)
    setMoveLessonId(initialLessonId)
    setMoveDialogOpen(true)
  }

  const moveSelectedExercises = async () => {
    if (!selectedIds.size || !moveLessonId) return setError('Hãy chọn bài tập và bài học đích.')
    setMoving(true)
    try {
      const result = await adminApi<{ movedIds: string[]; count: number; lessonId: string }>('/exercises/actions/bulk-move', {
        method: 'PATCH',
        body: JSON.stringify({ exerciseIds: [...selectedIds], lessonId: moveLessonId }),
      })
      if (result.count !== selectedIds.size) setError(`Đã chuyển ${result.count}/${selectedIds.size} bài tập. Một số bài tập không còn tồn tại.`)
      setSelectedIds(new Set())
      setMoveDialogOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể chuyển các bài tập đã chọn.')
    } finally {
      setMoving(false)
    }
  }

  const open = (item?: Exercise) => {
    setPendingImage(null)
    setEditing(item || null)
    if (!item) {
      const defaultKind = skill === 'grammar' ? 'grammar' : 'vocabulary'
      const defaultSkillType = skill === 'dictation' || skill === 'shadowing' ? skill : 'vocabulary_grammar'
      setDraft({
        ...emptyDraft,
        skillType: defaultSkillType,
        vocabularyGrammarKind: defaultKind,
        lessonId: availableLessons[0]?.id || lessons[0]?.id || '',
      })
      return
    }
    const answer = asRecord(item.answer)
    const example = asRecord(answer.example)
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
      collocations: normalizeCollocations(answer.collocations),
      dialogues: normalizeDialogues(
        answer.dialogues ?? answer.dialogue,
        String(example.ko ?? answer.exampleKo ?? ''),
        String(example.vi ?? answer.exampleVi ?? ''),
      ),
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
      const dialogues = draft.dialogues
        .map((line) => ({ speaker: line.speaker, ko: line.ko.trim(), vi: line.vi.trim() }))
        .filter((line) => line.ko || line.vi)
      const firstDialogue = dialogues[0]
      return {
        correct: draft.promptKo.trim(),
        word: draft.promptKo.trim(),
        meaning: draft.promptVi.trim(),
        partOfSpeech: draft.partOfSpeech.trim(),
        pronunciation: draft.pronunciation.trim(),
        mnemonic: draft.mnemonic.trim(),
        collocations: draft.collocations
          .map((row) => ({ ko: row.ko.trim(), vi: row.vi.trim() }))
          .filter((row) => row.ko || row.vi),
        dialogues,
        dialogue: dialogues,
        example: firstDialogue ? { ko: firstDialogue.ko, vi: firstDialogue.vi } : null,
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

  useEffect(() => () => {
    const audio = voicePreviewAudioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    voicePreviewAudioRef.current = null
  }, [])

  const stopVoicePreview = () => {
    const audio = voicePreviewAudioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      voicePreviewAudioRef.current = null
    }
    setPlayingPreviewVoice(null)
  }

  const previewVoice = async (voice: TtsVoice = draft.ttsVoice) => {
    if (playingPreviewVoice === voice && voicePreviewAudioRef.current) {
      stopVoicePreview()
      return
    }

    stopVoicePreview()
    setPreviewingVoice(true)
    setError('')
    try {
      const configuredPreview = ttsVoices.find((item) => item.value === voice)?.previewUrl
      let audioUrl = configuredPreview ? normalizeAssetUrl(configuredPreview) : voicePreviewCache.get(voice)
      if (!audioUrl) {
        audioUrl = await generateKoreanTts(VOICE_PREVIEW_TEXT, voice, 1)
        voicePreviewCache.set(voice, audioUrl)
      }

      const audio = new Audio(audioUrl)
      audio.preload = 'auto'
      voicePreviewAudioRef.current = audio
      audio.addEventListener('ended', () => {
        if (voicePreviewAudioRef.current === audio) voicePreviewAudioRef.current = null
        setPlayingPreviewVoice(null)
      }, { once: true })
      audio.addEventListener('error', () => {
        if (voicePreviewAudioRef.current === audio) voicePreviewAudioRef.current = null
        setPlayingPreviewVoice(null)
        setError('Không tải được file nghe thử. Vui lòng thử lại.')
      }, { once: true })
      await audio.play()
      setPlayingPreviewVoice(voice)
    } catch (cause) {
      voicePreviewAudioRef.current = null
      setPlayingPreviewVoice(null)
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
      if (editing) {
        const oldAudio = editing.audio_url || (editing.answer as any)?.audioUrl
        if (oldAudio && oldAudio !== audioUrl && !oldAudio.startsWith('blob:')) {
          void deleteStorageAsset(oldAudio)
        }
        const oldImage = editing.image_url || (editing.answer as any)?.imageUrl
        if (oldImage && oldImage !== imageUrl && !oldImage.startsWith('blob:')) {
          void deleteStorageAsset(oldImage)
        }
      }
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
      const urls = extractExerciseStorageUrls(deleteTarget)
      await Promise.allSettled(urls.map((u) => deleteStorageAsset(u)))
      await adminApi(`/exercises/${deleteTarget.id}`, { method: 'DELETE' })
      setSelectedIds((current) => { const next = new Set(current); next.delete(deleteTarget.id); return next })
      setDeleteTarget(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xóa bài tập.')
    } finally {
      setDeleting(false)
    }
  }

  return <div className="admin-exercises">
    <BlockingLoader
      show={saving || deleting || moving || uploading !== null}
      label={moving ? 'Đang chuyển bài tập…' : deleting ? 'Đang xóa bài tập…' : uploading ? 'Đang tải tệp lên…' : 'Đang lưu bài tập…'}
    />
    <div className="admin-panel-title">
      <div><h2>Bài tập theo kỹ năng</h2><p>Nội dung được gắn với đúng giáo trình, bài học và ba kỹ năng nền tảng. Phần ôn tập được AI tạo tự động.</p></div>
      <button className="admin-primary" onClick={() => open()}><Plus size={18} /> Thêm bài tập</button>
    </div>
    {error && <div className="admin-error">{error}<button onClick={() => setError('')}><X size={18} /></button></div>}
    <div className="admin-toolbar admin-toolbar-with-filters">
      <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nội dung bài tập…" /></label>
      <div className="admin-filter-controls">
        <AdminSelect searchable searchPlaceholder="Tìm giáo trình…" value={book} options={[{ value: 'all', label: 'Tất cả giáo trình' }, ...textbooks.map((item) => ({ value: item.id, label: item.title_ko }))]} onChange={(value) => { setBook(value); setLesson('all') }} />
        <AdminSelect searchable searchPlaceholder="Tìm bài học hoặc giáo trình…" value={lesson} options={[{ value: 'all', label: 'Tất cả bài học' }, ...lessonFilterOptions]} onChange={setLesson} />
        <span>{filtered.length} mục</span>
        <div className="admin-view-switch" aria-label="Kiểu hiển thị">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} title="Dạng bảng"><List size={17} /><span>Bảng</span></button>
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Dạng lưới"><Grid3X3 size={17} /><span>Lưới</span></button>
        </div>
      </div>
    </div>
    <div className="admin-skill-filters" aria-label="Lọc theo kỹ năng">
      <button className={skill === 'all' ? 'active' : ''} onClick={() => setSkill('all')}><Grid3X3 size={17} /><span>Tất cả</span><em>{items.length}</em></button>
      {filterSkills.map(({ value, label, icon: Icon }) => {
        const count = items.filter((item) => {
          if (value === 'vocabulary') return item.skill_type === 'vocabulary_grammar' && inferVocabularyGrammarKind(item) === 'vocabulary'
          if (value === 'grammar') return item.skill_type === 'vocabulary_grammar' && inferVocabularyGrammarKind(item) === 'grammar'
          return item.skill_type === value
        }).length
        return <button key={value} className={skill === value ? 'active' : ''} onClick={() => setSkill(value)}><Icon size={17} /><span>{label}</span><em>{count}</em></button>
      })}
    </div>
    {selectedIds.size > 0 && <div className="admin-exercise-bulk-bar">
      <span><Check size={17} /><strong>{selectedIds.size}</strong> bài tập đã chọn</span>
      <div>
        <button type="button" className="admin-bulk-clear" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</button>
        <button type="button" className="admin-bulk-move" onClick={openMoveDialog}><ArrowRight size={17} /> Chuyển sang bài học khác</button>
      </div>
    </div>}
    <div className={`admin-exercise-results view-${view}`}>
      <div className="admin-exercise-table-wrap"><table className="admin-exercise-table"><thead><tr><th className="admin-exercise-select-cell"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="Chọn tất cả bài tập đang hiển thị" /></th><th>Nội dung</th><th>Giáo trình · Bài học</th><th>Kỹ năng</th><th>Dữ liệu lưu</th><th>Tệp đính kèm</th><th>Thao tác</th></tr></thead><tbody>{(skill === 'all' ? gridGroups : [{ value: skill, label: '', icon: BookOpen, items: filtered }]).map((group) => {
        const GroupIcon = group.icon
        return <Fragment key={group.value}>
          {skill === 'all' && <tr className="admin-exercise-table-group"><td colSpan={7}><span><label className="admin-exercise-group-check"><input type="checkbox" checked={group.items.every((item) => selectedIds.has(item.id))} onChange={() => toggleExerciseGroup(group.items)} aria-label={`Chọn tất cả bài tập ${group.label}`} /></label><button type="button" className="admin-exercise-group-toggle" onClick={() => toggleCollapsedExerciseGroup(group.value)} aria-expanded={!collapsedExerciseGroups.has(group.value)}><GroupIcon size={17} />{group.label}<ChevronDown className={collapsedExerciseGroups.has(group.value) ? 'is-collapsed' : ''} size={16} /></button></span><em>{group.items.length} bài tập</em></td></tr>}
          {!collapsedExerciseGroups.has(group.value) && group.items.map((item) => {
            const meta = getExerciseSkillMeta(item)
            const Icon = meta.icon
            return <tr key={item.id} className={selectedIds.has(item.id) ? 'is-selected' : ''}><td className="admin-exercise-select-cell"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Chọn bài tập ${item.prompt_ko}`} /></td><td><strong>{item.prompt_ko}</strong>{item.prompt_vi && <small>{item.prompt_vi}</small>}</td><td><span>{item.lessons?.textbooks?.title_ko || 'Giáo trình'}</span><small>Bài {item.lessons?.lesson_number}</small></td><td><span className="admin-skill-cell"><Icon size={16} />{meta.label}</span></td><td><span className="admin-answer-cell">{exerciseAnswerSummary(item)}</span></td><td><span className="admin-media-cell">{(item.image_url || item.media_url) && <Image size={16} />} {item.audio_url && <Music size={16} />} {!item.image_url && !item.media_url && !item.audio_url && '—'}</span></td><td><div className="admin-row-actions"><button onClick={() => open(item)} aria-label="Sửa"><Pencil size={16} /></button><button className="danger" onClick={() => setDeleteTarget(item)} aria-label="Xóa"><Trash2 size={16} /></button></div></td></tr>
          })}
        </Fragment>
      })}</tbody></table></div>
      <div className={`admin-exercise-grid${skill === 'all' ? ' is-grouped' : ''}`}>{(skill === 'all' ? gridGroups : [{ value: skill, label: '', icon: BookOpen, items: filtered }]).map((group) => {
        const GroupIcon = group.icon
        return <section className="admin-exercise-group" key={group.value}>
          {skill === 'all' && <header className="admin-exercise-group-title"><span><label className="admin-exercise-group-check"><input type="checkbox" checked={group.items.every((item) => selectedIds.has(item.id))} onChange={() => toggleExerciseGroup(group.items)} aria-label={`Chọn tất cả bài tập ${group.label}`} /></label><button type="button" className="admin-exercise-group-toggle" onClick={() => toggleCollapsedExerciseGroup(group.value)} aria-expanded={!collapsedExerciseGroups.has(group.value)}><GroupIcon size={18} />{group.label}<ChevronDown className={collapsedExerciseGroups.has(group.value) ? 'is-collapsed' : ''} size={17} /></button></span><em>{group.items.length} bài tập</em></header>}
          {!collapsedExerciseGroups.has(group.value) && <div className="admin-exercise-group-grid">{group.items.map((item) => {
            const meta = getExerciseSkillMeta(item)
            const Icon = meta.icon
            return <article key={item.id} className={`admin-exercise-card${selectedIds.has(item.id) ? ' is-selected' : ''}`}><div className="admin-exercise-head"><label className="admin-exercise-card-select"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Chọn bài tập ${item.prompt_ko}`} /></label><span><Icon size={17} />{meta.label}</span><div><button onClick={() => open(item)} aria-label="Sửa"><Pencil size={16} /></button><button className="danger" onClick={() => setDeleteTarget(item)} aria-label="Xóa"><Trash2 size={16} /></button></div></div><small>{item.lessons?.textbooks?.title_ko || 'Giáo trình'} · Bài {item.lessons?.lesson_number}</small><h3>{item.prompt_ko}</h3>{item.prompt_vi && <p>{item.prompt_vi}</p>}<div className="admin-exercise-media">{(item.image_url || item.media_url) && <span><Image size={15} /> Hình ảnh</span>}{item.audio_url && <span><Music size={15} /> Audio</span>}</div></article>
          })}</div>}
        </section>
      })}</div>
    </div>
    {!filtered.length && <div className="admin-empty">Chưa có bài tập phù hợp với bộ lọc.</div>}
    {moveDialogOpen && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !moving) setMoveDialogOpen(false) }}>
      <section className="admin-modal admin-bulk-move-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-move-title">
        <header>
          <div><span><ArrowRight size={22} /></span><div><h2 id="bulk-move-title">Chuyển bài tập hàng loạt</h2><p>Chọn giáo trình và bài học đích cho {selectedIds.size} bài tập.</p></div></div>
          <button type="button" onClick={() => setMoveDialogOpen(false)} disabled={moving} aria-label="Đóng"><X size={21} /></button>
        </header>
        <div className="admin-bulk-move-form">
          <label>Giáo trình đích
            <AdminSelect
              searchable
              searchPlaceholder="Tìm giáo trình…"
              value={moveBookId}
              options={textbooks.map((item) => ({ value: item.id, label: item.title_ko }))}
              onChange={(value) => {
                setMoveBookId(value)
                setMoveLessonId(lessons.find((item) => item.textbook_id === value)?.id || '')
              }}
              label="Chọn giáo trình đích"
            />
          </label>
          <label>Bài học đích
            <AdminSelect
              searchable
              searchPlaceholder="Tìm bài học…"
              value={moveLessonId}
              options={moveLessons.length
                ? moveLessons.map((item) => ({ value: item.id, label: `Bài ${item.lesson_number} · ${item.title_ko}` }))
                : [{ value: '', label: 'Chưa có bài học' }]}
              onChange={setMoveLessonId}
              label="Chọn bài học đích"
            />
          </label>
          {!moveLessons.length && <p className="admin-bulk-move-empty">Giáo trình này chưa có bài học để chuyển đến.</p>}
          <div className="admin-bulk-move-note"><strong>{selectedIds.size} bài tập sẽ được chuyển.</strong><span>Nội dung, kỹ năng, đáp án và tệp đính kèm được giữ nguyên.</span></div>
        </div>
        <footer>
          <button type="button" className="admin-cancel" onClick={() => setMoveDialogOpen(false)} disabled={moving}>Hủy</button>
          <button type="button" className="admin-primary" onClick={() => void moveSelectedExercises()} disabled={moving || !moveLessonId}><ArrowRight size={17} /> {moving ? 'Đang chuyển…' : 'Chuyển bài tập'}</button>
        </footer>
      </section>
    </div>}
    {editing !== undefined && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(undefined) }}>
      {(() => {
        const modalSkills = [
          { value: 'vocabulary', label: 'Từ vựng', icon: BookOpen, description: 'Nhập từ vựng tiếng Hàn, nghĩa tiếng Việt, phát âm và mẹo ghi nhớ.' },
          { value: 'grammar', label: 'Ngữ pháp', icon: NotebookPen, description: 'Nhập mẫu cấu trúc ngữ pháp, bối cảnh sử dụng và các công thức chia.' },
          { value: 'dictation', label: 'Nghe chép chính tả', icon: Headphones, description: 'Nhập câu tiếng Hàn kèm bản dịch và thiết lập audio mẫu phát âm.' },
          { value: 'shadowing', label: 'Shadowing', icon: Mic, description: 'Nhập câu luyện nói theo ngữ điệu kèm ghi chú phát âm.' },
        ] as const
        const currentSkillKey = draft.skillType === 'vocabulary_grammar' ? draft.vocabularyGrammarKind : draft.skillType
        const currentSkillMeta = modalSkills.find((s) => s.value === currentSkillKey) || modalSkills[0]
        const CurrentSkillIcon = currentSkillMeta.icon

        return (
          <section className={`admin-modal admin-exercise-modal${isVocabularyGrammar ? ' is-vocabulary-grammar' : ''}${isDictation ? ' is-dictation' : ''}${isShadowing ? ' is-shadowing' : ''}`}>
            <header className="admin-exercise-modal-header">
              <div className="admin-modal-header-main">
                <span className={`admin-modal-header-icon is-${currentSkillKey}`}><CurrentSkillIcon size={22} /></span>
                <div>
                  <h2>{editing ? 'Chỉnh sửa bài tập' : 'Thêm bài tập mới'} · {currentSkillMeta.label}</h2>
                  <p>{currentSkillMeta.description}</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setEditing(undefined)} aria-label="Đóng"><X size={19} /></button>
            </header>
            <div className="admin-form admin-exercise-form">
              <section className="admin-form-section admin-general-section">
                <div className="admin-section-title"><span>Thông tin bài học & Kỹ năng</span></div>
                <div className="admin-general-grid">
                  <label>Giáo trình<AdminSelect searchable searchPlaceholder="Tìm giáo trình…" value={selectedBookId} options={textbooks.map((item) => ({ value: item.id, label: item.title_ko }))} onChange={(value) => setDraft({ ...draft, lessonId: lessons.find((item) => item.textbook_id === value)?.id || '' })} /></label>
                  <label>Bài học *<AdminSelect searchable searchPlaceholder="Tìm bài học…" value={draft.lessonId} options={modalLessons.map((item) => ({ value: item.id, label: `Bài ${item.lesson_number} · ${item.title_ko}` }))} onChange={(value) => setDraft({ ...draft, lessonId: value })} /></label>
                </div>
                <div className="admin-skill-selector-block">
                  <span className="admin-skill-selector-label">Kỹ năng bài tập *</span>
                  <div className="admin-modal-skill-tabs" role="tablist" aria-label="Phân loại kỹ năng bài tập">
                    {modalSkills.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={currentSkillKey === value}
                        className={`admin-modal-skill-tab${currentSkillKey === value ? ' is-active' : ''}`}
                        onClick={() => {
                          if (value === 'vocabulary') {
                            setDraft((cur) => ({ ...cur, skillType: 'vocabulary_grammar', vocabularyGrammarKind: 'vocabulary' }))
                          } else if (value === 'grammar') {
                            setDraft((cur) => ({ ...cur, skillType: 'vocabulary_grammar', vocabularyGrammarKind: 'grammar' }))
                          } else if (value === 'dictation') {
                            setDraft((cur) => ({ ...cur, skillType: 'dictation' }))
                          } else if (value === 'shadowing') {
                            setDraft((cur) => ({ ...cur, skillType: 'shadowing' }))
                          }
                        }}
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

          <section className={`admin-form-section admin-content-section${isVocabularyExercise ? ' is-vocab' : ''}${isGrammarExercise ? ' is-grammar' : ''}${isDictation ? ' is-dictation' : ''}${isShadowing ? ' is-shadowing' : ''}`}>
            <div className="admin-section-title"><span>{isVocabularyExercise ? 'Nội dung từ vựng' : isGrammarExercise ? 'Nội dung ngữ pháp' : isDictation ? 'Nội dung nghe' : 'Câu luyện nói'}</span></div>
            {isVocabularyExercise && <>
              <div className="admin-vocab-main">
                <label className="admin-ko-field">Nội dung tiếng Hàn *<textarea rows={3} value={draft.promptKo} onChange={(event) => setDraft({ ...draft, promptKo: event.target.value, audioUrl: '' })} /></label>
                <label className="admin-vi-field">Nội dung tiếng Việt<input value={draft.promptVi} onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })} /></label>
                <label className="admin-vocab-input">Loại từ<input value={draft.partOfSpeech} onChange={(event) => setDraft({ ...draft, partOfSpeech: event.target.value })} placeholder="Ví dụ: Danh từ, Động từ…" /></label>
                <label className="admin-vocab-input">Phát âm chuẩn<input value={draft.pronunciation} onChange={(event) => setDraft({ ...draft, pronunciation: event.target.value })} placeholder="Ví dụ: [꼳따발]" /></label>
                <label className="admin-vocab-input admin-voice-field">Phát âm thanh (TTS)<div className="admin-voice-preview-row"><VoiceSelect value={draft.ttsVoice} onChange={(value) => setDraft({ ...draft, ttsVoice: value, audioUrl: '' })} onPreview={(value) => void previewVoice(value)} previewing={previewingVoice} /><button type="button" className={`admin-voice-preview${playingPreviewVoice === draft.ttsVoice ? ' is-playing' : ''}`} disabled={previewingVoice} onClick={() => void previewVoice()}>{previewingVoice ? <LoaderCircle className="spin" size={16} /> : <Volume2 size={16} />} {playingPreviewVoice === draft.ttsVoice ? 'Dừng nghe' : 'Nghe thử giọng'}</button></div></label>
              </div>
              <div className="admin-vocab-side">
                <div className="admin-upload-field admin-image-field"><span>Hình ảnh</span><label className={uploading === 'image' ? 'uploading' : ''}>{uploading === 'image' ? <LoaderCircle className="spin" /> : <Image />}<strong>{draft.imageUrl ? 'Đổi hình ảnh' : 'Tải hình ảnh'}</strong><small>PNG, JPG, WEBP · tối đa 10 MB</small><input type="file" accept="image/*" onChange={(event) => previewUpload('image', event.target.files?.[0])} /></label>{draft.imageUrl && <div className="admin-uploaded-file image-preview"><img src={draft.imageUrl} alt="Xem trước hình bài tập" /><a href={draft.imageUrl} target="_blank" rel="noreferrer">Xem hình đã tải</a><button onClick={() => { if (draft.imageUrl && !draft.imageUrl.startsWith('blob:')) void deleteStorageAsset(draft.imageUrl); setDraft({ ...draft, imageUrl: '' }) }}><X size={15} /></button></div>}{draft.audioUrl && <div className="admin-uploaded-file"><audio controls src={draft.audioUrl} /><button title="Tạo lại audio khi lưu" onClick={() => { if (draft.audioUrl && !draft.audioUrl.startsWith('blob:')) void deleteStorageAsset(draft.audioUrl); setDraft({ ...draft, audioUrl: '' }) }}><X size={15} /></button></div>}</div>
              </div>
              <label className="admin-mnemonic-field">Mẹo nhớ<textarea rows={2} value={draft.mnemonic} onChange={(event) => setDraft({ ...draft, mnemonic: event.target.value })} placeholder="Ví dụ: 꽃(hoa) + 다발(bó) = bó hoa" /></label>
              <div className="admin-vocab-enrichment">
                <section className="admin-collocation-builder">
                  <div className="admin-vocab-extra-heading"><span>Cụm từ hay đi chung</span><button type="button" onClick={() => setDraft({ ...draft, collocations: [...draft.collocations, { ko: '', vi: '' }] })}><Plus size={15} /> Thêm cụm từ</button></div>
                  <div className="admin-collocation-list">
                    {draft.collocations.map((row, index) => <div className="admin-collocation-row" key={index}>
                      <input value={row.ko} onChange={(event) => setDraft({ ...draft, collocations: draft.collocations.map((item, itemIndex) => itemIndex === index ? { ...item, ko: event.target.value } : item) })} placeholder="Cụm từ tiếng Hàn" />
                      <input value={row.vi} onChange={(event) => setDraft({ ...draft, collocations: draft.collocations.map((item, itemIndex) => itemIndex === index ? { ...item, vi: event.target.value } : item) })} placeholder="Nghĩa tiếng Việt" />
                      <button type="button" aria-label={`Xóa cụm từ ${index + 1}`} disabled={draft.collocations.length === 1} onClick={() => setDraft({ ...draft, collocations: draft.collocations.filter((_, itemIndex) => itemIndex !== index) })}><X size={15} /></button>
                    </div>)}
                  </div>
                </section>
                <section className="admin-example-builder admin-dialogue-builder">
                  <div className="admin-vocab-extra-heading">
                    <span>Ví dụ minh họa dạng hội thoại</span>
                    <button type="button" onClick={() => setDraft((current) => {
                      const lastSpeaker = current.dialogues.at(-1)?.speaker
                      return { ...current, dialogues: [...current.dialogues, { speaker: lastSpeaker === 'A' ? 'B' : 'A', ko: '', vi: '' }] }
                    })}><Plus size={15} /> Thêm hộp hội thoại</button>
                  </div>
                  <div className="admin-dialogue-list">
                    {draft.dialogues.map((line, index) => <article className={`admin-dialogue-row speaker-${line.speaker.toLowerCase()}`} key={`dialogue-${index}`}>
                      <div className="admin-dialogue-row-head">
                        <span>Lượt {index + 1}</span>
                        <div className="admin-dialogue-speaker-switch" aria-label={`Người nói lượt ${index + 1}`}>
                          {(['A', 'B'] as const).map((speaker) => <button
                            type="button"
                            className={line.speaker === speaker ? 'is-active' : ''}
                            aria-pressed={line.speaker === speaker}
                            key={speaker}
                            onClick={() => setDraft((current) => ({
                              ...current,
                              dialogues: current.dialogues.map((item, itemIndex) => itemIndex === index ? { ...item, speaker } : item),
                            }))}
                          >{speaker}</button>)}
                        </div>
                        <button
                          type="button"
                          className="admin-dialogue-remove"
                          aria-label={`Xóa lượt hội thoại ${index + 1}`}
                          disabled={draft.dialogues.length === 1}
                          onClick={() => setDraft((current) => ({ ...current, dialogues: current.dialogues.filter((_, itemIndex) => itemIndex !== index) }))}
                        ><X size={15} /></button>
                      </div>
                      <div className="admin-dialogue-fields">
                        <label>Câu tiếng Hàn<textarea rows={2} value={line.ko} onChange={(event) => setDraft((current) => ({
                          ...current,
                          dialogues: current.dialogues.map((item, itemIndex) => itemIndex === index ? { ...item, ko: event.target.value } : item),
                        }))} placeholder="Nhập câu hội thoại tiếng Hàn…" /></label>
                        <label>Nghĩa tiếng Việt<textarea rows={2} value={line.vi} onChange={(event) => setDraft((current) => ({
                          ...current,
                          dialogues: current.dialogues.map((item, itemIndex) => itemIndex === index ? { ...item, vi: event.target.value } : item),
                        }))} placeholder="Nhập bản dịch lượt thoại…" /></label>
                      </div>
                    </article>)}
                  </div>
                </section>
              </div>
            </>}
            {isGrammarExercise && <>
              <div className="admin-grammar-main">
                <label className="admin-ko-field">
                  Mẫu ngữ pháp (tiếng Hàn) *
                  <input
                    value={draft.promptKo}
                    onChange={(event) => setDraft({ ...draft, promptKo: event.target.value })}
                    placeholder="Ví dụ: -(으)ㄴ, -고 싶다, (이)나 / -거나…"
                  />
                </label>
                <label>
                  Ý nghĩa tiếng Việt *
                  <input
                    value={draft.promptVi}
                    onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })}
                    placeholder="Ví dụ: Đã... (Định ngữ thì quá khứ cho động từ)"
                  />
                </label>
                <label>
                  Bối cảnh sử dụng
                  <input
                    value={draft.contextVi}
                    onChange={(event) => setDraft({ ...draft, contextVi: event.target.value })}
                    placeholder="Ví dụ: Dùng khi bổ nghĩa cho danh từ đứng sau về một hành động đã xảy ra…"
                  />
                </label>
              </div>
              <div className="admin-grammar-side">
                <div className="admin-formula-builder">
                  <div className="admin-formula-builder-head">
                    <span className="admin-formula-title">
                      <strong>Công thức / Cách chia</strong>
                      <small><GripVertical size={13} /> Kéo thả để xếp thứ tự</small>
                    </span>
                    <button type="button" onClick={() => setDraft({ ...draft, formulaLines: [...draft.formulaLines, ''] })}>
                      <Plus size={14} /> Thêm cách chia
                    </button>
                  </div>
                  <div className="admin-formula-list">
                    {draft.formulaLines.map((line, index) => <div
                      className={`admin-formula-row${draggedFormulaIndex === index ? ' is-dragging' : ''}`}
                      draggable
                      key={index}
                      onDragStart={(event) => {
                        setDraggedFormulaIndex(index)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (draggedFormulaIndex !== null) moveFormulaLine(draggedFormulaIndex, index)
                        setDraggedFormulaIndex(null)
                      }}
                      onDragEnd={() => setDraggedFormulaIndex(null)}
                    >
                      <span className="admin-formula-drag" title="Kéo để sắp xếp" aria-hidden="true"><GripVertical size={16} /></span>
                      <input
                        value={line}
                        onChange={(event) => setDraft({ ...draft, formulaLines: draft.formulaLines.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })}
                        placeholder={`Ví dụ: Động từ có patchim + -은 (Cách ${index + 1})`}
                      />
                      <button type="button" disabled={draft.formulaLines.length === 1} aria-label={`Xóa cách chia ${index + 1}`} onClick={() => setDraft({ ...draft, formulaLines: draft.formulaLines.filter((_, itemIndex) => itemIndex !== index) })}><X size={14} /></button>
                    </div>)}
                  </div>
                </div>
              </div>
              <label className="admin-note-field">
                Lưu ý ngữ pháp
                <textarea
                  rows={2}
                  value={draft.note}
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                  placeholder="Ví dụ: Với thân động từ kết thúc bằng 'ㄹ' thì khi gặp 'ㄴ' sẽ bị lược bỏ 'ㄹ' (만들다 -> 만든)..."
                />
              </label>
            </>}
            {isDictation && <>
              <div className="admin-listening-main admin-listening-card">
                <div className="admin-listening-card-head"><span className="admin-listening-step">1</span><div><strong>Nội dung câu nghe</strong><small>Nhập câu gốc trước để có thể nghe thử audio</small></div></div>
                <label className="admin-ko-field">
                  <span>Câu tiếng Hàn * <em className={draft.promptKo.length >= 180 ? 'is-near-limit' : ''}>{draft.promptKo.length}/200</em></span>
                  <textarea
                    maxLength={200}
                    rows={4}
                    value={draft.promptKo}
                    onChange={(event) => setDraft({ ...draft, promptKo: event.target.value, audioUrl: '' })}
                    placeholder="Ví dụ: 날씨가 추워서 목도리를 했어요."
                  />
                  <small>Đây cũng là đáp án chuẩn để chấm bài của học viên.</small>
                </label>
                <label className="admin-vi-field">
                  Bản dịch tiếng Việt
                  <input
                    value={draft.promptVi}
                    onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })}
                    placeholder="Ví dụ: Vì trời lạnh nên tôi đã quàng khăn."
                  />
                </label>
                <details className="admin-listening-optional" open={Boolean(draft.explanationVi)}>
                  <summary><span>Ghi chú / Giải thích</span><small>Tùy chọn</small></summary>
                  <label>
                    <span className="sr-only">Ghi chú / Giải thích</span>
                    <textarea
                      rows={2}
                      value={draft.explanationVi}
                      onChange={(event) => setDraft({ ...draft, explanationVi: event.target.value })}
                      placeholder="Quy tắc biến âm, ngữ pháp hoặc từ vựng trọng tâm…"
                    />
                  </label>
                </details>
              </div>
              <TtsPanel draft={draft} setDraft={setDraft} previewVoice={previewVoice} previewing={previewingVoice} />
            </>}
            {isShadowing && <>
              <div className="admin-listening-main admin-listening-card">
                <div className="admin-listening-card-head"><span className="admin-listening-step">1</span><div><strong>Nội dung câu nói</strong><small>Câu ngắn, tự nhiên sẽ dễ luyện theo hơn</small></div></div>
                <label className="admin-ko-field">
                  <span>Câu luyện Shadowing * <em className={draft.promptKo.length >= 180 ? 'is-near-limit' : ''}>{draft.promptKo.length}/200</em></span>
                  <textarea
                    maxLength={200}
                    rows={4}
                    value={draft.promptKo}
                    onChange={(event) => setDraft({ ...draft, promptKo: event.target.value, audioUrl: '' })}
                    placeholder="Ví dụ: 제 꿈은 한국어를 유창하게 말하는 것이에요."
                  />
                  <small>Câu chuẩn người bản xứ đọc — học viên nghe và nhái lại theo đúng ngữ điệu.</small>
                </label>
                <label className="admin-vi-field">
                  Bản dịch tiếng Việt
                  <input
                    value={draft.promptVi}
                    onChange={(event) => setDraft({ ...draft, promptVi: event.target.value })}
                    placeholder="Ví dụ: Ước mơ của tôi là nói tiếng Hàn thành thạo."
                  />
                </label>
                <label>
                  Lưu ý phát âm &amp; ngữ điệu
                  <input
                    value={draft.pronunciation}
                    onChange={(event) => setDraft({ ...draft, pronunciation: event.target.value })}
                    placeholder="Ví dụ: Lên giọng cuối câu, nối âm [유창하게→유창하게], nhấn vần -게…"
                  />
                </label>
                <details className="admin-listening-optional" open={Boolean(draft.note)}>
                  <summary><span>Ghi chú thêm</span><small>Tùy chọn</small></summary>
                  <label>
                    <span className="sr-only">Ghi chú thêm</span>
                    <textarea
                      rows={2}
                      value={draft.note}
                      onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                      placeholder="Ngữ pháp đặc biệt hoặc bối cảnh văn hóa liên quan…"
                    />
                  </label>
                </details>
              </div>
              <TtsPanel draft={draft} setDraft={setDraft} previewVoice={previewVoice} previewing={previewingVoice} showSpeed />
            </>}
          </section>
        </div>
        <footer><button className="admin-cancel" onClick={() => setEditing(undefined)}>Hủy</button><button className="admin-primary" disabled={saving || uploading !== null || !draft.lessonId || !draft.promptKo.trim()} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu bài tập'}</button></footer>
      </section>
    )
  })()}
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

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '../lib/adminApi'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { BookOpen, BookText, Users, LayoutDashboard, LogOut, X, ShieldCheck, GraduationCap, Plus, Search, Eye, EyeOff, Lock, Unlock, Flag, MessageSquare, Pencil, Trash2, ChevronDown, ChevronUp, Save, Check, Clock3, Star, Download, TrendingUp, ClipboardList, CalendarDays, RotateCcw, Bell } from 'lucide-react'
import { playEffect } from '../services/audioService'
import notificationSoundUrl from '../../Sound Effect/Notification.mp3'
import AdminExercises from './AdminExercises'
import { BlockingLoader, useAppDialog } from '../components/common/AppDialog'
import './admin.css'

type Status = 'draft' | 'published' | 'locked' | 'no_content'
type Textbook = { id: string; slug: string; title_ko: string; title_vi: string | null; description?: string | null; sort_order?: number; status: Status }
type Lesson = { id: string; textbook_id: string; lesson_number: number; title_ko: string; title_vi: string | null; status: Status; textbooks?: { title_ko?: string } }
type AdminUser = { id: string; email?: string; display_name?: string; role: 'user' | 'admin'; level?: number; xp?: number; emailConfirmedAt?: string; lastSignInAt?: string; is_locked?: boolean; locked_at?: string }
type DashboardData = { days: number; activeUsers: number; averageCompletedLessons: number; averageMinutes: number; retentionRate: number; pendingReports: number; totalTextbooks: number; totalLessons: number; totalUsers: number; chart: { date: string; minutes: number }[]; courses: { title: string; percent: number }[]; hardVocabulary: { word: string; meaning: string; course: string; errorRate: number }[] }
type CommunityReport = { id: string; post_id: string | null; custom_lesson_id?: string | null; reason: string; status: 'pending' | 'resolved' | 'dismissed'; created_at: string; profiles?: { display_name?: string } }
type CommunityPost = { id: string; user_id: string; content: string; status: 'visible' | 'hidden'; comments_locked: boolean; moderation_reason?: string | null; created_at: string; profiles?: { display_name?: string; avatar_url?: string }; reports: CommunityReport[] }
type CommunityVocabularySet = { id: string; creator_id: string; title: string; code: string; words: unknown[]; visibility: 'public' | 'private'; status: 'visible' | 'hidden'; created_at: string; profiles?: { display_name?: string } }
type CommunityData = { posts: CommunityPost[]; reports: CommunityReport[]; customLessons: CommunityVocabularySet[] }

const statuses: { value: Status; label: string }[] = [
  { value: 'draft', label: 'Bản nháp' }, { value: 'published', label: 'Đã xuất bản' },
  { value: 'locked', label: 'Đã khóa' }, { value: 'no_content', label: 'Chưa có nội dung' },
]

type AdminSelectOption = { value: string; label: string; group?: string; searchText?: string }

export function AdminSelect({ value, options, onChange, label, searchable = false, searchPlaceholder = 'Tìm kiếm…' }: { value: string; options: AdminSelectOption[]; onChange: (value: string) => void; label?: string; searchable?: boolean; searchPlaceholder?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) || options[0]
  const normalizedQuery = query.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const visibleOptions = normalizedQuery
    ? options.filter((option) => `${option.label} ${option.group || ''} ${option.searchText || ''}`.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalizedQuery))
    : options
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const move = (direction: number) => {
    const index = Math.max(0, options.findIndex((option) => option.value === value))
    onChange(options[(index + direction + options.length) % options.length].value)
  }
  return <div className={`admin-combobox ${open ? 'open' : ''}`} ref={rootRef}>
    <button type="button" className="admin-combobox-trigger" data-value={value} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((current) => !current); setQuery('') }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); move(1); setOpen(true) } if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); setOpen(true) } if (event.key === 'Escape') { setOpen(false); setQuery('') } }}><span>{selected?.label}</span><ChevronDown size={17} /></button>
    {open && <div className="admin-combobox-menu" role="listbox">
      {searchable && <div className="admin-combobox-search"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></div>}
      <div className="admin-combobox-options">{visibleOptions.map((option, index) => <Fragment key={option.value}>{option.group && option.group !== visibleOptions[index - 1]?.group && <div className="admin-combobox-group">{option.group}</div>}<button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} onClick={() => { onChange(option.value); setOpen(false); setQuery('') }}><span>{option.label}</span>{option.value === value && <Check size={16} />}</button></Fragment>)}{!visibleOptions.length && <div className="admin-combobox-empty">Không tìm thấy kết quả</div>}</div>
    </div>}
  </div>
}

export default function AdminPage() {
  const dialog = useAppDialog()
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState<'dashboard' | 'textbooks' | 'lessons' | 'exercises' | 'community' | 'users'>('dashboard')
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [textbookStatusFilter, setTextbookStatusFilter] = useState('all')
  const [lessonStatusFilter, setLessonStatusFilter] = useState('all')
  const [lessonTextbookFilter, setLessonTextbookFilter] = useState('all')
  const [expandedTextbookGroups, setExpandedTextbookGroups] = useState<Set<string>>(new Set())
  const [closingTextbookGroups, setClosingTextbookGroups] = useState<Set<string>>(new Set())
  const groupAnimationTimers = useRef<Map<string, number>>(new Map())
  const [editor, setEditor] = useState<{ kind: 'textbooks' | 'lessons'; id?: string } | null>(null)
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [range, setRange] = useState<7 | 30>(7)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [community, setCommunity] = useState<CommunityData>({ posts: [], reports: [], customLessons: [] })
  const [communityStatus, setCommunityStatus] = useState('all')
  const [communityView, setCommunityView] = useState<'queue' | 'posts' | 'vocabulary'>('queue')
  const [communityDay, setCommunityDay] = useState('all')
  const [communityMonth, setCommunityMonth] = useState('all')
  const [communityYear, setCommunityYear] = useState('all')

  const refreshDashboard = useCallback(async () => {
    const data = await adminApi<DashboardData>(`/dashboard?days=${range}&refresh=true`)
    setDashboard(data)
    return data
  }, [range])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (tab === 'dashboard') setDashboard(await adminApi<DashboardData>(`/dashboard?days=${range}`))
      if (tab === 'textbooks') setTextbooks(await adminApi<Textbook[]>('/textbooks'))
      if (tab === 'lessons') {
        const [bookData, lessonData] = await Promise.all([adminApi<Textbook[]>('/textbooks'), adminApi<Lesson[]>('/lessons')])
        setTextbooks(bookData); setLessons(lessonData)
      }
      if (tab === 'users') setUsers(await adminApi<AdminUser[]>('/users'))
      if (tab === 'community') setCommunity(await adminApi<CommunityData>('/community'))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu quản trị.') }
    finally { setLoading(false) }
  }, [range, tab])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!supabase) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void refreshDashboard().catch(() => undefined)
      }, 350)
    }
    const channel = supabase.channel(`admin-dashboard-${range}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_study_stats' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vocabulary_progress' }, refresh)
      .subscribe()
    return () => { clearTimeout(timer); void supabase.removeChannel(channel) }
  }, [range, refreshDashboard])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase.channel('admin-community-report-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'content_reports' }, () => {
        setDashboard((current) => current ? { ...current, pendingReports: current.pendingReports + 1 } : current)
        playEffect(notificationSoundUrl)
        if (tab === 'community') void adminApi<CommunityData>('/community').then(setCommunity).catch(() => undefined)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [tab])

  const updateStatus = async (kind: 'textbooks' | 'lessons', id: string, status: Status) => {
    setActionBusy('Đang cập nhật trạng thái…')
    try {
      await adminApi(`/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      if (kind === 'textbooks') setTextbooks((items) => items.map((item) => item.id === id ? { ...item, status } : item))
      else setLessons((items) => items.map((item) => item.id === id ? { ...item, status } : item))
      await refreshDashboard()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật.') }
    finally { setActionBusy('') }
  }

  const updateRole = async (id: string, role: 'user' | 'admin') => {
    setActionBusy('Đang cập nhật quyền…')
    try {
      await adminApi(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
      setUsers((items) => items.map((item) => item.id === id ? { ...item, role } : item))
      await refreshDashboard()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật vai trò.') }
    finally { setActionBusy('') }
  }

  const updateAccountLock = async (user: AdminUser) => {
    const locked = !user.is_locked
    const accepted = await dialog.confirm({
      title: locked ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?',
      message: locked
        ? `Người dùng “${user.display_name || user.email}” sẽ không thể đăng nhập hoặc tiếp tục sử dụng hệ thống.`
        : `Người dùng “${user.display_name || user.email}” sẽ có thể đăng nhập trở lại.`,
      variant: locked ? 'warning' : 'info',
      confirmLabel: locked ? 'Khóa tài khoản' : 'Mở khóa',
    })
    if (!accepted) return
    setActionBusy(locked ? 'Đang khóa tài khoản…' : 'Đang mở khóa tài khoản…')
    try {
      await adminApi(`/users/${user.id}/lock`, { method: 'PATCH', body: JSON.stringify({ locked }) })
      setUsers((items) => items.map((item) => item.id === user.id ? { ...item, is_locked: locked, locked_at: locked ? new Date().toISOString() : undefined } : item))
      await refreshDashboard()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái tài khoản.') }
    finally { setActionBusy('') }
  }

  const openEditor = (kind: 'textbooks' | 'lessons', item?: Textbook | Lesson) => {
    setError(''); setEditor({ kind, id: item?.id })
    if (kind === 'textbooks') {
      const book = item as Textbook | undefined
      setDraft({ slug: book?.slug || '', titleKo: book?.title_ko || '', titleVi: book?.title_vi || '', description: book?.description || '', sortOrder: String(book?.sort_order ?? textbooks.length), status: book?.status || 'draft' })
    } else {
      const lesson = item as Lesson | undefined
      setDraft({ textbookId: lesson?.textbook_id || textbooks[0]?.id || '', lessonNumber: String(lesson?.lesson_number ?? lessons.length + 1), titleKo: lesson?.title_ko || '', titleVi: lesson?.title_vi || '', status: lesson?.status || 'draft' })
    }
  }

  const saveEditor = async () => {
    if (!editor) return
    if (!draft.titleKo?.trim() || (editor.kind === 'textbooks' && !draft.slug?.trim()) || (editor.kind === 'lessons' && !draft.textbookId)) { setError('Vui lòng điền đầy đủ các trường bắt buộc.'); return }
    setSaving(true); setError('')
    try {
      const body = editor.kind === 'textbooks'
        ? { slug: draft.slug, titleKo: draft.titleKo, titleVi: draft.titleVi, description: draft.description, sortOrder: Number(draft.sortOrder) || 0, status: draft.status }
        : { textbookId: draft.textbookId, lessonNumber: Number(draft.lessonNumber), titleKo: draft.titleKo, titleVi: draft.titleVi, status: draft.status }
      await adminApi(`/${editor.kind}${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      setEditor(null); await Promise.all([load(), refreshDashboard()])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu dữ liệu.') }
    finally { setSaving(false) }
  }

  const deleteItem = async (kind: 'textbooks' | 'lessons', item: Textbook | Lesson) => {
    const label = 'slug' in item ? item.title_ko : `Bài ${item.lesson_number} — ${item.title_ko}`
    const accepted = await dialog.confirm({
      title: kind === 'textbooks' ? 'Xóa giáo trình?' : 'Xóa bài học?',
      message: `Bạn sắp xóa “${label}”.${kind === 'textbooks' ? '\nToàn bộ bài học thuộc giáo trình này cũng sẽ bị xóa.' : ''}`,
      variant: 'error',
      confirmLabel: 'Xóa vĩnh viễn',
    })
    if (!accepted) return
    setActionBusy(kind === 'textbooks' ? 'Đang xóa giáo trình…' : 'Đang xóa bài học…')
    try { await adminApi(`/${kind}/${item.id}`, { method: 'DELETE' }); await Promise.all([load(), refreshDashboard()]) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xóa dữ liệu.') }
    finally { setActionBusy('') }
  }

  const moderatePost = async (post: CommunityPost, patch: { hidden?: boolean; commentsLocked?: boolean }) => {
    setActionBusy('Đang cập nhật bài viết…')
    try {
      const updated = await adminApi<CommunityPost>(`/community/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setCommunity((current) => ({ ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, ...updated, reports: item.reports } : item) }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kiểm duyệt bài viết.') }
    finally { setActionBusy('') }
  }
  const deleteCommunityPost = async (post: CommunityPost) => {
    const accepted = await dialog.confirm({
      title: 'Xóa bài viết?',
      message: 'Bài viết cùng toàn bộ bình luận và báo cáo liên quan sẽ bị xóa vĩnh viễn.',
      variant: 'error',
      confirmLabel: 'Xóa bài viết',
    })
    if (!accepted) return
    setActionBusy('Đang xóa bài viết…')
    try {
      await adminApi(`/community/posts/${post.id}`, { method: 'DELETE' })
      setCommunity((current) => ({ ...current, posts: current.posts.filter((item) => item.id !== post.id), reports: current.reports.filter((report) => report.post_id !== post.id) }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xóa bài viết.') }
    finally { setActionBusy('') }
  }
  const resolveReport = async (report: CommunityReport, status: 'resolved' | 'dismissed') => {
    setActionBusy('Đang xử lý báo cáo…')
    try {
      await adminApi(`/community/reports/${report.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setCommunity((current) => ({
        ...current,
        reports: current.reports.map((item) => item.id === report.id ? { ...item, status } : item),
        posts: current.posts.map((post) => ({ ...post, reports: post.reports.map((item) => item.id === report.id ? { ...item, status } : item) })),
      }))
      if (report.status === 'pending') setDashboard((current) => current ? { ...current, pendingReports: Math.max(0, current.pendingReports - 1) } : current)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xử lý báo cáo.') }
    finally { setActionBusy('') }
  }

  const moderateVocabularySet = async (lesson: CommunityVocabularySet) => {
    setActionBusy('Đang cập nhật bộ từ vựng…')
    try {
      const hidden = lesson.status !== 'hidden'
      await adminApi(`/community/custom-lessons/${lesson.id}`, { method: 'PATCH', body: JSON.stringify({ hidden }) })
      setCommunity((current) => ({ ...current, customLessons: current.customLessons.map((item) => item.id === lesson.id ? { ...item, status: hidden ? 'hidden' : 'visible' } : item) }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kiểm duyệt bộ từ vựng.') }
    finally { setActionBusy('') }
  }

  const query = search.trim().toLocaleLowerCase('vi')
  const filteredTextbooks = textbooks.filter((item) =>
    (textbookStatusFilter === 'all' || item.status === textbookStatusFilter)
    && [item.title_ko, item.title_vi, item.slug].some((value) => value?.toLocaleLowerCase('vi').includes(query)))
  const filteredLessons = lessons.filter((item) =>
    (lessonStatusFilter === 'all' || item.status === lessonStatusFilter)
    && (lessonTextbookFilter === 'all' || item.textbook_id === lessonTextbookFilter)
    && [item.title_ko, item.title_vi, item.textbooks?.title_ko, String(item.lesson_number)].some((value) => value?.toLocaleLowerCase('vi').includes(query)))
  const filteredUsers = users.filter((user) =>
    [user.display_name, user.email, user.id].some((value) => value?.toLocaleLowerCase('vi').includes(query)))
  const lessonGroups = Array.from(filteredLessons.reduce((groups, lesson) => {
    const items = groups.get(lesson.textbook_id) || []
    items.push(lesson)
    groups.set(lesson.textbook_id, items)
    return groups
  }, new Map<string, Lesson[]>()).entries()).sort(([, a], [, b]) =>
    (a[0]?.textbooks?.title_ko || '').localeCompare(b[0]?.textbooks?.title_ko || '', 'ko'))
  const toggleTextbookGroup = (textbookId: string) => {
    const oldTimer = groupAnimationTimers.current.get(textbookId)
    if (oldTimer) window.clearTimeout(oldTimer)
    if (expandedTextbookGroups.has(textbookId)) {
      setClosingTextbookGroups((current) => new Set(current).add(textbookId))
      const timer = window.setTimeout(() => {
        setExpandedTextbookGroups((current) => { const next = new Set(current); next.delete(textbookId); return next })
        setClosingTextbookGroups((current) => { const next = new Set(current); next.delete(textbookId); return next })
        groupAnimationTimers.current.delete(textbookId)
      }, 220)
      groupAnimationTimers.current.set(textbookId, timer)
      return
    }
    setClosingTextbookGroups((current) => { const next = new Set(current); next.delete(textbookId); return next })
    setExpandedTextbookGroups((current) => new Set(current).add(textbookId))
  }
  useEffect(() => () => { groupAnimationTimers.current.forEach((timer) => window.clearTimeout(timer)) }, [])
  const communityYears = Array.from(new Set([...community.posts, ...community.customLessons].map((item) => new Date(item.created_at).getFullYear()).filter(Number.isFinite))).sort((a, b) => b - a)
  const matchesCommunityDate = (createdAtValue: string) => {
    const createdAt = new Date(createdAtValue)
    return !Number.isNaN(createdAt.getTime())
      && (communityDay === 'all' || createdAt.getDate() === Number(communityDay))
      && (communityMonth === 'all' || createdAt.getMonth() + 1 === Number(communityMonth))
      && (communityYear === 'all' || createdAt.getFullYear() === Number(communityYear))
  }
  const filteredCommunityPosts = community.posts.filter((post) => {
    return matchesCommunityDate(post.created_at)
    &&
    (communityStatus === 'all' || communityStatus === post.status || (communityStatus === 'reported' && post.reports.some((report) => report.status === 'pending')))
    && [post.content, post.profiles?.display_name].some((value) => value?.toLocaleLowerCase('vi').includes(query))
  })
  const filteredCommunityVocabulary = community.customLessons.filter((lesson) =>
    matchesCommunityDate(lesson.created_at)
    && (communityStatus === 'all' || communityStatus === lesson.status || (communityStatus === 'reported' && community.reports.some((report) => report.custom_lesson_id === lesson.id && report.status === 'pending')))
    && [lesson.title, lesson.code, lesson.profiles?.display_name].some((value) => value?.toLocaleLowerCase('vi').includes(query)))
  const pendingCommunityReports = community.reports.filter((report) => report.status === 'pending')
  const pendingCommunityPosts = filteredCommunityPosts.filter((post) => post.reports.some((report) => report.status === 'pending'))
  const pendingCommunityVocabulary = filteredCommunityVocabulary.filter((lesson) => community.reports.some((report) => report.custom_lesson_id === lesson.id && report.status === 'pending'))
  const displayedCommunityPosts = communityView === 'queue' ? pendingCommunityPosts : filteredCommunityPosts
  const displayedCommunityVocabulary = communityView === 'queue' ? pendingCommunityVocabulary : filteredCommunityVocabulary
  const maxChart = Math.max(1, ...(dashboard?.chart.map((item) => item.minutes) || [1]))
  const exportDashboard = () => {
    if (!dashboard) return
    const rows = [['Ngày', 'Phút học'], ...dashboard.chart.map((item) => [item.date, String(Math.round(item.minutes))])]
    const blob = new Blob(['\uFEFF' + rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `korean-study-${range}-ngay.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="admin-shell">
    <BlockingLoader show={saving || Boolean(actionBusy)} label={actionBusy || 'Đang lưu thay đổi…'} />
    <aside className="admin-sidebar">
      <div className="admin-brand"><span>한</span><strong>Korean <em>Study</em></strong></div>
      <nav className="admin-menu" aria-label="Menu quản trị">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><LayoutDashboard size={20} /><span>Dashboard</span></button>
        <button className={tab === 'textbooks' ? 'active' : ''} onClick={() => setTab('textbooks')}><BookOpen size={20} /><span>Giáo trình</span><b>{textbooks.length || dashboard?.totalTextbooks || 0}</b></button>
        <button className={tab === 'lessons' ? 'active' : ''} onClick={() => setTab('lessons')}><BookText size={20} /><span>Bài học</span><b>{lessons.length || dashboard?.totalLessons || 0}</b></button>
        <button className={tab === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}><ClipboardList size={20} /><span>Bài tập</span></button>
        <button className={tab === 'community' ? 'active' : ''} onClick={() => setTab('community')}><MessageSquare size={20} /><span>Cộng đồng</span><b>{dashboard?.pendingReports || community.reports.filter((report) => report.status === 'pending').length || ''}</b></button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Users size={20} /><span>Người dùng</span><b>{users.length || dashboard?.totalUsers || 0}</b></button>
      </nav>
      <div className="admin-account"><div className="admin-avatar">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</div><div><b>{profile?.displayName || 'Quản trị viên'}</b><small>Quản trị viên</small></div></div>
      <button className="admin-signout" onClick={() => void signOut()}><LogOut size={18} /><span>Đăng xuất</span></button>
    </aside>
    <main className="admin-page">
      {tab === 'dashboard' ? <header className="admin-header admin-welcome"><div className="admin-welcome-avatar">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</div><div className="admin-welcome-copy"><span className="admin-kicker">KOREAN STUDY ADMIN</span><h1>Chào {profile?.displayName || 'Quản trị viên'}! <span>👋</span></h1><p>Chúc bạn một ngày quản lý hệ thống thật hiệu quả.</p><div className="admin-welcome-chips"><span><Users size={17} /><b>{dashboard?.activeUsers || 0}</b> học viên hoạt động</span><span><ShieldCheck size={17} /> Hệ thống an toàn</span></div></div><button type="button" className="admin-report-bell" aria-label={`${dashboard?.pendingReports || 0} báo cáo đang chờ xử lý`} onClick={() => setTab('community')}><Bell size={27}/>{Boolean(dashboard?.pendingReports) && <><i /><b>{dashboard?.pendingReports}</b></>}</button></header> : <header className="admin-header"><div><span className="admin-kicker">KOREAN STUDY ADMIN</span><h1>{tab === 'textbooks' ? 'Quản lý giáo trình' : tab === 'lessons' ? 'Quản lý bài học' : tab === 'exercises' ? 'Quản lý bài tập' : tab === 'community' ? 'Quản lý cộng đồng' : 'Quản lý người dùng'}</h1><p>Dữ liệu và quyền quản trị được xử lý an toàn qua backend.</p></div></header>}
      {error && <div className="admin-error">{error}<button onClick={() => setError('')} aria-label="Đóng thông báo"><X size={20} /></button></div>}
      {loading ? <div className="admin-loading">Đang tải dữ liệu quản trị…</div> : <section className="admin-panel">
        {tab === 'dashboard' && dashboard && <div className="admin-dashboard">
          <div className="admin-dashboard-heading"><div><h2>Dashboard</h2><p>Tổng quan hiệu suất và dữ liệu học tập của học viên.</p></div><div className="admin-dashboard-tools"><AdminSelect value={String(range)} options={[{ value: '7', label: '7 ngày qua' }, { value: '30', label: '30 ngày qua' }]} onChange={(value) => setRange(Number(value) as 7 | 30)} /><button onClick={exportDashboard}><Download size={17} /> Tải báo cáo</button></div></div>
          <div className="admin-stat-grid">
            <article className="admin-stat purple"><span><GraduationCap size={25} /></span><div><small>Học viên đang học</small><strong>{dashboard.activeUsers}</strong></div><em><TrendingUp size={14} /> {range} ngày</em></article>
            <article className="admin-stat blue"><span><BookOpen size={25} /></span><div><small>Bài học hoàn thành (TB)</small><strong>{dashboard.averageCompletedLessons.toFixed(1)}<i> / học viên</i></strong></div></article>
            <article className="admin-stat pink"><span><Clock3 size={25} /></span><div><small>Thời gian học trung bình</small><strong>{Math.round(dashboard.averageMinutes)}<i> phút/ngày</i></strong></div></article>
            <article className="admin-stat orange" title={`Tỷ lệ học viên của ${range} ngày trước quay lại học trong ${range} ngày gần đây`}><span><Star size={25} /></span><div><small>Tỷ lệ quay lại</small><strong>{Math.round(dashboard.retentionRate)}%</strong><i> so với kỳ trước</i></div></article>
          </div>
          <div className="admin-analytics-grid"><article className="admin-chart-card"><div className="admin-card-heading"><h3>Tiến độ học tập tổng quan</h3><span>{range} ngày</span></div><div className="admin-bar-chart">{dashboard.chart.map((item) => <div className="admin-bar-column" key={item.date}><div className="admin-bar-value">{Math.round(item.minutes)}</div><div className="admin-bar-track"><div style={{ height: `${Math.max(3, item.minutes / maxChart * 100)}%` }} /></div><small>{new Date(`${item.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' })}</small></div>)}</div><p className="admin-chart-note">Tổng số phút học được ghi nhận theo ngày.</p></article><article className="admin-course-card"><h3>Tỷ lệ hoàn thành theo giáo trình</h3><div className="admin-course-list">{dashboard.courses.length ? dashboard.courses.map((course, index) => <div key={`${course.title}-${index}`}><span><b>{course.title}</b><strong>{Math.round(course.percent)}%</strong></span><div><i style={{ width: `${Math.min(100, course.percent)}%` }} /></div></div>) : <p>Chưa có dữ liệu tiến độ.</p>}</div><button onClick={() => setTab('textbooks')}>Xem tất cả giáo trình</button></article></div>
          <article className="admin-hard-words"><div className="admin-card-heading"><div><h3>Thống kê từ vựng khó nhớ</h3><p>Các từ có tỷ lệ trả lời sai cao nhất.</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Từ vựng (Tiếng Hàn)</th><th>Nghĩa (Tiếng Việt)</th><th>Giáo trình</th><th>Tỷ lệ sai</th></tr></thead><tbody>{dashboard.hardVocabulary.map((word) => <tr key={`${word.word}-${word.course}`}><td><b>{word.word}</b></td><td>{word.meaning}</td><td>{word.course}</td><td><strong className="admin-error-rate">{Math.round(word.errorRate)}%</strong></td></tr>)}</tbody></table></div>{!dashboard.hardVocabulary.length && <div className="admin-empty">Chưa có dữ liệu từ vựng sai.</div>}</article>
        </div>}
        {tab === 'textbooks' && <>
          <div className="admin-panel-title"><div><h2>Giáo trình</h2><p>Thêm, chỉnh sửa, xuất bản hoặc xóa giáo trình.</p></div><button className="admin-primary" onClick={() => openEditor('textbooks')}><Plus size={18} /> Thêm giáo trình</button></div>
          <div className="admin-toolbar admin-toolbar-with-filters">
            <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc slug…" /></label>
            <div className="admin-filter-controls"><AdminSelect value={textbookStatusFilter} options={[{ value: 'all', label: 'Tất cả trạng thái' }, ...statuses]} label="Lọc trạng thái giáo trình" onChange={setTextbookStatusFilter} /><span>{filteredTextbooks.length} kết quả</span></div>
          </div>
          <div className="admin-grid">{filteredTextbooks.map((book) => <article className="admin-card" key={book.id}><div className="admin-card-top"><span className={`admin-status ${book.status}`}>{statuses.find((item) => item.value === book.status)?.label}</span><div className="admin-actions"><button onClick={() => openEditor('textbooks', book)} aria-label="Sửa giáo trình"><Pencil size={17} /></button><button className="danger" onClick={() => void deleteItem('textbooks', book)} aria-label="Xóa giáo trình"><Trash2 size={17} /></button></div></div><h3>{book.title_ko}</h3><p>{book.title_vi || book.slug}</p><AdminSelect value={book.status} options={statuses} label={`Trạng thái ${book.title_ko}`} onChange={(value) => void updateStatus('textbooks', book.id, value as Status)} /></article>)}</div>
          {!filteredTextbooks.length && <div className="admin-empty">Không tìm thấy giáo trình phù hợp.</div>}
        </>}
        {tab === 'lessons' && <>
          <div className="admin-panel-title"><div><h2>Bài học</h2><p>Bài học được gom theo giáo trình; mở từng giáo trình để quản lý các bài bên trong.</p></div><button className="admin-primary" onClick={() => openEditor('lessons')} disabled={!textbooks.length}><Plus size={18} /> Thêm bài học</button></div>
          <div className="admin-toolbar admin-toolbar-with-filters">
            <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bài học hoặc giáo trình…" /></label>
            <div className="admin-filter-controls">
              <AdminSelect value={lessonTextbookFilter} options={[{ value: 'all', label: 'Tất cả giáo trình' }, ...textbooks.map((book) => ({ value: book.id, label: book.title_ko }))]} label="Lọc theo giáo trình" onChange={setLessonTextbookFilter} />
              <AdminSelect value={lessonStatusFilter} options={[{ value: 'all', label: 'Tất cả trạng thái' }, ...statuses]} label="Lọc trạng thái bài học" onChange={setLessonStatusFilter} />
              <span>{filteredLessons.length} bài học</span>
            </div>
          </div>
          <div className="admin-table-wrap admin-grouped-lessons"><table><thead><tr><th></th><th>Giáo trình</th><th>Nội dung</th><th>Số bài</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
            {lessonGroups.map(([textbookId, group]) => {
              const expanded = expandedTextbookGroups.has(textbookId)
              const closing = closingTextbookGroups.has(textbookId)
              const visuallyExpanded = expanded && !closing
              const textbook = textbooks.find((book) => book.id === textbookId)
              return <Fragment key={textbookId}>
                <tr className="admin-lesson-group-row">
                  <td><button className="admin-expand-button" onClick={() => toggleTextbookGroup(textbookId)} aria-expanded={visuallyExpanded} aria-label={`${visuallyExpanded ? 'Thu gọn' : 'Mở'} giáo trình ${textbook?.title_ko || ''}`}>{visuallyExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button></td>
                  <td><b>{textbook?.title_ko || group[0]?.textbooks?.title_ko || 'Giáo trình'}</b>{textbook?.title_vi && <small>{textbook.title_vi}</small>}</td>
                  <td><span>{visuallyExpanded ? 'Danh sách bài học trong giáo trình' : 'Bấm mũi tên để xem các bài học'}</span></td>
                  <td><span className="admin-group-count">{group.length} bài</span></td>
                  <td><span className="admin-group-status">{new Set(group.map((lesson) => lesson.status)).size === 1 ? statuses.find((status) => status.value === group[0].status)?.label : 'Nhiều trạng thái'}</span></td>
                  <td></td>
                </tr>
                {expanded && [...group].sort((a, b) => a.lesson_number - b.lesson_number).map((lesson, lessonIndex) => <tr className={`admin-lesson-child-row ${closing ? 'is-closing' : 'is-opening'}`} style={{ animationDelay: closing ? '0ms' : `${Math.min(lessonIndex * 24, 120)}ms` }} key={lesson.id}><td></td><td><span className="admin-child-lesson"><span className="admin-child-line" />Bài {lesson.lesson_number}</span></td><td><b>{lesson.title_ko}</b>{lesson.title_vi && <small>{lesson.title_vi}</small>}</td><td><span className="admin-group-count">Bài {lesson.lesson_number}</span></td><td><AdminSelect value={lesson.status} options={statuses} label={`Trạng thái bài ${lesson.lesson_number}`} onChange={(value) => void updateStatus('lessons', lesson.id, value as Status)} /></td><td><div className="admin-actions"><button className="view" onClick={() => setPreviewLesson(lesson)} aria-label="Xem bài học"><Eye size={17} /></button><button onClick={() => openEditor('lessons', lesson)} aria-label="Sửa bài học"><Pencil size={17} /></button><button className="danger" onClick={() => void deleteItem('lessons', lesson)} aria-label="Xóa bài học"><Trash2 size={17} /></button></div></td></tr>)}
              </Fragment>
            })}
          </tbody></table></div>
          {!filteredLessons.length && <div className="admin-empty">Không tìm thấy bài học phù hợp.</div>}
        </>}
        {tab === 'exercises' && <AdminExercises />}
        {tab === 'community' && <div className="admin-community-workspace">
          <div className="admin-community-overview">
            <button className="urgent" onClick={() => { setCommunityView('queue'); setCommunityStatus('all') }}><span><Flag size={20} /></span><div><strong>{pendingCommunityReports.length}</strong><small>Báo cáo chờ xử lý</small></div></button>
            <button onClick={() => { setCommunityView('posts'); setCommunityStatus('all') }}><span><MessageSquare size={20} /></span><div><strong>{community.posts.length}</strong><small>Tổng bài viết</small></div></button>
            <button onClick={() => { setCommunityView('vocabulary'); setCommunityStatus('all') }}><span><BookOpen size={20} /></span><div><strong>{community.customLessons.length}</strong><small>Bộ từ vựng</small></div></button>
            <article><span><EyeOff size={20} /></span><div><strong>{community.posts.filter((post) => post.status === 'hidden').length + community.customLessons.filter((lesson) => lesson.status === 'hidden').length}</strong><small>Nội dung đã ẩn</small></div></article>
          </div>

          <div className="admin-community-nav" role="tablist" aria-label="Loại nội dung cộng đồng">
            <button className={communityView === 'queue' ? 'active' : ''} onClick={() => { setCommunityView('queue'); setCommunityStatus('all') }}><Flag size={17} /> Cần xử lý {pendingCommunityReports.length > 0 && <b>{pendingCommunityReports.length}</b>}</button>
            <button className={communityView === 'posts' ? 'active' : ''} onClick={() => { setCommunityView('posts'); setCommunityStatus('all') }}><MessageSquare size={17} /> Bài viết</button>
            <button className={communityView === 'vocabulary' ? 'active' : ''} onClick={() => { setCommunityView('vocabulary'); setCommunityStatus('all') }}><BookOpen size={17} /> Bộ từ vựng</button>
          </div>

          <div className="admin-community-commandbar">
            <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={communityView === 'vocabulary' ? 'Tìm tên bộ từ, mã hoặc người tạo…' : 'Tìm nội dung hoặc người đăng…'} /></label>
            {communityView !== 'queue' && <AdminSelect value={communityStatus} options={[{ value: 'all', label: 'Tất cả trạng thái' }, { value: 'reported', label: 'Có báo cáo chờ xử lý' }, { value: 'visible', label: 'Đang hiển thị' }, { value: 'hidden', label: 'Đã ẩn' }]} label="Lọc trạng thái nội dung" onChange={setCommunityStatus} />}
            <span>{communityView === 'queue' ? pendingCommunityPosts.length + pendingCommunityVocabulary.length : communityView === 'posts' ? filteredCommunityPosts.length : filteredCommunityVocabulary.length} mục</span>
          </div>
          <div className="admin-community-date-filters">
            <span className="admin-date-filter-label"><CalendarDays size={17} /> Thời gian đăng</span>
            <AdminSelect value={communityDay} options={[{ value: 'all', label: 'Tất cả ngày' }, ...Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: `Ngày ${index + 1}` }))]} label="Lọc theo ngày đăng" onChange={setCommunityDay} />
            <AdminSelect value={communityMonth} options={[{ value: 'all', label: 'Tất cả tháng' }, ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` }))]} label="Lọc theo tháng đăng" onChange={setCommunityMonth} />
            <AdminSelect value={communityYear} options={[{ value: 'all', label: 'Tất cả năm' }, ...communityYears.map((year) => ({ value: String(year), label: `Năm ${year}` }))]} label="Lọc theo năm đăng" onChange={setCommunityYear} />
            {(communityDay !== 'all' || communityMonth !== 'all' || communityYear !== 'all') && <button type="button" className="admin-clear-date-filter" onClick={() => { setCommunityDay('all'); setCommunityMonth('all'); setCommunityYear('all') }}><RotateCcw size={15} /> Xóa lọc</button>}
          </div>

          {(communityView === 'queue' || communityView === 'posts') && <section className="admin-community-section">
            <div className="admin-community-section-title"><div><MessageSquare size={18} /><span><h3>{communityView === 'queue' ? 'Bài viết bị báo cáo' : 'Danh sách bài viết'}</h3><p>{communityView === 'queue' ? 'Ưu tiên xem lý do báo cáo trước khi xử lý nội dung.' : 'Kiểm soát hiển thị, bình luận và nội dung bài viết.'}</p></span></div><b>{displayedCommunityPosts.length}</b></div>
            <div className="admin-community-list">{displayedCommunityPosts.map((post) => {
              const pendingReports = post.reports.filter((report) => report.status === 'pending')
              return <article className={`admin-community-post${post.status === 'hidden' ? ' is-hidden' : ''}${pendingReports.length ? ' has-reports' : ''}`} key={post.id}>
                <div className="admin-community-head"><div className="admin-community-author"><span>{(post.profiles?.display_name || '?').slice(0, 1).toUpperCase()}</span><div><b>{post.profiles?.display_name || 'Người học'}</b><small>{new Date(post.created_at).toLocaleString('vi-VN')}</small></div></div><div className="admin-community-badges">{post.status === 'hidden' ? <span className="hidden"><EyeOff size={13} /> Đã ẩn</span> : <span className="visible"><Eye size={13} /> Đang hiển thị</span>}{post.comments_locked && <span className="locked"><Lock size={13} /> Khóa bình luận</span>}{pendingReports.length > 0 && <span className="reported"><Flag size={13} /> {pendingReports.length} báo cáo</span>}</div></div>
                <p className="admin-community-content">{post.content}</p>
                {pendingReports.length > 0 && <div className="admin-report-list"><header><Flag size={15} /><b>Lý do báo cáo</b></header>{pendingReports.map((report) => <div className="admin-report-item" key={report.id}><div><b>{report.profiles?.display_name || 'Người dùng'} báo cáo</b><p>{report.reason}</p><small>{new Date(report.created_at).toLocaleString('vi-VN')}</small></div><div><button onClick={() => void resolveReport(report, 'dismissed')}>Bỏ qua</button><button className="resolve" onClick={() => void resolveReport(report, 'resolved')}><Check size={15} /> Đã xử lý</button></div></div>)}</div>}
                <div className="admin-community-actions"><button onClick={() => void moderatePost(post, { hidden: post.status !== 'hidden' })}>{post.status === 'hidden' ? <Eye size={16} /> : <EyeOff size={16} />}{post.status === 'hidden' ? 'Hiện lại' : 'Ẩn bài'}</button><button onClick={() => void moderatePost(post, { commentsLocked: !post.comments_locked })}>{post.comments_locked ? <Unlock size={16} /> : <Lock size={16} />}{post.comments_locked ? 'Mở bình luận' : 'Khóa bình luận'}</button><button className="danger" onClick={() => void deleteCommunityPost(post)}><Trash2 size={16} /> Xóa bài</button></div>
              </article>
            })}</div>
            {!displayedCommunityPosts.length && <div className="admin-community-empty"><Check size={22} /><b>{communityView === 'queue' ? 'Không có bài viết cần xử lý' : 'Không tìm thấy bài viết'}</b><span>Hãy thử thay đổi từ khóa hoặc bộ lọc hiện tại.</span></div>}
          </section>}

          {(communityView === 'queue' || communityView === 'vocabulary') && <section className="admin-community-section">
            <div className="admin-community-section-title"><div><BookOpen size={18} /><span><h3>{communityView === 'queue' ? 'Bộ từ vựng bị báo cáo' : 'Danh sách bộ từ vựng'}</h3><p>Kiểm tra người tạo, số lượng từ và trạng thái chia sẻ.</p></span></div><b>{displayedCommunityVocabulary.length}</b></div>
            <div className="admin-community-list">{displayedCommunityVocabulary.map((lesson) => {
              const pendingReports = community.reports.filter((report) => report.custom_lesson_id === lesson.id && report.status === 'pending')
              return <article className={`admin-community-post admin-vocabulary-card${lesson.status === 'hidden' ? ' is-hidden' : ''}${pendingReports.length ? ' has-reports' : ''}`} key={lesson.id}>
                <div className="admin-community-head"><div className="admin-community-author"><span>{(lesson.title || '?').slice(0, 1).toUpperCase()}</span><div><b>{lesson.title}</b><small>Tạo bởi {lesson.profiles?.display_name || 'Người học'} · {new Date(lesson.created_at).toLocaleDateString('vi-VN')}</small></div></div><div className="admin-community-badges"><span>{lesson.visibility === 'private' ? 'Riêng tư' : 'Công khai'}</span>{lesson.status === 'hidden' ? <span className="hidden"><EyeOff size={13} /> Đã ẩn</span> : <span className="visible"><Eye size={13} /> Đang hiển thị</span>}{pendingReports.length > 0 && <span className="reported"><Flag size={13} /> {pendingReports.length} báo cáo</span>}</div></div>
                <div className="admin-vocabulary-meta"><span><strong>{lesson.words?.length || 0}</strong> từ vựng</span><span>Mã chia sẻ <strong>{lesson.code}</strong></span></div>
                {pendingReports.length > 0 && <div className="admin-report-list"><header><Flag size={15} /><b>Lý do báo cáo</b></header>{pendingReports.map((report) => <div className="admin-report-item" key={report.id}><div><b>{report.profiles?.display_name || 'Người dùng'} báo cáo</b><p>{report.reason}</p><small>{new Date(report.created_at).toLocaleString('vi-VN')}</small></div><div><button onClick={() => void resolveReport(report, 'dismissed')}>Bỏ qua</button><button className="resolve" onClick={() => void resolveReport(report, 'resolved')}><Check size={15} /> Đã xử lý</button></div></div>)}</div>}
                <div className="admin-community-actions"><button onClick={() => void moderateVocabularySet(lesson)}>{lesson.status === 'hidden' ? <Eye size={16} /> : <EyeOff size={16} />}{lesson.status === 'hidden' ? 'Hiện lại' : 'Ẩn bộ từ vựng'}</button></div>
              </article>
            })}</div>
            {!displayedCommunityVocabulary.length && <div className="admin-community-empty"><Check size={22} /><b>{communityView === 'queue' ? 'Không có bộ từ vựng cần xử lý' : 'Không tìm thấy bộ từ vựng'}</b><span>Hãy thử thay đổi từ khóa hoặc bộ lọc hiện tại.</span></div>}
          </section>}
        </div>}
        {tab === 'users' && <>
          <div className="admin-panel-title"><div><h2>Người dùng</h2><p>Quản lý vai trò và khóa tài khoản vi phạm.</p></div></div>
          <div className="admin-toolbar admin-toolbar-with-filters">
            <label><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, email hoặc mã người dùng…" aria-label="Tìm kiếm người dùng" /></label>
            <div className="admin-filter-controls"><span>{filteredUsers.length} người dùng</span></div>
          </div>
          <div className="admin-table-wrap"><table><thead><tr><th>Học viên</th><th>Email</th><th>Vai trò</th><th>Cấp / XP</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th>Thao tác</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id} className={user.is_locked ? 'admin-user-locked' : ''}><td><b>{user.display_name || 'Người học'}</b></td><td>{user.email || '—'}</td><td><AdminSelect value={user.role} options={[{ value: 'user', label: 'Học viên' }, { value: 'admin', label: 'Admin' }]} label={`Vai trò của ${user.display_name || user.email}`} onChange={(value) => void updateRole(user.id, value as 'user' | 'admin')} /></td><td>Lv. {user.level || 1} · {user.xp || 0} XP</td><td><span className={`admin-account-state ${user.is_locked ? 'locked' : 'active'}`}>{user.is_locked ? <Lock size={14}/> : <ShieldCheck size={14}/>} {user.is_locked ? 'Đã khóa' : 'Hoạt động'}</span></td><td>{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString('vi-VN') : 'Chưa có'}</td><td><button className={`admin-lock-action ${user.is_locked ? 'unlock' : ''}`} onClick={() => void updateAccountLock(user)}>{user.is_locked ? <Unlock size={16}/> : <Lock size={16}/>} {user.is_locked ? 'Mở khóa' : 'Khóa'}</button></td></tr>)}</tbody></table></div>
          {!filteredUsers.length && <div className="admin-empty">Không tìm thấy người dùng phù hợp.</div>}
        </>}
      </section>}
      {previewLesson && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewLesson(null) }}><section className="admin-modal admin-preview-modal" role="dialog" aria-modal="true" aria-labelledby="admin-preview-title"><header><div><span><Eye size={22} /></span><div><h2 id="admin-preview-title">Xem bài học</h2><p>Thông tin đang hiển thị cho bài học đã chọn.</p></div></div><button onClick={() => setPreviewLesson(null)} aria-label="Đóng"><X size={21} /></button></header><div className="admin-lesson-preview"><div className="admin-preview-number">Bài {previewLesson.lesson_number}</div><div className="admin-preview-copy"><span className={`admin-status ${previewLesson.status}`}>{statuses.find((item) => item.value === previewLesson.status)?.label}</span><small>Giáo trình</small><p>{previewLesson.textbooks?.title_ko || textbooks.find((book) => book.id === previewLesson.textbook_id)?.title_ko || '—'}</p><small>Tiêu đề tiếng Hàn</small><h3>{previewLesson.title_ko}</h3><small>Tiêu đề tiếng Việt</small><p>{previewLesson.title_vi || 'Chưa có tiêu đề tiếng Việt'}</p></div></div><footer><button className="admin-cancel" onClick={() => setPreviewLesson(null)}>Đóng</button><button className="admin-primary" onClick={() => { const lesson = previewLesson; setPreviewLesson(null); openEditor('lessons', lesson) }}><Pencil size={17} /> Chỉnh sửa bài học</button></footer></section></div>}
      {editor && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title"><header><div><span>{editor.kind === 'textbooks' ? <BookOpen size={22} /> : <BookText size={22} />}</span><div><h2 id="admin-editor-title">{editor.id ? 'Chỉnh sửa' : 'Thêm'} {editor.kind === 'textbooks' ? 'giáo trình' : 'bài học'}</h2><p>Những trường có dấu * là bắt buộc.</p></div></div><button onClick={() => setEditor(null)} aria-label="Đóng"><X size={21} /></button></header><div className="admin-form">
        {editor.kind === 'textbooks' ? <><label>Slug *<input value={draft.slug || ''} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="vi-du: sejong-2-1" /></label><label>Tên tiếng Hàn *<input value={draft.titleKo || ''} onChange={(e) => setDraft({ ...draft, titleKo: e.target.value })} /></label><label>Tên tiếng Việt<input value={draft.titleVi || ''} onChange={(e) => setDraft({ ...draft, titleVi: e.target.value })} /></label><label>Thứ tự<input type="number" min="0" value={draft.sortOrder || '0'} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></label><label className="wide">Mô tả<textarea rows={3} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label></> : <><label className="wide">Giáo trình *<AdminSelect value={draft.textbookId || ''} options={textbooks.map((book) => ({ value: book.id, label: book.title_ko }))} onChange={(value) => setDraft({ ...draft, textbookId: value })} /></label><label>Số bài *<input type="number" min="1" value={draft.lessonNumber || '1'} onChange={(e) => setDraft({ ...draft, lessonNumber: e.target.value })} /></label><label>Tên tiếng Hàn *<input value={draft.titleKo || ''} onChange={(e) => setDraft({ ...draft, titleKo: e.target.value })} /></label><label className="wide">Tên tiếng Việt<input value={draft.titleVi || ''} onChange={(e) => setDraft({ ...draft, titleVi: e.target.value })} /></label></>}
        <label className="wide">Trạng thái<AdminSelect value={draft.status || 'draft'} options={statuses} onChange={(value) => setDraft({ ...draft, status: value })} /></label>
      </div><footer><button className="admin-cancel" onClick={() => setEditor(null)}>Hủy</button><button className="admin-primary" onClick={() => void saveEditor()} disabled={saving}><Save size={18} /> {saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></footer></section></div>}
    </main>
  </div>
}

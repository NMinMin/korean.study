import { useEffect, useMemo, useState } from 'react';
import { NotebookPen, ChevronLeft, BookOpen, Plus, Star, Type, Volume2, Search, Filter, BookMarked } from 'lucide-react';
import { GRAMMAR_SAMPLE, VOCAB_SAMPLE, FALLBACK_LESSONS } from '../../data/fallbackData';
import { playVocabularyAudio } from '../../services/audioService';
import { loadRemoteVocabularyStateForWords, saveRemoteVocabularyStateForWords } from '../../lib/vocabularyProgress';

const normalizeSearchText = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export function GrammarHubView({
  onBack,
  onAddBook,
  onOpenVocabularySets,
  books = [],
  vocabulary = [],
  grammar = [],
  userId,
  initialStarredOnly = false,
  onStarredOnlyChange,
}) {
  const [tab, setTab] = useState('vocab');
  const [vocabState, setVocabState] = useState({});
  const [starredOnly, setStarredOnly] = useState(initialStarredOnly);
  const [query, setQuery] = useState('');
  const [textbookFilter, setTextbookFilter] = useState('all');
  const identifiedWords = useMemo(() => vocabulary
    .filter((item) => item?.id && item?.lessonId && item?.textbookId)
    .map((item) => ({ id: item.id, word: item.word, lessonId: item.lessonId, textbookId: item.textbookId })), [vocabulary]);
  const addedTextbookIds = useMemo(() => new Set(books.map((book) => book?.id).filter(Boolean)), [books]);
  const textbookById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const scopedVocabulary = useMemo(() => {
    const source = vocabulary.length ? vocabulary : (books.length ? VOCAB_SAMPLE : []);
    if (!books.length) return [];
    if (!addedTextbookIds.size) return source;
    return source.filter((item) => !item?.textbookId || addedTextbookIds.has(item.textbookId));
  }, [addedTextbookIds, books.length, vocabulary]);
  const scopedGrammar = useMemo(() => {
    const source = grammar.length ? grammar : (books.length ? GRAMMAR_SAMPLE : []);
    if (!books.length) return [];
    if (!addedTextbookIds.size) return source;
    return source.filter((item) => !item?.textbookId || addedTextbookIds.has(item.textbookId));
  }, [addedTextbookIds, books.length, grammar]);
  const normalizedQuery = useMemo(() => normalizeSearchText(query), [query]);
  const matchesTextbook = (item) => (
    textbookFilter === 'all'
    || item?.textbookId === textbookFilter
    || (!item?.textbookId && !vocabulary.length && !grammar.length)
  );
  const visibleVocabulary = useMemo(() => scopedVocabulary.filter((item) => {
    if (!matchesTextbook(item)) return false;
    if (starredOnly && !vocabState[item.word]?.starred) return false;
    if (!normalizedQuery) return true;
    const book = item?.textbookId ? textbookById.get(item.textbookId) : null;
    const haystack = normalizeSearchText([
      item?.word,
      item?.meaningVi,
      item?.pronunciation,
      item?.partOfSpeech,
      item?.lessonNo ? `bai ${item.lessonNo}` : '',
      book?.title || book?.titleKo || book?.titleVi,
    ].filter(Boolean).join(' '));
    return haystack.includes(normalizedQuery);
  }), [scopedVocabulary, textbookFilter, normalizedQuery, textbookById, vocabulary.length, grammar.length, starredOnly, vocabState]);
  const starredCount = useMemo(
    () => scopedVocabulary.filter((item) => vocabState[item.word]?.starred).length,
    [scopedVocabulary, vocabState],
  );
  const visibleGrammar = useMemo(() => scopedGrammar.filter((item) => {
    if (!matchesTextbook(item)) return false;
    if (!normalizedQuery) return true;
    const book = item?.textbookId ? textbookById.get(item.textbookId) : null;
    const haystack = normalizeSearchText([
      item?.pattern,
      item?.translation,
      item?.context,
      item?.usage,
      item?.lessonNo ? `bai ${item.lessonNo}` : '',
      book?.title || book?.titleKo || book?.titleVi,
    ].filter(Boolean).join(' '));
    return haystack.includes(normalizedQuery);
  }), [scopedGrammar, textbookFilter, normalizedQuery, textbookById, vocabulary.length, grammar.length]);

  useEffect(() => {
    let alive = true;
    if (!userId || !identifiedWords.length) return undefined;
    loadRemoteVocabularyStateForWords(identifiedWords, userId).then((state) => {
      if (alive && state) setVocabState(state);
    }).catch(() => {});
    return () => { alive = false; };
  }, [userId, identifiedWords]);

  const toggleStar = async (item) => {
    const current = vocabState[item.word] || {};
    const updatedItem = { ...current, starred: !current.starred };
    setVocabState((state) => ({ ...state, [item.word]: updatedItem }));
    if (item.id && item.lessonId && item.textbookId) {
      await saveRemoteVocabularyStateForWords(
        [{ id: item.id, word: item.word, lessonId: item.lessonId, textbookId: item.textbookId }],
        userId,
        { [item.word]: updatedItem },
      );
    }
  };

  return (
    <section className="cg-page wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><NotebookPen size={18} color="#3FA95C" /> Từ vựng &amp; Ngữ pháp</span>
        </div>
      </div>
      <p className="cg-sub" style={{ marginTop: 0 }}>Tra cứu từ vựng và ngữ pháp thuộc những giáo trình bạn đã thêm.</p>
      {!books.length ? (
        <div className="curriculum-empty grammar-empty">
          <NotebookPen size={28} />
          <b>Bạn chưa có giáo trình</b>
          <span>Thêm giáo trình trước để xem từ vựng và ngữ pháp theo đúng nội dung đang học.</span>
          <button type="button" className="curriculum-empty-action" onClick={onAddBook}><Plus size={15} /> Thêm giáo trình</button>
        </div>
      ) : (
        <>
          <div className="content-library-controls content-library-controls-with-notebook">
            <label className="content-library-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm từ vựng, nghĩa, mẫu ngữ pháp..."
                aria-label="Tìm kiếm từ vựng và ngữ pháp"
              />
            </label>
            <label className="content-library-filter">
              <Filter size={16} />
              <select value={textbookFilter} onChange={(event) => setTextbookFilter(event.target.value)} aria-label="Lọc theo giáo trình">
                <option value="all">Tất cả giáo trình đã thêm</option>
                {books.map((book) => (
                  <option key={book.id || book.title} value={book.id}>{book.title || book.titleKo || book.titleVi || 'Giáo trình'}</option>
                ))}
              </select>
            </label>
            <div className="content-library-quick-actions">
              <button
                type="button"
                className={`content-library-starred-filter ${starredOnly ? 'on' : ''}`}
                onClick={() => {
                  const nextValue = !starredOnly;
                  setStarredOnly(nextValue);
                  onStarredOnlyChange?.(nextValue);
                  setTab('vocab');
                }}
                aria-pressed={starredOnly}
                title={starredOnly ? 'Hiện lại tất cả từ vựng' : 'Chỉ hiện các từ đã đánh dấu sao'}
              >
                <BookMarked size={16} /> Sổ tay từ vựng <span>{starredCount}</span>
              </button>
              <button type="button" className="cg-post-btn content-library-notebook-btn" onClick={onOpenVocabularySets}>
                <BookOpen size={16} /> Bộ từ vựng
              </button>
            </div>
          </div>
          <div className="fc2-content-tabs content-library-tabs" role="tablist" aria-label="Chọn loại nội dung">
            <button className={`fc2-content-tab ${tab === 'vocab' ? 'on' : ''}`} onClick={() => setTab('vocab')} role="tab" aria-selected={tab === 'vocab'}>
              <Type size={15} /> Từ vựng <span className="fc2-content-tab-count">{visibleVocabulary.length}</span>
            </button>
            <button className={`fc2-content-tab ${tab === 'grammar' ? 'on' : ''}`} onClick={() => setTab('grammar')} role="tab" aria-selected={tab === 'grammar'}>
              <NotebookPen size={15} /> Ngữ pháp <span className="fc2-content-tab-count">{visibleGrammar.length}</span>
            </button>
          </div>
          {tab === 'vocab' ? (
            <div className="vl-list content-library-list">
              {visibleVocabulary.length ? visibleVocabulary.map((item, index) => {
                const starred = Boolean(vocabState[item.word]?.starred);
                return (
                  <div className="vl-row" key={item.id || `${item.word}-${index}`}>
                    <div className="vl-main">
                      <span className="vl-ko" lang="ko">{item.word}</span>
                      <span className="vl-vi">{item.meaningVi}</span>
                    </div>
                    <button className="vl-audio" onClick={() => playVocabularyAudio(item)} aria-label={`Nghe phát âm ${item.word}`}><Volume2 size={15} /></button>
                    <button className={`vl-star ${starred ? 'on' : ''}`} onClick={() => toggleStar(item)} aria-label={starred ? 'Bỏ đánh dấu từ khó' : 'Đánh dấu từ khó'}>
                      <Star size={16} fill={starred ? '#F0C24E' : 'none'} color={starred ? '#F0C24E' : '#C9BCF2'} />
                    </button>
                  </div>
                );
              }) : (
                <div className="content-library-empty">
                  {starredOnly
                    ? 'Hãy bấm biểu tượng ngôi sao ở danh sách từ vựng để lưu những từ bạn muốn ôn lại.'
                    : 'Không tìm thấy từ vựng phù hợp với bộ lọc hiện tại.'}
                </div>
              )}
            </div>
          ) : (
            <div className="grammar-catalog-list content-library-list">
              {visibleGrammar.length ? visibleGrammar.map((item, index) => (
                <article key={item.id || item.no || index} className="grammar-catalog-card content-library-grammar-card">
                  <span className="grammar-catalog-number">{index + 1}</span>
                  <span className="grammar-catalog-content">
                    <b lang="ko">{item.pattern}</b>
                    <small>{item.translation || item.meaningVi}</small>
                    <span>{item.context || item.usageVi || item.notesVi}</span>
                  </span>
                  <span className="grammar-catalog-book"><BookOpen size={13} /> Bài {item.lessonNo || item.no || 1}</span>
                </article>
              )) : <div className="content-library-empty">Không tìm thấy mẫu ngữ pháp phù hợp với bộ lọc hiện tại.</div>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function GrammarBookView({ onBack, onSelectLesson, lessons = FALLBACK_LESSONS, grammar = GRAMMAR_SAMPLE, textbookTitle = 'Giáo trình tiếng Hàn' }) {
  return (
    <section className="cg-page wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về danh sách giáo trình"><ChevronLeft size={20} /></button>
          <span className="fc2-title" lang="ko"><NotebookPen size={18} color="#3FA95C" /> {textbookTitle} — Ngữ pháp</span>
        </div>
      </div>
      <p className="cg-sub" style={{ marginTop: 0 }}>Chọn bài để xem các mẫu ngữ pháp được tổng hợp trong bài đó.</p>
      <div className="gm-lesson-list">
        {lessons.map((l, i) => {
          const count = grammar.filter((item) => item.lessonId ? item.lessonId === l.id : i === 0).length;
          const hasContent = l.status !== 'locked' && count > 0;
          return (
            <button
              key={l.no}
              className={`gm-lesson-row ${hasContent ? 'has' : 'soon'}`}
              onClick={() => hasContent && onSelectLesson(i)}
              disabled={!hasContent}
            >
              <span className="gm-lesson-no">{l.no}</span>
              <div className="gm-lesson-body">
                <b>Bài {l.no}</b>
                <span lang="ko">{l.title}</span>
              </div>
              <span className="gm-lesson-count">
                {hasContent ? `${count} mẫu ngữ pháp` : 'Chưa có nội dung'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

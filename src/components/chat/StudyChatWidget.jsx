import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  MessageCircleQuestion,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  CHAT_MODEL_OPTIONS,
  deleteMyGeminiKey,
  getMyGeminiKeyStatus,
  saveMyGeminiKey,
  streamStudyChat,
} from '../../services/chatService';
import './study-chat.css';

const STORAGE_VERSION = 1;
const MAX_STORED_MESSAGES = 40;

export function askStudyAI(payload) {
  window.dispatchEvent(new CustomEvent('kstudy:ask-ai', { detail: payload }));
}

function chatStorageKey(userId) {
  return `kstudy:ai-chat:${userId || 'guest'}`;
}

function loadStoredChat(userId) {
  try {
    const raw = localStorage.getItem(chatStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== STORAGE_VERSION) return null;
    return {
      modelKey: parsed.modelKey === 'deep' ? 'deep' : 'fast',
      interactionId: typeof parsed.interactionId === 'string' ? parsed.interactionId : null,
      messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-MAX_STORED_MESSAGES) : [],
    };
  } catch {
    return null;
  }
}

function saveStoredChat(userId, state) {
  try {
    const cleanMessages = (state.messages || [])
      .filter((msg) => msg && !msg.streaming)
      .slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(chatStorageKey(userId), JSON.stringify({
      v: STORAGE_VERSION,
      modelKey: state.modelKey === 'deep' ? 'deep' : 'fast',
      interactionId: state.interactionId || null,
      messages: cleanMessages,
    }));
  } catch {
    // Ignore storage quota errors
  }
}

function renderInlineFormatting(text, keyPrefix) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-b-${idx}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={`${keyPrefix}-i-${idx}`}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={`${keyPrefix}-c-${idx}`} className="ks-chat-inline-code">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
  });
}

function FormattedMessage({ text }) {
  const lines = String(text || '').split('\n');
  const elements = [];
  let listItems = [];
  let paraLines = [];

  const flushList = (key) => {
    if (!listItems.length) return;
    elements.push(
      <ul key={key} className="ks-chat-list">
        {listItems.map((item, idx) => (
          <li key={`${key}-li-${idx}`}>{renderInlineFormatting(item, `${key}-li-${idx}`)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  const flushPara = (key) => {
    if (!paraLines.length) return;
    elements.push(
      <p key={key} className="ks-chat-para">
        {paraLines.map((line, idx) => (
          <React.Fragment key={`${key}-p-${idx}`}>
            {idx > 0 && <br />}
            {renderInlineFormatting(line, `${key}-p-${idx}`)}
          </React.Fragment>
        ))}
      </p>,
    );
    paraLines = [];
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushPara(`p-${idx}`);
      flushList(`ul-${idx}`);
      return;
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushPara(`p-${idx}`);
      flushList(`ul-${idx}`);
      elements.push(
        <div key={`h-${idx}`} className="ks-chat-heading">
          {renderInlineFormatting(headingMatch[1], `h-${idx}`)}
        </div>,
      );
      return;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      flushPara(`p-${idx}`);
      listItems.push(bulletMatch[1]);
      return;
    }

    flushList(`ul-${idx}`);
    paraLines.push(rawLine);
  });

  flushPara('p-end');
  flushList('ul-end');

  return <div className="ks-chat-rich-text">{elements}</div>;
}

function buildSuggestions(activeView, lesson) {
  const lessonLabel = lesson?.title ? `bài "${lesson.title}"` : 'bài này';
  if (activeView === 'review-result') {
    return [
      'Tổng hợp giúp mình các lỗi dễ gặp khi ôn tập',
      'Phân biệt trợ từ 은/는 và 이/가 dễ nhớ nhất',
      'Mẹo ghi nhớ từ vựng tiếng Hàn nhanh hơn',
    ];
  }
  return [
    `Tóm tắt nhanh trọng tâm ngữ pháp của ${lessonLabel}`,
    'Phân biệt giúp mình cách chia đuôi câu -아/어요',
    'Cho mình 3 câu ví dụ giao tiếp tự nhiên với từ vựng bài này',
  ];
}

function buildLessonContentSummary(vocabulary = [], grammar = []) {
  const sections = [];
  const vocabLines = (Array.isArray(vocabulary) ? vocabulary : [])
    .filter((item) => item?.word)
    .slice(0, 45)
    .map((item) => `- ${item.word}: ${item.meaningVi || item.meaning || ''}`.trim());
  if (vocabLines.length) {
    sections.push(`Từ vựng trong bài (${vocabLines.length} mục):\n${vocabLines.join('\n')}`);
  }

  const grammarLines = (Array.isArray(grammar) ? grammar : [])
    .filter((item) => item?.pattern)
    .slice(0, 15)
    .map((item) => {
      const desc = item.meaningVi || item.translation || item.context || item.usageVi || '';
      return `- ${item.pattern}${desc ? `: ${desc}` : ''}`;
    });
  if (grammarLines.length) {
    sections.push(`Ngữ pháp trong bài (${grammarLines.length} điểm):\n${grammarLines.join('\n')}`);
  }

  const combined = sections.join('\n\n');
  return combined.length > 5000 ? combined.slice(0, 5000) : combined;
}

export default function StudyChatWidget({
  userId,
  activeView,
  textbookTitle,
  lesson,
  vocabulary = [],
  grammar = [],
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelKey, setModelKey] = useState(() => loadStoredChat(userId)?.modelKey || 'fast');
  const [interactionId, setInteractionId] = useState(() => loadStoredChat(userId)?.interactionId || null);
  const [messages, setMessages] = useState(() => loadStoredChat(userId)?.messages || []);
  const [draft, setDraft] = useState('');
  const [attachedQuestion, setAttachedQuestion] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [keyStatus, setKeyStatus] = useState({
    loading: true,
    hasKey: false,
    hasServerKey: false,
    maskedKey: null,
    updatedAt: null,
  });
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showKeyPlain, setShowKeyPlain] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [pendingAsk, setPendingAsk] = useState(null);

  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const modelMenuRef = useRef(null);
  const stateRef = useRef({ modelKey, interactionId, messages, streaming, keyStatus });
  stateRef.current = { modelKey, interactionId, messages, streaming, keyStatus };

  const refreshKeyStatus = async () => {
    setKeyStatus((prev) => ({ ...prev, loading: true }));
    try {
      const status = await getMyGeminiKeyStatus();
      setKeyStatus({ loading: false, ...status });
      return status;
    } catch {
      setKeyStatus((prev) => ({ ...prev, loading: false }));
      return null;
    }
  };

  useEffect(() => {
    const stored = loadStoredChat(userId);
    setModelKey(stored?.modelKey || 'fast');
    setInteractionId(stored?.interactionId || null);
    setMessages(stored?.messages || []);
    setAttachedQuestion(null);
    setShowKeyPanel(false);
    setKeyError('');
    setPendingAsk(null);
    if (userId) {
      void refreshKeyStatus();
    } else {
      setKeyStatus({ loading: false, hasKey: false, hasServerKey: false, maskedKey: null, updatedAt: null });
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId && !keyStatus.hasKey && !keyStatus.hasServerKey) {
      void refreshKeyStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    saveStoredChat(userId, { modelKey, interactionId, messages });
  }, [userId, modelKey, interactionId, messages]);

  useEffect(() => {
    if (disabled && open) {
      abortRef.current?.abort();
      setOpen(false);
      setModelMenuOpen(false);
    }
  }, [disabled, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const currentModel = useMemo(
    () => CHAT_MODEL_OPTIONS.find((opt) => opt.key === modelKey) || CHAT_MODEL_OPTIONS[0],
    [modelKey],
  );

  const lessonTitle = lesson ? `${lesson.no ? `Bài ${lesson.no}: ` : ''}${lesson.title || ''}`.trim() : '';
  const lessonContent = useMemo(
    () => buildLessonContentSummary(vocabulary, grammar),
    [vocabulary, grammar],
  );

  const sendMessage = async (rawPrompt, overrides = {}) => {
    const text = String(rawPrompt || '').trim();
    if (!text || stateRef.current.streaming || disabled) return;

    const chosenModelKey = overrides.modelKey || stateRef.current.modelKey;
    const questionContext = overrides.questionContext !== undefined
      ? overrides.questionContext
      : attachedQuestion?.text || undefined;
    const contextLabel = overrides.contextLabel || attachedQuestion?.label || undefined;

    const prevInteractionId = chosenModelKey === stateRef.current.modelKey
      ? stateRef.current.interactionId
      : null;

    const recentHistory = stateRef.current.messages
      .filter((msg) => !msg.error && msg.text)
      .slice(-8)
      .map((msg) => ({ role: msg.role, text: msg.text.slice(0, 2000) }));

    const userMsgId = `u-${Date.now()}`;
    const aiMsgId = `a-${Date.now() + 1}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        text,
        contextLabel,
        createdAt: Date.now(),
      },
      {
        id: aiMsgId,
        role: 'model',
        text: '',
        modelKey: chosenModelKey,
        streaming: true,
        createdAt: Date.now(),
      },
    ]);
    setDraft('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamStudyChat({
        message: text,
        modelKey: chosenModelKey,
        previousInteractionId: prevInteractionId,
        context: {
          screen: activeView,
          textbookTitle: textbookTitle || undefined,
          lessonTitle: lessonTitle || undefined,
          lessonContent: lessonContent || undefined,
          questionContext,
        },
        history: recentHistory,
        signal: controller.signal,
        onMeta: (meta) => {
          setMessages((prev) => prev.map((msg) => (
            msg.id === aiMsgId
              ? {
                ...msg,
                modelKey: meta.modelKey || msg.modelKey,
                notice: meta.notice || msg.notice,
              }
              : msg
          )));
        },
        onReset: (resetMeta) => {
          setMessages((prev) => prev.map((msg) => (
            msg.id === aiMsgId
              ? {
                ...msg,
                text: '',
                modelKey: resetMeta.modelKey || msg.modelKey,
                notice: resetMeta.notice || msg.notice,
              }
              : msg
          )));
        },
        onDelta: (deltaText) => {
          setMessages((prev) => prev.map((msg) => (
            msg.id === aiMsgId
              ? { ...msg, text: `${msg.text}${deltaText}` }
              : msg
          )));
        },
        onDone: (doneMeta) => {
          if (doneMeta?.interactionId) {
            setInteractionId(doneMeta.interactionId);
          }
          setMessages((prev) => prev.map((msg) => (
            msg.id === aiMsgId
              ? {
                ...msg,
                streaming: false,
                modelKey: doneMeta?.modelKey || msg.modelKey,
                notice: doneMeta?.notice || msg.notice,
              }
              : msg
          )));
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        setMessages((prev) => prev.map((msg) => (
          msg.id === aiMsgId
            ? {
              ...msg,
              streaming: false,
              text: msg.text || 'Đã dừng câu trả lời.',
            }
            : msg
        )));
      } else if (error?.code === 'GEMINI_KEY_REQUIRED' || error?.code === 'GEMINI_KEY_INVALID') {
        if (error.code === 'GEMINI_KEY_REQUIRED') {
          setKeyStatus((prev) => ({ ...prev, loading: false, hasKey: false }));
        }
        setKeyError(error.message || 'Vui lòng kiểm tra lại Gemini API Key của bạn.');
        setShowKeyPanel(true);
        setMessages((prev) => prev.filter((msg) => msg.id !== aiMsgId));
      } else {
        setMessages((prev) => prev.map((msg) => (
          msg.id === aiMsgId
            ? msg.text
              ? {
                ...msg,
                streaming: false,
                notice: error?.message || 'Phản hồi bị gián đoạn giữa chừng.',
              }
              : {
                ...msg,
                streaming: false,
                error: true,
                text: error?.message || 'Không thể kết nối trợ lý AI lúc này.',
              }
            : msg
        )));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setMessages((prev) => prev.map((msg) => (
        msg.id === aiMsgId && msg.streaming ? { ...msg, streaming: false } : msg
      )));
    }
  };

  useEffect(() => {
    const handleAskEvent = (event) => {
      if (disabled) return;
      const detail = event?.detail || {};
      setOpen(true);
      if (detail.preferredModel && (detail.preferredModel === 'fast' || detail.preferredModel === 'deep')) {
        setModelKey(detail.preferredModel);
        setInteractionId(null);
      }
      if (detail.questionContext) {
        setAttachedQuestion({
          label: detail.contextLabel || 'Câu hỏi đang xem lại',
          text: detail.questionContext,
        });
      }
      if (detail.prompt) {
        const canUseChat = stateRef.current.keyStatus.hasKey || stateRef.current.keyStatus.hasServerKey;
        if (!stateRef.current.keyStatus.loading && !canUseChat) {
          setPendingAsk(detail);
          setShowKeyPanel(true);
          return;
        }
        void sendMessage(detail.prompt, {
          modelKey: detail.preferredModel,
          questionContext: detail.questionContext,
          contextLabel: detail.contextLabel,
        });
      }
    };

    window.addEventListener('kstudy:ask-ai', handleAskEvent);
    return () => window.removeEventListener('kstudy:ask-ai', handleAskEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, activeView, textbookTitle, lessonTitle]);

  if (disabled) return null;

  const handleSelectModel = (nextKey) => {
    if (nextKey !== modelKey) {
      setModelKey(nextKey);
      setInteractionId(null);
    }
    setModelMenuOpen(false);
  };

  const handleResetChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInteractionId(null);
    setAttachedQuestion(null);
    setStreaming(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  };

  const handleSaveKey = async (event) => {
    event?.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setKeyError('Vui lòng dán Gemini API Key của bạn vào ô bên trên.');
      return;
    }
    setKeySaving(true);
    setKeyError('');
    try {
      const saved = await saveMyGeminiKey(trimmed);
      setKeyStatus({ loading: false, ...saved });
      setKeyInput('');
      setShowKeyPlain(false);
      setShowKeyPanel(false);
      if (pendingAsk?.prompt) {
        const queued = pendingAsk;
        setPendingAsk(null);
        void sendMessage(queued.prompt, {
          modelKey: queued.preferredModel,
          questionContext: queued.questionContext,
          contextLabel: queued.contextLabel,
        });
      }
    } catch (error) {
      setKeyError(error?.message || 'Không thể lưu API key lúc này.');
    } finally {
      setKeySaving(false);
    }
  };

  const handleDeleteKey = async () => {
    setKeySaving(true);
    setKeyError('');
    try {
      const next = await deleteMyGeminiKey();
      setKeyStatus({ loading: false, ...next });
      if (!next?.hasServerKey) {
        setShowKeyPanel(true);
      }
    } catch (error) {
      setKeyError(error?.message || 'Không thể xóa API key lúc này.');
    } finally {
      setKeySaving(false);
    }
  };

  const suggestions = buildSuggestions(activeView, lesson);
  const canChat = keyStatus.hasKey || keyStatus.hasServerKey;
  const needsKeySetup = !keyStatus.loading && (!canChat || showKeyPanel);

  return (
    <div className="ks-chat-root">
      {open && (
        <section className="ks-chat-panel" aria-label="Trợ lý hỏi đáp tiếng Hàn">
          <header className="ks-chat-header">
            <div className="ks-chat-title-wrap">
              <span className="ks-chat-avatar">
                <Sparkles size={17} />
              </span>
              <div>
                <h2 className="ks-chat-title">Trợ lý tiếng Hàn</h2>
                <span className="ks-chat-subtitle">Hỏi đáp học tập & giải thích bài thi</span>
              </div>
            </div>
            <div className="ks-chat-header-actions">
              <button
                type="button"
                className={`ks-chat-icon-btn ${showKeyPanel ? 'active' : ''}`}
                onClick={() => { setKeyError(''); setShowKeyPanel((prev) => !prev); }}
                title={
                  keyStatus.hasKey
                    ? `API Key cá nhân: ${keyStatus.maskedKey}`
                    : keyStatus.hasServerKey
                      ? 'Đang dùng key hệ thống (bấm để thêm key riêng)'
                      : 'Cài đặt Gemini API Key'
                }
                aria-label="Cài đặt Gemini API Key"
              >
                <KeyRound size={16} />
                <span
                  className={`ks-chat-key-dot ${
                    keyStatus.hasKey ? 'ok' : keyStatus.hasServerKey ? 'shared' : 'missing'
                  }`}
                />
              </button>
              <button
                type="button"
                className="ks-chat-icon-btn"
                onClick={handleResetChat}
                title="Cuộc trò chuyện mới"
                aria-label="Cuộc trò chuyện mới"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                className="ks-chat-icon-btn"
                onClick={() => setOpen(false)}
                title="Đóng hộp chat"
                aria-label="Đóng hộp chat"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {(lessonTitle || attachedQuestion) && (
            <div className="ks-chat-context-bar">
              {lessonTitle && !attachedQuestion && (
                <span className="ks-chat-context-chip">📖 {lessonTitle}</span>
              )}
              {attachedQuestion && (
                <span className="ks-chat-context-chip active">
                  <span>📝 {attachedQuestion.label}</span>
                  <button
                    type="button"
                    className="ks-chat-chip-clear"
                    onClick={() => setAttachedQuestion(null)}
                    aria-label="Gỡ ngữ cảnh câu hỏi"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}

          <div className="ks-chat-body">
            {keyStatus.loading ? (
              <div className="ks-chat-empty">
                <p>Đang kiểm tra kết nối Gemini API Key…</p>
              </div>
            ) : needsKeySetup ? (
              <div className="ks-chat-key-panel">
                <div className="ks-chat-key-badge">
                  <KeyRound size={20} />
                </div>
                <h3>{keyStatus.hasKey ? 'Quản lý Gemini API Key' : 'Kết nối Gemini API Key cá nhân'}</h3>
                <p className="ks-chat-key-desc">
                  {keyStatus.hasKey
                    ? 'Key được mã hóa riêng cho tài khoản của bạn trên hệ thống. Bạn có thể thay key mới hoặc xóa để quay về dùng key chung.'
                    : keyStatus.hasServerKey
                      ? 'Bạn đang dùng key chung của hệ thống. Nếu muốn có hạn mức riêng (tránh quá tải khi nhiều người dùng), bạn có thể thêm Gemini API Key cá nhân:'
                      : 'Để dùng trợ lý AI miễn phí và không bị giới hạn chung với người khác, bạn cần nhập Gemini API Key cá nhân của mình:'}
                </p>

                {keyStatus.hasKey && (
                  <div className="ks-chat-key-saved">
                    <span>Đang dùng: <code>{keyStatus.maskedKey}</code></span>
                    <button
                      type="button"
                      className="ks-chat-key-delete"
                      onClick={() => void handleDeleteKey()}
                      disabled={keySaving}
                    >
                      <Trash2 size={13} /> Xóa key
                    </button>
                  </div>
                )}

                <ol className="ks-chat-key-steps">
                  <li>
                    Mở{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                      Google AI Studio <ExternalLink size={12} />
                    </a>{' '}
                    và đăng nhập tài khoản Google.
                  </li>
                  <li>Bấm <strong>Create API key</strong> → chọn project có sẵn hoặc tạo project mới.</li>
                  <li>Sao chép chuỗi key (thường bắt đầu bằng <code>AQ.</code> hoặc <code>AIza...</code>).</li>
                  <li>Dán vào ô bên dưới rồi bấm <strong>Lưu API Key</strong>.</li>
                </ol>

                <form onSubmit={handleSaveKey} className="ks-chat-key-form">
                  <div className="ks-chat-key-input-wrap">
                    <input
                      type={showKeyPlain ? 'text' : 'password'}
                      className="ks-chat-key-input"
                      value={keyInput}
                      onChange={(event) => { setKeyInput(event.target.value); setKeyError(''); }}
                      placeholder="Dán Gemini API Key (AQ.... hoặc AIza...)"
                      autoComplete="off"
                      disabled={keySaving}
                    />
                    <button
                      type="button"
                      className="ks-chat-key-toggle"
                      onClick={() => setShowKeyPlain((prev) => !prev)}
                      aria-label={showKeyPlain ? 'Ẩn API key' : 'Hiện API key'}
                    >
                      {showKeyPlain ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {keyError && <p className="ks-chat-key-error">{keyError}</p>}
                  <div className="ks-chat-key-actions">
                    {canChat && (
                      <button
                        type="button"
                        className="ks-chat-key-cancel"
                        onClick={() => { setShowKeyPanel(false); setKeyError(''); }}
                        disabled={keySaving}
                      >
                        Quay lại trò chuyện
                      </button>
                    )}
                    <button
                      type="submit"
                      className="ks-chat-key-save"
                      disabled={keySaving || !keyInput.trim()}
                    >
                      {keySaving ? 'Đang lưu…' : keyStatus.hasKey ? 'Cập nhật Key' : 'Lưu API Key'}
                    </button>
                  </div>
                </form>
              </div>
            ) : messages.length === 0 ? (
              <div className="ks-chat-empty">
                <div className="ks-chat-empty-badge">
                  <MessageCircleQuestion size={24} />
                </div>
                <h3>Bạn đang thắc mắc phần nào?</h3>
                <p>
                  Hỏi nhanh về từ vựng, ngữ pháp, cách chia đuôi câu hoặc bấm <strong>Hỏi AI</strong> ngay ở câu làm sai sau khi thi.
                </p>
                <div className="ks-chat-suggestions">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="ks-chat-suggestion-btn"
                      onClick={() => void sendMessage(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const modeLabel = msg.modelKey === 'deep' ? 'Chuyên sâu' : 'Nhanh';
                return (
                  <div key={msg.id} className={`ks-chat-msg ${msg.role === 'user' ? 'user' : 'model'}`}>
                    {msg.contextLabel && msg.role === 'user' && (
                      <div className="ks-chat-msg-context">Đính kèm: {msg.contextLabel}</div>
                    )}
                    <div className={`ks-chat-bubble ${msg.error ? 'error' : ''}`}>
                      {msg.role === 'user' ? (
                        <p className="ks-chat-para">{msg.text}</p>
                      ) : msg.text ? (
                        <FormattedMessage text={msg.text} />
                      ) : (
                        <span className="ks-chat-typing">
                          <span />
                          <span />
                          <span />
                        </span>
                      )}
                    </div>
                    {msg.role === 'model' && !msg.streaming && (
                      <div className="ks-chat-msg-meta">
                        <span className={`ks-chat-mode-tag ${msg.modelKey === 'deep' ? 'deep' : 'fast'}`}>
                          {modeLabel}
                        </span>
                        {msg.notice && <span className="ks-chat-notice">{msg.notice}</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {canChat && !showKeyPanel && (
          <footer className="ks-chat-footer">
            <div className="ks-chat-toolbar" ref={modelMenuRef}>
              <button
                type="button"
                className="ks-chat-model-btn"
                onClick={() => setModelMenuOpen((prev) => !prev)}
                disabled={streaming}
                aria-expanded={modelMenuOpen}
              >
                <Sparkles size={13} />
                <span>{currentModel.label}</span>
                <ChevronDown size={14} />
              </button>

              {modelMenuOpen && (
                <div className="ks-chat-model-menu" role="menu">
                  {CHAT_MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`ks-chat-model-opt ${opt.key === modelKey ? 'active' : ''}`}
                      onClick={() => handleSelectModel(opt.key)}
                      role="menuitemradio"
                      aria-checked={opt.key === modelKey}
                    >
                      <div className="ks-chat-model-opt-info">
                        <strong>{opt.label}</strong>
                        <span>{opt.subtitle}</span>
                      </div>
                      {opt.key === modelKey && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="ks-chat-input-row">
              <textarea
                ref={textareaRef}
                className="ks-chat-input"
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi tiếng Hàn..."
                disabled={streaming}
              />
              {streaming ? (
                <button
                  type="button"
                  className="ks-chat-send-btn stop"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Dừng trả lời"
                  title="Dừng trả lời"
                >
                  <Square size={15} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  className="ks-chat-send-btn"
                  onClick={() => void sendMessage(draft)}
                  disabled={!draft.trim()}
                  aria-label="Gửi câu hỏi"
                  title="Gửi câu hỏi"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </footer>
          )}
        </section>
      )}

      <button
        type="button"
        className={`ks-chat-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
      >
        {open ? <X size={22} /> : <Sparkles size={21} />}
        {!open && <span>Hỏi AI</span>}
      </button>
    </div>
  );
}

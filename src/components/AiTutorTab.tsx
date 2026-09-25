import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, Trash2, User, BookmarkPlus, Check, X } from 'lucide-react';
import { createEnglishTutorChat, TutorHistoryItem } from '../lib/geminiTutor';
import { AiTutorMessage, KeyExpression } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  clearAiTutorMessagesFromFirestore,
  saveAiTutorMessagesToFirestore,
  subscribeToAiTutorMessages,
} from '../lib/firestoreService';

interface AiTutorTabProps {
  currentDate: string;
  onAddExpression: (
    item: Omit<KeyExpression, 'id' | 'createdAt'>
  ) => Promise<KeyExpression> | KeyExpression;
  onStartPractice: (expression: KeyExpression) => void;
}

const STORAGE_KEY = 'ai_tutor_messages_v1';
const MAX_SAVED_MESSAGES = 30;

function loadSavedMessages(): AiTutorMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_SAVED_MESSAGES) : [];
  } catch {
    return [];
  }
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\`[^\`]+\`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1 py-0.5 rounded bg-white/80 border border-slate-200 font-mono text-[0.95em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

const MarkdownAnswer: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, index) => {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();

        if (!trimmed) return <div key={index} className="h-1" />;
        if (/^---+$/.test(trimmed)) return <hr key={index} className="my-2 border-slate-300/70" />;

        const h3 = trimmed.match(/^###\s+(.+)/);
        if (h3) {
          return (
            <h3 key={index} className="font-bold text-slate-900 pt-1.5">
              {renderInlineMarkdown(h3[1])}
            </h3>
          );
        }

        const h2 = trimmed.match(/^##\s+(.+)/);
        if (h2) {
          return (
            <h2 key={index} className="font-bold text-sm sm:text-base text-slate-900 pt-1.5">
              {renderInlineMarkdown(h2[1])}
            </h2>
          );
        }

        const quote = trimmed.match(/^>\s?(.*)/);
        if (quote) {
          return (
            <div key={index} className="border-l-2 border-indigo-300 pl-2.5 py-0.5 text-slate-700 bg-white/40 rounded-r">
              {renderInlineMarkdown(quote[1])}
            </div>
          );
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)/);
        if (bullet) {
          return (
            <div key={index} className="flex items-start gap-2 pl-1">
              <span className="text-indigo-500 mt-[1px]">•</span>
              <span>{renderInlineMarkdown(bullet[1])}</span>
            </div>
          );
        }

        const numbered = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (numbered) {
          return (
            <div key={index} className="flex items-start gap-2 pl-1">
              <span className="font-semibold text-indigo-600 shrink-0">{numbered[1]}.</span>
              <span>{renderInlineMarkdown(numbered[2])}</span>
            </div>
          );
        }

        return <p key={index}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
};

function extractEnglishCandidate(text: string) {
  const cleaned = text
    .replace(/\*\*/g, '')
    .replace(/^s*[>#*-]+\s*/gm, '')
    .replace(/^\s*\d+\.\s*/gm, '');

  const candidates = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 180)
    .filter((line) => /[A-Za-z]{2,}/.test(line));

  const englishHeavy = candidates.find((line) => {
    const latin = (line.match(/[A-Za-z]/g) || []).length;
    const korean = (line.match(/[가-힣]/g) || []).length;
    return latin >= 8 && latin > korean * 2;
  });

  return englishHeavy || '';
}

export const AiTutorTab: React.FC<AiTutorTabProps> = ({
  currentDate,
  onAddExpression,
  onStartPractice,
}) => {
  const { user } = useAuth();
  const initialLocalMessages = useRef<AiTutorMessage[]>(loadSavedMessages());
  const [messages, setMessages] = useState<AiTutorMessage[]>(initialLocalMessages.current);
  const messagesRef = useRef<AiTutorMessage[]>(initialLocalMessages.current);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<ReturnType<typeof createEnglishTutorChat> | null>(null);

  const [saveTargetId, setSaveTargetId] = useState<string | null>(null);
  const [saveExpression, setSaveExpression] = useState('');
  const [saveMeaning, setSaveMeaning] = useState('');
  const [saveMemo, setSaveMemo] = useState('');
  const [savedMessageId, setSavedMessageId] = useState<string | null>(null);

  const buildChat = (source: AiTutorMessage[] = messages) => {
    const history: TutorHistoryItem[] = source.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    }));
    chatRef.current = createEnglishTutorChat(history);
  };

  useEffect(() => {
    messagesRef.current = messages;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)));
    } catch {}
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    let isFirstSnapshot = true;
    let disposed = false;

    const unsubscribe = subscribeToAiTutorMessages(
      user.uid,
      (remoteMessages) => {
        if (disposed) return;

        if (isFirstSnapshot) {
          isFirstSnapshot = false;

          // One-time migration: if the cloud is empty, upload this device's existing chat.
          if (remoteMessages.length === 0 && initialLocalMessages.current.length > 0) {
            const localSeed = initialLocalMessages.current.slice(-MAX_SAVED_MESSAGES);
            setMessages(localSeed);
            messagesRef.current = localSeed;
            saveAiTutorMessagesToFirestore(user.uid, localSeed).catch((err) =>
              console.warn('AI tutor initial cloud sync error:', err)
            );
            return;
          }
        }

        setMessages(remoteMessages.slice(-MAX_SAVED_MESSAGES));
        messagesRef.current = remoteMessages.slice(-MAX_SAVED_MESSAGES);

        // Rebuild chat context from the newly synced history on the next question.
        chatRef.current = null;
      },
      (err) => console.warn('AI tutor cloud listener error:', err)
    );

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [user]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    const historyBeforeSend = messagesRef.current;
    const userMessage: AiTutorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      createdAt: Date.now(),
    };

    const nextWithUser = [...historyBeforeSend, userMessage].slice(-MAX_SAVED_MESSAGES);
    setMessages(nextWithUser);
    messagesRef.current = nextWithUser;
    if (user) {
      saveAiTutorMessagesToFirestore(user.uid, nextWithUser).catch((err) =>
        console.warn('AI tutor user message sync error:', err)
      );
    }

    setInput('');
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        buildChat(historyBeforeSend);
      }
      const activeChat = chatRef.current!;
      const result = await activeChat.sendMessage(text);
      const answer = result.response.text().trim();

      const modelMessage: AiTutorMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: answer || '답변을 생성하지 못했습니다. 다시 질문해 주세요.',
        createdAt: Date.now(),
      };
      const nextWithModel = [...messagesRef.current, modelMessage].slice(-MAX_SAVED_MESSAGES);
      setMessages(nextWithModel);
      messagesRef.current = nextWithModel;
      if (user) {
        saveAiTutorMessagesToFirestore(user.uid, nextWithModel).catch((err) =>
          console.warn('AI tutor model message sync error:', err)
        );
      }
    } catch (err) {
      console.error('AI tutor error:', err);
      const errorMessage: AiTutorMessage = {
        id: `error-${Date.now()}`,
        role: 'model',
        text: 'AI 응답을 불러오지 못했습니다. Firebase AI Logic 설정을 확인한 뒤 다시 시도해 주세요.',
        createdAt: Date.now(),
      };
      const nextWithError = [...messagesRef.current, errorMessage].slice(-MAX_SAVED_MESSAGES);
      setMessages(nextWithError);
      messagesRef.current = nextWithError;
      if (user) {
        saveAiTutorMessagesToFirestore(user.uid, nextWithError).catch(() => {});
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    messagesRef.current = [];
    setInput('');
    chatRef.current = null;
    setSaveTargetId(null);
    setSavedMessageId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    if (user) {
      clearAiTutorMessagesFromFirestore(user.uid).catch((err) =>
        console.warn('AI tutor cloud clear error:', err)
      );
    }
  };

  const openExpressionSave = (message: AiTutorMessage) => {
    const selected = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() || '' : '';
    const candidate =
      selected && /[A-Za-z]{2,}/.test(selected) && selected.length <= 220
        ? selected
        : extractEnglishCandidate(message.text);

    setSaveTargetId(message.id);
    setSaveExpression(candidate);
    setSaveMeaning('');
    setSaveMemo('AI 튜터 답변에서 저장');
  };

  const saveToExpressions = async (messageId: string, startPractice = false) => {
    if (!saveExpression.trim() || !saveMeaning.trim()) {
      alert('저장할 영어 표현과 한글 뜻을 입력해주세요.');
      return;
    }

    const saved = await onAddExpression({
      expression: saveExpression.trim(),
      meaning: saveMeaning.trim(),
      memo: saveMemo.trim() || 'AI 튜터 답변에서 저장',
      favorite: false,
      date: currentDate,
      spokenCount: 0,
    });

    setSaveTargetId(null);
    setSavedMessageId(messageId);
    setTimeout(() => setSavedMessageId(null), 2500);

    if (startPractice) {
      onStartPractice(saved);
    }
  };

  const quickPrompts = [
    '이 영어 문장이 자연스러운지 봐줘: ',
    '이 단어 뜻과 뉘앙스, 예문 알려줘: ',
    '이 문장을 자연스러운 업무 영어로 바꿔줘: ',
    '둘의 차이를 쉽게 설명해줘: ',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">AI 영어 튜터</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                단어, 문장, 문법, 뉘앙스, 업무 영어를 한국어나 영어로 편하게 물어보세요.
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetChat}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="새 대화 시작"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">새 대화</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
              className="px-2.5 py-1.5 rounded-full border border-indigo-100 bg-indigo-50/60 text-[11px] sm:text-xs text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              {prompt.replace(': ', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs min-h-[52vh] flex flex-col overflow-hidden">
        <div className="flex-1 p-3 sm:p-5 space-y-3 overflow-y-auto max-h-[62vh]">
          {messages.length === 0 ? (
            <div className="min-h-[38vh] flex flex-col items-center justify-center text-center px-4">
              <Sparkles className="w-8 h-8 text-indigo-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">무엇이든 영어로 물어보세요.</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                예: “actually랑 in fact 차이가 뭐야?”<br />
                “I will check and let you know. 자연스러워?”
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'model' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={message.role === 'user' ? 'max-w-[86%] sm:max-w-[78%]' : 'max-w-[90%] sm:max-w-[82%]'}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed break-words ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-md whitespace-pre-wrap'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}
                  >
                    {message.role === 'model' ? <MarkdownAnswer text={message.text} /> : message.text}
                  </div>

                  {message.role === 'model' && !message.id.startsWith('error-') && (
                    <div className="mt-1.5 pl-1">
                      <button
                        type="button"
                        onClick={() => openExpressionSave(message)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                        title="답변에서 마음에 드는 영어를 주요 표현에 저장"
                      >
                        {savedMessageId === message.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <BookmarkPlus className="w-3.5 h-3.5" />
                        )}
                        <span>{savedMessageId === message.id ? '저장됨' : '주요 표현에 저장'}</span>
                      </button>
                    </div>
                  )}

                  {saveTargetId === message.id && (
                    <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-800">주요 표현으로 저장</span>
                        <button
                          type="button"
                          onClick={() => setSaveTargetId(null)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white"
                          title="닫기"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={saveExpression}
                        onChange={(e) => setSaveExpression(e.target.value)}
                        placeholder="영어 표현/문장"
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs sm:text-sm outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value={saveMeaning}
                        onChange={(e) => setSaveMeaning(e.target.value)}
                        placeholder="한글 뜻"
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value={saveMemo}
                        onChange={(e) => setSaveMemo(e.target.value)}
                        placeholder="메모 (선택)"
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-[11px] outline-none focus:border-indigo-500"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => saveToExpressions(message.id)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold"
                        >
                          저장만 하기
                        </button>
                        <button
                          type="button"
                          onClick={() => saveToExpressions(message.id, true)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                        >
                          저장하고 발화 연습
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        PC에서는 답변의 영어 문장을 먼저 드래그해 선택한 뒤 저장 버튼을 누르면 선택한 문장이 자동 입력됩니다.
                      </p>
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-xs text-slate-500">
                Gemini가 답변을 생각하고 있어요…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50/60">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
              placeholder="예: ‘confirm’과 ‘check’는 업무에서 어떻게 달라?"
              className="flex-1 min-h-[54px] max-h-32 resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="h-[54px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="보내기"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 px-1">
            Enter 전송 · Shift+Enter 줄바꿈 · 최근 대화는 현재 기기에 저장됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};

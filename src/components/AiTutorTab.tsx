import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, Trash2, User } from 'lucide-react';
import { createEnglishTutorChat, TutorHistoryItem } from '../lib/geminiTutor';

interface TutorMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const STORAGE_KEY = 'ai_tutor_messages_v1';
const MAX_SAVED_MESSAGES = 30;

function loadSavedMessages(): TutorMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_SAVED_MESSAGES) : [];
  } catch {
    return [];
  }
}

export const AiTutorTab: React.FC = () => {
  const [messages, setMessages] = useState<TutorMessage[]>(loadSavedMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<ReturnType<typeof createEnglishTutorChat> | null>(null);

  const buildChat = (source: TutorMessage[] = messages) => {
    const history: TutorHistoryItem[] = source.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    }));
    chatRef.current = createEnglishTutorChat(history);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)));
    } catch {}
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: TutorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        buildChat(messages);
      }
      const result = await chatRef.current!.sendMessage(text);
      const answer = result.response.text().trim();

      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: answer || '답변을 생성하지 못했습니다. 다시 질문해 주세요.',
        },
      ]);
    } catch (err) {
      console.error('AI tutor error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'model',
          text: 'AI 응답을 불러오지 못했습니다. Firebase AI Logic 설정을 확인한 뒤 다시 시도해 주세요.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
    chatRef.current = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
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
                <div
                  className={`max-w-[86%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  }`}
                >
                  {message.text}
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

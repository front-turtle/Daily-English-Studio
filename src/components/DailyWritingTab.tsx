import React, { useState, useEffect } from 'react';
import { DailyComposition } from '../types';
import { playEnglishSpeech } from '../utils/speech';
import { SpeechPlayButton } from './SpeechPlayButton';
import { getTodayDateString } from '../data/initialData';
import { useAuth } from '../context/AuthContext';
import {
  PenTool,
  Calendar,
  Volume2,
  Trash2,
  Bookmark,
  Sparkles,
  Check,
  Edit3,
  Plus,
  ArrowDown,
  RefreshCw,
  X,
  Share2,
  Copy,
  MessageSquare,
} from 'lucide-react';

interface DailyWritingTabProps {
  compositions: DailyComposition[];
  currentDate?: string;
  onDateChange?: (date: string) => void;
  onSaveComposition: (item: Omit<DailyComposition, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateComposition: (id: string, updates: Partial<DailyComposition>) => void;
  onDeleteComposition: (id: string) => void;
}

export const DailyWritingTab: React.FC<DailyWritingTabProps> = ({
  compositions,
  currentDate,
  onDateChange,
  onSaveComposition,
  onUpdateComposition,
  onDeleteComposition,
}) => {
  const { markSaving, markSynced } = useAuth();
  const todayStr = getTodayDateString();
  const [internalDate, setInternalDate] = useState<string>(todayStr);
  const selectedDate = currentDate || internalDate;

  const setSelectedDate = (newDate: string) => {
    setInternalDate(newDate);
    if (onDateChange) onDateChange(newDate);
  };

  // Form inputs with real-time draft auto-saving
  const draftStorageKey = `daily_writing_draft_${selectedDate}`;
  const [koreanInput, setKoreanInput] = useState('');
  const [englishInput, setEnglishInput] = useState('');
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);

  // Restore draft when date changes or component loads
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftStorageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setKoreanInput(parsed.korean || '');
        setEnglishInput(parsed.english || '');
      } else {
        setKoreanInput('');
        setEnglishInput('');
      }
    } catch {
      setKoreanInput('');
      setEnglishInput('');
    }
    setHasLoadedDraft(true);
  }, [draftStorageKey]);

  // Real-time autosave to localStorage (sync status updated on top-right header)
  useEffect(() => {
    if (!hasLoadedDraft) return;
    const hasText = koreanInput.trim().length > 0 || englishInput.trim().length > 0;
    if (!hasText) {
      localStorage.removeItem(draftStorageKey);
      markSynced();
      return;
    }

    // Indicate syncing on top-right header status
    markSaving();
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            korean: koreanInput,
            english: englishInput,
            savedAt: Date.now(),
          })
        );
        // Indicate saved on top-right header status
        markSynced();
      } catch (err) {
        console.warn('Draft save error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [koreanInput, englishInput, draftStorageKey, hasLoadedDraft]);

  // Inline delete confirmation state (safe in iframes)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Inline editor for "다듬은 표현"
  const [editingPolishId, setEditingPolishId] = useState<string | null>(null);
  const [polishInput, setPolishInput] = useState('');
  const [polishTipInput, setPolishTipInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!koreanInput.trim() || !englishInput.trim()) {
      alert('한글 작문과 영어 작문을 모두 입력해주세요.');
      return;
    }

    onSaveComposition({
      date: selectedDate,
      korean: koreanInput.trim(),
      english: englishInput.trim(),
      favorite: false,
    });

    // Clear draft and inputs
    localStorage.removeItem(draftStorageKey);
    setKoreanInput('');
    setEnglishInput('');
    markSynced();
    showToast('영작이 저장되어 아래 목록에 추가되었습니다. 계속해서 다음 문장을 영작하세요!');
  };

  // Open inline editor for polishing
  const handleOpenPolish = (comp: DailyComposition) => {
    setEditingPolishId(comp.id);
    setPolishInput(comp.polished || '');
    setPolishTipInput(comp.polishedTip || '');
  };

  // Save polished expression
  const handleSavePolish = (id: string) => {
    if (!polishInput.trim()) {
      alert('다듬은 표현을 입력해주세요.');
      return;
    }
    onUpdateComposition(id, {
      polished: polishInput.trim(),
      polishedTip: polishTipInput.trim() || undefined,
    });
    setEditingPolishId(null);
    showToast('다듬은 표현이 저장되었습니다.');
  };

  // Optional AI helper for polishing
  const handleAiSuggestPolish = async (comp: DailyComposition) => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          korean: comp.korean,
          english: comp.english,
        }),
      });
      if (!res.ok) throw new Error('AI 응답 실패');
      const data = await res.json();
      if (data.polishedSentence) {
        setPolishInput(data.polishedSentence);
        if (data.tip) setPolishTipInput(data.tip);
      }
    } catch (err) {
      console.error(err);
      alert('AI 추천을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Filter compositions strictly for selected date (Entire list toggle removed per user request)
  const displayedCompositions = compositions.filter((c) => c.date === selectedDate);

  // Export today's writing to clipboard formatted for KakaoTalk
  const handleExportToKakaoTalk = async () => {
    if (displayedCompositions.length === 0) {
      alert(`${selectedDate} 날짜에 저장된 영작문이 없습니다. 먼저 문장을 영작하고 저장해주세요.`);
      return;
    }

    const lines: string[] = [
      `[Daily English 영작 노트 - ${selectedDate}]`,
      `오늘 작성한 문장 총 ${displayedCompositions.length}개`,
      '',
    ];

    displayedCompositions.forEach((comp, idx) => {
      lines.push(`${idx + 1}.`);
      lines.push(`• 한글: ${comp.korean}`);
      lines.push(`• 영작: ${comp.english}`);
      if (comp.polished) {
        lines.push(`• 다듬은 표현: ${comp.polished}`);
      }
      if (comp.polishedTip) {
        lines.push(`• 팁: ${comp.polishedTip}`);
      }
      lines.push('');
    });

    lines.push('---------------------------');
    lines.push('Daily English Studio에서 보냄');

    const text = lines.join('\n');

    let success = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        success = document.execCommand('copy');
      } catch (err) {
        console.warn('execCommand failed', err);
      }
      document.body.removeChild(textArea);
    }

    if (success) {
      showToast('카카오톡에 붙여넣기할 수 있도록 클립보드에 복사되었습니다! (Ctrl+V 또는 붙여넣기)');
    } else {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const selectedDateCount = compositions.filter((c) => c.date === selectedDate).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 sm:top-20 right-4 z-50 bg-slate-900 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. 영작 작성 영역 (Writing Section) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
              <PenTool className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">매일 한영 영작하기</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                한글 문장을 쓰고 영어로 작문하세요. (작성 중 실시간 자동 저장)
              </p>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 한글 작문 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>한글 작문</span>
              <span className="text-[10px] text-slate-400 font-normal">(말하고 싶은 문장)</span>
            </label>
            <textarea
              value={koreanInput}
              onChange={(e) => setKoreanInput(e.target.value)}
              rows={6}
              placeholder="예: 오늘 회의에서 내 생각을 명확하게 전달하기가 조금 힘들었어."
              className="w-full min-h-[140px] sm:min-h-[150px] p-3.5 text-xs sm:text-sm leading-relaxed rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-y"
            />
          </div>

          {/* 영어 작문 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>영어 작문</span>
              <span className="text-[10px] text-slate-400 font-normal">(직접 번역해본 1차 영작)</span>
            </label>
            <textarea
              value={englishInput}
              onChange={(e) => setEnglishInput(e.target.value)}
              rows={6}
              placeholder="예: In today's meeting, it was hard to explain my thought clearly."
              className="w-full min-h-[140px] sm:min-h-[150px] p-3.5 text-xs sm:text-sm leading-relaxed rounded-xl border border-indigo-200 bg-indigo-50/20 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium outline-none transition-all resize-y"
            />
          </div>

          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <div className="text-[11px] text-slate-400">
              💡 저장 후 입력창이 비워지므로 연달아 영작을 계속할 수 있습니다.
            </div>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>영작 저장하기</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. 일별 영작 목록 영역 (Selected Date List) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {selectedDate} 영작 목록 ({displayedCompositions.length}개)
            </h3>
          </div>

          {/* KakaoTalk Export Button */}
          <button
            type="button"
            onClick={handleExportToKakaoTalk}
            disabled={displayedCompositions.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FEE500] hover:bg-[#FDD835] active:scale-95 text-[#3C1E1E] text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="오늘 작성한 영작 내용을 카카오톡으로 바로 공유할 수 있게 클립보드에 복사합니다"
          >
            <Share2 className="w-3.5 h-3.5 text-[#3C1E1E]" />
            <span>카톡으로 공유 (클립보드 복사)</span>
          </button>
        </div>

        {/* Empty State */}
        {displayedCompositions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center space-y-1 text-slate-500">
            <p className="text-xs sm:text-sm font-semibold">선택한 날짜에 작성된 영작문이 없습니다.</p>
            <p className="text-[11px] text-slate-400">
              위 입력창에서 한글 문장과 영어 작문을 적고 '영작 저장하기'를 눌러보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedCompositions.map((comp) => {
              const isEditingThis = editingPolishId === comp.id;

              return (
                <div
                  key={comp.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                >
                  {/* Top Bar: Action icons (Bookmark & Delete) - Date removed per user request */}
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-medium text-slate-400">
                      영작 기록
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateComposition(comp.id, { favorite: !comp.favorite })}
                        className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
                          comp.favorite ? 'text-amber-500' : 'text-slate-400'
                        }`}
                        title={comp.favorite ? '즐겨찾기 해제' : '중요 문장 즐겨찾기'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${comp.favorite ? 'fill-amber-500' : ''}`} />
                      </button>

                      {deletingId === comp.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteComposition(comp.id);
                              setDeletingId(null);
                              showToast('영작 기록이 삭제되었습니다.');
                            }}
                            className="text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded transition-all cursor-pointer shadow-xs"
                          >
                            정말 삭제
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 px-1 py-0.5"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(comp.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. 한글 작문 */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100/90 text-xs sm:text-sm text-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-200/60 inline-block">
                      한글
                    </span>
                    <p className="text-slate-800 font-medium leading-relaxed pl-0.5">
                      {comp.korean}
                    </p>
                  </div>

                  {/* 2. 1차 영어 작문 (줄바꿈 처리로 카드 너비 100% 활용) */}
                  <div className="bg-indigo-50/30 rounded-xl p-3 border border-indigo-100/60 space-y-1.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2 pb-1 border-b border-indigo-100/40">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">
                        1차 영작
                      </span>
                      <SpeechPlayButton text={comp.english} title="1차 영작 발음 듣기" />
                    </div>
                    <p className="text-slate-900 font-medium leading-relaxed break-words pl-0.5 pt-0.5">
                      {comp.english}
                    </p>
                  </div>

                  {/* 3. 다듬은 표현 (개선문) - 줄바꿈 처리하여 스피커/수정 버튼 아래로 텍스트가 100% 폭 사용 */}
                  {comp.polished ? (
                    <div className="bg-emerald-50/40 rounded-xl p-3 sm:p-3.5 border border-emerald-200/70 space-y-2 text-xs sm:text-sm">
                      {/* Top Header: Badge on left, Speaker controls & Edit button on right */}
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-emerald-200/50">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                          다듬은 표현
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <SpeechPlayButton text={comp.polished} theme="emerald" title="다듬은 표현 발음 듣기" />
                          <button
                            type="button"
                            onClick={() => handleOpenPolish(comp)}
                            className="text-[11px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg bg-white/90 border border-slate-200/80 flex items-center gap-1 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                            title="다듬은 표현 수정하기"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500" />
                            <span>수정</span>
                          </button>
                        </div>
                      </div>

                      {/* Full-width polished English text (줄바꿈되어 카드 전체 가로폭을 활용) */}
                      <p className="font-bold text-emerald-950 text-xs sm:text-sm leading-relaxed break-words pl-0.5">
                        {comp.polished}
                      </p>

                      {/* Optional Polish tip (전체 너비 배경 박스로 깔끔하게 강조) */}
                      {comp.polishedTip && (
                        <div className="text-[11px] sm:text-xs text-emerald-800/90 leading-relaxed bg-emerald-100/50 rounded-lg px-2.5 py-1.5 border border-emerald-200/50 flex items-start gap-1.5 mt-1.5">
                          <span className="shrink-0">💡</span>
                          <span className="break-words">{comp.polishedTip}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {!isEditingThis && (
                        <button
                          type="button"
                          onClick={() => handleOpenPolish(comp)}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>+ 다듬은 표현으로 개선해서 저장하기</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Inline Polish Editor */}
                  {isEditingThis && (
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-indigo-200 space-y-2.5 animate-in fade-in duration-150 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          다듬은 표현(개선문) 입력
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAiSuggestPolish(comp)}
                          disabled={isAiLoading}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isAiLoading ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>AI 추천받기</span>
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        value={polishInput}
                        onChange={(e) => setPolishInput(e.target.value)}
                        placeholder="예: I found it a bit challenging to articulate my thoughts..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-medium outline-none focus:border-indigo-500 min-h-[70px] resize-y leading-relaxed"
                      />

                      <input
                        type="text"
                        value={polishTipInput}
                        onChange={(e) => setPolishTipInput(e.target.value)}
                        placeholder="메모/팁 (선택, 예: articulate thoughts 활용)"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none"
                      />

                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingPolishId(null)}
                          className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 text-xs font-semibold"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePolish(comp.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                        >
                          개선문 저장
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

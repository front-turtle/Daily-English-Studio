import React, { useEffect, useState } from 'react';
import { KeyExpression } from '../types';
import { playEnglishSpeech } from '../utils/speech';
import { SpeechPlayButton } from './SpeechPlayButton';
import { getTodayDateString } from '../data/initialData';
import {
  Bookmark,
  Volume2,
  Plus,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface KeyExpressionsTabProps {
  expressions: KeyExpression[];
  currentDate?: string;
  onDateChange?: (date: string) => void;
  onAddExpression: (item: Omit<KeyExpression, 'id' | 'createdAt'>) => void;
  focusExpressionId?: string | null;
  onUpdateExpression: (id: string, updates: Partial<KeyExpression>) => void;
  onDeleteExpression: (id: string) => void;
}

export const KeyExpressionsTab: React.FC<KeyExpressionsTabProps> = ({
  expressions,
  currentDate,
  onDateChange,
  onAddExpression,
  focusExpressionId,
  onUpdateExpression,
  onDeleteExpression,
}) => {
  const todayStr = getTodayDateString();
  const activeDate = currentDate || todayStr;

  useEffect(() => {
    if (!focusExpressionId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`expression-card-${focusExpressionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [focusExpressionId, expressions]);

  // Add form state
  const [expressionInput, setExpressionInput] = useState('');
  const [meaningInput, setMeaningInput] = useState('');
  const [memoInput, setMemoInput] = useState('');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Edit inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExpression, setEditExpression] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // Inline delete confirmation state (safe in iframes)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expressionInput.trim() || !meaningInput.trim()) {
      alert('영어 표현과 한글 뜻을 모두 입력해주세요.');
      return;
    }

    onAddExpression({
      expression: expressionInput.trim(),
      meaning: meaningInput.trim(),
      memo: memoInput.trim() || '',
      favorite: false,
      date: activeDate,
      spokenCount: 0,
    });

    setExpressionInput('');
    setMeaningInput('');
    setMemoInput('');
    showToast('주요 표현이 등록되었습니다!');
  };

  const handleStartEdit = (item: KeyExpression) => {
    setEditingId(item.id);
    setEditExpression(item.expression);
    setEditMeaning(item.meaning);
    setEditMemo(item.memo || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editExpression.trim() || !editMeaning.trim()) {
      alert('영어 표현과 한글 뜻을 입력해주세요.');
      return;
    }
    onUpdateExpression(id, {
      expression: editExpression.trim(),
      meaning: editMeaning.trim(),
      memo: editMemo.trim() || '',
    });
    setEditingId(null);
    showToast('표현이 수정되었습니다.');
  };

  // Filtered expressions: 선택한 날짜에 작성된 표현만 표시
  const filteredExpressions = expressions.filter((item) => {
    const itemDate = item.date || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : '');
    if (itemDate !== activeDate) return false;
    if (onlyFavorites && !item.favorite) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.expression.toLowerCase().includes(query) ||
      item.meaning.toLowerCase().includes(query) ||
      (item.memo && item.memo.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-16 sm:top-20 right-4 z-50 bg-slate-900 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. 표현 등록 창 */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">새 주요 표현 작성</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 break-keep leading-relaxed">
              꼭 외우고 싶은 표현을 기록해두고 틈날 때마다 자주 들여다보세요.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">영어 주요 표현/문장 *</label>
              <input
                type="text"
                value={expressionInput}
                onChange={(e) => setExpressionInput(e.target.value)}
                placeholder="예: get the hang of it, keep an eye on"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">한글 뜻 *</label>
              <input
                type="text"
                value={meaningInput}
                onChange={(e) => setMeaningInput(e.target.value)}
                placeholder="예: ~에 감을 잡다, 익숙해지다"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              활용 팁 / 상황 메모 <span className="text-slate-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={memoInput}
              onChange={(e) => setMemoInput(e.target.value)}
              placeholder="예: 새로운 도구나 운동 배울 때 자주 씀"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>표현 등록하기</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. 주요 표현 보관함 & 검색 */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>{activeDate} 주요 표현 ({filteredExpressions.length}개)</span>
          </h3>

          {/* Search & Star Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="표현 또는 뜻 검색..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-indigo-500 outline-none w-40 sm:w-48"
              />
            </div>

            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                onlyFavorites
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>중요</span>
            </button>
          </div>
        </div>

        {filteredExpressions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center space-y-1 text-slate-500">
            <p className="text-xs sm:text-sm font-semibold">
              {searchQuery.trim() || onlyFavorites
                ? '검색 조건에 맞는 표현이 없습니다.'
                : `${activeDate}에 등록된 주요 표현이 없습니다.`}
            </p>
            <p className="text-[11px] text-slate-400">
              위 입력창에서 새로운 주요 표현을 등록해보세요. (모든 날짜의 누적 표현은 상단 [모아보기] 탭에서 확인하실 수 있습니다.)
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredExpressions.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <div
                  id={`expression-card-${item.id}`}
                  key={item.id}
                  className={`bg-white rounded-2xl p-4 border shadow-2xs transition-all space-y-2.5 flex flex-col justify-between ${
                    focusExpressionId === item.id
                      ? 'border-indigo-400 ring-2 ring-indigo-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {focusExpressionId === item.id && (
                    <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-2 text-[11px] text-indigo-800">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        AI에서 저장한 표현이에요. 발음을 듣고 따라 말한 뒤 아래 <b>+</b> 버튼으로 발화 횟수를 기록해보세요.
                      </span>
                    </div>
                  )}
                  {isEditing ? (
                    /* Inline Edit Mode */
                    <div className="space-y-2 text-xs">
                      <input
                        type="text"
                        value={editExpression}
                        onChange={(e) => setEditExpression(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 font-bold text-xs sm:text-sm"
                        placeholder="영어 표현"
                      />
                      <input
                        type="text"
                        value={editMeaning}
                        onChange={(e) => setEditMeaning(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                        placeholder="한글 뜻"
                      />
                      <input
                        type="text"
                        value={editMemo}
                        onChange={(e) => setEditMemo(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px]"
                        placeholder="메모 (선택)"
                      />
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal View Mode */
                    <>
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug">
                            {item.expression}
                          </h4>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <SpeechPlayButton text={item.expression} title="표현 발음 듣기" />

                            <button
                              type="button"
                              onClick={() => onUpdateExpression(item.id, { favorite: !item.favorite })}
                              className={`p-1.5 rounded-lg transition-colors ${
                                item.favorite ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                              }`}
                              title="중요 표시"
                            >
                              <Bookmark className={`w-3.5 h-3.5 ${item.favorite ? 'fill-amber-500' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* 한글 뜻 */}
                        <p className="text-xs sm:text-sm text-indigo-900 font-medium">
                          {item.meaning}
                        </p>

                        {/* 메모 */}
                        {item.memo && (
                          <div className="bg-slate-50 text-slate-600 text-[11px] px-2 py-1 rounded-md border border-slate-100">
                            💡 {item.memo}
                          </div>
                        )}
                      </div>

                      {/* Card Bottom: 발화 횟수 & 수정 & 삭제 */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 text-slate-400">
                        {/* 1. 발화 횟수 카운터 (0, +, -) */}
                        <div
                          className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-lg px-1.5 py-0.5 text-xs transition-colors select-none"
                          title="내가 발화한 횟수 기록"
                        >
                          <span className="text-[10px] font-bold text-slate-500">발화</span>
                          <button
                            type="button"
                            onClick={() => {
                              const count = item.spokenCount || 0;
                              if (count > 0) {
                                onUpdateExpression(item.id, { spokenCount: count - 1 });
                              }
                            }}
                            disabled={(item.spokenCount || 0) <= 0}
                            className="w-4 h-4 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 active:scale-95 disabled:opacity-25 disabled:hover:bg-transparent font-bold cursor-pointer transition-all"
                            title="발화 횟수 1 감소 (-)"
                          >
                            -
                          </button>
                          <span
                            className={`font-mono font-bold min-w-[14px] text-center text-xs ${
                              (item.spokenCount || 0) > 0 ? 'text-indigo-600' : 'text-slate-500'
                            }`}
                          >
                            {item.spokenCount || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const count = item.spokenCount || 0;
                              onUpdateExpression(item.id, { spokenCount: count + 1 });
                            }}
                            className="w-4 h-4 rounded flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 active:scale-95 font-bold cursor-pointer transition-all"
                            title="발화 횟수 1 추가 (+)"
                          >
                            +
                          </button>
                        </div>

                        {/* 2. 수정 & 3. 삭제 */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                            title="수정"
                          >
                            <Edit3 className="w-3 h-3 text-slate-400" />
                            <span>수정</span>
                          </button>

                          {deletingId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteExpression(item.id);
                                  setDeletingId(null);
                                  showToast('표현이 삭제되었습니다.');
                                }}
                                className="flex items-center gap-0.5 text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded transition-all cursor-pointer shadow-xs"
                              >
                                <span>정말 삭제</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                className="text-[11px] text-slate-400 hover:text-slate-600 px-1 py-0.5 transition-colors cursor-pointer"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingId(item.id)}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-500 px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>삭제</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
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

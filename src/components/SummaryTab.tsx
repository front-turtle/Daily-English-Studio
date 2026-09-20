import React, { useState, useMemo, useEffect } from 'react';
import { DailyComposition, AudioItem, KeyExpression, ActiveTab } from '../types';
import { formatDateWithDay, getTodayDateString, formatCompactDate } from '../data/initialData';
import { AudioPlayerWithSpeed } from './AudioPlayerWithSpeed';
import { SpeechPlayButton } from './SpeechPlayButton';
import {
  PenLine,
  Headphones,
  Bookmark,
  BookOpen,
  Calendar,
  Search,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ExternalLink,
  Sparkles,
  Volume2,
  CheckCircle2,
  Layers,
  CalendarDays,
  FileText,
} from 'lucide-react';

interface SummaryTabProps {
  compositions: DailyComposition[];
  audioItems: AudioItem[];
  expressions: KeyExpression[];
  onNavigateTab: (tab: ActiveTab, targetDate?: string) => void;
  onUpdateItemBase64?: (id: string, base64: string) => void;
}

type SummaryCategory = 'writing' | 'audio' | 'expressions' | 'all';

export const SummaryTab: React.FC<SummaryTabProps> = ({
  compositions,
  audioItems,
  expressions,
  onNavigateTab,
  onUpdateItemBase64,
}) => {
  const todayStr = getTodayDateString();

  // Category view: 'writing' | 'audio' | 'expressions' | 'all'
  const [selectedCategory, setSelectedCategory] = useState<SummaryCategory>('writing');

  // Search and Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Optional date filter (defaults to 'all' so it is completely date-independent by default)
  const [optionalDateFilter, setOptionalDateFilter] = useState<string>('');

  // Background pre-fetch audio base64 for items missing audioBase64 to guarantee instant mobile playback
  useEffect(() => {
    if (!onUpdateItemBase64) return;
    audioItems.forEach(async (item) => {
      if (!item.audioBase64 && item.audioUrl) {
        try {
          const res = await fetch(`/api/audio/resolve-base64?path=${encodeURIComponent(item.audioUrl)}&id=${encodeURIComponent(item.id)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.base64) {
              onUpdateItemBase64(item.id, data.base64);
            }
          }
        } catch {}
      }
    });
  }, [audioItems, onUpdateItemBase64]);

  // 1. Process and sort Compositions (날짜 무관 전체 영작)
  const sortedCompositions = useMemo(() => {
    let items = [...compositions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (c) =>
          c.korean.toLowerCase().includes(q) ||
          c.english.toLowerCase().includes(q) ||
          (c.polished && c.polished.toLowerCase().includes(q)) ||
          (c.polishedTip && c.polishedTip.toLowerCase().includes(q))
      );
    }

    if (onlyFavorites) {
      items = items.filter((c) => c.favorite);
    }

    if (optionalDateFilter) {
      items = items.filter((c) => c.date === optionalDateFilter);
    }

    items.sort((a, b) => {
      const dateDiff = (a.date || '').localeCompare(b.date || '');
      if (dateDiff !== 0) {
        return sortOrder === 'newest' ? -dateDiff : dateDiff;
      }
      return sortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
    });

    return items;
  }, [compositions, searchQuery, onlyFavorites, optionalDateFilter, sortOrder]);

  // 2. Process and sort Audio Items (날짜 무관 전체 음성 & 녹음)
  const sortedAudioItems = useMemo(() => {
    let items = audioItems.map((item) => ({
      ...item,
      date: item.date || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : todayStr),
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (a) => a.title.toLowerCase().includes(q) || a.fileName.toLowerCase().includes(q)
      );
    }

    if (optionalDateFilter) {
      items = items.filter((a) => a.date === optionalDateFilter);
    }

    items.sort((a, b) => {
      const dateDiff = (a.date || '').localeCompare(b.date || '');
      if (dateDiff !== 0) {
        return sortOrder === 'newest' ? -dateDiff : dateDiff;
      }
      return sortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
    });

    return items;
  }, [audioItems, searchQuery, optionalDateFilter, sortOrder, todayStr]);

  // 3. Process and sort Key Expressions (날짜 무관 전체 주요 표현)
  const sortedExpressions = useMemo(() => {
    let items = expressions.map((item) => ({
      ...item,
      date: item.date || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : todayStr),
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (e) =>
          e.expression.toLowerCase().includes(q) ||
          e.meaning.toLowerCase().includes(q) ||
          (e.memo && e.memo.toLowerCase().includes(q))
      );
    }

    if (onlyFavorites) {
      items = items.filter((e) => e.favorite);
    }

    if (optionalDateFilter) {
      items = items.filter((e) => e.date === optionalDateFilter);
    }

    items.sort((a, b) => {
      const dateDiff = (a.date || '').localeCompare(b.date || '');
      if (dateDiff !== 0) {
        return sortOrder === 'newest' ? -dateDiff : dateDiff;
      }
      return sortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
    });

    return items;
  }, [expressions, searchQuery, onlyFavorites, optionalDateFilter, sortOrder, todayStr]);

  // Total counts
  const totalWritings = compositions.length;
  const totalAudios = audioItems.length;
  const totalRecordedAudios = audioItems.filter((a) => !!a.myRecordingUrl).length;
  const totalExpressions = expressions.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* 1. Header Banner & Category Tabs (날짜 무관 영작/음성/표현 모아보기) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1 rounded-lg bg-indigo-600 text-white">
                <Layers className="w-4 h-4" />
              </span>
              <span>학습 기록 모아보기</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              날짜에 구애받지 않고, 영작·음성·표현별로 모아둔 전체 학습 기록을 자유롭게 검토하고 복습하세요.
            </p>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-xl">
              영작 {totalWritings}편
            </span>
            <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 rounded-xl">
              음성 {totalAudios}개
            </span>
            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-xl">
              표현 {totalExpressions}개
            </span>
          </div>
        </div>

        {/* Category Switcher Tabs (영작 별 / 음성 별 / 표현 별 / 전체 타임라인) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Tab: 영작 모아보기 */}
          <button
            type="button"
            onClick={() => setSelectedCategory('writing')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
              selectedCategory === 'writing'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <PenLine className="w-4 h-4 shrink-0" />
            <span>영작 모아보기</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategory === 'writing' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {totalWritings}
            </span>
          </button>

          {/* Tab: 음성 & 녹음 모아보기 */}
          <button
            type="button"
            onClick={() => setSelectedCategory('audio')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
              selectedCategory === 'audio'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <Headphones className="w-4 h-4 shrink-0" />
            <span>음성 & 녹음</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategory === 'audio' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {totalAudios}
            </span>
          </button>

          {/* Tab: 주요 표현 모아보기 */}
          <button
            type="button"
            onClick={() => setSelectedCategory('expressions')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
              selectedCategory === 'expressions'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>주요 표현</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategory === 'expressions' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {totalExpressions}
            </span>
          </button>

          {/* Tab: 전체 타임라인 */}
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4 shrink-0" />
            <span>전체 타임라인</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Search & Filtering Bar */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="내용, 표현, 제목 등 자유 검색..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controls: Favorite -> Date Filter -> Sort Order Symbol (문자 없이 기호와 버튼만 유지) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* 1. Favorite toggle for writing or expressions */}
            {(selectedCategory === 'writing' || selectedCategory === 'expressions') && (
              <button
                type="button"
                onClick={() => setOnlyFavorites(!onlyFavorites)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  onlyFavorites
                    ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>중요만 보기</span>
              </button>
            )}

            {/* 2. Optional Specific Date Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-xl text-xs shrink-0">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="date"
                value={optionalDateFilter}
                onChange={(e) => setOptionalDateFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer w-24 sm:w-26"
                title="원하는 날짜만 좁혀보기 (비워두면 날짜 무관 전체 보기)"
              />
              {optionalDateFilter && (
                <button
                  type="button"
                  onClick={() => setOptionalDateFilter('')}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold px-1"
                  title="전체 날짜로 복원"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 3. Sort order symbol button ("최신~~" 문자 없이 버튼과 정렬 기호만 배치) */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200/90 text-slate-700 transition-all cursor-pointer shrink-0 border border-slate-200 active:scale-95 shadow-2xs"
              title={sortOrder === 'newest' ? '최신 작성순 정렬 중 (클릭 시 오래된 순으로 전환)' : '오래된 작성순 정렬 중 (클릭 시 최신 순으로 전환)'}
              aria-label={sortOrder === 'newest' ? '최신순' : '오래된순'}
            >
              {sortOrder === 'newest' ? (
                <ArrowDownWideNarrow className="w-4 h-4 text-indigo-600" />
              ) : (
                <ArrowUpNarrowWide className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Category Content Views */}

      {/* --- CATEGORY 1: 영작 모아보기 --- */}
      {selectedCategory === 'writing' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <PenLine className="w-4 h-4 text-indigo-600" />
              <span>영작 모아보기 ({sortedCompositions.length}개)</span>
            </h3>
            <span className="text-xs text-slate-400">
              {optionalDateFilter ? `${optionalDateFilter} 기록만 표시` : '날짜 무관 전체 영작 리스트'}
            </span>
          </div>

          {sortedCompositions.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-dashed border-slate-200 text-center space-y-2">
              <PenLine className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">저장된 영작 기록이 없습니다.</p>
              <p className="text-xs text-slate-400">
                매일 영작 탭에서 오늘 공부한 문장을 기록해보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {sortedCompositions.map((comp) => (
                <div
                  key={comp.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                >
                  {/* Top Bar: Date & Jump button */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-indigo-500" />
                      <span>{formatDateWithDay(comp.date) || comp.date}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('writing', comp.date)}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      <span>이 날짜 영작 바로가기</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Korean Source */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-400">한글 원문</div>
                    <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                      {comp.korean}
                    </p>
                  </div>

                  {/* 1차 영어 작문 */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">✍️ 내가 쓴 1차 영작</span>
                      <SpeechPlayButton text={comp.english} title="내 영작 발음 듣기" />
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 font-mono select-all">
                      {comp.english}
                    </p>
                  </div>

                  {/* 다듬은 표현 (Polished) */}
                  {comp.polished ? (
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>✨ 원어민 스타일 다듬은 표현</span>
                        </span>
                        <SpeechPlayButton text={comp.polished} title="다듬은 표현 듣기" />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-emerald-950">
                        {comp.polished}
                      </p>
                      {comp.polishedTip && (
                        <p className="text-[11px] text-emerald-800/90 pt-0.5 border-t border-emerald-200/60 mt-1">
                          💡 {comp.polishedTip}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      아직 다듬은 표현이 등록되지 않았습니다.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- CATEGORY 2: 음성 & 녹음 모아보기 --- */}
      {selectedCategory === 'audio' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-indigo-600" />
              <span>음성 & 내 녹음 모아보기 ({sortedAudioItems.length}개)</span>
            </h3>
            <span className="text-xs text-slate-400">
              {optionalDateFilter ? `${optionalDateFilter} 기록만 표시` : '날짜 무관 전체 음성 목록'}
            </span>
          </div>

          {sortedAudioItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-dashed border-slate-200 text-center space-y-2">
              <Headphones className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">등록된 학습 음성 파일이 없습니다.</p>
              <p className="text-xs text-slate-400">
                음성 & 녹음 탭에서 MP3 파일을 업로드하고 쉐도잉을 진행해보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAudioItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3.5"
                >
                  {/* Header: Title, Date & Jump button */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {item.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                            <Calendar className="w-2.5 h-2.5 text-indigo-500" />
                            {formatDateWithDay(item.date) || item.date}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          {item.fileName}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('audio-shadowing', item.date)}
                      className="shrink-0 flex items-center justify-end text-right text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer group pl-2"
                    >
                      <div className="flex flex-col items-end leading-tight">
                        <span className="whitespace-nowrap font-medium text-slate-600 group-hover:text-indigo-600 text-[10px] sm:text-[11px]">
                          쉐도잉 훈련
                        </span>
                        <span className="flex items-center gap-0.5 whitespace-nowrap text-indigo-600 font-bold group-hover:underline text-[10px] sm:text-[11px]">
                          바로가기
                          <ExternalLink className="w-2.5 h-2.5 inline" />
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* 1. Original Audio Player */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <span>🎧 1. 원본 음성 (원어민/모델)</span>
                      </span>
                      <span className="text-[10px] text-slate-400">좌우 배속 버튼으로 조절 가능</span>
                    </div>
                    <AudioPlayerWithSpeed
                      src={item.audioUrl}
                      itemId={item.id}
                      audioBase64={item.audioBase64}
                      onResolvedBase64={(b64) => onUpdateItemBase64?.(item.id, b64)}
                    />

                    {item.transcript && (
                      <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                          <FileText className="w-3 h-3 text-indigo-600" />
                          <span>대본 (스크립트)</span>
                        </div>
                        <div className="text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                          {item.transcript}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. My Shadowing Recording Player */}
                  <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                        <span>🎙️ 2. 내가 녹음한 쉐도잉 음성</span>
                        {item.myRecordingUrl || item.myRecordingBase64 ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> 녹음 완료
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
                            녹음 전
                          </span>
                        )}
                      </span>
                    </div>

                    {item.myRecordingUrl || item.myRecordingBase64 ? (
                      <AudioPlayerWithSpeed
                        src={item.myRecordingUrl || ''}
                        itemId={`rec-${item.id}`}
                        audioBase64={item.myRecordingBase64 || undefined}
                      />
                    ) : (
                      <p className="text-xs text-slate-400 py-1 italic">
                        아직 저장된 녹음본이 없습니다. '쉐도잉 훈련 바로가기'를 눌러 마이크로 녹음해보세요!
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- CATEGORY 3: 주요 표현 모아보기 --- */}
      {selectedCategory === 'expressions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>주요 표현 모아보기 ({sortedExpressions.length}개)</span>
            </h3>
            <span className="text-xs text-slate-400">
              {optionalDateFilter ? `${optionalDateFilter} 기록만 표시` : '날짜 무관 전체 단어장'}
            </span>
          </div>

          {sortedExpressions.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-dashed border-slate-200 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">등록된 주요 표현이 없습니다.</p>
              <p className="text-xs text-slate-400">
                주요 표현 탭에서 기억하고 싶은 표현을 등록해보세요.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedExpressions.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Top row: Spoken Count & Date & TTS & Bookmark */}
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        {item.spokenCount !== undefined && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                            발화 {item.spokenCount}회
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-mono">
                          <Calendar className="w-2.5 h-2.5 text-slate-500" />
                          {formatCompactDate(item.date, item.createdAt) || item.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <SpeechPlayButton text={item.expression} title="발음 듣기" />
                        {item.favorite && (
                          <span className="text-amber-500 bg-amber-50 p-1 rounded-md">
                            <Bookmark className="w-3.5 h-3.5 fill-amber-500" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expression */}
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug">
                      {item.expression}
                    </h4>

                    {/* Meaning */}
                    <p className="text-xs sm:text-sm text-indigo-900 font-medium">
                      {item.meaning}
                    </p>

                    {/* Memo */}
                    {item.memo && (
                      <div className="bg-slate-50 text-slate-600 text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-100">
                        💡 {item.memo}
                      </div>
                    )}
                  </div>

                  {/* Card bottom: Quick navigation to expressions tab */}
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('expressions', item.date)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 cursor-pointer"
                    >
                      <span>표현 탭에서 보기</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- CATEGORY 4: 전체 타임라인 (Combined) --- */}
      {selectedCategory === 'all' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <span>전체 통합 타임라인</span>
            </h3>
            <span className="text-xs text-slate-400">날짜별 영작, 음성, 표현을 통합 열람</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 영작 요약 컬럼 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-xs text-indigo-700 flex items-center gap-1.5">
                  <PenLine className="w-3.5 h-3.5" /> 영작 ({sortedCompositions.length})
                </span>
                <button
                  onClick={() => setSelectedCategory('writing')}
                  className="text-[11px] text-indigo-600 hover:underline"
                >
                  더보기
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {sortedCompositions.slice(0, 5).map((c) => (
                  <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="text-[10px] text-slate-400">{c.date}</div>
                    <div className="font-medium text-slate-800 line-clamp-1">{c.korean}</div>
                    <div className="text-indigo-600 line-clamp-1 font-mono">{c.polished || c.english}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 음성 요약 컬럼 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-xs text-sky-700 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5" /> 음성/녹음 ({sortedAudioItems.length})
                </span>
                <button
                  onClick={() => setSelectedCategory('audio')}
                  className="text-[11px] text-sky-600 hover:underline"
                >
                  더보기
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {sortedAudioItems.slice(0, 5).map((a) => (
                  <div key={a.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="text-[10px] text-slate-400">{a.date}</div>
                    <div className="font-bold text-slate-800 line-clamp-1">{a.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {a.myRecordingUrl ? '🎙️ 녹음본 저장됨' : '🎧 원본 음성만 있음'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 표현 요약 컬럼 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-xs text-amber-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> 주요 표현 ({sortedExpressions.length})
                </span>
                <button
                  onClick={() => setSelectedCategory('expressions')}
                  className="text-[11px] text-amber-600 hover:underline"
                >
                  더보기
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {sortedExpressions.slice(0, 5).map((e) => (
                  <div key={e.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="text-[10px] text-slate-400">{e.date}</div>
                    <div className="font-bold text-slate-900">{e.expression}</div>
                    <div className="text-slate-600 line-clamp-1">{e.meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

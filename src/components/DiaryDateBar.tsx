import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
  Sparkles,
  PenTool,
  Headphones,
  BookOpen,
  ChevronDown,
  CalendarDays,
  X
} from 'lucide-react';
import { formatDateWithDay, shiftDate, getTodayDateString } from '../data/initialData';
import { ActiveTab } from '../types';

interface DiaryDateBarProps {
  currentDate: string;
  onDateChange: (newDate: string) => void;
  activeTab: ActiveTab;
  dayCompositionsCount: number;
  dayAudioCount: number;
  dayExpressionsCount: number;
  recordedDates?: Set<string> | string[];
}

export const DiaryDateBar: React.FC<DiaryDateBarProps> = ({
  currentDate,
  onDateChange,
  activeTab,
  dayCompositionsCount,
  dayAudioCount,
  dayExpressionsCount,
  recordedDates,
}) => {
  const todayStr = getTodayDateString();
  const isToday = currentDate === todayStr;

  // Stable 2-character badge so the button width never fluctuates, with accurate label for tomorrow/future
  const dateBadge = useMemo(() => {
    if (currentDate === todayStr) {
      return { text: '오늘', bg: 'bg-indigo-600 text-white font-bold' };
    }
    if (currentDate < todayStr) {
      return { text: '과거', bg: 'bg-amber-100 text-amber-800 font-semibold' };
    }
    const tomorrowStr = shiftDate(todayStr, 1);
    if (currentDate === tomorrowStr) {
      return { text: '내일', bg: 'bg-sky-100 text-sky-800 font-semibold' };
    }
    return { text: '미래', bg: 'bg-emerald-100 text-emerald-800 font-semibold' };
  }, [currentDate, todayStr]);

  // Popover calendar state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const nativeDateInputRef = useRef<HTMLInputElement>(null);

  // Month & Year view inside calendar popover
  const [viewYear, setViewYear] = useState<number>(() => {
    const [y] = (currentDate || todayStr).split('-').map(Number);
    return y || new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const [, m] = (currentDate || todayStr).split('-').map(Number);
    return (m ? m - 1 : new Date().getMonth());
  });

  // When currentDate changes externally or calendar opens, align view
  useEffect(() => {
    const [y, m] = (currentDate || todayStr).split('-').map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [currentDate, todayStr, isCalendarOpen]);

  // Handle clicking anywhere outside or pressing Escape to close (Cancel)
  useEffect(() => {
    if (!isCalendarOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerBtnRef.current &&
        !triggerBtnRef.current.contains(target)
      ) {
        setIsCalendarOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarOpen]);

  const handlePrevDay = () => {
    onDateChange(shiftDate(currentDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(shiftDate(currentDate, 1));
  };

  const handleGoToday = () => {
    onDateChange(todayStr);
    setIsCalendarOpen(false);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Days calculation for viewMonth
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 6 = Sat

  const isRecorded = (dateStr: string): boolean => {
    if (!recordedDates) return false;
    if (recordedDates instanceof Set) {
      return recordedDates.has(dateStr);
    }
    return recordedDates.includes(dateStr);
  };

  const selectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const newDateStr = `${viewYear}-${mStr}-${dStr}`;
    onDateChange(newDateStr);
    setIsCalendarOpen(false);
  };

  return (
    <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-14 sm:top-16 z-20 shadow-2xs">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex flex-col items-center justify-center gap-1.5">
        {/* Center: Diary Date Controller with Left/Right Arrows */}
        <div className="relative inline-flex items-center justify-center" ref={containerRef}>
          {/* Core Symmetrical Trio: [ < ] [ Date Picker ] [ > ] */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {/* Previous Day Arrow Button */}
            <button
              type="button"
              onClick={handlePrevDay}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 active:scale-95 transition-all border border-slate-200/70 cursor-pointer shrink-0"
              title="이전 날짜로 (어제)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Date Picker Button Container (Relative for Popover) */}
            <div className="relative">
              <button
                ref={triggerBtnRef}
                type="button"
                onClick={() => setIsCalendarOpen((prev) => !prev)}
                className={`w-[216px] sm:w-[244px] h-9 sm:h-10 flex items-center justify-between px-2.5 sm:px-3 rounded-xl border transition-colors cursor-pointer group select-none shrink-0 ${
                  isCalendarOpen
                    ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-200 text-indigo-950'
                    : 'bg-slate-50 hover:bg-indigo-50/60 border-slate-200 hover:border-indigo-300 text-slate-900'
                }`}
                title="클릭하여 달력에서 날짜를 선택합니다 (화면 다른 곳을 누르면 취소)"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold tracking-tight tabular-nums truncate">
                    {formatDateWithDay(currentDate)}
                  </span>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <span className={`w-8 sm:w-9 text-center text-[10px] py-0.5 rounded-md shrink-0 ${dateBadge.bg}`}>
                    {dateBadge.text}
                  </span>

                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform duration-200 shrink-0 ${
                      isCalendarOpen ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </div>
              </button>

            {/* --- Interactive Calendar Popover Dropdown (Centered below date button) --- */}
            {isCalendarOpen && (
              <div
                ref={popoverRef}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-[300px] sm:w-[330px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Popover Header: Month & Year Navigator + Close (Cancel) */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer active:scale-95"
                    title="이전 달"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-indigo-600" />
                    <span>{viewYear}년 {viewMonth + 1}월</span>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer active:scale-95"
                      title="다음 달"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer active:scale-95 transition-colors ml-1"
                      title="닫기 (취소)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400">
                    <span className="text-rose-500">일</span>
                    <span>월</span>
                    <span>화</span>
                    <span>수</span>
                    <span>목</span>
                    <span>금</span>
                    <span className="text-sky-600">토</span>
                  </div>

                  {/* Day Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {/* Empty cells for padding */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-8" />
                    ))}

                    {/* Actual Days */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const mStr = String(viewMonth + 1).padStart(2, '0');
                      const dStr = String(day).padStart(2, '0');
                      const dayDateStr = `${viewYear}-${mStr}-${dStr}`;
                      const isSelected = dayDateStr === currentDate;
                      const isCurrentToday = dayDateStr === todayStr;
                      const hasActivity = isRecorded(dayDateStr);

                      // Weekday styling
                      const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
                      const isSunday = dayOfWeek === 0;
                      const isSaturday = dayOfWeek === 6;

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => selectDay(day)}
                          className={`h-8 w-8 sm:h-9 sm:w-9 mx-auto rounded-xl flex flex-col items-center justify-center text-xs font-semibold relative transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold shadow-xs scale-105'
                              : isCurrentToday
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-300 font-bold hover:bg-indigo-100'
                              : isSunday
                              ? 'text-rose-600 hover:bg-rose-50'
                              : isSaturday
                              ? 'text-sky-600 hover:bg-sky-50'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                          title={`${dayDateStr} 선택`}
                        >
                          <span>{day}</span>
                          {hasActivity && !isSelected && (
                            <span className="w-1 h-1 rounded-full bg-indigo-500 absolute bottom-1"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Shortcut Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap text-[11px]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleGoToday}
                        className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors"
                      >
                        오늘
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDateChange(shiftDate(todayStr, -1));
                          setIsCalendarOpen(false);
                        }}
                        className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        어제
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDateChange(shiftDate(todayStr, -3));
                          setIsCalendarOpen(false);
                        }}
                        className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        3일전
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDateChange(shiftDate(todayStr, -7));
                          setIsCalendarOpen(false);
                        }}
                        className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        7일전
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCalendarOpen(false)}
                        className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer font-medium"
                        title="달력 닫기 (취소)"
                      >
                        취소
                      </button>
                    </div>

                    {/* Direct native date input */}
                    <div className="relative flex items-center">
                      <input
                        ref={nativeDateInputRef}
                        type="date"
                        value={currentDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            onDateChange(e.target.value);
                            setIsCalendarOpen(false);
                          }
                        }}
                        className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 outline-none cursor-pointer hover:bg-slate-100 w-24"
                        title="직접 입력"
                      />
                    </div>
                  </div>
                </div>
            )}
          </div>

          {/* Next Day Arrow Button */}
          <button
            type="button"
            onClick={handleNextDay}
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 active:scale-95 transition-all border border-slate-200/70 cursor-pointer shrink-0"
            title="다음 날짜로 (내일)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* "오늘" Quick Return Button - Absolutely anchored to the right of [>], zero layout shift */}
        <div className="absolute left-full ml-1.5 sm:ml-2 top-1/2 -translate-y-1/2 shrink-0">
          <button
            type="button"
            onClick={handleGoToday}
            disabled={isToday}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-all duration-150 ${
              isToday
                ? 'opacity-0 pointer-events-none scale-90 invisible'
                : 'opacity-100 scale-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 active:scale-95 cursor-pointer shadow-2xs'
            }`}
            title={isToday ? '' : '오늘 날짜로 바로 이동'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

        {/* Activity Overview Chips: ONLY visible in 모아보기 (SummaryTab) per User Request */}
        {activeTab === 'summary' && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-0.5 animate-in fade-in duration-200 flex-wrap">
            <span className="text-slate-400">선택한 날짜 기록:</span>
            
            <div className="flex items-center gap-1.5 tabular-nums">
              <span 
                className={`flex items-center justify-center gap-1 px-2 py-0.5 rounded-md border font-medium min-w-[56px] ${
                  dayCompositionsCount > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
                title="영작 문장 수"
              >
                <PenTool className="w-3 h-3 shrink-0" />
                <span>영작 {dayCompositionsCount}</span>
              </span>

              <span 
                className={`flex items-center justify-center gap-1 px-2 py-0.5 rounded-md border font-medium min-w-[56px] ${
                  dayAudioCount > 0
                    ? 'bg-sky-50 border-sky-200 text-sky-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
                title="음성 & 녹음 수"
              >
                <Headphones className="w-3 h-3 shrink-0" />
                <span>음성 {dayAudioCount}</span>
              </span>

              <span 
                className={`flex items-center justify-center gap-1 px-2 py-0.5 rounded-md border font-medium min-w-[56px] ${
                  dayExpressionsCount > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
                title="주요 표현 수"
              >
                <BookOpen className="w-3 h-3 shrink-0" />
                <span>표현 {dayExpressionsCount}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import { DailyComposition, KeyExpression, AudioItem } from "../types";

export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDateWithDay = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    return `${y}년 ${m}월 ${d}일 (${dayName})`;
  } catch {
    return dateStr;
  }
};

export const formatCompactDate = (dateStr?: string, createdAt?: number): string => {
  let target = dateStr;
  if (!target && createdAt) {
    target = new Date(createdAt).toISOString().slice(0, 10);
  }
  if (!target) return '';
  try {
    const parts = target.split('-');
    if (parts.length === 3) {
      const yy = parts[0].slice(2);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const date = new Date(parseInt(parts[0], 10), m - 1, d);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[date.getDay()] || '';
      return `${yy}.${m}/${d} ${dayName}`;
    }
  } catch {
    // fallback
  }
  return target;
};

export const shiftDate = (dateStr: string, offsetDays: number): string => {
  try {
    const [y, m, d] = (dateStr || getTodayDateString()).split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offsetDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
};

export const INITIAL_COMPOSITIONS: DailyComposition[] = [
  {
    id: "comp-1",
    date: getTodayDateString(),
    korean: "오늘 회의에서 내 의견을 명확하게 말하기가 조금 어려웠어.",
    english: "Today meeting, it was difficult to speak my opinion clearly.",
    polished: "I found it a bit challenging to get my point across clearly during today's meeting.",
    polishedTip: "'speak my opinion' 대신 원어민 관용구 'get my point across' 사용",
    favorite: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "comp-2",
    date: getTodayDateString(),
    korean: "퇴근하고 운동 가려고 했는데, 너무 피곤해서 그냥 바로 집에 갔어.",
    english: "I tried to go exercise after work, but too tired so just went home.",
    polished: "I was planning to work out after work, but I was so exhausted that I headed straight home.",
    polishedTip: "'went home' 대신 'headed straight home'으로 생생한 뉘앙스 표현",
    favorite: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 1,
    updatedAt: Date.now() - 1000 * 60 * 60 * 1,
  }
];

export const INITIAL_EXPRESSIONS: KeyExpression[] = [
  {
    id: "expr-1",
    expression: "get my point across",
    meaning: "내 요점/생각을 상대에게 명확하게 전달하다",
    memo: "회의나 토론에서 자주 쓰는 필수 비즈니스 표현",
    favorite: true,
    date: getTodayDateString(),
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "expr-2",
    expression: "call it a day",
    meaning: "오늘 하루 일을 여기서 마무리하다, 퇴근하다",
    memo: "Let's call it a day! 퇴근할 때 사용하는 표현",
    favorite: true,
    date: getTodayDateString(),
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: "expr-3",
    expression: "play it by ear",
    meaning: "그때그때 상황 봐서 결정하다 (임기응변)",
    memo: "정해진 계획이 없을 때 가볍게 쓰기 좋음",
    favorite: false,
    date: getTodayDateString(),
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
  }
];

export const INITIAL_AUDIO_ITEMS: AudioItem[] = [];

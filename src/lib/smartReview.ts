import type { DailyComposition, KeyExpression } from '../types.ts';

export type ReviewDirection = 'en-ko' | 'ko-en';
export interface ReviewQuestion {
  id: string;
  sourceId: string;
  source: 'writing' | 'polished' | 'expression';
  english: string;
  korean: string;
  direction: ReviewDirection;
}
export interface ReviewAnswer {
  text: string;
  correct: boolean;
  feedback: string;
  method: 'ai' | 'self';
  answeredAt: number;
}
export interface ReviewSession {
  version: 1;
  date: string;
  timezone: 'Asia/Seoul';
  dayStart: number;
  questions: ReviewQuestion[];
  answers: Record<string, ReviewAnswer>;
  createdAt: number;
  completedAt: number | null;
}

// A single fixed calendar prevents travel/device time zones from splitting a day.
export function reviewDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function shiftReviewDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function isComplete(session?: ReviewSession): boolean {
  return !!session && session.completedAt !== null && session.questions.length > 0 &&
    session.questions.every(q => typeof session.answers[q.id]?.correct === 'boolean');
}
export const GROWTH_STAGES = [
  { days: 0, name: '새싹', emoji: '🌱' },
  { days: 7, name: '어린나무', emoji: '🌿' },
  { days: 14, name: '큰나무', emoji: '🌳' },
  { days: 30, name: '숲', emoji: '🌲' },
  { days: 60, name: '큰숲', emoji: '🌲🌳' },
  { days: 100, name: '지구', emoji: '🌍' },
] as const;

export function reviewStats(sessions: ReviewSession[], today: string) {
  const dates = [...new Set(sessions.filter(s => s.date <= today && isComplete(s)).map(s => s.date))].sort();
  const completed = new Set(dates);
  let cursor = completed.has(today) ? today : shiftReviewDate(today, -1);
  let streak = 0;
  while (completed.has(cursor)) { streak++; cursor = shiftReviewDate(cursor, -1); }
  let longest = 0, run = 0, previous = '';
  for (const date of dates) {
    run = previous && shiftReviewDate(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run); previous = date;
  }
  const stageIndex = GROWTH_STAGES.reduce((index, stage, i) => streak >= stage.days ? i : index, 0);
  const stage = GROWTH_STAGES[stageIndex], next = GROWTH_STAGES[stageIndex + 1];
  return { streak, longest, total: dates.length, stageIndex, stage, next,
    remaining: next ? next.days - streak : 0,
    progress: next ? Math.round((streak - stage.days) / (next.days - stage.days) * 100) : 100 };
}
function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function createReviewSession(date: string, compositions: DailyComposition[], expressions: KeyExpression[], history: ReviewSession[], now = Date.now()): ReviewSession {
  const seen = new Set<string>();
  const candidates: (Omit<ReviewQuestion, 'id' | 'direction'> & { spoken: number })[] = [];
  const add = (sourceId: string, source: ReviewQuestion['source'], english: string, korean: string, spoken = 0) => {
    english = english.trim(); korean = korean.trim();
    const key = `${english.toLowerCase()}\n${korean}`;
    // Do not truncate the meaning of a long passage or create a one-sided question.
    if (!english || !korean || english.length > 2000 || korean.length > 2000 || seen.has(key)) return;
    seen.add(key); candidates.push({ sourceId, source, english, korean, spoken });
  };
  for (const c of [...compositions].sort((a, b) => a.id.localeCompare(b.id))) {
    add(`writing:${c.id}`, c.polished?.trim() ? 'polished' : 'writing', c.polished?.trim() || c.english || '', c.korean || '');
  }
  for (const e of [...expressions].sort((a, b) => a.id.localeCompare(b.id))) add(`expression:${e.id}`, 'expression', e.expression || '', e.meaning || '', e.spokenCount || 0);
  const last = new Map<string, { date: string; correct: boolean }>();
  for (const session of [...history].filter(s => s.date < date).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const q of session.questions) {
      const answer = session.answers[q.id];
      if (answer) last.set(q.sourceId, { date: session.date, correct: answer.correct });
    }
  }
  const priority = (sourceId: string) => {
    const previous = last.get(sourceId);
    if (!previous) return 1000;
    const age = Math.max(0, (Date.parse(date) - Date.parse(previous.date)) / 86400000);
    return age * 100 + (previous.correct ? 0 : 350);
  };
  candidates.sort((a, b) => priority(b.sourceId) - priority(a.sourceId) || a.spoken - b.spoken || hash(date + a.sourceId) - hash(date + b.sourceId));
  const offset = hash(date) % 2;
  const questions = candidates.slice(0, 5).map(({ spoken, ...q }, i): ReviewQuestion => ({ ...q, id: `q${i}`, direction: (i + offset) % 2 ? 'en-ko' : 'ko-en' }));
  return { version: 1, date, timezone: 'Asia/Seoul', dayStart: Date.parse(`${date}T00:00:00+09:00`), questions, answers: {}, createdAt: now, completedAt: null };
}

// Shared by the transaction and tests. First saved answer wins across devices.
export function recordReviewAnswer(session: ReviewSession, questionId: string, answer: ReviewAnswer, now = Date.now()): ReviewSession {
  if (session.date !== reviewDate(new Date(now))) throw new Error('한국 시간 자정이 지났습니다. 오늘의 복습을 새로 시작해 주세요.');
  if (!session.questions.some(q => q.id === questionId)) throw new Error('복습 문항을 다시 불러와 주세요.');
  if (session.answers[questionId] || isComplete(session)) return session;
  if (!answer.text.trim() || answer.text.length > 2000 || typeof answer.correct !== 'boolean') throw new Error('답안을 1~2,000자로 입력해 주세요.');
  const answers = { ...session.answers, [questionId]: { ...answer, text: answer.text.trim(), feedback: answer.feedback.slice(0, 1000), answeredAt: now } };
  return { ...session, answers, completedAt: session.questions.every(q => answers[q.id]) ? now : null };
}

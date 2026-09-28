import type { DailyComposition, KeyExpression } from '../types.ts';

export type ReviewDirection = 'en-ko' | 'ko-en';
export interface ReviewQuestion {
  id: string;
  sourceId: string;
  source: 'writing' | 'polished' | 'expression';
  english: string;
  korean: string;
  direction: ReviewDirection;
  focus?: string;
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
  mode?: 'daily-short' | 'extra';
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
  { days: 3, name: '두 잎 새싹', emoji: '🌱' },
  { days: 7, name: '어린나무', emoji: '🌿' },
  { days: 14, name: '큰나무', emoji: '🌳' },
  { days: 21, name: '작은 숲', emoji: '🌳' },
  { days: 30, name: '숲', emoji: '🌲' },
  { days: 45, name: '울창한 숲', emoji: '🌲' },
  { days: 60, name: '큰숲', emoji: '🌲🌳' },
  { days: 90, name: '오래된 원시림', emoji: '🌳' },
  { days: 120, name: '열대우림', emoji: '🌴' },
  { days: 150, name: '아마존', emoji: '🦜' },
  { days: 180, name: '거대한 아마존', emoji: '🌴' },
  { days: 210, name: '생명의 낙원', emoji: '🦋' },
  { days: 240, name: '초록 대륙', emoji: '🌏' },
  { days: 300, name: '푸른 행성', emoji: '🌎' },
  { days: 365, name: '생명의 지구', emoji: '🌍' },
] as const;

export const FOREST_ANIMALS = [
  { days: 3, name: '나비', emoji: '🦋' },
  { days: 7, name: '꿀벌', emoji: '🐝' },
  { days: 14, name: '새', emoji: '🐦' },
  { days: 21, name: '토끼', emoji: '🐇' },
  { days: 30, name: '다람쥐', emoji: '🐿️' },
  { days: 45, name: '여우', emoji: '🦊' },
  { days: 60, name: '사슴', emoji: '🦌' },
  { days: 90, name: '부엉이', emoji: '🦉' },
  { days: 120, name: '앵무새', emoji: '🦜' },
  { days: 150, name: '원숭이', emoji: '🐒' },
  { days: 180, name: '재규어', emoji: '🐆' },
  { days: 210, name: '코끼리', emoji: '🐘' },
  { days: 240, name: '호랑이', emoji: '🐅' },
  { days: 300, name: '독수리', emoji: '🦅' },
  { days: 365, name: '고래', emoji: '🐋' },
] as const;

export function forestLife(streak: number) {
  return { animals: FOREST_ANIMALS.filter(a => a.days <= streak), nextAnimal: FOREST_ANIMALS.find(a => a.days > streak) };
}

export const sessionDay = (session: Pick<ReviewSession, 'date'>) => session.date.slice(0, 10);
export const isExtra = (session: ReviewSession) => session.mode === 'extra' || session.date.includes('~extra~');
export function dailySession(sessions: ReviewSession[], day: string): ReviewSession | undefined {
  const daily = sessions.filter(s => sessionDay(s) === day && !isExtra(s));
  return daily.find(isComplete) || daily.find(s => s.mode === 'daily-short') || daily[0];
}
export function reviewStats(sessions: ReviewSession[], today: string) {
  const dates = [...new Set(sessions.filter(s => !isExtra(s) && sessionDay(s) <= today && isComplete(s)).map(sessionDay))].sort();
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

export type ReviewCandidate = Omit<ReviewQuestion, 'id' | 'direction'> & { spoken: number; correction: boolean };
export function sentences(text: string): string[] {
  return text.trim().split(/(?<=[.!?。！？])(?:[\s]+|$)|[\r\n]+/u).map(s => s.trim()).filter(Boolean);
}
export function isShortReviewText(text: string): boolean {
  return !!text.trim() && text.length <= 300 && sentences(text).length <= 3;
}
export function localReviewCandidates(compositions: DailyComposition[], expressions: KeyExpression[]): ReviewCandidate[] {
  const candidates: ReviewCandidate[] = [];
  for (const c of [...compositions].sort((a,b) => a.id.localeCompare(b.id))) {
    if (!c.polished?.trim()) continue; // Never teach the uncorrected draft.
    const english = sentences(c.polished), korean = sentences(c.korean);
    const original = sentences(c.english);
    // Only align complete sentences where both versions have the same structure.
    // Mismatched passages require semantic extraction, not unrelated truncation.
    if (english.length !== korean.length) continue;
    english.forEach((en, i) => {
      if (!isShortReviewText(en) || !isShortReviewText(korean[i])) return;
      const correction = original.length !== english.length || original[i] !== en;
      candidates.push({ sourceId: `writing:${c.id}:${hash(en)}`, source: 'polished', english: en, korean: korean[i], spoken: 0, correction,
        focus: correction ? '첨삭으로 달라진 문장' : '다시 쓸 수 있는 핵심 문장' });
    });
  }
  for (const e of [...expressions].sort((a,b) => a.id.localeCompare(b.id))) {
    if (isShortReviewText(e.expression || '') && isShortReviewText(e.meaning || '')) candidates.push({ sourceId: `expression:${e.id}`, source: 'expression', english: e.expression.trim(), korean: e.meaning.trim(), spoken: e.spokenCount || 0, correction: false, focus: '내 주요 표현' });
  }
  return candidates;
}
export function focusedReviewCandidates(
  compositions: DailyComposition[], local: ReviewCandidate[],
  items: { id: string; english: string; korean: string; focus?: string }[],
): ReviewCandidate[] {
  const byId = new Map(compositions.map(c => [c.id, c]));
  const ai: ReviewCandidate[] = [];
  for (const item of items.slice(0, 20)) {
    const source = byId.get(item.id);
    if (!source || typeof item.english !== 'string' || typeof item.korean !== 'string') continue;
    const en = item.english.trim(), ko = item.korean.trim();
    if (!source.polished?.includes(en) || !isShortReviewText(en) || !isShortReviewText(ko)) continue;
    ai.push({ sourceId: `writing:${source.id}:${hash(en)}`, source: 'polished', english: en, korean: ko,
      spoken: 0, correction: true, focus: String(item.focus || '첨삭으로 달라진 표현').slice(0, 100) });
  }
  const focused = new Set(ai.map(c => c.sourceId.split(':')[1]));
  return [...ai, ...local.filter(c => c.source === 'expression' || !focused.has(c.sourceId.split(':')[1]))];
}
export function createReviewSession(date: string, compositions: DailyComposition[], expressions: KeyExpression[], history: ReviewSession[], now = Date.now(), options: { candidates?: ReviewCandidate[]; extra?: boolean; key?: string } = {}): ReviewSession {
  const unique = new Map<string, ReviewCandidate>();
  for (const c of options.candidates || localReviewCandidates(compositions, expressions)) {
    if (isShortReviewText(c.english) && isShortReviewText(c.korean)) unique.set(c.english.toLowerCase() + '\n' + c.korean, c);
  }
  const candidates = [...unique.values()];
  const last = new Map<string, { date: string; correct: boolean }>();
  const usedToday = new Map<string, number>();
  for (const session of [...history].sort((a,b) => a.createdAt - b.createdAt)) {
    for (const q of session.questions) {
      if (sessionDay(session) === date) usedToday.set(q.english, (usedToday.get(q.english) || 0) + 1);
      const answer = session.answers[q.id];
      if (answer && sessionDay(session) < date) last.set(q.sourceId, { date: sessionDay(session), correct: answer.correct });
    }
  }
  const priority = (c: ReviewCandidate) => {
    const prev = last.get(c.sourceId);
    return (prev ? Math.max(0, (Date.parse(date) - Date.parse(prev.date)) / 86400000) * 100 + (prev.correct ? 0 : 350) : 1000) + (c.correction ? 100 : 0);
  };
  candidates.sort((a,b) => (options.extra ? (usedToday.get(a.english) || 0) - (usedToday.get(b.english) || 0) : 0) || priority(b)-priority(a) || a.spoken-b.spoken || hash(date+a.sourceId)-hash(date+b.sourceId));
  // Reserve both corrected writing and saved expressions when both exist.
  const selected: ReviewCandidate[] = [];
  if (!options.extra) {
    const writing = candidates.filter(c => c.source === 'polished');
    const expressions = candidates.filter(c => c.source === 'expression');
    if (writing.length && expressions.length) selected.push(...writing.slice(0,3), ...expressions.slice(0,2));
  }
  for (const c of candidates) if (selected.length < (options.extra ? 1 : 5) && !selected.includes(c)) selected.push(c);
  const amount = options.extra ? 1 : 5;
  const offset = (hash(date) + (options.extra ? history.filter(s => sessionDay(s) === date).length : 0)) % 2;
  const questions: ReviewQuestion[] = [];
  for (let i=0; selected.length && i<amount; i++) {
    const { spoken, correction, ...q } = selected[i % selected.length];
    // With scarce sources, repeat briefly in the opposite direction to still do five.
    const direction = (selected.length === 1 ? i + offset : i < selected.length ? i + offset : (i % selected.length) + offset + Math.floor(i / selected.length)) % 2 ? 'en-ko' : 'ko-en';
    questions.push({ ...q, id: `q${i}`, direction });
  }
  return { version: 1, mode: options.extra ? 'extra' : 'daily-short', date: options.key || `${date}~short`, timezone: 'Asia/Seoul', dayStart: Date.parse(`${date}T00:00:00+09:00`), questions, answers: {}, createdAt: now, completedAt: null };
}

// Shared by the transaction and tests. First saved answer wins across devices.
export function recordReviewAnswer(session: ReviewSession, questionId: string, answer: ReviewAnswer, now = Date.now()): ReviewSession {
  if (sessionDay(session) !== reviewDate(new Date(now))) throw new Error('한국 시간 자정이 지났습니다. 오늘의 복습을 새로 시작해 주세요.');
  if (!session.questions.some(q => q.id === questionId)) throw new Error('복습 문항을 다시 불러와 주세요.');
  if (session.answers[questionId] || isComplete(session)) return session;
  if (!answer.text.trim() || answer.text.length > 2000 || typeof answer.correct !== 'boolean') throw new Error('답안을 1~2,000자로 입력해 주세요.');
  const answers = { ...session.answers, [questionId]: { ...answer, text: answer.text.trim(), feedback: answer.feedback.slice(0, 1000), answeredAt: now } };
  return { ...session, answers, completedAt: session.questions.every(q => answers[q.id]) ? now : null };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReviewSession, isComplete, recordReviewAnswer, reviewDate, reviewStats, shiftReviewDate } from '../src/lib/smartReview.ts';
import type { ReviewAnswer, ReviewSession } from '../src/lib/smartReview.ts';

const date = '2026-09-26';
const now = Date.parse(`${date}T10:00:00+09:00`);
const comp = (id = 'one') => ({ id, date, korean: `한국어 ${id}`, english: `English ${id}`, polished: `Polished ${id}`, createdAt: 1, updatedAt: 1 });
const answer: ReviewAnswer = { text: 'my answer', correct: false, feedback: 'try again', method: 'self', answeredAt: now };
const session = (day = date, amount = 1) => createReviewSession(day, Array.from({ length: amount }, (_, i) => comp(String(i))), [], [], Date.parse(`${day}T10:00:00+09:00`));
const finished = (day: string) => {
  const s = session(day);
  return recordReviewAnswer(s, 'q0', answer, Date.parse(`${day}T10:00:00+09:00`));
};

test('Korean midnight is independent of device timezone, including year rollover', () => {
  assert.equal(reviewDate(new Date('2026-09-26T14:59:59Z')), '2026-09-26');
  assert.equal(reviewDate(new Date('2026-09-26T15:00:00Z')), '2026-09-27');
  assert.equal(reviewDate(new Date('2026-12-31T15:00:00Z')), '2027-01-01');
  assert.equal(shiftReviewDate('2024-03-01', -1), '2024-02-29');
});
test('all wrong answers still finish a day and maintain streak', () => {
  let s = session(date, 5);
  for (let i = 0; i < 5; i++) s = recordReviewAnswer(s, `q${i}`, answer, now);
  assert.ok(isComplete(s));
  assert.equal(Object.values(s.answers).filter(a => a.correct).length, 0);
  assert.equal(reviewStats([finished('2026-09-25'), s], date).streak, 2);
});
test('today remains available until midnight; missed and partial days break streak', () => {
  const history = [finished('2026-09-24'), finished('2026-09-25')];
  assert.equal(reviewStats(history, date).streak, 2);
  assert.equal(reviewStats([...history, session(date)], '2026-09-27').streak, 0);
  const resumed = reviewStats([...history, finished('2026-09-27')], '2026-09-27');
  assert.equal(resumed.streak, 1); assert.equal(resumed.longest, 2); assert.equal(resumed.total, 3);
});
test('partial completion never counts, even with forged completedAt', () => {
  const s = recordReviewAnswer(session(date, 5), 'q0', answer, now);
  assert.equal(isComplete(s), false);
  assert.equal(isComplete({ ...s, completedAt: now }), false);
  assert.equal(isComplete({ ...s, questions: [] }), false);
});
test('no backfill, no empty answer, no invalid question, first answer wins', () => {
  assert.throws(() => recordReviewAnswer(session('2026-09-25'), 'q0', answer, now), /자정/);
  assert.throws(() => recordReviewAnswer(session(), 'q0', { ...answer, text: '  ' }, now), /답안/);
  assert.throws(() => recordReviewAnswer(session(), 'q9', answer, now), /문항/);
  const s = recordReviewAnswer(session(), 'q0', answer, now);
  assert.equal(recordReviewAnswer(s, 'q0', { ...answer, correct: true }, now), s);
  assert.equal(s.answers.q0.correct, false);
});
test('selection is deterministic, uses polished text and both directions, caps at five', () => {
  const sources = Array.from({ length: 10 }, (_, i) => comp(String(i)));
  const a = createReviewSession(date, sources, [], [], now);
  const b = createReviewSession(date, sources.reverse(), [], [], now);
  assert.deepEqual(a, b); assert.equal(a.questions.length, 5);
  assert.equal(new Set(a.questions.map(q => q.direction)).size, 2);
  assert.ok(a.questions.every(q => q.source === 'polished' && q.english.startsWith('Polished')));
});
test('uses unpolished writing and expressions; excludes incomplete, long and duplicate sources', () => {
  const c = { ...comp(), polished: '' };
  const expressions = [{ id: 'e', date, createdAt: 1, expression: 'Hello', meaning: '안녕' }];
  const a = createReviewSession(date, [c, { ...comp('empty'), korean: '' }, { ...comp('long'), polished: 'a'.repeat(2001) }, { ...c, id: 'duplicate' }], expressions, [], now);
  assert.equal(a.questions.length, 2);
  assert.ok(a.questions.some(q => q.source === 'writing'));
  assert.ok(a.questions.some(q => q.source === 'expression'));
  assert.equal(createReviewSession(date, [], [], [], now).questions.length, 0);
});
test('overdue and incorrect sources rise above recently correct items', () => {
  const sources = Array.from({ length: 8 }, (_, i) => comp(String(i)));
  const history: ReviewSession[] = sources.map((c, i) => {
    const day = i === 7 ? '2026-09-01' : '2026-09-25';
    const s = createReviewSession(day, [c], [], [], now);
    return recordReviewAnswer(s, 'q0', { ...answer, correct: i !== 6 }, Date.parse(`${day}T10:00:00+09:00`));
  });
  const a = createReviewSession(date, sources, [], history, now);
  assert.equal(a.questions[0].sourceId, 'writing:7');
  assert.equal(a.questions[1].sourceId, 'writing:6');
});
test('growth thresholds, duplicate dates and future records are handled', () => {
  const history = Array.from({ length: 100 }, (_, i) => finished(shiftReviewDate(date, i - 99)));
  const stats = reviewStats([...history, history[0], finished('2026-09-27')], date);
  assert.equal(stats.streak, 100); assert.equal(stats.stage.name, '지구'); assert.equal(stats.progress, 100); assert.equal(stats.total, 100);
  assert.equal(reviewStats(history.slice(-30), date).stage.name, '숲');
  const tree = reviewStats(history.slice(-7), date);
  assert.equal(tree.stage.name, '어린나무'); assert.equal(tree.remaining, 7); assert.equal(tree.progress, 0);
});

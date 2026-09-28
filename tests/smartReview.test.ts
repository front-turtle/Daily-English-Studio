import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReviewSession, dailySession, focusedReviewCandidates, forestLife, GROWTH_STAGES, isComplete, isShortReviewText, localReviewCandidates, recordReviewAnswer, reviewDate, reviewStats, shiftReviewDate } from '../src/lib/smartReview.ts';
import type { ReviewAnswer, ReviewSession } from '../src/lib/smartReview.ts';

const date = '2026-09-26';
const now = Date.parse(`${date}T10:00:00+09:00`);
const comp = (id = 'one') => ({ id, date, korean: `한국어 ${id}`, english: `English ${id}`, polished: `Polished ${id}`, createdAt: 1, updatedAt: 1 });
const answer: ReviewAnswer = { text: 'my answer', correct: false, feedback: 'try again', method: 'self', answeredAt: now };
const session = (day = date, amount = 1) => createReviewSession(day, Array.from({ length: amount }, (_, i) => comp(String(i))), [], [], Date.parse(`${day}T10:00:00+09:00`));
const finished = (day: string) => {
  let s = session(day);
  for (const q of s.questions) s = recordReviewAnswer(s, q.id, answer, Date.parse(`${day}T10:00:00+09:00`));
  return s;
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
test('only corrected writing and saved expressions are used; long passages are excluded locally', () => {
  const c = { ...comp(), polished: '' };
  const expressions = [{ id: 'e', date, createdAt: 1, expression: 'Hello', meaning: '안녕' }];
  const a = createReviewSession(date, [c, { ...comp('empty'), korean: '' }, { ...comp('long'), polished: 'a'.repeat(2001) }, { ...c, id: 'duplicate' }], expressions, [], now);
  assert.equal(a.questions.length, 5);
  assert.ok(a.questions.every(q => q.source === 'expression'));
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
  assert.ok(a.questions[0].sourceId.startsWith('writing:7:'));
  assert.ok(a.questions[1].sourceId.startsWith('writing:6:'));
});

test('long corrected writing is split into short aligned sentences and correction points are preferred', () => {
  const c = { ...comp('story'), korean: '나는 집에 갔다. 비가 내렸다. 나는 우산을 썼다. 친구를 만났다.',
    english: 'I go home. It rain. I use umbrella. I meet friend.',
    polished: 'I went home. It was raining. I used an umbrella. I met a friend.' };
  const picked = localReviewCandidates([c], []);
  assert.equal(picked.length, 4);
  assert.ok(picked.every(p => p.english !== c.polished && p.correction && isShortReviewText(p.english)));
  assert.ok(picked.some(p => p.english === 'It was raining.' && p.korean === '비가 내렸다.'));
  const review = createReviewSession(date, [c], [], [], now);
  assert.equal(review.questions.length, 5);
  assert.ok(review.questions.every(q => q.english !== c.polished && isShortReviewText(q.english) && isShortReviewText(q.korean)));
});

test('daily five questions mix corrected writing and expressions and extra practice never changes streak', () => {
  const expressions = [{ id: 'useful', date, expression: 'I will be there soon.', meaning: '곧 그곳에 갈게.', createdAt: 1 }];
  const base = createReviewSession(date, [comp('a'), comp('b'), comp('c')], expressions, [], now);
  assert.equal(base.questions.length, 5);
  assert.ok(base.questions.some(q => q.source === 'polished'));
  assert.ok(base.questions.some(q => q.source === 'expression'));
  let completed = base;
  for (const q of base.questions) completed = recordReviewAnswer(completed, q.id, answer, now);
  const extra = createReviewSession(date, [comp('a'), comp('b'), comp('c')], expressions, [completed], now + 1,
    { extra: true, key: `${date}~extra~123` });
  assert.equal(extra.questions.length, 1);
  assert.equal(dailySession([extra, completed], date)?.date, completed.date);
  assert.equal(reviewStats([extra, completed], date).streak, 1);
  assert.equal(reviewStats([extra], date).streak, 0);
  assert.equal(recordReviewAnswer(extra, 'q0', answer, now).completedAt, now);
});

test('question is at most three sentences in both languages', () => {
  assert.equal(isShortReviewText('One. Two. Three.'), true);
  assert.equal(isShortReviewText('One. Two. Three. Four.'), false);
  assert.equal(isShortReviewText('하나. 둘. 셋. 넷.'), false);
});

test('AI focus suggestions must come from the saved correction and remain short', () => {
  const c = { ...comp('long'), polished: 'I should have called you before leaving. I will call tomorrow.',
    english: 'I should call you before leaving. I call tomorrow.', korean: '떠나기 전에 전화했어야 했어. 내일 전화할게.' };
  const local = localReviewCandidates([c], []);
  const selected = focusedReviewCandidates([c], local, [
    { id: 'long', english: 'I should have called you before leaving.', korean: '떠나기 전에 전화했어야 했어.', focus: 'should have + 과거분사' },
    { id: 'long', english: 'I should call you before leaving.', korean: '떠나기 전에 전화해야 해.' },
    { id: 'long', english: 'I will call tomorrow.', korean: '하나. 둘. 셋. 넷.' },
  ]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].english, 'I should have called you before leaving.');
  assert.equal(selected[0].focus, 'should have + 과거분사');
});
test('growth thresholds, duplicate dates and future records are handled', () => {
  const history = Array.from({ length: 365 }, (_, i) => finished(shiftReviewDate(date, i - 364)));
  const stats = reviewStats([...history, history[0], finished('2026-09-27')], date);
  assert.equal(stats.streak, 365); assert.equal(stats.stage.name, '생명의 지구'); assert.equal(stats.progress, 100); assert.equal(stats.total, 365);
  assert.equal(reviewStats(history.slice(-30), date).stage.name, '숲');
  const tree = reviewStats(history.slice(-7), date);
  assert.equal(tree.stage.name, '어린나무'); assert.equal(tree.remaining, 7); assert.equal(tree.progress, 0);
});

 test('all 16 milestones and animal arrivals follow the current streak through and beyond one year', () => {
  const history = Array.from({ length: 400 }, (_, i) => finished(shiftReviewDate(date, i - 399)));
  for (const stage of GROWTH_STAGES) {
    const days = stage.days;
    const stats = reviewStats(days ? history.slice(-days) : [], date);
    assert.equal(stats.stage.name, stage.name);
    assert.equal(stats.progress, days === 365 ? 100 : 0);
    if (days > 0) assert.notEqual(reviewStats(history.slice(-(days - 1)).filter(() => days > 1), date).stage.name, stage.name);
  }
  assert.equal(forestLife(0).animals.length, 0);
  assert.equal(forestLife(3).animals[0].name, '나비');
  assert.equal(forestLife(150).animals.at(-1).name, '원숭이');
  assert.equal(forestLife(365).animals.length, 15);
  assert.equal(forestLife(400).nextAnimal, undefined);
  assert.equal(reviewStats(history, date).stage.name, '생명의 지구');
  assert.equal(reviewStats(history, date).progress, 100);
  const broken = reviewStats(history, shiftReviewDate(date, 2));
  assert.equal(forestLife(broken.streak).animals.length, 0);
});

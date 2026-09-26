import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { startReviewInDatabase, saveReviewAnswerInDatabase } from '../src/lib/smartReviewRepository.ts';

let environment;
const now = Date.now();
const dayStart = now - ((now + 32400000) % 86400000);
const date = new Date(dayStart + 32400000).toISOString().slice(0, 10);
const base = { version: 1, timezone: 'Asia/Seoul', date, dayStart, createdAt: now, completedAt: null,
  questions: [{ id: 'q0', english: 'Hello', korean: '안녕', sourceId: 'test', source: 'expression', direction: 'en-ko' }], answers: {} };
const result = { text: '안녕', correct: true, feedback: '맞아요', method: 'self', answeredAt: now };
const ref = uid => doc(environment.authenticatedContext(uid).firestore(), 'users', 'owner', 'smartReviews', date);
before(async () => { environment = await initializeTestEnvironment({ projectId: 'demo-smart-review', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => { await environment.clearFirestore(); });
after(async () => { await environment?.cleanup(); });
test('only owner can read/create/update; anonymous and other accounts are denied', async () => {
  await assertSucceeds(setDoc(ref('owner'), base));
  await assertSucceeds(getDoc(ref('owner')));
  await assertFails(getDoc(ref('stranger')));
  await assertFails(setDoc(ref('stranger'), { ...base, answers: { q0: result }, completedAt: now }));
  const guest = doc(environment.unauthenticatedContext().firestore(), 'users', 'owner', 'smartReviews', date);
  await assertFails(getDoc(guest));
});
test('complete after answering; completed history cannot be reset, edited or deleted', async () => {
  await setDoc(ref('owner'), base);
  const done = { ...base, answers: { q0: result }, completedAt: now };
  await assertSucceeds(setDoc(ref('owner'), done));
  await assertFails(setDoc(ref('owner'), base));
  await assertFails(setDoc(ref('owner'), { ...done, answers: { q0: { ...result, correct: false } } }));
  await assertFails(deleteDoc(ref('owner')));
});
test('cannot complete empty sessions, alter questions, or backfill an expired day', async () => {
  await assertFails(setDoc(ref('owner'), { ...base, questions: [] }));
  await assertFails(setDoc(ref('owner'), { ...base, dayStart: dayStart - 86400000 }));
  await setDoc(ref('owner'), base);
  await assertFails(setDoc(ref('owner'), { ...base, completedAt: now }));
  await assertFails(setDoc(ref('owner'), { ...base, questions: [{ ...base.questions[0], english: 'changed' }], answers: { q0: result }, completedAt: now }));
});
test('two devices racing to start or answer preserve first committed state', async () => {
  const first = environment.authenticatedContext('owner').firestore();
  const second = environment.authenticatedContext('owner').firestore();
  const starts = await Promise.all([startReviewInDatabase(first, 'owner', base), startReviewInDatabase(second, 'owner', { ...base, createdAt: now + 1 })]);
  assert.deepEqual(starts[0].questions, starts[1].questions);
  const saves = await Promise.all([saveReviewAnswerInDatabase(first, 'owner', date, 'q0', result), saveReviewAnswerInDatabase(second, 'owner', date, 'q0', { ...result, correct: false })]);
  assert.deepEqual(saves[0].answers, saves[1].answers);
  const final = (await getDoc(ref('owner'))).data();
  assert.equal(Object.keys(final.answers).length, 1);
  assert.ok(final.completedAt >= now);
});

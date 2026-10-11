import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { startReviewInDatabase, saveReviewAnswerInDatabase } from '../src/lib/smartReviewRepository.ts';
import { writeStickyNote, removeStickyNote } from '../src/lib/stickyNotesRepository.ts';

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
test('sticky notes isolate owners and merge independent devices without recreating deleted notes', async () => {
  const first = environment.authenticatedContext('owner').firestore();
  const second = environment.authenticatedContext('owner').firestore();
  const stranger = environment.authenticatedContext('stranger').firestore();
  const guest = environment.unauthenticatedContext().firestore();
  const note = { id: 'one', title: '', body: '', color: 'yellow', createdAt: now, updatedAt: now };
  await assertSucceeds(writeStickyNote(first, 'owner', 'one', {}, note));
  await assertFails(writeStickyNote(stranger, 'owner', 'one', { body: 'attack' }));
  await assertFails(getDoc(doc(guest, 'users', 'owner')));
  await assertFails(removeStickyNote(stranger, 'owner', 'one'));
  await Promise.all([writeStickyNote(first, 'owner', 'one', { body: 'device one' }), writeStickyNote(second, 'owner', 'two', {}, { ...note, id: 'two', body: 'device two' })]);
  await Promise.all([writeStickyNote(first, 'owner', 'one', { title: 'title' }), writeStickyNote(second, 'owner', 'one', { color: 'blue' })]);
  const saved = (await getDoc(doc(second, 'users', 'owner'))).data().stickyNotes;
  assert.equal(saved.one.body, 'device one'); assert.equal(saved.one.title, 'title'); assert.equal(saved.one.color, 'blue'); assert.equal(saved.two.body, 'device two');
  await removeStickyNote(second, 'owner', 'one');
  await assert.rejects(writeStickyNote(first, 'owner', 'one', { body: 'stale edit' }), /삭제된 메모/);
  assert.equal((await getDoc(doc(first, 'users', 'owner'))).data().stickyNotes.one, undefined);
});
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

test('short daily and optional one-question records sync separately without changing completion', async () => {
  const owner = environment.authenticatedContext('owner').firestore();
  const shortKey = `${date}~short`, extraKey = `${date}~extra~${now}`;
  const short = { ...base, date: shortKey, mode: 'daily-short', questions: Array.from({ length: 5 }, (_, i) => ({ ...base.questions[0], id: `q${i}` })) };
  const extra = { ...base, date: extraKey, mode: 'extra' };
  const shortRef = doc(owner, 'users', 'owner', 'smartReviews', shortKey);
  const extraRef = doc(owner, 'users', 'owner', 'smartReviews', extraKey);
  await assertSucceeds(startReviewInDatabase(owner, 'owner', short));
  await assertFails(setDoc(extraRef, { ...extra, questions: short.questions }));
  for (let i = 0; i < 5; i++) await assertSucceeds(saveReviewAnswerInDatabase(owner, 'owner', shortKey, `q${i}`, result));
  assert.ok((await getDoc(shortRef)).data().completedAt);
  await assertSucceeds(startReviewInDatabase(owner, 'owner', extra));
  await assertSucceeds(saveReviewAnswerInDatabase(owner, 'owner', extraKey, 'q0', result));
  assert.ok((await getDoc(shortRef)).data().completedAt);
  assert.equal(Object.keys((await getDoc(extraRef)).data().answers).length, 1);
});

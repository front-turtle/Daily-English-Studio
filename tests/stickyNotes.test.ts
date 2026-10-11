import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notePreview, parseNotes, MAX_NOTES, MAX_NOTE_BODY } from '../src/lib/stickyNotes.ts';
const note = { id: 'one', title: '', body: '\nfirst line\nsecond line', color: 'yellow' as const, createdAt: 1, updatedAt: 1 };
test('preview uses optional title, then first nonempty line, then placeholder', () => {
  assert.equal(notePreview(note), 'first line');
  assert.equal(notePreview({ ...note, title: ' Title ' }), 'Title');
  assert.equal(notePreview({ ...note, body: ' \n ' }), '새 메모');
});
test('remote parser rejects malformed records and sorts deterministically', () => {
  assert.deepEqual(parseNotes(null), []);
  assert.deepEqual(parseNotes([note]), []);
  assert.deepEqual(parseNotes({ one: note, mismatch: note, bad: { ...note, id: 'bad', body: 3 }, newer: { ...note, id: 'newer', createdAt: 2 } }).map(n => n.id), ['newer', 'one']);
  assert.ok(MAX_NOTES * MAX_NOTE_BODY * 4 < 700000);
});

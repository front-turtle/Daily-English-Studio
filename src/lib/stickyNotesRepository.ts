import { doc, runTransaction, FieldPath, deleteField, type Firestore } from 'firebase/firestore';
import { MAX_NOTES, MAX_NOTE_BODY, MAX_NOTE_TITLE, NOTE_COLORS, type StickyNote } from './stickyNotes.ts';

export type NotePatch = Partial<Pick<StickyNote, 'title' | 'body' | 'color'>>;
export async function writeStickyNote(database: Firestore, uid: string, id: string, patch: NotePatch, create?: StickyNote) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('잘못된 메모 ID입니다.');
  const ref = doc(database, 'users', uid);
  await runTransaction(database, async transaction => {
    const snapshot = await transaction.get(ref);
    const notes = snapshot.data()?.stickyNotes || {};
    const existing = notes[id];
    if (!existing && !create) throw new Error('다른 기기에서 삭제된 메모입니다. 내용을 복사한 뒤 새 메모를 만들어 주세요.');
    if (!existing && Object.keys(notes).length >= MAX_NOTES) throw new Error(`메모는 최대 ${MAX_NOTES}장까지 저장할 수 있습니다.`);
    const note = { ...(existing || create), ...patch, updatedAt: Date.now() } as StickyNote;
    if (note.title.length > MAX_NOTE_TITLE || note.body.length > MAX_NOTE_BODY || !NOTE_COLORS.includes(note.color)) throw new Error('메모 길이 또는 색상을 확인해 주세요.');
    if (snapshot.exists()) transaction.update(ref, new FieldPath('stickyNotes', id), note);
    else transaction.set(ref, { stickyNotes: { [id]: note } });
  });
}
export async function removeStickyNote(database: Firestore, uid: string, id: string) {
  const ref = doc(database, 'users', uid);
  await runTransaction(database, async transaction => {
    if ((await transaction.get(ref)).exists()) transaction.update(ref, new FieldPath('stickyNotes', id), deleteField());
  });
}

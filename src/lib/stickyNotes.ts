export const NOTE_COLORS = ['yellow', 'green', 'blue', 'purple', 'pink'] as const;
export type NoteColor = typeof NOTE_COLORS[number];
export interface StickyNote {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  createdAt: number;
  updatedAt: number;
}
// Bound the map to leave ample room in the existing user document (1 MiB).
export const MAX_NOTES = 40;
export const MAX_NOTE_BODY = 4000;
export const MAX_NOTE_TITLE = 100;
export const notePreview = (note: StickyNote) => note.title.trim() || note.body.split('\n').find(line => line.trim())?.trim() || '새 메모';
export function parseNotes(raw: unknown): StickyNote[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw).flatMap(([id, value]) => {
    const note = value as StickyNote;
    return note && note.id === id && typeof note.title === 'string' && typeof note.body === 'string'
      && NOTE_COLORS.includes(note.color) && Number.isFinite(note.createdAt) && Number.isFinite(note.updatedAt) ? [note] : [];
  }).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

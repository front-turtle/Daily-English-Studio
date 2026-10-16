import React, { useState } from 'react';
import { Plus, StickyNote as NoteIcon, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStickyNotes } from '../hooks/useStickyNotes';
import { MAX_NOTES, MAX_NOTE_BODY, MAX_NOTE_TITLE, NOTE_COLORS, notePreview, type NoteColor, type StickyNote } from '../lib/stickyNotes';

const colors: Record<NoteColor, string> = { yellow: 'bg-amber-100 border-amber-200', green: 'bg-lime-100 border-lime-200', blue: 'bg-sky-100 border-sky-200', purple: 'bg-violet-100 border-violet-200', pink: 'bg-rose-100 border-rose-200' };
const labels: Record<NoteColor, string> = { yellow: '노랑', green: '연두', blue: '하늘', purple: '보라', pink: '분홍' };
export function StickyNotesTab() {
  const { user, loading, signInWithGoogle } = useAuth();
  return <Notebook key={user?.uid || 'guest'} uid={user?.uid} loading={loading} signIn={signInWithGoogle} />;
}
function Notebook({ uid, loading, signIn }: { uid?: string; loading: boolean; signIn: () => Promise<void> }) {
  const { notes, ready, error, pending, change, remove, retry } = useStickyNotes(uid);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [newId, setNewId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const create = () => {
    const note: StickyNote = { id: crypto.randomUUID(), title: '', body: '', color: 'yellow', createdAt: Date.now(), updatedAt: Date.now() };
    change(note, {}, true); setNewId(note.id);
  };
  return <section aria-label="메모장" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><NoteIcon className="text-amber-500" />메모장</h2>
        <p className="mt-1 text-sm text-slate-500">단어를 정리하고, 예문과 영작을 넉넉한 공간에 기록해 보세요.</p></div>
      {uid && <button onClick={create} disabled={!ready || notes.length >= MAX_NOTES} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={17} />새 메모</button>}
    </div>
    {loading ? <p role="status">로그인 확인 중…</p> : !uid ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><p className="mb-4">로그인하면 메모가 자동 저장되고 다른 기기에서도 이어서 쓸 수 있어요.</p><button onClick={() => void signIn()} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white">Google 로그인</button></div> : <>
      <div role="status" className="text-xs text-slate-500">{!ready ? '메모 불러오는 중…' : Object.keys(pending).length ? '저장 대기 중 · 입력 내용은 이 기기에 임시 보관됩니다.' : '모든 메모 저장 완료 · 로그인한 기기에서 동기화됩니다.'} {notes.length}/{MAX_NOTES}장</div>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error} <button className="ml-2 underline" onClick={() => void retry()}>다시 저장</button></div>}
      {ready && !notes.length && <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-10 text-center text-slate-600">아직 메모가 없어요. ‘새 메모’로 첫 포스트잇을 만들어 보세요.</div>}
      {notes.length >= MAX_NOTES && <p className="text-sm text-slate-600">새 메모를 만들려면 사용하지 않는 메모를 삭제해 주세요.</p>}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2" data-testid="sticky-note-grid">
        {notes.map(note => <article key={note.id} aria-label={notePreview(note)} className={`min-w-0 rounded-2xl border p-5 shadow-sm ${expandedId === note.id ? 'md:col-span-2' : ''} ${colors[note.color]}`}>
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="min-w-0 truncate text-sm font-bold text-slate-700">{notePreview(note)}</h3><div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={expandedId === note.id ? '메모 축소' : '메모 크게 보기'} title={expandedId === note.id ? '작게 보기' : '크게 보기'} onClick={() => setExpandedId(id => id === note.id ? null : note.id)} className="rounded-lg p-2 text-slate-600 hover:bg-white/60">{expandedId === note.id ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button><button aria-label={`${notePreview(note)} 삭제`} onClick={() => setDeleteId(note.id)} className="rounded-lg p-2 text-slate-500 hover:bg-white/60"><Trash2 size={16} /></button></div></div>
          <input aria-label="메모 제목" autoFocus={note.id === newId} placeholder="제목 (선택)" maxLength={MAX_NOTE_TITLE} value={note.title} onChange={e => change(note, { title: e.target.value })} className="mb-2 w-full rounded-lg border border-transparent bg-white/30 px-2 py-2 text-sm font-semibold outline-none focus:border-slate-400" />
          <textarea aria-label="메모 내용" placeholder="자유롭게 적어 보세요…" maxLength={MAX_NOTE_BODY} value={note.body} onChange={e => change(note, { body: e.target.value })} className={`w-full resize-y rounded-lg border border-transparent bg-white/40 px-3 py-3 text-base leading-7 outline-none focus:border-slate-400 ${expandedId === note.id ? 'min-h-[60vh]' : 'min-h-72'}`} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div role="group" aria-label="포스트잇 색상" className="flex gap-2">{NOTE_COLORS.map(color => <button key={color} aria-label={`${labels[color]} 포스트잇`} aria-pressed={note.color === color} onClick={() => change(note, { color })} className={`h-7 w-7 rounded-full border ${colors[color]} ${note.color === color ? 'ring-2 ring-slate-500 ring-offset-2' : ''}`} />)}</div><span className="text-xs text-slate-500">{pending[note.id] ? '저장 대기' : '저장됨'} · {note.body.length}/{MAX_NOTE_BODY}</span></div>
          {deleteId === note.id && <div className="mt-3 rounded-xl bg-white/70 p-3"><p className="mb-2 text-sm">이 메모를 삭제할까요?</p><div className="flex gap-3"><button disabled={removing} className="text-sm font-bold text-rose-700" onClick={async () => { setRemoving(true); await remove(note.id); setRemoving(false); setDeleteId(null); }}>삭제</button><button disabled={removing} className="text-sm" onClick={() => setDeleteId(null)}>취소</button></div></div>}
        </article>)}
      </div>
    </>}
  </section>;
}

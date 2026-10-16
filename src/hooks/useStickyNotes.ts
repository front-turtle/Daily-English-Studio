import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseNotes, type StickyNote } from '../lib/stickyNotes';
import { writeStickyNote, removeStickyNote, type NotePatch } from '../lib/stickyNotesRepository';

interface Draft { note: StickyNote; patch: NotePatch; create: boolean; revision: number }
export function useStickyNotes(uid?: string) {
  const key = `sticky_note_drafts_v1_${uid}`;
  const [cloud, setCloud] = useState<StickyNote[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Record<string, Draft>>(() => {
    if (!uid) return {};
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      return Object.fromEntries(Object.entries(raw).filter(([id, value]) => {
        const draft = value as Draft;
        return /^[a-zA-Z0-9-]+$/.test(id) && draft?.note?.id === id && parseNotes({ [id]: draft.note }).length && draft.patch && typeof draft.create === 'boolean';
      })) as Record<string, Draft>;
    } catch { return {}; }
  });
  const drafts = useRef(pending);
  // Keep successfully sent edits visible until a Firestore snapshot confirms them.
  // Otherwise the UI briefly reverts to an older cloud value after each save.
  const [confirmed, setConfirmed] = useState<Record<string, Draft>>({});
  const confirmedRef = useRef<Record<string, Draft>>({});
  const acknowledge = (id: string, draft: Draft) => {
    const next = { ...confirmedRef.current, [id]: draft };
    confirmedRef.current = next;
    if (mounted.current) setConfirmed(next);
  };
  const busy = useRef(false);
  const deleting = useRef(new Set<string>());
  const mounted = useRef(true);
  const retryAfter = useRef(0);
  const persist = (next: Record<string, Draft>) => {
    drafts.current = next;
    if (mounted.current) setPending(next);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { if (mounted.current) setError('이 기기에 임시 저장할 공간이 부족합니다. 화면을 닫기 전에 저장 상태를 확인해 주세요.'); }
  };
  const flush = async () => {
    if (!uid || busy.current || Date.now() < retryAfter.current) return;
    busy.current = true;
    try {
      for (const [id, draft] of Object.entries(drafts.current)) {
        if (deleting.current.has(id)) continue;
        try {
          await writeStickyNote(db, uid, id, draft.patch, draft.create ? draft.note : undefined);
          // Preserve the just-written version through the server round trip.
          acknowledge(id, draft);
          const current = drafts.current[id];
          if (current?.revision === draft.revision) {
            const next = { ...drafts.current }; delete next[id]; persist(next);
          } else if (current) persist({ ...drafts.current, [id]: { ...current, create: false } });
          if (mounted.current) setError('');
        } catch (reason) {
          retryAfter.current = Date.now() + 15000;
          if (mounted.current) setError(reason instanceof Error ? reason.message : '저장하지 못했습니다. 연결을 확인하고 다시 저장해 주세요.');
          break;
        }
      }
    } finally { busy.current = false; }
  };
  const flushRef = useRef(flush); flushRef.current = flush;
  useEffect(() => {
    mounted.current = true;
    if (!uid) return;
    const unsubscribe = onSnapshot(doc(db, 'users', uid), snapshot => {
      const remote = parseNotes(snapshot.data()?.stickyNotes);
      const remoteMap = new Map(remote.map(note => [note.id, note]));
      const remaining = Object.fromEntries(Object.entries(confirmedRef.current).filter(([id, draft]) => {
        const found = remoteMap.get(id);
        // Ignore out-of-date snapshots while a local write is waiting to become visible.
        return !found || Object.entries(draft.patch).some(([field, value]) =>
          found[field as keyof StickyNote] !== value);
      })) as Record<string, Draft>;
      if (Object.keys(remaining).length !== Object.keys(confirmedRef.current).length) {
        confirmedRef.current = remaining;
        if (mounted.current) setConfirmed(remaining);
      }
      setCloud(remote); setReady(true);
    }, () => { setError('메모를 불러오지 못했습니다. 연결을 확인해 주세요.'); });
    const timer = window.setInterval(() => { if (!busy.current) void flushRef.current(); }, 700);
    const online = () => void flushRef.current();
    window.addEventListener('online', online);
    return () => { mounted.current = false; unsubscribe(); clearInterval(timer); window.removeEventListener('online', online); };
  }, [uid]);
  const notes = [...new Map([...cloud, ...Object.values(confirmed).map(d => ({ ...(cloud.find(n => n.id === d.note.id) || d.note), ...d.patch })), ...Object.values(pending).map(d => ({ ...(cloud.find(n => n.id === d.note.id) || d.note), ...d.patch }))].map(n => [n.id, n])).values()]
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  const change = (note: StickyNote, patch: NotePatch, create = false) => {
    retryAfter.current = 0;
    const previous = drafts.current[note.id];
    persist({ ...drafts.current, [note.id]: {
      note: { ...note, ...patch, updatedAt: Date.now() }, patch: { ...previous?.patch, ...patch },
      create: previous?.create || create, revision: (previous?.revision || 0) + 1,
    } });
  };
  const remove = async (id: string) => {
    if (!uid) return;
    deleting.current.add(id);
    try {
      // An in-flight creation/update must finish before deletion so it cannot recreate the note.
      while (busy.current) await new Promise(resolve => setTimeout(resolve, 50));
      await removeStickyNote(db, uid, id);
      const next = { ...drafts.current }; delete next[id]; persist(next);
      const acknowledged = { ...confirmedRef.current }; delete acknowledged[id]; confirmedRef.current = acknowledged;
      if (mounted.current) setConfirmed(acknowledged);
      if (mounted.current) { setCloud(items => items.filter(n => n.id !== id)); setError(''); }
    } catch { if (mounted.current) setError('삭제하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'); }
    finally { deleting.current.delete(id); }
  };
  return { notes, ready, error, pending, change, remove, retry: () => { retryAfter.current = 0; return flush(); } };
}

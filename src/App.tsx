import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DailyComposition, KeyExpression, AudioItem, ActiveTab, BackupData } from './types';
import {
  INITIAL_COMPOSITIONS,
  INITIAL_EXPRESSIONS,
  INITIAL_AUDIO_ITEMS,
  getTodayDateString,
} from './data/initialData';
import { Header } from './components/Header';
import { DiaryDateBar } from './components/DiaryDateBar';
import { DailyWritingTab } from './components/DailyWritingTab';
import { AudioShadowingTab } from './components/AudioShadowingTab';
import { KeyExpressionsTab } from './components/KeyExpressionsTab';
import { SummaryTab } from './components/SummaryTab';
import { PenLine, Headphones, BookOpen, CalendarDays } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import {
  subscribeToCompositions,
  saveCompositionToFirestore,
  updateCompositionInFirestore,
  deleteCompositionFromFirestore,
  subscribeToAudioItems,
  saveAudioItemToFirestore,
  updateAudioItemInFirestore,
  deleteAudioItemFromFirestore,
  subscribeToExpressions,
  saveExpressionToFirestore,
  updateExpressionInFirestore,
  deleteExpressionFromFirestore,
  checkAndInitializeUserData,
} from './lib/firestoreService';

export function App() {
  const { user, markSaving, markSynced, markError } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('writing');
  const [currentDate, setCurrentDate] = useState<string>(getTodayDateString());

  // Core Data States with Tombstone Protection (Deleted items are NEVER revived)
  const [compositions, setCompositions] = useState<DailyComposition[]>(() => {
    const hasInitialized = localStorage.getItem('app_initialized_v2');
    const saved = localStorage.getItem('daily_compositions_v2');
    let deletedIds = new Set<string>();
    try {
      deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_composition_ids_v2') || '[]'));
    } catch {}

    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((c: DailyComposition) => !deletedIds.has(c.id));
        }
      } catch {}
    }
    // If the app has already run on this device, an empty list or missing key means items were deleted!
    if (hasInitialized === 'true') {
      return [];
    }
    localStorage.setItem('app_initialized_v2', 'true');
    return INITIAL_COMPOSITIONS.filter((c) => !deletedIds.has(c.id));
  });

  const [audioItems, setAudioItems] = useState<AudioItem[]>(() => {
    const hasInitialized = localStorage.getItem('app_initialized_v2');
    const saved = localStorage.getItem('audio_items_v2');
    let deletedIds = new Set<string>();
    try {
      deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_audio_ids_v2') || '[]'));
    } catch {}

    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((a: AudioItem) => !deletedIds.has(a.id));
        }
      } catch {}
    }
    if (hasInitialized === 'true') {
      return [];
    }
    localStorage.setItem('app_initialized_v2', 'true');
    return INITIAL_AUDIO_ITEMS.filter((a) => !deletedIds.has(a.id));
  });

  const [expressions, setExpressions] = useState<KeyExpression[]>(() => {
    const hasInitialized = localStorage.getItem('app_initialized_v2');
    const saved = localStorage.getItem('key_expressions_v2');
    let deletedIds = new Set<string>();
    try {
      deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_expression_ids_v2') || '[]'));
    } catch {}

    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((e: KeyExpression) => !deletedIds.has(e.id));
        }
      } catch {}
    }
    // If app has already run, never revert to INITIAL_EXPRESSIONS!
    if (hasInitialized === 'true') {
      return [];
    }
    localStorage.setItem('app_initialized_v2', 'true');
    return INITIAL_EXPRESSIONS.filter((e) => !deletedIds.has(e.id));
  });

  // Real-time Firestore sync when logged in
  useEffect(() => {
    if (!user) return;

    // Check & initialize sample starter data only ONCE per user account
    checkAndInitializeUserData(
      user.uid,
      INITIAL_COMPOSITIONS,
      INITIAL_AUDIO_ITEMS,
      INITIAL_EXPRESSIONS
    ).catch((err) => console.warn('Init user data error:', err));

    // Real-time listener: accept whatever the server has, but filter out tombstones
    const unsubComp = subscribeToCompositions(user.uid, (remoteComps) => {
      let deletedIds = new Set<string>();
      try {
        deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_composition_ids_v2') || '[]'));
      } catch {}
      const activeComps = remoteComps.filter((c) => !deletedIds.has(c.id));
      setCompositions((prevLocal) => {
        const remoteMap = new Map(activeComps.map((c) => [c.id, c]));
        const pendingLocal = prevLocal.filter(
          (c) => !remoteMap.has(c.id) && !deletedIds.has(c.id)
        );
        if (pendingLocal.length > 0) {
          pendingLocal.forEach((c) => {
            saveCompositionToFirestore(user.uid, c).catch(() => {});
          });
        }
        const merged = [...activeComps, ...pendingLocal];
        merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        localStorage.setItem('daily_compositions_v2', JSON.stringify(merged));
        return merged;
      });
    });

    const unsubAudio = subscribeToAudioItems(user.uid, (remoteAudios) => {
      let deletedIds = new Set<string>();
      try {
        deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_audio_ids_v2') || '[]'));
      } catch {}
      const activeAudios = remoteAudios.filter((a) => !deletedIds.has(a.id));
      setAudioItems((prevLocal: AudioItem[]) => {
        const localMap = new Map<string, AudioItem>(prevLocal.map((a) => [a.id, a]));
        const merged = activeAudios.map((remote) => {
          const local = localMap.get(remote.id);
          if (!local) return remote;
          return {
            ...remote,
            // Preserve local recording data and base64 if remote is empty or local is newer
            myRecordingUrl: remote.myRecordingUrl || local.myRecordingUrl,
            myRecordingBase64: remote.myRecordingBase64 || local.myRecordingBase64,
            myRecordingDuration: remote.myRecordingDuration || local.myRecordingDuration,
            audioBase64: remote.audioBase64 || local.audioBase64,
            transcript: remote.transcript !== undefined ? remote.transcript : local.transcript,
          };
        });

        // Also preserve local audio items not yet in Firestore
        const remoteIds = new Set(activeAudios.map((a) => a.id));
        const pendingLocal = prevLocal.filter(
          (a) => !remoteIds.has(a.id) && !deletedIds.has(a.id)
        );
        const finalList = [...merged, ...pendingLocal];
        try {
          localStorage.setItem('audio_items_v2', JSON.stringify(finalList));
        } catch {}
        return finalList;
      });
    });

    const unsubExpr = subscribeToExpressions(user.uid, (remoteExprs) => {
      let deletedIds = new Set<string>();
      try {
        deletedIds = new Set(JSON.parse(localStorage.getItem('deleted_expression_ids_v2') || '[]'));
      } catch {}
      const activeExprs = remoteExprs.filter((e) => !deletedIds.has(e.id));
      setExpressions((prevLocal) => {
        const remoteMap = new Map(activeExprs.map((e) => [e.id, e]));
        const pendingLocal = prevLocal.filter(
          (e) => !remoteMap.has(e.id) && !deletedIds.has(e.id)
        );
        if (pendingLocal.length > 0) {
          pendingLocal.forEach((item) => {
            saveExpressionToFirestore(user.uid, item).catch(() => {});
          });
        }
        const merged = [...activeExprs, ...pendingLocal];
        merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        localStorage.setItem('key_expressions_v2', JSON.stringify(merged));
        return merged;
      });
    });

    return () => {
      unsubComp();
      unsubAudio();
      unsubExpr();
    };
  }, [user]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('daily_compositions_v2', JSON.stringify(compositions));
  }, [compositions]);

  useEffect(() => {
    localStorage.setItem('audio_items_v2', JSON.stringify(audioItems));
  }, [audioItems]);

  useEffect(() => {
    localStorage.setItem('key_expressions_v2', JSON.stringify(expressions));
  }, [expressions]);

  // Load from server on mount for cross-device synchronization (when not logged in)
  useEffect(() => {
    if (user) return; // If logged in, Firestore is the authoritative source
    const loadServerData = async () => {
      try {
        const [compRes, audioRes, exprRes] = await Promise.all([
          fetch('/api/compositions').catch(() => null),
          fetch('/api/audio/list').catch(() => null),
          fetch('/api/expressions').catch(() => null),
        ]);

        let deletedExprIds = new Set<string>();
        let deletedCompIds = new Set<string>();
        let deletedAudioIds = new Set<string>();
        try {
          deletedExprIds = new Set(JSON.parse(localStorage.getItem('deleted_expression_ids_v2') || '[]'));
          deletedCompIds = new Set(JSON.parse(localStorage.getItem('deleted_composition_ids_v2') || '[]'));
          deletedAudioIds = new Set(JSON.parse(localStorage.getItem('deleted_audio_ids_v2') || '[]'));
        } catch {}

        if (compRes && compRes.ok) {
          const comps = await compRes.json();
          if (Array.isArray(comps)) {
            const filtered = comps.filter((c: DailyComposition) => !deletedCompIds.has(c.id));
            setCompositions(filtered);
          }
        }

        if (audioRes && audioRes.ok) {
          const audios = await audioRes.json();
          if (Array.isArray(audios)) {
            const filtered = audios.filter((a: AudioItem) => !deletedAudioIds.has(a.id));
            setAudioItems(filtered);
          }
        }

        if (exprRes && exprRes.ok) {
          const exprs = await exprRes.json();
          if (Array.isArray(exprs)) {
            const filtered = exprs.filter((e: KeyExpression) => !deletedExprIds.has(e.id));
            setExpressions(filtered);
          }
        }
      } catch (err) {
        console.warn('Initial server sync:', err);
      }
    };

    loadServerData();
  }, [user]);

  // --- COMPOSITION HANDLERS (Tab 1) ---
  const handleSaveComposition = async (
    itemData: Omit<DailyComposition, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    markSaving();
    const newComp: DailyComposition = {
      ...itemData,
      id: `comp-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Update local state first for instantaneous UI update
    setCompositions((prev) => [newComp, ...prev]);

    // Send to Firestore if signed in
    if (user) {
      saveCompositionToFirestore(user.uid, newComp)
        .then(() => markSynced())
        .catch((err) => {
          console.warn('Firestore composition save error:', err);
          markSynced();
        });
    } else {
      markSynced();
    }

    // Send to server
    try {
      await fetch('/api/compositions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComp),
      });
    } catch (err) {
      console.warn('Server composition save error:', err);
    }
  };

  const handleUpdateComposition = async (id: string, updates: Partial<DailyComposition>) => {
    markSaving();
    setCompositions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c))
    );

    if (user) {
      updateCompositionInFirestore(id, updates)
        .then(() => markSynced())
        .catch((err) => {
          console.warn('Firestore composition update error:', err);
          markSynced();
        });
    } else {
      markSynced();
    }

    try {
      await fetch(`/api/compositions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.warn('Server composition update error:', err);
    }
  };

  const handleDeleteComposition = async (id: string) => {
    markSaving();

    // 1. Mark in tombstone registry immediately
    try {
      const deletedList: string[] = JSON.parse(
        localStorage.getItem('deleted_composition_ids_v2') || '[]'
      );
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem('deleted_composition_ids_v2', JSON.stringify(deletedList));
      }
    } catch {}

    // Ensure starter data is marked initialized so deleted items don't come back
    localStorage.setItem('app_initialized_v2', 'true');

    // 2. Optimistic UI update
    setCompositions((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      localStorage.setItem('daily_compositions_v2', JSON.stringify(updated));
      return updated;
    });

    // 3. Persistent deletion across remote Firestore & server backend
    const firestorePromise = deleteCompositionFromFirestore(user?.uid, id).catch((err) => {
      console.warn('Firestore composition delete error:', err);
    });

    const serverPromise = fetch(`/api/compositions/${id}`, { method: 'DELETE' }).catch((err) => {
      console.warn('Server composition delete error:', err);
    });

    await Promise.allSettled([firestorePromise, serverPromise]);
    markSynced();
  };

  // --- AUDIO & RECORDING HANDLERS (Tab 2) ---
  const handleUploadAudio = async (
    title: string,
    fileName: string,
    fileBase64: string,
    date?: string,
    transcript?: string
  ) => {
    markSaving();
    const cleanTranscript = transcript ? transcript.trim() : '';
    const res = await fetch('/api/audio/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, fileName, fileBase64, date, transcript: cleanTranscript }),
    });
    if (!res.ok) throw new Error('업로드 실패');
    const createdItem: AudioItem = await res.json();
    const fullItem: AudioItem = {
      ...createdItem,
      audioBase64: fileBase64,
      transcript: cleanTranscript || createdItem.transcript || '',
    };
    setAudioItems((prev) => [fullItem, ...prev]);

    if (user) {
      saveAudioItemToFirestore(user.uid, fullItem)
        .then(() => markSynced())
        .catch((err) => {
          console.warn('Firestore audio save error:', err);
          markSynced();
        });
    } else {
      markSynced();
    }
  };

  const handleUpdateAudioTranscript = async (id: string, transcript: string) => {
    markSaving();
    const cleanTranscript = transcript.trim();
    setAudioItems((prev) => {
      const updated = prev.map((a) =>
        a.id === id ? { ...a, transcript: cleanTranscript, updatedAt: Date.now() } : a
      );
      localStorage.setItem('audio_items_v2', JSON.stringify(updated));
      return updated;
    });

    try {
      await fetch(`/api/audio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: cleanTranscript }),
      });
    } catch (err) {
      console.warn('Server audio transcript update error:', err);
    }

    if (user) {
      try {
        await updateAudioItemInFirestore(id, {
          transcript: cleanTranscript,
          updatedAt: Date.now(),
        });
        markSynced();
      } catch (err) {
        console.warn('Firestore audio transcript update error:', err);
        markError();
      }
    } else {
      markSynced();
    }
  };

  const handleSaveRecording = async (
    id: string,
    recordingBase64: string,
    mimeType: string,
    duration?: number
  ) => {
    markSaving();

    const targetItem = audioItems.find((a) => a.id === id);

    // 1. Optimistically update local state & localStorage immediately so recording is never lost
    setAudioItems((prev) => {
      const updated = prev.map((a) =>
        a.id === id
          ? {
              ...a,
              myRecordingUrl: a.myRecordingUrl || recordingBase64,
              myRecordingBase64: recordingBase64,
              myRecordingDuration: duration || a.myRecordingDuration,
              updatedAt: Date.now(),
            }
          : a
      );
      try {
        localStorage.setItem('audio_items_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    let serverRecordingUrl = '';

    // 2. Persist to server disk storage with timeout so it never hangs
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`/api/audio/${id}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingBase64,
          mimeType,
          duration,
          title: targetItem?.title,
          fileName: targetItem?.fileName,
          date: targetItem?.date,
          audioUrl: targetItem?.audioUrl,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const updatedItem = await res.json();
        serverRecordingUrl = updatedItem.myRecordingUrl || '';
        setAudioItems((prev) => {
          const updated = prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  myRecordingUrl: serverRecordingUrl || a.myRecordingUrl,
                  myRecordingBase64: recordingBase64,
                  myRecordingDuration: duration || a.myRecordingDuration,
                  updatedAt: Date.now(),
                }
              : a
          );
          try {
            localStorage.setItem('audio_items_v2', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      } else {
        console.warn('Server recording save returned non-ok:', res.status);
      }
    } catch (netErr) {
      console.warn('Server recording save network error:', netErr);
    }

    // 3. Persist to Firestore with document size guard (< 650KB)
    if (user) {
      try {
        const firestoreUpdates: Partial<AudioItem> = {
          myRecordingUrl: serverRecordingUrl || null,
          myRecordingDuration: duration || null,
          updatedAt: Date.now(),
        };
        if (recordingBase64 && recordingBase64.length < 650000) {
          firestoreUpdates.myRecordingBase64 = recordingBase64;
        }
        await updateAudioItemInFirestore(id, firestoreUpdates);
        markSynced();
      } catch (err) {
        console.warn('Firestore audio recording save error:', err);
        markSynced();
      }
    } else {
      markSynced();
    }
  };

  const handleUpdateItemBase64 = (id: string, base64: string) => {
    setAudioItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, audioBase64: base64 } : a))
    );
    if (user) {
      updateAudioItemInFirestore(id, { audioBase64: base64 }).catch((err) => {
        console.warn('Firestore audioBase64 update error:', err);
      });
    }
  };

  // Auto-upgrade legacy audio items missing audioBase64 by resolving from server
  useEffect(() => {
    if (!audioItems.length) return;

    audioItems.forEach(async (item) => {
      if (!item.audioBase64 && item.audioUrl) {
        try {
          const res = await fetch(
            `/api/audio/resolve-base64?path=${encodeURIComponent(item.audioUrl)}&id=${encodeURIComponent(item.id)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.base64) {
              setAudioItems((prev) =>
                prev.map((a) => (a.id === item.id ? { ...a, audioBase64: data.base64 } : a))
              );
              if (user) {
                updateAudioItemInFirestore(item.id, { audioBase64: data.base64 }).catch(() => {});
              }
            }
          }
        } catch {
          // Ignore background sync errors
        }
      }
    });
  }, [audioItems.length, user]);

  const handleDeleteRecording = async (id: string) => {
    markSaving();
    await fetch(`/api/audio/${id}/recording`, { method: 'DELETE' });
    setAudioItems((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, myRecordingUrl: null, myRecordingBase64: null, myRecordingDuration: null }
          : a
      )
    );

    if (user) {
      updateAudioItemInFirestore(id, {
        myRecordingUrl: null,
        myRecordingBase64: null,
        myRecordingDuration: null,
      })
        .then(() => markSynced())
        .catch((err) => {
          console.warn('Firestore audio recording delete error:', err);
          markSynced();
        });
    } else {
      markSynced();
    }
  };

  const handleDeleteAudioItem = async (id: string) => {
    markSaving();

    try {
      const deletedList: string[] = JSON.parse(
        localStorage.getItem('deleted_audio_ids_v2') || '[]'
      );
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem('deleted_audio_ids_v2', JSON.stringify(deletedList));
      }
    } catch {}

    localStorage.setItem('app_initialized_v2', 'true');

    setAudioItems((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      localStorage.setItem('audio_items_v2', JSON.stringify(updated));
      return updated;
    });

    const firestorePromise = deleteAudioItemFromFirestore(user?.uid, id).catch((err) => {
      console.warn('Firestore audio item delete error:', err);
    });

    const serverPromise = fetch(`/api/audio/${id}`, { method: 'DELETE' }).catch((err) => {
      console.warn('Server audio delete error:', err);
    });

    await Promise.allSettled([firestorePromise, serverPromise]);
    markSynced();
  };

  // --- KEY EXPRESSIONS HANDLERS (Tab 3) ---
  const handleAddExpression = async (itemData: Omit<KeyExpression, 'id' | 'createdAt'>) => {
    markSaving();
    const newExpr: KeyExpression = {
      id: `expr-${Date.now()}`,
      expression: itemData.expression.trim(),
      meaning: itemData.meaning.trim(),
      memo: itemData.memo ? itemData.memo.trim() : '',
      favorite: itemData.favorite ?? false,
      date: itemData.date || currentDate,
      spokenCount: itemData.spokenCount || 0,
      createdAt: Date.now(),
    };

    // Remove from deleted list if exists
    try {
      const deletedList: string[] = JSON.parse(
        localStorage.getItem('deleted_expression_ids_v2') || '[]'
      );
      if (deletedList.includes(newExpr.id)) {
        localStorage.setItem(
          'deleted_expression_ids_v2',
          JSON.stringify(deletedList.filter((dId) => dId !== newExpr.id))
        );
      }
    } catch {}

    setExpressions((prev) => {
      const updated = [newExpr, ...prev.filter((e) => e.id !== newExpr.id)];
      localStorage.setItem('key_expressions_v2', JSON.stringify(updated));
      return updated;
    });

    if (user) {
      try {
        await saveExpressionToFirestore(user.uid, newExpr);
        markSynced();
      } catch (err) {
        console.error('Firestore expression save error:', err);
        markError();
      }
    } else {
      markSynced();
    }

    try {
      await fetch('/api/expressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExpr),
      });
    } catch (err) {
      console.warn('Expression save error:', err);
    }
  };

  const handleUpdateExpression = async (id: string, updates: Partial<KeyExpression>) => {
    markSaving();
    setExpressions((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      localStorage.setItem('key_expressions_v2', JSON.stringify(updated));
      return updated;
    });

    if (user) {
      try {
        await updateExpressionInFirestore(id, updates);
        markSynced();
      } catch (err) {
        console.error('Firestore expression update error:', err);
        markError();
      }
    } else {
      markSynced();
    }

    try {
      await fetch(`/api/expressions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.warn('Expression update error:', err);
    }
  };

  const handleDeleteExpression = async (id: string) => {
    markSaving();

    // 1. Immediately store tombstone in localStorage
    try {
      const deletedList: string[] = JSON.parse(
        localStorage.getItem('deleted_expression_ids_v2') || '[]'
      );
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem('deleted_expression_ids_v2', JSON.stringify(deletedList));
      }
    } catch {}

    // Ensure sample data never resurrected
    localStorage.setItem('app_initialized_v2', 'true');

    // 2. Optimistic local state update
    setExpressions((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      localStorage.setItem('key_expressions_v2', JSON.stringify(updated));
      return updated;
    });

    // 3. Persistent deletion across remote Firestore & server backend
    const firestorePromise = deleteExpressionFromFirestore(user?.uid, id).catch((err) => {
      console.warn('Firestore expression delete error:', err);
    });

    const serverPromise = fetch(`/api/expressions/${id}`, { method: 'DELETE' }).catch((err) => {
      console.warn('Server expression delete error:', err);
    });

    await Promise.allSettled([firestorePromise, serverPromise]);
    markSynced();
  };

  // --- BACKUP RESTORE HANDLER (Import) ---
  const handleImportBackup = async (
    backup: BackupData,
    mode: 'merge' | 'overwrite'
  ) => {
    markSaving();
    let newComps = compositions;
    let newAudios = audioItems;
    let newExprs = expressions;

    if (mode === 'overwrite') {
      newComps = backup.compositions || [];
      newAudios = backup.audioItems || [];
      newExprs = backup.expressions || [];
    } else {
      // Merge unique items by id
      const existingCompIds = new Set(compositions.map((c) => c.id));
      const incomingComps = (backup.compositions || []).filter((c) => !existingCompIds.has(c.id));
      newComps = [...incomingComps, ...compositions];

      const existingAudioIds = new Set(audioItems.map((a) => a.id));
      const incomingAudios = (backup.audioItems || []).filter((a) => !existingAudioIds.has(a.id));
      newAudios = [...incomingAudios, ...audioItems];

      const existingExprIds = new Set(expressions.map((e) => e.id));
      const incomingExprs = (backup.expressions || []).filter((e) => !existingExprIds.has(e.id));
      newExprs = [...incomingExprs, ...expressions];
    }

    setCompositions(newComps);
    setAudioItems(newAudios);
    setExpressions(newExprs);

    localStorage.setItem('daily_compositions_v2', JSON.stringify(newComps));
    localStorage.setItem('audio_items_v2', JSON.stringify(newAudios));
    localStorage.setItem('key_expressions_v2', JSON.stringify(newExprs));

    if (user) {
      try {
        const compPromises = (backup.compositions || []).map((c) =>
          saveCompositionToFirestore(user.uid, c)
        );
        const audioPromises = (backup.audioItems || []).map((a) =>
          saveAudioItemToFirestore(user.uid, a)
        );
        const exprPromises = (backup.expressions || []).map((e) =>
          saveExpressionToFirestore(user.uid, e)
        );
        await Promise.allSettled([...compPromises, ...audioPromises, ...exprPromises]);
      } catch (err) {
        console.warn('Firestore backup sync error:', err);
      }
    }

    markSynced();
  };

  const dayCompositionsCount = compositions.filter((c) => c.date === currentDate).length;
  const dayAudioCount = audioItems.filter(
    (a) => (a.date || (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '')) === currentDate
  ).length;
  const dayExpressionsCount = expressions.filter(
    (e) => (e.date || (e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 10) : '')) === currentDate
  ).length;

  // Set of all dates with recorded activity for calendar highlight dots
  const recordedDatesSet = useMemo(() => {
    const set = new Set<string>();
    compositions.forEach((c) => { if (c.date) set.add(c.date); });
    audioItems.forEach((a) => {
      const d = a.date || (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '');
      if (d) set.add(d);
    });
    expressions.forEach((e) => {
      const d = e.date || (e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 10) : '');
      if (d) set.add(d);
    });
    return set;
  }, [compositions, audioItems, expressions]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sleek Header with Google Cloud Sync indicator & Account */}
      <Header
        onLogoClick={() => setActiveTab('writing')}
        compositions={compositions}
        audioItems={audioItems}
        expressions={expressions}
        onImportBackup={handleImportBackup}
      />

      {/* Diary-style Global Date Controller Bar with Arrow Buttons & Dropdown Calendar (Hidden on Summary tab per user request) */}
      {activeTab !== 'summary' && (
        <DiaryDateBar
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          activeTab={activeTab}
          dayCompositionsCount={dayCompositionsCount}
          dayAudioCount={dayAudioCount}
          dayExpressionsCount={dayExpressionsCount}
          recordedDates={recordedDatesSet}
        />
      )}

      {/* Main Content Area - keep tabs mounted so state is preserved across tab switching */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-24 sm:pb-28">
        <div className={activeTab === 'writing' ? 'block' : 'hidden'}>
          <DailyWritingTab
            compositions={compositions}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onSaveComposition={handleSaveComposition}
            onUpdateComposition={handleUpdateComposition}
            onDeleteComposition={handleDeleteComposition}
          />
        </div>

        <div className={activeTab === 'audio-shadowing' ? 'block' : 'hidden'}>
          <AudioShadowingTab
            audioItems={audioItems}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onUploadAudio={handleUploadAudio}
            onSaveRecording={handleSaveRecording}
            onDeleteRecording={handleDeleteRecording}
            onDeleteAudioItem={handleDeleteAudioItem}
            onUpdateItemBase64={handleUpdateItemBase64}
            onUpdateTranscript={handleUpdateAudioTranscript}
          />
        </div>

        <div className={activeTab === 'expressions' ? 'block' : 'hidden'}>
          <KeyExpressionsTab
            expressions={expressions}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onAddExpression={handleAddExpression}
            onUpdateExpression={handleUpdateExpression}
            onDeleteExpression={handleDeleteExpression}
          />
        </div>

        <div className={activeTab === 'summary' ? 'block' : 'hidden'}>
          <SummaryTab
            compositions={compositions}
            audioItems={audioItems}
            expressions={expressions}
            onNavigateTab={(tab, targetDate) => {
              if (targetDate) setCurrentDate(targetDate);
              setActiveTab(tab);
            }}
            onUpdateItemBase64={handleUpdateItemBase64}
          />
        </div>
      </main>

      {/* Primary Bottom Navigation Bar (Unified across all screen sizes) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg py-2 px-3">
        <div className="max-w-md sm:max-w-lg mx-auto flex items-center justify-around gap-1">
          {/* Tab 1: 매일 영작 */}
          <button
            type="button"
            onClick={() => setActiveTab('writing')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer relative ${
              activeTab === 'writing'
                ? 'text-indigo-600 bg-indigo-50/90 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <PenLine className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">매일 영작</span>
            {compositions.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'writing' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {compositions.length}
              </span>
            )}
          </button>

          {/* Tab 2: 음성 & 녹음 */}
          <button
            type="button"
            onClick={() => setActiveTab('audio-shadowing')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer relative ${
              activeTab === 'audio-shadowing'
                ? 'text-indigo-600 bg-indigo-50/90 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <Headphones className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">음성 & 녹음</span>
            {audioItems.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'audio-shadowing' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {audioItems.length}
              </span>
            )}
          </button>

          {/* Tab 3: 주요 표현 */}
          <button
            type="button"
            onClick={() => setActiveTab('expressions')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer relative ${
              activeTab === 'expressions'
                ? 'text-indigo-600 bg-indigo-50/90 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">주요 표현</span>
            {expressions.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'expressions' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {expressions.length}
              </span>
            )}
          </button>

          {/* Tab 4: 모아보기 */}
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer relative ${
              activeTab === 'summary'
                ? 'text-indigo-600 bg-indigo-50/90 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <CalendarDays className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">모아보기</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;

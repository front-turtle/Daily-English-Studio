import React, { useState, useEffect, useMemo } from 'react';
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
import { AiTutorTab } from './components/AiTutorTab';
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

// Keep each source/recording small enough that one Firestore document stays safely below 1 MiB.
// 400k base64 characters is roughly 300 KB of binary audio. Two clips + metadata remain under the document limit.
const MAX_SYNC_AUDIO_BASE64_CHARS = 400_000;

export function App() {
  const { user, markSaving, markSynced, markError } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('writing');
  const [currentDate, setCurrentDate] = useState<string>(getTodayDateString());
  const [practiceExpressionId, setPracticeExpressionId] = useState<string | null>(null);

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

    // 3. Persist deletion to Firestore (localStorage remains the offline fallback)
    await deleteCompositionFromFirestore(user?.uid, id).catch((err) => {
      console.warn('Firestore composition delete error:', err);
    });
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

    if (fileBase64.length > MAX_SYNC_AUDIO_BASE64_CHARS) {
      markError();
      throw new Error('음성 파일이 너무 큽니다. 약 300KB 이하의 짧은 학습 음성을 사용해주세요.');
    }

    const now = Date.now();
    const cleanTranscript = transcript ? transcript.trim() : '';
    const createdItem: AudioItem = {
      id: `audio-${now}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || fileName.replace(/\.[^/.]+$/, ''),
      fileName,
      // The playable source is stored directly in Firestore/local cache; no server URL is required.
      audioUrl: '',
      audioBase64: fileBase64,
      myRecordingUrl: null,
      myRecordingBase64: null,
      myRecordingDuration: null,
      date: date || currentDate,
      transcript: cleanTranscript,
      createdAt: now,
      updatedAt: now,
    };

    setAudioItems((prev) => [createdItem, ...prev]);

    if (user) {
      try {
        await saveAudioItemToFirestore(user.uid, createdItem);
        markSynced();
      } catch (err) {
        console.warn('Firestore audio save error:', err);
        markError();
        throw err;
      }
    } else {
      // Local-only mode still works on the current device; sign in for cross-device sync.
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
    _mimeType: string,
    duration?: number
  ) => {
    markSaving();

    if (recordingBase64.length > MAX_SYNC_AUDIO_BASE64_CHARS) {
      markError();
      throw new Error('녹음 파일이 너무 큽니다. 녹음을 조금 짧게 나눠서 저장해주세요.');
    }

    const updatedAt = Date.now();

    // Update the current device immediately.
    setAudioItems((prev) => {
      const updated = prev.map((a) =>
        a.id === id
          ? {
              ...a,
              myRecordingUrl: null,
              myRecordingBase64: recordingBase64,
              myRecordingDuration: duration || a.myRecordingDuration,
              updatedAt,
            }
          : a
      );
      try {
        localStorage.setItem('audio_items_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (user) {
      try {
        await updateAudioItemInFirestore(id, {
          myRecordingUrl: null,
          myRecordingBase64: recordingBase64,
          myRecordingDuration: duration || null,
          updatedAt,
        });
        markSynced();
      } catch (err) {
        console.warn('Firestore audio recording save error:', err);
        markError();
        throw err;
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


  const handleDeleteRecording = async (id: string) => {
    markSaving();
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

    await deleteAudioItemFromFirestore(user?.uid, id).catch((err) => {
      console.warn('Firestore audio item delete error:', err);
    });
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

    return newExpr;
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

    // 3. Persist deletion to Firestore
    await deleteExpressionFromFirestore(user?.uid, id).catch((err) => {
      console.warn('Firestore expression delete error:', err);
    });
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
        onAiTutorClick={() => setActiveTab('ai')}
        isAiTutorActive={activeTab === 'ai'}
        compositions={compositions}
        audioItems={audioItems}
        expressions={expressions}
        onImportBackup={handleImportBackup}
      />

      {/* Diary-style Global Date Controller Bar with Arrow Buttons & Dropdown Calendar (Hidden on Summary tab per user request) */}
      {activeTab !== 'summary' && activeTab !== 'ai' && (
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
            focusExpressionId={practiceExpressionId}
            onUpdateExpression={handleUpdateExpression}
            onDeleteExpression={handleDeleteExpression}
          />
        </div>

        <div className={activeTab === 'ai' ? 'block' : 'hidden'}>
          <AiTutorTab
            currentDate={currentDate}
            onAddExpression={handleAddExpression}
            onStartPractice={(expression) => {
              setCurrentDate(expression.date);
              setPracticeExpressionId(expression.id);
              setActiveTab('expressions');
            }}
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

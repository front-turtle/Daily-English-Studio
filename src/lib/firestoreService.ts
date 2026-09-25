import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DailyComposition, AudioItem, KeyExpression, AiTutorMessage } from '../types';

// Helper to get local set of deleted IDs
export const getLocalDeletedIds = (key: string): Set<string> => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
};

export const addLocalDeletedId = (key: string, id: string) => {
  try {
    const set = getLocalDeletedIds(key);
    set.add(id);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
};

// Check if user has initialized their starter data in Firestore once
export const checkAndInitializeUserData = async (
  userId: string,
  initialComps: DailyComposition[],
  initialAudio: AudioItem[],
  initialExprs: KeyExpression[]
) => {
  try {
    // 1. Check local storage initialization marker
    const localFlag = localStorage.getItem(`user_initialized_${userId}`);
    if (localFlag === 'true') {
      return;
    }

    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? userSnap.data() : null;

    if (userData?.hasInitializedData) {
      localStorage.setItem(`user_initialized_${userId}`, 'true');
      return;
    }

    // 2. Check if user already has any existing data in Firestore
    const [exprSnap, compSnap] = await Promise.all([
      getDocs(query(collection(db, 'expressions'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'compositions'), where('userId', '==', userId))),
    ]);

    if (!exprSnap.empty || !compSnap.empty) {
      // User already has records; mark initialized so we never re-seed
      await setDoc(userDocRef, { hasInitializedData: true }, { merge: true });
      localStorage.setItem(`user_initialized_${userId}`, 'true');
      return;
    }

    // 3. Mark user initialized FIRST to prevent race conditions
    await setDoc(
      userDocRef,
      { hasInitializedData: true, initializedAt: Date.now() },
      { merge: true }
    );
    localStorage.setItem(`user_initialized_${userId}`, 'true');

    // 4. Gather any deleted IDs so we never seed deleted items
    const deletedExprIds = getLocalDeletedIds('deleted_expression_ids_v2');
    if (Array.isArray(userData?.deletedExpressionIds)) {
      userData.deletedExpressionIds.forEach((id: string) => deletedExprIds.add(id));
    }

    const deletedCompIds = getLocalDeletedIds('deleted_composition_ids_v2');
    if (Array.isArray(userData?.deletedCompositionIds)) {
      userData.deletedCompositionIds.forEach((id: string) => deletedCompIds.add(id));
    }

    const promises: Promise<unknown>[] = [];
    initialComps
      .filter((c) => !deletedCompIds.has(c.id))
      .forEach((c) => promises.push(saveCompositionToFirestore(userId, c)));
    initialAudio.forEach((a) => promises.push(saveAudioItemToFirestore(userId, a)));
    initialExprs
      .filter((e) => !deletedExprIds.has(e.id))
      .forEach((e) => promises.push(saveExpressionToFirestore(userId, e)));

    await Promise.allSettled(promises);
  } catch (err) {
    console.warn('User initialization check:', err);
  }
};

// Subscribe to user compositions in real time
export const subscribeToCompositions = (
  userId: string,
  onData: (items: DailyComposition[]) => void,
  onError?: (err: Error) => void
) => {
  const q = query(collection(db, 'compositions'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const deletedIds = getLocalDeletedIds('deleted_composition_ids_v2');
      const list: DailyComposition[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as DailyComposition;
        if (deletedIds.has(item.id)) {
          // Purge ghost document from Firestore
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        list.push(item);
      });
      // Sort newest first
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(list);
    },
    (err) => {
      console.warn('Firestore compositions listener error:', err);
      if (onError) onError(err);
    }
  );
};

// Helper to strictly sanitize objects before sending to Firestore (Firestore rejects any undefined field)
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

export const saveCompositionToFirestore = async (userId: string, comp: DailyComposition) => {
  const docRef = doc(db, 'compositions', comp.id);
  const cleanData = sanitizeForFirestore({
    id: comp.id,
    date: comp.date,
    korean: comp.korean,
    english: comp.english,
    polished: comp.polished || '',
    polishedTip: comp.polishedTip || '',
    favorite: comp.favorite ?? false,
    createdAt: comp.createdAt || Date.now(),
    updatedAt: comp.updatedAt || Date.now(),
    userId,
  });
  await setDoc(docRef, cleanData);
};

export const updateCompositionInFirestore = async (
  id: string,
  updates: Partial<DailyComposition>
) => {
  const docRef = doc(db, 'compositions', id);
  const cleanUpdates = sanitizeForFirestore(updates);
  await updateDoc(docRef, cleanUpdates);
};

export const deleteCompositionFromFirestore = async (userId: string | undefined, id: string) => {
  addLocalDeletedId('deleted_composition_ids_v2', id);

  try {
    const docRef = doc(db, 'compositions', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('deleteCompositionFromFirestore doc error:', err);
  }

  if (userId) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          deletedCompositionIds: arrayUnion(id),
          hasInitializedData: true,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('deleteCompositionFromFirestore user record error:', err);
    }
  }
};

// Subscribe to user audio items in real time
export const subscribeToAudioItems = (
  userId: string,
  onData: (items: AudioItem[]) => void,
  onError?: (err: Error) => void
) => {
  const q = query(collection(db, 'audioItems'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const deletedIds = getLocalDeletedIds('deleted_audio_ids_v2');
      const list: AudioItem[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as AudioItem;
        if (deletedIds.has(item.id)) {
          // Purge ghost document from Firestore
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        list.push(item);
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(list);
    },
    (err) => {
      console.warn('Firestore audioItems listener error:', err);
      if (onError) onError(err);
    }
  );
};

export const saveAudioItemToFirestore = async (userId: string, audio: AudioItem) => {
  const docRef = doc(db, 'audioItems', audio.id);
  const cleanData = sanitizeForFirestore({
    id: audio.id,
    title: audio.title,
    fileName: audio.fileName,
    audioUrl: audio.audioUrl,
    audioBase64: audio.audioBase64 || '',
    myRecordingUrl: audio.myRecordingUrl || null,
    myRecordingBase64: audio.myRecordingBase64 || null,
    date: audio.date,
    createdAt: audio.createdAt || Date.now(),
    updatedAt: audio.updatedAt || Date.now(),
    transcript: audio.transcript || '',
    userId,
  });
  await setDoc(docRef, cleanData);
};

export const updateAudioItemInFirestore = async (id: string, updates: Partial<AudioItem>) => {
  const docRef = doc(db, 'audioItems', id);
  const cleanUpdates = sanitizeForFirestore(updates);
  await setDoc(docRef, cleanUpdates, { merge: true });
};

export const deleteAudioItemFromFirestore = async (userId: string | undefined, id: string) => {
  addLocalDeletedId('deleted_audio_ids_v2', id);

  try {
    const docRef = doc(db, 'audioItems', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('deleteAudioItemFromFirestore doc error:', err);
  }

  if (userId) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          deletedAudioIds: arrayUnion(id),
          hasInitializedData: true,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('deleteAudioItemFromFirestore user record error:', err);
    }
  }
};

// Subscribe to key expressions in real time
export const subscribeToExpressions = (
  userId: string,
  onData: (items: KeyExpression[]) => void,
  onError?: (err: Error) => void
) => {
  const q = query(collection(db, 'expressions'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const deletedIds = getLocalDeletedIds('deleted_expression_ids_v2');
      const list: KeyExpression[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as KeyExpression;
        // CRITICAL: Never emit or restore an expression deleted by the user!
        if (deletedIds.has(item.id)) {
          // Actively purge ghost doc from Firestore
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        list.push(item);
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(list);
    },
    (err) => {
      console.warn('Firestore expressions listener error:', err);
      if (onError) onError(err);
    }
  );
};

export const saveExpressionToFirestore = async (userId: string, expr: KeyExpression) => {
  const docRef = doc(db, 'expressions', expr.id);
  const cleanData = sanitizeForFirestore({
    id: expr.id,
    expression: expr.expression,
    meaning: expr.meaning,
    memo: expr.memo || '',
    favorite: expr.favorite ?? false,
    date: expr.date,
    createdAt: expr.createdAt || Date.now(),
    spokenCount: expr.spokenCount || 0,
    userId,
  });
  await setDoc(docRef, cleanData);
};

export const updateExpressionInFirestore = async (id: string, updates: Partial<KeyExpression>) => {
  const docRef = doc(db, 'expressions', id);
  const cleanUpdates = sanitizeForFirestore(updates);
  await updateDoc(docRef, cleanUpdates);
};

export const deleteExpressionFromFirestore = async (userId: string | undefined, id: string) => {
  // 1. Immediately store in local tombstone registry
  addLocalDeletedId('deleted_expression_ids_v2', id);

  // 2. Direct deleteDoc in Firestore
  try {
    const docRef = doc(db, 'expressions', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('deleteDoc error for expression:', id, err);
  }

  // 3. Record tombstone in user profile
  if (userId) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          deletedExpressionIds: arrayUnion(id),
          hasInitializedData: true,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Recording deletedExpressionId in user doc:', err);
    }
  }
};


// --- AI TUTOR CHAT SYNC ---
// Stored inside /users/{uid} so the existing owner-only user document rule protects it.
// Only the latest 30 messages are kept to stay lightweight and well below Firestore document limits.
export const subscribeToAiTutorMessages = (
  userId: string,
  onData: (items: AiTutorMessage[]) => void,
  onError?: (err: Error) => void
) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snapshot) => {
      const raw = snapshot.exists() ? snapshot.data()?.aiTutorMessages : [];
      const list: AiTutorMessage[] = Array.isArray(raw)
        ? raw
            .filter(
              (item: any) =>
                item &&
                typeof item.id === 'string' &&
                (item.role === 'user' || item.role === 'model') &&
                typeof item.text === 'string'
            )
            .map((item: any) => ({
              id: item.id,
              role: item.role,
              text: item.text,
              createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
            }))
            .slice(-30)
        : [];
      onData(list);
    },
    (err) => {
      console.warn('Firestore AI tutor listener error:', err);
      if (onError) onError(err);
    }
  );
};

export const saveAiTutorMessagesToFirestore = async (
  userId: string,
  items: AiTutorMessage[]
) => {
  const userRef = doc(db, 'users', userId);
  const cleanItems = items.slice(-30).map((item) => ({
    id: item.id,
    role: item.role,
    text: item.text,
    createdAt: item.createdAt || Date.now(),
  }));

  await setDoc(
    userRef,
    {
      aiTutorMessages: cleanItems,
      aiTutorUpdatedAt: Date.now(),
    },
    { merge: true }
  );
};

export const clearAiTutorMessagesFromFirestore = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  await setDoc(
    userRef,
    {
      aiTutorMessages: [],
      aiTutorUpdatedAt: Date.now(),
    },
    { merge: true }
  );
};

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';

export type SyncStatus = 'synced' | 'syncing' | 'local' | 'error';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncStatus: SyncStatus;
  lastSavedTime: Date | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  markSaving: () => void;
  markSynced: () => void;
  markError: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        setSyncStatus('synced');
        setLastSavedTime(new Date());
        // Save or update user profile in Firestore & load deleted IDs
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            // Sync cloud deleted IDs into local storage so they are immediately honored
            if (Array.isArray(data?.deletedExpressionIds)) {
              try {
                const localExpr: string[] = JSON.parse(
                  localStorage.getItem('deleted_expression_ids_v2') || '[]'
                );
                const merged = Array.from(new Set([...localExpr, ...data.deletedExpressionIds]));
                localStorage.setItem('deleted_expression_ids_v2', JSON.stringify(merged));
              } catch {}
            }
            if (Array.isArray(data?.deletedCompositionIds)) {
              try {
                const localComp: string[] = JSON.parse(
                  localStorage.getItem('deleted_composition_ids_v2') || '[]'
                );
                const merged = Array.from(new Set([...localComp, ...data.deletedCompositionIds]));
                localStorage.setItem('deleted_composition_ids_v2', JSON.stringify(merged));
              } catch {}
            }
            if (Array.isArray(data?.deletedAudioIds)) {
              try {
                const localAudio: string[] = JSON.parse(
                  localStorage.getItem('deleted_audio_ids_v2') || '[]'
                );
                const merged = Array.from(new Set([...localAudio, ...data.deletedAudioIds]));
                localStorage.setItem('deleted_audio_ids_v2', JSON.stringify(merged));
              } catch {}
            }
          }

          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              lastLoginAt: Date.now(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('Failed to update user profile in firestore:', e);
        }
      } else {
        setSyncStatus('synced');
        setLastSavedTime(new Date());
      }
    });

    return () => unsubscribe();
  }, []);

  const syncTimeoutRef = useRef<any>(null);

  const markSaving = () => {
    setSyncStatus('syncing');
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    // Safety fallback: revert to synced after 3.5s so badge never gets permanently stuck
    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedTime(new Date());
    }, 3500);
  };

  const markSynced = () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    setSyncStatus('synced');
    setLastSavedTime(new Date());
  };

  const markError = () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    setSyncStatus('error');
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      // In web apps/iframes, try popup first; if popup is blocked, try redirect
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        if (
          popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/cancelled-popup-request' ||
          popupErr.code === 'auth/popup-closed-by-user'
        ) {
          if (popupErr.code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, googleProvider);
          } else {
            // User just closed popup, no error needed
            return;
          }
        } else {
          throw popupErr;
        }
      }
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      setError(err.message || 'Google 로그인 중 오류가 발생했습니다.');
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setError(null);
    } catch (err: any) {
      console.error('Sign-out error:', err);
      setError('로그아웃 중 문제가 발생했습니다.');
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        syncStatus,
        lastSavedTime,
        signInWithGoogle,
        signOut,
        markSaving,
        markSynced,
        markError,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

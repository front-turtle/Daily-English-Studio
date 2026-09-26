import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { recordReviewAnswer, reviewDate } from './smartReview.ts';
import type { ReviewAnswer, ReviewSession } from './smartReview.ts';

// Kept independent of app initialization so the real persistence code can be
// exercised against the emulator with two independent authenticated clients.
export async function startReviewInDatabase(db: Firestore, uid: string, candidate: ReviewSession): Promise<ReviewSession> {
  if (!candidate.questions.length) throw new Error('영어와 한국어가 함께 있는 학습 기록을 먼저 추가해 주세요.');
  const ref = doc(db, 'users', uid, 'smartReviews', candidate.date);
  try {
    return await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (candidate.date !== reviewDate()) throw new Error('날짜가 바뀌었습니다. 오늘의 복습을 다시 시작해 주세요.');
      if (snapshot.exists()) return snapshot.data() as ReviewSession;
      transaction.set(ref, candidate);
      return candidate;
    });
  } catch (error) {
    // Immutable-data rules can reject a concurrent write before the SDK gets
    // an ABORTED response. Reconcile only a confirmed, already-created session.
    if ((error as { code?: string }).code === 'permission-denied' && candidate.date === reviewDate()) {
      const snapshot = await getDocFromServer(ref);
      if (snapshot.exists()) return snapshot.data() as ReviewSession;
    }
    throw error;
  }
}

export async function saveReviewAnswerInDatabase(db: Firestore, uid: string, date: string, questionId: string, answer: ReviewAnswer): Promise<ReviewSession> {
  const ref = doc(db, 'users', uid, 'smartReviews', date);
  try {
    return await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('복습을 먼저 시작해 주세요.');
      const previous = snapshot.data() as ReviewSession;
      const next = recordReviewAnswer(previous, questionId, answer);
      if (next !== previous) transaction.set(ref, next);
      return next;
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'permission-denied' && date === reviewDate()) {
      const snapshot = await getDocFromServer(ref);
      const saved = snapshot.data() as ReviewSession | undefined;
      if (saved?.answers[questionId]) return saved;
    }
    throw error;
  }
}

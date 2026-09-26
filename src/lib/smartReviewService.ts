import { collection, doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { recordReviewAnswer, reviewDate } from './smartReview';
import type { ReviewAnswer, ReviewSession } from './smartReview';

const reviewCollection = (uid: string) => collection(db, 'users', uid, 'smartReviews');
export function subscribeToReviews(uid: string, onData: (sessions: ReviewSession[]) => void, onError: (error: Error) => void) {
  return onSnapshot(reviewCollection(uid), { includeMetadataChanges: true }, snapshot => {
    // A server snapshot is required before creating today's fixed question set.
    if (snapshot.metadata.fromCache) return;
    onData(snapshot.docs.map(d => d.data() as ReviewSession).sort((a, b) => b.date.localeCompare(a.date)));
  }, onError);
}
export async function startReview(uid: string, candidate: ReviewSession): Promise<ReviewSession> {
  if (!candidate.questions.length) throw new Error('영어와 한국어가 함께 있는 학습 기록을 먼저 추가해 주세요.');
  const ref = doc(reviewCollection(uid), candidate.date);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (candidate.date !== reviewDate()) throw new Error('날짜가 바뀌었습니다. 오늘의 복습을 다시 시작해 주세요.');
    if (snapshot.exists()) return snapshot.data() as ReviewSession;
    transaction.set(ref, candidate);
    return candidate;
  });
}
export async function saveReviewAnswer(uid: string, date: string, questionId: string, answer: ReviewAnswer): Promise<ReviewSession> {
  const ref = doc(reviewCollection(uid), date);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('복습을 먼저 시작해 주세요.');
    const previous = snapshot.data() as ReviewSession;
    const next = recordReviewAnswer(previous, questionId, answer);
    if (next !== previous) transaction.set(ref, next);
    return next;
  });
}

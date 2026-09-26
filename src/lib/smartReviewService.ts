import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { startReviewInDatabase, saveReviewAnswerInDatabase } from './smartReviewRepository';
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
  return startReviewInDatabase(db, uid, candidate);
}
export async function saveReviewAnswer(uid: string, date: string, questionId: string, answer: ReviewAnswer): Promise<ReviewSession> {
  return saveReviewAnswerInDatabase(db, uid, date, questionId, answer);
}

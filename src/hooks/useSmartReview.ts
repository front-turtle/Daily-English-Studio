import { useEffect, useState } from 'react';
import { reviewDate } from '../lib/smartReview';
import type { ReviewSession } from '../lib/smartReview';
import { subscribeToReviews } from '../lib/smartReviewService';

export function useSmartReview(uid?: string) {
  const [today, setToday] = useState(reviewDate);
  const [state, setState] = useState<{ uid?: string; sessions: ReviewSession[]; ready: boolean; error: string }>({ sessions: [], ready: false, error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = () => setToday(reviewDate());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    setState({ uid, sessions: [], ready: false, error: '' });
    if (!uid) return;
    let active = true;
    const unsubscribe = subscribeToReviews(uid,
      sessions => { if (active) setState({ uid, sessions, ready: true, error: '' }); },
      () => { if (active) setState(s => ({ ...s, ready: false, error: '복습 기록을 불러오지 못했습니다. 인터넷 연결과 계정 권한을 확인한 뒤 다시 시도해 주세요.' })); });
    return () => { active = false; unsubscribe(); };
  }, [uid, retry]);
  const current = state.uid === uid ? state : { sessions: [], ready: false, error: '' };
  return { ...current, today, retry: () => setRetry(n => n + 1) };
}

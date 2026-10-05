import React from 'react';
import { dailySession, isComplete } from '../lib/smartReview';
import type { ReviewSession } from '../lib/smartReview';

export function ReviewTabLabel({ uid, today, sessions, ready }: { uid?: string; today: string; sessions: ReviewSession[]; ready: boolean }) {
  const pending = !!uid && ready && !isComplete(dailySession(sessions, today));
  return <>
    <span className="relative" aria-hidden="true">🌱
      {pending && <span data-testid="review-pending-dot" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500" />}
    </span>
    <span className="text-[11px] sm:text-xs whitespace-nowrap">스마트 복습</span>
    {pending && <span className="sr-only">오늘 복습 미완료</span>}
  </>;
}

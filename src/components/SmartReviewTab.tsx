import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Download, Leaf, Loader2 } from 'lucide-react';
import type { DailyComposition, KeyExpression } from '../types';
import { createReviewSession, dailySession, forestLife, GROWTH_STAGES, isComplete, isExtra, reviewStats, sessionDay, shiftReviewDate } from '../lib/smartReview';
import type { ReviewAnswer, ReviewQuestion, ReviewSession } from '../lib/smartReview';
import { reviewCandidates } from '../lib/reviewCandidates';
import { saveReviewAnswer, startReview } from '../lib/smartReviewService';
import { gradeSmartReview } from '../lib/gradeSmartReview';

interface Props {
  uid?: string;
  today: string;
  sessions: ReviewSession[];
  ready: boolean;
  error: string;
  retry: () => void;
  compositions: DailyComposition[];
  expressions: KeyExpression[];
  sourcesReady: boolean;
  onAddSource: () => void;
}
const sourceLabel = { writing: '내 영작', polished: 'AI 첨삭 · 핵심 수정', expression: '주요 표현' };
const button = 'rounded-xl px-4 py-3 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed';


function GrowthScene({ streak, stageName, stageIndex }: { streak: number; stageName: string; stageIndex: number }) {
  const { animals, nextAnimal } = forestLife(streak);
  const weatherKey = streak % 11;
  const rainy = streak > 0 && (weatherKey === 4 || weatherKey === 9);
  const windy = weatherKey === 2 || weatherKey === 5 || weatherKey === 7 || rainy;
  const showTree = stageIndex >= 2;
  const showForest = stageIndex >= 4;
  const showPlanetGlow = stageIndex >= 13;
  const visibleAnimals = animals.slice(-6);

  return <div className="space-y-2">
    <style>{`
      @keyframes review-scene-breathe {
        0%,100% { transform: scale(1.015) translate3d(0,0,0); }
        50% { transform: scale(1.04) translate3d(-0.6%, -0.4%, 0); }
      }
      @keyframes review-tree-sway {
        0%,100% { transform: rotate(-0.7deg); }
        50% { transform: rotate(0.9deg); }
      }
      @keyframes review-sprout-sway {
        0%,100% { transform: rotate(-2.2deg); }
        50% { transform: rotate(2.6deg); }
      }
      @keyframes review-waterfall {
        from { stroke-dashoffset: 0; opacity: .5; }
        50% { opacity: .95; }
        to { stroke-dashoffset: -34; opacity: .5; }
      }
      @keyframes review-cloud-drift {
        0%,100% { transform: translateX(-2%); }
        50% { transform: translateX(2.5%); }
      }
      @keyframes review-leaf-drift {
        0% { transform: translate3d(-40px,-18px,0) rotate(0deg); opacity: 0; }
        12% { opacity: .75; }
        100% { transform: translate3d(460px,250px,0) rotate(480deg); opacity: 0; }
      }
      @keyframes review-fly-a {
        0%,100% { transform: translate3d(0,0,0) rotate(-5deg); }
        25% { transform: translate3d(28px,-18px,0) rotate(6deg); }
        55% { transform: translate3d(4px,15px,0) rotate(-4deg); }
        80% { transform: translate3d(-24px,-7px,0) rotate(3deg); }
      }
      @keyframes review-fly-b {
        0%,100% { transform: translate3d(0,0,0) scale(1); }
        35% { transform: translate3d(-34px,13px,0) scale(1.04); }
        70% { transform: translate3d(18px,-20px,0) scale(.96); }
      }
      @keyframes review-ground-bob {
        0%,100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes review-rain {
        0% { transform: translateY(-42px) translateX(0); opacity: 0; }
        15% { opacity: .55; }
        100% { transform: translateY(320px) translateX(-45px); opacity: 0; }
      }
      @keyframes review-glow {
        0%,100% { opacity: .34; transform: scale(.96); }
        50% { opacity: .72; transform: scale(1.05); }
      }
      .review-scene-photo { animation: review-scene-breathe 13s ease-in-out infinite; }
      .review-tree { transform-origin: 510px 298px; animation: review-tree-sway ${windy ? '3.8s' : '7s'} ease-in-out infinite; }
      .review-sprout { transform-origin: 380px 318px; animation: review-sprout-sway ${windy ? '2.6s' : '5.4s'} ease-in-out infinite; }
      .review-clouds { animation: review-cloud-drift 12s ease-in-out infinite; }
      .review-waterfall { stroke-dasharray: 9 8; animation: review-waterfall 2.8s linear infinite; }
      .review-planet-glow { transform-origin: center; animation: review-glow 4.8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .review-scene-photo,.review-tree,.review-sprout,.review-clouds,.review-waterfall,.review-planet-glow,
        .review-leaf,.review-animal,.review-rain { animation: none !important; }
      }
    `}</style>

    <div
      className="relative h-[300px] sm:h-[360px] overflow-hidden rounded-[28px] border border-white/70 bg-sky-100 shadow-[0_24px_70px_-30px_rgba(15,118,110,0.55)] isolate"
      role="img"
      aria-label={`${stageName} 성장 풍경. ${animals.length ? animals.map(a => a.name).join(', ') + '와 함께 살고 있어요.' : '첫 동물 친구를 기다리는 새싹입니다.'}`}
    >
      <svg className="review-scene-photo absolute inset-[-2%] h-[104%] w-[104%]" viewBox="0 0 900 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="reviewSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8bd4ff" />
            <stop offset="48%" stopColor="#d9f3ff" />
            <stop offset="100%" stopColor="#eefcf4" />
          </linearGradient>
          <linearGradient id="reviewMountain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c8dfef" />
            <stop offset="100%" stopColor="#7fa4b7" />
          </linearGradient>
          <linearGradient id="reviewHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8dbf83" />
            <stop offset="100%" stopColor="#467a5a" />
          </linearGradient>
          <radialGradient id="reviewOcean" cx="38%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#4bd2ff" />
            <stop offset="52%" stopColor="#087bd6" />
            <stop offset="100%" stopColor="#064997" />
          </radialGradient>
          <radialGradient id="reviewIsland" cx="45%" cy="18%" r="86%">
            <stop offset="0%" stopColor="#c8f08c" />
            <stop offset="43%" stopColor="#58a95c" />
            <stop offset="100%" stopColor="#1e7049" />
          </radialGradient>
          <linearGradient id="reviewTrunk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7b492e" />
            <stop offset="52%" stopColor="#a86d3f" />
            <stop offset="100%" stopColor="#4f2b22" />
          </linearGradient>
          <radialGradient id="reviewLeaf" cx="40%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#d5ef72" />
            <stop offset="40%" stopColor="#64b94f" />
            <stop offset="100%" stopColor="#1d6a42" />
          </radialGradient>
          <linearGradient id="reviewWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eaffff" />
            <stop offset="100%" stopColor="#7de7ff" />
          </linearGradient>
          <filter id="reviewSoftShadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#0f5b69" floodOpacity=".3" />
          </filter>
          <filter id="reviewGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <rect width="900" height="520" fill="url(#reviewSky)" />
        <circle cx="425" cy="132" r="88" fill="#fff7b1" opacity=".38" filter="url(#reviewGlow)" />
        <circle cx="425" cy="132" r="42" fill="#fff8c7" opacity=".78" />
        <path d="M0 305 L120 176 L190 261 L294 128 L370 290 L452 190 L548 294 L660 144 L785 290 L900 198 L900 365 L0 365Z" fill="url(#reviewMountain)" opacity=".74" />
        <path d="M0 327 C120 278 182 327 294 287 C410 247 495 335 610 286 C723 238 805 282 900 248 L900 405 L0 405Z" fill="url(#reviewHill)" opacity=".8" />
        <path d="M0 358 C142 326 231 369 348 350 C505 325 633 365 900 332 L900 520 L0 520Z" fill="#8fd9d2" opacity=".48" />
        <path d="M0 380 C145 354 251 393 389 374 C553 351 687 388 900 360" fill="none" stroke="#f1ffff" strokeWidth="8" opacity=".38" />

        {showPlanetGlow && <circle className="review-planet-glow" cx="474" cy="360" r="153" fill="#aef6ff" opacity=".55" filter="url(#reviewGlow)" />}

        <g filter="url(#reviewSoftShadow)">
          <circle cx="474" cy="365" r="126" fill="url(#reviewOcean)" />
          <path d="M389 301 C413 276 440 280 456 298 C475 320 470 344 445 355 C423 365 406 351 392 332 C381 318 378 309 389 301Z" fill="#68bd62" opacity=".95" />
          <path d="M492 285 C531 270 565 285 579 309 C593 335 573 357 549 357 C522 356 509 338 487 329 C468 321 468 296 492 285Z" fill="#78c85d" opacity=".94" />
          <path d="M536 370 C558 353 589 356 600 377 C611 399 597 423 574 427 C551 431 529 410 527 391 C526 382 529 376 536 370Z" fill="#4fae53" opacity=".92" />
          <path d="M407 394 C423 375 446 378 457 395 C468 412 457 434 439 439 C420 443 401 428 399 412 C398 404 401 399 407 394Z" fill="#89ca60" opacity=".88" />
          <ellipse cx="474" cy="269" rx="178" ry="78" fill="url(#reviewIsland)" />
          <path d="M311 266 C345 238 393 223 449 219 C529 213 590 231 634 270 C591 262 557 269 530 284 C484 310 411 313 366 292 C346 282 327 274 311 266Z" fill="#2f7e4c" opacity=".58" />
          <path d="M332 287 C359 330 375 363 393 402" fill="none" stroke="url(#reviewWater)" strokeWidth="13" strokeLinecap="round" className="review-waterfall" />
          <path d="M611 284 C594 324 588 359 575 404" fill="none" stroke="url(#reviewWater)" strokeWidth="12" strokeLinecap="round" className="review-waterfall" />
        </g>

        <g className="review-clouds" fill="#fff" opacity=".9">
          <ellipse cx="328" cy="424" rx="74" ry="35" />
          <ellipse cx="380" cy="439" rx="93" ry="45" />
          <ellipse cx="538" cy="438" rx="92" ry="44" />
          <ellipse cx="612" cy="420" rx="69" ry="33" />
        </g>

        <g className="review-sprout">
          <path d="M382 314 C380 292 381 275 383 253" fill="none" stroke="#2f7f37" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="369" cy="266" rx="25" ry="12" transform="rotate(-29 369 266)" fill="#74d447" />
          <ellipse cx="399" cy="255" rx="25" ry="12" transform="rotate(28 399 255)" fill="#9ee756" />
        </g>

        <g className="review-tree" opacity={showTree ? 1 : .18}>
          <path d="M516 302 C502 267 514 236 508 202 C504 177 497 156 500 125 C520 157 535 174 539 203 C542 232 531 264 541 299Z" fill="url(#reviewTrunk)" />
          <path d="M517 213 C490 195 466 177 452 151" fill="none" stroke="#7b492e" strokeWidth="13" strokeLinecap="round" />
          <path d="M525 210 C551 190 570 170 581 147" fill="none" stroke="#6b3f29" strokeWidth="12" strokeLinecap="round" />
          <path d="M514 173 C495 153 484 135 477 116" fill="none" stroke="#815033" strokeWidth="10" strokeLinecap="round" />
          <circle cx="453" cy="139" r="47" fill="url(#reviewLeaf)" />
          <circle cx="493" cy="111" r="54" fill="url(#reviewLeaf)" />
          <circle cx="541" cy="112" r="58" fill="url(#reviewLeaf)" />
          <circle cx="582" cy="141" r="49" fill="url(#reviewLeaf)" />
          <circle cx="518" cy="154" r="64" fill="url(#reviewLeaf)" />
        </g>

        {showForest && <g opacity=".94">
          <path d="M305 281 l20 -66 l20 66z" fill="#2b7d4f" />
          <path d="M645 286 l18 -72 l22 72z" fill="#1f7146" />
          <path d="M281 292 l14 -50 l17 50z" fill="#3d9257" />
          <path d="M680 295 l15 -56 l18 56z" fill="#438e55" />
        </g>}

        {Array.from({ length: 18 }, (_, i) => {
          const x = 334 + (i * 29) % 285;
          const y = 272 + (i % 4) * 13;
          const colors = ['#fff', '#ffd76a', '#ff8fb8', '#c598ff'];
          return <g key={i} opacity={stageIndex >= 3 ? .95 : .45}>
            <circle cx={x} cy={y} r="4.2" fill={colors[i % colors.length]} />
            <circle cx={x} cy={y + 4} r="1.4" fill="#f1b84a" />
          </g>;
        })}
      </svg>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_35%,rgba(5,49,58,0.08)_100%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-emerald-950/20 to-transparent pointer-events-none" />

      {windy && Array.from({ length: 7 }, (_, i) => (
        <span
          key={`leaf-${i}`}
          aria-hidden="true"
          className="review-leaf absolute text-lg sm:text-xl drop-shadow-sm pointer-events-none"
          style={{
            left: `${-5 + i * 12}%`,
            top: `${8 + (i % 4) * 13}%`,
            animation: `review-leaf-drift ${7.2 + i * .8}s linear ${i * .9}s infinite`,
          }}
        >🍃</span>
      ))}

      {rainy && <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-700/[0.035]">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={`rain-${i}`}
            className="review-rain absolute top-0 h-12 w-px bg-gradient-to-b from-transparent via-white/80 to-transparent rotate-[10deg]"
            style={{
              left: `${(i * 17) % 102}%`,
              animation: `review-rain ${1.05 + (i % 5) * .15}s linear ${-(i % 7) * .18}s infinite`,
            }}
          />
        ))}
      </div>}

      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {visibleAnimals.map((animal, i) => {
          const flying = ['나비','꿀벌','새','앵무새','독수리'].includes(animal.name);
          const positions = [
            ['22%','25%'], ['76%','24%'], ['68%','48%'], ['31%','55%'], ['57%','19%'], ['48%','62%'],
          ];
          const [left, top] = positions[i % positions.length];
          return <span
            key={animal.name}
            title={`${animal.days}일 · ${animal.name}`}
            className="review-animal absolute text-2xl sm:text-3xl drop-shadow-[0_5px_6px_rgba(15,23,42,.28)]"
            style={{
              left, top,
              animation: flying
                ? `${i % 2 ? 'review-fly-b' : 'review-fly-a'} ${4.2 + i * .7}s ease-in-out ${-i * .6}s infinite`
                : `review-ground-bob ${3.6 + i * .5}s ease-in-out ${-i * .4}s infinite`,
            }}
          >{animal.emoji}</span>;
        })}
      </div>

      <div className="absolute left-3.5 top-3.5 sm:left-5 sm:top-5 flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-xl">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.13)]" />
        {stageName}
      </div>
      <div className="absolute right-3.5 top-3.5 sm:right-5 sm:top-5 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-xl">
        {rainy ? '🌧️' : windy ? '🍃' : '☀️'}
      </div>
    </div>

    <div className="flex flex-wrap justify-between gap-1 text-xs text-emerald-800">
      <span>함께 사는 동물 친구 {animals.length}마리</span>
      <span>{nextAnimal ? `${nextAnimal.emoji} ${nextAnimal.name}까지 ${nextAnimal.days - streak}일` : '🐋 생명 가득한 지구가 완성됐어요!'}</span>
    </div>
  </div>;
}

function QuestionCard({ uid, session, question, onSaved }: { uid: string; session: ReviewSession; question: ReviewQuestion; onSaved: (s: ReviewSession) => void }) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<{ correct: boolean; feedback: string; method: ReviewAnswer['method'] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const mounted = useRef(true);
  const lock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const check = async () => {
    if (!text.trim() || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await gradeSmartReview(question, text.trim());
      if (mounted.current) { setDraft({ ...result, method: 'ai' }); setRevealed(true); }
    } catch {
      if (mounted.current) { setRevealed(true); setError('AI 채점을 사용할 수 없습니다. 아래 참고 답안과 비교해 직접 정답/오답을 기록해 주세요.'); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const save = async (correct: boolean, method: ReviewAnswer['method']) => {
    if (!text.trim() || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = await saveReviewAnswer(uid, session.date, question.id, { text, correct, method, feedback: method === 'ai' ? draft!.feedback : '참고 답안과 비교하여 직접 채점했습니다.', answeredAt: Date.now() });
      if (mounted.current) onSaved(next);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold"><span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-600">{question.direction === 'en-ko' ? '영어 → 한국어 해석' : '한국어 → 영어 작문'}</span><span className="text-slate-500">{sourceLabel[question.source]}</span></div>
    {question.focus && <p className="text-xs text-emerald-700">복습 포인트 · {question.focus}</p>}
    <p className="text-lg sm:text-xl leading-relaxed font-semibold whitespace-pre-wrap break-words">{question.direction === 'en-ko' ? question.english : question.korean}</p>
    <label className="block text-sm font-semibold" htmlFor="review-answer">{question.direction === 'en-ko' ? '한국어로 뜻을 적어 주세요' : '영어로 문장을 써 주세요'}</label>
    <textarea id="review-answer" value={text} onChange={e => { setText(e.target.value); setDraft(null); setRevealed(false); setError(''); }} disabled={busy || revealed} maxLength={2000} rows={4} className="w-full resize-y rounded-xl border border-slate-300 p-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50" placeholder="직접 떠올려서 입력해 보세요." />
    {!revealed && <div className="flex flex-wrap gap-2"><button type="button" onClick={check} disabled={!text.trim() || busy} className={`${button} bg-indigo-600 text-white`}>{busy ? '채점 중…' : 'AI로 채점하기'}</button><button type="button" onClick={() => setRevealed(true)} disabled={!text.trim() || busy} className={`${button} bg-slate-100 text-slate-700`}>참고 답안 보고 직접 채점</button></div>}
    {error && <p role="alert" className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">{error}</p>}
    {revealed && <div className="space-y-3" aria-live="polite">
      <div className="rounded-xl bg-slate-50 p-4 space-y-2"><p className="text-xs font-bold text-slate-500">참고 답안 · 같은 뜻의 다른 표현도 정답입니다</p><p className="whitespace-pre-wrap break-words">{question.direction === 'en-ko' ? question.korean : question.english}</p>{question.source === 'writing' && <p className="text-xs text-slate-500">첨삭 전 내 영작입니다. 문법과 의미를 함께 확인해 주세요.</p>}</div>
      {draft && <p className="text-sm leading-relaxed"><strong>{draft.correct ? '정답으로 판단했어요. ' : '다시 익힐 표현이 있어요. '}</strong>{draft.feedback}</p>}
      <div className="flex flex-wrap gap-2">
        {draft && <button type="button" disabled={busy} onClick={() => save(draft.correct, 'ai')} className={`${button} bg-indigo-600 text-white`}>이 결과로 기록하고 다음</button>}
        <button type="button" disabled={busy} onClick={() => save(true, 'self')} className={`${button} bg-emerald-50 text-emerald-800`}>직접 채점: 정답</button>
        <button type="button" disabled={busy} onClick={() => save(false, 'self')} className={`${button} bg-amber-50 text-amber-800`}>직접 채점: 오답</button>
      </div><p className="text-xs text-slate-500">오답도 오늘의 복습 완료에 포함됩니다. 기록한 답안은 바꿀 수 없습니다.</p>
    </div>}
    {busy && <p role="status" className="text-sm text-indigo-600 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" />{revealed ? '기록을 저장하고 있어요…' : '의미를 비교하고 있어요…'}</p>}
  </section>;
}

export function SmartReviewTab({ uid, today, sessions, ready, error, retry, compositions, expressions, sourcesReady, onAddSource }: Props) {
  const [started, setStarted] = useState<ReviewSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [historyDate, setHistoryDate] = useState(today);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const remote = sessions.find(s => s.date === started?.date);
  const allSessions = started && (!remote || Object.keys(started.answers).length > Object.keys(remote.answers).length)
    ? [...sessions.filter(s => s.date !== started.date), started] : sessions;
  const daily = dailySession(allSessions, today);
  const extras = allSessions.filter(s => sessionDay(s) === today && isExtra(s));
  const pendingExtra = extras.find(s => !isComplete(s));
  const session = pendingExtra || (!isComplete(daily) && daily?.mode === 'daily-short' ? daily : undefined);
  const stats = reviewStats(allSessions, today);
  const complete = isComplete(daily);
  const count = session ? Object.keys(session.answers).length : 0;
  const question = session?.questions.find(q => !session.answers[q.id]);
  const candidate = createReviewSession(today, compositions, expressions, sessions);
  const hasSources = candidate.questions.length > 0 || compositions.some(c => c.polished?.trim() && c.korean?.trim());
  const begin = async () => {
    if (!uid || lock.current || !ready) return;
    lock.current = true; setBusy(true); setActionError('');
    try {
      const candidates = await reviewCandidates(compositions, expressions);
      const next = createReviewSession(today, compositions, expressions, allSessions, Date.now(), { candidates });
      const result = await startReview(uid, next); if (mounted.current) setStarted(result);
    }
    catch (e) { if (mounted.current) setActionError(e instanceof Error ? e.message : '복습을 시작하지 못했습니다. 다시 시도해 주세요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const addOne = async () => {
    if (!uid || lock.current || !ready || !complete || pendingExtra) return;
    lock.current = true; setBusy(true); setActionError('');
    try {
      const candidates = await reviewCandidates(compositions, expressions);
      const next = createReviewSession(today, compositions, expressions, allSessions, Date.now(),
        { candidates, extra: true, key: `${today}~extra~${Date.now()}` });
      const result = await startReview(uid, next); if (mounted.current) setStarted(result);
    } catch (e) { if (mounted.current) setActionError(e instanceof Error ? e.message : '추가 복습을 시작하지 못했습니다. 다시 시도해 주세요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const exportHistory = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, timezone: 'Asia/Seoul', exportedAt: new Date().toISOString(), sessions: allSessions }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `smart-review-${today}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const history = dailySession(allSessions, historyDate);
  const extraHistory = allSessions.filter(s => sessionDay(s) === historyDate && isExtra(s));
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between items-end gap-2"><div><h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Leaf className="text-emerald-600" />스마트 복습</h1><p className="text-sm text-slate-500 mt-1">매일 한 번, 내 문장으로 키우는 영어의 숲</p></div><span className="text-xs text-slate-500">{today} · 한국 시간 기준</span></div>
    <section className="rounded-2xl border border-emerald-200 bg-white p-4 sm:p-6 space-y-4">
      <GrowthScene streak={stats.streak} stageName={stats.stage.name} stageIndex={stats.stageIndex} />
      <div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-700">나의 {stats.stage.name}</p><p className="text-3xl font-black mt-1">{stats.streak}<span className="text-sm font-semibold text-slate-500 ml-2">일 연속 복습</span></p></div><div className="text-right text-sm text-slate-500">최고 <strong className="text-slate-800">{stats.longest}일</strong><br />누적 완료 <strong className="text-slate-800">{stats.total}일</strong></div></div>
      <div><div className="flex justify-between text-sm mb-2"><strong className="text-emerald-800">{stats.next ? `${stats.next.name}까지 ${stats.remaining}일!` : '365일의 지구를 만들었어요. 계속 키워요!'}</strong><span className="text-slate-500">{stats.progress}%</span></div><div role="progressbar" aria-label="다음 성장 단계 진행률" aria-valuenow={stats.progress} aria-valuemin={0} aria-valuemax={100} className="h-2.5 bg-emerald-50 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.progress}%` }} /></div></div>
      <div className="rounded-xl bg-emerald-50 p-3 text-sm"><div className="flex justify-between gap-2"><strong>🌍 1년의 숲 만들기</strong><span>{Math.min(stats.streak, 365)} / 365일</span></div><progress aria-label="365일 성장 여정" value={Math.min(stats.streak, 365)} max={365} className="w-full h-2 mt-2 accent-emerald-600" /><p className="text-xs text-emerald-800 mt-1">{stats.streak < 365 ? `생명의 지구까지 ${365 - stats.streak}일 · ${Math.floor(Math.min(stats.streak, 365) / 365 * 100)}%` : '1년 달성! 연속 복습과 동물 친구들은 계속 함께해요.'}</p></div>
      <details className="rounded-xl border border-slate-100 p-3"><summary className="cursor-pointer text-sm font-semibold">새싹부터 지구까지 · 16단계 여정 보기</summary><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">{GROWTH_STAGES.map((stage, i) => <div key={stage.days} className={`text-center text-xs rounded-xl p-2 ${i === stats.stageIndex ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-slate-50 text-slate-500'}`}><div className="text-xl mb-1">{stage.emoji}</div><strong className="block">{stage.name}</strong><span>{stage.days === 0 ? '시작' : `${stage.days}일`}{i === stats.stageIndex ? ' · 현재' : stats.streak >= stage.days ? ' · 달성' : ''}</span></div>)}</div></details>
      <p className="text-xs leading-relaxed text-slate-500">매일 짧은 5문항을 기록하면 완료. 오답은 연속 기록에 영향을 주지 않아요. 완료 뒤 한 문장씩 더 풀어도 됩니다. 하루라도 완료하지 않으면 연속 기록은 0일부터 다시 시작합니다.</p>
    </section>
    {!uid ? <div className="rounded-2xl bg-indigo-50 p-5 text-sm text-indigo-900">상단 계정에서 Google 로그인 후 시작해 주세요. 복습 기록과 성장 단계가 PC·모바일에 함께 저장됩니다.</div> : <>
      {!ready && <div role="status" className="rounded-xl bg-slate-100 p-4 text-sm">{error || '서버의 복습 기록을 확인하고 있어요. 인터넷 연결이 필요합니다.'}<button type="button" onClick={retry} className="ml-3 underline">다시 연결</button></div>}
      {actionError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{actionError}</p>}
      {ready && <>
        {complete && <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-3" aria-live="polite"><h2 className="font-bold text-lg text-emerald-900 flex gap-2 items-center"><CheckCircle2 />오늘의 복습 완료!</h2><p className="text-sm text-emerald-800">기본 {daily?.questions.length || 5}문항 완료 · 추가 복습 {extras.length}문항. 오늘도 숲에 하루를 더했어요.</p><p className="text-xs text-emerald-700">추가 복습을 중간에 멈춰도 오늘의 완료와 연속 기록은 유지됩니다.</p>{!pendingExtra && <button type="button" disabled={busy || !sourcesReady || !hasSources} onClick={addOne} className={`${button} bg-emerald-700 text-white`}>{busy ? '문장 고르는 중…' : '복습 문장 하나 더 하기'}</button>}</section>}
        {session && question ? <>
          <div className="flex justify-between items-center text-sm"><h2 className="font-bold">{isExtra(session) ? '추가 복습 · 한 문장' : '오늘 꼭 해야 할 복습'}</h2><span>{count} / {session.questions.length}문항 완료</span></div>
          <QuestionCard key={`${uid}:${session.date}:${question.id}`} uid={uid} session={session} question={question} onSaved={setStarted} />
        </> : !complete && <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><h2 className="font-bold text-lg">오늘 꼭 해야 할 복습</h2><p className="text-sm text-slate-600">{!sourcesReady ? '학습 자료를 동기화하고 있어요…' : hasSources ? '첨삭한 영작의 핵심 수정과 주요 표현에서 짧은 문장 5개를 골라요. 자료가 적으면 같은 문장을 반대 방향으로 한 번 더 연습합니다.' : '첨삭이 완료된 영작이나 영어·한국어가 함께 있는 주요 표현을 먼저 저장해 주세요.'}</p><button type="button" disabled={busy || !sourcesReady} onClick={hasSources ? begin : onAddSource} className={`${button} bg-indigo-600 text-white inline-flex gap-2 items-center`}>{busy ? '핵심 문장 고르는 중…' : hasSources ? '짧은 5문항 시작' : '영작 기록하러 가기'}<ChevronRight className="w-4 h-4" /></button><p className="text-xs text-slate-500">문항당 최대 3문장 · 오늘의 문제는 시작한 뒤 고정됩니다.</p></section>}
      </>}
    </>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="font-bold text-lg">복습 기록</h2><button type="button" disabled={!allSessions.length} onClick={exportHistory} className="text-xs text-slate-500 flex items-center gap-1 disabled:opacity-40"><Download className="w-4 h-4" />전체 기록 내려받기</button></div>
      <p className="text-xs text-slate-500">최근 28일 · 초록: 완료 / 주황: 진행 중 / 회색: 미완료</p>
      <div className="grid grid-cols-7 gap-2">{Array.from({ length: 28 }, (_, i) => shiftReviewDate(today, i - 27)).map(date => { const day = dailySession(allSessions, date); return <button type="button" key={date} onClick={() => setHistoryDate(date)} aria-label={`${date} ${isComplete(day) ? '완료' : day ? '진행 중' : '미완료'}`} aria-pressed={date === historyDate} className={`min-h-10 rounded-lg text-xs font-semibold ${isComplete(day) ? 'bg-emerald-100 text-emerald-800' : day ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-400'} ${date === historyDate ? 'ring-2 ring-indigo-400' : ''}`}>{date.slice(5)}</button>; })}</div>
      <label className="flex flex-wrap items-center gap-3 text-sm">날짜별 기록<input aria-label="복습 기록 날짜" type="date" max={today} value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" /></label>
      {history || extraHistory.length ? <div className="space-y-3"><p className="text-sm font-semibold">{historyDate} · {isComplete(history) ? '완료' : history ? `미완료 (${Object.keys(history.answers).length}/${history.questions.length})` : '기본 복습 없음'} · 추가 복습 {extraHistory.length}문항</p>{[...(history ? [history] : []), ...extraHistory].flatMap(s => s.questions.map(q => ({ s, q }))).map(({ s, q }) => { const a = s.answers[q.id]; return <details key={`${s.date}:${q.id}`} className="rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm break-words"><span className={a ? a.correct ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold' : 'text-slate-500'}>{a ? a.correct ? '정답' : '오답' : '미응답'}</span> · {isExtra(s) ? '추가 · ' : ''}{q.direction === 'en-ko' ? '해석' : '영작'} · {q.direction === 'en-ko' ? q.english : q.korean}</summary><div className="text-sm space-y-2 pt-3 break-words whitespace-pre-wrap"><p>내 답안: {a?.text || '아직 기록하지 않았어요.'}</p><p>참고 답안: {q.direction === 'en-ko' ? q.korean : q.english}</p>{a && <p className="text-slate-500">{a.method === 'ai' ? 'AI 채점' : '직접 채점'} · {a.feedback}</p>}</div></details>; })}</div> : <p className="text-sm text-slate-500">이 날짜에는 복습 기록이 없습니다.</p>}
    </section>
  </div>;
}

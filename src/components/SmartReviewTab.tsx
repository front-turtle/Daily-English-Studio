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


function GrowthScene({
  streak,
  stageName,
  stageIndex,
  longest,
  total,
  progress,
  remaining,
  nextName,
  today,
}: {
  streak: number;
  stageName: string;
  stageIndex: number;
  longest: number;
  total: number;
  progress: number;
  remaining: number;
  nextName?: string;
  today: string;
}) {
  const { animals } = forestLife(streak);
  const weatherKey = streak % 11;
  const rainy = streak > 0 && (weatherKey === 4 || weatherKey === 9);
  const windy = weatherKey === 2 || weatherKey === 5 || weatherKey === 7 || rainy;
  const visibleAnimals = animals.slice(-6);
  const worldImage = new URL('assets/smart-review-world.svg', document.baseURI).toString();
  const yearlyProgress = Math.floor((Math.min(streak, 365) / 365) * 100);
  const macroStages = [
    { days: 0, label: '새싹', emoji: '🌱' },
    { days: 7, label: '나무', emoji: '🌳' },
    { days: 30, label: '숲', emoji: '🌲' },
    { days: 365, label: '지구', emoji: '🌍' },
  ];

  return <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-sky-100 shadow-[0_28px_90px_-36px_rgba(15,118,110,.55)]">
    <style>{`
      @keyframes review-world-float {
        0%,100% { transform: scale(1.035) translate3d(0,0,0); }
        50% { transform: scale(1.07) translate3d(-0.7%,-0.8%,0); }
      }
      @keyframes review-leaf-drift {
        0% { transform: translate3d(-50px,-20px,0) rotate(0deg); opacity: 0; }
        12% { opacity: .92; }
        100% { transform: translate3d(520px,290px,0) rotate(520deg); opacity: 0; }
      }
      @keyframes review-fly-a {
        0%,100% { transform: translate3d(0,0,0) rotate(-5deg); }
        25% { transform: translate3d(32px,-18px,0) rotate(6deg); }
        55% { transform: translate3d(4px,16px,0) rotate(-4deg); }
        80% { transform: translate3d(-24px,-7px,0) rotate(3deg); }
      }
      @keyframes review-fly-b {
        0%,100% { transform: translate3d(0,0,0) scale(1); }
        35% { transform: translate3d(-34px,13px,0) scale(1.05); }
        70% { transform: translate3d(18px,-20px,0) scale(.96); }
      }
      @keyframes review-ground-bob {
        0%,100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes review-rain {
        0% { transform: translateY(-42px) translateX(0); opacity: 0; }
        15% { opacity: .65; }
        100% { transform: translateY(520px) translateX(-60px); opacity: 0; }
      }
      @keyframes review-glow {
        0%,100% { opacity: .18; transform: scale(.96); }
        50% { opacity: .54; transform: scale(1.06); }
      }
      .review-world-photo { animation: review-world-float 15s ease-in-out infinite; }
      .review-world-glow { animation: review-glow 5s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .review-world-photo,.review-world-glow,.review-leaf,.review-animal,.review-rain { animation: none !important; }
      }
    `}</style>

    <img
      src={worldImage}
      alt=""
      aria-hidden="true"
      className="review-world-photo absolute inset-[-3%] h-[106%] w-[106%] object-cover object-center select-none pointer-events-none"
      style={{ filter: `saturate(${0.98 + Math.min(stageIndex, 10) * 0.012}) brightness(${0.98 + Math.min(stageIndex, 10) * 0.004})` }}
    />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.08)_0%,rgba(255,255,255,.02)_42%,rgba(6,78,59,.18)_100%)] pointer-events-none" />
    <div className="review-world-glow absolute left-[42%] top-[18%] h-40 w-40 rounded-full bg-amber-200/40 blur-3xl pointer-events-none" />

    {windy && Array.from({ length: 9 }, (_, i) => (
      <span
        key={`leaf-${i}`}
        aria-hidden="true"
        className="review-leaf absolute text-lg sm:text-2xl drop-shadow-sm pointer-events-none"
        style={{
          left: `${-9 + i * 10}%`,
          top: `${4 + (i % 4) * 11}%`,
          animation: `review-leaf-drift ${7.6 + i * .7}s linear ${i * .85}s infinite`,
        }}
      >🍃</span>
    ))}

    {rainy && <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-900/[0.07]">
      {Array.from({ length: 32 }, (_, i) => (
        <span
          key={`rain-${i}`}
          className="review-rain absolute top-0 h-16 w-px bg-gradient-to-b from-transparent via-white/85 to-transparent rotate-[10deg]"
          style={{
            left: `${(i * 13) % 104}%`,
            animation: `review-rain ${1 + (i % 5) * .15}s linear ${-(i % 7) * .18}s infinite`,
          }}
        />
      ))}
    </div>}

    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {visibleAnimals.map((animal, i) => {
        const flying = ['나비','꿀벌','새','앵무새','독수리'].includes(animal.name);
        const positions = [
          ['31%','31%'], ['78%','28%'], ['70%','48%'], ['28%','54%'], ['58%','19%'], ['48%','59%'],
        ];
        const [left, top] = positions[i % positions.length];
        return <span
          key={animal.name}
          className="review-animal absolute text-2xl sm:text-3xl drop-shadow-[0_6px_8px_rgba(15,23,42,.28)]"
          style={{
            left, top,
            animation: flying
              ? `${i % 2 ? 'review-fly-b' : 'review-fly-a'} ${4.2 + i * .7}s ease-in-out ${-i * .6}s infinite`
              : `review-ground-bob ${3.6 + i * .5}s ease-in-out ${-i * .4}s infinite`,
          }}
        >{animal.emoji}</span>;
      })}
    </div>

    <div className="relative z-10 flex min-h-[690px] sm:min-h-[760px] flex-col p-5 sm:p-8">
      <div className="flex items-start justify-between gap-4 text-slate-900">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2 drop-shadow-[0_1px_2px_rgba(255,255,255,.7)]">
            <Leaf className="w-8 h-8 text-emerald-700" />스마트 복습
          </h1>
          <p className="mt-2 text-sm sm:text-base font-semibold text-slate-700">{today}</p>
        </div>
        <div className="rounded-2xl border border-white/75 bg-white/75 px-3 py-2 text-xl shadow-lg backdrop-blur-xl">
          {rainy ? '🌧️' : windy ? '🍃' : '☀️'}
        </div>
      </div>

      <div className="mt-20 sm:mt-24">
        <div className="inline-flex items-center gap-3 rounded-[24px] border border-white/80 bg-white/78 px-4 py-3 shadow-xl backdrop-blur-xl">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="text-2xl font-black text-slate-900 leading-none">{streak}일</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">연속 복습</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 ml-1" />
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="rounded-[28px] border border-white/80 bg-white/70 px-3 py-4 shadow-xl backdrop-blur-2xl">
          <div className="grid grid-cols-4 items-end gap-1">
            {macroStages.map((stage, index) => {
              const achieved = streak >= stage.days;
              const currentMacro = index === macroStages.length - 1
                ? streak >= stage.days
                : achieved && streak < macroStages[index + 1].days;
              return <div key={stage.label} className="relative flex flex-col items-center text-center">
                {index < macroStages.length - 1 && <div className="absolute left-[62%] top-7 h-px w-[76%] bg-white/90" />}
                <div className={`relative z-10 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border shadow-lg ${currentMacro ? 'border-violet-300 bg-white ring-4 ring-violet-300/35' : achieved ? 'border-white/90 bg-white/90' : 'border-white/60 bg-white/55'}`}>
                  <span className="text-3xl sm:text-4xl">{stage.emoji}</span>
                  {achieved && !currentMacro && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white ring-2 ring-white">✓</span>}
                </div>
                <span className={`mt-2 text-xs sm:text-sm font-bold ${currentMacro ? 'text-violet-700' : 'text-slate-600'}`}>{stage.label}</span>
              </div>;
            })}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/85 bg-white/90 p-4 sm:p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg sm:text-xl font-black text-emerald-800">나의 {stageName}</p>
              <p className="text-sm font-semibold text-slate-500 mt-1">{nextName ? `${nextName}까지 ${remaining}일!` : '생명의 지구 완성!'}</p>
            </div>
            <div className="text-right text-sm text-slate-500">
              최고 <strong className="text-slate-800">{longest}일</strong><br />
              누적 완료 <strong className="text-slate-800">{total}일</strong>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-bold text-slate-500">{progress}%</span>
          </div>
        </div>

        <div className="rounded-[26px] border border-white/85 bg-white/90 p-4 sm:p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-2xl">🌍</div>
              <div>
                <p className="text-lg font-black text-slate-900">1년의 숲 만들기</p>
                <p className="text-sm font-semibold text-slate-500">{streak < 365 ? `생명의 지구까지 ${365 - streak}일` : '1년 달성!'}</p>
              </div>
            </div>
            <span className="text-sm sm:text-base font-bold text-slate-600">{Math.min(streak, 365)} / 365일</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500 transition-all" style={{ width: `${yearlyProgress}%` }} />
            </div>
            <span className="text-sm font-bold text-slate-500">{yearlyProgress}%</span>
          </div>
        </div>
      </div>
    </div>
  </section>;
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
    <GrowthScene
      streak={stats.streak}
      stageName={stats.stage.name}
      stageIndex={stats.stageIndex}
      longest={stats.longest}
      total={stats.total}
      progress={stats.progress}
      remaining={stats.remaining}
      nextName={stats.next?.name}
      today={today}
    />
    <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold">새싹부터 지구까지 · 16단계 여정 보기</summary>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {GROWTH_STAGES.map((stage, i) => <div key={stage.days} className={`text-center text-xs rounded-xl p-2 ${i === stats.stageIndex ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-slate-50 text-slate-500'}`}><div className="text-xl mb-1">{stage.emoji}</div><strong className="block">{stage.name}</strong><span>{stage.days === 0 ? '시작' : `${stage.days}일`}{i === stats.stageIndex ? ' · 현재' : stats.streak >= stage.days ? ' · 달성' : ''}</span></div>)}
      </div>
    </details>
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

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Download, Leaf, Loader2 } from 'lucide-react';
import type { DailyComposition, KeyExpression } from '../types';
import { createReviewSession, dailySession, GROWTH_STAGES, isComplete, isExtra, reviewStats, sessionDay, shiftReviewDate, WORLD_STAGES, worldProgress, worldStageForStreak, worldStageProgress } from '../lib/smartReview';
import type { ReviewAnswer, ReviewQuestion, ReviewSession } from '../lib/smartReview';
import { reviewCandidates } from '../lib/reviewCandidates';
import { saveReviewAnswer, startReview } from '../lib/smartReviewService';
import { gradeSmartReview } from '../lib/gradeSmartReview';
import { GrowthScene as LivingGarden } from './GrowthScene';

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
  longest,
  total,
  today,
}: {
  streak: number;
  longest: number;
  total: number;
  today: string;
}) {
  const stage = worldStageForStreak(streak);
  const stageIndex = WORLD_STAGES.findIndex(item => item.key === stage.key);
  const stageProgress = worldStageProgress(streak, stage);
  const yearlyProgress = worldProgress(streak);
  const nextStage = WORLD_STAGES[stageIndex + 1];
  const remaining = nextStage
    ? Math.max(0, nextStage.startDay - streak)
    : Math.max(0, 365 - streak);

  const stageRanges = ['0~30일', '31~120일', '121~240일', '241~365일'];

  return <div className="space-y-4">
    <LivingGarden streak={streak} longest={longest} stageName={stage.name} />

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="grid grid-cols-4 gap-1">
        {WORLD_STAGES.map((item, index) => {
          const achieved = streak >= item.startDay;
          const current = item.key === stage.key;
          return <div key={item.key} className="relative flex flex-col items-center text-center">
            {index < WORLD_STAGES.length - 1 && <div className={`absolute left-[62%] top-6 h-px w-[76%] ${streak >= WORLD_STAGES[index + 1].startDay ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            <div className={`relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border transition ${current ? 'border-emerald-300 bg-emerald-50 ring-4 ring-emerald-100' : achieved ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-55'}`}>
              <span className="text-2xl sm:text-3xl">{item.emoji}</span>
              {achieved && !current && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white ring-2 ring-white">✓</span>}
            </div>
            <span className={`mt-2 text-[11px] sm:text-xs font-bold ${current ? 'text-emerald-700' : 'text-slate-500'}`}>{item.name}</span>
            <span className="mt-0.5 text-[9px] sm:text-[10px] text-slate-400">{stageRanges[index]}</span>
          </div>;
        })}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-emerald-800">{stage.emoji} 나의 {stage.name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{stage.subtitle}</p>
        </div>
        <div className="shrink-0 text-right text-xs sm:text-sm text-slate-500">
          최고 <strong className="text-slate-800">{longest}일</strong><br />
          누적 <strong className="text-slate-800">{total}일</strong>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span className="text-emerald-700">{nextStage ? `${nextStage.name}까지 ${remaining}일` : streak >= 365 ? '365일 지구 완성' : `지구 완성까지 ${remaining}일`}</span>
          <span className="text-slate-500">{stageProgress}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all" style={{ width: `${stageProgress}%` }} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span className="text-slate-600">🌍 365일 생태계</span>
          <span className="text-slate-500">{Math.min(streak, 365)} / 365일</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500 transition-all" style={{ width: `${yearlyProgress}%` }} />
        </div>
      </div>
    </section>

    <span className="sr-only">{today} 기준 {stage.name} 단계, 연속 {streak}일</span>
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
    <div className="flex items-end justify-between gap-3 px-1">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900"><Leaf className="h-6 w-6 text-emerald-600" />스마트 복습</h1>
        <p className="mt-1 text-sm text-slate-500">오늘의 복습으로 세계를 키워요.</p>
      </div>
      <span className="text-xs font-semibold text-slate-400">{today}</span>
    </div>
    <GrowthScene
      streak={stats.streak}
      longest={stats.longest}
      total={stats.total}
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

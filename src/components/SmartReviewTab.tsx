import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Download, Leaf, Loader2 } from 'lucide-react';
import type { DailyComposition, KeyExpression } from '../types';
import { createReviewSession, forestLife, GROWTH_STAGES, isComplete, reviewStats, shiftReviewDate } from '../lib/smartReview';
import type { ReviewAnswer, ReviewQuestion, ReviewSession } from '../lib/smartReview';
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
const sourceLabel = { writing: '내 영작', polished: 'AI 첨삭 · 다듬은 표현', expression: '주요 표현' };
const button = 'rounded-xl px-4 py-3 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed';

function GrowthScene({ streak, stageName }: { streak: number; stageName: string }) {
  const { animals, nextAnimal } = forestLife(streak);
  const trees = streak < 21 ? 1 : Math.min(11, 3 + Math.floor(streak / 30));
  return <div className="space-y-2">
    <div className="relative h-56 sm:h-64 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-emerald-50 to-emerald-200" role="img" aria-label={`${stageName} 성장 풍경. ${animals.length ? animals.map(a => a.name).join(', ') + '와 함께 살고 있어요.' : '첫 동물 친구를 기다리는 새싹입니다.'}`}>
      <div className="absolute right-6 top-4 text-4xl" aria-hidden="true">{streak >= 240 ? streak >= 365 ? '🌍' : '🌏' : '☀️'}</div>
      <div className="absolute bottom-0 inset-x-0 h-24 bg-emerald-300/40 rounded-t-[50%]" />
      <div className="absolute bottom-4 right-0 h-5 w-2/5 rounded-full bg-sky-300/60 rotate-[-8deg]" />
      <div className="absolute inset-x-4 top-9 flex items-end justify-center -space-x-3 select-none" aria-hidden="true">
        {Array.from({ length: trees }, (_, i) => <span key={i} className={i % 2 ? 'text-6xl sm:text-7xl pt-4' : 'text-7xl sm:text-8xl'}>{streak < 7 ? '🌱' : streak < 14 ? '🌿' : streak >= 120 && i % 2 === 0 ? '🌴' : i % 3 ? '🌲' : '🌳'}</span>)}
      </div>
      <div className="absolute bottom-2 inset-x-3 grid grid-cols-5 gap-x-2 gap-y-1 items-center justify-items-center" aria-hidden="true">
        {animals.map(a => <span key={a.name} title={`${a.days}일 · ${a.name}`} className="text-2xl sm:text-3xl drop-shadow-sm">{a.emoji}</span>)}
      </div>
      {!animals.length && <p className="absolute inset-x-0 bottom-5 text-center text-xs text-emerald-800">3일 연속 복습하면 첫 나비가 찾아와요</p>}
    </div>
    <div className="flex flex-wrap justify-between gap-1 text-xs text-emerald-800"><span>함께 사는 동물 친구 {animals.length}마리</span><span>{nextAnimal ? `${nextAnimal.emoji} ${nextAnimal.name}까지 ${nextAnimal.days - streak}일` : '🐋 1년 동안 생명 가득한 지구를 만들었어요!'}</span></div>
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
  const remote = sessions.find(s => s.date === today);
  const session = started?.date === today && (!remote || Object.keys(started.answers).length > Object.keys(remote.answers).length) ? started : remote;
  const allSessions = session ? [...sessions.filter(s => s.date !== today), session] : sessions;
  const stats = reviewStats(allSessions, today);
  const complete = isComplete(session);
  const count = session ? Object.keys(session.answers).length : 0;
  const question = session?.questions.find(q => !session.answers[q.id]);
  const candidate = createReviewSession(today, compositions, expressions, sessions);
  const begin = async () => {
    if (!uid || lock.current) return;
    lock.current = true; setBusy(true); setActionError('');
    try { const result = await startReview(uid, candidate); if (mounted.current) setStarted(result); }
    catch (e) { if (mounted.current) setActionError(e instanceof Error ? e.message : '복습을 시작하지 못했습니다. 다시 시도해 주세요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const exportHistory = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, timezone: 'Asia/Seoul', exportedAt: new Date().toISOString(), sessions: allSessions }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `smart-review-${today}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const history = allSessions.find(s => s.date === historyDate);
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between items-end gap-2"><div><h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Leaf className="text-emerald-600" />스마트 복습</h1><p className="text-sm text-slate-500 mt-1">매일 한 번, 내 문장으로 키우는 영어의 숲</p></div><span className="text-xs text-slate-500">{today} · 한국 시간 기준</span></div>
    <section className="rounded-2xl border border-emerald-200 bg-white p-4 sm:p-6 space-y-4">
      <GrowthScene streak={stats.streak} stageName={stats.stage.name} />
      <div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-700">나의 {stats.stage.name}</p><p className="text-3xl font-black mt-1">{stats.streak}<span className="text-sm font-semibold text-slate-500 ml-2">일 연속 복습</span></p></div><div className="text-right text-sm text-slate-500">최고 <strong className="text-slate-800">{stats.longest}일</strong><br />누적 완료 <strong className="text-slate-800">{stats.total}일</strong></div></div>
      <div><div className="flex justify-between text-sm mb-2"><strong className="text-emerald-800">{stats.next ? `${stats.next.name}까지 ${stats.remaining}일!` : '365일의 지구를 만들었어요. 계속 키워요!'}</strong><span className="text-slate-500">{stats.progress}%</span></div><div role="progressbar" aria-label="다음 성장 단계 진행률" aria-valuenow={stats.progress} aria-valuemin={0} aria-valuemax={100} className="h-2.5 bg-emerald-50 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.progress}%` }} /></div></div>
      <div className="rounded-xl bg-emerald-50 p-3 text-sm"><div className="flex justify-between gap-2"><strong>🌍 1년의 숲 만들기</strong><span>{Math.min(stats.streak, 365)} / 365일</span></div><progress aria-label="365일 성장 여정" value={Math.min(stats.streak, 365)} max={365} className="w-full h-2 mt-2 accent-emerald-600" /><p className="text-xs text-emerald-800 mt-1">{stats.streak < 365 ? `생명의 지구까지 ${365 - stats.streak}일 · ${Math.floor(Math.min(stats.streak, 365) / 365 * 100)}%` : '1년 달성! 연속 복습과 동물 친구들은 계속 함께해요.'}</p></div>
      <details className="rounded-xl border border-slate-100 p-3"><summary className="cursor-pointer text-sm font-semibold">새싹부터 지구까지 · 16단계 여정 보기</summary><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">{GROWTH_STAGES.map((stage, i) => <div key={stage.days} className={`text-center text-xs rounded-xl p-2 ${i === stats.stageIndex ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-slate-50 text-slate-500'}`}><div className="text-xl mb-1">{stage.emoji}</div><strong className="block">{stage.name}</strong><span>{stage.days === 0 ? '시작' : `${stage.days}일`}{i === stats.stageIndex ? ' · 현재' : stats.streak >= stage.days ? ' · 달성' : ''}</span></div>)}</div></details>
      <p className="text-xs leading-relaxed text-slate-500">매일 모든 문항을 기록하면 완료. 오답은 연속 기록에 영향을 주지 않아요. 하루라도 완료하지 않으면 연속 기록은 0일부터 다시 시작합니다. 복구·지난 날짜 채우기는 없습니다.</p>
    </section>
    {!uid ? <div className="rounded-2xl bg-indigo-50 p-5 text-sm text-indigo-900">상단 계정에서 Google 로그인 후 시작해 주세요. 복습 기록과 성장 단계가 PC·모바일에 함께 저장됩니다.</div> : <>
      {!ready && <div role="status" className="rounded-xl bg-slate-100 p-4 text-sm">{error || '서버의 복습 기록을 확인하고 있어요. 인터넷 연결이 필요합니다.'}<button type="button" onClick={retry} className="ml-3 underline">다시 연결</button></div>}
      {actionError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{actionError}</p>}
      {ready && (complete ? <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-2" aria-live="polite"><h2 className="font-bold text-lg text-emerald-900 flex gap-2 items-center"><CheckCircle2 />오늘의 복습 완료!</h2><p className="text-sm text-emerald-800">정답 {Object.values(session!.answers).filter(a => a.correct).length}개 · 오답 {Object.values(session!.answers).filter(a => !a.correct).length}개. 오늘도 숲에 하루를 더했어요.</p><p className="text-xs text-emerald-700">서버 저장 완료 · 같은 Google 계정으로 다른 기기에서도 이어집니다.</p></section> : session && question ? <>
        <div className="flex justify-between items-center text-sm"><h2 className="font-bold">오늘 꼭 해야 할 복습</h2><span>{count} / {session.questions.length}문항 완료</span></div>
        <QuestionCard key={`${uid}:${today}:${question.id}`} uid={uid} session={session} question={question} onSaved={setStarted} />
      </> : <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><h2 className="font-bold text-lg">오늘 꼭 해야 할 복습</h2><p className="text-sm text-slate-600">{!sourcesReady ? '학습 자료를 동기화하고 있어요…' : candidate.questions.length ? `내 학습 기록에서 ${candidate.questions.length}문항을 준비했어요. 오래 안 본 문장과 오답을 우선 복습합니다.` : '영어와 한국어가 함께 있는 영작이나 주요 표현을 먼저 저장해 주세요. 2,000자를 넘는 긴 글은 짧은 문장으로 나눠 주세요.'}</p><button type="button" disabled={busy || !sourcesReady} onClick={candidate.questions.length ? begin : onAddSource} className={`${button} bg-indigo-600 text-white inline-flex gap-2 items-center`}>{busy ? '준비 중…' : candidate.questions.length ? '오늘의 복습 시작' : '영작 기록하러 가기'}<ChevronRight className="w-4 h-4" /></button><p className="text-xs text-slate-500">최대 5문항 · 시작한 문제는 오늘 하루 고정됩니다.</p></section>)}
    </>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="font-bold text-lg">복습 기록</h2><button type="button" disabled={!allSessions.length} onClick={exportHistory} className="text-xs text-slate-500 flex items-center gap-1 disabled:opacity-40"><Download className="w-4 h-4" />전체 기록 내려받기</button></div>
      <p className="text-xs text-slate-500">최근 28일 · 초록: 완료 / 주황: 진행 중 / 회색: 미완료</p>
      <div className="grid grid-cols-7 gap-2">{Array.from({ length: 28 }, (_, i) => shiftReviewDate(today, i - 27)).map(date => { const day = allSessions.find(s => s.date === date); return <button type="button" key={date} onClick={() => setHistoryDate(date)} aria-label={`${date} ${isComplete(day) ? '완료' : day ? '진행 중' : '미완료'}`} aria-pressed={date === historyDate} className={`min-h-10 rounded-lg text-xs font-semibold ${isComplete(day) ? 'bg-emerald-100 text-emerald-800' : day ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-400'} ${date === historyDate ? 'ring-2 ring-indigo-400' : ''}`}>{date.slice(5)}</button>; })}</div>
      <label className="flex flex-wrap items-center gap-3 text-sm">날짜별 기록<input aria-label="복습 기록 날짜" type="date" max={today} value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" /></label>
      {history ? <div className="space-y-3"><p className="text-sm font-semibold">{history.date} · {isComplete(history) ? '완료' : `미완료 (${Object.keys(history.answers).length}/${history.questions.length})`}</p>{history.questions.map(q => { const a = history.answers[q.id]; return <details key={q.id} className="rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm break-words"><span className={a ? a.correct ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold' : 'text-slate-500'}>{a ? a.correct ? '정답' : '오답' : '미응답'}</span> · {q.direction === 'en-ko' ? '해석' : '영작'} · {q.direction === 'en-ko' ? q.english : q.korean}</summary><div className="text-sm space-y-2 pt-3 break-words whitespace-pre-wrap"><p>내 답안: {a?.text || '아직 기록하지 않았어요.'}</p><p>참고 답안: {q.direction === 'en-ko' ? q.korean : q.english}</p>{a && <p className="text-slate-500">{a.method === 'ai' ? 'AI 채점' : '직접 채점'} · {a.feedback}</p>}</div></details>; })}</div> : <p className="text-sm text-slate-500">이 날짜에는 복습 기록이 없습니다.</p>}
    </section>
  </div>;
}

export function ReviewReminder({ today, sessions, ready, open }: { today: string; sessions: ReviewSession[]; ready: boolean; open: () => void }) {
  const complete = isComplete(sessions.find(s => s.date === today));
  return <button type="button" onClick={open} className={`w-full mb-5 flex items-center justify-between gap-3 rounded-xl border p-3 text-left ${complete ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-indigo-50 border-indigo-200 text-indigo-900'}`}><span className="text-sm font-semibold">{complete ? '🌱 오늘의 복습 완료 · 내 숲 보러 가기' : '🌱 매일 필수! 오늘의 스마트 복습'}<span className="block text-xs font-normal mt-1">{complete ? '내일도 이어서 키워 주세요.' : ready ? '틀려도 괜찮아요. 오늘 끝내야 연속 기록이 이어져요.' : '내 문장으로 복습하고 성장 기록을 쌓아 보세요.'}</span></span><ChevronRight className="w-5 h-5 shrink-0" /></button>;
}

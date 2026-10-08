import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { reviewExpression } from '../lib/reviewExpression';
import type { ExpressionReview } from '../lib/expressionReviewData';
export function ExpressionAIReview({ english, korean, onApply, label, reviewer = reviewExpression }: {
  english: string; korean: string; onApply: (english: string, korean: string) => void; label?: string; reviewer?: typeof reviewExpression;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExpressionReview | null>(null);
  const [error, setError] = useState('');
  const generation = useRef(0), lock = useRef(false);
  useEffect(() => {
    generation.current++; lock.current = false; setBusy(false); setResult(null); setError('');
    return () => { generation.current++; };
  }, [english, korean]);
  const check = async () => {
    if (lock.current || (!english.trim() && !korean.trim())) return;
    lock.current = true; const token = generation.current;
    setBusy(true); setResult(null); setError('');
    try {
      const next = await reviewer(english.trim(), korean.trim());
      if (token === generation.current) setResult(next);
    } catch (e) {
      if (token === generation.current) setError(e instanceof Error ? e.message : 'AI 검토를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      if (token === generation.current) { lock.current = false; setBusy(false); }
    }
  };
  return <div className="space-y-2">
    <div className="flex min-h-8 items-center justify-between gap-2">{label ? <span className="text-xs font-bold text-slate-700">{label}</span> : <span />}<button type="button" onClick={check} disabled={busy || (!english.trim() && !korean.trim())} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-40"><Sparkles className="h-3.5 w-3.5" />{busy ? '검토 중…' : 'AI 검토'}</button></div>
    <div aria-live="polite">
      {busy && <p role="status" className="text-xs text-indigo-600">영작·번역과 표현을 확인하고 있어요…</p>}
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{error} 입력 내용은 그대로 유지됩니다.</p>}
      {result && <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm break-words">
        <p className="font-bold text-indigo-900">AI 검토 결과</p><p className="text-xs leading-relaxed text-slate-600">{result.feedback}</p>
        <p className="font-semibold text-slate-900">{result.english}</p><p className="text-indigo-900">{result.korean}</p>
        {(result.english !== english.trim() || result.korean !== korean.trim()) && <button type="button" onClick={() => onApply(result.english, result.korean)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">제안 적용</button>}
        <p className="text-[11px] text-slate-500">제안 적용 후 등록 또는 저장해 주세요.</p>
      </div>}
    </div>
  </div>;
}

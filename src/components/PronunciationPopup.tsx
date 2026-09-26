import React, { useEffect, useRef, useState } from 'react';
import { Volume2, X, Square } from 'lucide-react';

export function PronunciationPopup() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [text, setText] = useState('');
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const stop = () => {
    if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; utterance.current = null; window.speechSynthesis?.cancel(); }
    setPlaying(false);
  };
  const close = () => { stop(); setText(''); setError(''); setRate(1); dialog.current?.close(); trigger.current?.focus(); };
  useEffect(() => () => { if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis?.cancel(); } }, []);
  const play = (speed = rate) => {
    stop(); setError(''); setRate(speed);
    if (!text.trim()) return;
    if (!('speechSynthesis' in window)) { setError('이 브라우저는 음성 재생을 지원하지 않습니다.'); return; }
    try {
      const speech = new SpeechSynthesisUtterance(text.trim());
      speech.lang = 'en-US'; speech.rate = speed;
      const voices = window.speechSynthesis.getVoices();
      speech.voice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en')) || null;
      speech.onend = () => { setPlaying(false); utterance.current = null; };
      speech.onerror = event => { setPlaying(false); utterance.current = null; if (!['interrupted', 'canceled'].includes(event.error)) setError('음성을 재생하지 못했습니다. 기기의 영어 음성 설정을 확인해 주세요.'); };
      utterance.current = speech; setPlaying(true); window.speechSynthesis.speak(speech);
    } catch { setPlaying(false); setError('음성을 재생하지 못했습니다. 다시 시도해 주세요.'); }
  };
  return <>
    <button ref={trigger} type="button" onClick={() => { dialog.current?.showModal(); input.current?.focus(); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-2 text-sm font-semibold"><Volume2 className="w-4 h-4" />발음 확인</button>
    <dialog ref={dialog} aria-labelledby="pronunciation-title" onCancel={e => { e.preventDefault(); close(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl p-5 bg-white text-slate-800 border border-slate-200 shadow-xl backdrop:bg-slate-900/40">
      <div className="flex items-center justify-between mb-3"><h2 id="pronunciation-title" className="font-bold text-lg">영어 발음 확인</h2><button type="button" onClick={close} aria-label="발음 확인 닫기" className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
      <label htmlFor="pronunciation-text" className="text-sm font-semibold">듣고 싶은 영어</label>
      <textarea ref={input} id="pronunciation-text" rows={5} maxLength={1000} value={text} onChange={e => { stop(); setText(e.target.value); setError(''); }} placeholder="영어 단어나 문장을 입력하세요." className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-base focus:outline-indigo-500" />
      <div className="flex flex-wrap gap-2 my-3" aria-label="재생 속도">{[0.75, 1, 1.25].map(speed => <button type="button" key={speed} aria-pressed={rate === speed} onClick={() => { if (playing) play(speed); else setRate(speed); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${rate === speed ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>{speed}배속</button>)}</div>
      <div className="flex gap-2"><button type="button" disabled={!text.trim()} onClick={() => play()} className="flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-3 font-semibold disabled:opacity-40"><Volume2 className="w-4 h-4" />{playing ? '처음부터 듣기' : '발음 듣기'}</button><button type="button" disabled={!playing} onClick={stop} className="flex items-center gap-1 px-3 rounded-xl bg-slate-100 disabled:opacity-40"><Square className="w-4 h-4" />정지</button></div>
      <p className="mt-3 text-xs text-slate-500">입력 내용은 저장하지 않으며, 창을 닫으면 지워집니다.</p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </dialog>
  </>;
}

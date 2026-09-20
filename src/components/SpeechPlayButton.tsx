import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { playEnglishSpeech } from '../utils/speech';

interface SpeechPlayButtonProps {
  text: string;
  voiceType?: 'US' | 'UK';
  title?: string;
  className?: string;
  theme?: 'indigo' | 'emerald';
}

export const SpeechPlayButton: React.FC<SpeechPlayButtonProps> = ({
  text,
  voiceType = 'US',
  title = '원어민 발음 듣기',
  className = '',
  theme = 'indigo',
}) => {
  const [activeSpeed, setActiveSpeed] = useState<number | null>(null);

  const handlePlay = (speed: number) => {
    setActiveSpeed(speed);
    playEnglishSpeech(text, voiceType === 'UK' ? 'UK' : 'US', speed);
    setTimeout(() => {
      setActiveSpeed(null);
    }, 1800);
  };

  const activeColor = theme === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white';
  const hoverText = theme === 'emerald' ? 'hover:text-emerald-700' : 'hover:text-indigo-700';

  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-white/90 p-0.5 rounded-lg border border-slate-200/80 text-xs shrink-0 shadow-2xs ${className}`}
    >
      {/* Left: x0.75 speed button */}
      <button
        type="button"
        onClick={() => handlePlay(0.75)}
        title="0.75배속으로 듣기 (느리게)"
        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
          activeSpeed === 0.75
            ? `${activeColor} shadow-2xs`
            : `text-slate-500 ${hoverText} hover:bg-slate-100`
        }`}
      >
        x0.75
      </button>

      {/* Center: Play (1.0x normal) */}
      <button
        type="button"
        onClick={() => handlePlay(1.0)}
        title={`${title} (1.0x)`}
        className={`p-1 rounded transition-all cursor-pointer select-none active:scale-95 ${
          activeSpeed === 1.0
            ? `${activeColor} shadow-2xs`
            : `text-slate-600 ${hoverText} hover:bg-slate-100`
        }`}
      >
        <Volume2 className="w-3.5 h-3.5" />
      </button>

      {/* Right: x1.25 speed button */}
      <button
        type="button"
        onClick={() => handlePlay(1.25)}
        title="1.25배속으로 듣기 (빠르게)"
        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
          activeSpeed === 1.25
            ? `${activeColor} shadow-2xs`
            : `text-slate-500 ${hoverText} hover:bg-slate-100`
        }`}
      >
        x1.25
      </button>
    </div>
  );
};

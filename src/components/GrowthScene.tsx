import React, { useEffect, useId, useRef, useState } from 'react';
import { CloudRain, Pause, Play, Sun, Wind } from 'lucide-react';
import { forestLife } from '../lib/smartReview';
import './GrowthScene.css';

type Weather = 'sun' | 'wind' | 'rain';
const weatherNames = { sun: '햇살', wind: '산들바람', rain: '촉촉한 비' };

function Plant({ kind, seed }: { kind: 'sprout' | 'tree' | 'palm'; seed: string }) {
  return <svg viewBox="0 0 180 230" preserveAspectRatio="xMidYMax meet" className={`garden-plant garden-plant--${kind}`} aria-hidden="true">
    <defs>
      <linearGradient id={`${seed}-leaf`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c7ee80" /><stop offset=".48" stopColor="#70bb58" /><stop offset="1" stopColor="#247454" /></linearGradient>
      <linearGradient id={`${seed}-trunk`}><stop stopColor="#99734d" /><stop offset=".5" stopColor="#c3a47b" /><stop offset="1" stopColor="#75573c" /></linearGradient>
      <radialGradient id={`${seed}-soil`} cx=".4" cy=".25"><stop stopColor="#bea98a" /><stop offset="1" stopColor="#715d45" /></radialGradient>
    </defs>
    <ellipse cx="90" cy="213" rx="49" ry="9" fill="#244d38" opacity=".16" />
    {kind === 'sprout' ? <g className="garden-sway">
      <path d="M91 207 Q86 159 94 111" fill="none" stroke="#699547" strokeWidth="8" strokeLinecap="round" />
      <path d="M93 143 C54 154 32 124 31 107 C72 102 91 116 93 143Z" fill={`url(#${seed}-leaf)`} />
      <path d="M91 164 C132 172 151 142 150 127 C110 123 91 141 91 164Z" fill={`url(#${seed}-leaf)`} />
      <path d="M39 113 Q69 131 89 139 M144 133 Q115 155 94 161" fill="none" stroke="#d3f1a4" strokeWidth="1.5" opacity=".65" />
      <path d="M53 210 C57 188 117 184 129 210Z" fill={`url(#${seed}-soil)`} />
      <ellipse cx="80" cy="202" rx="4" ry="2" fill="#ddcdb6" opacity=".7" />
    </g> : kind === 'palm' ? <g className="garden-sway">
      <path d="M81 214 Q111 153 96 88" fill="none" stroke={`url(#${seed}-trunk)`} strokeWidth="13" />
      {[0, 60, 120, 180, 240, 300].map(a => <path key={a} d="M94 91 Q40 43 20 103 Q45 71 94 91Z" transform={`rotate(${a} 94 91)`} fill={`url(#${seed}-leaf)`} />)}
    </g> : <g className="garden-sway">
      <path d="M82 216 L85 108 L96 108 L100 216Z" fill={`url(#${seed}-trunk)`} />
      <path d="M90 175 L66 146 M94 160 L117 129" fill="none" stroke="#967654" strokeWidth="7" strokeLinecap="round" />
      <path d="M89 24 C61 23 47 44 49 59 C18 66 12 94 30 111 C9 145 40 170 68 162 C90 185 115 164 125 153 C156 156 173 129 151 107 C166 77 144 58 124 58 C124 32 106 24 89 24Z" fill={`url(#${seed}-leaf)`} />
      <path d="M56 57 Q82 36 103 45 M33 101 Q50 77 65 80 M95 134 Q121 119 138 126" fill="none" stroke="#d1eb9a" strokeWidth="6" strokeLinecap="round" opacity=".24" />
    </g>}
  </svg>;
}

function Butterfly({ variant }: { variant: number }) {
  return <span className={`garden-butterfly garden-butterfly--${variant}`} data-testid="garden-butterfly"><svg viewBox="0 0 50 44" aria-hidden="true"><g className="garden-wings"><path d="M24 23 C-2 -4 -5 24 17 26 C1 43 21 46 24 27Z" fill={variant % 2 ? '#f0b75c' : '#82a6ed'} /><path d="M26 23 C52 -4 55 24 33 26 C49 43 29 46 26 27Z" fill={variant % 2 ? '#f6ce8e' : '#b6cafa'} /><path d="M9 14 L20 22 M41 14 L30 22" stroke="#fff2d9" strokeWidth="2" opacity=".8" /></g><path d="M25 18 V31 M25 19 L21 13 M25 19 L29 13" stroke="#414e4b" strokeWidth="2" strokeLinecap="round" /></svg></span>;
}

export function GrowthScene({ streak, stageName }: { streak: number; stageName: string }) {
  const { animals, nextAnimal } = forestLife(streak);
  const root = useRef<HTMLDivElement>(null);
  const seed = useId().replace(/:/g, '');
  const [weather, setWeather] = useState<Weather>('sun');
  const [automatic, setAutomatic] = useState(true);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches); change(); media.addEventListener('change', change);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    const visibility = () => { if (document.hidden) setVisible(false); else if (root.current) { const rect = root.current.getBoundingClientRect(); setVisible(rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight); } };
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', change); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const still = paused || reduced || !visible;
  useEffect(() => {
    if (!automatic || still) return;
    const timer = window.setInterval(() => setWeather(w => w === 'sun' ? 'wind' : w === 'wind' ? 'rain' : 'sun'), 18000);
    return () => clearInterval(timer);
  }, [automatic, still]);
  const trees = streak < 21 ? 1 : Math.min(7, 3 + Math.floor(streak / 45));
  return <div className="garden-wrapper" ref={root}>
    <div className={`living-garden garden-weather--${weather} ${still ? 'garden-still' : ''}`} data-testid="living-garden" data-weather={weather} data-paused={still}>
      <div className="garden-landscape" aria-hidden="true" />
      <div className="garden-light" aria-hidden="true" />
      <div className="garden-cloud garden-cloud--one" aria-hidden="true" /><div className="garden-cloud garden-cloud--two" aria-hidden="true" />
      <div className="garden-scene-description" role="img" aria-label={`${stageName} 성장 풍경. ${animals.length ? animals.map(a => a.name).join(', ') + '와 함께 살고 있어요.' : '첫 동물 친구를 기다리는 새싹입니다.'}`}>
        <div className="garden-trees" aria-hidden="true">{Array.from({ length: trees }, (_, i) => <div className="garden-tree" key={i} style={{ '--tree-index': i, '--tree-position': (trees === 1 ? 50 : i / (trees - 1) * 100) + '%', '--tree-scale': i % 2 ? .86 : 1 } as React.CSSProperties}><Plant kind={streak < 7 ? 'sprout' : streak >= 120 && i % 2 === 0 ? 'palm' : 'tree'} seed={`${seed}-${i}`} /></div>)}</div>
        {streak >= 3 && <><Butterfly variant={1} />{streak >= 21 && <Butterfly variant={2} />}</>}
        <div className="garden-animals" aria-hidden="true">{animals.filter(a => a.name !== '나비').slice(-6).map((a, i) => <span key={a.name} title={`${a.days}일 · ${a.name}`} className={`garden-animal ${['꿀벌', '새', '부엉이', '앵무새', '독수리'].includes(a.name) ? 'garden-animal--flying' : ''}`} style={{ '--animal-index': i } as React.CSSProperties}>{a.emoji}</span>)}</div>
        {streak >= 240 && <span className="garden-planet" aria-hidden="true">{streak >= 365 ? '🌍' : '🌏'}</span>}
      </div>
      <div className="garden-weather-effects" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => <i className="garden-raindrop" key={`rain-${i}`} style={{ '--particle': i } as React.CSSProperties} />)}
        {Array.from({ length: 6 }, (_, i) => <i className="garden-pollen" key={`pollen-${i}`} style={{ '--particle': i } as React.CSSProperties} />)}
        {[0, 1, 2].map(i => <i className="garden-wind" key={i} style={{ '--particle': i } as React.CSSProperties} />)}
      </div>
      <div className="garden-topline"><div><span className="garden-eyebrow">MY LITTLE FOREST</span><h2>하루 한 번, 자라는 나의 숲</h2></div><button type="button" className="garden-pause" onClick={() => setPaused(p => !p)} disabled={reduced} aria-label={reduced ? '동작 줄이기 설정 적용됨' : paused ? '정원 움직임 재생' : '정원 움직임 멈추기'}>{paused || reduced ? <Play size={14} /> : <Pause size={14} />}</button></div>
      <div className="garden-bottomline"><p>{nextAnimal ? streak < 3 ? '작은 시작에, 곧 나비가 찾아와요.' : '매일의 한 문장이 숲에 생명을 더해요.' : '365일의 꾸준함이 만든 생명의 지구.'}</p><span className="garden-weather-label">{weatherNames[weather]}</span></div>
    </div>
    <div className="garden-toolbar"><span className="garden-companions">함께 사는 동물 친구 <strong>{animals.length}마리</strong></span><div className="garden-weather-controls" role="group" aria-label="작은 정원의 날씨">
      <button type="button" aria-pressed={automatic} onClick={() => setAutomatic(true)}>자동</button>
      {(['sun', 'wind', 'rain'] as const).map(w => { const Icon = w === 'sun' ? Sun : w === 'wind' ? Wind : CloudRain; return <button key={w} type="button" aria-label={`정원 날씨: ${weatherNames[w]}`} aria-pressed={!automatic && weather === w} onClick={() => { setAutomatic(false); setWeather(w); }}><Icon size={14} /></button>; })}
    </div></div>
    <p className="garden-next">{nextAnimal ? <>{nextAnimal.emoji} <strong>{nextAnimal.name}</strong>까지 {nextAnimal.days - streak}일 <span>· 조금씩, 더 풍성하게</span></> : '🐋 1년 동안 생명 가득한 지구를 만들었어요!'}</p>
  </div>;
}

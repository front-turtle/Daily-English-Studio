import React, { useId } from 'react';

// Each forest companion is an SVG, never an OS-dependent emoji.
// Shared lighting, sizing and motion keep future growth milestones visually cohesive.
export const FLYING_ANIMALS = new Set(['나비', '꿀벌', '새', '부엉이', '앵무새', '독수리']);
type AnimalName = '나비' | '꿀벌' | '새' | '토끼' | '다람쥐' | '여우' | '사슴' | '부엉이' | '앵무새' | '원숭이' | '재규어' | '코끼리' | '호랑이' | '독수리' | '고래';
const palettes: Record<Exclude<AnimalName, '나비' | '꿀벌'>, [string, string, string]> = {
  '새':['#82bfd0','#447a9e','#f8dfa8'], '토끼':['#e2c9ab','#bca18e','#fff1dc'],
  '다람쥐':['#dca36d','#ae724b','#ffe5b8'], '여우':['#eb9956','#b95e40','#fff1d5'],
  '사슴':['#ca9b75','#916448','#f4d9b8'], '부엉이':['#bda17e','#79634e','#f5e5c5'],
  '앵무새':['#80c59b','#377d6e','#e0e7a1'], '원숭이':['#b79070','#765c4c','#f0cfad'],
  '재규어':['#e8bf75','#ac8052','#ffedbd'], '코끼리':['#aebbc2','#788f9d','#e2e8dd'],
  '호랑이':['#e8a45f','#b76b45','#fff1c9'], '독수리':['#997a65','#5c504a','#f1e4ca'],
  '고래':['#88b5c8','#557d9a','#d0e5e5']
};
export function ForestAnimal({name}: {name: string}) {
  const id = useId().replace(/:/g, '');
  if (name === '나비') return <svg className="forest-animal-art forest-animal-butterfly" viewBox="0 0 72 64" aria-hidden="true"><g className="forest-art-wings"><path d="M35 33 C13 -5 -3 9 11 31 C-4 52 24 65 35 38Z" fill="#f0b75c" stroke="#ffe2ad" strokeWidth="2"/><path d="M37 33 C59 -5 75 9 61 31 C76 52 48 65 37 38Z" fill="#88afe0" stroke="#d8e8ff" strokeWidth="2"/><circle cx="19" cy="26" r="4" fill="#fff5ce" opacity=".7"/><circle cx="53" cy="26" r="4" fill="#fff5ce" opacity=".7"/></g><path d="M36 26V45 M36 26L31 18 M36 26L41 18" fill="none" stroke="#504c40" strokeWidth="2.6" strokeLinecap="round"/></svg>;
  if (name === '꿀벌') return <svg className="forest-animal-art forest-animal-bee" viewBox="0 0 72 64" aria-hidden="true"><g className="forest-art-wings"><ellipse cx="29" cy="24" rx="12" ry="17" fill="#d8f6f4" opacity=".8" transform="rotate(-26 29 24)"/><ellipse cx="45" cy="22" rx="12" ry="17" fill="#e1f9f7" opacity=".8" transform="rotate(30 45 22)"/></g><ellipse cx="35" cy="38" rx="24" ry="16" fill="#f3c96b"/><path d="M24 24Q18 38 24 52 M39 23Q33 38 39 53" fill="none" stroke="#785d48" strokeWidth="7"/><circle cx="51" cy="34" r="3" fill="#483a38"/><circle cx="52" cy="33" r="1" fill="white"/><path d="M12 38L5 41L13 44" fill="#dfb27c"/></svg>;
  const key = (name in palettes ? name : '새') as keyof typeof palettes;
  const [primary, shade, light] = palettes[key];
  const bird = ['새','부엉이','앵무새','독수리'].includes(name);
  const longEars = name === '토끼';
  const horned = name === '사슴';
  const trunk = name === '코끼리';
  const striped = name === '호랑이';
  const spotted = name === '재규어';
  const whale = name === '고래';
  const tail = ['다람쥐','여우','원숭이'].includes(name);
  return <svg className={`forest-animal-art ${bird ? 'forest-animal-bird' : 'forest-animal-ground'}`} viewBox="0 0 84 76" aria-hidden="true">
    <defs><linearGradient id={id+'fur'} x1="0" y1="0" x2="1" y2="1"><stop stopColor={light}/><stop offset=".45" stopColor={primary}/><stop offset="1" stopColor={shade}/></linearGradient></defs>
    {whale ? <><path d="M9 45Q16 23 46 28Q66 22 76 40Q65 59 37 59Q18 58 9 45Z" fill={`url(#${id}fur)`}/><path d="M13 45L2 34L5 54Z M45 51L34 68L55 56Z" fill={shade}/><path d="M39 28Q34 17 41 14 M46 29Q51 15 57 20" stroke="#d8f5f5" strokeWidth="3" fill="none" strokeLinecap="round"/><circle cx="65" cy="40" r="2.4" fill="#303946"/></> :
    <>
      {tail && <path className="forest-art-tail" d={name === '다람쥐' ? "M26 50Q-6 44 8 16Q19 3 26 16Q12 22 18 42Z" : name === '원숭이' ? "M25 56Q2 65 7 41Q11 30 19 38" : "M23 48Q-3 40 9 22Q23 29 32 42Z"} fill={primary} stroke={shade} strokeWidth="2"/>}
      {bird && <path d="M18 45L6 60L32 52Z" fill={shade}/>}
      <ellipse cx="39" cy={bird?47:48} rx={bird?25:28} ry={bird?18:20} fill={`url(#${id}fur)`}/>
      {bird && <path className="forest-art-wing forest-art-wing--back" d="M34 43Q5 19 24 5Q47 19 53 43Z" fill={shade} stroke={light} strokeWidth="1.5"/>}
      {!bird && <><path d="M26 56L23 71 M52 56L55 71" stroke={shade} strokeWidth="8" strokeLinecap="round"/><path d="M26 70L18 70 M55 70L61 70" stroke={shade} strokeWidth="3" strokeLinecap="round"/></>}
      {longEars && <><ellipse cx="51" cy="15" rx="7" ry="20" transform="rotate(-14 51 15)" fill={primary} stroke={shade} strokeWidth="2"/><ellipse cx="69" cy="15" rx="6" ry="20" transform="rotate(13 69 15)" fill={primary} stroke={shade} strokeWidth="2"/></>}
      {horned && <path d="M50 27L42 7M42 7L32 3M43 14L32 13 M67 25L70 6L80 3 M70 12L81 13" fill="none" stroke={shade} strokeWidth="3.5" strokeLinecap="round"/>}
      {name==='부엉이' && <path d="M49 27L45 14L56 23 M68 25L78 14L75 33" fill={shade}/>}
      {name==='여우' && <path d="M48 31L42 9L58 22M63 23L79 8L78 36" fill={primary} stroke={shade} strokeWidth="2"/>}
      {name==='다람쥐' && <path d="M54 27L51 16L62 23M68 23L78 15L77 34" fill={primary}/>}
      <ellipse cx="61" cy="37" rx={bird?14:19} ry={bird?15:18} fill={`url(#${id}fur)`}/>
      <ellipse cx="66" cy="46" rx={bird?10:12} ry="7" fill={light} opacity=".9"/>
      {trunk ? <path d="M72 44Q83 52 76 64Q69 73 63 64" fill="none" stroke={primary} strokeWidth="9" strokeLinecap="round"/> : bird ? <path d="M73 39L83 43L72 46Z" fill="#e5ae6a"/> : <ellipse cx="76" cy="46" rx="3.4" ry="2.6" fill={shade}/>}
      <circle cx="67" cy="33" r="3" fill="#302f36"/><circle cx="68" cy="32" r="1" fill="white"/>
      {bird && <path className="forest-art-wing forest-art-wing--front" d="M33 42Q17 20 32 9Q52 21 54 46Q42 56 33 42Z" fill={primary} stroke={light} strokeWidth="1.8"/>}
      {striped && <g stroke={shade} strokeWidth="3" strokeLinecap="round"><path d="M26 30L36 42 M42 30L48 42 M55 25L61 31 M52 42L59 46"/></g>}
      {spotted && <g fill={shade} opacity=".85"><circle cx="27" cy="41" r="3"/><circle cx="39" cy="55" r="3"/><circle cx="45" cy="37" r="2.5"/><circle cx="56" cy="24" r="2.5"/></g>}
      {name==='사슴' && <g fill="#f8e2bc" opacity=".75"><circle cx="29" cy="40" r="2.5"/><circle cx="43" cy="47" r="2"/></g>}
      {name==='앵무새' && <path d="M19 48L5 69L32 54Z" fill="#d7b968"/>}
      {name==='독수리' && <path d="M64 23Q72 17 79 28L69 32Z" fill={light}/>}
    </>}
  </svg>;
}

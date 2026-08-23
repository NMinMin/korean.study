import React from 'react';

export function Avatar() {
  return (
    <div className="avatar-ring">
      <svg viewBox="0 0 200 200" width="150" height="150" aria-label="Ảnh đại diện">
        <defs>
          <clipPath id="circ"><circle cx="100" cy="100" r="96" /></clipPath>
        </defs>
        <g clipPath="url(#circ)">
          <rect width="200" height="200" fill="#E9E4FA" />
          <circle cx="40" cy="40" r="3" fill="#fff" opacity=".8" />
          <circle cx="165" cy="55" r="2.5" fill="#fff" opacity=".8" />
          <path d="M158 30 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5-6 -6-2.5 6-2.5z" fill="#C9BCF2" />
          <path d="M42 105 C36 60 62 30 100 30 C138 30 164 60 158 105 L160 175 L40 175 Z" fill="#6B4A3A" />
          <ellipse cx="100" cy="95" rx="42" ry="40" fill="#FBE8DC" />
          <path d="M58 90 C58 52 76 40 100 40 C124 40 142 52 142 90 C130 72 122 66 100 66 C78 66 70 72 58 90 Z" fill="#7A5544" />
          <ellipse cx="84" cy="96" rx="7.5" ry="9" fill="#3B2A22" />
          <ellipse cx="116" cy="96" rx="7.5" ry="9" fill="#3B2A22" />
          <circle cx="86.5" cy="93" r="2.6" fill="#fff" />
          <circle cx="118.5" cy="93" r="2.6" fill="#fff" />
          <ellipse cx="72" cy="108" rx="7" ry="4" fill="#F6C6C0" />
          <ellipse cx="128" cy="108" rx="7" ry="4" fill="#F6C6C0" />
          <path d="M92 114 Q100 122 108 114" stroke="#B5645B" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M48 175 C50 148 70 138 100 138 C130 138 150 148 152 175 Z" fill="#8B7BE8" />
          <path d="M84 140 Q100 152 116 140 L116 150 Q100 160 84 150 Z" fill="#7A69DB" />
          <g transform="translate(128 128) scale(.9)">
            <ellipse cx="22" cy="38" rx="20" ry="17" fill="#fff" />
            <ellipse cx="14" cy="12" rx="6" ry="16" fill="#fff" />
            <ellipse cx="30" cy="12" rx="6" ry="16" fill="#fff" />
            <ellipse cx="14" cy="14" rx="3" ry="10" fill="#F6C6D0" />
            <ellipse cx="30" cy="14" rx="3" ry="10" fill="#F6C6D0" />
            <circle cx="16" cy="36" r="2.4" fill="#3B2A22" />
            <circle cx="28" cy="36" r="2.4" fill="#3B2A22" />
            <path d="M19 42 Q22 45 25 42" stroke="#D98A96" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
          <g transform="translate(46 118) rotate(-15)">
            <ellipse cx="10" cy="16" rx="11" ry="10" fill="#FBE8DC" />
            <rect x="2" y="-4" width="6" height="16" rx="3" fill="#FBE8DC" />
            <rect x="12" y="-6" width="6" height="18" rx="3" fill="#FBE8DC" />
          </g>
        </g>
        <circle cx="100" cy="100" r="96" fill="none" stroke="#D8CFF5" strokeWidth="5" />
      </svg>
    </div>
  );
}

export function BunnyMascot() {
  return (
    <svg viewBox="0 0 160 150" width="128" height="120" aria-hidden="true">
      <path d="M18 26 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z" fill="#C9BCF2" />
      <path d="M140 60 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6-4 -4-1.6 4-1.6z" fill="#C9BCF2" />
      <ellipse cx="62" cy="34" rx="10" ry="26" fill="#fff" stroke="#EFE9FB" />
      <ellipse cx="96" cy="34" rx="10" ry="26" fill="#fff" stroke="#EFE9FB" />
      <ellipse cx="62" cy="38" rx="5" ry="17" fill="#F6C6D0" />
      <ellipse cx="96" cy="38" rx="5" ry="17" fill="#F6C6D0" />
      <ellipse cx="79" cy="78" rx="34" ry="30" fill="#fff" />
      <circle cx="67" cy="76" r="3.4" fill="#3B2A22" />
      <path d="M86 74 q5 5 10 0" stroke="#3B2A22" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="86" rx="5.5" ry="3.4" fill="#F6C6C0" />
      <ellipse cx="98" cy="86" rx="5.5" ry="3.4" fill="#F6C6C0" />
      <path d="M74 88 Q79 92 84 88" stroke="#D98A96" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M44 142 C44 116 58 104 79 104 C100 104 114 116 114 142 Z" fill="#8B7BE8" />
      <path d="M64 106 Q79 116 94 106 L94 114 Q79 124 64 114 Z" fill="#7A69DB" />
      <rect x="60" y="120" width="38" height="8" rx="4" fill="#fff" />
      <circle cx="58" cy="126" r="7" fill="#fff" />
      <circle cx="100" cy="126" r="7" fill="#fff" />
    </svg>
  );
}

export function SwBunnyEmpty() {
  return (
    <svg viewBox="0 0 120 120" width="88" aria-hidden="true">
      <path d="M18 20 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4-5.6 -5.6-2.4 5.6-2.4z" fill="#EFB7C8" />
      <ellipse cx="46" cy="34" rx="9" ry="24" fill="#fff" stroke="#EFE9FB" />
      <ellipse cx="70" cy="34" rx="9" ry="24" fill="#fff" stroke="#EFE9FB" />
      <ellipse cx="46" cy="38" rx="4.5" ry="15" fill="#F6C6D0" />
      <ellipse cx="70" cy="38" rx="4.5" ry="15" fill="#F6C6D0" />
      <ellipse cx="58" cy="70" rx="30" ry="27" fill="#fff" />
      <circle cx="49" cy="68" r="3" fill="#3B2A22" />
      <path d="M64 66 q4.5 4.5 9 0" stroke="#3B2A22" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <ellipse cx="42" cy="78" rx="5" ry="3" fill="#F6C6C0" />
      <ellipse cx="76" cy="78" rx="5" ry="3" fill="#F6C6C0" />
      <path d="M52 80 Q58 84 64 80" stroke="#D98A96" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M30 96 q28-14 56 0 v18 q-28 10-56 0z" fill="#8B7BE8" />
    </svg>
  );
}

export function FcBunny() {
  return (
    <svg viewBox="0 0 90 80" width="64" aria-hidden="true">
      <path d="M10 14 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6-4 -4-1.6 4-1.6z" fill="#EFB7C8" />
      <ellipse cx="38" cy="20" rx="5.5" ry="14" fill="#FDEEF1" stroke="#F3D3DC" />
      <ellipse cx="56" cy="20" rx="5.5" ry="14" fill="#FDEEF1" stroke="#F3D3DC" />
      <ellipse cx="38" cy="22" rx="2.6" ry="9" fill="#F6C6D0" />
      <ellipse cx="56" cy="22" rx="2.6" ry="9" fill="#F6C6D0" />
      <ellipse cx="47" cy="48" rx="24" ry="21" fill="#FDEEF1" />
      <circle cx="39" cy="46" r="2.6" fill="#3B2A22" />
      <circle cx="55" cy="46" r="2.6" fill="#3B2A22" />
      <path d="M43 54 Q47 57 51 54" stroke="#D98A96" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="33" cy="52" r="3.6" fill="#F9D0D6" />
      <circle cx="61" cy="52" r="3.6" fill="#F9D0D6" />
      <path d="M20 46 Q10 40 12 30" stroke="#F6C6D0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M74 46 Q84 38 80 28" stroke="#F6C6D0" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MiniBear() {
  return (
    <svg viewBox="0 0 90 84" width="72" aria-hidden="true">
      <circle cx="60" cy="16" r="12" fill="#FDF3D8" />
      <text x="60" y="22" textAnchor="middle" fontSize="16" fontWeight="800" fill="#E8912E">!</text>
      <circle cx="28" cy="30" r="8" fill="#C68B5B" />
      <circle cx="62" cy="30" r="8" fill="#C68B5B" />
      <circle cx="28" cy="30" r="4" fill="#E8B98B" />
      <circle cx="62" cy="30" r="4" fill="#E8B98B" />
      <ellipse cx="45" cy="50" rx="26" ry="24" fill="#C68B5B" />
      <ellipse cx="45" cy="58" rx="13" ry="10" fill="#F2D9BC" />
      <circle cx="37" cy="46" r="2.8" fill="#3B2A22" />
      <circle cx="53" cy="46" r="2.8" fill="#3B2A22" />
      <ellipse cx="45" cy="55" rx="3.4" ry="2.6" fill="#5A4132" />
      <path d="M45 58 q0 4 4 4" stroke="#5A4132" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M68 60 q10-6 8-16" stroke="#C68B5B" strokeWidth="8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function GirlAvatar() {
  return (
    <svg viewBox="0 0 60 60" width="38" height="38" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="30" cy="30" r="28" fill="#F0EEFC" />
      <path d="M14 34 C13 20 20 12 30 12 C40 12 47 20 46 34 L47 48 L13 48 Z" fill="#6B4A3A" />
      <ellipse cx="30" cy="30" rx="14" ry="13" fill="#FBE8DC" />
      <path d="M17 28 C17 16 23 13 30 13 C37 13 43 16 43 28 C38 21 34 19 30 19 C26 19 22 21 17 28Z" fill="#7A5544" />
      <circle cx="25" cy="31" r="2.2" fill="#3B2A22" />
      <circle cx="35" cy="31" r="2.2" fill="#3B2A22" />
      <path d="M27 37 Q30 39.5 33 37" stroke="#B5645B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function BoyAvatar() {
  return (
    <svg viewBox="0 0 60 60" width="38" height="38" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="30" cy="30" r="28" fill="#FDF0F2" />
      <path d="M15 40 C14 26 20 14 30 14 C40 14 46 26 45 40 L47 50 L13 50 Z" fill="#2B2320" />
      <ellipse cx="30" cy="30" rx="13.5" ry="12.5" fill="#F2D9BC" />
      <path d="M17 25 C19 16 24 14 30 14 C36 14 41 16 43 25 C41 21 36 20 30 20 C24 20 19 21 17 25Z" fill="#2B2320" />
      <circle cx="25" cy="31" r="2.1" fill="#3B2A22" />
      <circle cx="35" cy="31" r="2.1" fill="#3B2A22" />
      <path d="M27 37 Q30 39 33 37" stroke="#A8735A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PlantSeedling({ variant }) {
  if (variant === 'sunflower') return <g className="plant-seedling seedling-sunflower"><ellipse cx="45" cy="69" rx="6" ry="3" fill="#73512F" /><path d="M45 69V59" stroke="#5B9B4F" strokeWidth="3" strokeLinecap="round" /><ellipse cx="39" cy="58" rx="7" ry="3.5" fill="#74B765" transform="rotate(25 39 58)" /><ellipse cx="51" cy="58" rx="7" ry="3.5" fill="#65A958" transform="rotate(-25 51 58)" /></g>;
  if (variant === 'cherry') return <g className="plant-seedling seedling-cherry"><ellipse cx="45" cy="69" rx="5" ry="3" fill="#7A5542" /><path d="M45 69Q41 62 46 56" stroke="#77503E" strokeWidth="3" fill="none" strokeLinecap="round" /><circle cx="42" cy="57" r="5" fill="#F3B7CB" /><circle cx="48" cy="55" r="4" fill="#EFA5BF" /></g>;
  if (variant === 'lavender') return <g className="plant-seedling seedling-lavender"><ellipse cx="45" cy="70" rx="7" ry="3" fill="#77614A" /><path d="M42 70Q40 62 39 56M45 70V53M48 70Q50 62 51 57" stroke="#6E9567" strokeWidth="2" fill="none" /><ellipse cx="39" cy="56" rx="3" ry="2" fill="#9D83D2" /><ellipse cx="45" cy="53" rx="3" ry="2" fill="#8066BC" /><ellipse cx="51" cy="57" rx="3" ry="2" fill="#B09BDD" /></g>;
  if (variant === 'bonsai') return <g className="plant-seedling seedling-bonsai"><ellipse cx="45" cy="70" rx="7" ry="3" fill="#76513F" /><path d="M45 70Q36 64 44 55Q50 51 48 47" stroke="#74513B" strokeWidth="4" fill="none" strokeLinecap="round" /><ellipse cx="40" cy="54" rx="8" ry="4" fill="#588758" /><ellipse cx="50" cy="47" rx="7" ry="3.5" fill="#427249" /></g>;
  if (variant === 'succulent') return <g className="plant-seedling seedling-succulent"><ellipse cx="45" cy="69" rx="5" ry="3" fill="#725744" />{[0, 60, 120].map((angle) => <ellipse key={angle} cx="45" cy="61" rx="10" ry="4" fill={angle === 60 ? '#9BC9AE' : '#79B498'} transform={`rotate(${angle} 45 61)`} />)}<circle cx="45" cy="61" r="3" fill="#C2DEC2" /></g>;
  if (variant === 'cactus') return <g className="plant-seedling seedling-cactus"><ellipse cx="45" cy="70" rx="6" ry="3" fill="#806047" /><rect x="40" y="53" width="10" height="18" rx="5" fill="#58A66F" /><path d="M41 60h-5v-5M49 63h5v-5" stroke="#58A66F" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M43 57l-3-2M48 61l3-2M44 66l-3 1" stroke="#E1E8CB" strokeWidth="1" /></g>;
  if (variant === 'bamboo') return <g className="plant-seedling seedling-bamboo"><ellipse cx="45" cy="70" rx="6" ry="3" fill="#6E5B41" /><path d="M42 70V53M49 70V58" stroke="#67AA61" strokeWidth="4" strokeLinecap="round" /><path d="M39 61h6M46 64h6M42 55l-7-5M49 59l7-5" stroke="#3F8148" strokeWidth="1.5" strokeLinecap="round" /><path d="M35 50q6-3 7 5M56 54q-6-2-7 5" fill="#78B971" /></g>;
  if (variant === 'monstera') return <g className="plant-seedling seedling-monstera"><ellipse cx="45" cy="70" rx="6" ry="3" fill="#745943" /><path d="M45 70V59" stroke="#4D9060" strokeWidth="3" /><path d="M45 60C31 54 30 43 38 40C48 39 53 50 45 60Z" fill="#4FA16B" /><path d="M43 57V43M41 50l-5-3M44 52l5-4" stroke="#C9E4C5" strokeWidth="1.2" /></g>;
  if (variant === 'rose') return <g className="plant-seedling seedling-rose"><ellipse cx="45" cy="70" rx="6" ry="3" fill="#77553F" /><path d="M45 70Q41 62 46 52" stroke="#4D915B" strokeWidth="3" fill="none" /><path d="M44 62q-10-7-12 0q6 6 12 3M46 58q9-7 11-1q-5 6-11 4" fill="#5BA464" /><circle cx="46" cy="51" r="5" fill="#D95775" /></g>;
  return <g className="plant-seedling seedling-mugunghwa"><ellipse cx="45" cy="69" rx="5" ry="3" fill="#8C623F" /><path d="M45 69V58" stroke="#4E9E5F" strokeWidth="3" strokeLinecap="round" /><path d="M45 62Q33 53 30 59Q36 67 45 65M45 59Q55 50 61 55Q57 63 45 63" fill="#65B96F" /><circle cx="46" cy="55" r="3" fill="#F4ABC5" /></g>;
}

export function Plant({ progress = 0, variant = 'mugunghwa' }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const stage = pct === 100 ? 5 : pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : pct > 0 ? 1 : 0;
  const plantNames = { mugunghwa: 'Mugunghwa', cherry: 'Anh đào', sunflower: 'Hướng dương', lavender: 'Oải hương', bonsai: 'Bonsai', succulent: 'Sen đá', cactus: 'Xương rồng', bamboo: 'Tre may mắn', monstera: 'Trầu bà lá xẻ', rose: 'Hoa hồng' };
  const stageLabel = stage === 5 ? `${plantNames[variant] || plantNames.mugunghwa} trưởng thành` : ['Hạt giống', 'Nảy mầm', 'Cây non', 'Đang phát triển', 'Cây sum suê'][stage];

  return (
    <span key={stage} className="progress-plant-wrap" tabIndex={0} aria-label={`${stageLabel}, tiến độ ${pct}%`}>
      <svg className={`progress-plant plant-${variant} stage-${stage}`} viewBox="0 0 90 110" width="72" height="88" aria-hidden="true">
        <ellipse cx="45" cy="77" rx="16" ry="5" fill="#7B5136" />
        {stage === 0 && <PlantSeedling variant={variant} />}
        {variant === 'mugunghwa' && stage >= 1 && <path className="plant-stem" d={`M45 73 C44 63 45 ${stage >= 4 ? 29 : stage === 3 ? 38 : stage === 2 ? 49 : 61} 46 ${stage >= 4 ? 22 : stage === 3 ? 34 : stage === 2 ? 46 : 58}`} fill="none" stroke={stage === 5 ? '#397A3F' : '#4E9E5F'} strokeWidth={stage === 5 ? 5 : 3.5} strokeLinecap="round" />}
        {variant === 'mugunghwa' && stage >= 1 && <path className="plant-leaf leaf-one" d="M45 62 C35 52 29 54 27 57 C33 65 39 67 45 66 Z" fill="#65B96F" />}
        {variant === 'mugunghwa' && stage >= 2 && <path className="plant-leaf leaf-two" d="M45 53 C53 42 62 42 66 46 C60 55 54 58 45 58 Z" fill="#4E9E5F" />}
        {variant === 'mugunghwa' && stage >= 3 && <path className="plant-leaf leaf-three" d="M45 44 C36 34 27 35 24 39 C30 48 37 51 45 50 Z" fill="#72C57B" />}
        {variant === 'mugunghwa' && stage >= 4 && <path className="plant-leaf leaf-four" d="M45 34 C54 23 65 24 69 29 C62 38 55 41 45 40 Z" fill="#3F9B54" />}
        {variant === 'mugunghwa' && stage === 4 && <path className="plant-leaf leaf-five" d="M45 29 C38 19 30 19 27 23 C31 31 37 35 45 35 Z" fill="#5AAF67" />}

        {variant === 'sunflower' && stage >= 1 && stage < 5 && (
          <g className="sunflower-growth">
            <path className="plant-stem" d={`M45 74 L45 ${stage === 1 ? 60 : stage === 2 ? 48 : stage === 3 ? 34 : 21}`} fill="none" stroke="#51964D" strokeWidth={stage >= 3 ? 5 : 3.5} strokeLinecap="round" />
            {stage >= 2 && <path className="plant-leaf" d="M44 60 C31 48 22 51 20 57 C27 67 36 68 44 65Z" fill="#65A85B" />}
            {stage >= 3 && <path className="plant-leaf" d="M46 49 C59 36 69 40 71 46 C63 57 54 58 46 54Z" fill="#4E984E" />}
            {stage === 4 && <g transform="translate(45 19)">{Array.from({ length: 10 }, (_, i) => <ellipse key={i} cy="-7" ry="7" rx="3.2" fill="#F7C743" transform={`rotate(${i * 36})`} />)}<circle r="6" fill="#80562E" /></g>}
            {stage === 3 && <circle cx="45" cy="32" r="7" fill="#6EA456" />}
          </g>
        )}
        {variant === 'cherry' && stage >= 1 && stage < 5 && (
          <g className="cherry-growth">
            <path className="plant-stem" d={`M45 74 C43 62 48 ${stage >= 3 ? 47 : 58} ${stage >= 4 ? 39 : 45} ${stage >= 4 ? 28 : stage === 3 ? 40 : 54}`} fill="none" stroke="#76513F" strokeWidth={stage >= 3 ? 5 : 3.5} strokeLinecap="round" />
            {stage >= 2 && <path d="M44 58 C35 51 30 47 25 43" fill="none" stroke="#76513F" strokeWidth="3" strokeLinecap="round" />}
            {stage >= 2 && <circle cx="25" cy="42" r={stage >= 4 ? 11 : 7} fill="#F2B2C7" />}
            {stage >= 3 && <circle cx="43" cy="36" r={stage >= 4 ? 14 : 9} fill="#F6C0D1" />}
            {stage >= 4 && <><path d="M42 45 C53 39 59 34 64 28" fill="none" stroke="#76513F" strokeWidth="3" /><circle cx="65" cy="27" r="11" fill="#EFA6BE" /><circle cx="48" cy="37" r="3" fill="#FFF4F7" /><circle cx="66" cy="25" r="3" fill="#FFF4F7" /></>}
          </g>
        )}
        {variant === 'lavender' && stage >= 1 && stage < 5 && (
          <g className="lavender-growth">
            {Array.from({ length: stage }, (_, i) => {
              const x = 45 + (i - (stage - 1) / 2) * 9;
              const top = 60 - stage * 8 + Math.abs(i - 1.5) * 3;
              return <g key={i}><path d={`M45 72 Q${x} 57 ${x} ${top}`} fill="none" stroke="#73966A" strokeWidth="2.2" />{Array.from({ length: stage >= 3 ? 3 : 2 }, (__, j) => <g key={j}><ellipse cx={x - 2.5} cy={top + j * 6} rx="3.5" ry="2.2" fill="#9378CB" transform={`rotate(-30 ${x - 2.5} ${top + j * 6})`} /><ellipse cx={x + 2.5} cy={top + j * 6 + 2} rx="3.5" ry="2.2" fill="#B09ADE" transform={`rotate(30 ${x + 2.5} ${top + j * 6 + 2})`} /></g>)}</g>;
            })}
          </g>
        )}
        {variant === 'bonsai' && stage >= 1 && stage < 5 && (
          <g className="bonsai-growth">
            <path className="plant-stem" d={`M45 74 C${stage >= 2 ? 34 : 42} 63 ${stage >= 3 ? 53 : 43} 54 ${stage >= 4 ? 40 : 45} ${stage >= 4 ? 34 : 51}`} fill="none" stroke="#76513F" strokeWidth={stage >= 3 ? 7 : 4.5} strokeLinecap="round" />
            <ellipse cx={stage >= 2 ? 37 : 43} cy={stage >= 2 ? 57 : 54} rx={stage >= 3 ? 14 : 9} ry={stage >= 3 ? 7 : 5} fill="#4D7E52" />
            {stage >= 3 && <ellipse cx="50" cy="42" rx={stage >= 4 ? 18 : 13} ry={stage >= 4 ? 8 : 6} fill="#3F7047" />}
            {stage >= 4 && <ellipse cx="31" cy="33" rx="16" ry="7" fill="#588758" />}
          </g>
        )}
        {variant === 'succulent' && stage >= 1 && stage < 5 && (
          <g className="succulent-growth">
            {Array.from({ length: stage + 2 }, (_, i) => {
              const angle = (360 / (stage + 2)) * i;
              return <ellipse key={i} cx="45" cy={stage === 1 ? 64 : 60} rx={stage * 2.3 + 5} ry={stage + 3} fill={i % 2 ? '#77B69A' : '#91C7AA'} transform={`rotate(${angle} 45 ${stage === 1 ? 64 : 60})`} />;
            })}
            {stage >= 3 && Array.from({ length: 7 }, (_, i) => <ellipse key={`inner-${i}`} cx="45" cy="58" rx="8" ry="4" fill="#A9D4B8" transform={`rotate(${i * 51} 45 58)`} />)}
          </g>
        )}
        {variant === 'cactus' && stage >= 1 && stage < 5 && (
          <g className="cactus-growth">
            <rect x={39 - stage} y={70 - stage * 10} width={12 + stage * 2} height={stage * 10 + 7} rx={7 + stage} fill="#58A66F" />
            {stage >= 2 && <path d="M40 59 H34 Q29 59 29 53 V48" fill="none" stroke="#58A66F" strokeWidth={stage >= 4 ? 8 : 6} strokeLinecap="round" />}
            {stage >= 3 && <path d="M51 49 H58 Q63 49 63 43 V38" fill="none" stroke="#4A9564" strokeWidth={stage >= 4 ? 8 : 6} strokeLinecap="round" />}
            {stage >= 4 && <g transform="translate(46 28)"><circle r="7" fill="#F29AB6" /><circle r="3" fill="#F9D36E" /></g>}
            {Array.from({ length: stage + 2 }, (_, i) => <path key={i} d={`M${43 + (i % 2) * 5} ${65 - i * 7} l${i % 2 ? 3 : -3} -2`} stroke="#D8E8C9" strokeWidth="1" />)}
          </g>
        )}
        {variant === 'bamboo' && stage >= 1 && stage < 5 && (
          <g className="bamboo-growth">
            <path d={stage === 1 ? 'M45 74V59' : stage === 2 ? 'M42 74V49M50 74V43' : stage === 3 ? 'M37 74V39M45 74V32M54 74V38' : 'M36 74V28M45 74V20M55 74V27'} stroke="#62A95F" strokeWidth="5" strokeLinecap="round" />
            {stage >= 2 && <path d="M39 59h6M47 58h6M42 49h6M47 43h6" stroke="#397E45" strokeWidth="1.5" />}
            {stage >= 3 && <><path d="M37 43 C27 35 22 40 23 44 C29 49 34 48 37 46Z" fill="#76BA6E" /><path d="M54 40 C64 32 69 37 68 41 C62 46 57 45 54 43Z" fill="#64AA61" /></>}
            {stage >= 4 && <><path d="M45 28 C35 19 30 24 31 28 C36 34 41 33 45 31Z" fill="#82C177" /><path d="M55 32 C65 23 71 28 70 32 C64 38 59 37 55 35Z" fill="#6EB268" /></>}
          </g>
        )}
        {variant === 'monstera' && stage >= 1 && stage < 5 && (
          <g className="monstera-growth">
            <path d={`M45 74 C44 62 45 ${62 - stage * 7} 46 ${58 - stage * 7}`} fill="none" stroke="#4D9060" strokeWidth="4" />
            <path d={`M45 ${66 - stage * 4} C${29 - stage} ${55 - stage * 5} ${22 - stage} ${61 - stage * 5} ${24 - stage} ${69 - stage * 5} C34 ${73 - stage * 5} 41 ${69 - stage * 5} 45 ${66 - stage * 4}Z`} fill="#4FA16B" />
            {stage >= 2 && <path d={`M46 ${58 - stage * 5} C${60 + stage} ${46 - stage * 4} ${70 + stage} ${52 - stage * 4} ${68 + stage} ${60 - stage * 4} C58 ${65 - stage * 4} 51 ${62 - stage * 4} 46 ${58 - stage * 5}Z`} fill="#3D8E5D" />}
            {stage >= 3 && <path d="M31 47 l5 5 m-1-10 5 6 M59 38 l-5 7 m12-4-8 7" stroke="#D5EACE" strokeWidth="1.4" />}
          </g>
        )}
        {variant === 'rose' && stage >= 1 && stage < 5 && (
          <g className="rose-growth">
            <path d={`M45 74 C39 62 51 55 44 ${stage >= 4 ? 30 : 64 - stage * 9}`} fill="none" stroke="#4D915B" strokeWidth="4" strokeLinecap="round" />
            {stage >= 2 && <path d="M44 59 C33 50 28 54 28 58 C34 64 39 65 44 63Z" fill="#5BA464" />}
            {stage >= 3 && <path d="M46 48 C57 40 64 44 64 48 C58 55 52 56 46 53Z" fill="#4C955A" />}
            {stage >= 3 && <circle cx="45" cy={stage >= 4 ? 28 : 36} r={stage >= 4 ? 10 : 7} fill="#D95775" />}
            {stage >= 4 && <><path d="M38 28 Q45 20 52 28 Q45 38 38 28Z" fill="#EE8098" /><path d="M41 27 Q45 23 49 27 Q45 32 41 27Z" fill="#B93659" /></>}
          </g>
        )}
        {stage === 5 && variant === 'mugunghwa' && (
          <g className="mature-crown">
            <circle cx="33" cy="31" r="15" fill="#57A95E" />
            <circle cx="49" cy="22" r="17" fill="#438E4D" />
            <circle cx="62" cy="34" r="15" fill="#62B66A" />
            <circle cx="45" cy="41" r="17" fill="#50A45A" />
            <g className="mugunghwa-flower flower-one" transform="translate(33 25) scale(.72)">
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F7B8CD" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(72)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F6AFC8" transform="rotate(144)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(216)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F7B8CD" transform="rotate(288)" />
              <circle r="4" fill="#C94769" /><circle r="1.6" fill="#F7D36A" />
            </g>
            <g className="mugunghwa-flower flower-two" transform="translate(55 19) scale(.62)">
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F6AFC8" transform="rotate(72)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(144)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F7B8CD" transform="rotate(216)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(288)" />
              <circle r="4" fill="#C94769" /><circle r="1.6" fill="#F7D36A" />
            </g>
            <g className="mugunghwa-flower flower-three" transform="translate(61 38) scale(.68)">
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F7B8CD" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(72)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F6AFC8" transform="rotate(144)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(216)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F7B8CD" transform="rotate(288)" />
              <circle r="4" fill="#C94769" /><circle r="1.6" fill="#F7D36A" />
            </g>
            <g className="mugunghwa-flower flower-four" transform="translate(40 43) scale(.58)">
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F6AFC8" transform="rotate(72)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(144)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F7B8CD" transform="rotate(216)" />
              <ellipse cy="-7" ry="8" rx="5.5" fill="#F8C3D5" transform="rotate(288)" />
              <circle r="4" fill="#C94769" /><circle r="1.6" fill="#F7D36A" />
            </g>
          </g>
        )}
        {stage === 5 && variant === 'cherry' && (
          <g className="mature-crown cherry-crown">
            <path d="M45 68 C43 54 39 44 32 34 M45 57 C53 48 59 39 62 30 M42 50 C35 43 29 39 24 36" fill="none" stroke="#76513F" strokeWidth="4" strokeLinecap="round" />
            <circle cx="25" cy="31" r="13" fill="#F4AFC5" /><circle cx="39" cy="23" r="15" fill="#F7BED0" /><circle cx="56" cy="27" r="16" fill="#EDA1BC" /><circle cx="67" cy="39" r="12" fill="#F7C4D3" /><circle cx="37" cy="41" r="16" fill="#F5B3C8" />
            {[[20, 27], [34, 17], [48, 23], [62, 29], [31, 37], [54, 42], [70, 38]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}><circle r="4" fill="#FFF4F7" /><circle r="1.4" fill="#E8789D" /></g>)}
          </g>
        )}
        {stage === 5 && variant === 'sunflower' && (
          <g className="mature-crown sunflower-crown">
            <path d="M45 70 C45 54 45 39 45 20 M44 50 C36 43 31 37 28 31 M46 48 C54 41 61 35 64 27" fill="none" stroke="#4F944F" strokeWidth="4" strokeLinecap="round" />
            {[[45, 19, 1], [25, 30, .78], [66, 27, .82]].map(([x, y, s], flowerIndex) => <g key={flowerIndex} transform={`translate(${x} ${y}) scale(${s})`}>{Array.from({ length: 12 }, (_, i) => <ellipse key={i} cy="-10" ry="9" rx="4" fill={i % 2 ? '#FFD95A' : '#F7C43C'} transform={`rotate(${i * 30})`} />)}<circle r="8" fill="#76502D" /><circle r="4.5" fill="#9B6A32" /></g>)}
            <path d="M44 53 C34 45 27 47 24 51 C31 59 38 59 44 58Z" fill="#5EAA59" /><path d="M46 43 C56 35 64 37 67 41 C61 49 53 51 46 49Z" fill="#4C9850" />
          </g>
        )}
        {stage === 5 && variant === 'lavender' && (
          <g className="mature-crown lavender-crown">
            {[[31, 35], [39, 23], [47, 30], [55, 18], [63, 34]].map(([x, y], stemIndex) => <g key={stemIndex}><path d={`M45 72 Q${x} 53 ${x} ${y}`} fill="none" stroke="#6F9564" strokeWidth="2.4" strokeLinecap="round" />{[0, 6, 12, 18].map((dy, i) => <g key={i}><ellipse cx={x - 3} cy={y + dy} rx="4" ry="2.5" fill={i % 2 ? '#8D74C8' : '#A58CDD'} transform={`rotate(-28 ${x - 3} ${y + dy})`} /><ellipse cx={x + 3} cy={y + dy + 2} rx="4" ry="2.5" fill={i % 2 ? '#A58CDD' : '#7C61B8'} transform={`rotate(28 ${x + 3} ${y + dy + 2})`} /></g>)}</g>)}
            <path d="M45 60 C34 52 27 55 26 59 C33 66 39 67 45 65Z" fill="#789D70" /><path d="M46 55 C55 48 63 50 66 54 C59 61 52 62 46 60Z" fill="#688D63" />
          </g>
        )}
        {stage === 5 && variant === 'bonsai' && (
          <g className="mature-crown bonsai-crown">
            <path d="M45 73 C34 59 53 54 40 43 C31 35 43 28 51 20" fill="none" stroke="#74513B" strokeWidth="8" strokeLinecap="round" />
            <path d="M42 50 C31 46 25 43 18 38 M45 39 C56 34 62 30 69 24" fill="none" stroke="#74513B" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="25" cy="35" rx="19" ry="10" fill="#487B4D" /><ellipse cx="57" cy="23" rx="22" ry="11" fill="#3D7045" /><ellipse cx="61" cy="42" rx="18" ry="9" fill="#568A58" /><ellipse cx="34" cy="51" rx="17" ry="8" fill="#416F47" />
            <path d="M15 34 Q25 25 38 34 M43 22 Q57 12 74 22 M47 41 Q61 32 76 41" fill="none" stroke="#75A272" strokeWidth="2" opacity=".7" />
          </g>
        )}
        {stage === 5 && variant === 'succulent' && (
          <g className="mature-crown succulent-crown">
            {[0, 45, 90, 135].map((angle) => <ellipse key={`outer-${angle}`} cx="45" cy="57" rx="25" ry="9" fill={angle % 90 ? '#67A98E' : '#78B89A'} transform={`rotate(${angle} 45 57)`} />)}
            {[22, 82, 142, 202, 262, 322].map((angle) => <ellipse key={`mid-${angle}`} cx="45" cy="57" rx="17" ry="7" fill={angle % 2 ? '#94C9A9' : '#86BEA0'} transform={`rotate(${angle} 45 57)`} />)}
            {[0, 60, 120].map((angle) => <ellipse key={`in-${angle}`} cx="45" cy="57" rx="10" ry="5" fill="#B7D9BB" transform={`rotate(${angle} 45 57)`} />)}
            <circle cx="45" cy="57" r="4" fill="#D6E7C8" />
          </g>
        )}
        {stage === 5 && variant === 'cactus' && (
          <g className="mature-crown cactus-crown">
            <rect x="34" y="19" width="22" height="57" rx="11" fill="#4F9D68" />
            <path d="M36 53 H27 Q20 53 20 44 V35 M54 44 H64 Q70 44 70 35 V28" fill="none" stroke="#58A66F" strokeWidth="11" strokeLinecap="round" />
            <path d="M40 23 V70 M50 23 V70" stroke="#75BC83" strokeWidth="1.5" opacity=".7" />
            {[[31, 34], [44, 18], [67, 27]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}>{Array.from({ length: 7 }, (_, j) => <ellipse key={j} cy="-6" ry="6" rx="3" fill={j % 2 ? '#F5A0B9' : '#EA789B'} transform={`rotate(${j * 51})`} />)}<circle r="3" fill="#FFD66C" /></g>)}
            {[[38, 32], [51, 39], [41, 51], [50, 60], [26, 42], [66, 34]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l${i % 2 ? 3 : -3} -2`} stroke="#E5EBCF" strokeWidth="1.2" />)}
          </g>
        )}
        {stage === 5 && variant === 'bamboo' && (
          <g className="mature-crown bamboo-crown">
            <path d="M31 76V26M43 76V15M55 76V23" stroke="#64AA60" strokeWidth="6" strokeLinecap="round" />
            <path d="M27 34h8M27 48h8M27 62h8M39 34h8M39 48h8M39 62h8M51 34h8M51 48h8M51 62h8" stroke="#367A43" strokeWidth="1.7" />
            <path d="M31 31 C20 21 13 26 15 31 C21 37 27 35 31 34Z M31 44 C41 35 48 40 47 44 C41 50 35 48 31 47Z M43 22 C32 12 26 17 27 22 C33 28 39 26 43 25Z M43 38 C54 28 61 34 60 38 C54 44 47 42 43 41Z M55 31 C66 21 73 27 72 31 C66 37 59 35 55 34Z M55 47 C44 38 38 43 39 47 C45 53 51 51 55 50Z" fill="#72B96C" />
          </g>
        )}
        {stage === 5 && variant === 'monstera' && (
          <g className="mature-crown monstera-crown">
            <path d="M45 75 C43 57 43 43 44 25 M44 58 C32 50 24 40 20 29 M46 57 C58 48 67 38 71 25" fill="none" stroke="#477E55" strokeWidth="4" />
            {[[20, 27, -28], [44, 22, 0], [70, 26, 28], [31, 45, -18], [59, 44, 18]].map(([x, y, r], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}><path d="M0 17 C-15 11-18-5-7-14 C0-20 12-13 14-3 C16 8 8 14 0 17Z" fill={i % 2 ? '#3E9360' : '#50A56B'} /><path d="M0 15 V-12 M-2 4 l-8-6 M2 1 l7-7 M-1 9 l-7-2 M2 7 l7-3" stroke="#C6E2C0" strokeWidth="1.4" /></g>)}
          </g>
        )}
        {stage === 5 && variant === 'rose' && (
          <g className="mature-crown rose-crown">
            <path d="M45 74 C34 62 54 53 42 43 C34 35 47 28 48 19 M43 52 C34 47 28 42 24 35 M45 42 C55 37 62 31 66 25" fill="none" stroke="#498D58" strokeWidth="4" strokeLinecap="round" />
            <path d="M42 58 C31 51 27 55 27 59 C33 65 38 65 43 63Z M46 49 C57 41 63 45 63 49 C57 55 52 56 46 54Z" fill="#58A15F" />
            {[[24, 32, .72], [48, 18, 1], [67, 24, .82], [43, 42, .66]].map(([x, y, s], i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`}><circle r="10" fill="#E9607E" /><path d="M-8 0 Q0-12 8 0 Q0 11-8 0Z" fill="#F18BA0" /><path d="M0-8 Q10 0 0 8 Q-10 0 0-8Z" fill="#D44367" /><circle r="3.5" fill="#A92F50" /></g>)}
          </g>
        )}
        <path className="plant-pot-body" d="M28 78 h34 l-4 26 a6 6 0 0 1-6 5 h-14 a6 6 0 0 1-6-5 Z" fill="#E8B98B" />
        <path className="plant-pot-rim" d="M26 74 h38 v8 h-38 z" fill="#D9A876" rx="3" />
      </svg>
      <span className="plant-tooltip" aria-hidden="true"><span className="plant-tooltip-icon">{stage === 5 ? '🌺' : '🌱'}</span><span><b>{stageLabel}</b><small>Tiến độ giáo trình</small></span><strong>{pct}%</strong></span>
    </span>
  );
}

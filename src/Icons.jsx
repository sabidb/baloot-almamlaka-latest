// Hand-drawn cartoon "sticker" icon set (inline SVG, no external assets).
// Bold rounded shapes, bright gradients, glossy highlight, dark outline.
// Usage: <Icon name="friends" size={42} />

const OUTLINE = '#20142e';

function Defs({ id, from, to, dir = 'v' }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2={dir === 'v' ? '0' : '1'} y2={dir === 'v' ? '1' : '0'}>
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
  );
}
// glossy highlight blob
const Gloss = ({ cx = 17, cy = 15, rx = 8, ry = 5, o = 0.4 }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={o} />
);

const S = { strokeLinejoin: 'round', strokeLinecap: 'round' };

const ICONS = {
  gear: (
    <>
      <Defs id="g_gear" from="#7CC8FF" to="#3B82F6" />
      <g transform="translate(24,24)">
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="-3.4" y="-23" width="6.8" height="10" rx="3" fill={`url(#g_gear)`} stroke={OUTLINE} strokeWidth="2" transform={`rotate(${i * 45})`} {...S} />
        ))}
        <circle r="15" fill="url(#g_gear)" stroke={OUTLINE} strokeWidth="2.5" />
        <circle r="6" fill="#0e1730" stroke={OUTLINE} strokeWidth="2" />
        <ellipse cx="-5" cy="-6" rx="6" ry="3.5" fill="#fff" opacity="0.35" />
      </g>
    </>
  ),
  friends: (
    <>
      <Defs id="g_fr" from="#67E8F9" to="#2563EB" />
      <circle cx="16" cy="16" r="7" fill="url(#g_fr)" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M5 40c0-8 5-13 11-13s11 5 11 13z" fill="url(#g_fr)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <circle cx="33" cy="18" r="6.2" fill="#A78BFA" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M25 40c0-7 4.5-11.5 10-11.5S44.5 33 44.5 40z" fill="#A78BFA" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <Gloss cx="14" cy="13" rx="3.5" ry="2" o={0.5} />
    </>
  ),
  robot: (
    <>
      <Defs id="g_ro" from="#C7D2FE" to="#6366F1" />
      <line x1="24" y1="4" x2="24" y2="10" stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="24" cy="4" r="3" fill="#F0C040" stroke={OUTLINE} strokeWidth="2" />
      <rect x="9" y="11" width="30" height="24" rx="8" fill="url(#g_ro)" stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="18" cy="22" r="3.4" fill="#0e1730" />
      <circle cx="30" cy="22" r="3.4" fill="#0e1730" />
      <circle cx="19" cy="21" r="1.1" fill="#fff" />
      <circle cx="31" cy="21" r="1.1" fill="#fff" />
      <rect x="17" y="28" width="14" height="3.4" rx="1.7" fill="#0e1730" />
      <rect x="14" y="36" width="20" height="7" rx="3.5" fill="#8B93F8" stroke={OUTLINE} strokeWidth="2.5" />
      <Gloss cx="16" cy="16" rx="5" ry="2.6" o={0.4} />
    </>
  ),
  trophy: (
    <>
      <Defs id="g_tr" from="#FFE08A" to="#E0A020" />
      <path d="M15 7h18v10a9 9 0 0 1-18 0z" fill="url(#g_tr)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <path d="M15 10H9c0 6 3 8 7 8" fill="none" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <path d="M33 10h6c0 6-3 8-7 8" fill="none" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <rect x="21" y="26" width="6" height="7" fill="url(#g_tr)" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M14 41c0-4 4-6 10-6s10 2 10 6z" fill="url(#g_tr)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <path d="M24 10.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff" opacity="0.85" />
    </>
  ),
  key: (
    <>
      <Defs id="g_ke" from="#FFE08A" to="#D9A017" />
      <circle cx="15" cy="15" r="10" fill="url(#g_ke)" stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="15" cy="15" r="4" fill="#0e1730" />
      <path d="M22 22l16 16" stroke={OUTLINE} strokeWidth="6.5" {...S} />
      <path d="M22 22l16 16" stroke="url(#g_ke)" strokeWidth="4" {...S} />
      <path d="M33 33l4 4M29 29l3 3" stroke={OUTLINE} strokeWidth="3" {...S} />
      <Gloss cx="12" cy="11" rx="3.5" ry="2" o={0.5} />
    </>
  ),
  gift: (
    <>
      <Defs id="g_gi" from="#F9A8D4" to="#DB2777" />
      <rect x="8" y="20" width="32" height="20" rx="3" fill="url(#g_gi)" stroke={OUTLINE} strokeWidth="2.5" />
      <rect x="6" y="14" width="36" height="9" rx="3" fill="#F472B6" stroke={OUTLINE} strokeWidth="2.5" />
      <rect x="21" y="14" width="6" height="26" fill="#FBCFE8" stroke={OUTLINE} strokeWidth="2.2" />
      <path d="M24 14c-2-8-12-8-9-1 1.5 3 6 1 9 1zM24 14c2-8 12-8 9-1-1.5 3-6 1-9 1z" fill="#F472B6" stroke={OUTLINE} strokeWidth="2.2" {...S} />
      <Gloss cx="14" cy="24" rx="4" ry="2" o={0.35} />
    </>
  ),
  crown: (
    <>
      <Defs id="g_cr" from="#FFE9A8" to="#E0A020" />
      <path d="M7 34l-2-18 10 8 9-14 9 14 10-8-2 18z" fill="url(#g_cr)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <rect x="7" y="34" width="34" height="7" rx="2.5" fill="url(#g_cr)" stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="24" cy="12" r="2.4" fill="#E0506A" stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="6" cy="15" r="2.2" fill="#5FBF7A" stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="42" cy="15" r="2.2" fill="#5FBF7A" stroke={OUTLINE} strokeWidth="1.6" />
      <Gloss cx="16" cy="24" rx="4" ry="2" o={0.4} />
    </>
  ),
  bolt: (
    <>
      <Defs id="g_bo" from="#FFF08A" to="#F5A623" />
      <path d="M27 3L10 27h10l-3 18 20-26H26z" fill="url(#g_bo)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <path d="M25 8L15 24" stroke="#fff" strokeWidth="2" opacity="0.5" {...S} />
    </>
  ),
  play: (
    <>
      <Defs id="g_pl" from="#22c55e" to="#15803d" />
      <circle cx="24" cy="24" r="20" fill="url(#g_pl)" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M19 15l15 9-15 9z" fill="#fff" stroke={OUTLINE} strokeWidth="2" {...S} />
      <Gloss cx="16" cy="15" rx="5" ry="2.6" o={0.35} />
    </>
  ),
  bell: (
    <>
      <Defs id="g_be" from="#FFE08A" to="#E0A020" />
      <path d="M24 6a11 11 0 0 1 11 11c0 9 4 12 4 12H9s4-3 4-12A11 11 0 0 1 24 6z" fill="url(#g_be)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <path d="M20 33a4 4 0 0 0 8 0z" fill="#E0A020" stroke={OUTLINE} strokeWidth="2.2" {...S} />
      <circle cx="24" cy="5" r="2.4" fill="#E0A020" stroke={OUTLINE} strokeWidth="2" />
      <Gloss cx="19" cy="15" rx="3" ry="4" o={0.4} />
    </>
  ),
  home: (
    <>
      <Defs id="g_ho" from="#5FE08A" to="#16a34a" />
      <path d="M24 6L5 22h5v18h28V22h5z" fill="url(#g_ho)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <rect x="20" y="28" width="8" height="12" rx="1.5" fill="#0e2a18" stroke={OUTLINE} strokeWidth="2" />
      <Gloss cx="16" cy="24" rx="3.5" ry="2" o={0.35} />
    </>
  ),
  medal: (
    <>
      <Defs id="g_me" from="#FFE9A8" to="#E0A020" />
      <path d="M16 5l4 16-8 2zM32 5l-4 16 8 2z" fill="#E0506A" stroke={OUTLINE} strokeWidth="2.2" {...S} />
      <circle cx="24" cy="31" r="12" fill="url(#g_me)" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M24 24l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#fff" opacity="0.9" />
    </>
  ),
  bag: (
    <>
      <Defs id="g_ba" from="#C084FC" to="#7C3AED" />
      <path d="M10 16h28l-2 24H12z" fill="url(#g_ba)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <path d="M17 18v-3a7 7 0 0 1 14 0v3" fill="none" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <Gloss cx="17" cy="24" rx="3.5" ry="2.4" o={0.35} />
    </>
  ),
  user: (
    <>
      <Defs id="g_us" from="#FDBA74" to="#EA580C" />
      <circle cx="24" cy="16" r="9" fill="url(#g_us)" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M8 42c0-9 7-14 16-14s16 5 16 14z" fill="url(#g_us)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <Gloss cx="20" cy="13" rx="3.5" ry="2" o={0.45} />
    </>
  ),
  coin: (
    <>
      <Defs id="g_co" from="#FFE9A8" to="#E0A020" />
      <circle cx="24" cy="24" r="19" fill="url(#g_co)" stroke={OUTLINE} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />
      <text x="24" y="31" textAnchor="middle" fontSize="16" fontWeight="900" fill="#8a5a00">★</text>
      <Gloss cx="17" cy="16" rx="5" ry="3" o={0.5} />
    </>
  ),
  gem: (
    <>
      <Defs id="g_ge" from="#A7F3F8" to="#22B8CF" />
      <path d="M14 8h20l8 10-18 24L6 18z" fill="url(#g_ge)" stroke={OUTLINE} strokeWidth="2.5" {...S} />
      <path d="M6 18h36M14 8l10 10 10-10M24 18v24" stroke={OUTLINE} strokeWidth="1.6" opacity="0.6" {...S} />
      <Gloss cx="18" cy="16" rx="3.5" ry="2" o={0.5} />
    </>
  ),
};

export function Icon({ name, size = 42, style }) {
  const body = ICONS[name];
  if (!body) return <span style={{ fontSize: size * 0.8 }}>◻</span>;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.4))', ...style }}>
      {body}
    </svg>
  );
}

import { motion, useReducedMotion } from 'framer-motion';

/* ---------------------------------------------------------------------------
   QR pattern — generated once at module load, deterministic (no hydration
   mismatch). A 21×21 grid with real finder/timing structure; data modules are
   a decorative pseudo-random fill, merged into horizontal runs so the whole
   pattern is one compound path that "draws itself" via pathLength.
--------------------------------------------------------------------------- */
const GRID = 21;

const inFinderZone = (x, y) =>
  (x < 8 && y < 8) || (x >= GRID - 8 && y < 8) || (x < 8 && y >= GRID - 8);

const isFilled = (x, y) => {
  if (inFinderZone(x, y)) return false;
  if (x === 6 || y === 6) return (x === 6 ? y : x) % 2 === 0; // timing pattern
  return (x * x * 3 + y * y * 7 + x * y) % 5 < 2;
};

const buildModulePath = () => {
  let d = '';
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!isFilled(x, y)) continue;
      let end = x;
      while (end + 1 < GRID && isFilled(end + 1, y)) end++;
      d += `M${x} ${y + 0.5}H${end + 1}`;
      x = end;
    }
  }
  return d;
};

const MODULE_PATH = buildModulePath();

const FINDERS = [
  { x: 0, y: 0 },
  { x: GRID - 7, y: 0 },
  { x: 0, y: GRID - 7 },
];

function QrCode({ reduce }) {
  const draw = (delay) => ({
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: reduce
        ? { duration: 0 }
        : { pathLength: { delay, duration: 0.55, ease: 'easeInOut' }, opacity: { delay, duration: 0.15 } },
    },
  });

  const pop = (delay) => ({
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: reduce ? { duration: 0 } : { delay, type: 'spring', stiffness: 320, damping: 22 },
    },
  });

  const modules = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: reduce
        ? { duration: 0 }
        : { pathLength: { delay: 0.9, duration: 1.6, ease: 'easeInOut' }, opacity: { delay: 0.9, duration: 0.2 } },
    },
  };

  return (
    <motion.svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      className="size-24 text-ink-950 sm:size-28"
      role="img"
      aria-label="ZATCA e-invoice QR code being drawn"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.6 }}
    >
      {FINDERS.map(({ x, y }, i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <motion.path
            d="M0.5 0.5H6.5V6.5H0.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            variants={draw(0.15 + i * 0.2)}
          />
          <motion.rect x="2" y="2" width="3" height="3" fill="currentColor" variants={pop(0.45 + i * 0.2)} />
        </g>
      ))}
      <motion.path
        d={MODULE_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        variants={modules}
      />
    </motion.svg>
  );
}

const LINE_ITEMS = [
  { en: 'Chicken Mandi', ar: 'مندي دجاج', qty: 2, price: '64.00' },
  { en: 'Fresh Lemon Mint', ar: 'ليمون بالنعناع', qty: 3, price: '36.00' },
  { en: 'Kunafa', ar: 'كنافة', qty: 1, price: '28.00' },
];

/**
 * A visual representation of a ZATCA Phase 2 compliant receipt.
 * The QR code draws itself when the receipt enters the viewport.
 */
export default function ZatcaReceipt() {
  const reduce = useReducedMotion();

  return (
    <motion.figure
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-sm"
    >
      <div className="rounded-2xl bg-white px-6 py-7 text-ink-950 shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="text-center">
          <p className="font-display text-base font-bold">RestoPos Demo Restaurant</p>
          <p className="mt-0.5 text-sm text-ink-950/60" lang="ar" dir="rtl">
            مطعم ريستوبوس التجريبي
          </p>
          <dl className="mt-3 space-y-0.5 text-[11px] text-ink-950/50">
            <div className="flex justify-between">
              <dt>VAT No. · الرقم الضريبي</dt>
              <dd className="tabular-nums">310122393500003</dd>
            </div>
            <div className="flex justify-between">
              <dt>Invoice · فاتورة</dt>
              <dd className="tabular-nums">SME-2841 · 2026-07-09 20:42</dd>
            </div>
          </dl>
        </div>

        <hr className="my-4 border-dashed border-ink-950/15" />

        {/* Line items */}
        <ul className="space-y-2.5 text-sm">
          {LINE_ITEMS.map(({ en, ar, qty, price }) => (
            <li key={en} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {en} <span className="text-ink-950/45">×{qty}</span>
                </p>
                <p className="truncate text-xs text-ink-950/45" lang="ar" dir="rtl">
                  {ar}
                </p>
              </div>
              <p className="tabular-nums font-medium">{price}</p>
            </li>
          ))}
        </ul>

        <hr className="my-4 border-dashed border-ink-950/15" />

        {/* Totals */}
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-950/60">
            <dt>Subtotal · المجموع الفرعي</dt>
            <dd className="tabular-nums">128.00</dd>
          </div>
          <div className="flex justify-between text-ink-950/60">
            <dt>VAT 15% · ضريبة القيمة المضافة</dt>
            <dd className="tabular-nums">19.20</dd>
          </div>
          <div className="flex justify-between font-display text-base font-bold">
            <dt>Total (SAR) · الإجمالي</dt>
            <dd className="tabular-nums">147.20</dd>
          </div>
        </dl>

        {/* QR */}
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <QrCode reduce={reduce} />
          <p className="text-center text-[10px] leading-relaxed text-ink-950/45">
            Scan to verify · امسح للتحقق
            <br />
            ZATCA e-invoice · Cryptographic stamp applied
          </p>
        </div>
      </div>

      {/* Compliance badge */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: reduce ? 0 : 2.6, type: 'spring', stiffness: 260, damping: 20 }}
        className="absolute -right-3 -top-3 rounded-full border border-mint-500/40 bg-ink-900 px-3.5 py-1.5 text-[11px] font-semibold text-mint-300 shadow-lg"
      >
        ✓ ZATCA Phase 2
      </motion.div>

      <figcaption className="sr-only">
        Example of a ZATCA Phase 2 compliant simplified tax invoice generated by RestoPos, including
        bilingual line items, 15% VAT breakdown and a verification QR code.
      </figcaption>
    </motion.figure>
  );
}

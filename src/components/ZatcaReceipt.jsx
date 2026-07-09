import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

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

// The QR starts drawing once the receipt has finished printing.
const QR_BASE_DELAY = 1.2;

function QrCode({ active, reduce }) {
  const draw = (delay) => ({
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: reduce
        ? { duration: 0 }
        : {
            pathLength: { delay: QR_BASE_DELAY + delay, duration: 0.55, ease: 'easeInOut' },
            opacity: { delay: QR_BASE_DELAY + delay, duration: 0.15 },
          },
    },
  });

  const pop = (delay) => ({
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: reduce
        ? { duration: 0 }
        : { delay: QR_BASE_DELAY + delay, type: 'spring', stiffness: 320, damping: 22 },
    },
  });

  const modules = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: reduce
        ? { duration: 0 }
        : {
            pathLength: { delay: QR_BASE_DELAY + 0.75, duration: 1.6, ease: 'easeInOut' },
            opacity: { delay: QR_BASE_DELAY + 0.75, duration: 0.2 },
          },
    },
  };

  return (
    <motion.svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      className="size-20 text-charcoal sm:size-24"
      role="img"
      aria-label="ZATCA e-invoice QR code being drawn"
      initial="hidden"
      animate={active ? 'visible' : 'hidden'}
    >
      {FINDERS.map(({ x, y }, i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <motion.path
            d="M0.5 0.5H6.5V6.5H0.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            variants={draw(i * 0.2)}
          />
          <motion.rect x="2" y="2" width="3" height="3" fill="currentColor" variants={pop(0.3 + i * 0.2)} />
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

/* ---------------------------------------------------------------------------
   Receipt data — mirrors the official RestoPOS demo receipt.
--------------------------------------------------------------------------- */
const LINE_ITEMS = [
  { ar: 'برست العنبر', en: 'Grilled Broast Platter', qty: 2, price: 68.0 },
  { ar: 'عصير برتقال طازج', en: 'Fresh Orange Juice', qty: 1, price: 14.0 },
  { ar: 'أرز بخاري', en: 'Bukhari Rice', qty: 1, price: 22.0 },
];

const SUBTOTAL = LINE_ITEMS.reduce((s, i) => s + i.qty * i.price, 0);
const VAT = SUBTOTAL * 0.15;
const TOTAL = SUBTOTAL + VAT;

function useCountUp(target, active, reduce, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setValue(target);
      return;
    }
    let start;
    let frame;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, target, reduce, duration]);
  return value;
}

/**
 * A visual representation of a ZATCA Phase 2 compliant receipt.
 * The receipt "prints" out of the slot when it enters the viewport,
 * then the QR code draws itself.
 */
export default function ZatcaReceipt() {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const total = useCountUp(TOTAL, inView, reduce);

  return (
    <figure ref={ref} className="relative mx-auto w-full max-w-sm">
      {/* Printer slot */}
      <div className="mx-6 h-3 rounded-t-md border border-b-0 border-hairline bg-charcoal-raised" />

      {/* Paper */}
      <motion.div
        className="relative origin-top rounded-b-sm bg-bone px-6 pb-8 pt-6 font-mono text-[12px] leading-relaxed text-charcoal shadow-gold"
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        animate={inView ? { clipPath: 'inset(0 0 0% 0)' } : {}}
        transition={reduce ? { duration: 0 } : { duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-3 text-center">
          <p className="text-[13px] font-semibold tracking-widest">RESTOPOS</p>
          <p className="text-[10px] text-charcoal/60">Broast Al-Bahr — Makkah Branch</p>
          <p className="text-[10px] text-charcoal/40">VAT No. 3007xxxxxx0003</p>
        </div>

        <div className="my-2 border-t border-dashed border-charcoal/30" />

        {LINE_ITEMS.map((item) => (
          <div key={item.en} className="flex justify-between py-0.5">
            <span>
              {item.qty}× {item.en}
              <span className="block text-[10px] text-charcoal/45" lang="ar" dir="rtl">
                {item.ar}
              </span>
            </span>
            <span>{(item.qty * item.price).toFixed(2)}</span>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-charcoal/30" />

        <div className="flex justify-between text-charcoal/60">
          <span>Subtotal</span>
          <span>{SUBTOTAL.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-charcoal/60">
          <span>VAT (15%)</span>
          <span>{VAT.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-charcoal/30 pt-1 text-[14px] font-semibold">
          <span>Total (SAR)</span>
          <span>{total.toFixed(2)}</span>
        </div>

        {/* ZATCA QR — draws itself once the receipt has printed */}
        <div className="mt-4 flex flex-col items-center">
          <QrCode active={inView} reduce={reduce} />
          <p className="mt-1.5 text-[9px] tracking-wider text-charcoal/50">
            ZATCA PHASE 2 · VERIFIED
          </p>
        </div>
      </motion.div>

      {/* Torn edge */}
      <svg viewBox="0 0 320 12" className="h-3 w-full text-bone" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0,0 L10,10 L20,0 L30,10 L40,0 L50,10 L60,0 L70,10 L80,0 L90,10 L100,0 L110,10 L120,0 L130,10 L140,0 L150,10 L160,0 L170,10 L180,0 L190,10 L200,0 L210,10 L220,0 L230,10 L240,0 L250,10 L260,0 L270,10 L280,0 L290,10 L300,0 L310,10 L320,0 L320,12 L0,12 Z"
          fill="currentColor"
        />
      </svg>

      {/* Compliance badge */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: reduce ? 0 : 3.4, type: 'spring', stiffness: 260, damping: 20 }}
        className="absolute -right-3 -top-3 rounded-full border border-leaf-bright/40 bg-charcoal px-3.5 py-1.5 text-[11px] font-semibold text-leaf-bright shadow-lg"
      >
        ✓ ZATCA Phase 2
      </motion.div>

      <figcaption className="sr-only">
        Example of a ZATCA Phase 2 compliant simplified tax invoice printed by RestoPOS, including
        bilingual line items, a 15% VAT breakdown and a verification QR code.
      </figcaption>
    </figure>
  );
}

# RestoPOS — Landing Page

Marketing site for **RestoPOS**, a ZATCA Phase 2-compliant point of sale for restaurants in
Saudi Arabia.

Built with [Astro](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com) and
[Framer Motion](https://www.framer.com/motion/) (React island for the animated ZATCA receipt).

## Structure

```
src/
├── layouts/
│   └── Layout.astro          # Base HTML shell — fonts, meta, navbar + footer, reveal script
├── components/
│   ├── Navbar.astro          # Persistent glassmorphism navbar with Book Demo CTA
│   ├── Hero.astro            # Floating 3D-tilt container + light-sweep + bilingual word
│   ├── DashboardPreview.astro# Placeholder RestoPOS Manager Console UI
│   ├── Compliance.astro      # ZATCA trust section
│   ├── ZatcaReceipt.jsx      # React island — receipt prints itself, QR draws itself
│   ├── DemoCta.astro         # CTA band
│   └── Footer.astro
├── pages/
│   ├── index.astro           # Home — hero, trust bar, pillars, compliance, CTA
│   ├── features.astro        # Order → Bill → Report sequence + feature grid
│   ├── pricing.astro         # Single Branch / Multi-Branch / Enterprise plans
│   └── contact.astro         # Demo request form
└── styles/
    └── global.css            # Tailwind + brand tokens + keyframe utilities
```

## Branding

Official RestoPOS guidelines — all tokens live in `src/styles/global.css` under `@theme`:

- **Logo gradient** green `#4C7A52` → gold `#C1922E` (white R) — `.brand-gradient`
- **Charcoal** `#0A0A0A` (soft `#141414`, raised `#1B1B1B`) — surfaces
- **Gold** `#C5A059` (bright `#DCC08A`, dim `#8A7245`) — accent
- **Leaf** `#4C7A52` (bright `#6F9E74`, dim `#3A5C40`) — live/compliance signals
- **Bone** `#F5F3EE` — text / receipt paper · **Hairline** `#262622` — borders
- **Inter** for UI, **JetBrains Mono** for receipts and numbers
- Voice: *"Restaurant billing, done quietly."*

## Commands

| Command           | Action                       |
| :---------------- | :--------------------------- |
| `npm install`     | Install dependencies         |
| `npm run dev`     | Dev server at localhost:4321 |
| `npm run build`   | Production build to `dist/`  |
| `npm run preview` | Preview the build locally    |

## Accessibility

- All animations respect `prefers-reduced-motion`.
- The animated receipt and dashboard preview carry descriptive ARIA labels /
  visually-hidden captions.
- Receipt content is bilingual (Arabic/English) with proper `lang` / `dir` attributes.

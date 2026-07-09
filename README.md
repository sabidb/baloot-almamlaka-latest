# RestoPos — Landing Page

Marketing site for **RestoPos**, a ZATCA-compliant point of sale for restaurants in Saudi Arabia.

Built with [Astro](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com) and
[Framer Motion](https://www.framer.com/motion/) (React island for the animated ZATCA receipt).

## Structure

```
src/
├── layouts/
│   └── Layout.astro          # Base HTML shell — fonts, meta, navbar + footer
├── components/
│   ├── Navbar.astro          # Persistent glassmorphism navbar with Book Demo CTA
│   ├── Hero.astro            # Floating 3D-tilt container + light-sweep animation
│   ├── DashboardPreview.astro# Placeholder RestoPos dashboard UI
│   ├── Compliance.astro      # ZATCA trust section
│   ├── ZatcaReceipt.jsx      # React island — receipt with self-drawing QR (Framer Motion)
│   ├── DemoCta.astro         # Book-a-demo section
│   └── Footer.astro
├── pages/
│   └── index.astro
└── styles/
    └── global.css            # Tailwind + brand tokens + keyframe utilities
```

## Branding

All brand tokens (colors, fonts) live in `src/styles/global.css` under `@theme`.
Swap the values there to apply the official RestoPos guidelines — components
reference tokens only.

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

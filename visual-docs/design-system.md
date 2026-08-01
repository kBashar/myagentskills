# Blueprint-Schematic Design System

The approved design system for documentation-visualization HTML (analysis/explanation docs paired with a visual, browsable page). Reuse this identity as the default; **adapt the accent + role hues to each subject** rather than copying verbatim, so each viz stays subject-specific instead of templated.

**Identity:** "field-survey / blueprint schematic" — a technical, instrument-panel voice suited to engineering/codebase internals. Monospace-forward, hairline borders, sharp corners, faint plotted-grid ground.

**Color (token-based, both themes required).** Warm-paper / green-black grounds with green-biased neutrals. ONE bold accent (assign it to the subject's conceptual crux), muted role hues for categories.
- Light: `--paper:#f5f3ec` `--surface:#fbfaf5` `--surface-2:#efece1` `--ink:#14201a` `--muted:#5c665f` `--faint:#8a938c` `--line:#dcd8cb` `--line-2:#c9c4b4` · accent `#b77a26`
- Dark: `--paper:#0e1512` `--surface:#141d19` `--surface-2:#1a2420` `--ink:#e8ede8` `--muted:#93a099` `--faint:#67746c` `--line:#263029` `--line-2:#33403a` · accent `#d79a3f`
- Role hues (light/dark): model `#4a68b0`/`#7d97dd`, accent-crux `#b77a26`/`#d79a3f`, detector-clay `#c25a38`/`#e07f5f`, analyzer-green `#2f8c68`/`#4bb98d`, special-plum `#8a5cb0`/`#b285d8`. Give each a `-soft` rgba (~0.12–0.16) for tints.
- Theming: define tokens on `:root` (light default), redefine under `@media (prefers-color-scheme: dark)` AND under `:root[data-theme="dark"]` / `:root[data-theme="light"]` so the viewer toggle wins both directions.

**Type (no webfonts — hosted viewers block font CDNs and the fallback is silent; use system stacks).**
- Headings/labels/data/code: `--font-mono: ui-monospace, "JetBrains Mono", "SF Mono", "Menlo", "Cascadia Code", monospace` — carries the personality.
- Body: `--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Eyebrows: mono, uppercase, `.72rem`, `letter-spacing:.18em`, accent color. Headings `text-wrap:balance`. Body `line-height:1.62`, ~62ch measure.

**Layout / structural devices.**
- Centered ~960px column (`--maxw`); page body on a faint CSS plotted-grid background (two linear-gradients, 30px cells, `--grid` rgba).
- Sharp corners (`--radius:3px`) — never rounded-lg. Hairline `--line` cards on `--surface`. Role encoded via a mono uppercase tag + 9px square swatch (NOT the AI-default accent rail).
- Sections separated by `border-bottom:1px solid --line`, generous 64px padding.
- Diagrams built from CSS-connector nodes (no fragile SVG coords): vertical stem/connector lines, a fork (abs-positioned horizontal + two vertical hairlines) for branch diagrams, numbered rail for genuine sequences only.
- Numbering ONLY where content is a real sequence (pipelines/steps); use role swatches for non-sequential sets.

**Motion:** subtle scroll-reveal via IntersectionObserver (`opacity`+`translateY(14px)`), card hover `translateY(-2px)` + role border. Always gate on `prefers-reduced-motion: reduce` (show everything, no transition).

**Build hygiene:** self-contained (inline CSS/JS, no external assets), responsive (`overflow-x:auto` on wide content, single-column stacks under ~620px), `<title>` set, favicon (emoji). For a repo deliverable, write a full standalone HTML document; to publish a hosted page, use whatever publishing tool the harness provides (body fragment only). Full standards — treatment, themes, copy, hygiene, verification — are in `page-craft.md` next to this file.

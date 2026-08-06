---
name: visual-docs
description: Use when asked to prepare an analysis, explanation, "how it works" writeup, runbook, report, design doc, or any browsable page about a codebase or system, and a visual page would communicate better than plain markdown. Triggers on "explain how X works", "document/analyze this", "write a runbook/report", or any request for an HTML visualization of a system.
---

# Visual Docs

## Overview

Analysis and explanation docs land better as a **visual, browsable HTML page**, not just markdown. This skill carries a specific visual identity — a **"field-survey / blueprint schematic"**: monospace-forward, hairline borders, sharp corners, a faint plotted-grid ground, one bold accent, muted role hues. Adapt the accent and role hues to each subject rather than copying verbatim.

**Core principle:** pair the written analysis with a page someone can scan, where every structural device (numbering, swatches, dividers, labels) encodes something true about the content — never decoration.

## When to Use

- "Explain how X works", "document/analyze this system", "write a runbook / report / design doc"
- Any time the deliverable is a document AND a visual would read more clearly than prose
- You're about to hand over a checklist, comparison, architecture map, or pipeline

**Not for:** throwaway answers, code comments, or when the user explicitly asks for plain markdown/text.

## Bundled files

Both live next to this file. This skill is self-contained — it depends on no other skill.

- **`page-craft.md`** — the craft floor for any page: treatment calibration, theme tokens, typography, layout, copy, build hygiene, the AI-default looks to avoid, and a pre-delivery checklist.
- **`design-system.md`** — the blueprint-schematic visual identity: exact palette, role hues, type stack, structural devices.

## Process

1. **Read `page-craft.md`** — the standards every page here must clear.
2. **Read `design-system.md`** for the exact palette, type stack, and layout devices. Build from its tokens.
3. **Adapt to the subject** — assign the ONE bold accent to the subject's conceptual crux; map role hues to the subject's own categories. Don't reuse the reference hues verbatim.
4. **Build self-contained HTML** — inline CSS/JS, no external assets; both light + dark via `:root` tokens + `prefers-color-scheme` AND `data-theme` overrides; responsive with `overflow-x:auto` on wide content; `<title>` + emoji favicon.
5. **Deliver the local file** — write a standalone `.html` (full `<!DOCTYPE>`) into the repo (e.g. `docs/`) so it lives with the code, give the user the path, and stop. The local file is the whole deliverable; publishing is a separate request, never a bonus you add on your own.
6. **Publish only when the user asked for a hosted copy.** The predicate is an explicit request in their words — "publish it", "host it", "give me a link", "share it", "put it on claude.ai". Anything short of that (a page-publishing tool being available, the page looking shareable, the user seeming likely to want a link) means do not publish; offer the option in one sentence instead. When they do ask: hosts typically wrap their own `<head>`/`<body>`, so publish a **body-fragment** copy — no `<!DOCTYPE>`/`<html>`/`<head>`/`<body>` tags, keeping the `<style>`, content, and `<script>`. Drop any custom theme-toggle button from the fragment — the host supplies its own toggle, stamping `data-theme` on the root, which the tokens already handle. Pass an emoji favicon and a one-line description, then report both the local path and the URL.
7. **Verify** — run the checklist at the end of `page-craft.md`: both themes legible, toggle wins over OS preference, no horizontal body scroll, no silent font fallback, keyboard focus visible.

## Quick Reference — the identity

- Mono-forward headings/labels/data (`ui-monospace` stack); system-sans body at ~62ch.
- Warm-paper / green-black grounds, green-biased neutrals; sharp 3px corners; hairline cards.
- Role encoded as a mono uppercase tag + 9px square swatch — NOT an accent rail on a rounded card.
- Numbering ONLY for genuine sequences (pipelines/steps); subtle scroll-reveal gated on `prefers-reduced-motion`.
- Full tokens (light/dark hex, role hues, type, layout) live in `design-system.md`.

## Common Mistakes

- Publishing a hosted copy the user never asked for. The local `.html` is the deliverable; a link happens only on explicit request.
- Copying the reference palette verbatim instead of adapting the accent + role hues to the subject.
- Skipping the dark theme, or inverting it naively — give it equal care.
- Numbered markers on content that isn't actually a sequence.
- Forgetting `overflow-x:auto` on tables/code, so the page body scrolls sideways.
- Linking a webfont CDN (hosted viewers block it and the fallback is silent) — inline as a data URI or use system stacks.
- Building from `design-system.md` alone and skipping `page-craft.md` — the identity without the standards.

**REQUIRED READING:** `page-craft.md` and `design-system.md`, both bundled next to this file, before building.

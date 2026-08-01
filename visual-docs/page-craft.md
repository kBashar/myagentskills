# Page Craft — build standards

The craft floor every page built by this skill must clear, regardless of subject. `design-system.md` supplies the *visual identity* (palette, type stack, structural devices); this file supplies the *standards* that identity is executed against. Read both before writing HTML.

## 1. Calibrate the treatment

Craft is not optional; the **treatment** is what varies. A doc deserves the same care as a landing page, delivered differently.

Documentation pages — analyses, runbooks, design docs, "how it works" writeups — are **utilitarian-polished** by default: real typographic hierarchy, considered spacing, a deliberate palette, and nothing more. No gigantic hero, no flourish that isn't carrying information. Escalate to an editorial treatment only when the deliverable is genuinely a showcase piece the reader is meant to admire.

When unsure: a well-composed page is never the wrong answer; an over-designed one sometimes is.

## 2. Honor what's already there

Look for an existing design system before inventing one — `CLAUDE.md`, a tokens or theme file, existing component styles in the repo. Precedence, always:

1. The user's own words
2. The project's existing system
3. `design-system.md`
4. Your own choices

Each level fills gaps in the one above it and never overrides it.

## 3. Ground it in the subject

Pin one concrete subject, its audience, and the single job of the page. Distinctive choices come from the subject's own world — its materials, instruments, and vernacular — not from a template.

Build with real content throughout: real module names, real function signatures, real commands, real numbers pulled from the code. Never lorem, never invented metrics, never a placeholder that survives to delivery.

## 4. Typography

- **No webfont CDN.** Hosted viewers commonly block external requests and the fallback is silent — you will not see it locally. Use the system stacks in `design-system.md`, or inline a face as a `@font-face` data URI.
- Running text near **62–65 characters** wide, `line-height` ~1.6.
- Set a type scale and stay on it — no one-off font sizes.
- `text-wrap: balance` on headings.
- Letter-spacing on uppercase labels and eyebrows (~`.18em`).
- `font-variant-numeric: tabular-nums` wherever digits line up in columns.

## 5. Color and themes

- **Neutrals are chosen, not inherited.** A pure mid-grey reads as unconsidered; a neutral biased toward the accent reads as picked. (`design-system.md` biases them green.)
- **One bold accent**, spent in one place. If it fights the ground, shift it analogous or drop saturation rather than swapping it out.
- **Semantic color is separate.** ok / warning / critical carry state; they are not the accent and don't count as it.
- **Both themes, equal care.** Never a naive inversion — check contrast and the accent on both grounds.

The robust pattern is token-level. Define the palette on `:root`, redefine **only the tokens** for dark, and let the viewer's toggle win in both directions:

```css
:root {                                   /* light default */
  --paper: #f5f3ec;  --ink: #14201a;  --accent: #b77a26;
}
@media (prefers-color-scheme: dark) {     /* OS preference */
  :root { --paper: #0e1512; --ink: #e8ede8; --accent: #d79a3f; }
}
:root[data-theme="dark"]  { --paper: #0e1512; --ink: #e8ede8; --accent: #d79a3f; }
:root[data-theme="light"] { --paper: #f5f3ec; --ink: #14201a; --accent: #b77a26; }
```

Style every component **through** the tokens. Writing component rules inside the media query is what breaks the toggle.

A page that deliberately commits to a single visual world may stay single-theme — but make that a stated choice, not an omission.

## 6. Layout

- Lay out sibling groups with flex or grid and `gap` — not per-element margins that collapse or double silently.
- Wide content (tables, code blocks, diagrams) gets `overflow-x: auto` on **its own container**, so the page body never scrolls sideways.
- Stack to a single column under ~620px.

## 7. Structure is information

Numbering, eyebrows, dividers, swatches, and labels must each encode something true about the content.

Numbered markers (01 / 02 / 03) are correct only when the content really is a sequence — a pipeline, a typed timeline, an ordered procedure where order carries meaning the reader needs. For non-sequential sets, use role swatches instead. Question every structural device before you add it.

## 8. When the page is operated, not read

Runbooks, dashboards, and status pages are scanned and acted on, so the craft shifts from typography to information design:

- Summary before detail — what needs attention reads at a glance.
- Encode state in **form** as well as number: a pill, a chip, a severity stripe.
- Anything interactive should look interactive; anything static shouldn't.
- Give sparklines and charts the same care as type — an area fill, a faint grid, an emphasized endpoint.

## 9. Copy

Words are design material. Write from the reader's side of the screen — name things by what people recognize, not by how the system is built. Active voice. A control says exactly what happens ("Publish", then "Published"). Errors state what went wrong and how to fix it — no apologies, no vagueness. Specific beats clever.

## 10. Avoid the AI-default look

Current AI-generated design clusters around a handful of looks. Where nothing is specified, don't spend the freedom on one of them:

- Warm cream (`#F4F1EA`) + serif display + terracotta accent
- Near-black with a lone acid-green or vermilion pop
- Broadsheet hairline rules with dense columns
- Purple-to-blue gradient hero on white
- Inter or Space Grotesk as the "safe" face
- Emoji as section markers
- Everything centered
- `rounded-lg` everywhere
- An accent bar/rail on rounded cards

The identity in `design-system.md` — sharp 3px corners, mono-forward type, role encoded as a tag plus square swatch rather than a rail — exists specifically to sidestep these. Where the user pins a direction, follow it exactly; their words win, including when they ask for one of the looks above.

## 11. Build hygiene

- **Self-contained:** inline all CSS and JS, no external requests, assets as data URIs.
- Close every non-void element; double-quote every attribute.
- Watch selector specificity — it's easy to generate classes that cancel each other out (a `.section` rule fighting a `.card` rule over the same padding). Structure the cascade so it doesn't silently undo your spacing.
- Give keyboard focus a visible state.
- Respect `prefers-reduced-motion: reduce` — show everything, skip the transition.
- Reach for Canvas or WebGL for generative or decorative graphics rather than hand-authoring long SVG path data.
- Set `<title>`; use an emoji favicon.

## 12. Plan before code

Sketch a compact token plan first, then build from it — deriving every color and type decision from the plan:

- **Color** — 4–6 named hex values.
- **Type** — faces for 2+ roles: headings/data, body, and a utility role for captions if needed.
- **Layout** — the layout concept in one or two sentences.

For this skill the plan starts from `design-system.md` and is **adapted**: the one bold accent goes to the subject's conceptual crux, and the role hues map to the subject's own categories. Before building, check the plan against the subject — if any part of it reads like the generic default you'd produce for any similar page, revise that part and note what changed.

## 13. Verify before delivering

Skim the built page against this list:

- [ ] Both themes legible; accent works on both grounds
- [ ] Theme toggle (`data-theme`) overrides the OS preference in both directions
- [ ] No horizontal scroll on the page body at narrow widths
- [ ] No silent font fallback — the intended stack is actually rendering
- [ ] Keyboard focus visible
- [ ] Reduced-motion path shows all content
- [ ] No external requests, no placeholder text left behind

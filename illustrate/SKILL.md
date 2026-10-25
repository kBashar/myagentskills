---
name: illustrate
description: Use when asked to create an image, illustration, cover or hero image, blog thumbnail, social card, link preview (og:image), or X or LinkedIn profile banner from some context - a post, a doc, a site, or a description - including "in the style of" a named site or brand ("in line with the Claude blog's aesthetic"), images that carry a site name, and colour, size, or design variants of an image made this way. Draws vector illustrations as SVG with code and renders them to PNG, so it needs no image-generation API.
---

# illustrate

## Overview

Turn the context the user gives into one or more illustrations:
1. Study the style they point to.
2. Pick one concrete idea per image.
3. Draw it as SVG with code and render it to PNG.
4. Look at the result before handing it over.

Everything is drawn as vector shapes, so flat, line-art, hand-drawn and geometric styles work well. Photographic or painterly styles can't be reproduced this way. If the reference is one of those, say so and offer the closest vector style before drawing.

The Claude blog style is stored in `references/claude-blog.md`, so it needs no browsing.

## Inputs

| Input | When not given |
|---|---|
| **Context:** a file, pasted text, a URL, or a description of what the image is for | Required. Ask for it |
| **Style reference:** a site, page URLs, a brand, an existing image, or a sketch | Ask once. If the user has no preference, use the Claude blog style in `references/claude-blog.md` |
| **How many, and for what:** a cover, one per section, a set for several platforms | One cover image |
| **Size** | 1200×630. See [Formats](#formats) for the other platforms |
| **Colours** | Taken from the reference. See "Colours" below |
| **Output folder** | Next to the context file, or the current directory for pasted context |
| **File name** | `<context file name>-<purpose>`, such as `claude-certification-cover.svg` and `.png` |

**Colours.** When the user names a colour by reference, such as "my site's primary colour", find the hex value in that site's source. Look for CSS custom properties such as `--accent` or `--primary`, or a Tailwind or theme config. Tell the user where you found it. If you can't find it, ask for the hex value. Never guess it.

Ask about everything that's missing in one message, not one question at a time.

### Formats

| Use | Size | What the platform covers or crops |
|---|---|---|
| Blog cover, link preview (Open Graph), LinkedIn link post | 1200×630 | Some apps crop it to a centred square |
| X header | 1500×500 | The profile photo covers the lower left. Some screens crop the top and bottom |
| LinkedIn background (profile cover) | 1584×396 | The profile photo covers the left. The mobile app crops the sides |
| Square social post | 1080×1080 | |
| 16:9 hero | 1600×900 | |

"A cover for X and LinkedIn" means the two profile banners. Say which sizes you're making, and offer the 1200×630 link preview as well.

## Rules

- **No text in the image** (no title, letters or numbers) unless the user asks for it. The platform shows the title next to the image anyway, and drawn lettering rarely matches the style. When the user asks for text, such as a site name, follow "Text" in step 3.
- **No logos, and nothing that looks like an official badge, certificate, or asset** of a brand the context mentions, even while matching that brand's style. A personal post must not pass for an official one.
- **Match the style, don't copy an illustration.** Take the palette, line quality and composition from the references, and draw your own subject.
- **Keep the workspace in the scratchpad:** reference screenshots, downloads, drafts and the generator script. Only the final files go to the output folder. Never modify the context file.

## Workflow

Steps 2–5 take dozens of screenshots and image reads. If you can spawn subagents, run those steps in a background subagent. Give it:
- this skill's path, and the inputs above with their values filled in
- the chosen idea and one or two fallback ideas
- the output paths

Ask it to follow steps 2–5 and report as in step 6. Otherwise, run the steps yourself.

Send each revision the user asks for to the same subagent (with SendMessage, or your harness's equivalent), not a new one: it already has the generator, the seed and the style notes. Pass on the user's own words, any image they sent, and how you read them.

`scripts/` is in this skill's directory. Call the scripts by their absolute path.

### 1. Read the context and pick the idea

Read all of it. Note 2–4 candidate ideas: concrete objects or moments from the content, not abstractions. For a post about timed exam practice, that could be a stopwatch, or a stack of ticked practice sheets. Pick the one a reader would connect to the content at a glance. Plan 1–3 objects per image.

If the user asks for an abstract image, still build it from motifs in the content, so it isn't generic. For someone's IoT and AI-knowledge work, that could be a signal wave running into a network of nodes.

For a set of images, give each image its own idea and use the same style for all of them. A set of the same image for several platforms keeps one idea, as in [Variants](#variants).

### 2. Study the style

Skip this step when there is no reference.

- **The Claude blog, claude.com, Anthropic, or "Claude's aesthetic":** read `references/claude-blog.md` and use it as your style notes. Don't browse the site. The file says when to study the site again.
- **A sketch or photo from the user:** copy it into `<scratchpad>/ref/` and view it. Zoom in on corners, line ends and any hatching. Follow its structure and proportions, but draw it in the image's line style.
- **Another site:**
  - **Screenshots.** Open the reference pages with a browser tool (chrome-devtools-axi, Chrome DevTools MCP or Playwright) at a desktop viewport (1440×1000, scale 1). Screenshot the illustrations into `<scratchpad>/ref/` and view them with Read.
  - **Colour tokens.** List the site's CSS custom properties that hold colours with the browser's eval. Design systems name their palette there.
  - **Inline SVG.** If the illustrations are inline SVG, list the `fill` and `stroke` values of the large `<svg>` elements with the browser's eval. That gives the exact palette.
  - **Preview images.** Download the preview images of 6–10 articles, then view them together and sample their colours:

    ```bash
    bash scripts/fetch-og.sh <scratchpad>/ref/og <article-url> <article-url> ...
    python3 -I scripts/imgtool.py sheet <scratchpad>/ref/sheet.png <scratchpad>/ref/og/*
    python3 -I scripts/imgtool.py palette <scratchpad>/ref/og/*
    ```

- **Write the style notes** to `<scratchpad>/style-notes.md`, in the shape of `references/claude-blog.md`:
  - background colours as hex values, and how often each appears
  - the fill palette and the line colour
  - line weight at your target width, and its character: stroke or filled shape, taper, wobble, a fill offset from its outline
  - composition: how many objects, how much of the height they fill, how much empty space
  - recurring motifs, and whether there is any text

  If the site mixes styles (photos in one section, line art in another), say which one you follow and why.

### 3. Draw

- **Hand-drawn line styles:** copy `scripts/handdrawn.py` to `<scratchpad>/scripts/`. Set `W`, `H`, the palette constants, `TITLE` and `DESC`, then replace `scene()`. It provides:
  - `ink(points, w, taper, wob)`: a filled, variable-width line with round ends
  - `paper(points)`: a fill shape with irregular edges
  - `rect_pts` and `rect_stroke`: rectangles, the stroke overlapping where it starts
  - `blob_circle`: a slightly lumpy circle or arc
  - `rot`: rotates a set of points
  - `text_paths`: text as glyph outlines (see "Text" below)

  Shifting a fill a few pixels off its outline gives a misregistered-print look. Shift every fill in the same direction, as if one print plate slipped.

  Run it as `python3 -I <copy> <out.svg> <seed> [background-hex]`. The seed fixes every random wobble, so the same seed redraws the same picture.
- **Flat or geometric styles:** write the SVG directly, or with a short script.
- **Either way:**
  - Make the background a single `<rect>` that comes first, so a colour variant changes one attribute.
  - Use plain shapes only: no filters, web fonts or external references. Renderers handle those differently.
  - Give the SVG a `<title>` and `<desc>`, so it has alt text.
- **Text,** only when the user asks for it:
  - **Font:** use the font of the user's site or brand. Find its `@font-face` rule in the site's CSS, and the font file it loads. If there is none, ask.
  - **Glyphs as shapes:** draw the text with `text_paths()`. It turns the glyphs into filled paths, so the SVG needs no font and renders the same everywhere. It needs `fonttools`, plus `brotli` for `.woff2` files.
  - **Weight:** pick the font weight whose stems are about as thick as the ink lines, and use the site's letter-spacing.
  - **Tie it to the drawing.** Clean type looks typeset next to hand-drawn lines. Put it in a hand-drawn box, or let a line from the drawing run into it. Don't distort the glyphs.
  - **Size it for where it's seen.** On a phone a banner is shown about 390 px wide, so its text needs to be larger than on a 1200×630 preview.
- **Flips:** mirror the geometry in the generator, for example by mapping each point to `(W - x, y)`. Never mirror the whole image with an SVG transform: that also mirrors any text and reverses the direction of the fill offsets.

### 4. Render and look

```bash
bash scripts/render-svg.sh <in.svg> <out.png>
```

- View every render with Read.
- Zoom in on details to judge the line quality: `python3 -I scripts/imgtool.py zoom <in.png> <out.png> x0 y0 x1 y1`.
- Check that the idea still reads at the size people see it: `python3 -I scripts/imgtool.py thumb <in.png> <out.png> [width]`. Use 400 px for a feed preview, and 390 px for a banner on a phone.
- For a banner or a link preview, check what the platform covers: `python3 -I scripts/imgtool.py frame <in.png> <out.png> x|linkedin|og`. It greys out the profile photo and marks the crop lines. The positions are approximate, so keep the drawing and any text well clear of them.
- Critique the render against your style notes: palette, line weight, composition, empty space, and whether any shape reads as something else.
- Revise at least once. Then render 3–4 seeds, view them on a contact sheet, and pick the best.

### 5. Save

Write the final `<name>.svg` and `<name>.png` to the output folder. Keep the generator script and the chosen seed in the scratchpad for variants and revisions.

### 6. Report

If a subagent drew the image, open the final PNG yourself before you report. Then tell the user:

- what the image shows, and what each element stands for in the context
- how it matches the style, with the hex values used
- the size and the file paths, and for a banner, that you checked the profile-photo and crop zones
- honest shortcomings: a motif you left out, wobble that looks computer-generated up close, a shape that could be misread
- 2–3 concrete options for changes: another background from the reference palette, an added element, or a different idea

## Revisions

Users usually take an image through several rounds, such as "flip it", "smaller text", "two variations" or "a looser box". Each round:

- **Back up first.** Copy the generator and the current outputs into the scratchpad before you change anything, so you can show before and after on one contact sheet.
- **Add each change as an option of the generator** (a command-line switch) instead of editing the drawing in place. Then the same seed and arguments still redraw every earlier version byte-for-byte. Check with `cmp` that the files you didn't mean to change haven't changed.
- **Change only what the user asked for.** When their words could mean two things, make both and say which is which.
- **Name variations by what differs,** such as `<name>-ink.svg` and `<name>-teal.svg`, and show them side by side.
- **When the user picks one,** generate the deliverables from the generator with the chosen arguments. Confirm with `cmp` that they match the file the user picked.

## Variants

**Colour.** A colour variant differs from the original only in that colour. Re-run the generator with the same seed and the new colour, or change the `fill` of the background `<rect>`. Diff the new SVG against the original to confirm that nothing else changed, then render it and look at it. Save it beside the original as `<name>-<variant>.svg` and `.png`, and keep the original. If the user rejects a variant you made, remove its files and say so. Mention anything that reads differently on the new colour, such as an unfilled area that now looks like a chart.

**Size.** Change `W` and `H`, then re-place the objects for the new frame and render again. Never stretch the old image.
- **Weights:** scale line weights with the objects. If text grows by 20%, the box around it and its outline grow by 20% too.
- **A set for several platforms:** use the same seed, palette and options for every size, so the set reads as one picture. Fit each layout to that platform's covered and cropped zones (see [Formats](#formats)).

## Common mistakes

- **Guessing a colour from a vague reference.** Asked for "the site's primary colour", an agent picked the reference blog's brand orange. The user meant their own site's teal, `#069494`, defined as `--accent` in the site's CSS.
- **Judging only the full-size render.** Wobble and joins look fine at full size and wrong up close, and some ideas vanish at thumbnail size.
- **An idea that needs a caption.** If the image only makes sense once someone explains it, pick a more concrete object.
- **Adding a title or a number to explain the image.** Use no text unless the user asked for it.
- **Scaling the text but not its box.** On the banner versions of a link preview, an agent made the site name bigger but kept the box outline the same width. The outline then looked thin next to the preview's.
- **Putting the subject where the profile photo goes.** On X and LinkedIn the photo covers the lower left of the banner. Check with `imgtool.py frame`.
- **Browsing the Claude blog again.** Its style is in `references/claude-blog.md`.

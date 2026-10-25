# Claude blog style

Studied on 2026-10-25 from claude.com/blog, which redirects to claude.com/resources/articles. The sources were three page screenshots at 1440×1000, the colour custom properties in the site's CSS, and the preview images (`og:image`, 2400×1260) of nine articles. Use these notes as your style notes instead of fetching the site.

anthropic.com/news shares the brand, but most of its preview images are the wordmark on ivory or photo collages. Don't follow those.

## Palette

From claude.com's CSS custom properties.

| Role | Hex | Token |
|---|---|---|
| Ink, the only line colour | `#141413` | `--color-gray-950` |
| Paper, for cut-out fills | `#FAF9F5` | `--color-gray-050`, also the page background |
| Card background | `#F5F4ED` | `--color-gray-100` |

The backgrounds of the nine article previews:

| Background | Hex | Token | Previews |
|---|---|---|---|
| Peach | `#EBC9B7` | `--color-peach` | 5 of 9 |
| Heather | `#CBCADB` | `--color-heather` | 2 |
| Cactus | `#BCD1CA` | `--color-cactus` | 1 |
| Warm grey | `#DEDCD1` | `--color-gray-250` | 1 |

Other named colours:
- **Clay `#D97757`** (`--color-clay`): the Claude orange. One preview uses it, as a solid blob.
- **Plum `#827DBD`, sky `#6A9BCC`, mineral `#629987`:** defined in the site's CSS. Plum shows up in the decorative stripes on the articles page. None of the three appears in the previews.
- **Light neutrals:** `#F0EEE6` (`gray-150`), `#E8E6DC` (`gray-200`) and `#D1CFC5` (`gray-300`).

Each preview is flat: ink, paper and one background colour, sometimes with one accent shape. Ink covers only 1–3% of the pixels.

Constants for `scripts/handdrawn.py`:

```python
BG = '#EBC9B7'      # or heather #CBCADB, cactus #BCD1CA, warm grey #DEDCD1
INK = '#141413'
PAPER = '#FAF9F5'
ACCENT = '#D97757'  # replace with the user's colour when they give one
```

## Line

- **Weight:** ink lines are filled shapes about 1% of the image width: 16–30 px at 2400 wide, so 8–15 px at 1200 (`ink(w=...)`). Simple, bold motifs like the lightning bolt and the scribble use the heavy end. Detailed ones like the laptop and the hand with blocks use the light end.
- **Character:** round ends, slightly uneven width, mildly rough edges and little wobble. They look drawn with a felt-tip marker, not ruled.
- **Hands:** one continuous line, with fingers as tight loops or zigzags and no fill. The hand comes into the motif from one side.
- **Rectangles** such as bricks, a laptop or a sheet: the corners overlap or overshoot a little.

## Fills

- **Paper cut-outs carry most of each shape:** ivory polygons with slightly torn edges and no outline, behind the ink.
- **Ink doesn't trace the cut-outs.** Where an object has both a fill and an outline, the fill sits a few pixels off the outline, like a misaligned print. Offset every fill in the same direction.
- **Accent:** one shape at most, a lumpy blob without an outline with an ink line drawn across it.

## Composition

Measured on the nine previews:
- **Layout:** one motif, sometimes two objects that touch, centred exactly.
- **Size:** the motif fills 52–72% of the height (usually about 70%) and 27–38% of the width.
- **Empty space:** the rest is plain background, with no frame, shadow, gradient, texture or text.

## Motifs

| Preview | Background |
|---|---|
| An ivory lightning-bolt cut-out with a zigzag path of four ink nodes on it | cactus |
| An ivory rounded-square tile like an app icon, with a clay blob and a looping ink scribble across it | heather |
| An easel holding a paper canvas with a looping scribble | peach |
| A hand placing a paper card onto an ink brick wall | peach |
| A padlock: paper body, ink shackle and keyhole | peach |
| A hand setting a paper lintel on two paper pillars, with no outlines on the blocks | warm grey |
| A laptop outline with a paper screen and an ink keyhole | peach |
| Torn paper fragments joined by an ink path of nodes | heather |
| A paper starburst badge with an ink tick, held in an ink hand | peach |

Recurring meanings:
- **Hands placing or holding something:** agency, building.
- **Nodes joined by lines:** agents, networks.
- **Looping scribbles:** thinking, writing.
- **Locks and keyholes:** security.
- **Stacked blocks:** building.

**Nodes** are solid, lumpy ink dots about twice the line width (60–70 px at 2400 wide), joined by nearly straight lines. If you draw hollow nodes (a ring with a fill), draw the links first. Then put a background-coloured disc inside each ring, so the link ends don't show through.

## On the site

- **Article cards in the listing:** the motif sits on the card's `#F5F4ED`, and the cut-out takes the preview's background colour, such as a cactus bolt or a peach card. It's the preview with its colours inverted.
- **Article header:** the motif sits in a rounded-square tile of the background colour, about 176 px wide with large rounded corners.
- **Text:** headings are set in a serif and body text in a sans. The preview images carry no text.

## With another accent colour

When the user wants the Claude look in their own colour, for example their site's teal:
- **Background:** keep the ink and the paper, and use a light neutral background (`#F0EEE6` or `#E8E6DC`), so the colour reads as an accent and doesn't fill the whole image. Don't use clay.
- **Accent:** use their colour where Claude uses clay: one or two fills, each offset from its outline.

This worked for a personal site: teal `#069494` node fills and a teal box band on `#F0EEE6`, with ink `#141413` and paper `#FAF9F5`.

## Seeing the style without fetching

The example scene in `scripts/handdrawn.py` is drawn in this style: practice sheets and a stopwatch on peach. Render it to see the target:

```bash
python3 -I scripts/handdrawn.py <scratchpad>/example.svg
bash scripts/render-svg.sh <scratchpad>/example.svg <scratchpad>/example.png
```

## When to study the site again

Study the site again, as in step 2 of `SKILL.md`, only when one of these applies:
- the user says the blog looks different now
- the request needs a motif these notes don't cover

Start from `https://claude.com/resources/articles`, and download the article previews with `fetch-og.sh`. Tell the user what has changed, so they can update this file.

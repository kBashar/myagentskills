"""Draw a hand-drawn style SVG illustration.

usage: python3 -I handdrawn.py <out.svg> [seed] [background-hex]

A template: copy it to the scratchpad, set the size and palette from the
reference style, and replace scene() with the new drawing. The example scene
is a stack of ticked practice sheets next to a stopwatch, laid out for
1200x630.

Ink lines are filled, variable-width outlines rather than SVG strokes, with a
low-frequency wobble on the centreline and slight roughness on the edges.
Paper shapes are polygons with irregular, torn-looking edges. Every random
choice comes from the seed, so the same seed redraws the same picture and
only the arguments you change differ.

text_paths() draws text, when the user asks for some, as glyph outlines
from a font file. It needs fontTools (pip install fonttools brotli).
"""
import math
import random
import re
import sys

W, H = 1200, 630
BG = sys.argv[3] if len(sys.argv) > 3 else '#EBC9B7'
INK = '#141413'
PAPER = '#FAF9F5'
ACCENT = '#D97757'
TITLE = 'Practice sheets and a stopwatch'
DESC = ('Hand-drawn illustration: a small stack of paper sheets with three ticked items, '
        'next to a stopwatch whose dial is three quarters elapsed.')

rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 11)


# ---------------------------------------------------------------- helpers
class Noise:
    """Smooth 1-D noise: a few sines with random phase/frequency."""

    def __init__(self, amp, wl, n=3):
        terms = []
        for k in range(n):
            a = rng.uniform(0.5, 1.0) / (k + 1)
            f = 2 * math.pi / (wl / (k + 1.3) * rng.uniform(0.8, 1.25))
            terms.append([a, f, rng.uniform(0, 2 * math.pi)])
        norm = sum(t[0] for t in terms)
        self.terms = [(a * amp / norm, f, p) for a, f, p in terms]

    def __call__(self, s):
        return sum(a * math.sin(f * s + p) for a, f, p in self.terms)


def dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def resample(pts, step):
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + dist(pts[i - 1], pts[i]))
    total = cum[-1]
    n = max(2, int(total / step) + 1)
    out = []
    j = 0
    for k in range(n):
        s = total * k / (n - 1)
        while j < len(cum) - 2 and cum[j + 1] < s:
            j += 1
        seg = cum[j + 1] - cum[j]
        t = 0 if seg == 0 else (s - cum[j]) / seg
        a, b = pts[j], pts[j + 1]
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def catmull(pts, samples=14):
    """Catmull-Rom spline through the given points (open curve)."""
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(samples):
            t = k / samples
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(pts[-1])
    return out


def rot(pts, cx, cy, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def arc(cx, cy, r, a0, a1, step_deg=3, rx=None, ry=None):
    rx = rx or r
    ry = ry or r
    n = max(2, int(abs(a1 - a0) / step_deg))
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * k / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def normals(p):
    ns = []
    for i in range(len(p)):
        a = p[max(0, i - 1)]
        b = p[min(len(p) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        l = math.hypot(tx, ty) or 1
        ns.append((-ty / l, tx / l))
    return ns


def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def fmt(pts):
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'


# ---------------------------------------------------------------- primitives
def ink(pts, w=10.0, var=0.22, wob=1.4, wl=80, taper=(0, 0), tmin=0.35,
        rough=0.22, spline=True, step=1.5, color=None):
    """Variable-width hand-drawn line through pts, as a filled outline path.

    w: line width in px. var: width variation. wob/wl: centreline wobble
    amplitude and wavelength. taper: lengths over which the start and end thin
    down to tmin of the width. rough: edge roughness.
    """
    base = catmull(pts) if spline else pts
    p = resample(base, step)
    ns = normals(p)
    s = [0.0]
    for i in range(1, len(p)):
        s.append(s[-1] + dist(p[i - 1], p[i]))
    L = s[-1]
    nz = Noise(wob, wl)
    q = [(x + nx * nz(si), y + ny * nz(si)) for (x, y), (nx, ny), si in zip(p, ns, s)]
    ns = normals(q)
    wz = Noise(var, 55, 4)
    rz1, rz2 = Noise(rough, 26, 2), Noise(rough, 31, 2)
    left, right, ws = [], [], []
    for (x, y), (nx, ny), si in zip(q, ns, s):
        f = 1 + wz(si)
        if taper[0]:
            f *= tmin + (1 - tmin) * smoothstep(si / taper[0])
        if taper[1]:
            f *= tmin + (1 - tmin) * smoothstep((L - si) / taper[1])
        hw = w * f / 2
        ws.append(hw)
        left.append((x + nx * (hw + rz1(si)), y + ny * (hw + rz1(si))))
        right.append((x - nx * (hw + rz2(si)), y - ny * (hw + rz2(si))))

    def cap(c, n, hw, forward):
        tx, ty = (n[1], -n[0])  # tangent from normal
        if not forward:
            tx, ty = -tx, -ty
            n = (-n[0], -n[1])
        out = []
        for k in range(1, 12):
            ph = math.pi * k / 12
            out.append((c[0] + hw * (math.cos(ph) * n[0] + math.sin(ph) * tx),
                        c[1] + hw * (math.cos(ph) * n[1] + math.sin(ph) * ty)))
        return out

    poly = left + cap(q[-1], ns[-1], ws[-1], True) + right[::-1] + cap(q[0], ns[0], ws[0], False)
    return f'<path d="{fmt(poly)}" fill="{color or INK}"/>'


def paper(pts, color=None, bow=1.6, jit=0.55, step=4):
    """Closed fill shape with slightly torn, irregular edges."""
    closed = list(pts) + [pts[0]]
    p = resample(closed, step)[:-1]
    ns = normals(p + [p[0]])[:-1]
    n1, n2 = Noise(bow, 160), Noise(jit, 14, 2)
    out = []
    for i, ((x, y), (nx, ny)) in enumerate(zip(p, ns)):
        d = n1(i * step) + n2(i * step) + rng.gauss(0, jit * 0.12)
        out.append((x + nx * d, y + ny * d))
    return f'<path d="{fmt(out)}" fill="{color or PAPER}"/>'


def rect_pts(cx, cy, w, h, deg=0, corner=6):
    """Rectangle outline points with slightly rounded corners, clockwise from top-left."""
    x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
    c = corner
    pts = [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]
    return rot(pts, cx, cy, deg)


def rect_stroke(cx, cy, rw, rh, deg=0, corner=8, overshoot=14, **kw):
    """Rectangle drawn as one continuous stroke that overlaps where it starts."""
    x0, y0, x1, y1 = cx - rw / 2, cy - rh / 2, cx + rw / 2, cy + rh / 2
    c = corner
    pts = [(x0 + c * 2, y0 + 1.5)]
    pts += [(x1 - c, y0)] + arc(x1 - c, y0 + c, c, -90, 0, 15)[1:]
    pts += [(x1 + 1, y1 - c)] + arc(x1 - c, y1 - c, c, 0, 90, 15)[1:]
    pts += [(x0 + c, y1 + 0.5)] + arc(x0 + c, y1 - c, c, 90, 180, 15)[1:]
    pts += [(x0 - 1, y0 + c)] + arc(x0 + c, y0 + c, c, 180, 270, 15)[1:]
    pts += [(x0 + c + overshoot, y0 - 2.5)]
    pts = resample(pts, 6)
    return ink(rot(pts, cx, cy, deg), spline=False, **kw)


def blob_circle(cx, cy, r, amp=2.5, step=4, a0=0, a1=360):
    """Points on a slightly lumpy circle or arc, from angle a0 to a1 in degrees."""
    nz = Noise(amp, 260, 3)
    pts = []
    n = int(abs(a1 - a0) / step)
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        rr = r + nz(a * r * math.pi / 180)
        pts.append((cx + rr * math.cos(math.radians(a)), cy + rr * math.sin(math.radians(a))))
    return pts


# ---------------------------------------------------------------- text
def kerning(font, names):
    """Pair kerning (x-advance) of adjacent glyphs, from the font's GPOS pair tables."""
    pairs = {}
    if 'GPOS' not in font:
        return pairs
    for lk in font['GPOS'].table.LookupList.Lookup:
        for st in lk.SubTable:
            if lk.LookupType == 9:
                st = st.ExtSubTable
            if getattr(st, 'LookupType', lk.LookupType) != 2:
                continue
            cov = st.Coverage.glyphs
            for a, b in zip(names, names[1:]):
                if a not in cov or (a, b) in pairs:
                    continue
                v = None
                if st.Format == 1:
                    for r in st.PairSet[cov.index(a)].PairValueRecord:
                        if r.SecondGlyph == b:
                            v = r.Value1
                else:
                    c1 = st.ClassDef1.classDefs.get(a, 0)
                    c2 = st.ClassDef2.classDefs.get(b, 0)
                    v = st.Class1Record[c1].Class2Record[c2].Value1
                if getattr(v, 'XAdvance', 0):
                    pairs[(a, b)] = v.XAdvance
    return pairs


def text_paths(txt, font, size, x, y, wght=None, track=0.0, anchor='start', align='base',
               color=None, colors=None, deg=0, pivot=None):
    """Text as filled glyph outlines, so the SVG needs no font and renders the same everywhere.

    font: a .ttf, .otf, .woff or .woff2 file (woff2 needs the brotli module).
    wght: the weight of a variable font. track: letter-spacing in em, as in CSS.
    anchor: x is the left ('start') or right ('end') edge of the ink.
    align: y is the baseline ('base'), the middle of the x-height ('mid') or the
    middle of the ink ('box'). colors: one colour per character, instead of color.
    deg, pivot: rotate the text deg degrees about pivot, as rot() does.
    Returns the <path> elements and the ink box (x0, y0, x1, y1) before rotation.
    """
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont

    f = TTFont(font)
    cmap = f.getBestCmap()
    missing = ''.join(c for c in txt if ord(c) not in cmap)
    if missing:
        sys.exit(f'{font} has no glyph for {missing!r}')
    names = [cmap[ord(c)] for c in txt]
    kern = kerning(f, names)
    if wght is not None and 'fvar' in f:
        from fontTools.varLib import instancer
        for tag in ('GPOS', 'GDEF'):  # older instancers fail on some GPOS tables; kerning is read above
            if tag in f:
                del f[tag]
        f = instancer.instantiateVariableFont(f, {'wght': wght})
    gs = f.getGlyphSet()
    upm = f['head'].unitsPerEm
    sc = size / upm
    advs = []
    for i, n in enumerate(names):
        a = f['hmtx'][n][0]
        if i + 1 < len(names):
            a += kern.get((n, names[i + 1]), 0) + track * upm
        advs.append(a)

    bp = BoundsPen(gs)  # ink bounds, so the visible edges of the glyphs meet x and y
    pen_x = 0
    for n, a in zip(names, advs):
        gs[n].draw(TransformPen(bp, (1, 0, 0, 1, pen_x, 0)))
        pen_x += a
    xmin, ymin, xmax, ymax = bp.bounds
    ox = x - xmin * sc if anchor == 'start' else x - xmax * sc
    if align == 'mid':
        base = y + f['OS/2'].sxHeight * sc / 2
    elif align == 'box':
        base = y + (ymax + ymin) * sc / 2
    else:
        base = y

    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    px, py = pivot or (x, y)
    groups = {}
    pen_x = 0
    for i, (n, a) in enumerate(zip(names, advs)):
        tx, ty = ox + pen_x * sc, base
        sp = SVGPathPen(gs)
        gs[n].draw(TransformPen(sp, (sc * c, sc * s, sc * s, -sc * c,
                                     px + (tx - px) * c - (ty - py) * s, py + (tx - px) * s + (ty - py) * c)))
        groups.setdefault(colors[i] if colors else color or INK, []).append(sp.getCommands())
        pen_x += a

    def short(m):
        return f'{float(m.group()):.2f}'.rstrip('0').rstrip('.')

    out = []
    for col, ds in groups.items():
        d = re.sub(r'-?\d+\.\d+', short, ' '.join(ds))
        out.append(f'<path d="{d}" fill="{col}"/>')
    return out, (ox + xmin * sc, base - ymax * sc, ox + xmax * sc, base - ymin * sc)


# ---------------------------------------------------------------- scene
def scene():
    """Example scene. Replace it; keep the background rect first."""
    out = [f'<rect width="{W}" height="{H}" fill="{BG}"/>', '<g transform="translate(-48 -26) scale(1.08)">']

    # --- stack of practice sheets ------------------------------------
    scx, scy, sw, sh, sdeg = 500, 318, 236, 306, -4
    # back sheets: paper only, peeking out
    out.append(paper(rect_pts(scx + 30, scy - 8, sw, sh, 5, 3)))
    out.append(paper(rect_pts(scx - 24, scy + 6, sw, sh, -11, 3)))
    # top sheet: paper fill misregistered against its outline
    out.append(paper(rect_pts(scx - 13, scy - 12, sw - 4, sh - 2, sdeg + 0.8, 3)))
    out.append(rect_stroke(scx, scy, sw, sh, sdeg, corner=7, w=10))

    def L(x, y):
        return rot([(scx + x, scy + y)], scx, scy, sdeg)[0]

    rows = [-78, -2, 74]
    lens = [86, 64, 76]
    for ry, ln in zip(rows, lens):
        bx = -86
        j = rng.uniform(-2, 2)
        tick = [L(bx, ry - 4 + j), L(bx + 9, ry + 6), L(bx + 16, ry + 13),
                L(bx + 27, ry - 4), L(bx + 40, ry - 24), L(bx + 52 + j, ry - 38)]
        out.append(ink(tick, w=12, wob=1.0, taper=(6, 32), tmin=0.3))
        x0 = -16
        line = [L(x0, ry + 2), L(x0 + ln * 0.5, ry + 1 + rng.uniform(-2, 2)), L(x0 + ln, ry + 2)]
        out.append(ink(line, w=9, wob=1.0, taper=(0, 14), tmin=0.55))

    # --- stopwatch -----------------------------------------------------
    cx, cy, r = 778, 374, 114
    out.append(f'<g transform="rotate(7 {cx} {cy})">')
    # elapsed-time wedge (three quarters of the dial) as an off-register paper cut-out
    wcx, wcy = cx + 6, cy + 4
    wedge = [(wcx, wcy)] + blob_circle(wcx, wcy, r - 4, 2.5, 4, -90, 180)
    out.append(paper(wedge, bow=1.0, jit=0.4))
    # body outline: one stroke, overlapping where it began
    nz = Noise(1.3, 300, 3)
    body = [(cx + (r + nz(a * 1.4)) * math.cos(math.radians(a)) * 1.015,
             cy + (r + nz(a * 1.4)) * math.sin(math.radians(a)) * 0.985) for a in range(-84, 284, 4)]
    out.append(ink(body, w=11, wob=1.6, wl=150, taper=(16, 30), tmin=0.45))
    # crown stem + button
    out.append(ink([(cx - 11, cy - r + 3), (cx - 12, cy - r - 20)], w=9, wob=0.6))
    out.append(ink([(cx + 11, cy - r + 3), (cx + 13, cy - r - 20)], w=9, wob=0.6))
    out.append(paper(rect_pts(cx - 6, cy - r - 35, 54, 20, -3, 6), bow=0.6))
    out.append(rect_stroke(cx, cy - r - 31, 60, 22, 2, corner=8, overshoot=10, w=9, wob=0.8))
    # side button
    a = math.radians(-45)
    out.append(ink([(cx + (r + 5) * math.cos(a), cy + (r + 5) * math.sin(a)),
                    (cx + (r + 25) * math.cos(a) + 1, cy + (r + 25) * math.sin(a))], w=15, wob=0.4))
    # a single mark at twelve
    out.append(ink([(cx + 1, cy - 99), (cx, cy - 85)], w=8, wob=0.3))
    # hand pointing at nine o'clock, plus hub
    out.append(ink([(cx + 3, cy + 1), (cx - 38, cy - 2), (cx - 80, cy + 1)], w=9, wob=0.8, taper=(0, 22), tmin=0.5))
    out.append(paper(blob_circle(cx, cy, 10, 0.6, 20)[:-1], color=INK, bow=0.4, jit=0.3, step=2))

    out.append('</g>')
    out.append('</g>')
    return '\n'.join(out)


if len(sys.argv) < 2:
    sys.exit(__doc__.strip().splitlines()[2])

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d">
<title id="t">{TITLE}</title>
<desc id="d">{DESC}</desc>
{scene()}
</svg>
'''
open(sys.argv[1], 'w').write(svg)

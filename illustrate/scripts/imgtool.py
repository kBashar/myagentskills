"""Small image helpers for studying a reference style and checking renders. Needs Pillow.

usage:
  python3 -I imgtool.py palette <image>...                         dominant colours of each image
  python3 -I imgtool.py sheet <out.png> <image>...                 contact sheet, two images per row
  python3 -I imgtool.py zoom <in.png> <out.png> <x0> <y0> <x1> <y1> [scale]
                                                                   crop a region and enlarge it (scale 2)
  python3 -I imgtool.py thumb <in.png> <out.png> [width]           shrink to feed-thumbnail size (400 px)
  python3 -I imgtool.py frame <in.png> <out.png> x|linkedin|og    grey out the profile photo, mark crop lines
"""
import os
import sys
from collections import Counter

from PIL import Image, ImageDraw, ImageOps

USAGE = __doc__.split('usage:')[1].rstrip()


def palette(paths):
    for p in paths:
        im = Image.open(p).convert('RGB')
        w, h = im.size
        small = im.resize((max(1, w // 4), max(1, h // 4)))
        total = small.width * small.height
        top = Counter(small.getdata()).most_common(6)
        cols = ' '.join('#%02X%02X%02X %.0f%%' % (r, g, b, 100 * n / total) for (r, g, b), n in top)
        print(f'{os.path.basename(p)} {w}x{h}  {cols}')


def sheet(out, paths, cw=600, ch=315):
    rows = (len(paths) + 1) // 2
    canvas = Image.new('RGB', (cw * 2, ch * rows), 'white')
    for k, p in enumerate(paths):
        im = ImageOps.pad(Image.open(p).convert('RGB'), (cw, ch), color='white')
        canvas.paste(im, ((k % 2) * cw, (k // 2) * ch))
    canvas.save(out)
    print(out)


def zoom(src, out, x0, y0, x1, y1, scale=2.0):
    im = Image.open(src).crop((x0, y0, x1, y1))
    im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS).save(out)
    print(out)


def thumb(src, out, width=400):
    im = Image.open(src)
    im.resize((width, round(im.height * width / im.width)), Image.LANCZOS).save(out)
    print(out)


def frame(src, out, kind):
    """Mark what a platform covers or may crop. The positions are approximate: keep clear of them."""
    im = Image.open(src).convert('RGB')
    w, h = im.size
    d = ImageDraw.Draw(im)
    red = (200, 60, 60)
    if kind == 'og':  # some apps crop link previews to a centred square
        x0 = (w - h) // 2
        d.rectangle((x0, 0, x0 + h - 1, h - 1), outline=red, width=3)
    else:
        nw, nh = (1500, 500) if kind == 'x' else (1584, 396)
        sx, sy = w / nw, h / nh
        cx, cy, r = (210, 470, 170) if kind == 'x' else (250, 400, 210)  # profile photo
        d.ellipse(((cx - r) * sx, (cy - r) * sy, (cx + r) * sx, (cy + r) * sy), fill=(40, 40, 40))
        if kind == 'x':  # some screens crop the top and bottom
            for y in (70, 430):
                d.line((0, y * sy, w, y * sy), fill=red, width=3)
        else:  # the mobile app crops the sides
            for x in (90, 1494):
                d.line((x * sx, 0, x * sx, h), fill=red, width=3)
    im.save(out)
    print(out)


def main(a):
    cmd = a[0] if a else ''
    if cmd == 'palette' and len(a) > 1:
        palette(a[1:])
    elif cmd == 'sheet' and len(a) > 2:
        sheet(a[1], a[2:])
    elif cmd == 'zoom' and len(a) in (7, 8):
        zoom(a[1], a[2], *map(int, a[3:7]), *map(float, a[7:]))
    elif cmd == 'thumb' and len(a) in (3, 4):
        thumb(a[1], a[2], *map(int, a[3:]))
    elif cmd == 'frame' and len(a) == 4 and a[3] in ('x', 'linkedin', 'og'):
        frame(a[1], a[2], a[3])
    else:
        sys.exit('usage:' + USAGE)


main(sys.argv[1:])

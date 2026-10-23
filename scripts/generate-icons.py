from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path('public/icons')
OUT.mkdir(parents=True, exist_ok=True)
S = 2048
AMBER_TOP = (243, 186, 108)
AMBER_BOTTOM = (216, 148, 65)
DARK = (26, 21, 18)
DETAIL = (92, 63, 36)


def gradient(size):
    img = Image.new('RGB', (size, size), AMBER_TOP)
    top = AMBER_TOP
    bottom = AMBER_BOTTOM
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(size):
            px[x, y] = c
    glow = Image.new('L', (size, size), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((size * 0.02, -size * 0.18, size * 1.02, size * 0.9), fill=42)
    white = Image.new('RGB', (size, size), (255, 235, 205))
    img = Image.composite(white, img, glow.point(lambda v: int(v * 0.55)))
    return img


def chair(size, scale, stroke=2.0, detail=1.4):
    img = gradient(size)
    draw = ImageDraw.Draw(img)
    s = size * scale / 40.0
    ox = (size - 40 * s) / 2
    oy = (size - 40 * s) / 2

    def p(x, y):
        return (ox + x * s, oy + y * s)

    lw = max(1, round(stroke * s))
    dw = max(1, round(detail * s))

    # Seat
    x0, y0 = p(9, 21)
    x1, y1 = p(31, 28)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=2.5 * s, outline=DARK, width=lw)

    # Back
    back = [p(14, 21), p(14, 14), p(23, 14), p(26, 17), p(26, 21)]
    draw.line(back, fill=DARK, width=lw, joint='curve')
    for point in (back[0], back[-1]):
        r = lw / 2 - 0.5
        draw.ellipse((point[0] - r, point[1] - r, point[0] + r, point[1] + r), fill=DARK)

    # Legs
    for x in (18, 29):
        a = p(x, 27)
        b = p(x, 32)
        draw.line([a, b], fill=DARK, width=lw)
        for point in (a, b):
            r = lw / 2 - 0.5
            draw.ellipse((point[0] - r, point[1] - r, point[0] + r, point[1] + r), fill=DARK)

    # Inner joinery hint
    draw.line([p(22, 14), p(22, 21)], fill=DETAIL, width=dw)
    draw.line([p(17, 17), p(26, 17)], fill=DETAIL, width=dw)
    return img


def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print('wrote', OUT / name)


base_regular = chair(S, 0.9)
base_maskable = chair(S, 0.72)
save(base_regular, 'icon-512.png', 512)
save(base_regular, 'icon-192.png', 192)
save(base_regular, 'apple-touch-icon.png', 180)
save(base_maskable, 'icon-maskable-512.png', 512)

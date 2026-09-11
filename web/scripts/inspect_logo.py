import sys
from PIL import Image

src = sys.argv[1]
im = Image.open(src)
print("mode:", im.mode, "size:", im.size)
im = im.convert("RGBA")
w, h = im.size
px = im.load()

opaque = transparent = blue = other = 0
minx, miny, maxx, maxy = w, h, 0, 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 16:
            transparent += 1
            continue
        opaque += 1
        minx = min(minx, x); miny = min(miny, y)
        maxx = max(maxx, x); maxy = max(maxy, y)
        if b > 90 and b > r + 40 and b > g + 20:
            blue += 1
        else:
            other += 1

print(f"transparent={transparent} opaque={opaque} blue={blue} other(non-blue opaque)={other}")
print(f"opaque bbox = ({minx},{miny},{maxx},{maxy})")

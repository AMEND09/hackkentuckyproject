"""Make the DART logo background transparent and emit clean brand assets.

The supplied file is the blue dart mark on a solid black field (no alpha).
We key out the black to transparency, trim to the mark, and export it so the
mark can sit directly on any surface with no black plate.

Outputs in web/public/brand/:
  dart-logo.png  — untouched supplied original (blue mark on black)
  dart-mark.png  — trimmed, transparent blue dart mark
  favicon.png    — 128x128 padded transparent favicon
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "brand"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def key_black(img: Image.Image, threshold: int = 40) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = max(r, g, b)
            if m <= threshold:
                px[x, y] = (r, g, b, 0)
            elif m < threshold * 2:
                # feather the anti-aliased rim
                px[x, y] = (r, g, b, int(255 * (m - threshold) / threshold))
    return img


def main(src_path: str) -> None:
    src = Image.open(src_path).convert("RGB")
    src.save(OUT_DIR / "dart-logo.png")

    keyed = key_black(src)
    bbox = keyed.getbbox()
    mark = keyed.crop(bbox) if bbox else keyed
    mark.save(OUT_DIR / "dart-mark.png")

    side = max(mark.size)
    pad = int(side * 0.14)
    canvas = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    canvas.paste(mark, ((canvas.width - mark.width) // 2, (canvas.height - mark.height) // 2), mark)
    canvas.resize((128, 128), Image.LANCZOS).save(OUT_DIR / "favicon.png")
    print(f"mark size={mark.size}")


if __name__ == "__main__":
    main(sys.argv[1])

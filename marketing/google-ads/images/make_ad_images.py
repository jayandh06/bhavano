"""Crop source images into Google Ads image-asset sizes.

Usage: python marketing/google-ads/images/make_ad_images.py

Reads source/*.png and writes out/<name>-square.jpg (1:1) and out/<name>-landscape.jpg (1.91:1).
Google's minimums are 300x300 and 600x314; output is capped at the recommended 1200 px and
never upscaled. See docs/plans/google-ads-image-assets.md.
"""

from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
SRC = HERE / "source"
OUT = HERE / "out"
MAX_BYTES = 5 * 1024 * 1024
LANDSCAPE_RATIO = 1.91
MAX_SIDE = 1200

# Horizontal centre of the subject (0..1) for the square crop; default 0.5.
SQUARE_FOCUS_X = {
    "sell-handshake-keys-documents": 0.46,
    "sell-owner-photographing-balcony": 0.47,
    "generic-couple-photographing-room": 0.52,
}
# Vertical anchor (0 = keep top, 1 = keep bottom) for the landscape crop; default 0.5.
LANDSCAPE_FOCUS_Y = {
    "generic-owner-posting-phone": 0.3,
    "sell-owner-photographing-balcony": 0.3,
}


def crop_box(w: int, h: int, target_ratio: float, fx: float, fy: float) -> tuple[int, int, int, int]:
    if w / h > target_ratio:
        cw, ch = round(h * target_ratio), h
    else:
        cw, ch = w, round(w / target_ratio)
    left = min(max(round(fx * w - cw / 2), 0), w - cw)
    top = round((h - ch) * fy)
    return left, top, left + cw, top + ch


def save(img: Image.Image, path: Path) -> None:
    if img.width > MAX_SIDE:
        img = img.resize((MAX_SIDE, round(img.height * MAX_SIDE / img.width)), Image.LANCZOS)
    img.convert("RGB").save(path, "JPEG", quality=90, optimize=True)
    size = path.stat().st_size
    if size > MAX_BYTES:
        raise SystemExit(f"{path.name} is {size} bytes, over the 5 MB limit")
    print(f"{path.name}: {img.width}x{img.height}, {size // 1024} KB")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for src in sorted(SRC.glob("*.png")):
        name = src.stem
        img = Image.open(src)
        w, h = img.size
        save(img.crop(crop_box(w, h, 1.0, SQUARE_FOCUS_X.get(name, 0.5), 0.5)), OUT / f"{name}-square.jpg")
        save(
            img.crop(crop_box(w, h, LANDSCAPE_RATIO, 0.5, LANDSCAPE_FOCUS_Y.get(name, 0.5))),
            OUT / f"{name}-landscape.jpg",
        )


if __name__ == "__main__":
    main()

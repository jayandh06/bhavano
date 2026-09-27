"""Builds the Google Play feature graphic (1024x500) from the app icon and the web brand palette.

Fonts aren't committed: pass a folder holding Lora[wght].ttf and Manrope[wght].ttf from
github.com/google/fonts (ofl/lora, ofl/manrope), saved as Lora.ttf / Manrope.ttf.

    python make_feature_graphic.py <fonts-dir>
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ICON = HERE.parent / "assets" / "icon.png"
OUT = HERE / "play-feature-graphic.png"

W, H = 1024, 500
GREEN_DEEP = (8, 46, 35)
GREEN = (11, 61, 46)
GREEN_ICON = (17, 82, 60)
CREAM = (239, 233, 220)
GOLD = (201, 161, 90)


def font(fonts_dir: Path, name: str, size: int, weight: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(fonts_dir / f"{name}.ttf"), size)
    f.set_variation_by_name(weight)
    return f


def background() -> Image.Image:
    bg = Image.new("RGB", (W, H), GREEN)
    px = bg.load()
    for y in range(H):
        for x in range(W):
            # Diagonal blend: deep green top-left to the icon's own green bottom-right.
            t = min(1.0, max(0.0, (x / W) * 0.65 + (y / H) * 0.35))
            px[x, y] = tuple(round(GREEN_DEEP[i] + (GREEN_ICON[i] - GREEN_DEEP[i]) * t) for i in range(3))

    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((-140, -160, 520, 560), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg.paste(Image.new("RGB", (W, H), (46, 120, 92)), (0, 0), glow)
    return bg


def icon_tile(size: int) -> tuple[Image.Image, Image.Image]:
    icon = Image.open(ICON).convert("RGB").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=int(size * 4 * 0.22), fill=255)
    return icon, mask.resize((size, size), Image.LANCZOS)


def main() -> None:
    fonts_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "fonts"
    img = background()

    tile_size = 260
    tile_x, tile_y = 92, (H - tile_size) // 2
    icon, mask = icon_tile(tile_size)

    shadow = Image.new("L", (W, H), 0)
    shadow.paste(mask.point(lambda v: v * 0.55), (tile_x + 6, tile_y + 18))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    img.paste(Image.new("RGB", (W, H), (3, 20, 15)), (0, 0), shadow)
    img.paste(icon, (tile_x, tile_y), mask)

    draw = ImageDraw.Draw(img)
    text_x = tile_x + tile_size + 64

    wordmark = font(fonts_dir, "Lora", 104, "Bold")
    tagline = font(fonts_dir, "Manrope", 33, "SemiBold")
    chip_font = font(fonts_dir, "Manrope", 22, "Bold")

    draw.text((text_x, 118), "Bhavano", font=wordmark, fill=CREAM)
    draw.rectangle((text_x + 4, 252, text_x + 76, 256), fill=GOLD)
    draw.text((text_x, 276), "Buy, rent & lease property", font=tagline, fill=CREAM)
    draw.text((text_x, 318), "across India", font=tagline, fill=(200, 214, 204))

    chips = ["Buy", "Rent", "PG", "Plots", "Coworking"]
    cx, cy = text_x, 384
    for label in chips:
        w = round(draw.textlength(label, font=chip_font)) + 32
        draw.rounded_rectangle((cx, cy, cx + w, cy + 40), radius=20, outline=GOLD, width=2)
        # "mm" centres on the font's own ascender/descender midline, so labels with and without
        # descenders (Buy vs Rent) sit on one baseline.
        draw.text((cx + w / 2, cy + 20), label, font=chip_font, fill=GOLD, anchor="mm")
        cx += w + 10

    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} {img.size}")


if __name__ == "__main__":
    main()

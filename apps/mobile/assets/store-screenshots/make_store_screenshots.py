"""Turns real iPhone screenshots of the Bhavano app into App Store screenshots: a brand-green frame with a short caption above the screen.

Usage (from apps/mobile/assets/store-screenshots):
    python make_store_screenshots.py            # reads raw/*.png, writes out/<size>/<name>.png
    python make_store_screenshots.py --check    # only checks the raw files and captions

Put one portrait iPhone screenshot per screen in raw/, named in the order they should appear: 01-home.png, 02-search.png, ...
The caption for each is in CAPTIONS below (keyed by file name without the number). Captions are checked against Apple's 2.3.7 rule: no prices,
no "free", no discounts, no plan names with prices. The raw screens themselves still need the same check by eye.

Output sizes are Apple's accepted iPhone screenshot sizes (App Store Connect scales the largest set down for smaller phones):
6.9" 1320x2868, 6.7" 1290x2796, 6.5" 1284x2778. See docs/plans/ios-store-screenshots.md.
"""

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
RAW = HERE / "raw"
OUT = HERE / "out"

GREEN = (11, 61, 46)  # --green in apps/web globals.css
CREAM = (251, 247, 240)
GOLD = (232, 182, 62)
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT = "C:/Windows/Fonts/segoeui.ttf"

SIZES = {"6.9in-1320x2868": (1320, 2868), "6.7in-1290x2796": (1290, 2796), "6.5in-1284x2778": (1284, 2778)}

# Keyed by the file name without its leading "NN-". Short, about what the screen does, no prices and no "free".
CAPTIONS = {
    "home": "Find homes, PGs and spaces near you",
    "search": "Search by city, area and budget",
    "listing": "Photos, details and owner contact",
    "messages": "Message owners directly",
    "post": "Post your ad in minutes",
    "alerts": "Get alerts when something new matches",
    "saved": "Save listings and compare later",
    "requirements": "See what people are looking for",
}

# Apple 2.3.7: no price references in creative assets.
BANNED = re.compile(r"(?i)\bfree\b|₹|\brs\.?\b|\binr\b|\$|%|\bdiscount\b|\boffer\b|\bsale\b|\bcheap\b|\bprice\b|\bpricing\b|\bplans?\b|\bsubscription\b")


def font(path: str, size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def caption_for(stem: str) -> str:
    key = re.sub(r"^\d+-", "", stem)
    if key not in CAPTIONS:
        raise SystemExit(f"No caption for '{stem}'. Add '{key}' to CAPTIONS in this script.")
    caption = CAPTIONS[key]
    if BANNED.search(caption):
        raise SystemExit(f"Caption for '{key}' mentions a price, 'free' or a plan, which App Review rejects (2.3.7): {caption}")
    return caption


def render(raw_path: Path, caption: str, size: tuple[int, int]) -> Image.Image:
    width, height = size
    canvas = Image.new("RGB", size, GREEN)
    draw = ImageDraw.Draw(canvas)

    # Caption block: about the top 17% of the frame.
    caption_font = font(FONT_BOLD, round(width * 0.062))
    lines = wrap(draw, caption, caption_font, round(width * 0.84))
    line_height = round(width * 0.062 * 1.25)
    top = round(height * 0.045)
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=caption_font)
        draw.text(((width - w) / 2, top + i * line_height), line, font=caption_font, fill=CREAM)
    accent_y = top + len(lines) * line_height + round(height * 0.012)
    draw.rounded_rectangle([(width / 2 - width * 0.06, accent_y), (width / 2 + width * 0.06, accent_y + 8)], radius=4, fill=GOLD)

    # The real screen, scaled to fit under the caption with a margin, rounded corners and a thin light border.
    shot = Image.open(raw_path).convert("RGB")
    area_top = accent_y + round(height * 0.03)
    area_h = height - area_top - round(height * 0.03)
    area_w = round(width * 0.86)
    scale = min(area_w / shot.width, area_h / shot.height)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (shot.width - 1, shot.height - 1)], radius=round(width * 0.05), fill=255)
    x = (width - shot.width) // 2
    canvas.paste(shot, (x, area_top), mask)
    ImageDraw.Draw(canvas).rounded_rectangle(
        [(x, area_top), (x + shot.width - 1, area_top + shot.height - 1)], radius=round(width * 0.05), outline=(255, 255, 255), width=3
    )
    return canvas


def main() -> None:
    check_only = "--check" in sys.argv
    files = sorted(RAW.glob("*.png")) + sorted(RAW.glob("*.jpg"))
    if not files:
        raise SystemExit(f"Put the raw iPhone screenshots in {RAW} (01-home.png, 02-search.png, ...).")
    problems = 0
    for path in files:
        caption_for(path.stem)
        with Image.open(path) as im:
            ratio = im.width / im.height
        # Every modern iPhone screen is about 0.46 wide to tall; a very different ratio is an iPad, a landscape shot or a crop.
        if not 0.44 <= ratio <= 0.49:
            print(f"WARNING {path.name}: {im.width}x{im.height} is not a portrait iPhone screenshot (ratio {ratio:.3f}).")
            problems += 1
    print(f"{len(files)} raw screenshots, captions fine, {problems} warning(s).")
    if check_only:
        return
    for label, size in SIZES.items():
        folder = OUT / label
        folder.mkdir(parents=True, exist_ok=True)
        for path in files:
            render(path, caption_for(path.stem), size).save(folder / f"{path.stem}.png", optimize=True)
        print(f"wrote {len(files)} files to {folder}")


if __name__ == "__main__":
    main()

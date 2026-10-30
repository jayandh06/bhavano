"""Builds the Facebook / Instagram test-campaign images from the owner-intent photos already made for Google Ads.

Usage: python marketing/meta-ads/make_meta_ads.py

Writes out/<name>-<size>.jpg for three photos in three Meta sizes: 4:5 feed (1080x1350), 1:1 feed (1080x1080) and 9:16 stories / reels (1080x1920).
The 1280x720 photos are never cropped tight or upscaled past about 0.85x: each size puts the whole photo in a band and the headline and call to action
on a brand-green panel (a feed image with little text on the photo itself, which Meta delivers better). See docs/plans/meta-facebook-instagram-ads-test.md.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "marketing" / "google-ads" / "images" / "source"
OUT = Path(__file__).parent / "out"
LOGO = ROOT / "assets" / "brand" / "icon-light-1024.png"

GREEN = (11, 61, 46)  # --green in apps/web globals.css
CREAM = (251, 247, 240)  # --bg
GOLD = (232, 182, 62)
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_SEMI = "C:/Windows/Fonts/seguisb.ttf"

W = 1080
PHOTO_H = round(720 * W / 1280)  # 608: the whole photo, scaled down

# name: (source photo, headline, supporting line, call to action)
ADS = {
    "post-ad": ("generic-owner-posting-phone", "Selling or renting\nyour property?", "List it on Bhavano and reach people searching in your city.", "Post your ad"),
    "sell-flat": ("sell-owner-photographing-balcony", "Got a flat\nto sell?", "Post an ad in minutes with your own photos.", "Post your ad"),
    "rent-out": ("generic-phone-at-window", "Have a home\nto rent out?", "Your photos, your price. Done on your phone.", "Post your ad"),
}

SIZES = {"feed-4x5": (1080, 1350), "feed-1x1": (1080, 1080), "story-9x16": (1080, 1920)}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        line = ""
        for word in para.split():
            trial = f"{line} {word}".strip()
            if draw.textlength(trial, font=fnt) <= max_w:
                line = trial
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


def compose(photo: Image.Image, logo: Image.Image, headline: str, support: str, cta: str, size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", (w, h), GREEN)
    draw = ImageDraw.Draw(img)
    pad = 64

    # Story / reel: leave the top and bottom ~250 px free of text (the app's own interface covers them).
    story = h == 1920
    photo_top = 250 if story else 0
    img.paste(photo.resize((w, PHOTO_H), Image.LANCZOS), (0, photo_top))

    # Logo chip in the photo's top-left corner.
    chip = logo.resize((92, 92), Image.LANCZOS).convert("RGBA")
    bg = Image.new("RGBA", (116, 116), CREAM + (235,))
    img.paste(bg, (pad // 2, photo_top + pad // 2), bg)
    img.paste(chip, (pad // 2 + 12, photo_top + pad // 2 + 12), chip)

    text_top = photo_top + PHOTO_H + (56 if h != 1080 else 36)
    head_size = 84 if h != 1080 else 68
    f_head, f_sup, f_cta = font(FONT_BOLD, head_size), font(FONT, 36 if h != 1080 else 32), font(FONT_BOLD, 40)

    y = text_top
    for line in wrap(draw, headline, f_head, w - 2 * pad):
        draw.text((pad, y), line, font=f_head, fill=CREAM)
        y += round(head_size * 1.1)
    y += 28
    for line in wrap(draw, support, f_sup, w - 2 * pad):
        draw.text((pad, y), line, font=f_sup, fill=(214, 226, 219))
        y += 46

    # Call-to-action pill at the bottom of the panel (above the unsafe zone on stories).
    pill_h = 92
    bottom = h - (250 if story else 56)
    pill_w = round(draw.textlength(cta, font=f_cta)) + 2 * 48
    draw.rounded_rectangle((pad, bottom - pill_h, pad + pill_w, bottom), radius=pill_h // 2, fill=GOLD)
    draw.text((pad + 48, bottom - pill_h + (pill_h - 40) // 2 - 6), cta, font=f_cta, fill=GREEN)
    draw.text((pad + pill_w + 28, bottom - pill_h + (pill_h - 36) // 2 - 4), "bhavano.com", font=font(FONT_SEMI, 36), fill=CREAM)
    return img


def main() -> None:
    OUT.mkdir(exist_ok=True)
    logo = Image.open(LOGO)
    for name, (src, headline, support, cta) in ADS.items():
        photo = Image.open(SRC / f"{src}.png").convert("RGB")
        for size_name, size in SIZES.items():
            path = OUT / f"{name}-{size_name}.jpg"
            compose(photo, logo, headline, support, cta, size).save(path, "JPEG", quality=92, optimize=True)
            print(f"{path.name}: {size[0]}x{size[1]}, {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()

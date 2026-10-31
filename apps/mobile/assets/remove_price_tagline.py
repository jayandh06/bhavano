"""Removes "free to post —" from the two App Store creative images (Guideline 2.3.7: price references, including "free", are not allowed in app metadata).

The tagline "Buy, rent, sell & lease — free to post — connect with property owners directly." becomes "Buy, rent, sell & lease — connect with property owners directly."
The original text pixels are kept: the band the tagline sits in is refilled from the background on either side of it, then the left part (up to the first dash) and the
right part (from "connect") are pasted back next to each other and centred. Run from the repo root:

    python apps/mobile/assets/remove_price_tagline.py

Rewrites app-store-universal.png and app-store-header.png in place (git has the originals).
"""

from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
FILES = ["app-store-universal.png", "app-store-header.png"]


def runs(mask: np.ndarray, min_gap: int):
    """Column runs of True, merging runs closer than min_gap."""
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        return []
    out, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > min_gap:
            out.append((start, prev))
            start = i
        prev = i
    out.append((start, prev))
    return out


def fix(path: Path) -> None:
    img = np.array(Image.open(path).convert("RGB")).astype(np.float32)
    h, w, _ = img.shape
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    gold = (r - b > 80) & (r > 140)  # the gold "free to post"; also the gold "a" and divider above it, which sit higher up
    lo = int(h * 0.585)
    rows = np.flatnonzero(gold[lo:].sum(axis=1) > 0.04 * w) + lo  # wide gold rows below the wordmark: the tagline's gold words
    y0, y1 = rows.min(), rows.max()
    pad = int((y1 - y0) * 1.5)  # ascenders and descenders of the cream text
    top, bottom = max(0, y0 - pad), min(h, y1 + pad)

    gold_runs = [r_ for r_ in runs(gold[top:bottom].any(axis=0), 40) if r_[1] - r_[0] > 50]
    gx0, gx1 = gold_runs[0]
    cream = (r > 150) & (g > 150) & (b > 120) & ~gold
    word_runs = runs(cream[top:bottom].any(axis=0), 6)
    left_text = min(a for a, _ in word_runs)
    right_text = max(b_ for _, b_ in word_runs)
    left_end = max(b_ for a, b_ in word_runs if b_ < gx0)  # end of the first dash
    after = [(a, b_) for a, b_ in word_runs if a > gx1]
    dash2, connect = after[0], after[1]  # the second dash, then the start of "connect"
    cut_start = gx0
    gap = gx0 - left_end

    # Refill the whole text span from the clean columns either side (linear blend per row).
    margin = int(w * 0.01)
    xl, xr = max(0, left_text - margin), min(w - 1, right_text + margin)
    out = img.copy()
    span = np.arange(xl, xr + 1)
    t = ((span - xl) / (xr - xl))[None, :, None]
    left_col = img[top:bottom, xl:xl + 1]
    right_col = img[top:bottom, xr:xr + 1]
    out[top:bottom, xl:xr + 1] = left_col * (1 - t) + right_col * t

    left_piece = img[top:bottom, left_text:left_end + 1]
    right_piece = img[top:bottom, connect[0]:right_text + 1]
    total = left_piece.shape[1] + gap + right_piece.shape[1]
    start = int(round((w - total) / 2))
    # The new text can be a little narrower than the band that was cleared; the blend above already covers the old span.
    out[top:bottom, start:start + left_piece.shape[1]] = left_piece
    rs = start + left_piece.shape[1] + gap
    out[top:bottom, rs:rs + right_piece.shape[1]] = right_piece

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path, optimize=True)
    print(f"{path.name}: rows {top}-{bottom}, removed columns {cut_start}-{connect[0]}, text now {start}-{rs + right_piece.shape[1]} of {w}")


if __name__ == "__main__":
    for name in FILES:
        fix(HERE / name)

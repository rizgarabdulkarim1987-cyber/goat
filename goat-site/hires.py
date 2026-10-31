"""Re-draw the two headline clips (hero1: "goat" -> "dream", hero2: "dream") at twice the size with crisp edges.

The words are letters from the reference video, so their edges are only as sharp as that video. The glyphs are
smooth shapes, so the edge can be rebuilt: the alpha of each baked tile is smoothed, enlarged 2x and pushed through
a steep curve, which turns the soft one-pixel ramp into a clean edge at the new size. Colours (the photo inside the
letters) are enlarged as they are. Each frame is written as a lossless WebP with alpha into the backend's frames
folder, and clips.json is switched from "sheet" to "frames" for these two clips.

Run after bake.py has written public/seq/hero1.png and hero2.png:  python -I hires.py
"""
import json, os, sys, time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
import numpy as np, cv2
from PIL import Image

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "data")
UP = 2
CELL = (870, 320)


def enlarge(tile):
    """tile: RGBA uint8 (cell) -> RGBA uint8 (UP x cell)"""
    rgb = tile[..., :3].astype(np.float32)
    a = tile[..., 3].astype(np.float32) / 255
    a_s = cv2.GaussianBlur(a, (0, 0), 0.7)
    size = (tile.shape[1] * UP, tile.shape[0] * UP)
    a_up = cv2.resize(a_s, size, interpolation=cv2.INTER_CUBIC)
    # steep curve around the half-way line: a clean edge, still anti-aliased over about one new pixel
    a_new = np.clip((a_up - 0.5) * 3.2 + 0.5, 0, 1)
    pm = cv2.resize(rgb * a[..., None], size, interpolation=cv2.INTER_CUBIC)
    base = cv2.resize(a, size, interpolation=cv2.INTER_CUBIC)
    rgb_up = np.clip(pm / np.maximum(base[..., None], 0.05), 0, 255)
    rgb_up[base < 0.05] = 0
    return np.dstack([rgb_up, a_new * 255]).astype(np.uint8)


def run(name):
    sheet = Image.open(f"public/seq/{name}.png").convert("RGBA")
    meta_path = os.path.join(DATA, "clips.json")
    clips = json.load(open(meta_path, encoding="utf-8"))
    m = clips[name]
    cols, n = m["cols"], m["n"]
    out = os.path.join(DATA, "frames", name)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    total = 0
    for i in range(n):
        x, y = (i % cols) * CELL[0], (i // cols) * CELL[1]
        tile = np.array(sheet.crop((x, y, x + CELL[0], y + CELL[1])))
        big = enlarge(tile)
        p = os.path.join(out, f"{i:04d}.webp")
        Image.fromarray(big).save(p, "WEBP", lossless=True, quality=100, method=6)
        total += os.path.getsize(p)
    for k in ("file", "src"):
        m.pop(k, None)
    m.update(kind="frames", ext="webp", cell=[CELL[0] * UP, CELL[1] * UP], locked=True, updatedAt=int(time.time() * 1000))
    json.dump(clips, open(meta_path, "w", encoding="utf-8"), indent=2)
    print(name, n, "frames", round(total / 1e6, 1), "MB")


if __name__ == "__main__":
    for nm in sys.argv[1:] or ["hero1", "hero2"]:
        run(nm)

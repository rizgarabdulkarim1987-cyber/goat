"""Track the picture circles in the reference video frame by frame.

For each clip, find the bright (or coloured) disc on the black page in every
extracted frame and report its centre and radius, so bake.py crops exactly
on it instead of on hand-measured keys.

Usage: python track.py            -> prints keys for every clip (and writes cmp/track.json)
"""
import sys, os, json

sys.path.insert(0, os.path.abspath("../tools"))
sys.path.insert(0, os.path.abspath("."))
import numpy as np, cv2
import bake


def find_disc(bgr, roi=None, min_r=40):
    """Largest well-filled round bright blob on the black page.

    The picture circles are solid discs of mid/bright pixels; the thin outline
    rings and the dark-grey ghost letters are rejected by the fill test and the
    brightness threshold.
    """
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    if roi is not None:
        m = np.zeros_like(g); x0, y0, x1, y1 = roi; m[y0:y1, x0:x1] = 255
        g = cv2.bitwise_and(g, m)
    th = cv2.threshold(g, 70, 255, cv2.THRESH_BINARY)[1]
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(th, connectivity=8)
    best = None
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        r = (w + h) / 4
        if r < min_r:
            continue
        fill = area / (np.pi * r * r + 1e-6)
        ratio = min(w, h) / max(w, h)
        if ratio < 0.75 or fill < 0.75:
            continue
        if best is None or area > best[3]:
            best = (cents[i][0], cents[i][1], r, area)
    return best


ROI = {
    # x0, y0, x1, y1 — where the clip's circle lives (keeps the nav/ghost text out)
    "leapA": (150, 60, 1438, 900),
    "cheer": (60, 300, 700, 820),
    "leapB": (700, 30, 1438, 700),
    "plant": (300, -200, 1150, 900),
}

MINR = {"leapA": 30, "cheer": 60, "leapB": 30, "plant": 60}

out = {}
for name, roi in ROI.items():
    c = bake.CLIPS[name]
    fps = c.get("fps", bake.FPS)
    frames = bake.extract(name, c["t0"], c["t1"], fps)
    keys = []
    last = None
    for i, f in enumerate(frames):
        t = round(c["t0"] + i / fps, 3)
        img = cv2.imread(f)
        x0, y0, x1, y1 = roi
        d = find_disc(img, (max(0, x0), max(0, y0), min(1438, x1), min(960, y1)), min_r=MINR[name])
        if d is None:
            keys.append([t, *(last or [c["keys"][0][1], c["keys"][0][2]]), 0.0]); continue
        cx, cy, r, _ = d
        last = [round(float(cx), 1), round(float(cy), 1)]
        keys.append([t, last[0], last[1], round(float(r) / c["R"], 3)])
    out[name] = keys
    print(name, len(keys), "first", keys[0], "last", keys[-1])
json.dump(out, open("cmp/track.json", "w"), indent=0)

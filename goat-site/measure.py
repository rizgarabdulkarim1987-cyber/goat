"""Measure the reference video for the things hand-reading the sheets got wrong.

Prints, per section, numbers in the 1438x960 design frame:
  marquee   - horizontal speed of the three "sell" rows and the site/video phase offset
  whitedome - crest of the white dome rising from the bottom (43.5s-50.5s)
  dotF      - the big black dot in the "our dream" scene (49.5s-57.5s)
  eye       - centre/radius of the goat-eye disc (67.4s-74.9s)
  plant     - centre/radius of the plant disc while it leaves (40.4s-42.0s)
  hill2     - crest of the final black hill (74.5s-78s)
  workexit  - centre of the main can while the work scene slides out (66s-67.6s)
"""
import sys, os, subprocess
sys.path.insert(0, os.path.abspath("../tools"))
import numpy as np, cv2
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
VIDEO = r"C:\Users\pc\Downloads\Final Home Page Animation (1).mp4"
os.makedirs("cmp", exist_ok=True)


def frame(t):
    t = round(t, 3)
    p = f"cmp/ref_{t}.png"
    if not os.path.exists(p):
        subprocess.run([FF, "-v", "error", "-ss", str(t), "-i", VIDEO, "-frames:v", "1", "-y", p], check=True)
    return cv2.imread(p)


def gray(t):
    return cv2.cvtColor(frame(t), cv2.COLOR_BGR2GRAY)


def frange(a, b, s):
    t = a
    while t <= b + 1e-9:
        yield round(t, 3); t += s


def blobs(mask, rmin, rmax, fill_min=0.7):
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask.astype(np.uint8) * 255, connectivity=8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        r = (w + h) / 4
        if not (rmin <= r <= rmax):
            continue
        if min(w, h) / max(w, h) < 0.7 or area / (np.pi * r * r) < fill_min:
            continue
        out.append((round(float(cents[i][0])), round(float(cents[i][1])), round(r)))
    return out


what = sys.argv[1:] or ["marquee", "whitedome", "dotF", "eye", "plant", "hill2", "workexit"]

if "marquee" in what:
    print("== marquee: dx per 0.25s (design px), rows: main / ghost-top / ghost-bottom")
    bands = {"main": (400, 600), "top": (170, 360), "bottom": (600, 790)}
    for t in (43.5, 44.0, 44.5, 45.0, 45.5, 46.0):
        row = []
        for name, (y0, y1) in bands.items():
            a = gray(t)[y0:y1].astype(np.float32); b = gray(t + 0.25)[y0:y1].astype(np.float32)
            (dx, dy), resp = cv2.phaseCorrelate(a, b)
            row.append(f"{name} dx={dx:+.1f} (r={resp:.2f})")
        print(t, " | ".join(row))
    site = "cmp/site_44.0.png"
    if os.path.exists(site):
        s = cv2.cvtColor(cv2.imread(site), cv2.COLOR_BGR2GRAY)
        if s.shape != (960, 1438):
            s = cv2.resize(s, (1438, 960))
        for name, (y0, y1) in bands.items():
            a = gray(44.0)[y0:y1].astype(np.float32); b = s[y0:y1].astype(np.float32)
            (dx, dy), resp = cv2.phaseCorrelate(a, b)
            print(f"phase site-vs-video at 44.0 {name}: dx={dx:+.1f} dy={dy:+.1f} (r={resp:.2f})  -> move site by {-dx:+.1f}")

if "bigdot" in what:
    print("== bigdot: dark discs r 60..100 in the opening (cx, cy, r)")
    for t in frange(0.8, 2.6, 0.1):
        g = gray(t)
        m = cv2.morphologyEx((g < 60).astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)).astype(bool)
        print(t, blobs(m, 60, 100, 0.6))

if "rings" in what:
    print("== rings: Hough circles on the black scene (cx, cy, r), r 20..180")
    for t in (8.5, 9.0, 10.5, 12.5, 13.3, 14.0, 16.0, 17.0, 18.5, 20.0, 22.0, 23.0):
        g = cv2.GaussianBlur(gray(t), (5, 5), 1)
        c = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1.2, minDist=40, param1=120, param2=28, minRadius=20, maxRadius=180)
        print(t, [] if c is None else [(int(x), int(y), int(r)) for x, y, r in c[0]])

if "sellrow" in what:
    print("== sellrow: rows where >35% of the width is white (the solid marquee row): top, bottom")
    for t in list(frange(41.3, 44.2, 0.1)) + list(frange(47.4, 48.8, 0.1)):
        g = gray(t)
        frac = (g > 200).mean(axis=1)
        ys = np.where(frac > 0.35)[0]
        print(t, (int(ys[0]), int(ys[-1])) if len(ys) else None)

if "cans" in what:
    print("== cans: dark discs r 40..260 (cx, cy, r)")
    for t in list(frange(56.6, 57.4, 0.1)) + list(frange(59.7, 61.2, 0.1)):
        g = gray(t)
        m = cv2.morphologyEx((g < 90).astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)).astype(bool)
        print(t, blobs(m, 40, 260, 0.6))

if "whitedome" in what:
    print("== whitedome: first non-white row scanning up from the bottom, at x=10 / 719 / 1428")
    for t in frange(41.0, 50.75, 0.25):
        g = gray(t); out = []
        for x in (10, 719, 1428):
            col = g[:, x][::-1]
            ys = np.where(col < 128)[0]
            out.append(959 - int(ys[0]) if len(ys) else None)
        print(t, out)

if "dotF" in what:
    print("== dotF: dark round blobs r 15..90 (cx, cy, r)")
    for t in frange(49.5, 57.5, 0.25):
        g = gray(t)
        m = g < 70
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool)
        print(t, blobs(m, 15, 90))

if "eye" in what:
    print("== eye: grey disc (lum 50..235) enclosing circle (cx, cy, r)")
    ts = list(frange(67.4, 69.6, 0.1)) + [70.0, 70.5, 71.0, 72.0, 73.0, 74.0, 74.5, 74.8]
    for t in ts:
        g = gray(t)
        m = ((g > 50) & (g < 235)).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(m)
        if n < 2:
            print(t, None); continue
        i = 1 + int(np.argmax(stats[1:, 4]))
        pts = np.column_stack(np.where(labels == i))[:, ::-1].astype(np.float32)
        (cx, cy), r = cv2.minEnclosingCircle(pts)
        print(t, (round(cx), round(cy), round(r)), "area", int(stats[i, 4]))

if "plant" in what:
    print("== plant: disc (lum 18..245) enclosing circle while leaving (cx, cy, r)")
    for t in frange(40.4, 42.0, 0.1):
        g = gray(t)
        m = ((g > 18) & (g < 245)).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(m)
        if n < 2:
            print(t, None); continue
        i = 1 + int(np.argmax(stats[1:, 4]))
        pts = np.column_stack(np.where(labels == i))[:, ::-1].astype(np.float32)
        (cx, cy), r = cv2.minEnclosingCircle(pts)
        print(t, (round(cx), round(cy), round(r)), "area", int(stats[i, 4]))

if "hill2" in what:
    print("== hill2: first black run (>=60 rows) from the top at x=400 / 1000")
    for t in frange(74.5, 78.0, 0.1):
        g = gray(t); out = []
        for x in (400, 1000):
            col = g[:, x] < 40
            y = None
            run = 0
            for yy in range(len(col)):
                run = run + 1 if col[yy] else 0
                if run >= 60:
                    y = yy - 59; break
            out.append(y)
        print(t, out)

if "workexit" in what:
    print("== workexit: main can disc (dark, area>20000) centre (cx, cy, r)")
    for t in frange(66.0, 67.6, 0.1):
        g = gray(t)
        m = (g < 60).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(m)
        best = None
        for i in range(1, n):
            if stats[i, 4] > 20000 and (best is None or stats[i, 4] > stats[best, 4]):
                best = i
        if best is None:
            print(t, None); continue
        pts = np.column_stack(np.where(labels == best))[:, ::-1].astype(np.float32)
        (cx, cy), r = cv2.minEnclosingCircle(pts)
        print(t, (round(cx), round(cy), round(r)))

"""Bake the moving picture content of the reference video into sprite sheets.

The circles (runners, plant) and the goat figure are video clips in the
reference, so stills can't match them. This extracts each clip at 12 fps,
crops it along its measured path, and writes one sprite sheet + metadata per
clip into public/seq/, plus src/seq.js so the page can build its timeline
synchronously. Also rebuilds the eye still (inpainting the baked "g") and the
three letter-fill textures (edge-extended so no halo shows at glyph edges).

Positions are design px on the 1438x960 frame. Keys: [t, cx, cy, scale].
"""
import subprocess, sys, os, json, shutil, glob, time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
import numpy as np, cv2
from PIL import Image, ImageDraw
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
VIDEO = r"C:\Users\pc\Downloads\Final Home Page Animation (1).mp4"
FPS = 12
FAST_FPS = 24  # clips whose circle moves or scales quickly get more frames
W, H = 1438, 960
os.makedirs("public/seq", exist_ok=True)
os.makedirs("cmp/seq", exist_ok=True)

# crest of the final black hill per 0.1s (measured at x=400/1000 on the reference)
HILL = [[74.65, 960], [74.7, 835], [74.8, 722], [74.9, 594], [75.0, 475], [75.1, 384], [75.2, 320], [75.3, 277],
        [75.4, 248], [75.5, 230], [75.6, 221], [75.7, 218], [78.0, 218]]
# bottom edge (at the centre column) of the black cover that lifts off the "sell" scene
COVER2 = [[42.5, 1022], [42.75, 1012], [43.0, 985], [43.25, 968], [43.5, 959], [43.75, 957], [47.5, 957], [47.75, 953],
          [48.0, 790], [48.25, 540], [48.5, 373], [48.75, 258], [49.0, 177], [49.25, 117], [49.5, 73], [49.75, 20],
          [50.0, -20], [50.3, -120]]

def lerp1(keys, t):
    if t <= keys[0][0]:
        return keys[0][1]
    for a, b in zip(keys, keys[1:]):
        if t <= b[0]:
            return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])
    return keys[-1][1]


CLIPS = {
    # name: dict(t0, t1, R (design radius), cell (sprite px), keys, round)
    # keys measured from the half-second sheets; `fps` overrides FPS for fast clips
    "leapA": dict(t0=8.3, t1=13.3, R=190, cell=380, round=True, fps=FAST_FPS,
                  keys=[[8.3, 1130, 660, 0.18], [8.4, 1007, 649, 0.38], [8.5, 870, 600, 0.5], [8.6, 745, 540, 0.6], [8.8, 560, 476, 0.8],
                        [9.0, 466, 462, 1], [9.5, 420, 470, 1], [9.9, 420, 458, 1], [12.8, 420, 450, 1],
                        [13.0, 418, 420, 0.82], [13.1, 414, 400, 0.6], [13.2, 410, 380, 0.3], [13.3, 410, 380, 0]]),
    "cheer": dict(t0=13.1, t1=18.2, R=190, cell=380, round=True, fps=FAST_FPS,
                  keys=[[13.1, 318, 551, 0.3], [13.2, 312, 547, 0.75], [13.3, 306, 545, 1], [17.9, 324, 537, 1],
                        [18.0, 318, 538, 0.7], [18.1, 315, 540, 0.3], [18.2, 315, 540, 0]]),
    "leapB": dict(t0=17.9, t1=23.5, R=214, cell=428, round=True, fps=FAST_FPS,
                  keys=[[17.9, 1133, 297, 0], [18.0, 1133, 296, 0.2], [18.2, 1136, 295, 0.6], [18.5, 1140, 294, 1],
                        [23.2, 1140, 294, 1], [23.3, 1136, 290, 0.6], [23.4, 1133, 288, 0.25], [23.5, 1133, 288, 0]]),
    "plant": dict(t0=34.4, t1=42.1, R=277, cell=554, round=True, fps=FAST_FPS,
                  # fade-in and exit paths measured by disc detection on the extracted frames
                  keys=[[34.4, 630, 184, 0.25], [34.5, 664, 242, 0.48], [34.6, 687, 290, 0.63], [34.7, 702, 330, 0.73],
                        [34.8, 711, 366, 0.83], [35.0, 716, 412, 0.95], [35.2, 716, 445, 1], [35.5, 716, 496, 1],
                        [40.6, 716, 496, 1], [41.0, 716, 498, 1], [41.2, 716, 475, 1], [41.3, 716, 450, 1], [41.4, 716, 415, 1],
                        [41.5, 716, 358, 1], [41.6, 716, 265, 1], [41.7, 716, 182, 1], [41.8, 716, 94, 1], [41.9, 716, 0, 1],
                        [42.0, 716, -110, 1], [42.1, 716, -300, 1]]),
    # the goat eye: grows in at the top right, settles, drifts up, then leaves with the headline
    "eye": dict(t0=67.4, t1=74.9, R=294, cell=588, round=True,
                keys=[[67.4, 900, 160, 0.06], [67.5, 867, 174, 0.105], [67.6, 717, 194, 0.177], [67.7, 610, 222, 0.26],
                      [67.8, 531, 249, 0.35], [67.9, 471, 273, 0.45], [68.0, 425, 294, 0.55], [68.1, 390, 311, 0.65],
                      [68.2, 364, 324, 0.74], [68.3, 345, 335, 0.82], [68.4, 331, 343, 0.9], [68.5, 322, 349, 0.95],
                      [68.6, 317, 353, 0.99], [68.7, 316, 355, 1], [70.0, 322, 351, 1], [70.5, 326, 343, 1], [71.0, 330, 333, 1],
                      [72.0, 340, 314, 1], [73.0, 347, 304, 1], [74.0, 345, 284, 1], [74.5, 340, 138, 1], [74.9, 320, -120, 1]]),
    # while the hill shoots up (74.65-75.35) hill, goat and crest blur are one motion-blurred picture:
    # that band of the frame is baked whole (opaque), anchored to the crest; afterwards the goat alone
    "hillrise": dict(t0=74.65, t1=75.3, box=(1438, 300), cell=(1438, 300), round=False, fps=FAST_FPS,
                     keys=[[t, 719, y - 70, 1] for t, y in HILL]),
    # the goat walks on the crest; the box is cropped from 110px above it so the horns fit,
    # and keyed so both sky and hill drop out
    # the goat stands ON the crest with its hooves ~80px below it: the box (centre = crest-20,
    # 240 tall) spans crest-140 .. crest+100 so horns and hooves both fit
    "goat": dict(t0=75.3, t1=78.0, box=(300, 240), cell=(300, 240), round=False, alpha=True,
                 keys=[[75.3, 720, lerp1(HILL, 75.3) - 20, 1]] + [[t, 720, y - 20, 1] for t, y in HILL if t > 75.3]),
    # the headline words carry a photo inside the glyphs and a letter scramble:
    # baked as a box, keyed against the white page so only the glyphs stay opaque
    # (hero1 ends just before the rising hill reaches the box)
    # runs until the rising hill has swallowed the letters; the baked hill pixels sit under the DOM hill
    "hero1": dict(t0=0.0, t1=7.4, box=(870, 320), cell=(870, 320), round=False, keywhite=True, keys=[[0, 725, 480, 1]]),
    # hero2 starts while the black cover is still over the top of its box: rows above the cover's edge are keyed out
    "hero2": dict(t0=48.3, t1=55.8, box=(870, 320), cell=(870, 320), round=False, keywhite=True, cover=COVER2, keys=[[48.3, 735, 505, 1]]),
}


def lerp_keys(keys, t):
    if t <= keys[0][0]:
        return keys[0][1:]
    for a, b in zip(keys, keys[1:]):
        if t <= b[0]:
            f = (t - a[0]) / (b[0] - a[0])
            return [a[i] + (b[i] - a[i]) * f for i in (1, 2, 3)]
    return keys[-1][1:]


def extract(name, t0, t1, fps=FPS):
    d = f"cmp/seq/{name}_{fps}"
    if os.path.isdir(d) and glob.glob(f"{d}/*.png"):
        return sorted(glob.glob(f"{d}/*.png"))
    os.makedirs(d, exist_ok=True)
    subprocess.run([FF, "-v", "error", "-ss", str(t0), "-t", str(t1 - t0 + 0.5 / fps), "-i", VIDEO,
                    "-vf", f"fps={fps}", f"{d}/f_%04d.png"], check=True)
    return sorted(glob.glob(f"{d}/*.png"))


def pad(img, p=600, value=(0, 0, 0)):
    return cv2.copyMakeBorder(img, p, p, p, p, cv2.BORDER_CONSTANT, value=value)


def cutout_goat(bgr):
    """White sky + black hill -> transparent; the goat keeps its own ink.

    The sky is flooded from the top border only (the goat's white patches are
    sealed by its outline, so they survive). The hill's crest is found per
    frame: in every column, the black run that touches the box's bottom; its
    median top (legs are too few columns to move a median) is the crest, and
    every black pixel from there down is hill. The goat's black legs there are
    black-on-black in the page as well, so dropping them changes nothing visible.
    """
    h, w = bgr.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    work = bgr.copy()
    flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE
    for x in range(0, w, 2):
        if mask[1, x + 1] == 0 and work[0, x].min() > 200:
            cv2.floodFill(work, mask, (x, 0), 0, (40, 40, 40), (40, 40, 40), flags)
    sky = mask[1:-1, 1:-1] > 0
    lum = bgr.mean(axis=2)
    dark = lum < 60
    tops = []
    # (hill_row is found below; the sky flood is then clipped to above it, since the white
    #  leg strokes are the same shade as the sky and the flood would otherwise run down them)
    for x in range(w):
        col = dark[:, x]
        if not col[-1]:
            continue
        y = h - 1
        while y > 0 and col[y - 1]:
            y -= 1
        tops.append(y)
    hill_row = int(np.median(tops)) if tops else h
    sky[max(0, hill_row - 2):] = False
    # the crest's anti-aliased edge is a long light horizontal run the flood never reaches
    # (it is not white enough); a 1x25 opening keeps only such wide runs, so the narrow
    # vertical leg strokes crossing the crest are untouched
    band = slice(max(0, hill_row - 8), min(h, hill_row + 3))
    light = (lum[band] >= 180).astype(np.uint8)
    wide = cv2.morphologyEx(light, cv2.MORPH_OPEN, np.ones((1, 25), np.uint8))
    sky[band] |= wide > 0
    hill = np.zeros_like(sky)
    # only pixels connected to the bottom edge are hill: the goat's black legs and belly sit
    # above the crest and stay (they are drawn over the DOM hill anyway)
    below = np.zeros_like(dark, dtype=np.uint8); below[max(0, hill_row - 3):] = dark[max(0, hill_row - 3):]
    n, lab, st, _ = cv2.connectedComponentsWithStats(below, connectivity=4)
    for i in range(1, n):
        if st[i, 1] + st[i, 3] >= h - 1:
            hill[lab == i] = True
    band = slice(max(0, hill_row - 4), min(h, hill_row + 2))
    hill[band] |= (lum[band] < 200) & (lum[band] > 60)
    alpha = np.where(sky | hill, 0, 255).astype(np.uint8)
    # the legs below the crest are thin white strokes that are not joined to the body, so
    # every blob is kept except specks (<12 px); no edge softening either, a 1-2px stroke
    # would otherwise end up half transparent
    n, labels, stats, _ = cv2.connectedComponentsWithStats(alpha, connectivity=8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 12:
            alpha[labels == i] = 0
    return np.dstack([bgr, alpha])


def key_white(bgr):
    """Un-premultiply a box against the white page so only the glyphs stay opaque.

    alpha = 1 - min(channel)/255 reproduces every pixel exactly when composited
    over white (so the photo inside the letters and the anti-aliased edges are
    untouched); the page's hairlines and soft blur, which would double the DOM
    curves, are dropped by keeping only what survives a 5px opening.
    """
    p = bgr.astype(np.float32)
    a = 1 - p.min(axis=2) / 255
    lum = p.mean(axis=2)
    # 9px opening drops every hairline; then any blob shorter than 60px (the "our" word, the
    # dots that pass through the box) is dropped too, so only the headline glyphs remain
    solid = cv2.morphologyEx((lum < 236).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    for i in range(1, n):
        if st[i, 3] < 60:
            solid[lab == i] = 0
    solid = cv2.dilate(solid, np.ones((3, 3), np.uint8))
    a[solid == 0] = 0
    a[lum > 250] = 0
    a3 = np.maximum(a[..., None], 0.02)
    c = np.clip((p - 255 * (1 - a[..., None])) / a3, 0, 255)
    c[a < 0.02] = 0
    return np.dstack([c, a * 255]).astype(np.uint8)


def raw_tile(name, c, f, i, fps):
    """The cropped (and keyed) picture of frame i of a clip, scaled to the clip's cell."""
    cell = c["cell"] if isinstance(c["cell"], tuple) else (c["cell"], c["cell"])
    t = c["t0"] + i / fps
    cx, cy, s = lerp_keys(c["keys"], t)
    # boxes that reach outside the frame are padded with the page's white (the goat's sky flood
    # must start there; the hill band must stay white above the page edge)
    img = pad(cv2.imread(f), value=(255, 255, 255) if (c.get("alpha") or name == "hillrise") else (0, 0, 0))
    if "box" in c:
        bw, bh = c["box"]
        x0, y0 = int(round(cx - bw / 2)) + 600, int(round(cy - bh / 2)) + 600
        crop = img[y0:y0 + bh, x0:x0 + bw]
        if c.get("alpha"):
            tile = cutout_goat(crop)
        elif c.get("keywhite"):
            tile = key_white(crop)
            if c.get("cover"):
                # everything above the lifting cover's edge belongs to the cover, not the box
                edge_rows = int(round(lerp1(c["cover"], t) + 26 - (cy - bh / 2)))
                if edge_rows > 0:
                    tile[:min(bh, edge_rows), :, 3] = 0
        else:
            tile = crop
        tile = cv2.resize(tile, cell, interpolation=cv2.INTER_AREA)
    else:
        if s < 0.04:
            tile = np.zeros((cell[1], cell[0], 3), np.uint8)
        else:
            # crop a touch wider than the disc so the sprite's own round mask
            # trims the anti-aliased edge instead of showing a black rim
            r = max(4, int(round(c["R"] * s)) + 4)
            x0, y0 = int(round(cx)) - r + 600, int(round(cy)) - r + 600
            crop = img[y0:y0 + 2 * r, x0:x0 + 2 * r]
            tile = cv2.resize(crop, cell, interpolation=cv2.INTER_AREA)
    return tile


# The reference video has the headline "creative ideas" burnt into the plant circle where the two
# overlap. The page draws that headline itself (it stays put while the circle rises behind it), so the
# plant frames must not carry a second copy: the letters are inpainted out of the circle.
HEADLINE_T = (36.3, 41.85)  # the burnt-in headline is in the video from ~36.5 until it has risen out of the frame
HEADLINE_REST_Y = 496       # the plant clip's centre while the headline is at rest (see CLIPS keys)
# where the headline's centre is on screen while it rises with the plant (design px, measured on the video;
# main.js uses the same path for the page's own headline)
HEADLINE_Y = [[40.8, 504], [41.0, 493], [41.1, 482], [41.2, 463], [41.3, 437], [41.4, 397], [41.5, 337], [41.6, 244], [41.7, 118], [41.8, -10]]
_mask_cache = {}


def plant_headline_mask(c, files, fps):
    """Glyph mask in tile coordinates, taken while the headline is at full white and the circle at rest."""
    if "plant" in _mask_cache:
        return _mask_cache["plant"]
    acc = None
    for t in (37.8, 38.4, 39.0, 39.6, 40.2):
        i = int(round((t - c["t0"]) * fps))
        tile = raw_tile("plant", c, files[i], i, fps)
        m = (tile.min(axis=2) >= 235).astype(np.uint8)
        m[:125] = 0; m[230:] = 0          # the headline band; the white roots start below it
        acc = m if acc is None else acc | m
    n, lab, st, _ = cv2.connectedComponentsWithStats(acc, connectivity=8)
    for k in range(1, n):
        cx = st[k, cv2.CC_STAT_LEFT] + st[k, cv2.CC_STAT_WIDTH] / 2
        # the i-dots are small; specks of stem and spray are small too, but only they sit on the stem
        if st[k, cv2.CC_STAT_AREA] < (150 if 160 < cx < 235 else 25):
            acc[lab == k] = 0
    _mask_cache["plant"] = cv2.dilate(acc, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) * 255
    return _mask_cache["plant"]


def eye_plate():
    """The eye photo without any burnt-in text: frame 70.0 (scale 1), with the headline's letters and the
    paragraph lines filled in smoothly from the soft skin around them (the eye is blurred there anyway)."""
    cx, cy, r = 322, 351, 290
    crop = frame(70.0)[cy - r:cy + r, cx - r:cx + r].copy()
    gray = crop.mean(axis=2)
    region = np.zeros(gray.shape, bool)
    region[290:, 370:] = True   # "goat" and its paragraphs sit in the lower right of the circle
    region[:130, 430:] = True   # and the small word "est" at the top right
    # only the ink: the blurred shading at the circle's edge is darker grey, and must stay
    ink = ((gray < 60) & region).astype(np.uint8)
    lines = np.zeros_like(ink)  # the paragraphs are hairlines of grey text at the bottom right
    hat = cv2.morphologyEx(gray.astype(np.uint8), cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))
    lines[380:, 360:] = hat[380:, 360:] > 18
    mask = cv2.dilate(ink | lines, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))) * 255
    # fill at a quarter of the size, where the diffusion has no texture to smear, then bring it back up
    small = cv2.resize(crop, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA)
    msmall = cv2.dilate(cv2.resize(mask, small.shape[1::-1], interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8))
    fill = cv2.GaussianBlur(cv2.resize(cv2.inpaint(small, msmall, 6, cv2.INPAINT_TELEA), crop.shape[1::-1], interpolation=cv2.INTER_CUBIC), (0, 0), 5)
    alpha = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 3)[..., None]
    return (crop * (1 - alpha) + fill * alpha).astype(np.uint8)


_plate = []


def eye_tile(c, tile, t):
    """From the moment the eye has grown to full size its photo does not change inside the circle, so the
    clean plate is used (placed at the clip's scale). While it is still growing and turning, the raw picture
    is kept with the little text on it painted out."""
    _, _, s = lerp_keys(c["keys"], t)
    h, w = tile.shape[:2]
    if s < 0.97:
        g = cv2.cvtColor(tile, cv2.COLOR_BGR2GRAY)
        ink = (g < 75).astype(np.uint8)
        ink[:, :int(w * 0.6)] = 0; ink[:int(h * 0.55)] = 0  # the text is at the lower right; the pupil must stay
        mask = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))) * 255
        return cv2.inpaint(tile, mask, 9, cv2.INPAINT_TELEA)
    if not _plate:
        _plate.append(eye_plate())
    # the circle (R=294) is a little wider than the photo crop (290): carry the rim outwards so no black ring shows
    plate = cv2.copyMakeBorder(_plate[0], 24, 24, 24, 24, cv2.BORDER_REPLICATE)
    k = s * w / (2 * (int(round(c["R"] * s)) + 4))
    size = int(round(plate.shape[0] * k))
    small = cv2.resize(plate, (size, size), interpolation=cv2.INTER_AREA)
    out = np.zeros_like(tile)
    x0 = int(round(w / 2 - 314 * k)); y0 = int(round(h / 2 - 314 * k))
    xs, ys = max(0, x0), max(0, y0)
    xe, ye = min(w, x0 + size), min(h, y0 + size)
    out[ys:ye, xs:xe] = small[ys - y0:ye - y0, xs - x0:xe - x0]
    return out


def make_tile(name, c, f, i, fps, files=None):
    tile = raw_tile(name, c, f, i, fps)
    if name == "eye":
        return eye_tile(c, tile, c["t0"] + i / fps)
    if name == "plant" and files is not None:
        t = c["t0"] + i / fps
        if HEADLINE_T[0] <= t <= HEADLINE_T[1]:
            if t < HEADLINE_Y[0][0]:
                mask = plant_headline_mask(c, files, fps)  # at rest: the same glyphs in every frame
            else:
                mask = rising_headline_mask(c, tile, t)
            tile = cv2.inpaint(tile, mask, 5, cv2.INPAINT_TELEA)
    return tile


def rising_headline_mask(c, tile, t):
    """While the headline rises with the plant, find its glyphs in this very frame: pure white, glyph-sized,
    inside the band where the measured path says the headline is."""
    _, cy, s = lerp_keys(c["keys"], t)
    k = tile.shape[1] / (2 * (int(round(c["R"] * s)) + 4))
    mid = tile.shape[0] / 2 + (lerp1(HEADLINE_Y, t) + 4 - cy) * k
    lo, hi = int(max(0, mid - 52)), int(min(tile.shape[0], mid + 36))
    m = np.zeros(tile.shape[:2], np.uint8)
    if hi <= lo:
        return m
    m[lo:hi] = (tile[lo:hi].min(axis=2) >= 235)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    for j in range(1, n):
        if st[j, cv2.CC_STAT_AREA] < 6 or st[j, cv2.CC_STAT_HEIGHT] > 62 or st[j, cv2.CC_STAT_WIDTH] > 75:  # the stem and roots are bigger than a glyph
            m[lab == j] = 0
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) * 255


def clip_meta(c, n, fps, cols, rows, cell):
    return dict(t0=c["t0"], t1=c["t1"], fps=fps, n=n, cols=cols, rows=rows,
                w=(c["box"][0] if "box" in c else c["R"] * 2), h=(c["box"][1] if "box" in c else c["R"] * 2),
                cell=list(cell), keys=c["keys"], round=c["round"])


def bake_clip(name, c):
    fps = c.get("fps", FPS)
    frames = extract(name, c["t0"], c["t1"], fps)
    n = len(frames)
    cell = c["cell"] if isinstance(c["cell"], tuple) else (c["cell"], c["cell"])
    cols = int(np.ceil(np.sqrt(n * cell[1] / cell[0])))
    rows = int(np.ceil(n / cols))
    has_alpha = bool(c.get("alpha") or c.get("keywhite"))
    sheet = np.zeros((rows * cell[1], cols * cell[0], 4 if has_alpha else 3), np.uint8)
    for i, f in enumerate(frames):
        tile = make_tile(name, c, f, i, fps, frames)
        col, row = i % cols, i // cols
        sheet[row * cell[1]:(row + 1) * cell[1], col * cell[0]:(col + 1) * cell[0]] = tile
    if has_alpha:
        Image.fromarray(cv2.cvtColor(sheet, cv2.COLOR_BGRA2RGBA)).save(f"public/seq/{name}.png", optimize=True)
        src = f"/seq/{name}.png"
    else:
        cv2.imwrite(f"public/seq/{name}.jpg", sheet, [cv2.IMWRITE_JPEG_QUALITY, 92])
        src = f"/seq/{name}.jpg"
    meta = dict(src=src, **clip_meta(c, n, fps, cols, rows, cell))
    print(name, n, "frames", cols, "x", rows)
    return meta


# the clips the backend serves frame by frame (the circles); the headline, hill and goat stay baked sheets
BACKEND_CLIPS = ["leapA", "cheer", "leapB", "plant", "eye"]
FRAME_CLIPS = BACKEND_CLIPS + ["hillrise", "goat"]  # the rising hill and the walking goat are frames too (the goat keeps its alpha as WebP)
BACKEND_FPS = 60  # the reference's own rate: the backend frames are every frame of the video, not a 24/12 fps pick
BACKEND_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "data")


def bake_frames(names):
    """Write every frame of the circle clips as its own JPEG for the backend, plus clips.json.

    Same extraction, crops and fps as bake_clip. The hand keys in CLIPS were later replaced by
    tracked paths (see merge_tracks), so the keys the shipped sheets were cropped with are the ones
    in src/seq.js; those are used here so a frame is the very picture the sheet cell holds.
    """
    shipped = json.loads(open("src/seq.js", encoding="utf-8").read().split("= ", 1)[1].rstrip(";\n"))
    meta_path = os.path.join(BACKEND_DATA, "clips.json")
    metas = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    for name in names:
        c = dict(CLIPS[name]); c["keys"] = shipped[name]["keys"]
        fps = BACKEND_FPS
        files = extract(name, c["t0"], c["t1"], fps)
        n = len(files)
        cell = c["cell"] if isinstance(c["cell"], tuple) else (c["cell"], c["cell"])
        d = os.path.join(BACKEND_DATA, "frames", name)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        ext = "webp" if c.get("alpha") else "jpg"
        for i, f in enumerate(files):
            tile = make_tile(name, c, f, i, fps, files)
            if ext == "webp":  # a keyed tile is BGRA from cv2; WebP keeps its alpha
                Image.fromarray(cv2.cvtColor(tile, cv2.COLOR_BGRA2RGBA)).save(os.path.join(d, f"{i:04d}.webp"), "WEBP", quality=92, method=4)
            else:
                cv2.imwrite(os.path.join(d, f"{i:04d}.jpg"), tile, [cv2.IMWRITE_JPEG_QUALITY, 92])
        cols = int(np.ceil(np.sqrt(n * cell[1] / cell[0])))
        metas[name] = dict(clip_meta(c, n, fps, cols, int(np.ceil(n / cols)), cell), ext=ext, kind="frames", updatedAt=int(time.time() * 1000))
        print(name, n, "frames ->", d)
    os.makedirs(BACKEND_DATA, exist_ok=True)
    # merged over whatever another bake wrote meanwhile: only these clips' entries change
    on_disk = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    on_disk.update({k: metas[k] for k in names})
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(on_disk, fh, indent=1)


HERO_CLIPS = ["hero1", "hero2"]


def bake_hero_frames(names):
    """The headline clips as backend frames at the video's own rate: every frame keyed against the page, enlarged
    twice with the clean edge hires.py draws, written as WebP with alpha (what hires.py made from the 12 fps sheets)."""
    import hires
    meta_path = os.path.join(BACKEND_DATA, "clips.json")
    metas = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    for name in names:
        c = CLIPS[name]
        fps = BACKEND_FPS
        files = extract(name, c["t0"], c["t1"], fps)
        n = len(files)
        d = os.path.join(BACKEND_DATA, "frames", name)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        for i, f in enumerate(files):
            tile = cv2.cvtColor(make_tile(name, c, f, i, fps), cv2.COLOR_BGRA2RGBA)  # the keyed tile is BGRA from cv2
            big = hires.enlarge(tile)
            Image.fromarray(big).save(os.path.join(d, f"{i:04d}.webp"), "WEBP", quality=92, method=4)
        cell = [c["cell"][0] * hires.UP, c["cell"][1] * hires.UP]
        metas[name] = dict(clip_meta(c, n, fps, 1, n, c["cell"]), cell=cell, ext="webp", kind="frames", locked=True,
                           updatedAt=int(time.time() * 1000))
        print(name, n, "frames ->", d)
    # merged over whatever another bake wrote meanwhile: only these clips' entries change
    on_disk = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    on_disk.update({k: metas[k] for k in names})
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(on_disk, fh, indent=1)


def sheet_from_frames(names):
    shipped = json.loads(open("src/seq.js", encoding="utf-8").read().split("= ", 1)[1].rstrip(";\n"))
    for name in names:
        m = shipped[name]
        cw, ch = m["cell"]
        sheet = np.zeros((m["rows"] * ch, m["cols"] * cw, 3), np.uint8)
        for i in range(m["n"]):
            tile = cv2.imread(os.path.join(BACKEND_DATA, "frames", name, f"{i:04d}.jpg"))
            sheet[(i // m["cols"]) * ch:(i // m["cols"] + 1) * ch, (i % m["cols"]) * cw:(i % m["cols"] + 1) * cw] = tile
        cv2.imwrite(f"public/seq/{name}.jpg", sheet, [cv2.IMWRITE_JPEG_QUALITY, 92])
        print(name, "sheet rebuilt from", m["n"], "frames")


def frame(t):
    p = f"cmp/ref_{t}.png"
    if not os.path.exists(p):
        subprocess.run([FF, "-v", "error", "-ss", str(t), "-i", VIDEO, "-frames:v", "1", "-y", p], check=True)
    return cv2.imread(p)


def bake_eye():
    img = frame(70.0)
    cx, cy, r = 322, 351, 290
    crop = img[cy - r:cy + r, cx - r:cx + r].copy()
    gray = crop.mean(axis=2)
    # the "g"/"o" of the headline sit in the lower-right of the circle, "est" top-right
    mask = np.zeros(gray.shape, np.uint8)
    region = np.zeros_like(mask, dtype=bool)
    region[290:, 370:] = True
    region[:130, 430:] = True
    mask[(gray < 150) & region] = 255
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8), iterations=3)
    out = cv2.inpaint(crop, mask, 16, cv2.INPAINT_NS)
    out = cv2.GaussianBlur(out, (0, 0), 1.2)
    out[mask == 0] = crop[mask == 0]
    cv2.imwrite("public/img/eye.png", out)
    print("eye inpainted", int(mask.sum() / 255), "px")


def bake_fill(name, t):
    img = frame(t)
    inside = (img.min(axis=2) < 225).astype(np.uint8)
    inside = cv2.erode(inside, np.ones((3, 3), np.uint8), iterations=2)
    src = np.where(inside > 0, 0, 255).astype(np.uint8)
    dist, labels = cv2.distanceTransformWithLabels(src, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(inside)
    lut_x = np.zeros(labels.max() + 1, np.int32); lut_y = np.zeros_like(lut_x)
    lut_x[labels[ys, xs]] = xs; lut_y[labels[ys, xs]] = ys
    out = img[lut_y[labels], lut_x[labels]]
    out[dist > 12] = 0
    cv2.imwrite(f"public/img/{name}.jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 86])
    print(name)


def merge_tracks():
    """Where track.py produced a clean per-frame path, prefer it over hand keys."""
    p = "cmp/track_clean.json"
    if not os.path.exists(p):
        return
    tr = json.load(open(p))
    for name, keys in tr.items():
        if name in CLIPS and len(keys) >= 30:
            c = CLIPS[name]
            # keep the hand-measured fade-in/out ends, replace the middle with the track
            head = [k for k in c["keys"] if k[0] < keys[0][0]]
            tail = [k for k in c["keys"] if k[0] > keys[-1][0]]
            c["keys"] = head + keys + tail
            print("track used for", name, len(keys), "frames")


if __name__ == "__main__":
    what = sys.argv[1:] or ["clips"]
    if "clips" in what:
        merge_tracks()
        only = [a for a in what if a in CLIPS]  # `bake.py clips plant hero1` re-bakes just those
        old = json.loads(open("src/seq.js", encoding="utf-8").read().split("= ", 1)[1].rstrip(";\n")) if only and os.path.exists("src/seq.js") else {}
        metas = {**old, **{n: bake_clip(n, c) for n, c in CLIPS.items() if not only or n in only}}
        with open("src/seq.js", "w", encoding="utf-8") as f:
            f.write("// generated by bake.py — do not edit\nexport const SEQ = " + json.dumps(metas) + ";\n")
    if "frames" in what:
        # `bake.py frames [leapA plant ...]` writes the backend's frame sequences (default: all circle clips)
        bake_frames([a for a in what if a in FRAME_CLIPS] or BACKEND_CLIPS)
    if "hero-frames" in what:
        # `bake.py hero-frames [hero1 hero2]`: the headline words as 60 fps backend frames
        bake_hero_frames([a for a in what if a in HERO_CLIPS] or HERO_CLIPS)
    if "sheet-from-frames" in what:
        # `bake.py sheet-from-frames plant`: rebuild the static fallback sheet from the backend's frames,
        # so both carry the same picture (src/seq.js is not touched: same frame count and layout)
        sheet_from_frames([a for a in what if a in BACKEND_CLIPS])
    if "eye" in what:
        bake_eye()  # legacy still; the page now uses the baked "eye" clip
    if "fills" in what:
        for name, t in (("fill-goat", 0.0), ("fill-dream", 5.0), ("fill-dream2", 50.0)):
            bake_fill(name, t)

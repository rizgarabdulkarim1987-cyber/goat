"""Tile reference-video frames at the given times into one labelled grid.

Usage: python grid.py out.png t1 t2 t3 ...   (4 tiles per row, 480x320 each)
"""
import subprocess, sys, os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
from PIL import Image, ImageDraw
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
VIDEO = r"C:\Users\pc\Downloads\Final Home Page Animation (1).mp4"
out, times = sys.argv[1], [float(t) for t in sys.argv[2:]]
os.makedirs("cmp", exist_ok=True)
TW, TH, COLS = 480, 320, 4
rows = (len(times) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * (TW + 4), rows * (TH + 20)), "#444")
d = ImageDraw.Draw(sheet)
for i, t in enumerate(times):
    ref = f"cmp/ref_{t}.png"
    if not os.path.exists(ref):
        subprocess.run([FF, "-v", "error", "-ss", str(t), "-i", VIDEO, "-frames:v", "1", "-y", ref], check=True)
    img = Image.open(ref).convert("RGB").resize((TW, TH))
    x, y = (i % COLS) * (TW + 4), (i // COLS) * (TH + 20)
    sheet.paste(img, (x, y + 16))
    d.text((x + 4, y + 2), f"t={t}", fill="#fff")
sheet.save(out)
print(out)

"""Side-by-side comparison: reference video frame (left) vs the site at the same second (right).

Usage: python compare.py [step] [start] [end]
Writes cmp/sheet_N.png (3 rows per sheet) and cmp/site_T.png for each captured second.
"""
import subprocess, sys, os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
from PIL import Image, ImageDraw
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
VIDEO = r"C:\Users\pc\Downloads\Final Home Page Animation (1).mp4"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
URL = "http://localhost:5190/?t={t}&cmp=1"
W, H = 1438, 960
OUT = "cmp"
os.makedirs(OUT, exist_ok=True)

step = float(sys.argv[1]) if len(sys.argv) > 1 else 2
start = float(sys.argv[2]) if len(sys.argv) > 2 else 0
end = float(sys.argv[3]) if len(sys.argv) > 3 else 78
times = []
t = start
while t <= end + 1e-9:
    times.append(round(t, 2))
    t += step

for t in times:
    ref = f"{OUT}/ref_{t}.png"
    site = f"{OUT}/site_{t}.png"
    if not os.path.exists(ref):
        subprocess.run([FF, "-v", "error", "-ss", str(t), "-i", VIDEO, "-frames:v", "1", "-y", ref], check=True)
    if not os.path.exists(site):
        subprocess.run([
            CHROME, "--headless=new", "--hide-scrollbars", "--disable-gpu", f"--window-size={W},{H}",
            "--virtual-time-budget=6000", f"--screenshot={os.path.abspath(site)}", URL.format(t=t),
        ], check=True, capture_output=True)

# build sheets: 3 rows, each row = ref | site, scaled to 719 px wide
sheet_tag = sys.argv[4] if len(sys.argv) > 4 else "sheet"
rows = []
for t in times:
    a = Image.open(f"{OUT}/ref_{t}.png").convert("RGB").resize((719, 480))
    b = Image.open(f"{OUT}/site_{t}.png").convert("RGB").resize((719, 480))
    row = Image.new("RGB", (1438 + 8, 480 + 24), "#444")
    row.paste(a, (0, 24)); row.paste(b, (727, 24))
    d = ImageDraw.Draw(row)
    d.text((6, 4), f"t={t}s  VIDEO", fill="#fff"); d.text((733, 4), f"t={t}s  SITE", fill="#fff")
    rows.append(row)

for i in range(0, len(rows), 3):
    chunk = rows[i:i + 3]
    sheet = Image.new("RGB", (1446, 504 * len(chunk)), "#444")
    for j, r in enumerate(chunk):
        sheet.paste(r, (0, j * 504))
    sheet.save(f"{OUT}/{sheet_tag}_{i // 3 + 1:02d}.png")
print("sheets:", len(range(0, len(rows), 3)))

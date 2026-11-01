import express from "express";
import multer from "multer";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FFMPEG = process.env.FFMPEG_PATH || ffmpegPath || "ffmpeg";
const MAX_FRAMES = 720;
const IMAGE_TYPES = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg" };
const SHEET_TYPES = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const ADMIN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "admin");

// every loose picture of the home page: name -> what it is
// pictures that sit in a circle on the site: whatever is uploaded is cut to a centred square, scaled down to at most 800 px
// and given a round edge (transparent corners), so it fits the circular place whatever shape it came in
const CIRCLE_KEYS = new Set(["logoCircle"]);
const ROUND = String.raw`crop=min(iw\,ih):min(iw\,ih),scale=min(800\,iw):min(800\,iw),format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip(W/2-hypot(X-W/2\,Y-H/2)\,0\,1)'`;
const IMAGE_LABELS = { logoCircle: "logo, circle", logoText: "logo, wordmark" };

const run = (args) => new Promise((resolve, reject) => {
  const p = spawn(FFMPEG, ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => { err += d; });
  p.on("error", reject);
  p.on("close", (code) => (code === 0 ? resolve() : reject(Object.assign(new Error(`ffmpeg could not read that file: ${err.trim().split("\n").pop() || code}`), { status: 422 }))));
});

export function mountAdmin(app, { DATA, readJson, writeJson, admin, wrap, origin, LANGS, langOf }) {
  const tmp = path.join(os.tmpdir(), "goat-upload");
  const upload = multer({ dest: tmp, limits: { fileSize: 500 * 1024 * 1024, files: MAX_FRAMES } });
  const clean = (files) => Promise.all((files || []).map((f) => rm(f.path, { force: true })));
  // multer's own errors (file too big, too many files) are the sender's mistake, not ours
  const guard = (mw) => (req, res, next) => mw(req, res, (err) => (err ? res.status(413).json({ error: err.message }) : next()));

  /* ---------- the admin page ---------- */
  app.use("/admin", express.static(ADMIN_DIR, { index: "index.html" }));
  app.get("/api/admin/check", admin, (req, res) => res.json({ ok: true }));

  /* ---------- every word on the home page ---------- */
  const mediaUrl = async (req, file) => {
    const s = await stat(path.join(DATA, "media", file));
    return `${origin(req)}/media/${file}?v=${Math.round(s.mtimeMs)}`;
  };
  // English lives in content.json / content.defaults.json; the other languages in content.<lang>.json / content.defaults.<lang>.json,
  // and anything a language does not have yet shows in English
  const contentFile = (lang, defaults) => `content${defaults ? ".defaults" : ""}${lang === "en" ? "" : `.${lang}`}.json`;
  const readTexts = async (lang, defaults) => {
    const en = (await readJson(contentFile("en", defaults))).texts;
    if (lang === "en") return en;
    const other = await readJson(contentFile(lang, defaults)).catch((err) => { if (err.code === "ENOENT") return { texts: {} }; throw err; });
    return { ...en, ...other.texts };
  };
  app.get("/api/content", wrap(async (req, res) => {
    const lang = langOf(req);
    const [texts, media] = await Promise.all([readTexts(lang, false), readJson("media.json")]);
    const images = {};
    for (const [key, file] of Object.entries(media)) images[key] = await mediaUrl(req, file);
    res.json({ lang, dir: lang === "en" ? "ltr" : "rtl", langs: LANGS, texts, images });
  }));
  app.get("/api/content/defaults", admin, wrap(async (req, res) => res.json(await readTexts(langOf(req), true))));
  // body: { texts: { id: "new words" | null } } with ?lang=ar|ckb (English when omitted); null puts the original words back
  app.put("/api/content", admin, wrap(async (req, res) => {
    const lang = langOf(req);
    const [current, defaults, english] = await Promise.all([readTexts(lang, false), readTexts(lang, true), readTexts("en", true)]);
    const incoming = req.body?.texts;
    if (!incoming || typeof incoming !== "object") return res.status(400).json({ error: "send { texts: { id: text } }" });
    for (const [id, value] of Object.entries(incoming)) {
      if (!(id in english)) return res.status(400).json({ error: `unknown text "${id}"` });
      if (value !== null && (typeof value !== "string" || value.length > 4000)) return res.status(400).json({ error: `"${id}" must be text up to 4000 characters` });
      current[id] = value === null ? defaults[id] : value;
    }
    await writeJson(contentFile(lang, false), { texts: current });
    res.json({ lang, texts: current });
  }));

  /* ---------- pictures: the loose images and the baked sheets ---------- */
  app.get("/api/media", wrap(async (req, res) => {
    const [media, clips] = await Promise.all([readJson("media.json"), readJson("clips.json")]);
    const items = [];
    for (const [key, file] of Object.entries(media)) items.push({ key, label: IMAGE_LABELS[key] || key, kind: "image", url: await mediaUrl(req, file) });
    for (const [key, c] of Object.entries(clips)) {
      if (c.kind === "sheet") items.push({ key, label: `${key} (sprite sheet, ${c.cols} x ${c.rows} cells of ${c.cell.join(" x ")})`, kind: "sheet", url: await mediaUrl(req, c.file), cols: c.cols, rows: c.rows, cell: c.cell });
    }
    res.json(items);
  }));
  app.put("/api/media/:key", admin, guard(upload.single("file")), wrap(async (req, res) => {
    const { key } = req.params;
    const f = req.file;
    try {
      if (!f) return res.status(400).json({ error: "send the picture as multipart field \"file\"" });
      const [media, clips] = await Promise.all([readJson("media.json"), readJson("clips.json")]);
      const isSheet = clips[key]?.kind === "sheet";
      if (!isSheet && !(key in media)) return res.status(404).json({ error: "unknown picture" });
      const ext = (isSheet ? SHEET_TYPES : IMAGE_TYPES)[f.mimetype];
      if (!ext) return res.status(415).json({ error: `use ${Object.keys(isSheet ? SHEET_TYPES : IMAGE_TYPES).join(", ")}` });
      const dir = isSheet ? "seq" : "";
      // a circular place gets a round picture (an SVG logo is already a drawing and is kept as it is)
      const round = !isSheet && CIRCLE_KEYS.has(key) && f.mimetype !== "image/svg+xml";
      const name = `${key}-${Date.now()}${round ? ".png" : ext}`;
      await mkdir(path.join(DATA, "media", dir), { recursive: true });
      if (round) await run(["-i", f.path, "-vf", ROUND, "-frames:v", "1", path.join(DATA, "media", name)]);
      else await copyFile(f.path, path.join(DATA, "media", dir, name));
      const rel = dir ? `${dir}/${name}` : name;
      const old = isSheet ? clips[key].file : media[key];
      if (isSheet) { clips[key].file = rel; clips[key].updatedAt = Date.now(); await writeJson("clips.json", clips); }
      else { media[key] = rel; await writeJson("media.json", media); }
      // keep the shipped originals; remove only pictures that were uploaded here
      if (/-\d{13}\.\w+$/.test(old)) await rm(path.join(DATA, "media", old), { force: true });
      res.json({ key, url: await mediaUrl(req, rel) });
    } finally { await clean(req.file ? [req.file] : []); }
  }));

  /* ---------- work, blog and team: whole lists, edited per language ---------- */
  // <name>.json is English, <name>.<lang>.json the other languages. A list can be empty (the pages show a plain message).
  const str = (max, min = 0) => (v) => typeof v === "string" && v.trim().length >= min && v.length <= max;
  const slug = (v) => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(v);
  const file = (v) => v === undefined || v === "" || (typeof v === "string" && /^[\w.-]{1,120}$/.test(v));
  const list = (maxItems, item) => (v) => Array.isArray(v) && v.length <= maxItems && v.every(item);
  const COLLECTIONS = {
    work: { key: "slug", shape: { slug, title: str(120, 1), client: str(120), year: (v) => Number.isInteger(v) && v >= 1990 && v <= 2100, category: str(40, 1), summary: str(400), body: str(4000), tags: list(12, str(40, 1)), image: file } },
    blog: { key: "slug", shape: { slug, title: str(160, 1), date: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v), author: str(80), tags: list(12, str(40, 1)), excerpt: str(400), body: list(40, str(4000)), image: file } },
    team: { key: "id", shape: { id: slug, name: str(80, 1), role: str(120), photo: file } },
  };
  const collection = (req, res, next) => (COLLECTIONS[req.params.name] ? next() : res.status(404).json({ error: "unknown list" }));
  const collectionFile = (name, lang) => `${name}${lang === "en" ? "" : `.${lang}`}.json`;
  // the raw list of one language; a language with no file of its own starts from the English one
  app.get("/api/admin/collection/:name", admin, collection, wrap(async (req, res) => {
    const lang = langOf(req), name = req.params.name;
    const own = lang === "en" ? null : await readJson(collectionFile(name, lang)).catch((err) => { if (err.code === "ENOENT") return null; throw err; });
    res.json({ lang, translated: lang === "en" || Boolean(own), items: own || await readJson(`${name}.json`) });
  }));
  app.put("/api/admin/collection/:name", admin, collection, wrap(async (req, res) => {
    const { key, shape } = COLLECTIONS[req.params.name];
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length > 200) return res.status(400).json({ error: "send { items: [...] } with at most 200 items" });
    const seen = new Set();
    for (const [i, it] of items.entries()) {
      if (!it || typeof it !== "object") return res.status(400).json({ error: `item ${i + 1} is not an object` });
      for (const [field, ok] of Object.entries(shape)) {
        if (!ok(it[field])) return res.status(400).json({ error: `item ${i + 1}: "${field}" is missing or not valid` });
      }
      if (seen.has(it[key])) return res.status(400).json({ error: `two items share the ${key} "${it[key]}"` });
      seen.add(it[key]);
    }
    // keep only the known fields, so nothing unexpected is stored (an empty picture is simply dropped)
    const clean = items.map((it) => Object.fromEntries(Object.keys(shape).filter((f) => it[f] !== undefined && it[f] !== "").map((f) => [f, typeof it[f] === "string" ? it[f].trim() : it[f]])));
    await writeJson(collectionFile(req.params.name, langOf(req)), clean);
    res.json({ lang: langOf(req), items: clean });
  }));
  // a picture for a project, a post or a team member: "square" is cut to a centred 700 px square, "wide" is scaled to at most 1600 px wide
  app.post("/api/admin/image", admin, guard(upload.single("file")), wrap(async (req, res) => {
    const f = req.file;
    try {
      if (!f) return res.status(400).json({ error: "send the picture as multipart field \"file\"" });
      if (!SHEET_TYPES[f.mimetype]) return res.status(415).json({ error: "use png, jpg or webp" });
      const vf = req.query.shape === "square" ? String.raw`crop=min(iw\,ih):min(iw\,ih),scale=700:700:flags=lanczos` : String.raw`scale=min(1600\,iw):-2:flags=lanczos`;
      const name = `up-${Date.now()}.jpg`;
      await mkdir(path.join(DATA, "media"), { recursive: true });
      await run(["-i", f.path, "-vf", vf, "-frames:v", "1", "-q:v", "3", path.join(DATA, "media", name)]);
      res.json({ file: name, url: await mediaUrl(req, name) });
    } finally { await clean(req.file ? [req.file] : []); }
  }));

  /* ---------- circles: change the clip's timing, or replace its frames with a video or a set of pictures ---------- */
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  app.put("/api/clips/:name", admin, wrap(async (req, res) => {
    const clips = await readJson("clips.json");
    const c = clips[req.params.name];
    if (!c) return res.status(404).json({ error: "unknown clip" });
    const { t0 = c.t0, t1 = c.t1, fps = c.fps, keys = c.keys } = req.body || {};
    if (![t0, t1, fps].every(isNum) || t0 < 0 || t1 > 78 || t1 <= t0) return res.status(400).json({ error: "t0 and t1 are seconds on the 0-78 timeline, t1 after t0; fps is a number" });
    if (fps < 1 || fps > 60) return res.status(400).json({ error: "fps must be 1-60" });
    const keysOk = Array.isArray(keys) && keys.length > 0 && keys.every((k, i) => Array.isArray(k) && k.length === 4 && k.every(isNum) && (i === 0 || k[0] >= keys[i - 1][0]));
    if (!keysOk) return res.status(400).json({ error: "keys are [time, x, y, scale] rows, in time order" });
    Object.assign(c, { t0, t1, fps, keys, updatedAt: Date.now() });
    await writeJson("clips.json", clips);
    res.json(c);
  }));

  async function replaceFrames(name, produce) {
    const clips = await readJson("clips.json");
    const c = clips[name];
    const [cw, ch] = c.cell;
    const framesDir = path.join(DATA, "frames");
    const fresh = path.join(framesDir, `${name}.new`);
    await rm(fresh, { recursive: true, force: true });
    await mkdir(fresh, { recursive: true });
    try {
      await produce({ dir: fresh, fps: c.fps, square: `crop=min(iw\\,ih):min(iw\\,ih),scale=${cw}:${ch}:flags=lanczos` });
      const made = (await readdir(fresh)).filter((f) => f.endsWith(".jpg")).sort();
      const n = made.length;
      // the site asks for 0000.jpg ... (n-1).jpg, so anything else is a bug here, not something to publish
      if (made.some((f, i) => f !== `${String(i).padStart(4, "0")}.jpg`)) throw Object.assign(new Error("the frames came out misnumbered"), { status: 500 });
      if (n === 0) throw Object.assign(new Error("no frames came out of that file"), { status: 422 });
      await rm(path.join(framesDir, `${name}.old`), { recursive: true, force: true });
      await rename(path.join(framesDir, name), path.join(framesDir, `${name}.old`)).catch(() => {});
      await rename(fresh, path.join(framesDir, name));
      await rm(path.join(framesDir, `${name}.old`), { recursive: true, force: true });
      const cols = Math.ceil(Math.sqrt((n * ch) / cw));
      Object.assign(c, { n, cols, rows: Math.ceil(n / cols), ext: "jpg", updatedAt: Date.now() });
      await writeJson("clips.json", clips);
      return c;
    } catch (err) {
      await rm(fresh, { recursive: true, force: true });
      throw err;
    }
  }
  const circleOnly = wrap(async (req, res, next) => {
    const c = (await readJson("clips.json"))[req.params.name];
    if (!c) return res.status(404).json({ error: "unknown clip" });
    if (c.locked) return res.status(400).json({ error: "the headline words are part of the page design and cannot be replaced here" });
    if (c.kind !== "frames") return res.status(400).json({ error: "that one is a sprite sheet: replace it under pictures" });
    next();
  });
  // optional ?fit=1 moves the clip's end time to the end of the new footage; otherwise the timeline is left alone
  async function afterUpload(req, c) {
    if (req.query.fit === "1") {
      const clips = await readJson("clips.json");
      clips[req.params.name].t1 = Math.min(78, +(c.t0 + (c.n - 1) / c.fps).toFixed(3));
      await writeJson("clips.json", clips);
      return clips[req.params.name];
    }
    return c;
  }

  // a video: its frames are cut at the clip's fps, centre-cropped to a square and scaled to the clip's size
  app.post("/api/clips/:name/video", admin, circleOnly, guard(upload.single("file")), wrap(async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "send the video as multipart field \"file\"" });
      const from = Number(req.query.from) || 0;
      const c = await replaceFrames(req.params.name, ({ dir, fps, square }) =>
        run(["-ss", String(from), "-i", req.file.path, "-vf", `fps=${fps},${square}`, "-frames:v", String(MAX_FRAMES), "-q:v", "3", "-start_number", "0", path.join(dir, "%04d.jpg")]));
      res.json(await afterUpload(req, c));
    } finally { await clean(req.file ? [req.file] : []); }
  }));
  // a set of pictures, in file-name order, each centre-cropped and scaled the same way
  app.post("/api/clips/:name/frames", admin, circleOnly, guard(upload.array("files", MAX_FRAMES)), wrap(async (req, res) => {
    try {
      const files = [...(req.files || [])].sort((a, b) => a.originalname.localeCompare(b.originalname, undefined, { numeric: true }));
      if (!files.length) return res.status(400).json({ error: "send the pictures as multipart field \"files\"" });
      if (files.some((f) => !f.mimetype.startsWith("image/"))) return res.status(415).json({ error: "only pictures, please" });
      const c = await replaceFrames(req.params.name, async ({ dir, square }) => {
        for (const [i, f] of files.entries()) await run(["-i", f.path, "-vf", square, "-q:v", "3", "-frames:v", "1", path.join(dir, `${String(i).padStart(4, "0")}.jpg`)]);
      });
      res.json(await afterUpload(req, c));
    } finally { await clean(req.files); }
  }));
}

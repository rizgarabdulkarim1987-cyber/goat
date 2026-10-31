import express from "express";
import cors from "cors";
import { readFile, writeFile, rename } from "node:fs/promises";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mountAdmin } from "./admin.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLED = path.join(ROOT, "data");
// where words, pictures, frames and messages live. DATA_DIR puts them outside the deployed folder so a new deploy never overwrites
// what was edited in the admin page; the first start copies the bundled data there
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : BUNDLED;
if (DATA !== BUNDLED) {
  // synchronous on purpose: the host loads this file with require(), which cannot wait for a top-level await
  if (!existsSync(path.join(DATA, "clips.json"))) cpSync(BUNDLED, DATA, { recursive: true });
  else applyRelease();
}
// A new deploy can ship better pictures for some clips (data/release.json: { version, replace: [clip names] }).
// When its version is newer than the one this data folder has applied, those clips' frames, sheets and metadata are
// replaced; everything else edited in the admin page (words, other pictures, messages) is left alone.
function applyRelease() {
  const read = (dir) => { try { return JSON.parse(readFileSync(path.join(dir, "release.json"), "utf8")); } catch { return { version: 0, replace: [] }; } };
  const shipped = read(BUNDLED), have = read(DATA);
  if (!(shipped.version > have.version)) return;
  const clips = JSON.parse(readFileSync(path.join(DATA, "clips.json"), "utf8"));
  const fresh = JSON.parse(readFileSync(path.join(BUNDLED, "clips.json"), "utf8"));
  for (const name of shipped.replace) {
    if (!fresh[name]) continue;
    clips[name] = fresh[name];
    const frames = path.join(BUNDLED, "frames", name);
    if (existsSync(frames)) { rmSync(path.join(DATA, "frames", name), { recursive: true, force: true }); cpSync(frames, path.join(DATA, "frames", name), { recursive: true }); }
    if (fresh[name].file) { mkdirSync(path.dirname(path.join(DATA, "media", fresh[name].file)), { recursive: true }); cpSync(path.join(BUNDLED, "media", fresh[name].file), path.join(DATA, "media", fresh[name].file)); }
  }
  writeFileSync(path.join(DATA, "clips.json"), JSON.stringify(clips, null, 2));
  writeFileSync(path.join(DATA, "release.json"), JSON.stringify(shipped));
}
// the built site (goat-site/dist), when there is one, is served from the same server: one address for pages and API
const SITE = path.join(ROOT, "..", "goat-site", "dist");
const PORT = Number(process.env.PORT || 4100);
// who may edit counters and read messages; set ADMIN_KEY in the environment for anything beyond local use
// In production there is no default key: without ADMIN_KEY nobody can sign in.
const PRODUCTION = process.env.NODE_ENV === "production";
const ADMIN_KEY = process.env.ADMIN_KEY || (PRODUCTION ? "" : "goat-admin");
if (PRODUCTION && !ADMIN_KEY) console.warn("ADMIN_KEY is not set: the admin page and every edit are disabled");
// browsers allowed to call the API (comma separated); any origin when unset, which is fine for local work
const ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const COUNTER_KEYS = ["Prject", "client", "staff", "years"];
// the site speaks English, Arabic and Sorani Kurdish; a page file for another language is <name>.<lang>.json and falls back to English
const LANGS = ["en", "ar", "ckb"];

const readJson = async (name) => JSON.parse(await readFile(path.join(DATA, name), "utf8"));
const langOf = (req) => (LANGS.includes(req.query.lang) ? req.query.lang : "en");
async function readLang(name, lang) {
  if (lang === "en") return readJson(name);
  try { return await readJson(name.replace(/\.json$/, `.${lang}.json`)); } catch (err) { if (err.code !== "ENOENT") throw err; return readJson(name); }
}
// write through a temp file so a crash never leaves half a JSON file behind
async function writeJson(name, value) {
  const file = path.join(DATA, name);
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${file}.tmp`, file);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // behind the host's https proxy: urls the API hands out keep https
app.use(cors(ORIGINS.length ? { origin: ORIGINS } : undefined));
app.use(express.json({ limit: "32kb" }));

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const admin = (req, res, next) => {
  const key = req.get("x-admin-key") || req.query.key;
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(401).json({ error: "admin key required" });
  next();
};

app.get("/api", (req, res) => res.json({
  name: "goat backend",
  endpoints: ["/api/health", "/api/clips", "/api/clips/:name", "/frames/<clip>/0000.jpg", "/api/counters", "/api/work", "/api/blog", "/api/about", "/api/music", "/api/social", "/api/search?q=", "POST /api/contact", "/api/content", "/admin"],
  languages: LANGS,
  note: "add ?lang=ar or ?lang=ckb to the page, content, search and contact endpoints",
}));
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* ---------- circle frame sequences ---------- */
// frames live in data/frames/<clip>/0000.jpg ...; clips.json holds the metadata bake.py wrote.
// kind "frames": one jpg per frame. kind "sheet": one sprite sheet (the headline, hill and walking goat).
app.use("/frames", express.static(path.join(DATA, "frames"), { maxAge: "1h", index: false }));
app.use("/media", express.static(path.join(DATA, "media"), { maxAge: "1h", index: false }));

const origin = (req) => `${req.protocol}://${req.get("host")}`;
// ?v= changes whenever a clip or picture is replaced, so browsers never show a stale one
function publicClip(req, name, meta) {
  const v = meta.updatedAt || 0;
  if (meta.kind === "sheet") {
    const { file, ...rest } = meta;
    return { ...rest, src: `${origin(req)}/media/${file}?v=${v}` };
  }
  const base = `${origin(req)}/frames/${name}`;
  return { ...meta, frames: Array.from({ length: meta.n }, (_, i) => `${base}/${String(i).padStart(4, "0")}.${meta.ext || "jpg"}?v=${v}`) };
}
app.get("/api/clips", wrap(async (req, res) => {
  const clips = await readJson("clips.json");
  res.json(Object.fromEntries(Object.entries(clips).map(([name, meta]) => [name, publicClip(req, name, meta)])));
}));
app.get("/api/clips/:name", wrap(async (req, res) => {
  const meta = (await readJson("clips.json"))[req.params.name];
  if (!meta) return res.status(404).json({ error: "unknown clip" });
  res.json(publicClip(req, req.params.name, meta));
}));

/* ---------- end-of-page counters ---------- */
app.get("/api/counters", wrap(async (req, res) => res.json(await readJson("counters.json"))));
app.put("/api/counters", admin, wrap(async (req, res) => {
  const next = { ...(await readJson("counters.json")) };
  for (const k of COUNTER_KEYS) {
    if (req.body?.[k] === undefined) continue;
    const v = Number(req.body[k]);
    if (!Number.isInteger(v) || v < 0 || v > 999) return res.status(400).json({ error: `${k} must be a whole number from 0 to 999` });
    next[k] = v;
  }
  await writeJson("counters.json", next);
  res.json(next);
}));

/* ---------- pages: about, work, blog, music, social ---------- */
app.get("/api/about", wrap(async (req, res) => res.json(await readLang("about.json", langOf(req)))));
app.get("/api/music", wrap(async (req, res) => res.json(await readLang("music.json", langOf(req)))));
app.get("/api/social", wrap(async (req, res) => res.json(await readLang("social.json", langOf(req)))));

app.get("/api/work", wrap(async (req, res) => {
  const list = await readLang("work.json", langOf(req));
  res.json(req.query.category ? list.filter((w) => w.category === req.query.category) : list);
}));
app.get("/api/work/:slug", wrap(async (req, res) => {
  const item = (await readLang("work.json", langOf(req))).find((w) => w.slug === req.params.slug);
  item ? res.json(item) : res.status(404).json({ error: "no such work" });
}));

app.get("/api/blog", wrap(async (req, res) => {
  const list = (await readLang("blog.json", langOf(req))).sort((a, b) => b.date.localeCompare(a.date));
  // the list carries no bodies: the post page asks for one
  res.json(list.map(({ body, ...rest }) => rest));
}));
app.get("/api/blog/:slug", wrap(async (req, res) => {
  const post = (await readLang("blog.json", langOf(req))).find((p) => p.slug === req.params.slug);
  post ? res.json(post) : res.status(404).json({ error: "no such post" });
}));

app.get("/api/search", wrap(async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json([]);
  const [work, blog, about] = await Promise.all([readLang("work.json", langOf(req)), readLang("blog.json", langOf(req)), readLang("about.json", langOf(req))]);
  const hit = (...parts) => parts.join(" ").toLowerCase().includes(q);
  res.json([
    ...work.filter((w) => hit(w.title, w.client, w.summary, w.body, w.tags.join(" "))).map((w) => ({ type: "work", title: w.title, text: w.summary, url: `/work.html#${w.slug}` })),
    ...blog.filter((p) => hit(p.title, p.excerpt, p.body.join(" "), p.tags.join(" "))).map((p) => ({ type: "blog", title: p.title, text: p.excerpt, url: `/blog.html?post=${p.slug}` })),
    ...about.sections.filter((s) => hit(s.title, s.text)).map((s) => ({ type: "about", title: s.title, text: s.text, url: "/about.html" })),
  ]);
}));

/* ---------- contact form ---------- */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_ERRORS = {
  en: { name: "tell us your name", email: "that email does not look right", message: "write a few words (10 to 4000 characters)" },
  ar: { name: "أخبرنا باسمك", email: "البريد الإلكتروني غير صحيح", message: "اكتب بضع كلمات (من 10 إلى 4000 حرف)" },
  ckb: { name: "ناوەکەت پێمان بڵێ", email: "ئیمەیڵەکە دروست نییە", message: "چەند وشەیەک بنووسە (١٠ بۆ ٤٠٠٠ پیت)" },
};
const lastByIp = new Map();
app.post("/api/contact", wrap(async (req, res) => {
  const { name = "", email = "", message = "", topic = "", website = "" } = req.body || {};
  if (website) return res.status(201).json({ ok: true }); // honeypot: bots fill the hidden field
  const clean = { name: String(name).trim(), email: String(email).trim(), topic: String(topic).trim().slice(0, 60), message: String(message).trim() };
  const errors = {}, say = FIELD_ERRORS[langOf(req)];
  if (clean.name.length < 2 || clean.name.length > 80) errors.name = say.name;
  if (!EMAIL.test(clean.email) || clean.email.length > 120) errors.email = say.email;
  if (clean.message.length < 10 || clean.message.length > 4000) errors.message = say.message;
  if (Object.keys(errors).length) return res.status(422).json({ error: "invalid", errors });
  const now = Date.now();
  if (now - (lastByIp.get(req.ip) || 0) < 5000) return res.status(429).json({ error: "slow down a little" });
  lastByIp.set(req.ip, now);
  const messages = await readJson("messages.json").catch((err) => { if (err.code === "ENOENT") return []; throw err; });
  const saved = { id: now.toString(36), receivedAt: new Date(now).toISOString(), ...clean };
  messages.push(saved);
  await writeJson("messages.json", messages);
  res.status(201).json({ ok: true, id: saved.id });
}));
app.get("/api/messages", admin, wrap(async (req, res) => res.json(await readJson("messages.json").catch((err) => { if (err.code === "ENOENT") return []; throw err; }))));

mountAdmin(app, { DATA, readJson, writeJson, admin, wrap, origin, LANGS, langOf });

app.use("/api", (req, res) => res.status(404).json({ error: "not found" }));
app.use(express.static(SITE, { maxAge: "1h", extensions: ["html"] }));
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "bad json" });
  console.error(err);
  res.status(500).json({ error: "server error" });
});

// listens when run directly, and always in production (a host's process manager starts the entry file through its own loader)
if (process.argv[1] === fileURLToPath(import.meta.url) || PRODUCTION) {
  app.listen(PORT, () => console.log(`goat on http://localhost:${PORT}  (admin key: ${process.env.ADMIN_KEY ? "from ADMIN_KEY" : ADMIN_KEY ? "default 'goat-admin'" : "none, admin disabled"}; data: ${DATA})`));
}
export default app;

import { api } from "./api.js";
import { setContent } from "./lang.js";

/* The circle pictures (plant, runners, eye) come from the backend as one JPEG per frame.
   Each clip keeps the metadata the baked sheets have (t0, t1, fps, n, cols, rows, w, h, keys, round),
   so the timeline never changes; only the way a frame is drawn does. If the backend does not answer,
   or a clip's first frame cannot be fetched, that clip keeps its static sprite sheet from /public/seq. */

const BACKEND = ["leapA", "cheer", "leapB", "plant", "eye", "hero1", "hero2", "hillrise", "goat", "can1", "can2", "can3", "can4"]; // can1..can4: the four circles of the work scene
const SHEETS = ["goat", "hillrise"]; // a clip the backend still holds as a sprite sheet (older data folders): the sheet is used as the picture
const PARALLEL = 8;

// Only a few frames of a clip are kept decoded at once: all of them together are over a gigabyte of pixels,
// which a phone cannot hold (the tab is killed). The ones near the current frame stay; the browser's own cache
// keeps the files, so a frame that was dropped comes back quickly.
const LITE = matchMedia("(max-width: 820px)").matches;
// the frames are every frame of the video (60 a second), so a scroll flick crosses dozens of them: a wide window
// stays decoded around the current one and the next ones are asked for ahead of the scroll
const KEEP = LITE ? 16 : 72;
const AHEAD = LITE ? [1, 2, 3, 4, -1] : [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, -1, -2, -4, -8];
// On a phone a frame is decoded as an ImageBitmap at half size and closed when it is dropped: iOS keeps the pixels of
// an <img> in its own cache after src is cleared, so dropping those never gave the memory back and the tab was killed.
const BITMAPS = LITE && typeof createImageBitmap === "function";
let held = 0; // decoded frames alive right now, across every clip (shown by ?diag)
function makeFrames(meta, keepAll = false) {
  const images = new Array(meta.n);
  const listeners = new Set();
  let cur = 0;
  const drop = (k) => { const e = images[k]; images[k] = undefined; if (e.img instanceof Image) e.img.src = ""; else e.img?.close?.(); held -= 1; };
  const evict = () => {
    if (keepAll) return;
    const have = [];
    images.forEach((e, k) => { if (e?.ok) have.push(k); });
    if (have.length <= KEEP) return;
    have.sort((a, b) => Math.abs(b - cur) - Math.abs(a - cur));
    for (const k of have.slice(0, have.length - KEEP)) drop(k);
  };
  const load = (i) => {
    if (images[i]) return images[i].done;
    const entry = { img: null, ok: false };
    const arrived = () => { entry.ok = true; evict(); listeners.forEach((f) => f(i)); held += 1; dispatchEvent(new CustomEvent("goat-frame", { detail: held })); return true; };
    const failed = () => { setTimeout(() => { if (images[i] === entry) images[i] = undefined; }, 700); return false; }; // a frame the host refused is asked for again, not given up on
    if (BITMAPS) {
      entry.done = fetch(meta.frames[i]).then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((b) => createImageBitmap(b, { resizeWidth: Math.round(meta.cell[0] / 2), resizeHeight: Math.round(meta.cell[1] / 2), resizeQuality: "high" }))
        .then((bmp) => { if (images[i] !== entry) { bmp.close(); return false; } entry.img = bmp; return arrived(); }, failed);
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous"; // the page reads the frame's pixels (to find the disc's edge): a frame from another origin must come with CORS, or the canvas is tainted
      entry.img = img;
      entry.done = new Promise((resolve) => { img.onload = () => resolve(arrived()); img.onerror = () => resolve(failed()); });
      img.src = meta.frames[i];
    }
    images[i] = entry;
    return entry.done;
  };
  return {
    load,
    // the picture to draw for frame i: itself, else the closest earlier one that has arrived, else a later one
    best(i) {
      cur = i;
      load(i);
      if (!keepAll) for (const d of AHEAD) if (i + d >= 0 && i + d < meta.n) load(i + d);
      if (images[i]?.ok) return images[i].img;
      for (let k = i - 1; k >= 0; k--) if (images[k]?.ok) return images[k].img;
      for (let k = i + 1; k < meta.n; k++) if (images[k]?.ok) return images[k].img;
      return null;
    },
    onLoad(f) { listeners.add(f); },
  };
}

// a capture (compare.py) needs every frame; the site itself fetches frames as the scroll reaches them
function streamAll(clips) {
  const queue = clips.flatMap((c) => Array.from({ length: c.n }, (_, i) => () => c.frameSet.load(i)));
  let next = 0;
  const worker = async () => { while (next < queue.length) await queue[next++](); };
  return Promise.all(Array.from({ length: PARALLEL }, worker));
}

// On a desktop every frame file is pulled into the browser's cache in the background, in page order, a few at a
// time and only while the network is otherwise idle: a frame the scroll reaches is then decoded from the cache
// instead of waiting for the host. Nothing is decoded here, so it costs no memory. A phone does not do this.
function warmCache(clips) {
  if (LITE || !("fetch" in window)) return;
  const urls = clips.flatMap((c) => c.frames);
  let next = 0;
  const idle = (f) => ("requestIdleCallback" in window ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 50));
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try { await fetch(url, { priority: "low", cache: "force-cache" }); } catch { /* the scroll's own request will retry it */ }
    }
  };
  idle(() => { for (let k = 0; k < 3; k++) worker(); });
}

/** Merge the backend's clips over the static metadata. Resolves with { SEQ, loaded } where `loaded`
 *  resolves once every frame has been requested (the page does not wait for it unless asked to). */
export async function loadSeq(staticSeq, { all = false } = {}) {
  const SEQ = { ...staticSeq };
  let remote;
  try { remote = await api("/api/clips"); } catch { return { SEQ, loaded: Promise.resolve(), source: "static" }; }
  const used = [];
  await Promise.all(BACKEND.filter((n) => remote[n]?.frames).map(async (name) => {
    const meta = remote[name];
    const frameSet = makeFrames(meta, all);
    // the first frame decides whether this clip can come from the backend at all
    if (!(await frameSet.load(0))) return;
    SEQ[name] = { ...staticSeq[name], ...meta, frameSet };
    used.push(SEQ[name]);
  }));
  // a sprite sheet is used from the backend only once it has really loaded; otherwise the static one stays
  await Promise.all(SHEETS.filter((n) => remote[n]?.src).map((name) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { SEQ[name] = { ...staticSeq[name], ...remote[name] }; resolve(); };
    img.onerror = resolve;
    img.src = remote[name].src;
  })));
  const ordered = used.sort((a, b) => a.t0 - b.t0);
  if (!all) warmCache(ordered);
  return { SEQ, loaded: all ? streamAll(ordered) : Promise.resolve(), source: used.length ? "backend" : "static" };
}

/** the end-of-page counters, or null when the backend is unavailable */
export async function loadCounters() {
  try {
    const c = await api("/api/counters");
    const ok = (v) => Number.isInteger(v) && v >= 0 && v <= 999;
    return ["Prject", "client", "staff", "years"].every((k) => ok(c[k])) ? c : null;
  } catch { return null; }
}

/** every word and loose picture of the page as the backend holds them ({ texts, images }), or null; asked once per page */
let contentOnce;
export function loadContent() {
  contentOnce ??= api("/api/content")
    .then((c) => { if (c && typeof c.texts === "object") { setContent(c); return c; } return null; })
    .catch(() => null);
  return contentOnce;
}

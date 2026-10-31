import { api } from "./api.js";
import { setContent } from "./lang.js";

/* The circle pictures (plant, runners, eye) come from the backend as one JPEG per frame.
   Each clip keeps the metadata the baked sheets have (t0, t1, fps, n, cols, rows, w, h, keys, round),
   so the timeline never changes; only the way a frame is drawn does. If the backend does not answer,
   or a clip's first frame cannot be fetched, that clip keeps its static sprite sheet from /public/seq. */

const BACKEND = ["leapA", "cheer", "leapB", "plant", "eye", "can1", "can2", "can3", "can4"]; // can1..can4: the four circles of the work scene
const SHEETS = ["hero1", "hero2", "goat", "hillrise"]; // baked sprite sheets: the picture comes from the backend too
const PARALLEL = 8;

function makeFrames(meta) {
  const images = new Array(meta.n);
  const listeners = new Set();
  const load = (i) => {
    if (images[i]) return images[i].done;
    const img = new Image();
    images[i] = { img, ok: false, done: new Promise((resolve) => {
      img.onload = () => { images[i].ok = true; listeners.forEach((f) => f(i)); resolve(true); };
      img.onerror = () => resolve(false);
    }) };
    img.src = meta.frames[i];
    return images[i].done;
  };
  return {
    load,
    // the picture to draw for frame i: itself, else the closest earlier one that has arrived, else a later one
    best(i) {
      load(i);
      if (images[i].ok) return images[i].img;
      for (let k = i - 1; k >= 0; k--) if (images[k]?.ok) return images[k].img;
      for (let k = i + 1; k < meta.n; k++) if (images[k]?.ok) return images[k].img;
      return null;
    },
    onLoad(f) { listeners.add(f); },
  };
}

// loads the remaining frames of every clip in timeline order, a few at a time
function streamAll(clips) {
  const queue = clips.flatMap((c) => Array.from({ length: c.n }, (_, i) => () => c.frameSet.load(i)));
  let next = 0;
  const worker = async () => { while (next < queue.length) await queue[next++](); };
  return Promise.all(Array.from({ length: PARALLEL }, worker));
}

/** Merge the backend's clips over the static metadata. Resolves with { SEQ, loaded } where `loaded`
 *  resolves once every frame has been requested (the page does not wait for it unless asked to). */
export async function loadSeq(staticSeq) {
  const SEQ = { ...staticSeq };
  let remote;
  try { remote = await api("/api/clips"); } catch { return { SEQ, loaded: Promise.resolve(), source: "static" }; }
  const used = [];
  await Promise.all(BACKEND.filter((n) => remote[n]).map(async (name) => {
    const meta = remote[name];
    const frameSet = makeFrames(meta);
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
  return { SEQ, loaded: streamAll(ordered), source: used.length ? "backend" : "static" };
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

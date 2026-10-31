import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { mountPanel } from "./panel.js";
import { SEQ as STATIC_SEQ } from "./seq.js";
import { loadSeq, loadCounters, loadContent } from "./clips.js";
import { rtl, t, langSwitch } from "./lang.js";

gsap.registerPlugin(ScrollTrigger);

// ?cmp=1&t=N: frame-capture mode for compare.py — no scrolling, no smoothing, no panel
const params = new URLSearchParams(location.search);
const CMP = params.get("cmp") === "1";

// The circle clips (plant, runners, eye) and the end counters come from the backend; if it is down the
// static sprite sheets and 24s are used. Only the picture source and the counter values depend on this:
// no time, position, size or easing below does.
const [{ SEQ, loaded: framesLoaded }, counters, content] = await Promise.all([loadSeq(STATIC_SEQ, { all: CMP }), loadCounters(), loadContent()]);
// every word on the page, and the loose pictures, can be changed from the backend (admin page); the strings in this file are the defaults
const tx = (id, def) => content?.texts?.[id] ?? def;
const imageUrl = (id, def) => content?.images?.[id] ?? def;
// the fixed column: its words and the language switch
document.querySelectorAll("[data-t]").forEach((a) => { a.textContent = t(a.dataset.t, a.textContent); });
document.getElementById("lang-slot")?.replaceWith(langSwitch());
{ // the phone header: the same links and languages, in a sheet opened by the two icons
  const sheet = document.getElementById("m-sheet"), pop = document.getElementById("m-lang"), root = document.documentElement;
  document.querySelectorAll(".nav-main a, .nav-bottom a, .social").forEach((a, i) => { const c = a.cloneNode(true); c.className = i === 5 ? "first-of-group" : ""; c.removeAttribute("data-t"); sheet.append(c); });
  pop.append(langSwitch());
  const menu = document.querySelector(".m-menu"), lg = document.querySelector(".m-langbtn");
  const set = (cls, btn, on) => { root.classList.toggle(cls, on); btn.setAttribute("aria-expanded", String(on)); };
  menu.addEventListener("click", () => { set("m-open", menu, !root.classList.contains("m-open")); set("m-lang-open", lg, false); });
  lg.addEventListener("click", (e) => { e.stopPropagation(); set("m-lang-open", lg, !root.classList.contains("m-lang-open")); set("m-open", menu, false); });
  addEventListener("click", () => set("m-lang-open", lg, false));
  addEventListener("keydown", (e) => { if (e.key === "Escape") { set("m-open", menu, false); set("m-lang-open", lg, false); } });
}
document.querySelector(".logo-circle")?.setAttribute("src", imageUrl("logoCircle", "/img/logo-circle.svg"));
document.querySelector(".logo-text")?.setAttribute("src", imageUrl("logoText", "/img/logo-text.svg"));
if (CMP) await framesLoaded; // a capture must see every frame

/* ------------------------------------------------------------------ *
 * The reference video runs 78s at 1438x960. The scroll timeline uses the
 * same clock: 1 timeline second = 1 video second, and every position below
 * is the one measured in the video at that second (design px, centres).
 * ------------------------------------------------------------------ */
const DURATION = 78;
const PX_PER_SECOND = 70;
const DESIGN_W = 1438, DESIGN_H = 960;

const settings = { speed: 1, scrub: 1, whiteBg: "#ffffff", blackBg: "#000000", red: "#ea1a0c", heroWord: "goat", images: {} };

const layers = {
  a: document.getElementById("layer-a"),
  domes: document.getElementById("layer-domes"),
  lines: document.getElementById("layer-lines"),
  main: document.getElementById("layer-main"),
  top: document.getElementById("layer-top"),
};

const design = document.getElementById("design");
// The whole canvas is always in view (phones show it small, with the scene's colour carrying on above and below).
function fit() {
  const s = Math.min(innerWidth / DESIGN_W, innerHeight / DESIGN_H);
  design.style.setProperty("--s", s);
  document.documentElement.style.setProperty("--s", s); // the header is sized from it
}
fit();
addEventListener("resize", fit);

/* ---------- element factories (positions via gsap x/y, in design px) ---------- */
function text(str, o = {}) {
  const el = document.createElement(o.tag || "div");
  el.className = `el ${o.cls || ""}`;
  el.textContent = str;
  Object.assign(el.style, { fontSize: `${o.fs ?? 18}px`, fontWeight: o.fw ?? 300 });
  if (o.color) el.style.color = o.color;
  if (o.w) { el.style.width = `${o.w}px`; el.classList.add("wrap"); }
  if (o.lh) el.style.lineHeight = o.lh;
  if (o.align) el.style.textAlign = rtl && o.align === "left" ? "right" : o.align;
  if (rtl) el.dir = "rtl";
  const center = o.center ?? true;
  el.style.transformOrigin = center ? "50% 50%" : "0 0";
  const sc = o.scale ?? 1;
  gsap.set(el, { x: o.x ?? 0, y: o.y ?? 0, rotation: o.rot ?? 0, opacity: o.opacity ?? 0, xPercent: center ? -50 : 0, yPercent: center ? -50 : 0, scaleX: o.flip ? -sc : sc, scaleY: sc });
  (o.layer || layers.main).appendChild(el);
  return el;
}

function circleImg(key, src, size, o = {}) {
  const el = document.createElement("div");
  el.className = "circle-img";
  el.dataset.key = key;
  Object.assign(el.style, { width: `${size}px`, height: `${size}px` });
  if (src) { const img = document.createElement("img"); img.src = src; img.alt = ""; el.appendChild(img); if (o.blur) img.style.filter = `blur(${o.blur}px)`; }
  else el.style.background = o.fill;
  if (o.soft) el.style.webkitMaskImage = el.style.maskImage = "radial-gradient(circle at 50% 50%, #000 62%, transparent 71%)";
  gsap.set(el, { x: o.x ?? 0, y: o.y ?? 0, xPercent: -50, yPercent: -50, opacity: o.opacity ?? 0, scale: o.scale ?? 1 });
  (o.layer || layers.main).appendChild(el);
  return el;
}

function ring(size, color = "#fff", layer = layers.main) {
  const el = document.createElement("div");
  el.className = "ring";
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, color });
  gsap.set(el, { opacity: 0, xPercent: -50, yPercent: -50 });
  layer.appendChild(el);
  return el;
}

function dot(size, color = "#000", o = {}) {
  const el = document.createElement("div");
  el.className = "dot";
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, background: color });
  if (o.blur) el.style.filter = `blur(${o.blur}px)`;
  gsap.set(el, { opacity: 0, xPercent: -50, yPercent: -50 });
  (o.layer || layers.main).appendChild(el);
  return el;
}

// a clip baked from the reference by bake.py: a sprite sheet whose frame is
// picked from the timeline clock, moved along the same path it was cropped on
function clip(name, o = {}) {
  const m = SEQ[name];
  const el = document.createElement("div");
  el.className = `clip ${m.round ? "round" : ""}`;
  Object.assign(el.style, { width: `${m.w}px`, height: `${m.h}px` });
  gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0 });
  (o.layer || layers.main).appendChild(el);
  const st = { f: 0 };
  let draw;
  if (m.frameSet) {
    // frames served one by one by the backend: drawn on a canvas, so a frame swap never flickers
    const cv = document.createElement("canvas");
    cv.width = m.cell[0]; cv.height = m.cell[1];
    cv.style.cssText = "display:block;width:100%;height:100%";
    el.style.overflow = "hidden";
    el.appendChild(cv);
    const g = cv.getContext("2d");
    g.imageSmoothingQuality = "high";
    let shown = null;
    draw = (i) => { const img = m.frameSet.best(i); if (img && img !== shown) { g.clearRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); shown = img; } };
    m.frameSet.onLoad((i) => { if (i === Math.round(st.f)) paint(); });
  } else {
    Object.assign(el.style, { backgroundImage: `url(${m.src})`, backgroundSize: `${m.cols * m.w}px ${m.rows * m.h}px` });
    draw = (i) => { el.style.backgroundPosition = `${-(i % m.cols) * m.w}px ${-Math.floor(i / m.cols) * m.h}px`; };
  }
  const paint = () => draw(Math.round(st.f));
  paint();
  // never run past DURATION: a longer child would stretch the timeline and skew every time
  tl.to(st, { f: m.n - 1, duration: Math.min((m.n - 1) / m.fps, DURATION - m.t0), onUpdate: paint }, m.t0);
  // a zero-duration set at t=0 is not applied when the playhead sits exactly on 0, so the
  // opening clip is shown directly
  if (m.t0 === 0) gsap.set(el, { opacity: 1 }); else tl.set(el, { opacity: 1 }, m.t0);
  if (m.t1 < DURATION) tl.set(el, { opacity: 0 }, m.t1);
  track(el, m.keys.map(([t, x, y, s]) => [t, x, y, 0, s]));
  return el;
}

function makeSvg(layer) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", `0 0 ${DESIGN_W} ${DESIGN_H}`);
  s.setAttribute("preserveAspectRatio", "xMidYMid slice");
  s.setAttribute("shape-rendering", "geometricPrecision");
  layer.appendChild(s);
  return s;
}
const svgA = makeSvg(layers.a);
const svgL = makeSvg(layers.lines);

function curve(d, o = {}) {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", o.color ?? "#fff");
  p.setAttribute("stroke-width", o.w ?? 1);
  if (o.blur) p.style.filter = `blur(${o.blur}px)`;
  (o.svg || svgL).appendChild(p);
  // one dash as long as the path, then a gap far longer than it: a dasharray
  // of exactly [len] would repeat and leave hairline gaps where the browser's
  // measured length differs from ours
  const len = Math.ceil(p.getTotalLength()) + 2;
  p.style.strokeDasharray = `${len} ${len * 4}`;
  p.style.strokeDashoffset = len;
  p.style.strokeLinecap = "round";
  gsap.set(p, { opacity: 0 });
  return p;
}

// a black cover whose top (or bottom) edge is a wide elliptical arc
function cover(side, b) {
  const el = document.createElement("div");
  el.className = "dome";
  const w = 2800, h = side === "top" ? 4200 : 1400;
  Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: `${(DESIGN_W - w) / 2}px`, top: 0, background: "#000" });
  el.style.borderRadius = side === "top" ? `${w / 2}px ${w / 2}px 0 0 / ${b}px ${b}px 0 0` : `0 0 ${w / 2}px ${w / 2}px / 0 0 ${b}px ${b}px`;
  // beyond the canvas edge the arc would curl away and leave the corners of a wide window uncovered:
  // from there on the cover continues flat at the height the arc has at the edge
  const drop = b * (1 - Math.sqrt(1 - (DESIGN_W / 2 / (w / 2)) ** 2)), WING = 1100;
  for (const left of [(w - DESIGN_W) / 2 - WING, (w + DESIGN_W) / 2]) {
    const wing = document.createElement("div");
    Object.assign(wing.style, { position: "absolute", left: `${left}px`, width: `${WING}px`, background: "inherit",
      ...(side === "top" ? { top: `${drop}px`, bottom: 0 } : { top: 0, height: `${h - drop}px` }) });
    el.appendChild(wing);
  }
  gsap.set(el, { y: side === "top" ? DESIGN_H + 10 : -h - 10, opacity: 0 });
  layers.domes.appendChild(el);
  return el;
}

/* ---------- timeline helpers ---------- */
const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
tl.set({}, {}, DURATION);

// keys: [t, x, y, rot?, scale?, blur?] — linear motion between keys
function track(el, keys) {
  const v = (k) => ({ x: k[1], y: k[2], ...(k[3] !== undefined ? { rotation: k[3] } : {}), ...(k[4] !== undefined ? { scale: k[4] } : {}), ...(k[5] !== undefined ? { filter: `blur(${k[5]}px)` } : {}) });
  if (keys[0][0] === 0) gsap.set(el, v(keys[0])); else tl.set(el, v(keys[0]), keys[0][0]); // a set at t=0 is skipped when the playhead sits on 0
  for (let i = 1; i < keys.length; i++) tl.to(el, { ...v(keys[i]), duration: keys[i][0] - keys[i - 1][0] }, keys[i - 1][0]);
}
// the reference teleports its small words: fade out, move, fade in
function jump(el, t, x, y, rot) {
  tl.to(el, { opacity: 0, duration: 0.2 }, t - 0.2);
  tl.set(el, { x, y, ...(rot !== undefined ? { rotation: rot } : {}) }, t);
  tl.to(el, { opacity: 1, duration: 0.2 }, t);
}
const show = (el, t, d = 0.3, o = 1) => tl.to(el, { opacity: o, duration: d }, t);
const hide = (el, t, d = 0.3) => tl.to(el, { opacity: 0, duration: d }, t);
const appear = (el, t0, t1, d = 0.3, o = 1) => { show(el, t0, d, o); hide(el, t1, d); };
const draw = (p, t0, t1, d = 1.2, o = 1) => { tl.to(p, { opacity: o, duration: 0.2 }, t0); tl.to(p, { strokeDashoffset: 0, duration: d }, t0); tl.to(p, { opacity: 0, duration: 0.3 }, t1); };

/* ================================================================== *
 * SCENE A — goat / dream (white). Lives below the black cover.
 * ================================================================== */
// the headline (goat -> scramble -> dream, photo inside the glyphs) is a baked clip
clip("hero1", { layer: layers.a });

const wA = text(tx("wA", "a"), { fs: 24, color: "#000", rot: -90, layer: layers.a });
const wPlace = text(tx("wPlace", "place"), { fs: 24, color: "#000", rot: -90, layer: layers.a });
const wTo = text(tx("wTo", "to"), { fs: 24, color: "#000", layer: layers.a });
// a / place / to teleport between corners (positions measured on the sheets)
tl.set(wA, { x: 312, y: 708 }, 0); appear(wA, 2.3, 6.2, 0.2); jump(wA, 4.3, 312, 267); jump(wA, 6.8, 315, 708); hide(wA, 7.6);
tl.set(wPlace, { x: 586, y: 158 }, 0); show(wPlace, 2.8); jump(wPlace, 4.3, 1078, 870); jump(wPlace, 6.8, 586, 162); hide(wPlace, 7.8);
tl.set(wTo, { x: 987, y: 860 }, 0); show(wTo, 2.8); jump(wTo, 4.8, 1071, 24); hide(wTo, 6.6);

// the big dot swings in from the top-right corner and out through the bottom (disc-tracked per 0.1s)
const bigDot = dot(176, "#000", { layer: layers.a });
track(bigDot, [[1.0, 1358, 10], [1.3, 1280, 61], [1.4, 1227, 88], [1.5, 1168, 140], [1.6, 1106, 206], [1.7, 1047, 286], [1.8, 1010, 390],
  [1.9, 985, 495], [2.0, 965, 600], [2.1, 954, 711], [2.2, 978, 820], [2.3, 1014, 903], [2.4, 1060, 1010]]);
// while the dot sits inside the headline box (1.8-2.05) the baked box already carries it exactly
appear(bigDot, 0.9, 1.8, 0.05); appear(bigDot, 2.05, 2.4, 0.05);
const arcHang = curve("M 1360 -20 C 1240 240 1000 480 945 600 C 930 720 1000 850 1040 1000", { color: "#9a9a9a", svg: svgA });
draw(arcHang, 0.9, 2.4, 1.2);
// opening: the dot rests at the end of an arc, then arc and dot sweep up and right together
const d0 = dot(26, "#000", { layer: layers.a });
gsap.set(d0, { x: 1176, y: 600, opacity: 1 });
track(d0, [[0, 1176, 600], [0.2, 1176, 600], [0.5, 1430, 20], [0.7, 1500, -100]]);
hide(d0, 0.45, 0.05);
const arc0 = curve("M 1176 600 C 1000 700 800 850 615 910", { color: "#9a9a9a", svg: svgA });
gsap.set(arc0, { strokeDashoffset: 0, opacity: 1 });
tl.to(arc0, { strokeDashoffset: -Math.ceil(arc0.getTotalLength()) - 2, duration: 0.35 }, 0.15);
// the second arc hangs from the top-right corner, curling down to the middle, drawn head-first
const arc0b = curve("M 1438 1240 C 1400 1100 1250 1300 1060 1700", { color: "#9a9a9a", svg: svgA });
arc0b.setAttribute("d", "M 1438 -10 C 1420 200 1380 360 1300 460 C 1200 580 1050 640 950 700");
draw(arc0b, 0.35, 1.3, 0.6);
const dSoft = dot(34, "#000", { blur: 4, layer: layers.a });
track(dSoft, [[2.4, 624, 936], [3.0, 786, 807], [3.5, 933, 576], [4.0, 990, 297], [4.5, 972, 72]]);
appear(dSoft, 2.4, 4.6, 0.2);
const d2 = dot(18, "#000", { layer: layers.a });
track(d2, [[3.8, 74, 146], [4.0, 74, 146], [4.5, 626, 104], [5.0, 1206, 447]]);
appear(d2, 3.8, 5.3, 0.2);
const arc2 = curve("M -20 132 C 200 100 400 72 624 111", { color: "#9a9a9a", svg: svgA }); draw(arc2, 3.8, 4.7, 0.8);
const arc3 = curve("M 636 12 C 900 100 1200 350 1416 657", { color: "#9a9a9a", svg: svgA }); draw(arc3, 4.6, 5.4, 0.9);
const d2b = dot(26, "#000", { layer: layers.a }); tl.set(d2b, { x: 1416, y: 657 }, 4.8); appear(d2b, 4.8, 5.3, 0.2);
tl.to(d2, { opacity: 0, duration: 0.2 }, 5.3);
const d3 = dot(26, "#000", { layer: layers.a });
track(d3, [[5.8, 411, 687], [6.05, 411, 687], [6.5, 0, 852]]); appear(d3, 5.8, 6.6, 0.2);
const arc4 = curve("M 345 762 C 500 650 750 560 1000 480", { color: "#9a9a9a", svg: svgA }); draw(arc4, 5.7, 6.7, 0.8);
const d4 = dot(26, "#000", { blur: 3, layer: layers.a }); tl.set(d4, { x: 1414, y: 372 }, 6.85); appear(d4, 6.85, 7.3, 0.05);
const arc5 = curve("M 1170 540 C 1260 480 1340 420 1414 376", { color: "#9a9a9a", svg: svgA }); draw(arc5, 6.9, 7.5, 0.5);

/* ---- Cover 1: black rises (6.85 -> 8.4) ---- */
const domeBlack = cover("top", 560);
tl.set(domeBlack, { opacity: 1 }, 6.85);
// crest height per 0.1s, measured on the reference frames
track(domeBlack, [[6.85, 0, 960], [6.9, 0, 855], [7.0, 0, 762], [7.1, 0, 661], [7.2, 0, 561], [7.3, 0, 431], [7.4, 0, 381],
  [7.5, 0, 304], [7.6, 0, 235], [7.7, 0, 174], [7.8, 0, 122], [7.9, 0, 76], [8.0, 0, 38], [8.2, 0, -10], [8.4, 0, -120],
  [9.4, 0, -1600]]); // the last key only lifts the arc out of sight, for windows taller than the canvas (phones)

/* ================================================================== *
 * SCENE B — leap / runner (black)
 * ================================================================== */
const ghostLe = text(tx("ghostLe", "le"), { fs: 180, fw: 900, color: "#262626", rot: -90, layer: layers.lines });
const ghostAp = text(tx("ghostAp", "ap"), { fs: 180, fw: 900, color: "#262626", rot: 90, layer: layers.lines });
track(ghostLe, [[9, 195, 912], [10, 170, 916], [12, 140, 192], [14, 140, 164], [16, 170, 916], [18, 170, 892], [20, 170, 894], [22, 140, 196]]);
// "ap" teleports between the top-right corner and the lower middle
track(ghostAp, [[9.3, 1263, 87], [10, 1250, 86], [12.3, 1250, 92]]);
jump(ghostAp, 12.3, 1120, 656); jump(ghostAp, 14.8, 1250, 80); jump(ghostAp, 21.6, 1120, 656);
appear(ghostLe, 8.8, 23.3); appear(ghostAp, 9.2, 23.3);

clip("leapA");

const toLeap = text(tx("toLeap", "to leap"), { fs: 66, fw: 700, color: "#fff", rot: 90, x: 304, y: 300 });
appear(toLeap, 9.2, 12.7, 0.2);
const dares = text(tx("dares", "for who dares"), { fs: 36, fw: 400, color: "#fff", center: false, x: 566, y: 656 });
const daresP = text(tx("daresP", "at GOAT, we’ve always aimed to deliver services that stand out with top-notch quality. By quality, we mean obsessing over the smallest details and embracing new methods and technologies to bring creative and innovative ideas to life—even for the tiniest projects."), { fs: 17.5, color: "#fff", center: false, x: 570, y: 712, w: 360, lh: 1.1 });
appear(dares, 9.8, 23.2); appear(daresP, 10.5, 23.2);
const firsts = text(tx("firsts", "do the firsts"), { fs: 66, fw: 700, color: "#fff", center: false, x: 888, y: 335 });
appear(firsts, 12.7, 17.9, 0.25);
const smash = text(tx("smash", "smash the records"), { fs: 66, fw: 700, color: "#fff", center: false, rot: 90, x: 1295, y: 255 });
smash.style.zIndex = 2; // sits over the leap circle, as in the reference
appear(smash, 18.0, 23.1);

clip("cheer");
clip("leapB").style.zIndex = 1;

// drawn from the right edge leftwards while the hill is still up
const bw1 = curve("M 1480 540 C 1400 570 1300 610 1160 650 C 1000 700 760 700 460 560 C 260 420 150 520 -40 540");
draw(bw1, 7.8, 13.0, 0.8);
const ringLine = curve("M 282 -20 C 275 120 270 240 290 360 C 300 420 260 470 230 500");
draw(ringLine, 13.0, 17.0, 0.8);
const bw2 = curve("M 440 40 C 420 300 520 560 440 800 C 380 880 300 850 230 790 C 120 680 40 560 -30 520");
draw(bw2, 17.0, 23.3, 1.6);

const rB1 = ring(132), rB2 = ring(270), rB3 = ring(320), rB4 = ring(64), rB5 = ring(150), rB5b = ring(120), rB6 = ring(200);
tl.set(rB1, { x: 1110, y: 267 }, 8.6); appear(rB1, 8.8, 13.1);
tl.set(rB2, { x: 65, y: 707 }, 7.7); appear(rB2, 7.8, 13.3);
track(rB3, [[13.0, 1101, 267, 0, 0.3], [13.3, 1074, 402, 0, 0.9], [13.5, 1054, 312, 0, 1], [14, 1140, 134, 0, 1], [16, 1160, 106], [16.6, 1125, 117, 0, 0.85], [17.8, 1134, 117]]);
appear(rB3, 13.0, 17.6);
// the small ring rolls from the big ring's side down to the left edge
track(rB4, [[13.4, 1000, 490], [13.5, 980, 502], [14.0, 380, 744], [14.5, 190, 736], [15.0, 150, 742], [15.5, 0, 724], [15.8, -60, 720]]);
appear(rB4, 13.4, 15.8, 0.1);
track(rB5, [[16.5, 80, 732], [17.5, 70, 716], [17.9, 70, 716]]);
appear(rB5, 16.5, 17.9, 0.2);
track(rB5b, [[18, 540, 282, 0, 1], [20, 540, 74], [22, 540, 186]]);
appear(rB5b, 18, 23.3);
track(rB6, [[17.8, 294, 717, 0, 0.3], [18.2, 370, 722, 0, 1], [20, 300, 894], [22, 210, 796]]);
appear(rB6, 17.8, 23.3);

/* ================================================================== *
 * SCENE C — we use lines / shapes / colors
 * ================================================================== */
const wLines = text(tx("wLines", "lines"), { fs: 70, fw: 700, color: "#fff", x: 430, y: 250 });
tl.to(wLines, { opacity: 0.5, duration: 0.3 }, 24.3); tl.to(wLines, { opacity: 1, duration: 0.4 }, 24.7);
tl.to(wLines, { opacity: 0.5, duration: 0.3 }, 26.3); hide(wLines, 26.8, 0.3);
// three hairline waves traced from the reference (lines.py), each drawn left to right in
// turn with a small ring riding its tip, then they wipe away one by one
const wave1 = curve("M 130 685 C 230 720 340 745 500 745 C 660 745 760 715 910 684 C 1000 666 1090 640 1210 641 C 1260 643 1300 660 1330 670");
const wave2 = curve("M 130 623 C 190 622 260 650 310 668 C 400 720 470 770 580 795 C 680 810 760 790 870 740 C 1000 680 1120 620 1290 650");
const wave3 = curve("M 130 732 C 230 735 300 700 370 684 C 470 660 510 740 560 790 C 630 820 700 760 770 710 C 880 650 1000 600 1120 605 C 1200 605 1260 630 1330 640");
draw(wave1, 24.3, 26.9, 1.3); draw(wave2, 24.5, 27.0, 1.2); draw(wave3, 24.6, 27.1, 1.2);
const rC1 = ring(50), rC2 = ring(28), rC1b = ring(50), rC2b = ring(32);
track(rC1, [[24.3, 130, 700], [24.4, 214, 705], [24.75, 492, 741], [25.0, 774, 718], [25.25, 1035, 648], [25.5, 1311, 655], [25.65, 1440, 660]]);
track(rC2, [[24.3, 130, 640], [24.5, 215, 733], [24.75, 346, 721], [25.0, 634, 808], [25.25, 918, 729], [25.5, 1185, 594], [25.65, 1300, 580]]);
appear(rC1, 24.3, 25.65, 0.1); appear(rC2, 24.3, 25.65, 0.1);
track(rC1b, [[25.5, 180, 660], [25.75, 1235, 715], [25.9, 1440, 700]]);
track(rC2b, [[25.6, 400, 700], [25.75, 976, 676], [25.9, 1300, 650]]);
appear(rC1b, 25.5, 25.9, 0.1); appear(rC2b, 25.6, 25.9, 0.1);
const useA = text(tx("useA", "use"), { fs: 26, color: "#fff" });
tl.set(useA, { x: 214, y: 496 }, 25); appear(useA, 25.8, 33.7);
jump(useA, 27.6, 1280, 736); jump(useA, 29.6, 556, 930); jump(useA, 31.6, 214, 444);
const useB = text(tx("useB", "use"), { fs: 26, color: "#fff" });
tl.set(useB, { x: 556, y: 982 }, 24); appear(useB, 24.3, 27.2);
useB.style.zIndex = 60; // sits above the nav column, as in the reference
const weC = text(tx("weC", "we"), { fs: 26, color: "#fff", rot: -90 });
tl.set(weC, { x: 1400, y: 404 }, 25); appear(weC, 25.8, 33.7);
jump(weC, 27.6, 500, 286); jump(weC, 29.6, 1500, 330); jump(weC, 31.6, 1400, 354);
const shapes = text(tx("shapes", "shapes"), { fs: 70, fw: 700, color: "#fff", rot: 90, x: 1170, y: 596 });
tl.to(shapes, { opacity: 0.5, duration: 0.3 }, 26.8); tl.to(shapes, { opacity: 1, duration: 0.4 }, 27.4);
tl.to(shapes, { opacity: 0.5, duration: 0.5 }, 29.4); hide(shapes, 30.6, 0.4);
// the "shapes" rings: a stack at x~1170 (Hough-measured) plus three loose ones
[[1170, 453, 13], [1177, 519, 17], [1170, 563, 27], [1163, 605, 32], [1175, 633, 19], [1170, 683, 24], [1170, 730, 27]]
  .forEach(([x, y, r]) => { const el = ring(r * 2); tl.set(el, { x, y }, 26.9); appear(el, 27.0, 29.4, 0.2); });
const rC3 = ring(268), rC4 = ring(68), rC5 = ring(88);
tl.set(rC3, { x: 790, y: 286 }, 27); tl.set(rC4, { x: 207, y: 587 }, 27); tl.set(rC5, { x: 975, y: 810 }, 27.3);
appear(rC3, 27.5, 29.4); appear(rC4, 27.2, 29.4); appear(rC5, 27.4, 29.4);

const wColors = text(tx("wColors", "colors"), { fs: 80, fw: 700, color: "#fff", x: 700, y: 503 });
tl.to(wColors, { opacity: 0.5, duration: 0.4 }, 29.6); tl.to(wColors, { opacity: 1, duration: 1 }, 30.6); hide(wColors, 33.2, 0.3);
const cRed = circleImg("red", "", 260, { fill: settings.red }); cRed.dataset.role = "red";
const cYel = circleImg("yellow", "", 320, { fill: "#eaff12" });
const cBlu = circleImg("blue", "", 100, { fill: "#3a00ff" });
// the colour discs shrink to nothing at the end (the red one lingers longest)
track(cRed, [[29.6, 766, 292, 0, 1], [32, 496, 358, 0, 0.57], [33.2, 470, 370, 0, 0.57], [33.5, 442, 452, 0, 0.08], [33.7, 440, 470, 0, 0.01]]);
track(cYel, [[29.6, 150, 606, 0, 0.56], [32, 956, 588, 0, 1], [33.1, 990, 580, 0, 1], [33.4, 980, 600, 0, 0.01]]);
track(cBlu, [[29.6, 920, 776, 0, 1], [32, 252, 730, 0, 0.68], [33.2, 230, 736, 0, 0.68], [33.5, 198, 672, 0, 0.05], [33.6, 196, 670, 0, 0.01]]);
[cRed, cYel, cBlu].forEach((c) => { tl.to(c, { opacity: 0.4, duration: 0.4 }, 29.6); tl.to(c, { opacity: 1, duration: 1 }, 30.6); });
hide(cRed, 33.7, 0.1); hide(cYel, 33.4, 0.1); hide(cBlu, 33.6, 0.1);

/* ================================================================== *
 * SCENE D — plant / creative ideas
 * ================================================================== */
clip("plant");
// the headline and the small words ride up with the plant when the scene leaves:
// they sit in one group whose y follows the plant clip's measured exit path
// in the reference the words stay put while the plant leaves: only the clip rises
const gPlant = document.createElement("div"); gPlant.className = "layer"; layers.main.appendChild(gPlant);
const creative = text(tx("creative", "creative"), { fs: 96, fw: 700, color: "#fff", x: 485, y: 504, layer: gPlant });
const ideas = text(tx("ideas", "ideas"), { fs: 96, fw: 700, color: "#fff", x: 1018, y: 504, layer: gPlant });
// the headline fades in dim first (t=36.5), then goes full white by 37.3
// the headline is its own text, not part of the plant clip: it sits still, then rises out of the frame
// from 40.85 on the path measured on the video (centre y per time) while the circle rises behind it
const RISE = [[40.8, 504], [40.9, 500], [41.0, 493], [41.1, 482], [41.15, 473], [41.2, 463], [41.25, 451], [41.3, 437], [41.35, 419], [41.4, 397],
  [41.45, 370], [41.5, 337], [41.55, 295], [41.6, 244], [41.65, 184], [41.7, 118], [41.75, 52], [41.8, -10], [41.85, -80]];
[[creative, 485], [ideas, 1018]].forEach(([e, x]) => {
  tl.to(e, { opacity: 0.45, duration: 0.3 }, 36.3); tl.to(e, { opacity: 1, duration: 0.6 }, 36.7);
  track(e, RISE.map(([t, y]) => [t, x, y]));
  hide(e, 41.82, 0.03);
});
const wBring = text(tx("wBring", "bring"), { fs: 28, color: "#fff", rot: -90, layer: gPlant });
const wTo2 = text(tx("wTo2", "to"), { fs: 28, color: "#fff", layer: gPlant });
const wTo3 = text(tx("wTo3", "to"), { fs: 28, color: "#fff", layer: gPlant });
const wLife = text(tx("wLife", "life"), { fs: 28, color: "#fff", rot: -90, layer: gPlant });
tl.set(wBring, { x: 354, y: 916 }, 33); appear(wBring, 33.5, 41.2);
jump(wBring, 35.8, 60, 112); jump(wBring, 37.8, 1120, 304); jump(wBring, 39.9, 354, 916);
tl.set(wTo2, { x: 146, y: 196 }, 33); appear(wTo2, 33.5, 41.8);
jump(wTo2, 35.8, 1036, 342); jump(wTo2, 37.8, 40, 550); jump(wTo2, 39.9, 146, 196); jump(wTo2, 41.3, 146, 60);
tl.set(wTo3, { x: 1076, y: 788 }, 34.1); appear(wTo3, 34.2, 41.8, 0.15);
jump(wTo3, 36.2, 366, 720); jump(wTo3, 38.3, 1396, 102); jump(wTo3, 40.3, 1076, 820);
tl.set(wLife, { x: 1260, y: 46 }, 34.1); appear(wLife, 34.2, 41.2, 0.15);
jump(wLife, 36.2, 836, 868); jump(wLife, 38.3, 300, 36); jump(wLife, 40.3, 1260, 46);
// the two thin waves cross behind the plant; the thick soft one glows along the lower wave
const pw1 = curve("M -30 482 C 130 410 300 430 470 560 C 640 690 900 700 1080 676 C 1250 655 1350 600 1470 540");
const pw2 = curve("M -30 436 C 200 400 360 440 500 540 C 700 680 1000 700 1200 650 C 1320 620 1400 570 1470 556");
const pwGlow = curve("M 520 560 C 760 640 1100 640 1470 600", { color: "#777", w: 30, blur: 10 });
draw(pw1, 34.3, 41.4, 1.0); draw(pw2, 35.1, 41.4, 1.0); draw(pwGlow, 35.3, 41.4, 1.5, 0.45);

/* ================================================================== *
 * SCENE E — sell (black -> white)
 * ================================================================== */
/* The marquee, measured on the reference (phase5/phase6):
   - all three rows run left at 210px/s; the reference is a 2.0s loop, so every row jumps
     back by one "sell" (420px) at its own loop point (main 44.75, top ghost 45.55, bottom 45.45)
   - the glyphs are 0.95 of the 270px draft, and "sell" is 420px wide
   - the rows slide in from below (41.9-43.7) and shoot out the top (47.7-48.4); BAND is the
     top of the solid row's glyph band per 0.1s, the ghosts keep their offsets to it
   - the two outlined rows are the same text mirrored left-right (upright, ascenders up) */
const SELL_FS = 256, SELL_LS = -2.25, P_SELL = 420, V_SELL = 210;
const SELL = "sell[ellsell".repeat(16);
// x0/dy calibrated with phase7.py so each row's "[" and glyph band coincide with the reference at 44.0s
// (the string's period at this size is 1207px; a mirrored row hangs to the LEFT of its x0)
const MAIN_X = 557 - 420 - 2 * 1207 - 19, MAIN_DY = -29;
// the outlined rows are too faint in the reference for a template fix: aligned on their ascender tops
const GT_X = 10000 + 152, GT_DY = -213 - 29 + 50 - 65;
const GB_X = 10000 - 143, GB_DY = 247 - 29 - 47 - 25;
const BAND = [[41.9, 730], [42.0, 675], [42.1, 620], [42.2, 578], [42.3, 543], [42.4, 515], [42.5, 492], [42.6, 472], [42.7, 455],
  [42.8, 442], [42.9, 430], [43.0, 421], [43.1, 413], [43.2, 407], [43.3, 402], [43.4, 398], [43.5, 395], [43.6, 394], [43.7, 393],
  [47.7, 393], [47.8, 378], [47.9, 322], [48.0, 226], [48.1, 117], [48.2, 20], [48.3, -85], [48.4, -200], [48.6, -430]];
const bandAt = (t) => { for (let i = 1; i < BAND.length; i++) if (t <= BAND[i][0]) { const [a, b] = [BAND[i - 1], BAND[i]]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); } return BAND.at(-1)[1]; };
const marqueeX = (t, loopAt) => -V_SELL * (t - 44.0) + P_SELL * (Math.floor((t - loopAt) / 2) + 1);
function marqueeKeys(x0, loopAt, dy) {
  const ts = new Set();
  for (let t = 41.9; t <= 48.6 + 1e-9; t += 0.1) ts.add(+t.toFixed(2));
  for (let L = loopAt - 4; L <= 48.6; L += 2) if (L > 41.9) { ts.add(+(L - 0.001).toFixed(3)); ts.add(+L.toFixed(3)); }
  return [...ts].sort((a, b) => a - b).map((t) => [t, x0 + marqueeX(t, loopAt), bandAt(t) + dy]);
}
const sellStyle = (el) => { el.style.letterSpacing = `${SELL_LS}px`; return el; };
const sell = sellStyle(text(SELL, { fs: SELL_FS, fw: 900, color: "#fff", center: false }));
const sellGhostT = sellStyle(text(SELL, { fs: SELL_FS, fw: 900, cls: "outline", center: false, flip: true }));
const sellGhostB = sellStyle(text(SELL, { fs: SELL_FS, fw: 900, cls: "outline", center: false, flip: true }));
track(sell, marqueeKeys(MAIN_X, 44.75, MAIN_DY));
track(sellGhostT, marqueeKeys(GT_X, 45.55, GT_DY));
track(sellGhostB, marqueeKeys(GB_X, 45.45, GB_DY));
appear(sell, 41.9, 48.5, 0.1); appear(sellGhostT, 41.9, 48.5, 0.1); appear(sellGhostB, 41.9, 48.5, 0.1);
const wThat = text(tx("wThat", "that"), { fs: 24, color: "#fff" });
const wBetter = text(tx("wBetter", "better"), { fs: 24, color: "#fff" });
tl.set(wThat, { x: 394, y: 602 }, 41); appear(wThat, 41.6, 48.3);
jump(wThat, 43.4, 660, 684, -90); jump(wThat, 45.4, 980, 322, 0); jump(wThat, 47.0, 390, 327, -90); jump(wThat, 47.8, 394, 152, -90);
tl.set(wBetter, { x: 294, y: 224, rotation: -90 }, 43); appear(wBetter, 43.4, 48.6);
jump(wBetter, 45.4, 1314, 730, 0); jump(wBetter, 47.0, 1030, 740, -90); jump(wBetter, 48.3, 1029, 177, -90);
const rE1 = ring(24); tl.set(rE1, { x: 1356, y: 592 }, 41); appear(rE1, 41.6, 43);
const cE1 = curve("M 1370 592 L 1460 592"); draw(cE1, 41.6, 43, 0.4);
const cE2 = curve("M 1010 -20 C 1050 150 1200 300 1460 324"); draw(cE2, 43, 45, 1);
const cE3 = curve("M 260 672 C 330 780 400 880 460 960"); draw(cE3, 46.2, 46.9, 0.5);

/* ---- Cover 2: the black lifts away upwards; its bottom edge bulges 63px down at the centre.
   Keys are the measured edge (centre column) minus the cover's height. ---- */
const blackExit = cover("bottom", 457);
tl.set(blackExit, { opacity: 1 }, 42.5);
tl.set(domeBlack, { opacity: 0 }, 42.51);
track(blackExit, [[42.5, 1022], [42.75, 1012], [43.0, 985], [43.25, 968], [43.5, 959], [43.75, 957], [47.5, 957], [47.75, 953],
  [48.0, 790], [48.25, 540], [48.5, 373], [48.75, 258], [49.0, 177], [49.25, 117], [49.5, 73], [49.75, 20], [50.0, -20], [50.3, -120], [50.6, -400], [51.4, -2600]]
  .map(([t, yb]) => [t, 0, yb - 1400]));
// the nav leaves with the plant scene (on a phone the two icons stay: they are the only way to the other pages)
if (!matchMedia("(max-width: 820px)").matches) tl.to("#ui", { opacity: 0, duration: 0.5 }, 42.8);

/* ================================================================== *
 * SCENE F — our dream (white)
 * ================================================================== */
clip("hero2"); // "dream" with "our" baked inside its box until the word leaves
// "our" is keyed out of the baked box (it is shorter than 60px), so the DOM word carries it
const wOur = text(tx("wOur", "our"), { fs: 24, color: "#000", x: 520, y: 404 });
appear(wOur, 49.3, 57.0, 0.1);
jump(wOur, 56.0, 520, 730);
const wThis = text(tx("wThis", "this"), { fs: 24, color: "#000", rot: -90 });
tl.set(wThis, { x: 981, y: 237 }, 48.8); appear(wThis, 49.0, 57.2);
jump(wThis, 50.8, 206, 760, -90); jump(wThis, 52.8, 1234, 560, 0); jump(wThis, 54.8, 394, 840, -90);
const wIs = text(tx("wIs", "is"), { fs: 24, color: "#000" });
tl.set(wIs, { x: 1260, y: 800 }, 49); appear(wIs, 49.0, 57.2, 0.2);
jump(wIs, 51.3, 206, 222, 0); jump(wIs, 53.3, 594, 880, -90); jump(wIs, 54.8, 1154, 260, 0);
// a big dot (r=66) flies between the corners and a small one (r=33) orbits it; both measured per frame
// the big dot (r=66) teleports between stations, the small one (r=33) rolls along the curve;
// positions from the half-second sheets
// big dot: stations read off the sheets; it slides off the left edge at 51, then soft-blurs in
// at the lower-left at 53.4 and sharpens
const dF = dot(132, "#000");
tl.set(dF, { x: 536, y: 130 }, 49.8); appear(dF, 49.9, 56.6, 0.15);
jump(dF, 50.4, 169, 358); jump(dF, 51.0, -10, 300); jump(dF, 52.9, 607, 854); jump(dF, 53.4, 192, 614); jump(dF, 55.3, 830, 854); jump(dF, 55.9, 1245, 614); jump(dF, 56.4, 1440, 426);
tl.set(dF, { opacity: 0 }, 51.3); tl.set(dF, { opacity: 1 }, 52.9);
tl.set(dF, { filter: "blur(8px)" }, 52.9); tl.to(dF, { filter: "blur(0px)", duration: 1.2 }, 53.4);
// the blurred dot must never be seen half-faded: every jump fade on it becomes a hard switch
tl.getTweensOf(dF).forEach((tw) => { if (tw.vars.opacity === 0 && tw.duration() === 0.2) tw.duration(0.02); if (tw.vars.opacity === 1 && tw.duration() === 0.2) tw.duration(0.02); });
const dS = dot(66, "#000");
track(dS, [[51.9, 660, 820], [52.0, 660, 806], [52.3, 460, 370], [52.5, 232, 190], [52.6, 215, 100], [52.9, 215, 59], [53.0, 170, 50],
  [54.4, 1040, 580], [54.5, 1040, 580], [54.9, 1127, 722], [55.4, 1230, 936], [55.7, 1250, 1000]]);
tl.set(dS, { opacity: 1 }, 51.9); tl.set(dS, { opacity: 0 }, 53.05);
tl.set(dS, { opacity: 1 }, 54.4); tl.set(dS, { opacity: 0 }, 55.7);
// curves of the dream scene, traced from the sheets: an arc over the word, a spiral around "d"
// that stays and softens, then a loop over the "m" at the end
const cF1 = curve("M 700 94 C 1100 100 1400 400 1440 644", { color: "#9a9a9a" }); draw(cF1, 49.6, 51.6, 1);
const cF4 = curve("M 780 94 C 500 110 300 330 290 536 C 280 700 360 800 440 790 C 560 780 640 700 680 640 C 720 560 640 440 560 440 C 500 440 440 500 440 560", { color: "#9a9a9a", w: 1.3 }); draw(cF4, 50.3, 56.9, 1.4);
const cF2 = curve("M -20 516 C 100 420 300 280 430 296", { color: "#9a9a9a" }); draw(cF2, 51.3, 53.0, 1);
const cF3 = curve("M 0 500 C 200 700 500 890 900 740 C 1200 640 1380 460 1440 350", { color: "#9a9a9a" }); draw(cF3, 51.8, 56.9, 1.4);
const cF5 = curve("M 1040 600 C 1140 500 1180 380 1080 330 C 960 290 840 430 920 560 C 1000 700 1200 760 1230 880", { color: "#9a9a9a" }); draw(cF5, 54.8, 56.9, 1.2);
tl.to([cF4, cF3], { opacity: 0.35, duration: 0.4 }, 53.0); tl.to([cF4, cF3], { opacity: 1, duration: 0.4 }, 55.0);
const cF6 = curve("M -20 324 C 150 500 250 850 400 874 C 700 930 1000 700 940 184 C 900 -20 600 100 700 420 C 760 640 1200 980 1240 1000", { color: "#9a9a9a" }); draw(cF6, 55.3, 57.4, 1.6);

/* ================================================================== *
 * SCENE G — work carousel (white). Everything sits in one group so the
 * whole thing can slide up and out together.
 * ================================================================== */
const gWork = document.createElement("div"); gWork.className = "layer"; layers.main.appendChild(gWork);
// the cans and their string drift up a little, then shoot off the top (main can measured per 0.1s);
// the text and the grey ghost words stay put and simply vanish at 67.4
track(gWork, [[64.0, 0, 0], [66.0, 0, -30], [66.1, 0, -49], [66.2, 0, -75], [66.3, 0, -109], [66.4, 0, -151], [66.5, 0, -204], [66.6, 0, -270],
  [66.7, 0, -350], [66.8, 0, -440], [66.9, 0, -550], [67.0, 0, -680], [67.2, 0, -980], [67.4, 0, -1300]]);
const gWorkText = document.createElement("div"); gWorkText.className = "layer"; layers.main.appendChild(gWorkText);
// the string the cans hang from, inside the group so it leaves with them
const svgWork = makeSvg(gWork);
const string = curve("M -30 270 C 240 340 480 436 720 436 C 960 436 1200 340 1470 270", { color: "#444", svg: svgWork });
draw(string, 57.0, 67.4, 1.0);
// four cans on a carousel: one sweeps in from the left and out to the right, one enters to the centre,
// one appears small on the left, then at 59.8s the whole row rotates one slot while a fourth enters.
// Scale is radius/240; the small ones are blurred (blur eases with scale).
// each of the four circles is its own backend slot (can1..can4): one picture, a set of frames or a video, changed from the admin page.
// A video loops between the slot's t0 and t1; without the backend the old can picture is used for all four.
let canNo = 0;
const can = () => {
  const n = ++canNo, m = SEQ[`can${n}`];
  if (!m?.frameSet) return circleImg(`can${n}`, "/img/can.png", 480, { layer: gWork });
  const el = circleImg(`can${n}`, "", 480, { layer: gWork, fill: "#000" });
  const cv = document.createElement("canvas");
  cv.width = m.cell[0]; cv.height = m.cell[1];
  cv.style.cssText = "display:block;width:100%;height:100%";
  el.appendChild(cv);
  const g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  let shown = null, cur = 0;
  const paint = () => { const img = m.frameSet.best(cur); if (img && img !== shown) { g.clearRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); shown = img; } };
  m.frameSet.onLoad((i) => { if (i === cur) paint(); });
  paint();
  if (m.n > 1) {
    const span = Math.min(m.t1, DURATION) - m.t0, st = { p: 0 };
    if (span > 0) tl.to(st, { p: 1, duration: span, ease: "none", onUpdate: () => { const i = Math.floor(st.p * span * m.fps); cur = m.loop ? i % m.n : Math.min(i, m.n - 1); paint(); } }, m.t0);
  }
  return el;
};
const bl = (s) => Math.max(0, Math.min(8, 8 * (0.95 - s) / 0.5));
const canKeys = (ks) => ks.map(([t, x, y, s]) => [t, x, y, 0, s, bl(s)]);
const canA = can(), canB = can(), canC = can(), canD = can();
track(canA, canKeys([[57.0, 112, 295, 0.575], [57.1, 239, 355, 0.8], [57.2, 424, 400, 0.92], [57.3, 605, 422, 1], [57.4, 763, 425, 1], [57.5, 891, 418, 0.95],
  [57.6, 990, 406, 0.84], [57.7, 1062, 391, 0.71], [57.8, 1111, 379, 0.57], [57.9, 1139, 368, 0.46], [58.0, 1151, 365, 0.4], [58.4, 1155, 362, 0.39],
  [59.7, 1150, 365, 0.39], [59.8, 1164, 361, 0.37], [59.9, 1206, 348, 0.33], [60.0, 1273, 322, 0.28], [60.1, 1349, 289, 0.24], [60.2, 1420, 250, 0.2], [60.3, 1500, 200, 0.15]]));
appear(canA, 56.95, 60.3, 0.1);
track(canB, canKeys([[57.6, 116, 304, 0.575], [57.7, 160, 329, 0.7], [57.8, 224, 352, 0.83], [57.9, 302, 375, 0.92], [58.0, 384, 392, 1], [58.1, 480, 410, 1],
  [58.2, 581, 420, 1], [58.3, 666, 425, 1], [58.4, 721, 425, 1], [59.7, 720, 425, 1], [59.8, 772, 421, 1], [59.9, 830, 420, 0.98], [60.0, 887, 417, 0.93],
  [60.1, 943, 412, 0.875], [60.2, 995, 404, 0.8], [60.3, 1043, 395, 0.725], [60.4, 1084, 386, 0.64], [60.5, 1117, 377, 0.55], [60.6, 1140, 369, 0.48], [60.7, 1149, 366, 0.44]]));
appear(canB, 57.55, 67.6, 0.1);
track(canC, canKeys([[58.2, 236, 357, 0.36], [58.3, 250, 362, 0.38], [58.5, 255, 366, 0.42], [59.7, 251, 365, 0.43], [59.8, 337, 385, 0.47], [59.9, 414, 401, 0.49],
  [60.0, 480, 414, 0.53], [60.1, 533, 424, 0.58], [60.2, 582, 429, 0.65], [60.3, 619, 431, 0.725], [60.4, 648, 432, 0.8], [60.5, 668, 431, 0.88], [60.6, 680, 430, 0.96], [60.7, 684, 429, 1]]));
appear(canC, 58.15, 67.6, 0.1);
track(canD, canKeys([[60.1, 53, 274, 0.27], [60.2, 98, 305, 0.32], [60.3, 154, 328, 0.33], [60.4, 198, 344, 0.34], [60.5, 229, 355, 0.35], [60.6, 246, 361, 0.37], [60.7, 252, 363, 0.39]]));
appear(canD, 60.05, 67.6, 0.1);
const gLate = text(tx("gLate", "late"), { fs: 110, fw: 900, color: "#d4d4d4", layer: gWorkText });
const gWorkT = text(tx("gWorkT", "work"), { fs: 110, fw: 900, color: "#d4d4d4", layer: gWorkText });
const gS = text(tx("gS", "s"), { fs: 110, fw: 900, color: "#d4d4d4", layer: gWorkText });
const gSt = text(tx("gSt", "st"), { fs: 110, fw: 900, color: "#d4d4d4", layer: gWorkText });
// "late / work / s / st" teleport around the frame edges; positions read off the sheets
// the ghost words stay in the un-scrolled layer; after 66.4 they stand where the reference
// leaves them ("st" low-left, "s" at the left edge, "work" bottom-right) until the scene cuts
tl.set(gLate, { x: 190, y: 116, rotation: -90 }, 57); appear(gLate, 57.0, 66.4, 0.3);
jump(gLate, 59.9, 620, 830, -90); jump(gLate, 63.4, 1120, 666, 0); jump(gLate, 65.9, 190, 112, -90);
tl.set(gWorkT, { x: 1280, y: 666 }, 57); appear(gWorkT, 57.4, 67.3, 0.3);
jump(gWorkT, 63.4, 350, 230, -90); jump(gWorkT, 66.4, 1280, 1470, 0);
tl.set(gS, { x: 20, y: 666 }, 57); appear(gS, 57.4, 67.3, 0.3);
jump(gS, 59.9, 1130, 184); jump(gS, 63.4, 650, 906); jump(gS, 66.4, 20, 1490);
tl.set(gSt, { x: 190, y: 936, rotation: -90 }, 57); appear(gSt, 57.4, 67.3, 0.3);
jump(gSt, 59.9, 620, 70, -90); jump(gSt, 63.4, 190, 720, -90); jump(gSt, 65.9, 190, 910, -90); jump(gSt, 66.4, 190, 1400, -90);
const hisense = text(tx("hisense", "Hisense"), { fs: 36, fw: 900, color: "#9a9a9a", rot: -90, x: 756, y: 684, layer: gWorkText });
const workDares = text(tx("workDares", "for who dares"), { fs: 34, fw: 400, color: "#555", center: false, x: 800, y: 612, layer: gWorkText });
const workP = text(tx("workP", "at GOAT, we’ve always aimed to deliver services that stand out with top-notch quality. By quality, we mean obsessing over the smallest details and embracing new methods and technologies to bring creative and innovative ideas to life—even for the tiniest projects."), { fs: 17.5, color: "#000", center: false, x: 800, y: 672, w: 360, lh: 1.1, layer: gWorkText });
appear(workP, 58.8, 67.3, 0.2); appear(workDares, 58.4, 67.3, 0.2); appear(hisense, 58.8, 67.3, 0.2);
// the paragraph block rides up with the cans while the scene leaves; the ghost words do not
const gWorkPara = document.createElement("div"); gWorkPara.className = "layer"; layers.main.appendChild(gWorkPara);
[hisense, workDares, workP].forEach((e) => gWorkPara.appendChild(e));
track(gWorkPara, [[65.9, 0, 0], [66.0, 0, -30], [66.5, 0, -204], [67.0, 0, -680], [67.4, 0, -1300]]);
// the paragraph and "for who dares" blink off while the carousel turns (59.8-60.6)
[workP, workDares, hisense].forEach((e) => { tl.set(e, { opacity: 0 }, 59.85); tl.set(e, { opacity: 1 }, 60.6); });

/* ================================================================== *
 * SCENE H — goat (white). Group slides up and out at the end.
 * ================================================================== */
// the eye is a baked clip (it grows in, drifts, and leaves on its own measured path);
// the headline sits above it in a group that drifts up and shoots off with it
clip("eye");
const gGoat = document.createElement("div"); gGoat.className = "layer"; layers.main.appendChild(gGoat);
// exit measured per 0.05s on the headline and the paragraph (they move as one)
track(gGoat, [[73.0, 0, 0], [74.0, 0, -25], [74.3, 0, -80], [74.35, 0, -97], [74.4, 0, -117], [74.45, 0, -140], [74.5, 0, -167], [74.55, 0, -197],
  [74.6, 0, -233], [74.65, 0, -273], [74.7, 0, -320], [74.75, 0, -373], [74.8, 0, -432], [74.85, 0, -496], [74.9, 0, -559], [74.95, 0, -621], [75.0, 0, -677], [75.1, 0, -800]]);
const eyeArc = curve("M 1440 342 C 1380 290 1330 255 1280 242 C 1100 190 800 160 580 224", { color: "#444" }); draw(eyeArc, 67.3, 68.6, 1.0);
const goatBig = text(tx("goatBig", "goat"), { cls: "big", fs: 262, fw: 900, color: "#000", x: 711, y: 456, layer: gGoat });
goatBig.style.lineHeight = "0.9";
appear(goatBig, 67.5, 75.0, 0.1);
const colP = "at GOAT, we’ve always aimed to deliver services that stand out with top-notch quality. By quality. at GOAT, we’ve always aimed to deliver services that stand out with top-notch quality. By quality.";
const p1 = text(tx("p1", colP), { fs: 15, color: "#000", center: false, x: 597, y: 576, w: 262, lh: 1.25, layer: gGoat });
const p2 = text(tx("p2", colP), { fs: 15, color: "#000", center: false, x: 890, y: 576, w: 262, lh: 1.25, layer: gGoat });
appear(p1, 68.8, 75.05, 0.1); appear(p2, 69.3, 75.05, 0.1);
const hw = {
  est: text(tx("hw.est", "est"), { fs: 28, color: "#000" }), great: text(tx("hw.great", "great"), { fs: 28, color: "#000" }), is: text(tx("hw.is", "is"), { fs: 28, color: "#000" }),
  all: text(tx("hw.all", "all"), { fs: 28, color: "#000" }), of: text(tx("hw.of", "of"), { fs: 28, color: "#000" }), time: text(tx("hw.time", "time"), { fs: 28, color: "#000" }),
};
// positions read off the half-second sheets; "all" and "great" ride up with the leaving scene
tl.set(hw.is, { x: 18, y: 837, rotation: -90 }, 68.8); appear(hw.is, 68.9, 75.0, 0.1);
jump(hw.is, 70.8, 720, 272, 0); jump(hw.is, 73.4, 1240, 650, -90); jump(hw.is, 74.4, 1242, 507, -90);
track(hw.is, [[74.4, 1242, 507], [74.9, 1245, 165], [75.0, 1245, 60]]);
tl.set(hw.est, { x: 500, y: 66, rotation: -90 }, 69.4); appear(hw.est, 69.6, 74.9);
jump(hw.est, 71.4, 600, 822, -90); jump(hw.est, 73.4, 620, 288, 0); jump(hw.est, 74.4, 621, 147, 0);
tl.set(hw.time, { x: 1400, y: 236, rotation: -90 }, 69.4); appear(hw.time, 69.6, 75.0, 0.1);
jump(hw.time, 71.8, 334, 42, -90); jump(hw.time, 73.7, 1096, 200, -90); jump(hw.time, 74.4, 1101, 102, -90); jump(hw.time, 74.9, 1239, 12, -90);
tl.set(hw.all, { x: 1160, y: 460 }, 69.4); appear(hw.all, 69.6, 75.5, 0.1);
jump(hw.all, 71.8, 1026, 928); jump(hw.all, 73.7, 220, 894); jump(hw.all, 74.4, 225, 747);
track(hw.all, [[74.4, 225, 747], [74.9, 222, 405], [75.0, 213, 285], [75.1, 219, 195], [75.2, 219, 129], [75.3, 219, 90], [75.4, 213, 54], [75.5, 213, 0]]);
tl.set(hw.of, { x: 914, y: 742 }, 69.4); appear(hw.of, 69.6, 74.9);
jump(hw.of, 71.4, 1254, 672); jump(hw.of, 73.7, 114, 104);
tl.set(hw.great, { x: 500, y: 926, rotation: -90 }, 69.4); appear(hw.great, 69.6, 75.2, 0.1);
jump(hw.great, 71.4, 164, 572, -90); jump(hw.great, 73.4, 926, 774, 0); jump(hw.great, 74.4, 930, 627, 0);
track(hw.great, [[74.4, 930, 627], [74.9, 930, 282], [75.0, 927, 162], [75.1, 927, 72], [75.2, 927, -20]]);
// every "jump" fades the word out for 0.2s; the reference cuts, so the fade is tightened
[hw.is, hw.est, hw.time, hw.all, hw.of, hw.great].forEach((w) => tl.getTweensOf(w).forEach((tw) => { if (tw.vars.opacity === 0 && tw.duration() === 0.2) tw.duration(0.05); }));

/* ================================================================== *
 * SCENE I — hire goat (black hill rises, goat figure rides on it)
 * ================================================================== */
const domeBlack2 = cover("top", 490);
tl.set(domeBlack2, { opacity: 1 }, 74.6);
// crest height of the hill per 0.1s (bake.py HILL, measured 319px off-centre where the arc sits 13px
// below the crest). While it shoots up, the motion-blurred hill+goat band is a baked clip laid over the
// DOM hill; once it settles the walking goat clip (cropped 100px above the crest) takes over.
const hill = [[74.65, 0, 960], ...SEQ.hillrise.keys.map(([t, , y]) => [t, 0, y + 70 - 13])];
track(domeBlack2, hill);
clip("hillrise", { layer: layers.top });
clip("goat", { layer: layers.top });
const hire = text(tx("hire", "do you want to hire goat?"), { fs: 38, fw: 400, color: "#fff", x: 719, y: 387, layer: layers.top });
const hireP = text("", { fs: 15, color: "#8a8a8a", x: 719, y: 470, w: 1180, lh: 1.27, align: "center", layer: layers.top });
tx("hireP", "at GOAT, we’ve always aimed to deliver services that stand out with top-notch quality.\nBy quality, we mean obsessing over the smallest details .at GOAT, we’ve always aimed to deliver services that stand out with top-notch quality. By quality, we mean obsessing over the smallest details .").split("\n").forEach((line, i) => { if (i) hireP.append(document.createElement("br")); hireP.append(line); });
const btn = document.createElement("a");
btn.href = "/contact.html"; btn.className = "el"; btn.setAttribute("aria-label", "hire goat");
btn.style.cssText = `left:582px;top:540px;width:274px;height:59px;background:${settings.red};`;
btn.dataset.role = "red-btn"; layers.top.appendChild(btn); gsap.set(btn, { opacity: 0 });
show(hire, 75.2, 0.2); show(hireP, 75.2, 0.2); show(btn, 75.3, 0.15);
// stat counters roll like a slot machine with a blank gap between numbers; each column starts
// 0.15s after the previous (Prject first) and they land in the order read off the reference
// the reference reels are at 13 / 02 at 75.5 and 22 / 20 / 18 / 12 at 76.0 (reading the frames):
// each reel spins at its own speed from 0 and settles on 24 in this order: client, Prject, staff, years
const stats = [["Prject", 122, 75.4, 76.9], ["client", 476, 75.4, 76.5], ["staff", 812, 75.5, 76.8], ["years", 1160, 75.6, 77.3]];
stats.forEach(([label, x, start, land]) => {
  const target = counters?.[label] ?? 24; // the value the reel settles on, from the backend
  const lab = text(tx("stat." + label, label), { fs: 22, fw: 700, color: "#6d6d6d", center: false, rot: -90, x, y: 795, layer: layers.top });
  show(lab, 75.4, 0.1);
  const fs = 96, step = fs * 1.5, slot = document.createElement("div");
  slot.className = "slot"; slot.style.cssText = `left:${x + 32}px;top:707px;height:${fs}px;font-size:${fs}px;`;
  const col = document.createElement("div"); col.className = "col";
  for (let n = 0; n <= target; n++) { const d = document.createElement("div"); d.style.height = `${step}px`; d.textContent = n; col.appendChild(d); }
  slot.appendChild(col); layers.top.appendChild(slot);
  gsap.set(slot, { opacity: 0 }); gsap.set(col, { y: 0 });
  show(slot, start, 0.05);
  tl.to(col, { y: -target * step, duration: land - start, ease: "power1.out" }, start);
});
const hr = document.createElement("div");
hr.className = "el"; hr.style.cssText = "left:122px;top:880px;width:1195px;height:1px;background:#333;";
layers.top.appendChild(hr); gsap.set(hr, { opacity: 0 }); show(hr, 75.4, 0.4);
[[371, 757], [711, 757], [1061, 757]].forEach(([x, y]) => { const r = ring(24, "#777", layers.top); tl.set(r, { x, y }, 75); show(r, 75.3, 0.4); });

/* ------------------------------------------------------------------ *
 * Scroll binding
 * ------------------------------------------------------------------ */
const space = document.getElementById("scroll-space");
function sizeSpace() { space.style.height = `${DURATION * PX_PER_SECOND / settings.speed + window.innerHeight}px`; }
sizeSpace();

let st;
function bind() {
  if (CMP) return;
  st?.kill();
  st = ScrollTrigger.create({
    // the end is read from the spacer itself so the two can never disagree (a saved
    // "scroll length" used to change one without the other and the page stopped short)
    trigger: document.body, start: "top top", end: () => `+=${space.offsetHeight - window.innerHeight}`,
    scrub: settings.scrub,
    animation: tl,
  });
}
bind();
addEventListener("resize", sizeSpace);

const lenis = CMP ? null : new Lenis({ lerp: 0.12, smoothWheel: true });
if (lenis) {
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// seek helper for testing: ?t=24 jumps to 24s of the video clock
const qt = params.get("t");
if (qt !== null) {
  const p = Math.min(1, Number(qt) / DURATION);
  if (CMP) {
    document.fonts.ready.then(() => tl.progress(p));
    tl.progress(p);
  } else {
    const jumpTo = () => { lenis.scrollTo(Number(qt) * PX_PER_SECOND / settings.speed, { immediate: true, force: true }); ScrollTrigger.update(); tl.progress(p); };
    addEventListener("load", () => { setTimeout(jumpTo, 300); setTimeout(jumpTo, 900); });
  }
}
window.__tl = tl;

// the tuning panel is a design tool: it only appears with ?controls on the address
if (!CMP && params.has("controls")) mountPanel({
  settings,
  onSpeed() { sizeSpace(); bind(); ScrollTrigger.refresh(); },
  onScrub() { bind(); },
  onColors() {
    design.style.background = settings.whiteBg;
    design.style.setProperty("--bg", settings.whiteBg);
    document.querySelectorAll(".dome").forEach((d) => (d.style.background = settings.blackBg));
    document.querySelectorAll('[data-role="red"], [data-role="red-btn"]').forEach((e) => (e.style.background = settings.red));
  },
  onImage(key, url) { document.querySelectorAll(`.circle-img[data-key="${key}"] img, .circle-img[data-key="${key}-l"] img, .circle-img[data-key="${key}-r"] img, .circle-img[data-key="${key}-f"] img`).forEach((i) => (i.src = url)); },
});

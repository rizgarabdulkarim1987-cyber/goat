import { api } from "../api.js";
import { t, rtl } from "../lang.js";
import { loadContent, loadCounters } from "../clips.js";
import { h, mount } from "./dom.js";
import { mountShell } from "./shell.js";
import { aboutScroll } from "./about-scroll.js";

// About follows the design file scene by scene. Each scene is a 1438 x 960 stage like the home page's (x, y and sizes below
// are design pixels; --cu turns them into screen pixels). On a phone the stage becomes a plain flowing column.
// Every word, picture and list comes from the backend: the words from the Words tab (about.*), the pictures from Pictures
// (aboutHero ...), the team from Work, blog, team, the clients from the work list, the numbers from Numbers.
const content = await loadContent();
const pic = (key) => content?.images?.[key] || "";
const SVG = "http://www.w3.org/2000/svg";

const page = mountShell("about", { theme: "light" });
const root = h("div");
page.append(root);

const at = (x, y, extra = "") => `--x:${x};--y:${y}${extra}`;
// a word floating on the stage. In the design file a word "rot -90" reads top to bottom (`v`) and "rot 90" reads bottom to top (`v up`)
const fw = (key, def, x, y, { v = false, up = false, size, cls = "" } = {}) => h("span", { class: `fw${v ? " v" : ""}${up ? " up" : ""} ${cls}`, "data-m": "word", style: at(x, y, size ? `;--fs:${size}` : "") }, t(key, def));
const circ = (src, x, y, d, cls = "") => h("div", { class: `circ ${cls}`, "data-m": "circ", style: at(x, y, `;--d:${d}`) }, src ? h("img", { src, alt: "", loading: "lazy", decoding: "async" }) : null);
const dot = (x, y, d, cls = "") => h("span", { class: `dot ${cls}`, "data-m": "dot", style: at(x, y, `;--d:${d}`), "aria-hidden": "true" });
const ring = (x, y, d, cls = "") => h("span", { class: `ring ${cls}`, "data-m": "dot", style: at(x, y, `;--d:${d}`), "aria-hidden": "true" });
const mark = (key, def, color) => h("mark", { class: `hl hl-${color}`, "data-m": "hl" }, t(key, def));
// an upright paragraph of the design: 16px text in a column `w` design pixels wide
const par = (x, y, w, cls, ...kids) => h("p", { class: `par ${cls}`, "data-m": "word", style: at(x, y, `;--w:${w}`) }, ...kids);
const sec = (cls, key, def, x, y) => h("h2", { class: `sec ${cls}`, "data-m": "title", style: at(x, y) }, t(key, def));
const btn = (cls, key, def, href, x, y, w) => h("a", { class: cls, "data-m": "word", href, style: at(x, y, `;--w:${w}`) }, t(key, def));
// a word cut into the pieces the design scatters (Latin words only: Arabic and Kurdish letters must stay joined)
const cut = (word, ...pos) => (/^[a-z]+$/i.test(word) ? [word.slice(0, pos[0]), ...pos.slice(1).map((n, i) => word.slice(pos[i], n)), word.slice(pos.at(-1))] : [word]);
// hairline curves across the stage that draw themselves and are erased again by the scroll, as on the home page.
// ln() draws a gentle S-curve that fills the design's box (x, y, w, h): rising to the right, or falling when `rev`;
// `from` starts it at a given point instead (the black dots ride a path from its start)
const ln = (x, y, w, hh, { rev = false, from } = {}) => {
  const x1 = x + w, y1 = y + hh, a = rev ? y : y1, b = rev ? y1 : y, [sx, sy] = from || [x, a];
  return `M ${sx} ${sy} C ${x + w * .45} ${a}, ${x + w * .3} ${b}, ${x + w * .62} ${a + (b - a) * .68} S ${x1 - w * .05} ${b}, ${x1} ${b}`;
};
const hairs = (...paths) => {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "hairs");
  svg.setAttribute("viewBox", "0 0 1438 960");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) { const p = document.createElementNS(SVG, "path"); p.setAttribute("d", d); svg.append(p); }
  return svg;
};
const scene = (cls, ...kids) => h("section", { class: `scene ${cls}` }, ...kids);
const stage = (...kids) => h("div", { class: "stage" }, ...kids);
const photo = (key) => h("div", { class: "bg", "aria-hidden": "true" }, pic(key) ? h("img", { src: pic(key), alt: "", loading: "lazy", decoding: "async", "data-m": "bg" }) : null);
// a smooth curve through points (Catmull-Rom), carried far past both sides so no gap shows on a wide screen
const smooth = (pts, dy = () => 0, bottom = 960) => {
  const P = pts.map(([x, y]) => [x, y + dy(x)]), n = P.length;
  let d = `M -2400 ${P[0][1]} L ${P[0][0]} ${P[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, n - 1)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return `${d} L 3838 ${P[n - 1][1]} L 3838 ${bottom} L -2400 ${bottom} Z`;
};

await mount(root, async () => {
  const [about, counters, works] = await Promise.all([api("/api/about"), loadCounters(), api("/api/work").catch(() => [])]);
  const team = about.team || [];
  const clients = [...new Set(works.map((w) => w.client).filter(Boolean))];
  const avatar = (m) => h("span", { class: "avatar", "aria-hidden": "true" }, m.photo ? h("img", { src: m.photo, alt: "", loading: "lazy", decoding: "async" }) : Array.from(m.name)[0]);

  // 1 / creativity
  const s1 = scene("s1", stage(
    h("h1", { class: "vt t1", "data-m": "title", style: at(626, 195) }, t("about.s1.title", "creativity")),
    circ(pic("aboutHero"), 720, 202, 396),
    fw("about.s1.w1", "belongs", 316, 219), fw("about.s1.w2", "higher", 457, 499, { v: true }),
    fw("about.s1.w3", "on", 1192, 291, { v: true }), fw("about.s1.w4", "grounds", 982, 682),
    hairs(ln(0, 516, 1181, 305), ln(0, 700, 665, 496))));

  // 2 / we do dare
  const s2 = scene("s2", stage(
    h("div", { class: "circ dark-circ", "data-m": "circ", style: at(458, 229, ";--d:524") },
      h("p", { class: "statement" }, t("about.s2.l1", "Some follow the path."), h("br"), mark("about.s2.l2", "We climb.", "red"), h("br"), t("about.s2.l3", "Some play it safe."), h("br"), mark("about.s2.l4", "We jump.", "red"))),
    fw("about.s2.w1", "we", 326, 171, { v: true }), fw("about.s2.w2", "do", 1061, 486, { v: true }), fw("about.s2.w3", "dare", 721, 829),
    dot(982, 229, 79), dot(326, 460, 53), ring(195, 901, 131),
    hairs(ln(1054, 160, 391, 157, { from: [1021, 268] }), "M 352 486 C 330 520, 290 530, 240 545 S 90 545, -6 589")));

  // 3 / goat, the greatest of all time (a photograph, the word on top of it)
  const s3 = scene("s3 photo curve", photo("aboutOffice"), stage(
    h("span", { class: "giant", "data-m": "giant", style: at(442, 291) }, "goat"),
    fw("about.s3.w1", "we", 195, 220), fw("about.s3.g1", "the greatest", 589, 142, { v: true, cls: "bold", size: 40 }),
    fw("about.s3.g2", "of all time", 792, 623, { v: true, cls: "bold", size: 40 }), fw("about.s3.w2", "are", 1139, 730, { v: true }),
    par(875, 618, 246, "cap", mark("about.s3.caphl", "A kick-ass creative agency", "red"), " ", mark("about.s3.cap", "based in Sulaymaniyah, Iraq. Dreaming big and making waves since 2020.", "black")),
    ring(988, 181, 132), ring(305, 711, 54),
    hairs(ln(-106, 232, 1094, 346), ln(349, 549, 1091, 346, { rev: true }))));

  // 4 / three wild goats: the founders, from the team list. No photograph here, as in the design
  const names = team.slice(0, 3).map((m) => m.name);
  const nm = (i, def) => names[i] || def;
  const s4 = scene("s4", stage(
    sec("ink", "about.s4.title", "three wild goats", 358, 408),
    par(461, 147, 184, "", t("about.s4.p1", "")),
    par(720, 549, 138, "", t("about.s4.p2", "")),
    h("span", { class: "fw", "data-m": "word", style: at(143, 157) }, nm(0, "farok")),
    h("span", { class: "fw v up", "data-m": "word", style: at(1000, 290) }, nm(1, "fares")),
    h("span", { class: "fw v up", "data-m": "word", style: at(404, 642) }, nm(2, "jano")),
    ring(83, 161, 93, "glow g-red"), ring(65, 124, 104), ring(994, 215, 163, "glow g-purple"), ring(1009, 184, 157),
    ring(392, 709, 52, "glow g-yellow"), ring(431, 696, 53),
    hairs(ln(-21, 210, 365, 480, { rev: true }), ln(953, 337, 499, 444), ln(461, 708, 981, 208, { rev: true }))));

  // 5 / they climbed (photograph of the founders): the title is two words, each in its own column
  const tw = t("about.s5.title", "they climbed").split(/\s+/);
  const s5 = scene("s5 photo curve", photo("aboutFounders"), stage(
    tw.length === 2
      ? [h("h2", { class: "vt t5", "data-m": "title", style: at(302, 163) }, tw[0]), h("h2", { class: "vt t5", "data-m": "title", style: at(162, 280) }, tw[1])]
      : h("h2", { class: "vt t5", "data-m": "title", style: at(162, 163) }, tw.join(" ")),
    par(326, 421, 263, "ink", t("about.s5.p", "")),
    fw("about.s5.w1", "design", 720, 117), fw("about.s5.w2", "motion", 326, 724), fw("about.s5.w3", "camera", 1114, 442, { v: true, up: true }),
    ring(694, 265, 157), ring(878, 71, 210), ring(1087, 241, 132)));

  // 6 / a place built for ideas (the third picture hangs down into the next scene)
  const g6 = cut(t("about.s6.ghost", "culture"), 3, 6);
  const s6 = scene("s6 spill", stage(
    // the faint giant word behind everything, broken up as in the design
    h("span", { class: "giant faint v", "data-m": "word", "aria-hidden": "true", style: at(195, 1) }, g6[0]),
    g6[1] ? h("span", { class: "giant faint v", "data-m": "word", "aria-hidden": "true", style: at(195, 750) }, g6[1]) : null,
    g6[2] ? h("span", { class: "giant faint", "data-m": "word", "aria-hidden": "true", style: at(721, 514) }, g6[2]) : null,
    sec("l1", "about.s6.l1", "a place", 440, 258),
    sec("l2", "about.s6.l2", "built for ideas", 684, 399),
    par(1087, 113, 184, "", t("about.s6.p1", "")), par(1116, 564, 184, "", t("about.s6.p2", "")),
    btn("btn-red", "about.s6.btn", "read more", "#the-climb", 886, 564, 142),
    circ(pic("aboutSpace1"), 458, 563, 183), circ(pic("aboutSpace2"), 719, 725, 263), circ(pic("aboutSpace3"), 170, 829, 420)));

  // 7 / the workspace in big circles
  const s7 = scene("s7", stage(circ(pic("aboutSpace4"), 666, 166, 656), circ(pic("aboutSpace5"), 143, 551, 394)));

  // 8 / the climb: three columns and a timeline on a black hill
  const years = [1, 2, 3, 4, 5, 6, 7, 8];
  const stops = [[84, 797], [302, 797], [499, 675], [607, 620], [859, 545], [990, 343], [1187, 311], [1339, 221]];
  const crest = [[0, 826], ...stops.map(([x, y]) => [x + 8, y + 8]), [1438, 132]];
  const hill = (() => {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "hill");
    svg.setAttribute("viewBox", "0 0 1438 960");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    // the two grey layers sit behind the black ground and peek out above it on the left, fading into it on the right
    for (const [fill, dy] of [["#d3d2d2", (x) => -(150 * (1 - x / 1438) + 18)], ["#a7a5a6", (x) => -(70 * (1 - x / 1438) + 8)], ["#000", () => 0]]) {
      const p = document.createElementNS(SVG, "path"); p.setAttribute("d", smooth(crest, dy)); p.setAttribute("fill", fill); svg.append(p);
    }
    return svg;
  })();
  const s8 = scene("s8", stage(
    sec("ink", "about.s8.title", "the climb", 195, 84),
    par(221, 225, 210, "col", t("about.s8.c1", "")),
    par(458, 225, 210, "col", t("about.s8.c2", "")),
    par(695, 225, 177, "col", mark("about.s8.h1", "It pushed us higher.", "red"), h("br"), mark("about.s8.h2", "It made us sharper.", "red"), h("br"), mark("about.s8.h3", "It's just getting started.", "red")),
    hill, years.map((n, i) => h("span", { class: "stop", "data-m": "stop", style: at(stops[i][0], stops[i][1]) }, h("span", { class: "pt" }), h("span", { class: "tick" }), h("span", { class: "yr v" }, t(`about.tl.${n}`, String(2018 + n))))),
    ring(982, 920, 79)));
  s8.id = "the-climb";

  // 9 / the herd (black); the black hill of the climb runs straight into this scene
  const g9 = cut(t("about.s9.ghost2", "team"), 2);
  const s9 = scene("s9 dark", stage(
    h("span", { class: "giant faint", "data-m": "word", "aria-hidden": "true", style: at(64, 381) }, t("about.s9.ghost1", "the")),
    h("span", { class: "giant faint v up", "data-m": "word", "aria-hidden": "true", style: at(589, 105) }, g9[1] || g9[0]),
    g9[1] ? h("span", { class: "giant faint v up", "data-m": "word", "aria-hidden": "true", style: at(589, 803) }, g9[0]) : null,
    circ(pic("aboutHerd"), 379, 216, 525, "gray"),
    sec("white", "about.s9.title", "the herd", 851, 421),
    par(982, 200, 254, "", t("about.s9.a", ""), " ", mark("about.s9.hl1", "We look for passion.", "blue")),
    par(982, 271, 260, "", t("about.s9.b", "")),
    par(984, 574, 249, "", t("about.s9.c", ""), " ", mark("about.s9.hl2", "love what they do.", "blue"), " ", t("about.s9.d", "")),
    btn("btn-red", "about.s9.btn", "Meet the Herd", "#the-team", 984, 791, 130),
    ring(302, 237, 129), ring(1271, 841, 53), ring(116, 932, 105)));

  // 9b / climbed with us: the title, the paragraph lying on its side, the clients as grey wordmarks, then everyone in the team list
  // clients sit on a grid of five columns 262.5 apart; every second row is shifted and holds four
  const spot = (i) => { let r = 0, k = i; while (k >= (r % 2 ? 4 : 5)) { k -= r % 2 ? 4 : 5; r++; } return [(r % 2 ? 287 : 142) + k * 262.5, 537 + r * 108]; };
  const lastY = clients.length ? spot(clients.length - 1)[1] : 537;
  const s9b = scene("s9b dark", h("div", { class: "stage", style: `--sh:${Math.max(960, lastY + 160)}` },
    sec("white", "about.s9.team", "climbed with us", 348, 111),
    h("p", { class: "vcols", "data-m": "word", style: at(432, 241) }, t("about.s9b.p", "")),
    ring(1225, 309, 72), ring(-19, 642, 52),
    clients.length ? h("ul", { class: "clients", "aria-label": t("about.s10.title", "trusted by"), "data-m": "team" }, clients.map((c, i) => h("li", { style: at(...spot(i)) }, c))) : null),
  h("div", { class: "flow", id: "the-team" }, team.length ? h("ul", { class: "team", "data-m": "team" }, team.map((m) => h("li", null, avatar(m), h("span", { class: "name" }, m.name), h("span", { class: "small muted" }, m.role)))) : null));

  // 10 / three voices scattered over the stage, the word "testimonials" broken up behind them
  // each voice: a picture, the name and role, the words and (vertical) the company; voices 2 and 3 are right-aligned
  const voice = (n, [px, py, d], [nx, ny], [qx, qy], [lx, ly], right = false) => {
    const co = t(`about.s10.co${n}`, n === "" ? "nahj al-iraq" : "");
    return [
      circ(pic("aboutQuote"), px, py, d, "gray"),
      h("div", { class: `q-name${right ? " r" : ""}`, "data-m": "word", style: at(nx, ny) }, h("strong", null, t(`about.s10.name${n}`, t("about.s10.name", "Ali Shawkat"))), h("span", null, t(`about.s10.role${n}`, t("about.s10.role", "marketing manager")))),
      h("blockquote", { class: `q-text${right ? " r" : ""}`, "data-m": "word", style: at(qx, qy) }, t(`about.s10.quote${n}`, t("about.s10.quote", ""))),
      co ? h("span", { class: "fw v up q-co", "data-m": "word", style: at(lx, ly) }, co) : null];
  };
  const s10 = scene("s10 dark", stage(
    fw("about.s10.ghost1", "tes", 197, 404), fw("about.s10.ghost3", "als", 1114, 45), fw("about.s10.ghost2", "timion", 929, 617, { v: true }),
    voice("", [326, 52, 210], [536, -13], [536, 62], [459, -11]),
    voice("2", [982, 261, 263], [628, 307], [629, 382], [1218, 270], true),
    voice("3", [536, 640, 183], [187, 562], [188, 637], [655, 556], true),
    hairs(ln(-8, 89, 374, 413, { rev: true }), ln(1082, 520, 415, 339), ln(676, 711, 765, 135, { rev: true }))));

  // 11 / ready to climb with us
  const s11 = scene("s11 cap", stage(
    fw("about.s11.w1", "ready", 195, 336), fw("about.s11.w2", "to", 460, 761, { v: true }), fw("about.s11.w3", "with", 1114, 449),
    h("span", { class: "giant ink", "data-m": "giant", style: at(342, 460) }, t("about.s11.big", "climb")),
    par(588, 754, 430, "ink", t("about.s11.a", ""), " ", mark("about.s11.hl1", "build a brand, launch a campaign", "yellow"), " ", t("about.s11.b", "or"), " ", mark("about.s11.hl2", "join a team", "yellow"), " ", t("about.s11.c", ""), " ", mark("about.s11.hl3", "They climb.", "yellow")),
    btn("btn-red", "about.s11.btn1", "Work With Us", "/contact.html", 589, 901, 142), btn("btn-ink", "about.s11.btn2", "Join the Herd", "/contact.html", 748, 901, 142),
    dot(1002, 341, 33), dot(-41, 709, 105), dot(1219, 825, 52),
    hairs("M 1018 357 C 900 400, 800 380, 650 560 S 200 900, -49 958", "M 11 762 C 200 700, 300 560, 500 480 S 1000 240, 1442 221", "M 1245 851 C 1100 760, 1090 560, 1200 470 S 1400 380, 1442 347")));

  // 12 / the end: hire us, the numbers, the links (white above, the black ground starts at y 276 with a curved top edge)
  // the last word of "ready to climb with us" stands here, just under the stage of the scene before it
  const stat = (k, cap, x) => h("li", { style: at(x, 741) }, h("span", { class: "cap v up" }, t(`ui.stat.${cap}`, cap)), h("span", { class: "num" }, String(counters?.[k] ?? 0)));
  const cols = [["about", "/about.html"], ["contact", "/contact.html"], ["blog", "/blog.html"], ["work", "/work.html"]];
  const s12 = scene("s12", h("div", { class: "ground", "aria-hidden": "true" }), h("div", { class: "stage", style: "--sh:1289" },
    fw("about.s11.w4", "us", 1323, 54, { v: true, cls: "us" }),
    pic("aboutMagnet") ? h("img", { class: "magnet", "data-m": "circ", src: pic("aboutMagnet"), alt: "", loading: "lazy", decoding: "async", style: at(584, 161) }) : null,
    h("h2", { class: "hire", "data-m": "title", style: at(194, 438) }, t("about.s12.title", "do you want to hire goat?")),
    h("p", { class: "sub", "data-m": "word", style: at(194, 507) }, t("about.s12.sub", "")),
    btn("btn-red", "about.s12.btn", "get in touch", "/contact.html", 641, 624, 158),
    counters ? h("ul", { class: "stats", "data-m": "stats" }, [["Prject", "projects", 194], ["client", "clients", 490], ["staff", "staff", 786], ["years", "years", 1082]].map(([k, c, x]) => stat(k, c, x))) : null,
    ring(416, 804, 16, "sm"), ring(712, 804, 16, "sm"), ring(1008, 804, 16, "sm"),
    h("hr", { class: "rule", style: at(194, 914) }),
    h("nav", { class: "foot-links", "aria-label": "footer" }, cols.map(([k, href], i) => h("div", { class: "fcol", style: at(194 + i * 228, 962) },
      h("a", { class: "flabel", href }, t(`nav.${k}`, k)),
      k === "work" ? h("div", { class: "flinks" }, clients.slice(0, 12).map((c, j) => h("a", { href, style: `--c:${Math.floor(j / 3)};--r:${j % 3}` }, c))) : null))),
    h("a", { class: "flogo", href: "/", "aria-label": "goat creative agency", style: at(679, 1159) }, h("img", { src: content?.images?.logoCircle || "/img/logo-circle.svg", alt: "" }), h("img", { src: content?.images?.logoText || "/img/logo-text.svg", alt: "" })),
    h("p", { class: "copy", style: at(194, 1203) }, t("about.s12.copy", `© ${new Date().getFullYear()} GOAT creative agency`))));

  return h("div", { class: "about" }, s1, s2, s3, s4, s5, s6, s7, s8, s9, s9b, s10, s11, s12);
});

aboutScroll(page, rtl);

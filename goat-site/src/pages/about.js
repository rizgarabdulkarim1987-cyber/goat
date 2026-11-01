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
// a word floating on the stage; `v` makes it vertical (it reads top to bottom, as in the design)
const fw = (key, def, x, y, { v = false, size, cls = "" } = {}) => h("span", { class: `fw${v ? " v" : ""} ${cls}`, "data-m": "word", style: at(x, y, size ? `;--fs:${size}` : "") }, t(key, def));
const circ = (src, x, y, d, cls = "") => h("div", { class: `circ ${cls}`, "data-m": "circ", style: at(x, y, `;--d:${d}`) }, src ? h("img", { src, alt: "", loading: "lazy", decoding: "async" }) : null);
const dot = (x, y, d, cls = "") => h("span", { class: `dot ${cls}`, "data-m": "dot", style: at(x, y, `;--d:${d}`), "aria-hidden": "true" });
const mark = (key, def, color) => h("mark", { class: `hl hl-${color}`, "data-m": "hl" }, t(key, def));
// hairline curves across the stage that draw themselves and are erased again by the scroll, as on the home page
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

await mount(root, async () => {
  const [about, counters, works] = await Promise.all([api("/api/about"), loadCounters(), api("/api/work").catch(() => [])]);
  const team = about.team || [];
  const clients = [...new Set(works.map((w) => w.client).filter(Boolean))];
  const avatar = (m) => h("span", { class: "avatar", "aria-hidden": "true" }, m.photo ? h("img", { src: m.photo, alt: "", loading: "lazy", decoding: "async" }) : Array.from(m.name)[0]);

  // 1 / creativity
  const s1 = scene("s1", stage(
    h("h1", { class: "vt t1", "data-m": "title", style: at(640, 110) }, t("about.s1.title", "creativity")),
    circ(pic("aboutHero"), 745, 215, 370),
    fw("about.s1.w1", "belongs", 390, 246), fw("about.s1.w2", "higher", 483, 540, { v: true }),
    fw("about.s1.w3", "on", 1213, 300, { v: true }), fw("about.s1.w4", "grounds", 1049, 700),
    hairs("M -20 700 C 160 560 360 540 560 600 S 880 760 1040 720 S 1250 560 1180 480", "M -20 760 C 140 640 300 620 480 660")));

  // 2 / we do dare
  const s2 = scene("s2", stage(
    h("div", { class: "circ dark-circ", "data-m": "circ", style: at(457, 207, ";--d:524") },
      h("p", { class: "statement" }, t("about.s2.l1", "Some follow the path."), h("br"), mark("about.s2.l2", "We climb.", "red"), h("br"), t("about.s2.l3", "Some play it safe."), h("br"), mark("about.s2.l4", "We jump.", "red"))),
    fw("about.s2.w1", "we", 350, 170, { v: true }), fw("about.s2.w2", "do", 1085, 470, { v: true }), fw("about.s2.w3", "dare", 740, 820),
    dot(1020, 246, 80), dot(330, 440, 50), h("span", { class: "ring", "data-m": "dot", style: at(90, 840, ";--d:150") }),
    hairs("M 640 -20 C 700 80 720 160 700 230", "M 1040 250 C 1200 150 1340 220 1460 320", "M -20 520 C 120 560 240 500 330 460")));

  // 3 / goat, the greatest of all time (a photograph, the word on top of it)
  const s3 = scene("s3 photo curve", photo("aboutOffice"), stage(
    h("span", { class: "giant", "data-m": "giant", style: at(440, 360) }, "goat"),
    fw("about.s3.w1", "we", 235, 330), fw("about.s3.g1", "the greatest", 600, 230, { v: true, cls: "bold" }),
    fw("about.s3.g2", "of all time", 806, 660, { v: true, cls: "bold" }), fw("about.s3.w2", "are", 1140, 740, { v: true }),
    h("p", { class: "caption", "data-m": "word", style: at(855, 665) }, mark("about.s3.caphl", "A kick-ass creative agency", "red"), " ", t("about.s3.cap", "based in Sulaymaniyah, Iraq. Dreaming big and making waves since 2020.")),
    hairs("M -20 760 C 300 640 560 820 880 700 S 1300 560 1460 640")));

  // 4 / two wild goats: the founders, from the team list
  const names = team.slice(0, 3);
  // as in the design: the first name sits horizontally by the logo, the other two stand upright beside a ring
  const spots = [{ x: 90, y: 70, glow: "red", ring: 0, v: false }, { x: 1000, y: 190, glow: "purple", ring: 165, v: true }, { x: 350, y: 540, glow: "yellow", ring: 40, v: true }];
  const s4 = scene("s4", stage(
    h("h2", { class: "mid-title", "data-m": "title", style: at(0, 400) }, t("about.s4.title", "three wild goats")),
    h("p", { class: "vp", "data-m": "word", style: at(500, 180) }, t("about.s4.p1", "")),
    h("p", { class: "vp", "data-m": "word", style: at(745, 545) }, t("about.s4.p2", "")),
    names.map((m, i) => h("span", { class: `founder glow-${spots[i].glow}`, "data-m": "word", style: at(spots[i].x, spots[i].y, `;--o:${spots[i].ring}`) }, spots[i].ring ? h("span", { class: "orbit" }) : null, h("span", { class: `fname${spots[i].v ? " v" : ""}` }, m.name))),
    hairs("M 150 150 C 330 250 300 520 90 600 S -60 540 -20 480", "M 1060 250 C 960 420 1060 640 1300 700 S 1480 640 1460 620", "M 420 640 C 450 760 700 840 1000 760 S 1300 640 1460 700")));

  // 5 / they climbed (photograph of the founders)
  const s5 = scene("s5 photo", photo("aboutFounders"), stage(
    h("h2", { class: "vt t5", "data-m": "title", style: at(211, 174) }, t("about.s5.title", "they climbed")),
    h("p", { class: "caption wide", "data-m": "word", style: at(335, 533) }, t("about.s5.p", "")),
    fw("about.s5.w1", "design", 632, 174), fw("about.s5.w2", "motion", 347, 843), fw("about.s5.w3", "camera", 1116, 545, { v: true }),
    h("span", { class: "ring", "data-m": "dot", style: at(856, 136, ";--d:150") }), h("span", { class: "ring", "data-m": "dot", style: at(707, 322, ";--d:130") }), h("span", { class: "ring", "data-m": "dot", style: at(1040, 330, ";--d:130") })));

  // 6 / a place built for ideas
  const s6 = scene("s6", stage(
    // the faint giant word behind everything, as in the design
    h("span", { class: "giant faint v", "data-m": "word", "aria-hidden": "true", style: at(230, -40) }, t("about.s6.ghost", "culture")),
    h("h2", { class: "place l1", "data-m": "title", style: at(445, 150) }, t("about.s6.l1", "a place")),
    h("h2", { class: "place l2", "data-m": "title", style: at(680, 270) }, t("about.s6.l2", "built for ideas")),
    h("p", { class: "vp", "data-m": "word", style: at(1190, 20) }, t("about.s6.p1", "")), h("p", { class: "vp", "data-m": "word", style: at(1090, 445) }, t("about.s6.p2", "")),
    h("a", { class: "btn-red", "data-m": "word", href: "#the-climb", style: at(940, 450) }, t("about.s6.btn", "read more")),
    circ(pic("aboutSpace3"), 483, 398, 170), circ(pic("aboutSpace2"), 174, 658, 420), circ(pic("aboutSpace1"), 707, 572, 273)));

  // 7 / the workspace in big circles
  const s7 = scene("s7", stage(circ(pic("aboutSpace4"), 657, 60, 620), circ(pic("aboutSpace5"), 161, 407, 385)));

  // 8 / the climb: three columns and a timeline on a black hill
  const years = [1, 2, 3, 4, 5, 6, 7];
  const hill = (() => {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "hill");
    svg.setAttribute("viewBox", "0 0 1438 960");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    for (const [fill, d] of [["#d4d4d4", "M -2400 700 L 0 700 C 220 640 380 700 620 640 S 900 430 1120 420 S 1340 260 1438 200 L 3838 200 L 3838 960 L -2400 960 Z"], ["#9a9a9a", "M -2400 770 L 0 770 C 220 720 420 790 640 700 S 940 500 1160 470 S 1340 340 1438 290 L 3838 290 L 3838 960 L -2400 960 Z"], ["#000", "M -2400 820 L 0 820 C 200 780 420 820 660 740 S 960 560 1180 520 S 1340 420 1438 370 L 3838 370 L 3838 960 L -2400 960 Z"]]) {
      const p = document.createElementNS(SVG, "path"); p.setAttribute("d", d); p.setAttribute("fill", fill); svg.append(p);
    }
    return svg;
  })();
  const stops = [[150, 790], [350, 790], [560, 725], [760, 650], [960, 580], [1140, 520], [1310, 450]];
  const s8 = scene("s8", stage(
    h("h2", { class: "climb-title", "data-m": "title", style: at(211, 124) }, t("about.s8.title", "the climb")),
    h("p", { class: "col", "data-m": "word", style: at(235, 290) }, t("about.s8.c1", "")),
    h("p", { class: "col", "data-m": "word", style: at(471, 290) }, t("about.s8.c2", "")),
    h("p", { class: "col", "data-m": "word", style: at(694, 290) }, mark("about.s8.h1", "It pushed us higher.", "red"), h("br"), mark("about.s8.h2", "It made us sharper.", "red"), h("br"), mark("about.s8.h3", "It's just getting started.", "red")),
    hill, years.map((n, i) => h("span", { class: "stop", "data-m": "stop", style: at(stops[i][0], stops[i][1]) }, h("span", { class: "pt" }), h("span", { class: "tick" }), h("span", { class: "yr v" }, t(`about.tl.${n}`, String(2019 + n))))),
    h("span", { class: "ring", "data-m": "dot", style: at(1080, 820, ";--d:56") })));
  s8.id = "the-climb";

  // 9 / the herd (black)
  // the black hill of the climb runs straight into this scene, so there is no curve between them
  const s9 = scene("s9 dark", stage(
    h("span", { class: "giant faint", "data-m": "word", "aria-hidden": "true", style: at(99, 421) }, t("about.s9.ghost1", "the")),
    h("span", { class: "giant faint v up", "data-m": "word", "aria-hidden": "true", style: at(640, 100) }, t("about.s9.ghost2", "team")),
    circ(pic("aboutHerd"), 397, 223, 484, "gray"),
    h("h2", { class: "herd-title", "data-m": "title", style: at(843, 434) }, t("about.s9.title", "the herd")),
    h("p", { class: "small-p", "data-m": "word", style: at(967, 211) }, t("about.s9.a", ""), " ", mark("about.s9.hl1", "We look for passion.", "blue"), h("br"), h("br"), t("about.s9.b", "")),
    h("p", { class: "small-p", "data-m": "word", style: at(967, 570) }, t("about.s9.c", ""), " ", mark("about.s9.hl2", "love what they do.", "blue"), h("br"), t("about.s9.d", "")),
    h("a", { class: "btn-red", "data-m": "word", href: "#the-team", style: at(967, 781) }, t("about.s9.btn", "Meet the Herd")),
    h("span", { class: "ring", "data-m": "dot", style: at(960, -30, ";--d:87") }), h("span", { class: "ring", "data-m": "dot", style: at(316, 254, ";--d:112") }), h("span", { class: "ring", "data-m": "dot", style: at(1234, 812, ";--d:62") }), h("span", { class: "ring", "data-m": "dot", style: at(130, 911, ";--d:112") })));

  // 9b / climbed with us: everyone in the team list
  // 9b / climbed with us: the title, a paragraph standing in vertical columns, the clients as grey wordmarks, then the team
  const s9b = scene("s9b dark", h("div", { class: "flow", id: "the-team" },
    h("h2", { class: "mid-title big", "data-m": "title" }, t("about.s9.team", "climbed with us")),
    h("p", { class: "vcols", "data-m": "word" }, t("about.s9b.p", "")),
    clients.length ? h("ul", { class: "clients", "aria-label": t("about.s10.title", "trusted by"), "data-m": "team" }, clients.map((c) => h("li", null, c))) : null,
    team.length ? h("ul", { class: "team", "data-m": "team" }, team.map((m) => h("li", null, avatar(m), h("span", { class: "name" }, m.name), h("span", { class: "small muted" }, m.role)))) : null));

  // 10 / three voices scattered over the stage, the word "testimonials" broken up faintly behind them
  const voice = (n, cx, cy, d, tx, ty, cls = "") => h("figure", { class: `quote ${cls}`, "data-m": "word", style: at(tx, ty) },
    circ(pic("aboutQuote"), 0, 0, d, "gray q-pic"),
    h("figcaption", null, h("strong", { class: "q-name" }, t(`about.s10.name${n}`, t("about.s10.name", "Ali Shawkat"))), h("span", { class: "q-role" }, t(`about.s10.role${n}`, t("about.s10.role", "marketing manager"))), h("blockquote", { class: "q-text" }, t(`about.s10.quote${n}`, t("about.s10.quote", "")))));
  const s10 = scene("s10 dark", stage(
    h("span", { class: "giant faint", "data-m": "word", "aria-hidden": "true", style: at(190, 440) }, t("about.s10.ghost1", "tes")),
    h("span", { class: "giant faint v", "data-m": "word", "aria-hidden": "true", style: at(880, 600) }, t("about.s10.ghost2", "timon")),
    h("span", { class: "giant faint", "data-m": "word", "aria-hidden": "true", style: at(1060, 120) }, t("about.s10.ghost3", "ials")),
    voice("", 0, 0, 220, 335, 90), voice("2", 0, 0, 250, 560, 390, "flip"), voice("3", 0, 0, 220, 215, 640),
    hairs("M -20 300 C 200 100 500 180 760 240 S 1100 340 1250 260", "M 980 960 C 1100 820 1300 700 1460 760")));

  // 11 / ready to climb with us
  const s11 = scene("s11 cap", stage(
    fw("about.s11.w1", "ready", 211, 174), fw("about.s11.w2", "to", 508, 545, { v: true }), fw("about.s11.w3", "with", 1091, 285), fw("about.s11.w4", "us", 1314, 794, { v: true }),
    h("span", { class: "giant ink", "data-m": "giant", style: at(372, 290) }, t("about.s11.big", "climb")),
    h("p", { class: "small-p", "data-m": "word", style: at(583, 521) }, t("about.s11.a", ""), " ", mark("about.s11.hl1", "build a brand, launch a campaign", "yellow"), " ", t("about.s11.b", "or"), " ", mark("about.s11.hl2", "join a team", "yellow"), " ", t("about.s11.c", ""), " ", mark("about.s11.hl3", "They climb.", "yellow")),
    h("a", { class: "btn-red", "data-m": "word", href: "/contact.html", style: at(595, 682) }, t("about.s11.btn1", "Work With Us")), h("a", { class: "btn-ink", "data-m": "word", href: "/contact.html", style: at(756, 682) }, t("about.s11.btn2", "Join the Herd")),
    dot(1004, 166, 50, "blurred"), dot(1141, 620, 50), dot(37, 508, 100),
    hairs("M 760 -20 C 900 100 1020 80 1080 340", "M 1150 250 C 1300 330 1340 480 1060 600", "M -20 560 C 160 520 360 420 700 330")));

  // 12 / the end: hire us, the numbers, the links
  const stat = (k, cap) => h("li", null, h("span", { class: "num" }, String(counters?.[k] ?? 0)), h("span", { class: "cap" }, t(`ui.stat.${cap}`, cap)));
  const s12 = scene("s12 dark curve", h("div", { class: "flow end" },
    pic("aboutMagnet") ? h("img", { class: "magnet", "data-m": "circ", src: pic("aboutMagnet"), alt: "", loading: "lazy", decoding: "async" }) : null,
    h("h2", { class: "hire", "data-m": "title" }, t("about.s12.title", "do you want to hire goat?")),
    h("p", { class: "sub", "data-m": "word" }, t("about.s12.sub", "")),
    h("a", { class: "btn-red", "data-m": "word", href: "/contact.html" }, t("about.s12.btn", "get in touch")),
    counters ? h("ul", { class: "stats", "data-m": "stats" }, [["Prject", "projects"], ["client", "clients"], ["staff", "staff"], ["years", "years"]].map(([k, c]) => stat(k, c))) : null,
    h("nav", { class: "foot-links", "aria-label": "footer" }, [["about", "/about.html"], ["work", "/work.html"], ["contact", "/contact.html"], ["blog", "/blog.html"]].map(([k, href]) => h("a", { href }, t(`nav.${k}`, k))))));

  return h("div", { class: "about" }, s1, s2, s3, s4, s5, s6, s7, s8, s9, s9b, s10, s11, s12);
});

aboutScroll(page, rtl);

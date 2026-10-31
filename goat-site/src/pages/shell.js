import "../style.css";
import "../pages.css";
import { h, curve } from "./dom.js";
import { api } from "../api.js";
import { loadContent } from "../clips.js";
import { lang, rtl, t, langSwitch } from "../lang.js";

// every page waits for the words of its language before it draws (a backend that is down just leaves the English ones)
const content = await loadContent();

const DESIGN_W = 1438, DESIGN_H = 960;
const MAIN = [["home", "/"], ["about", "/about.html"], ["work", "/work.html"], ["contact", "/contact.html"], ["blog", "/blog.html"]];
const BOTTOM = [["music", "/music.html"], ["search", "/search.html"]];

// the fixed nav column is the home page's own: same 1438x960 canvas, scaled to fit, same positions
function fit() { document.documentElement.style.setProperty("--s", Math.min(innerWidth / DESIGN_W, innerHeight / DESIGN_H)); }

let current = "home";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// the hairlines that sweep across the home page, drawn behind every page (fixed, so they glide as the page scrolls)
// every page draws its own lines
const SWOOSH = {
  about: ["M -40 700 C 260 520 520 860 820 600 S 1280 300 1500 380", "M -40 760 C 300 600 560 900 860 660 S 1300 380 1500 450"],
  work: ["M -40 880 L 520 620 C 700 540 900 520 1500 120", "M -40 930 L 560 680 C 740 600 940 580 1500 200", "M 200 980 L 760 760 C 940 690 1140 650 1500 330"],
  contact: ["M -40 300 C 400 100 700 700 1000 480 S 1300 120 1500 260", "M -40 380 C 420 200 720 760 1020 560 S 1320 200 1500 340"],
  blog: ["M -40 880 L 1500 880", "M -40 900 C 500 880 900 920 1500 890"],
  music: ["M -40 760 C 160 640 260 880 460 760 S 760 640 960 760 S 1260 880 1500 760", "M -40 800 C 160 680 260 920 460 800 S 760 680 960 800 S 1260 920 1500 800", "M -40 840 C 160 720 260 960 460 840 S 760 720 960 840 S 1260 960 1500 840"],
  search: ["M -40 120 C 300 60 600 360 900 260 S 1300 700 1500 640", "M -40 180 C 320 120 620 420 920 320 S 1320 760 1500 700"],
  social: ["M -40 100 L 700 960", "M 300 -40 L 1500 700", "M -40 420 L 1100 1000"],
};
function swoosh() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "swoosh");
  svg.setAttribute("viewBox", "0 0 1438 960");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  for (const d of SWOOSH[current] || SWOOSH.about) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

// what slides in as it scrolls into view (and is simply visible when motion is reduced or JS is slow)
const REVEAL = ".sec, .work, .post-row, .track, .link, .result, .field, .team li, .stats li, .notice, .article > *, .chips";
function reveal(root) {
  if (REDUCED || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  const seen = new WeakSet();
  const scan = () => root.querySelectorAll(REVEAL).forEach((el) => { if (!seen.has(el)) { seen.add(el); el.classList.add("rv"); io.observe(el); } });
  new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  scan();
}

// the picture that sits in the page's circle: one frame of a circle clip, or the can picture
const ART = { about: ["eye", 1], work: [["can2", 0], ["can3", 0], ["can1", 0]], contact: ["plant", 0.5], blog: ["leapA", 0.5], music: ["cheer", 0.5], search: ["eye", 1], social: ["leapB", 0.5] };
async function orbPicture(spec) {
  const c = await api(`/api/clips/${spec[0]}`);
  return c.frames?.[Math.min(c.n - 1, Math.floor(c.n * spec[1]))];
}

/** Wrap the page: fixed logo + nav + social label, then <main>. `page` is the active nav item. */
export function mountShell(page, { theme = "dark", title } = {}) {
  current = page;
  fit();
  addEventListener("resize", fit);
  document.body.dataset.theme = theme;
  document.body.dataset.page = page;
  document.title = `${title || t(`nav.${page}`, page)} — goat creative agency`;
  const link = ([name, href]) => h("a", { href, "aria-current": name === page ? "page" : null }, t(`nav.${name}`, name));
  const ui = h("div", { id: "frame" }, h("header", { id: "ui" },
    h("a", { class: "logo", href: "/", "aria-label": "goat creative agency, home" },
      h("img", { class: "logo-circle", src: "/img/logo-circle.svg", alt: "" }),
      h("span", { class: "logo-text-wrap" }, h("img", { class: "logo-text", src: "/img/logo-text.svg", alt: "" }))),
    h("nav", { class: "nav-main", "aria-label": "main" }, MAIN.map(link)),
    h("nav", { class: "nav-bottom", "aria-label": "more" }, BOTTOM.map(link)),
    h("a", { class: "social", href: "/social.html", "aria-current": page === "social" ? "page" : null }, t("nav.social", "social")),
    langSwitch()));
  // the fixed column stays on the left in every language; only the page itself reads right to left
  const main = h("main", { id: "page", dir: rtl ? "rtl" : "ltr", lang });
  document.body.replaceChildren(swoosh(), ui, main);
  reveal(main);
  // the page glides a little against the scroll, like the circles on the home page
  if (!REDUCED) addEventListener("scroll", () => document.documentElement.style.setProperty("--sy", String(scrollY)), { passive: true });
  // the logo pictures can be replaced from the admin page
  if (content?.images?.logoCircle) ui.querySelector(".logo-circle").src = content.images.logoCircle;
  if (content?.images?.logoText) ui.querySelector(".logo-text").src = content.images.logoText;
  return main;
}

/** the page title: a big heavy word with a hairline drawn under it */
export function pageHead(word, sub) {
  const img = h("img", { alt: "", decoding: "async" });
  // the work page shows three cans in a row of circles, like the home page's work scene; every other page one circle
  const imgs = current === "work" ? [img, h("img", { alt: "", decoding: "async" }), h("img", { alt: "", decoding: "async" })] : [img];
  const orb = h("div", { class: "orb", "aria-hidden": "true" }, h("div", { class: "orb-ring" }, h("span", { class: "orb-dot" })),
    imgs.map((im, i) => h("div", { class: `orb-pic p${i + 1}` }, im)));
  // one picture per circle: the work page has three, each taken from its own work-scene slot
  const specs = ART[current] ? (Array.isArray(ART[current][0]) ? ART[current] : [ART[current]]) : [];
  imgs.forEach((im, i) => {
    const spec = specs[i] || specs[0];
    if (spec) orbPicture(spec).then((src) => { if (src) { if (i === 0) im.onload = () => orb.classList.add("on"); im.src = src; } }).catch(() => {});
  });
  return h("header", { class: "head" },
    h("span", { class: "ghost", "aria-hidden": "true" }, word),
    orb,
    h("h1", null, word),
    sub ? h("p", { class: "lede" }, sub) : null,
    curve("M 0 50 C 220 6 420 14 640 32 C 820 46 960 16 1100 4", { cls: "head-curve" }));
}

/** every page ends the same way: a way back home */
export function homeLink() {
  return h("footer", { class: "foot" },
    h("a", { class: "back", href: "/" }, h("span", { class: "back-ring", "aria-hidden": "true" }), t("ui.back", "back to home")));
}

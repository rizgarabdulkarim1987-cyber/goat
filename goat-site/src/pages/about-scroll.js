import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

// About moves the way the home page does: a smooth scroller (Lenis) and tweens with no easing of their own, scrubbed by the
// scroll. Words slide in and drift away, circles come into focus and grow, hairlines draw and are erased again, highlighter
// bars fill, the hill rises and its years pop up, the numbers roll. Nothing splits text, so Arabic and Kurdish stay joined.
// Reduced motion gets the plain page; a phone gets one simple rise per element.
export function aboutScroll(page, rtl) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const phone = matchMedia("(max-width: 820px)").matches;
  ScrollTrigger.config({ ignoreMobileResize: true });
  const $$ = (sel, root = page) => [...root.querySelectorAll(sel)];

  if (!phone) {
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // the red line along the bottom: how far down the page you are
  const bar = document.createElement("div");
  bar.className = "scroll-bar";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);
  gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  const start = rtl ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";

  if (phone) {
    // one gentle rise per thing, tied to the scroll
    $$("[data-m]").forEach((el) => gsap.fromTo(el, { opacity: 0, y: 36 }, { opacity: 1, y: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 98%", end: "top 72%", scrub: 0.5 } }));
    $$(".hl").forEach((el) => gsap.fromTo(el, { "--w": "0%" }, { "--w": "100%", ease: "none", scrollTrigger: { trigger: el, start: "top 90%", end: "top 62%", scrub: 0.5 } }));
    countUp(page, $$);
    return;
  }

  $$(".scene").forEach((scene, idx) => {
    // the first scene is already on screen when the page opens: it plays in on its own, and only drifts away with the scroll
    const first = idx === 0;
    const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: scene, start: first ? "top top" : "top 90%", end: first ? "bottom top" : "bottom 15%", scrub: 1 } });
    const intro = first ? gsap.timeline({ defaults: { ease: "power2.out" } }) : null;
    // `into` is an entrance (time-based on the first scene, scrubbed on the others); `away` is the drift that follows
    const into = (el, from, to, at, dur) => (first ? intro.fromTo(el, from, { ...to, duration: dur * 5 }, at * 4) : tl.fromTo(el, from, { ...to, duration: dur }, at));
    // everything rests exactly where the design puts it while the scene is centred (about 0.4 to 0.6 of the scrub); only after that does it drift off
    const rest = first ? 0.12 : 0.62;
    const away = (el, from, to, at, dur) => tl.fromTo(el, from, { ...to, duration: Math.min(dur, 0.38), immediateRender: false }, rest + Math.min(at, 0.4) * 0.1);
    const parts = (sel) => $$(sel, scene);

    // the big titles are uncovered by a wipe
    parts('[data-m="title"]').forEach((el, i) => {
      into(el, { clipPath: start, opacity: 0.2 }, { clipPath: "inset(0 0% 0 0)", opacity: 1 }, 0.04 + i * 0.05, 0.18);
      away(el, { opacity: 1 }, { opacity: 0 }, 0.3 + i * 0.03, 0.4);
    });

    // floating words: slide in from below, hold, then drift upward away; vertical ones come from the side
    parts('[data-m="word"]').forEach((el, i) => {
      const vertical = el.classList.contains("v") || el.classList.contains("vp");
      into(el, { opacity: 0, y: vertical ? 90 : 60 }, { opacity: 1, y: 0 }, 0.02 + i * 0.035, 0.14);
      away(el, { opacity: 1, yPercent: 0 }, { opacity: 0, yPercent: -90 - (i % 3) * 40 }, 0.2 + i * 0.03, 0.5);
    });

    // circles come into focus from a blur and grow; they keep growing a little with the scroll
    parts('[data-m="circ"]').forEach((el, i) => {
      into(el, { scale: 0.4, opacity: 0, filter: "blur(18px)" }, { scale: 1, opacity: 1, filter: "blur(0px)" }, 0.02 + i * 0.05, 0.26);
      away(el, { scale: 1, opacity: 1 }, { scale: 1.06, opacity: 0 }, 0.24 + i * 0.05, 0.5);
      // the picture inside settles from a close-up while the circle opens, then drifts the other way
      const img = el.querySelector("img");
      if (img) {
        into(img, { scale: 1.45 }, { scale: 1 }, 0.02 + i * 0.05, 0.4);
        away(img, { scale: 1, yPercent: 0 }, { scale: 1.08, yPercent: 5 }, 0.3, 0.7);
      }
    });
    // the thin ring around a founder opens up, as if drawn
    parts(".founder .orbit").forEach((el, i) => into(el, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }, 0.12 + i * 0.06, 0.25));
    // the black dots ride the head of a hairline as it draws, exactly as on the home page; the rings just soften in
    const paths = parts(".hairs path");
    const riders = parts(".dot");
    riders.forEach((el, i) => {
      const path = paths[i];
      if (!path) {
        into(el, { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)" }, 0.08 + i * 0.04, 0.12);
      } else {
        const t0 = first ? 0.2 + i * 0.2 : 0.05 + i * 0.06, dur = first ? 2.4 : 0.6;
        const ride = { motionPath: { path, align: path, alignOrigin: [0.5, 0.5], start: 0, end: 1 }, duration: dur };
        if (first) { intro.set(el, { motionPath: { ...ride.motionPath, end: 0 }, opacity: 1 }, t0); intro.to(el, ride, t0); }
        else { tl.set(el, { motionPath: { ...ride.motionPath, end: 0 }, opacity: 1 }, t0); tl.to(el, ride, t0); }
      }
      // then it slips away and fades, line and dot leaving together
      away(el, { opacity: 1 }, { opacity: 0, y: `+=${(i % 2 ? -1 : 1) * 90}`, x: `+=${(i % 2 ? 1 : -1) * 60}`, duration: 0.5 }, 0.22, 0.5);
    });
    parts(".ring").forEach((el, i) => {
      into(el, { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)" }, 0.08 + i * 0.04, 0.12);
      away(el, { opacity: 1 }, { opacity: 0 }, 0.3 + i * 0.03, 0.4);
    });

    // hairlines draw and erase, as on the home page
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: `${len} ${len * 4}`, strokeDashoffset: len });
      if (first) intro.to(p, { strokeDashoffset: 0, duration: 2.4 }, 0.2 + i * 0.2); else tl.to(p, { strokeDashoffset: 0, duration: 0.6 }, 0.05 + i * 0.06);
      tl.to(p, { opacity: 0, duration: 0.25 }, rest + 0.05 + i * 0.02);
    });

    // highlighter bars fill left to right (right to left in Arabic and Kurdish)
    parts('[data-m="hl"]').forEach((el, i) => into(el, { "--w": "0%" }, { "--w": "100%" }, 0.2 + i * 0.05, 0.12));

    // photographs behind a scene slide against the scroll, and the giant word grows into place
    parts('[data-m="bg"]').forEach((el) => tl.fromTo(el, { yPercent: 0 }, { yPercent: -15, duration: 1 }, 0));
    parts('[data-m="giant"]').forEach((el) => {
      into(el, { scale: 0.55, opacity: 0, filter: "blur(16px)", transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, filter: "blur(0px)" }, 0.02, 0.25);
      away(el, { scale: 1, opacity: 1 }, { scale: 1.06, opacity: 0 }, 0.3, 0.5);
    });

    // the hill rises in three layers and its years pop up along it
    parts(".hill path").forEach((p, i) => tl.fromTo(p, { yPercent: 18 + i * 8 }, { yPercent: 0, duration: 0.3 }, 0.02 + i * 0.05));
    parts('[data-m="stop"]').forEach((el, i) => tl.fromTo(el, { opacity: 0, scale: 0.2, y: 24 }, { opacity: 1, scale: 1, y: 0, duration: 0.1 }, 0.12 + i * 0.05));

    // the team and the clients pop in one after the other
    parts('[data-m="team"]').forEach((list) => tl.fromTo([...list.children], { opacity: 0, scale: 0.6, y: 30 }, { opacity: 1, scale: 1, y: 0, stagger: 0.04, duration: 0.2 }, 0.12));
  });

  countUp(page, $$);
  addEventListener("load", () => ScrollTrigger.refresh());
}

// the four numbers roll up to their value as they come into view
function countUp(page, $$) {
  $$(".stats .num").forEach((el) => {
    const to = Number(el.textContent);
    if (!Number.isFinite(to)) return;
    const o = { v: 0 };
    el.textContent = "0";
    gsap.to(o, { v: to, ease: "none", onUpdate: () => { el.textContent = String(Math.round(o.v)); }, scrollTrigger: { trigger: el, start: "top 95%", end: "top 60%", scrub: 0.6 } });
  });
}

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// About is scrubbed by the scroll: the big circle shrinks away as the page starts, every heading is wiped in as it passes,
// the team pops in one by one, the numbers count up, and a red line along the bottom shows how far down you are.
// Nothing here splits text, so Arabic and Kurdish letters stay joined. Reduced motion gets the plain page.
export function aboutScroll(page, rtl) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const phone = matchMedia("(max-width: 820px)").matches;
  // a phone's address bar sliding away is a height-only resize: no re-measure for it
  ScrollTrigger.config({ ignoreMobileResize: true });

  const bar = document.createElement("div");
  bar.className = "scroll-bar";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);
  gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  const head = page.querySelector(".head");
  if (head) {
    const tl = { trigger: head, start: "top top", end: "bottom top", scrub: 0.6 };
    gsap.to(head.querySelector(".orb-pic"), { scale: phone ? 0.8 : 0.55, yPercent: -8, ease: "none", scrollTrigger: tl });
    gsap.to(head.querySelector(".orb-ring"), { scale: phone ? 0.8 : 0.55, opacity: 0, ease: "none", scrollTrigger: tl });
    gsap.to(head.querySelector("h1"), { yPercent: -35, opacity: 0, ease: "none", scrollTrigger: tl });
  }

  // each section's heading is uncovered by a wipe tied to the scroll (a clip, not a split: it works for every script)
  const hidden = rtl ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
  page.querySelectorAll(".sec").forEach((sec) => {
    const st = { trigger: sec, start: "top 100%", end: "top 60%", scrub: 0.6 };
    const h2 = sec.querySelector(".h2");
    if (h2) gsap.fromTo(h2, { clipPath: hidden }, { clipPath: "inset(0 0% 0 0)", ease: "none", scrollTrigger: st });
    const vl = sec.querySelector(".vlabel");
    if (vl) gsap.fromTo(vl, { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, ease: "none", scrollTrigger: st });
  });

  // the team pops in, one circle after the other
  const team = page.querySelector(".team");
  if (team) {
    gsap.fromTo(team.querySelectorAll(".avatar"), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, ease: "none", stagger: 0.15, scrollTrigger: { trigger: team, start: "top 90%", end: "center 55%", scrub: 0.6 } });
  }

  // the numbers roll up to their value as they come into view
  page.querySelectorAll(".stats .num").forEach((el) => {
    const to = Number(el.textContent);
    if (!Number.isFinite(to)) return;
    const o = { v: 0 };
    el.textContent = "0";
    gsap.to(o, { v: to, ease: "none", onUpdate: () => { el.textContent = String(Math.round(o.v)); }, scrollTrigger: { trigger: el, start: "top 92%", end: "top 55%", scrub: 0.6 } });
  });

  // the layout moves when the pictures and fonts settle
  addEventListener("load", () => ScrollTrigger.refresh());
}

import { api } from "../api.js";
import { t, rtl } from "../lang.js";
import { loadCounters } from "../clips.js";
import { h, vlabel, mount } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";
import { aboutScroll } from "./about-scroll.js";

const page = mountShell("about", { theme: "dark" });
const body = h("div");
page.append(pageHead(t("nav.about", "about")), body, homeLink());

await mount(body, async () => {
  const [about, counters] = await Promise.all([api("/api/about"), loadCounters()]);
  // every second section is a white band across the page, like the long About strip in the design file
  let n = 0;
  const sec = (label, ...kids) => h("section", { class: `sec${n++ % 2 ? " light" : ""}` }, vlabel(label), h("div", null, ...kids));
  // a team member: the photo in a circle, or the first letter in a ring until a photo is added in the admin page
  const avatar = (m) => h("span", { class: "avatar", "aria-hidden": "true" }, m.photo ? h("img", { src: m.photo, alt: "", loading: "lazy", decoding: "async" }) : Array.from(m.name)[0]);
  return h("div", null,
    sec(t("ui.about.hello", "hello"), h("h2", { class: "h2" }, about.headline), h("p", { class: "p" }, about.intro),
      h("ul", { class: "chips values", "aria-label": t("ui.about.values", "what we care about") }, about.values.map((v) => h("li", { class: "chip" }, v)))),
    about.sections.map((s) => sec(s.label, h("h2", { class: "h2" }, s.title), h("p", { class: "p" }, s.text))),
    about.team.length > 0 && sec(t("ui.about.team", "team"), h("ul", { class: "team" }, about.team.map((m) => h("li", null, avatar(m), h("span", { class: "name" }, m.name), h("span", { class: "small muted" }, m.role))))),
    counters && sec(t("ui.about.numbers", "numbers"), h("ul", { class: "stats" }, [["Prject", "projects"], ["client", "clients"], ["staff", "staff"], ["years", "years"]]
      .map(([k, cap]) => h("li", null, h("span", { class: "num" }, String(counters[k])), h("span", { class: "cap" }, t(`ui.stat.${cap}`, cap)))))));
});
aboutScroll(page, rtl);

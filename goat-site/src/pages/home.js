import { api } from "../api.js";
import { t } from "../lang.js";
import { loadCounters } from "../clips.js";
import { h, vlabel, mount } from "./dom.js";
import { mountShell, pageHead } from "./shell.js";

/* The home page on a phone or a narrow tablet: the same words and pictures as the scrolling film on a large
   screen, laid out as an ordinary page (the film is drawn for a 3:2 canvas and does not fit a phone). */
const page = mountShell("home", { theme: "dark", title: t("nav.home", "home") });
const body = h("div");
page.append(pageHead(t("goatBig", "goat"), t("firsts", "do the firsts")), body);

const circle = (clip, at) => {
  const img = h("img", { alt: "", decoding: "async", loading: "lazy" });
  api(`/api/clips/${clip}`).then((c) => { img.src = c.frames[Math.min(c.n - 1, Math.floor(c.n * at))]; }).catch(() => {});
  return h("li", { class: "dot-pic" }, img);
};

mount(body, async () => {
  const counters = await loadCounters();
  const sec = (label, ...kids) => h("section", { class: "sec" }, vlabel(label), h("div", null, ...kids));
  return h("div", null,
    sec(t("goatBig", "goat"), h("h2", { class: "h2" }, t("dares", "for who dares")), h("p", { class: "p" }, t("daresP", ""))),
    h("ul", { class: "pics", "aria-hidden": "true" }, circle("leapA", 0.5), circle("leapB", 0.5), circle("eye", 1)),
    sec(`${t("creative", "creative")} ${t("ideas", "ideas")}`, h("h2", { class: "h2" }, t("smash", "smash the records")), h("p", { class: "p" }, t("p1", "")), h("p", { class: "p" }, t("p2", ""))),
    counters && sec(t("ui.about.numbers", "numbers"), h("ul", { class: "stats" }, [["Prject", "projects"], ["client", "clients"], ["staff", "staff"], ["years", "years"]]
      .map(([k, cap]) => h("li", null, h("span", { class: "num" }, String(counters[k])), h("span", { class: "cap" }, t(`ui.stat.${cap}`, cap)))))),
    sec(t("nav.contact", "contact"), h("h2", { class: "h2" }, t("hire", "do you want to hire goat?")), h("p", { class: "p" }, t("hireP", "")),
      h("a", { class: "btn", href: "/contact.html" }, t("nav.contact", "contact"))));
});

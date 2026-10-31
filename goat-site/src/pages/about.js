import { api } from "../api.js";
import { t } from "../lang.js";
import { loadCounters } from "../clips.js";
import { h, vlabel, mount, ring } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";

const page = mountShell("about", { theme: "dark" });
const body = h("div");
page.append(pageHead(t("nav.about", "about")), body, homeLink());

mount(body, async () => {
  const [about, counters] = await Promise.all([api("/api/about"), loadCounters()]);
  const sec = (label, ...kids) => h("section", { class: "sec" }, vlabel(label), h("div", null, ...kids));
  return h("div", null,
    sec(t("ui.about.hello", "hello"), h("h2", { class: "h2" }, about.headline), h("p", { class: "p" }, about.intro),
      h("ul", { class: "chips values", "aria-label": t("ui.about.values", "what we care about") }, about.values.map((v) => h("li", { class: "chip" }, v)))),
    about.sections.map((s) => sec(s.label, h("h2", { class: "h2" }, s.title), h("p", { class: "p" }, s.text))),
    sec(t("ui.about.team", "team"), h("ul", { class: "team" }, about.team.map((m) => h("li", null, ring(14), h("span", { class: "name" }, m.name), h("span", { class: "small muted" }, m.role))))),
    counters && sec(t("ui.about.numbers", "numbers"), h("ul", { class: "stats" }, [["Prject", "projects"], ["client", "clients"], ["staff", "staff"], ["years", "years"]]
      .map(([k, cap]) => h("li", null, h("span", { class: "num" }, String(counters[k])), h("span", { class: "cap" }, t(`ui.stat.${cap}`, cap)))))));
});

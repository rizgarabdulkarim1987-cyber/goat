import { api } from "../api.js";
import { t } from "../lang.js";
import { h, mount } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";

const page = mountShell("work", { theme: "light" });
const list = h("div");
page.append(pageHead(t("nav.work", "work"), t("ui.work.lede", "selected projects. open one to read the story.")), list, homeLink());

mount(list, async () => {
  const works = await api("/api/work");
  if (!works.length) return h("div", { class: "state" }, h("p", { class: "state-title" }, t("ui.work.empty", "no projects here yet. check back soon.")));
  const ALL = "*all";
  const cats = [ALL, ...new Set(works.map((w) => w.category))];
  let cat = ALL;
  const ul = h("ul", { class: "works" });
  const rows = works.map((w, i) => {
    const more = h("div", { class: "more", id: `more-${w.slug}` }, h("div", null, h("div", { class: "inner" }, h("span"),
      h("div", null, w.image ? h("img", { class: "work-pic", src: w.image, alt: "", loading: "lazy", decoding: "async" }) : null, h("p", { class: "p" }, w.body), h("ul", { class: "chips" }, w.tags.map((t) => h("li", { class: "chip" }, t)))))));
    const btn = h("button", { type: "button", "aria-expanded": "false", "aria-controls": more.id },
      h("span", { class: "no" }, String(i + 1).padStart(2, "0")),
      h("span", null, h("span", { class: "t" }, w.title), h("span", { class: "p muted", style: "display:block;margin-top:10px" }, w.summary)),
      h("span", { class: "meta" }, `${w.client} · ${w.year}`, h("br"), w.category));
    const li = h("li", { class: "work", id: w.slug }, btn, more);
    const toggle = (open = !li.classList.contains("open")) => { li.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); more.toggleAttribute("inert", !open); };
    more.setAttribute("inert", ""); // closed text is out of the tab order and the reading order
    btn.addEventListener("click", () => toggle());
    return { w, li, toggle };
  });
  const show = () => rows.forEach(({ w, li }) => { li.hidden = cat !== ALL && w.category !== cat; });
  const filters = h("div", { class: "chips", role: "group", "aria-label": t("ui.filter", "filter by category"), style: "margin-bottom:28px" }, cats.map((c) => {
    const b = h("button", { type: "button", class: "chip", "aria-pressed": String(c === cat) }, c === ALL ? t("ui.all", "all") : c);
    b.addEventListener("click", () => { cat = c; filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); show(); });
    return b;
  }));
  ul.append(...rows.map((r) => r.li));
  // arriving from search: /work.html#slug opens and marks that project
  const hit = rows.find((r) => r.w.slug === decodeURIComponent(location.hash.slice(1)));
  if (hit) { hit.toggle(true); hit.li.dataset.hit = ""; requestAnimationFrame(() => hit.li.scrollIntoView({ block: "center" })); }
  return h("div", null, filters, ul);
});

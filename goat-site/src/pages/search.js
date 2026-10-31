import { api } from "../api.js";
import { t } from "../lang.js";
import { h } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";

const page = mountShell("search", { theme: "dark" });
const input = h("input", { class: "search-box", type: "search", placeholder: t("ui.s.placeholder", "search work, blog, about"), "aria-label": t("ui.s.label", "search"), autocomplete: "off" });
const out = h("div", { "aria-live": "polite" });
page.append(pageHead(t("nav.search", "search")), input, out, homeLink());

let timer, seq = 0;
async function run() {
  const q = input.value.trim();
  const mine = ++seq;
  history.replaceState(null, "", q ? `?q=${encodeURIComponent(q)}` : location.pathname);
  if (!q) return out.replaceChildren();
  try {
    const found = await api(`/api/search?q=${encodeURIComponent(q)}`);
    if (mine !== seq) return; // a newer search is already running
    out.replaceChildren(found.length
      ? h("ul", { class: "results" }, found.map((r) => h("li", { class: "result" }, h("a", { href: r.url },
        h("span", { class: "small muted" }, t(`ui.type.${r.type}`, r.type)), h("span", null, h("p", { class: "t" }, r.title), h("p", { class: "p muted" }, r.text))))))
      : h("p", { class: "p muted", style: "margin-top:32px" }, t("ui.s.none", "nothing found. try another word.")));
  } catch {
    if (mine === seq) out.replaceChildren(h("p", { class: "p", role: "alert", style: "margin-top:32px" }, t("ui.s.down", "the backend is not answering.")));
  }
}
input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 200); });
input.value = new URLSearchParams(location.search).get("q") || "";
if (input.value) run(); else input.focus();

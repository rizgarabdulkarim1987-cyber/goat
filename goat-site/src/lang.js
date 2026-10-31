// The site speaks English, Arabic and Sorani Kurdish. The choice is kept in the browser (?lang=xx sets it too);
// switching reloads the page, so the home page's timeline is simply built again in the new language.
export const LANGS = [["en", "EN"], ["ar", "عربي"], ["ckb", "کوردی"]];
const KEY = "goat-lang";

function pick() {
  const ok = (l) => LANGS.some(([k]) => k === l);
  const asked = new URLSearchParams(location.search).get("lang");
  try {
    if (ok(asked)) { localStorage.setItem(KEY, asked); return asked; }
    const kept = localStorage.getItem(KEY);
    if (ok(kept)) return kept;
  } catch { /* storage can be blocked: the page still works, in English */ }
  return ok(asked) ? asked : "en";
}

export const lang = pick();
export const rtl = lang !== "en";

const root = document.documentElement;
root.lang = lang === "ckb" ? "ckb" : lang;
root.dataset.lang = lang;
// Moranga has no Arabic letters: the style sheet falls back to a system font that has them (nothing is loaded from the internet)

// the words the backend holds for this language; `t(id, english)` falls back to the English given at the call
let content = null;
export const setContent = (c) => { content = c; };
export const t = (id, def = id) => content?.texts?.[id] ?? def;

/** a date in the page's language, with Latin digits */
export function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const opts = { day: "numeric", month: "short", year: "numeric" };
  try { return d.toLocaleDateString(t("ui.locale", "en-GB"), opts); } catch { return d.toLocaleDateString("en-GB", opts); }
}

function choose(next) {
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  const url = new URL(location.href);
  url.searchParams.delete("lang");
  history.replaceState(null, "", url);
  location.reload();
}

/** the three-way switch that sits in the fixed column of every page */
export function langSwitch() {
  const wrap = document.createElement("div");
  wrap.className = "langs";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "language");
  for (const [code, label] of LANGS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.lang = code;
    if (code === lang) b.setAttribute("aria-current", "true");
    b.addEventListener("click", () => code !== lang && choose(code));
    wrap.append(b);
  }
  return wrap;
}

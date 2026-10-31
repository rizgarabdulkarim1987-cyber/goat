import { t } from "../lang.js";

// tiny DOM builder: h("a", { href: "/" }, "text", child) — text goes in as text nodes, never as HTML
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// a vertical word, like the small labels on the home page
export const vlabel = (text, cls = "") => h("span", { class: `vlabel ${cls}`, "aria-hidden": "true" }, text);

// a hairline curve that draws itself in, as the home page's lines do
export function curve(d, { w = 1, color = "#9a9a9a", viewBox = "0 0 1100 60", cls = "" } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", `curve ${cls}`);
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", color);
  p.setAttribute("stroke-width", w);
  p.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(p);
  return svg;
}

export const ring = (size = 24) => h("span", { class: "ring", style: `width:${size}px;height:${size}px`, "aria-hidden": "true" });

/** run `build` and put what it returns into `host`; show a plain message and a retry when the backend is down */
export async function mount(host, build) {
  host.setAttribute("aria-busy", "true");
  try {
    host.replaceChildren(await build());
  } catch (err) {
    host.replaceChildren(h("div", { class: "state", role: "alert" },
      h("p", { class: "state-title" }, err.status === 404 ? t("ui.st.nf", "not found") : t("ui.st.down", "the backend is not answering")),
      h("p", { class: "state-text" }, err.status === 404 ? t("ui.st.nfText", "this page does not exist.") : t("ui.st.downText", "start it with npm start inside the backend folder, then try again.")),
      err.status === 404 ? null : h("button", { type: "button", class: "btn", onclick: () => mount(host, build) }, t("ui.st.retry", "try again"))));
  } finally { host.removeAttribute("aria-busy"); }
}

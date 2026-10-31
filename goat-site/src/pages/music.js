import { api } from "../api.js";
import { t } from "../lang.js";
import { h, mount } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";

const page = mountShell("music", { theme: "dark" });
const body = h("div");
page.append(pageHead(t("nav.music", "music"), t("ui.music.lede", "the sound behind the scroll.")), body, homeLink());

mount(body, async () => {
  const tracks = await api("/api/music");
  return h("div", null,
    h("ul", { class: "tracks" }, tracks.map((t, i) => h("li", { class: "track" },
      h("span", { class: "small muted" }, String(i + 1).padStart(2, "0")),
      h("span", null, h("span", { class: "t" }, t.title), h("span", { class: "small muted", style: "display:block;margin-top:8px" }, `${t.artist} — ${t.note}`)),
      h("span", { class: "small muted" }, t.length)))),
    h("p", { class: "p muted soon" }, t("ui.music.soon", "the player is coming soon.")));
});

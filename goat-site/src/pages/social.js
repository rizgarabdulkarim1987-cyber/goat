import { api } from "../api.js";
import { t } from "../lang.js";
import { h, mount } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";

const page = mountShell("social", { theme: "red" });
const body = h("div");
page.append(pageHead(t("nav.social", "social"), t("ui.social.lede", "follow the work as it happens.")), body, homeLink());

mount(body, async () => {
  const links = await api("/api/social");
  return h("ul", { class: "links" }, links.map((l) => h("li", { class: "link" },
    h("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, h("span", { class: "t" }, l.name.toLowerCase()), h("span", { class: "handle" }, l.handle)))));
});

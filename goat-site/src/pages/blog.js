import { api } from "../api.js";
import { formatDate as fmt, t } from "../lang.js";
import { h, vlabel, mount } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";

const slug = new URLSearchParams(location.search).get("post");
const page = mountShell("blog", { theme: "light", title: slug ? t("ui.blogPost", "blog post") : t("nav.blog", "blog") });
const body = h("div");

if (slug) {
  page.append(body, homeLink());
  mount(body, async () => {
    const post = await api(`/api/blog/${encodeURIComponent(slug)}`);
    document.title = `${post.title} — goat creative agency`;
    return h("article", { class: "article" },
      h("a", { class: "back", href: "/blog.html" }, h("span", { class: "back-ring", "aria-hidden": "true" }), t("ui.allPosts", "all posts")),
      h("h2", { class: "h2" }, post.title),
      h("p", { class: "byline small" }, fmt(post.date), "·", post.author, post.tags.map((t) => h("span", { class: "chip" }, t))),
      h("div", { style: "margin-top:40px" }, post.body.map((para) => h("p", { class: "p" }, para))));
  });
} else {
  page.append(pageHead(t("nav.blog", "blog"), t("ui.blog.lede", "notes on motion, craft and how we work.")), body, homeLink());
  mount(body, async () => {
    const posts = await api("/api/blog");
    return h("ul", { class: "posts" }, posts.map((p) => h("li", { class: "post-row" },
      h("a", { href: `/blog.html?post=${encodeURIComponent(p.slug)}` },
        h("span", { class: "date" }, fmt(p.date), h("br"), p.author),
        h("span", null, h("h2", { class: "h2" }, p.title), h("p", { class: "p muted" }, p.excerpt))))));
  });
}

import { api } from "../api.js";
import { t } from "../lang.js";
import { h } from "./dom.js";
import { mountShell, pageHead, homeLink } from "./shell.js";

const page = mountShell("contact", { theme: "dark" });
const box = h("div");
page.append(pageHead(t("nav.contact", "contact"), t("ui.contact.lede", "tell us what you want to make. we answer every message.")), box, homeLink());

const field = (id, label, control) => h("div", { class: "field" }, h("label", { for: id }, label), control, h("p", { class: "err", id: `${id}-err`, role: "alert" }));
const name = h("input", { id: "name", name: "name", autocomplete: "name", required: true, maxlength: "80" });
const email = h("input", { id: "email", name: "email", type: "email", autocomplete: "email", required: true, maxlength: "120" });
const topic = h("select", { id: "topic", name: "topic" }, ["a new project", "a job at goat", "press", "just saying hi"].map((v, i) => h("option", { value: v }, t(`ui.c.t${i + 1}`, v))));
const message = h("textarea", { id: "message", name: "message", required: true, minlength: "10", maxlength: "4000" });
const trap = h("div", { class: "hp", "aria-hidden": "true" }, h("input", { name: "website", tabindex: "-1", autocomplete: "off" }));
const status = h("p", { class: "form-status", role: "status" });
const send = h("button", { type: "submit", class: "btn" }, t("ui.c.send", "send message"));
const form = h("form", { class: "form", novalidate: true }, field("name", t("ui.c.name", "your name"), name), field("email", t("ui.c.email", "your email"), email),
  field("topic", t("ui.c.topic", "what is it about"), topic), field("message", t("ui.c.message", "your message"), message), trap, h("div", null, send), status);
box.append(form);

const setErrors = (errors = {}) => {
  for (const id of ["name", "email", "message"]) {
    const el = form.querySelector(`#${id}`);
    form.querySelector(`#${id}-err`).textContent = errors[id] || "";
    el.toggleAttribute("aria-invalid", Boolean(errors[id]));
    if (errors[id]) el.setAttribute("aria-describedby", `${id}-err`); else el.removeAttribute("aria-describedby");
  }
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setErrors();
  status.textContent = "";
  send.disabled = true;
  try {
    await api("/api/contact", { method: "POST", body: JSON.stringify({ name: name.value, email: email.value, topic: topic.value, message: message.value, website: trap.querySelector("input").value }) });
    box.replaceChildren(h("div", { role: "status" }, h("p", { class: "notice" }, t("ui.c.sent", "message sent.")), h("p", { class: "notice-sub" }, t("ui.c.sentSub", "thank you, we will write back soon."))));
  } catch (err) {
    if (err.data?.errors) { setErrors(err.data.errors); form.querySelector("[aria-invalid]")?.focus(); }
    else status.textContent = err.status === 429 ? t("ui.c.slow", "slow down a little, then send again.") : err.status ? t("ui.c.fail", "something went wrong on our side. please try again.") : t("ui.c.down", "the backend is not answering. start it and try again.");
    send.disabled = false;
  }
});

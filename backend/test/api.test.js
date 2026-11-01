import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/server.js";

let server, base;
test.before(async () => { server = app.listen(0); await new Promise((r) => server.once("listening", r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());
const get = async (p) => { const r = await fetch(base + p); return [r.status, await r.json()]; };

test("clips carry the sheet metadata plus one url per frame", async () => {
  const [status, clips] = await get("/api/clips");
  assert.equal(status, 200);
  for (const name of ["plant", "leapA", "cheer", "leapB", "eye"]) {
    const c = clips[name];
    for (const k of ["t0", "t1", "fps", "n", "cols", "rows", "w", "h", "keys", "round"]) assert.ok(k in c, `${name}.${k}`);
    assert.equal(c.frames.length, c.n);
    assert.equal((await fetch(c.frames[0])).status, 200);
    assert.equal((await fetch(c.frames.at(-1))).status, 200);
  }
});
test("counters have the four reels", async () => {
  const [, c] = await get("/api/counters");
  assert.deepEqual(Object.keys(c).sort(), ["Prject", "client", "staff", "years"]);
});
test("counters cannot be edited without the admin key", async () => {
  const r = await fetch(`${base}/api/counters`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ years: 1 }) });
  assert.equal(r.status, 401);
});
test("content endpoints answer", async () => {
  for (const p of ["/api/work", "/api/blog", "/api/about", "/api/music", "/api/social"]) assert.equal((await get(p))[0], 200, p);
  assert.equal((await get("/api/blog/nope"))[0], 404);
  assert.ok((await get("/api/blog"))[1].every((p) => !("body" in p)));
});
test("work, blog and team lists need the admin key and are checked before they are saved", async () => {
  const put = (name, body, key) => fetch(`${base}/api/admin/collection/${name}`, { method: "PUT", headers: { "content-type": "application/json", ...(key ? { "x-admin-key": key } : {}) }, body: JSON.stringify(body) });
  assert.equal((await put("work", { items: [] })).status, 401);
  assert.equal((await put("nope", { items: [] }, "goat-admin")).status, 404);
  assert.equal((await put("team", { items: [{ id: "A B", name: "x", role: "y" }] }, "goat-admin")).status, 400);
  assert.equal((await put("team", { items: [{ id: "a", name: "x", role: "y" }, { id: "a", name: "z", role: "y" }] }, "goat-admin")).status, 400);
});
test("contact rejects a bad message without storing it", async () => {
  const r = await fetch(`${base}/api/contact`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "x", email: "no", message: "hi" }) });
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys((await r.json()).errors).sort(), ["email", "message", "name"]);
});

test("every language has the same words and the same pages", async () => {
  const ids = (c) => Object.keys(c.texts).sort();
  const [, en] = await get("/api/content");
  for (const lang of ["ar", "ckb"]) {
    const [status, c] = await get(`/api/content?lang=${lang}`);
    assert.equal(status, 200);
    assert.equal(c.dir, "rtl");
    assert.deepEqual(ids(c), ids(en), `${lang} words`);
    assert.notEqual(c.texts.hire, en.texts.hire);
    const [, work] = await get(`/api/work?lang=${lang}`);
    const [, workEn] = await get("/api/work");
    assert.deepEqual(work.map((w) => w.slug), workEn.map((w) => w.slug));
    assert.notEqual(work[0].summary, workEn[0].summary);
    assert.equal((await get(`/api/about?lang=${lang}`))[1].sections.length, 3);
    assert.equal((await get(`/api/blog?lang=${lang}`))[1].length, (await get("/api/blog"))[1].length);
    const [, team] = await get(`/api/team?lang=${lang}`);
    assert.deepEqual(team.map((m) => m.id), (await get("/api/team"))[1].map((m) => m.id));
  }
  assert.equal((await get("/api/content?lang=zz"))[1].lang, "en"); // an unknown language is English
  assert.equal((await get("/api/social?lang=ar"))[0], 200); // a page with no translation falls back to English
});

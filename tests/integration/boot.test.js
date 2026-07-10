/* Laadt de echte pagina (incl. js/-modules) en controleert dat alles heel is.
   Dit is het oude deploy-vangnet, nu als vaste test. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { bootApp } = require("../helpers/boot");

const ROOT = path.join(__dirname, "..", "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("structuur: precies 1 style-blok, inline scripts syntactisch geldig", () => {
  assert.equal((html.match(/<style>/g) || []).length, 1);
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
    assert.doesNotThrow(() => new vm.Script(m[1]), "syntaxfout in inline-script #" + (i + 1));
  });
});

test("modules: index.html laadt flux-core.js en flux-rules.js, en die bestaan", () => {
  assert.ok(html.includes('src="js/flux-core.js"'));
  assert.ok(html.includes('src="js/flux-rules.js"'));
  assert.ok(fs.existsSync(path.join(ROOT, "js", "flux-core.js")));
  assert.ok(fs.existsSync(path.join(ROOT, "js", "flux-rules.js")));
});

test('alle $("id")-verwijzingen bestaan in de markup', () => {
  const jsSources = [html,
    fs.readFileSync(path.join(ROOT, "js", "flux-core.js"), "utf8"),
    fs.readFileSync(path.join(ROOT, "js", "flux-rules.js"), "utf8")].join("\n");
  const refs = new Set([...jsSources.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]));
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const missing = [...refs].filter(r => !ids.has(r));
  assert.deepEqual(missing, [], "$() verwijst naar onbestaande id(s)");
});

test("pagina boot zonder één enkele fout (modules + app)", async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  assert.deepEqual(app.errors.map(e => e && (e.message || String(e))), []);
  /* de app heeft echt gedraaid: buildTag is gezet en de schermen staan klaar */
  assert.match(app.$("buildTag").textContent, /^v\d/);
  for (const id of ["scr-spelen", "scr-vandaag", "scr-vrienden", "scr-game", "scr-levels"])
    assert.ok(app.$(id), id);
  /* intro-startscherm toont bij koude start */
  assert.notEqual(app.$("intro").style.display, "none");
});

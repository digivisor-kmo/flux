/* FLUX deploy-vangnet (v2): snelle pre-push controle bovenop de volledige testsuite.
   Gebruik:  node deploy-check.js [pad-naar-html]          (default: index.html)
   Volledige suite:  cd tests && npm test
   Vereist de testdependencies: eenmalig `npm install` in tests/. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const file = process.argv[2] || path.join(__dirname, "index.html");
const fails = [];
const html = fs.readFileSync(file, "utf8");

/* 1. structurele + syntax-checks */
if ((html.match(/<style>/g) || []).length !== 1) fails.push("verwacht precies 1 <style>-blok");
[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
  try { new vm.Script(m[1]); } catch (e) { fails.push("syntaxfout in inline-script #" + (i + 1) + ": " + e.message); }
});
for (const mod of ["js/flux-core.js", "js/flux-rules.js"]){
  if (!html.includes('src="' + mod + '"')) fails.push("index.html laadt " + mod + " niet");
  try { new vm.Script(fs.readFileSync(path.join(__dirname, mod), "utf8")); }
  catch (e) { fails.push("syntaxfout in " + mod + ": " + e.message); }
}

/* 2. $("id")-verwijzingen moeten in de markup bestaan */
const refs = new Set([...html.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]));
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const missing = [...refs].filter(r => !ids.has(r));
if (missing.length) fails.push('$() verwijst naar onbestaande id(\'s): ' + missing.join(", "));

/* 3. FluxCore-rooktest via de echte module */
try {
  const FluxCore = require("./js/flux-core.js");
  for (const [N, S] of [[3, 2], [4, 2], [3, 3], [4, 3], [5, 3]]) {
    const g = FluxCore.generate(N, S, 0, 5, FluxCore.seededRng(N * 10 + S), false);
    const sol = FluxCore.solve(g.state, 0, N, S);
    let st = g.state.slice();
    for (let i = 0; i < sol.solution.length; i++) for (let k = 0; k < sol.solution[i]; k++) FluxCore.applyTap(st, i, N, S);
    if (!st.every(x => x === 0)) fails.push("FluxCore lost " + N + "x" + N + " S" + S + " niet op");
  }
} catch (e) { fails.push("FluxCore-rooktest crashte: " + e.message); }

/* 4. pagina booten in jsdom via dezelfde helper als de testsuite */
(async () => {
  try {
    const { bootApp } = require("./tests/helpers/boot");
    const app = await bootApp({ html: path.resolve(file) });
    app.errors.forEach(e => fails.push("laadfout in de pagina: " + (e && (e.message || String(e)))));
    if (!/^v\d/.test(app.$("buildTag").textContent)) fails.push("buildTag niet gezet — app-script draaide niet volledig");
    app.close();
  } catch (e) {
    fails.push("boot-check kon niet draaien (staat jsdom in tests/? draai eerst: cd tests && npm install): " + e.message);
  }
  if (fails.length) {
    console.error("❌ DEPLOY-CHECK GEFAALD (" + file + "):");
    fails.forEach(f => console.error("   - " + f));
    process.exit(1);
  }
  console.log("✅ deploy-check OK — pagina laadt zonder fouten, id's en engine kloppen (" + file + ")");
  process.exit(0);
})();

/* FLUX deploy-vangnet: laadt de pagina in een DOM en faalt bij een crash of missende id.
   Vangt vooral load-time fouten (TDZ, undefined calls) die een syntax-check mist.
   Vereist jsdom (npm i jsdom). Gebruik: node deploy-check.js <pad-naar-html> */
const fs = require("fs");
const vm = require("vm");
const { JSDOM, VirtualConsole } = require("jsdom");

const file = process.argv[2];
if (!file) { console.error("geef een html-bestand op"); process.exit(2); }
const html = fs.readFileSync(file, "utf8");
const fails = [];

/* 1. structurele + syntax-checks */
if ((html.match(/<style>/g) || []).length !== 1) fails.push("verwacht precies 1 <style>-blok");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((code, i) => { try { new vm.Script(code); } catch (e) { fails.push("syntaxfout in inline-script #" + (i + 1) + ": " + e.message); } });

/* 2. $("id")-verwijzingen moeten in de markup bestaan */
const refs = new Set([...html.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]));
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const missing = [...refs].filter(r => !ids.has(r));
if (missing.length) fails.push('$() verwijst naar onbestaande id(\'s): ' + missing.join(", "));

/* 3. FluxCore-rooktest: generatie + oplossing per tier */
try {
  const m = html.match(/const FluxCore = \(function[\s\S]*?\n\}\)\(\);/);
  if (!m) fails.push("FluxCore-module niet gevonden");
  else {
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(m[0].replace("const FluxCore =", "globalThis.FluxCore ="), ctx);
    for (const [N, S] of [[3, 2], [4, 2], [3, 3], [4, 3], [5, 3]]) {
      const g = ctx.FluxCore.generate(N, S, 0, 5, ctx.FluxCore.seededRng(N * 10 + S), false);
      const sol = ctx.FluxCore.solve(g.state, 0, N, S);
      let st = g.state.slice();
      for (let i = 0; i < sol.solution.length; i++) for (let k = 0; k < sol.solution[i]; k++) ctx.FluxCore.applyTap(st, i, N, S);
      if (!st.every(x => x === 0)) fails.push("FluxCore lost " + N + "x" + N + " S" + S + " niet op");
    }
  }
} catch (e) { fails.push("FluxCore-rooktest crashte: " + e.message); }

/* 4. laad de pagina in een DOM met stubs; elke load-fout = falen */
const vc = new VirtualConsole();
let loadErr = null;
vc.on("jsdomError", e => { loadErr = loadErr || e; });

function ctxStub() {
  const grad = () => ({ addColorStop() {} });
  return new Proxy({}, {
    get(t, k) {
      if (k === "measureText") return () => ({ width: 0 });
      if (k === "createLinearGradient" || k === "createRadialGradient") return grad;
      if (k === "getImageData") return () => ({ data: [] });
      if (k === "canvas") return { width: 0, height: 0 };
      return () => {};
    },
    set() { return true; },
  });
}
function query() {
  const p = new Proxy({ data: [], error: null }, {
    get(t, k) {
      if (k === "then") return (res) => Promise.resolve({ data: [], error: null }).then(res);
      if (k === "maybeSingle" || k === "single") return () => Promise.resolve({ data: null, error: null });
      if (k === "insert" || k === "upsert") return () => Promise.resolve({ error: null });
      return () => p;
    },
  });
  return p;
}
const sb = {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOAuth() {}, signOut: async () => ({}),
  },
  from: () => query(),
  rpc: async () => ({ data: [], error: null }),
  functions: { invoke: async () => ({ data: { ok: false }, error: null }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel() {},
};

try {
  new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: "https://flux.local/",
    beforeParse(window) {
      window.onerror = (msg, src, line, col, err) => { loadErr = loadErr || err || new Error(msg); };
      window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null });
      const AC = function () { return new Proxy({}, { get: () => () => ({ connect() {}, start() {}, stop() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "", delayTime: { value: 0 }, Q: { value: 0 } }), set: () => true }); };
      window.AudioContext = AC; window.webkitAudioContext = AC;
      window.supabase = { createClient: () => sb };
      window.HTMLCanvasElement.prototype.getContext = () => ctxStub();
      window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(null);
      try { Object.defineProperty(window.navigator, "vibrate", { value: () => true, configurable: true }); } catch (e) {}
      try { Object.defineProperty(window.navigator, "serviceWorker", { value: { register: async () => ({}), ready: Promise.resolve({}) }, configurable: true }); } catch (e) {}
      window.Notification = function () {}; window.Notification.permission = "default"; window.Notification.requestPermission = async () => "default";
      window.scrollTo = () => {};
    },
  });
} catch (e) { loadErr = loadErr || e; }

setTimeout(() => {
  if (loadErr) fails.push("laadfout in de pagina: " + (loadErr.message || String(loadErr)));
  if (fails.length) {
    console.error("❌ DEPLOY-CHECK GEFAALD (" + file + "):");
    fails.forEach(f => console.error("   - " + f));
    process.exit(1);
  }
  console.log("✅ deploy-check OK — pagina laadt zonder fouten, id's en engine kloppen (" + file + ")");
  process.exit(0);
}, 300);

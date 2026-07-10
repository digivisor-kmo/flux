/* Boot-helper: laadt index.html in jsdom met dezelfde stubs als het oude deploy-vangnet,
   plus een ResourceLoader die de js/-modules van schijf serveert. Alle integratietests
   en deploy-check.js gebruiken deze ene helper, zodat de teststubs één bron hebben. */
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole, ResourceLoader } = require("jsdom");

const ROOT = path.join(__dirname, "..", "..");
const ORIGIN = "https://flux.local";

class LocalLoader extends ResourceLoader {
  fetch(url){
    if (url.startsWith(ORIGIN + "/")){
      const p = path.join(ROOT, url.slice(ORIGIN.length + 1).split("?")[0]);
      try { return Promise.resolve(fs.readFileSync(p)); }
      catch(e){ return Promise.reject(new Error("lokaal bestand ontbreekt: " + url)); }
    }
    /* externe resources (supabase-cdn, fonts): leeg, we stubben window.supabase zelf */
    return Promise.resolve(Buffer.from(""));
  }
}

function ctxStub(){
  const grad = () => ({ addColorStop(){} });
  return new Proxy({}, {
    get(t, k){
      if (k === "measureText") return () => ({ width: 0 });
      if (k === "createLinearGradient" || k === "createRadialGradient") return grad;
      if (k === "getImageData") return () => ({ data: [] });
      if (k === "canvas") return { width: 0, height: 0 };
      return () => {};
    },
    set(){ return true; },
  });
}

function makeQuery(){
  const p = new Proxy({ data: [], error: null }, {
    get(t, k){
      if (k === "then") return (res) => Promise.resolve({ data: [], error: null }).then(res);
      if (k === "maybeSingle" || k === "single") return () => Promise.resolve({ data: null, error: null });
      if (k === "insert" || k === "upsert") return () => Promise.resolve({ error: null });
      return () => p;
    },
  });
  return p;
}

function makeSb(overrides = {}){
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
      signInWithOAuth(){}, signOut: async () => ({}),
    },
    from: () => makeQuery(),
    rpc: async () => ({ data: [], error: null }),
    functions: { invoke: async () => ({ data: { ok: false }, error: null }) },
    channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
    removeChannel(){},
    ...overrides,
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Boot de app. options:
 *   html         — pad naar het html-bestand (default index.html in de repo-root)
 *   localStorage — object met vooraf gezette keys (bv. { "flux-onboarded": "true" })
 *   sb           — overrides voor de supabase-stub
 * Geeft { window, document, $, click, sleep, errors } terug.
 */
async function bootApp(options = {}){
  const file = options.html || path.join(ROOT, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e));

  const sb = makeSb(options.sb);
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    resources: new LocalLoader(),
    virtualConsole: vc,
    url: ORIGIN + "/",
    beforeParse(window){
      window.onerror = (msg, src, line, col, err) => { errors.push(err || new Error(msg)); };
      for (const [k, v] of Object.entries(options.localStorage || {}))
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      window.matchMedia = (q) => ({ matches: false, media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, onchange: null });
      const AC = function(){ return new Proxy({}, { get: () => () => ({ connect(){}, start(){}, stop(){}, gain: { value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, frequency: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){} }, type: "", delayTime: { value: 0 }, Q: { value: 0 } }), set: () => true }); };
      window.AudioContext = AC; window.webkitAudioContext = AC;
      window.supabase = { createClient: () => sb };
      window.HTMLCanvasElement.prototype.getContext = () => ctxStub();
      window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(null);
      try { Object.defineProperty(window.navigator, "vibrate", { value: () => true, configurable: true }); } catch(e){}
      try { Object.defineProperty(window.navigator, "serviceWorker", { value: { register: async () => ({}), ready: Promise.resolve({}) }, configurable: true }); } catch(e){}
      window.Notification = function(){}; window.Notification.permission = "default"; window.Notification.requestPermission = async () => "default";
      window.scrollTo = () => {};
    },
  });

  /* wacht tot de externe modules geladen en de inline app gedraaid is */
  await new Promise((resolve) => {
    dom.window.addEventListener("load", () => resolve());
    setTimeout(resolve, 3000);   /* vangnet: nooit eeuwig wachten */
  });
  await sleep(50);

  const window = dom.window, document = window.document;
  const $ = id => document.getElementById(id);
  const click = el => {
    const t = typeof el === "string" ? $(el) : el;
    if (!t) throw new Error("click op onbestaand element: " + el);
    t.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  };
  /* close(): ruimt alle lopende timers/animaties op zodat node --test kan afsluiten */
  const close = () => { try { window.close(); } catch(e){} };
  return { dom, window, document, $, click, sleep, errors, sb, close };
}

module.exports = { bootApp, sleep, makeSb };

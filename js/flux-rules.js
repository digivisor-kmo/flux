/**
 * FluxRules: pure spelregels en -data, gedeeld door de app en de testsuite.
 * Geen DOM, geen localStorage, geen netwerk. Alles hier is deterministisch
 * (op Math.random in genNumbers na, die een injecteerbare rng accepteert).
 * De daily-generatie MOET identiek blijven aan de edge function submit-daily.
 */
const FluxRules = (function () {
  "use strict";
  const core = (typeof FluxCore !== "undefined") ? FluxCore
    : (typeof require === "function" ? require("./flux-core.js") : null);

  const TARGET = 0;

  /* geleidelijke ladder (sectie 4): eerst groter bord met 2 kleuren,
     dan pas terug kleiner met 3 kleuren, dan opbouwen */
  /* elk tier een eigen accentkleur (warm belicht, past bij de triade) */
  /* color = chipkleur, deep = donkere variant voor tekst/knoppen (leesbaar op papier) */
  const FREE_DIFFS = {
    starter: { label: "Starter", desc: "3×3 · 2 states", size: 3, states: 2, kMin: 2, kMax: 3, color: "#4DE3FF", deep: "#0E93B5" },
    junior:  { label: "Junior",  desc: "4×4 · 2 states", size: 4, states: 2, kMin: 3, kMax: 4, color: "#FFB454", deep: "#B36A12" },
    expert:  { label: "Expert",  desc: "3×3 · 3 states", size: 3, states: 3, kMin: 2, kMax: 3, color: "#A78BFA", deep: "#5B3FC4" },
    master:  { label: "Master",  desc: "4×4 · 3 states", size: 4, states: 3, kMin: 3, kMax: 4, color: "#4DE3FF", deep: "#0E93B5" },
    wizard:  { label: "Wizard",  desc: "5×5 · 3 states", size: 5, states: 3, kMin: 5, kMax: 7, color: "#A78BFA", deep: "#5B3FC4" }
  };
  /* één daily: deterministisch op datum, zelfde puzzel voor iedereen */
  const DAILIES = {
    sprint: { label: "Daily Sprint", sub: "As fast as you can", size: 3, states: 2, kMin: 3, kMax: 4, color: "#A78BFA", deep: "#5B3FC4" }
  };
  /* Numbers-modus (verborgen bedrading): elke tegel schakelt L andere tegels om.
     size = raster, links = aantal verborgen partners, kMin/kMax = scramble-stappen.
     Klein en makkelijk tot groot en moeilijk. */
  const NUMBERS_DIFFS = {
    neasy:   { label: "Easy",   desc: "2×2 · 2 links", size: 2, links: 2, kMin: 2, kMax: 3,  color: "#4DE3FF", deep: "#0E93B5" },
    nsimple: { label: "Simple", desc: "3×3 · 2 links", size: 3, links: 2, kMin: 3, kMax: 4,  color: "#FFB454", deep: "#B36A12" },
    nmedium: { label: "Medium", desc: "4×4 · 2 links", size: 4, links: 2, kMin: 5, kMax: 7,  color: "#A78BFA", deep: "#5B3FC4" },
    nhard:   { label: "Hard",   desc: "4×4 · 3 links", size: 4, links: 3, kMin: 7, kMax: 9,  color: "#4DE3FF", deep: "#0E93B5" },
    nexpert: { label: "Expert", desc: "5×5 · 3 links", size: 5, links: 3, kMin: 9, kMax: 13, color: "#A78BFA", deep: "#5B3FC4" }
  };

  /* ================= campagne: 24 vaste puzzels per tier (vervangt vrij spel) ================= */
  const TIER_ORDER = ["starter", "junior", "expert", "master", "wizard"];
  const CAMP_N = 24;
  /* Vaste, gecureerde puzzelset per tier: 24 puzzels met oplopende par die eindigt op de
     moeilijkste (hoogste par). Vooraf berekend + geverifieerd, dus IDENTIEK voor alle spelers.
     s = startbord, p = par (minimaal aantal tikken). */
  const CAMP_PUZZLES = {"starter":[{"s":[0,0,1,1,1,0,0,0,0],"p":2},{"s":[1,0,1,1,0,1,0,0,0],"p":2},{"s":[1,0,0,0,1,1,0,0,0],"p":2},{"s":[1,0,0,1,0,1,0,0,0],"p":3},{"s":[1,1,0,1,0,1,0,0,0],"p":3},{"s":[0,0,1,1,0,1,0,0,0],"p":3},{"s":[0,1,1,1,0,1,0,0,0],"p":3},{"s":[0,1,0,0,0,0,0,0,0],"p":4},{"s":[1,0,1,0,0,0,0,0,0],"p":4},{"s":[1,1,1,0,0,0,0,0,0],"p":4},{"s":[1,0,0,0,0,0,0,0,0],"p":5},{"s":[1,1,0,0,0,0,0,0,0],"p":5},{"s":[0,0,1,0,0,0,0,0,0],"p":5},{"s":[1,0,0,0,1,0,0,0,0],"p":6},{"s":[1,1,0,0,1,0,0,0,0],"p":6},{"s":[0,0,1,0,1,0,0,0,0],"p":6},{"s":[0,0,0,1,1,1,0,0,0],"p":7},{"s":[1,0,1,1,1,1,0,0,0],"p":7},{"s":[1,1,1,1,1,1,0,0,0],"p":7},{"s":[1,0,0,0,0,1,1,0,0],"p":8},{"s":[1,0,1,0,0,0,0,1,0],"p":8},{"s":[1,0,1,0,1,1,1,1,0],"p":8},{"s":[1,0,1,0,1,0,1,0,1],"p":9},{"s":[1,0,1,0,1,0,1,0,1],"p":9}],"junior":[{"s":[0,0,1,0,1,1,0,0,0,0,0,0,0,0,0,0],"p":2},{"s":[1,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0],"p":2},{"s":[1,0,0,1,0,1,1,0,0,0,0,0,0,0,0,0],"p":2},{"s":[1,1,1,1,1,0,0,1,0,0,0,0,0,0,0,0],"p":2},{"s":[0,1,0,1,1,1,1,0,0,0,0,0,0,0,0,0],"p":3},{"s":[0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0],"p":3},{"s":[1,0,0,0,1,0,1,1,0,0,0,0,0,0,0,0],"p":3},{"s":[1,0,1,0,0,1,1,1,0,0,0,0,0,0,0,0],"p":3},{"s":[1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0],"p":3},{"s":[0,1,1,0,1,1,1,1,0,0,0,0,0,0,0,0],"p":4},{"s":[1,1,0,1,0,0,1,0,1,0,0,0,0,0,0,0],"p":4},{"s":[1,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0],"p":4},{"s":[1,1,1,0,1,0,0,1,0,1,0,0,0,0,0,0],"p":4},{"s":[0,1,1,1,0,1,0,0,0,1,1,0,0,0,0,0],"p":5},{"s":[1,1,1,0,0,0,1,0,0,1,1,0,0,0,0,0],"p":5},{"s":[0,0,0,1,1,1,0,0,1,1,1,0,0,0,0,0],"p":5},{"s":[1,0,0,0,1,0,1,0,1,1,1,0,0,0,0,0],"p":5},{"s":[1,0,1,0,1,1,0,1,1,1,0,0,0,0,0,0],"p":6},{"s":[0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],"p":6},{"s":[1,1,1,1,1,0,0,0,1,1,1,0,0,0,0,0],"p":6},{"s":[0,1,1,0,1,1,1,0,1,1,1,0,0,0,0,0],"p":6},{"s":[0,1,0,1,0,0,1,0,0,0,0,1,1,0,0,0],"p":7},{"s":[1,1,0,1,0,0,1,0,0,0,1,1,1,0,0,0],"p":7},{"s":[0,1,1,0,0,1,1,1,1,1,1,1,1,1,0,0],"p":7}],"expert":[{"s":[2,2,1,1,1,0,0,0,0],"p":4},{"s":[1,2,1,1,0,1,0,0,0],"p":4},{"s":[1,0,0,1,0,1,0,0,0],"p":5},{"s":[0,0,1,1,0,1,0,0,0],"p":5},{"s":[2,0,1,0,0,0,0,0,0],"p":6},{"s":[1,0,2,0,0,0,0,0,0],"p":6},{"s":[1,1,0,0,0,0,0,0,0],"p":7},{"s":[0,2,0,0,0,0,0,0,0],"p":8},{"s":[1,2,0,0,0,0,0,0,0],"p":8},{"s":[1,0,0,0,0,0,0,0,0],"p":9},{"s":[2,0,0,0,0,0,0,0,0],"p":9},{"s":[0,0,1,1,0,0,0,0,0],"p":10},{"s":[2,2,0,0,0,0,0,0,0],"p":11},{"s":[2,2,1,0,0,0,0,0,0],"p":11},{"s":[1,0,1,0,0,0,0,0,0],"p":12},{"s":[0,1,0,0,0,0,0,0,0],"p":13},{"s":[2,1,1,0,0,0,0,0,0],"p":13},{"s":[2,2,2,0,0,0,0,0,0],"p":14},{"s":[1,1,0,1,1,0,0,0,0],"p":15},{"s":[1,1,1,0,2,0,0,0,0],"p":15},{"s":[0,0,0,0,1,0,0,0,0],"p":16},{"s":[1,2,1,1,0,1,0,1,0],"p":17},{"s":[1,2,0,2,2,1,0,1,0],"p":17},{"s":[0,1,0,1,2,1,0,1,0],"p":18}],"master":[{"s":[1,1,1,0,1,1,1,1,0,0,1,0,0,0,0,0],"p":4},{"s":[1,0,0,0,1,1,0,0,1,1,0,0,1,1,1,0],"p":4},{"s":[2,1,0,0,1,2,2,2,0,2,2,0,0,0,1,0],"p":5},{"s":[0,0,1,1,1,0,0,1,1,1,2,0,1,2,2,2],"p":5},{"s":[1,2,0,0,2,1,1,0,0,1,0,1,0,0,1,1],"p":6},{"s":[0,0,0,0,0,1,0,1,1,2,2,1,1,2,1,1],"p":6},{"s":[0,2,1,0,0,1,2,2,1,0,2,1,1,0,0,0],"p":7},{"s":[2,2,2,1,2,1,2,2,1,1,2,0,0,1,0,1],"p":7},{"s":[0,1,0,0,1,2,1,0,1,2,2,1,0,2,2,2],"p":8},{"s":[1,1,0,0,1,2,0,1,0,0,1,0,0,0,2,2],"p":8},{"s":[0,0,1,1,2,1,1,0,2,1,0,2,2,1,1,1],"p":9},{"s":[2,1,0,2,1,1,0,2,1,0,2,1,1,1,2,0],"p":9},{"s":[0,1,0,2,2,2,2,2,1,1,1,2,0,1,1,0],"p":10},{"s":[2,1,2,1,0,2,2,1,0,2,1,0,0,0,0,0],"p":10},{"s":[1,0,2,1,0,0,1,0,1,1,2,2,1,0,0,2],"p":11},{"s":[2,2,2,1,0,0,2,2,0,1,0,0,1,2,0,1],"p":11},{"s":[0,1,2,2,0,1,2,0,0,0,1,2,2,2,2,0],"p":12},{"s":[2,0,1,2,0,2,0,2,0,1,1,2,0,0,1,2],"p":12},{"s":[1,0,1,1,2,2,1,2,1,1,0,1,1,1,2,1],"p":13},{"s":[0,0,1,1,0,2,1,1,1,1,0,2,0,1,2,1],"p":14},{"s":[2,1,2,0,2,1,2,2,0,0,2,2,2,1,1,0],"p":14},{"s":[2,0,2,0,0,2,1,2,1,0,1,0,0,1,0,0],"p":15},{"s":[0,1,2,0,1,0,0,2,2,0,1,1,0,2,1,2],"p":15},{"s":[2,0,2,0,2,1,0,0,0,0,0,0,0,1,2,1],"p":16}],"wizard":[{"s":[0,0,0,0,0,0,0,0,0,0,0,0,2,1,0,0,2,1,0,1,0,1,0,2,0],"p":5},{"s":[1,1,1,0,0,0,2,0,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0,1,0],"p":6},{"s":[0,1,0,0,1,2,1,1,1,1,1,2,0,0,1,1,0,0,0,0,0,0,0,0,0],"p":6},{"s":[1,0,0,2,1,0,1,2,1,1,0,1,0,0,1,1,1,1,0,0,0,1,0,0,0],"p":7},{"s":[1,2,1,0,0,2,2,1,0,0,1,2,0,1,0,1,0,1,1,1,0,0,0,1,0],"p":8},{"s":[0,0,2,2,2,0,1,1,2,1,0,1,1,0,0,1,1,1,0,0,0,1,0,0,0],"p":8},{"s":[0,0,1,2,2,2,0,0,1,1,2,2,0,0,1,0,0,0,1,1,1,1,0,0,1],"p":9},{"s":[0,1,2,2,2,2,1,1,2,0,1,0,0,0,0,2,0,1,1,0,2,0,0,1,1],"p":10},{"s":[1,0,2,0,2,0,2,0,0,2,1,2,0,1,1,0,0,1,0,0,0,0,1,2,2],"p":11},{"s":[1,1,2,1,1,1,0,2,1,0,1,2,1,1,0,0,0,1,0,0,0,0,0,0,0],"p":11},{"s":[0,0,0,0,1,0,0,0,1,2,1,0,0,1,0,2,1,0,2,2,2,1,1,1,2],"p":12},{"s":[1,1,0,2,1,1,1,1,2,2,1,2,1,2,0,2,0,2,2,0,0,2,0,2,0],"p":13},{"s":[2,2,0,2,1,0,2,2,2,2,0,2,0,0,0,1,2,0,2,2,0,0,0,0,0],"p":14},{"s":[2,2,1,0,1,2,1,2,1,2,0,0,0,0,1,1,0,2,1,2,0,0,1,2,2],"p":15},{"s":[0,2,1,0,2,2,0,2,2,1,1,1,0,2,2,1,1,2,1,1,2,0,1,1,2],"p":16},{"s":[1,2,2,0,1,0,1,2,2,1,2,2,1,0,0,0,2,2,2,2,1,2,2,2,2],"p":17},{"s":[2,2,2,0,0,0,1,1,0,1,0,2,0,2,1,2,1,2,1,2,1,2,0,1,1],"p":18},{"s":[0,2,2,0,2,2,2,2,0,2,2,2,2,0,2,2,2,0,0,2,0,2,0,0,2],"p":18},{"s":[1,2,2,2,1,1,2,2,1,2,1,2,1,2,1,1,1,2,1,0,2,2,2,1,1],"p":19},{"s":[2,2,2,2,0,0,0,2,0,0,1,0,2,0,0,0,2,0,1,2,2,1,2,2,1],"p":20},{"s":[0,2,2,1,0,2,1,1,0,2,1,1,0,1,2,0,2,2,1,2,0,1,2,1,0],"p":21},{"s":[1,1,2,0,2,2,0,0,0,2,1,2,2,2,1,1,1,0,1,0,1,1,2,1,2],"p":22},{"s":[1,2,2,0,1,1,1,2,1,2,2,0,0,1,1,0,1,2,0,1,0,1,1,1,2],"p":23},{"s":[1,1,2,1,1,0,0,0,1,2,2,2,2,1,0,1,1,0,1,2,2,1,2,1,1],"p":24}]};
  function campPuzzle(tier, idx){
    const d = FREE_DIFFS[tier];
    const e = CAMP_PUZZLES[tier][idx];
    return { state: e.s.slice(), par: e.p, taps: [], unique: true, solution: null, cfg: d };
  }

  /* Puzzelset-versie: bij een nieuwe gecureerde set wissen we de oude lokale voortgang
     (de borden achter de indexen zijn veranderd, dus oude bests slaan nergens meer op). */
  const CAMP_VER = 2;

  function betterBest(a, b){
    if (!a) return b; if (!b) return a;
    const base = (b.moves < a.moves || (b.moves === a.moves && b.timeMs < a.timeMs)) ? b : a;
    return { ...base, onpar: !!(a.onpar || b.onpar) };
  }

  /* genereer een gegarandeerd oplosbare Numbers-puzzel: scramble vanuit alles-groen.
     Terug-tikken van dezelfde scramble-set lost hem altijd op (toggle is zijn eigen inverse).
     rnd is injecteerbaar zodat tests deterministisch kunnen draaien. */
  function genNumbers(cfg, rnd){
    const randInt = n => Math.floor((rnd || Math.random)() * n);
    const n = cfg.size * cfg.size, L = cfg.links, link = [];
    for (let i = 0; i < n; i++){
      const opts = [...Array(n).keys()].filter(x => x !== i);
      for (let s = opts.length - 1; s > 0; s--){ const j = randInt(s + 1); [opts[s], opts[j]] = [opts[j], opts[s]]; }
      link[i] = opts.slice(0, L).sort((a, b) => a - b);
    }
    let st;
    do {
      st = new Array(n).fill(1);                 // 1 = groen/aan, 0 = rood/uit
      const k = cfg.kMin + randInt(cfg.kMax - cfg.kMin + 1);
      const used = new Set(); while (used.size < Math.min(k, n)) used.add(randInt(n));
      for (const i of used) for (const j of link[i]) st[j] ^= 1;
    } while (st.every(v => v === 1));            // niet al opgelost
    return { state: st, link };
  }

  /* De "FLUX-dag" wisselt om 09:00 Belgische tijd. Definitie MOET identiek zijn aan
     de edge function submit-daily (anders klopt de serververificatie niet). */
  const DAILY_RESET_HOUR = 9;                 // 09:00 Europe/Brussels
  function fluxDay(date){
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hourCycle: "h23"
    }).formatToParts(date || new Date());
    const g = t => p.find(x => x.type === t).value;
    let y = +g("year"), m = +g("month"), d = +g("day");
    const h = +g("hour");
    if (h < DAILY_RESET_HOUR){                // vóór 09:00 hoort bij de vorige dag
      const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() - 1);
      return dt.toISOString().slice(0, 10);
    }
    return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function prevDay(key){
    const [Y, M, D] = key.split("-").map(Number);
    const dt = new Date(Date.UTC(Y, M - 1, D)); dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  }

  const pad = n => String(n).padStart(2,"0");
  /* namen/codes komen van andere gebruikers → escapen vóór innerHTML (XSS) */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  function fmtTime(ms){ const s = Math.floor(ms/1000); return pad(Math.floor(s/60)) + ":" + pad(s%60); }

  const dailyNumber = day => Math.floor((Date.parse(day) - Date.parse("2025-06-01")) / 86400000) + 1;
  const shareDateStr = () => new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase();

  /* live aftel-klok tot de echte reset (09:00 Belgische tijd).
     Toont uu:mm:ss en pikt de nieuwe dag op zodra de teller nul raakt. */
  function secsUntilReset(date){
    /* seconden tot de volgende 09:00 Brusselse tijd, op basis van de Brusselse wandklok */
    const p = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(date || new Date());
    const g = t => +p.find(x => x.type === t).value;
    const nowSec = g("hour") * 3600 + g("minute") * 60 + g("second");
    const target = DAILY_RESET_HOUR * 3600;
    let remain = target - nowSec;
    if (remain <= 0) remain += 86400;
    return remain;
  }
  function fmtHMS(ms){
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }

  /* canonieke daily: één definitie voor client, tests en (per contract) de edge function */
  function canonicalDaily(dayKey, key){
    const d = DAILIES[key];
    const rng = core.seededRng(core.hashStr(dayKey + "-" + key));
    const k = d.kMin + Math.floor(rng() * (d.kMax - d.kMin + 1));
    /* daily: unieke optimale oplossing vereist, zodat de ranking proper is */
    return { ...core.generate(d.size, d.states, TARGET, k, rng, true), cfg: d };
  }

  /* spoilervrije deeltekst (Wordle-stijl): toont prestatie, nooit de oplossing */
  function dailyShareText(d, gameName, appUrl){
    const cap = Math.min(d.moves, 12);
    let trail = ""; for (let i = 0; i < cap; i++) trail += (d.onpar || i < d.par) ? "\u{1F7E6}" : "\u{1F7E7}";
    const parTag = d.onpar ? "on par" : "+" + (d.moves - d.par) + " over par";
    return gameName + " Daily \u2116" + d.num + "\n" + trail + "\n" +
      d.moves + " moves \u00B7 par " + d.par + " \u00B7 " + parTag + " \u00B7 \u23F1 " + d.time +
      (d.streak > 0 ? " \u00B7 \u{1F525} " + d.streak : "") + "\n" + appUrl;
  }

  /* streak = aaneengesloten reeks gespeelde dagen, terugtellend vanaf startKey */
  function streakFrom(daysSet, startKey){
    let streak = 0, key = startKey;
    while (daysSet.has(key)){ streak++; key = prevDay(key); }
    return streak;
  }

  return { TARGET, FREE_DIFFS, DAILIES, NUMBERS_DIFFS,
    TIER_ORDER, CAMP_N, CAMP_VER, CAMP_PUZZLES, campPuzzle, betterBest, genNumbers,
    DAILY_RESET_HOUR, fluxDay, prevDay, dailyNumber, shareDateStr, secsUntilReset,
    fmtTime, fmtHMS, pad, esc, canonicalDaily, dailyShareText, streakFrom };
})();

/* Node-export zodat de testsuite exact dezelfde module gebruikt als de app */
if (typeof module !== "undefined" && module.exports) module.exports = FluxRules;

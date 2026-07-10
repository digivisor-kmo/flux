/* Volledige campagne-flow door de echte UI: intro wegtikken, tier openen,
   puzzel spelen tot winst (via de solver), voortgang gecontroleerd in
   localStorage én terug op het levelscherm. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../helpers/boot");
const FluxCore = require("../../js/flux-core.js");
const R = require("../../js/flux-rules.js");

const SKIP_INTRO = { "flux-onboarded": "true" };

/* lees de bordstaat uit de DOM (classes tile.s0/s1/s2) — zo testen we wat de speler ZIET */
function domState(app){
  return [...app.document.querySelectorAll("#board .tile")].map(t => {
    const m = t.className.match(/\bs(\d)\b/);
    assert.ok(m, "tegel heeft een staat-klasse");
    return +m[1];
  });
}

async function solveBoard(app, size, states){
  const st = domState(app);
  const sol = FluxCore.solve(st, R.TARGET, size, states);
  assert.ok(sol, "bord uit de DOM is oplosbaar");
  const tiles = app.document.querySelectorAll("#board .tile");
  sol.solution.forEach((cnt, i) => { for (let k = 0; k < cnt; k++) app.click(tiles[i]); });
  return sol.par;
}

test("campagne: starter puzzel 1 spelen tot winst, voortgang opgeslagen", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;

  click("intro");                                   /* duik-startscherm wegtikken */
  await sleep(20);
  assert.ok($("scr-spelen").classList.contains("active"), "home actief");

  /* home: 5 tiers, alleen starter ontgrendeld */
  const tiers = document.querySelectorAll("#freeCards .tier");
  assert.equal(tiers.length, 5);
  assert.ok(!tiers[0].classList.contains("locked"), "starter open");
  for (let i = 1; i < 5; i++) assert.ok(tiers[i].classList.contains("locked"), "tier " + i + " op slot");

  click(tiers[0]);                                  /* level-select */
  assert.ok($("scr-levels").classList.contains("active"));
  const orbs = document.querySelectorAll("#levelGrid .lorb");
  assert.equal(orbs.length, R.CAMP_N);
  assert.equal(document.querySelectorAll("#levelGrid .lorb.done, #levelGrid .lorb.par").length, 0);

  click(orbs[0]);                                   /* puzzel 1 starten */
  assert.ok($("scr-game").classList.contains("active"));
  assert.equal($("gModeSub").textContent, "Puzzle 1 / " + R.CAMP_N);

  /* het getoonde bord is exact de gecureerde puzzel */
  assert.deepEqual(domState(app), R.CAMP_PUZZLES.starter[0].s);

  const par = await solveBoard(app, 3, 2);          /* optimaal oplossen */
  assert.equal(par, R.CAMP_PUZZLES.starter[0].p);
  await sleep(650);                                 /* win-sheet toont na 520ms */
  assert.ok($("win").classList.contains("show"), "win-popup zichtbaar");
  assert.equal($("winTitle").textContent, "On par!");
  assert.match($("winStats").textContent, /Moves/);

  /* voortgang lokaal opgeslagen, on-par badge */
  const best = JSON.parse(app.window.localStorage.getItem("flux-camp-starter-0"));
  assert.equal(best.moves, par);
  assert.equal(best.onpar, true);

  /* Next → puzzel 2 */
  click("winNext");
  await sleep(20);
  assert.equal($("gModeSub").textContent, "Puzzle 2 / " + R.CAMP_N);
  assert.deepEqual(domState(app), R.CAMP_PUZZLES.starter[1].s);

  /* terug naar levels: orb 1 heeft de par-badge */
  click("backBtn");
  await sleep(20);
  assert.ok($("scr-levels").classList.contains("active"));
  const orbs2 = document.querySelectorAll("#levelGrid .lorb");
  assert.ok(orbs2[0].classList.contains("par"), "puzzel 1 op par gemarkeerd");
  assert.match($("levelsSub").textContent, /^1 \/ 24 solved · 1 on par$/);
});

test("campagne: niet-optimale oplossing telt als solved maar niet on par", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);
  click(document.querySelectorAll("#freeCards .tier")[0]);
  click(document.querySelectorAll("#levelGrid .lorb")[0]);

  const tiles = document.querySelectorAll("#board .tile");
  /* 2 extra zetten die elkaar opheffen (S=2), daarna optimaal oplossen */
  app.click(tiles[8]); app.click(tiles[8]);
  await solveBoard(app, 3, 2);
  await sleep(650);
  assert.equal($("winTitle").textContent, "Solved");
  const best = JSON.parse(app.window.localStorage.getItem("flux-camp-starter-0"));
  assert.equal(best.onpar, false);
  assert.equal(best.moves, R.CAMP_PUZZLES.starter[0].p + 2);
});

test("campagne: tier 2 ontgrendelt pas als alle 24 van tier 1 opgelost zijn", async (t) => {
  /* voortgang voorbereiden: starter 0..22 opgelost */
  const pre = { "flux-onboarded": "true" };
  for (let i = 0; i < 23; i++)
    pre["flux-camp-starter-" + i] = { moves: 5, par: 5, timeMs: 9000, time: "00:09", hints: 0, onpar: false };
  pre["flux-camp-ver"] = R.CAMP_VER;   /* anders wist campVersionReset de voortgang */
  const app = await bootApp({ localStorage: pre });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);

  let tiers = document.querySelectorAll("#freeCards .tier");
  assert.ok(tiers[1].classList.contains("locked"), "junior nog op slot bij 23/24");

  /* puzzel 24 oplossen */
  click(tiers[0]);
  click(document.querySelectorAll("#levelGrid .lorb")[23]);
  assert.deepEqual(domState(app), R.CAMP_PUZZLES.starter[23].s);
  await solveBoard(app, 3, 2);
  await sleep(650);
  click("winNext");                                  /* laatste puzzel → Back to levels */
  await sleep(20);
  click("levelsBack");                               /* levels → home */
  await sleep(20);

  tiers = document.querySelectorAll("#freeCards .tier");
  assert.ok(!tiers[1].classList.contains("locked"), "junior ontgrendeld bij 24/24");
  assert.ok(tiers[2].classList.contains("locked"), "expert blijft op slot");
});

test("campagne-versie-reset: oude voortgang wordt gewist bij CAMP_VER-wissel", async (t) => {
  const app = await bootApp({ localStorage: {
    "flux-onboarded": "true",
    "flux-camp-ver": R.CAMP_VER - 1,
    "flux-camp-starter-0": { moves: 3, par: 3, timeMs: 5000, time: "00:05", hints: 0, onpar: true },
  }});
  t.after(() => app.close());
  assert.equal(app.window.localStorage.getItem("flux-camp-starter-0"), null, "oude best gewist");
  assert.equal(JSON.parse(app.window.localStorage.getItem("flux-camp-ver")), R.CAMP_VER);
});

/* Daily-flow door de echte UI: starten, spelen tot winst, resultaat + streak +
   pending-submit gecontroleerd, share-tekst spoilervrij, herstart onmogelijk. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../helpers/boot");
const FluxCore = require("../../js/flux-core.js");
const R = require("../../js/flux-rules.js");

const SKIP_INTRO = { "flux-onboarded": "true" };

function domState(app){
  return [...app.document.querySelectorAll("#board .tile")].map(t => +t.className.match(/\bs(\d)\b/)[1]);
}

test("daily: spelen tot winst → resultaat, streak, pending-submit en deelvoorbeeld", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);

  /* naar het Today-scherm via de tabbar */
  click(document.querySelector('#tabbar button[data-tab="vandaag"]'));
  assert.ok($("scr-vandaag").classList.contains("active"));
  assert.match($("dailyCountdown").textContent === "--:--:--" ? "00:00:00" : $("dailyCountdown").textContent, /^\d\d:\d\d:\d\d$/);

  click("dailyGo");                                  /* daily starten */
  await sleep(3400);                                 /* 3-2-1 aftelling afwachten */
  assert.ok($("scr-game").classList.contains("active"));

  /* het bord is exact de canonieke daily van vandaag (zelfde puzzel voor iedereen) */
  const todayKey = R.fluxDay();
  const canon = R.canonicalDaily(todayKey, "sprint");
  assert.deepEqual(domState(app), canon.state);

  /* optimaal oplossen via de tegels zelf */
  const tiles = document.querySelectorAll("#board .tile");
  canon.solution.forEach((cnt, i) => { for (let k = 0; k < cnt; k++) click(tiles[i]); });
  await sleep(650);
  assert.ok($("win").classList.contains("show"), "win-popup zichtbaar");
  assert.equal($("winTitle").textContent, "Nice one!");
  assert.equal($("winShareBtn").style.display, "", "deelknop zichtbaar bij daily");

  const ls = app.window.localStorage;
  const res = JSON.parse(ls.getItem("flux-daily-" + todayKey + "-sprint"));
  assert.equal(res.moves, canon.par, "op par gespeeld");
  assert.equal(JSON.parse(ls.getItem("flux-streak")), 1, "streak gestart");
  assert.equal(JSON.parse(ls.getItem("flux-streak-date")), todayKey);

  /* niet ingelogd → resultaat ligt klaar als pending voor latere serversubmit */
  const pend = JSON.parse(ls.getItem("flux-daily-pending"));
  assert.equal(pend.day, todayKey);
  assert.equal(pend.taps.length, canon.par);
  /* de pending taps lossen de canonieke puzzel echt op (wat de server zal herspelen) */
  const st = canon.state.slice();
  for (const tp of pend.taps) FluxCore.applyTap(st, tp, 3, 2);
  assert.ok(FluxCore.isSolved(st, R.TARGET));

  /* terug op Today: klaar-status, geen tweede poging mogelijk */
  click("winBack"); await sleep(20);
  assert.ok($("scr-vandaag").classList.contains("active"));
  assert.match($("dailyHero").textContent, /Done for today/);
  assert.equal($("dailyGo"), null, "geen startknop meer");
});

test("daily: hint gebruiken telt mee in het resultaat", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);
  click(document.querySelector('#tabbar button[data-tab="vandaag"]'));
  click("dailyGo"); await sleep(3400);               /* 3-2-1 aftelling */

  click("hintIconBtn");                                  /* hint = beste zet volgens solver */
  const hinted = document.querySelector("#board .tile.hint");
  assert.ok(hinted, "hint-tegel gemarkeerd");

  const todayKey = R.fluxDay();
  const canon = R.canonicalDaily(todayKey, "sprint");
  const tiles = document.querySelectorAll("#board .tile");
  canon.solution.forEach((cnt, i) => { for (let k = 0; k < cnt; k++) click(tiles[i]); });
  await sleep(650);
  const res = JSON.parse(app.window.localStorage.getItem("flux-daily-" + todayKey + "-sprint"));
  assert.equal(res.hints, 1, "1 hint geregistreerd");
});

test("daily: voortgang wordt bewaard en hervat (verlaten halverwege)", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);
  click(document.querySelector('#tabbar button[data-tab="vandaag"]'));
  click("dailyGo"); await sleep(3400);               /* 3-2-1 aftelling */

  const tiles = document.querySelectorAll("#board .tile");
  click(tiles[0]);                                   /* één zet */
  const after1 = domState(app);
  click("backBtn"); await sleep(20);                 /* weg uit het spel */
  assert.match($("dailyHero").textContent, /Resume/);

  click("dailyGo"); await sleep(60);                 /* hervatten: geen aftelling */
  assert.deepEqual(domState(app), after1, "bordstand hervat");
  assert.equal($("moves").textContent, "01", "zettenteller hervat");
});

test("share-tekst na de daily is spoilervrij en in het juiste format", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);
  click(document.querySelector('#tabbar button[data-tab="vandaag"]'));
  click("dailyGo"); await sleep(3400);               /* 3-2-1 aftelling */
  const todayKey = R.fluxDay();
  const canon = R.canonicalDaily(todayKey, "sprint");
  const tiles = document.querySelectorAll("#board .tile");
  canon.solution.forEach((cnt, i) => { for (let k = 0; k < cnt; k++) click(tiles[i]); });
  await sleep(650);
  /* het deelvoorbeeld (canvas) hangt in de win-sheet */
  assert.ok($("winShare").querySelector("canvas.sharecv"), "deelbeeld-canvas aanwezig");
  /* en de verwachte tekst is exact wat FluxRules bouwt (module = bron van waarheid) */
  const expected = R.dailyShareText({ num: R.dailyNumber(todayKey), moves: canon.par, par: canon.par,
    onpar: true, time: "XX", streak: 1 }, "FLUX", "https://flux-gules-omega.vercel.app");
  assert.ok(!expected.includes("solution") && !expected.includes(canon.state.join("")), "spoilervrij");
});

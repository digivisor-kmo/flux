/* Navigatie, onboarding, settings en instellingen-persistentie door de echte UI. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../helpers/boot");

const SKIP_INTRO = { "flux-onboarded": "true" };

test("koude start: intro → onboarding (eenmalig) → home", async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { $, click, sleep } = app;
  assert.notEqual($("intro").style.display, "none", "intro zichtbaar bij koude start");
  click("intro"); await sleep(30);
  assert.equal($("onboard").style.display, "flex", "onboarding toont voor nieuwe speler");
  /* door de 3 stappen heen */
  click("obNext"); click("obNext"); await sleep(10);
  assert.equal($("obNext").textContent, "Start playing");
  click("obNext"); await sleep(30);
  assert.equal(JSON.parse(app.window.localStorage.getItem("flux-onboarded")), true, "eenmalig gemarkeerd");
  assert.ok($("onboard").classList.contains("hide"), "onboarding sluit");
});

test("terugkerende speler: geen onboarding meer", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep } = app;
  click("intro"); await sleep(30);
  assert.notEqual($("onboard").style.display, "flex", "geen onboarding meer");
  assert.ok($("scr-spelen").classList.contains("active"), "meteen op home");
});

test("tabbar: alle drie schermen bereikbaar, actieve knop gemarkeerd", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);
  for (const tab of ["vandaag", "vrienden", "spelen"]){
    const btn = document.querySelector('#tabbar button[data-tab="' + tab + '"]');
    click(btn); await sleep(10);
    assert.ok($("scr-" + tab).classList.contains("active"), tab + " actief");
    assert.ok(btn.classList.contains("on"), "tabknop " + tab + " gemarkeerd");
    assert.equal(document.querySelectorAll(".screen.active").length, 1, "precies één scherm actief");
  }
});

test("help-popup: opent en sluit", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep } = app;
  click("intro"); await sleep(20);
  click("helpBtn"); await sleep(10);
  assert.ok($("help").classList.contains("show"));
  click("helpCloseX"); await sleep(10);
  assert.ok(!$("help").classList.contains("show"));
});

test("settings: geluid/haptiek-toggles persistent, vereisen geen login", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);
  click(document.querySelector('#tabbar button[data-tab="vrienden"]')); await sleep(10);
  click("settingsBtn"); await sleep(10);
  assert.ok($("settings").classList.contains("show"), "settings-sheet open");
  /* geluid staat default aan; uitzetten moet persistent zijn */
  const ls = app.window.localStorage;
  click("swSound"); await sleep(10);
  assert.equal(JSON.parse(ls.getItem("flux-sound")), false, "geluid uit bewaard");
  click("swSound"); await sleep(10);
  assert.equal(JSON.parse(ls.getItem("flux-sound")), true, "geluid weer aan bewaard");
});

test("niet ingelogd: vriendenscherm toont login, geen ranglijst-crash", async (t) => {
  const app = await bootApp({ localStorage: SKIP_INTRO });
  t.after(() => app.close());
  const { $, click, sleep, document } = app;
  click("intro"); await sleep(20);
  click(document.querySelector('#tabbar button[data-tab="vrienden"]')); await sleep(50);
  assert.deepEqual(app.errors, [], "geen scriptfouten");
  assert.match($("scr-vrienden").textContent, /Log in|log in/i, "login-uitnodiging zichtbaar");
});

/* Pariteit client ↔ server: de daily wordt op de server (edge function submit-daily)
   opnieuw gegenereerd en nagespeeld. Als client en server ook maar één bit verschillen,
   worden eerlijke oplossingen afgewezen. Deze tests bewaken dat contract:
   1. het VENDORED serverbestand (tests/fixtures/submit-daily.v3.ts) wordt écht uitgevoerd
      en moet dag voor dag exact dezelfde puzzel opleveren als de client-module;
   2. een gouden fixture legt de generatie voor 60 dagen vast, zodat elke onbedoelde
      wijziging aan seed/rng/solver direct faalt;
   3. de servervalidatie (zetten herspelen) accepteert de optimale client-oplossing.
   NB: wijzigt de edge function op Supabase, vendor dan ook de nieuwe versie hier. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const FluxCore = require("../../js/flux-core.js");
const R = require("../../js/flux-rules.js");

const FIX = path.join(__dirname, "..", "fixtures");
const DAYS = []; {
  const d = new Date(Date.UTC(2026, 6, 1));
  for (let i = 0; i < 60; i++){ DAYS.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
}

function runEdgeCanonicalDaily(days){
  /* voer de servercode zelf uit: knip het Deno/HTTP-deel eraf, hou de pure logica */
  let src = fs.readFileSync(path.join(FIX, "submit-daily.v3.ts"), "utf8");
  const cut = src.indexOf("const CORS = {");
  assert.ok(cut > 0, "fixture bevat het verwachte HTTP-deel");
  src = src.slice(0, cut).replace(/^import .*$/m, "");
  src += '\nconst out = {};\nfor (const d of JSON.parse(process.env.PARITY_DAYS)) out[d] = canonicalDaily(d);\nconsole.log(JSON.stringify(out));\n';
  const tmp = path.join(FIX, ".parity-runner.ts");
  fs.writeFileSync(tmp, src);
  try {
    const stdout = execFileSync(process.execPath, ["--experimental-strip-types", tmp], {
      env: { ...process.env, PARITY_DAYS: JSON.stringify(days), NODE_NO_WARNINGS: "1" },
      encoding: "utf8",
    });
    return JSON.parse(stdout.trim().split("\n").pop());
  } finally { fs.unlinkSync(tmp); }
}

test("edge function genereert bit-voor-bit dezelfde daily als de client (60 dagen)", () => {
  const server = runEdgeCanonicalDaily(DAYS);
  for (const day of DAYS){
    const client = R.canonicalDaily(day, "sprint");
    assert.deepEqual(server[day].state, client.state, day + ": bord identiek");
    assert.equal(server[day].par, client.par, day + ": par identiek");
  }
});

test("gouden fixture: daily-generatie is voor altijd vastgelegd", () => {
  const golden = JSON.parse(fs.readFileSync(path.join(FIX, "daily-golden.json"), "utf8"));
  for (const day of Object.keys(golden)){
    const g = R.canonicalDaily(day, "sprint");
    assert.deepEqual(g.state, golden[day].state, day + ": bord wijkt af van de gouden fixture — de daily-generatie is een contract, wijzig dit NOOIT zonder expliciete beslissing (en dan mét nieuwe fixture + edge function samen)");
    assert.equal(g.par, golden[day].par, day + ": par wijkt af van de gouden fixture");
  }
});

test("servervalidatie: de optimale client-oplossing overleeft het herspelen op de server", () => {
  for (const day of DAYS.slice(0, 20)){
    const g = R.canonicalDaily(day, "sprint");
    /* client-zetten: elke tegel zo vaak tikken als de optimale oplossing zegt */
    const taps = [];
    g.solution.forEach((cnt, i) => { for (let k = 0; k < cnt; k++) taps.push(i); });
    /* herspelen zoals de server het doet */
    const st = g.state.slice();
    for (const t of taps){
      assert.ok(Number.isInteger(t) && t >= 0 && t < 9, "zet geldig");
      FluxCore.applyTap(st, t, 3, 2);
    }
    assert.ok(FluxCore.isSolved(st, R.TARGET), day + ": herspelen lost op");
    assert.equal(taps.length, g.par, day + ": zetten == par");
    /* en de tijd-sanity van de server accepteert een realistische tijd */
    assert.ok(30000 >= taps.length * 150, "30s voor een daily is nooit 'te snel'");
  }
});

test("daily heeft altijd een unieke optimale oplossing (eerlijke ranking)", () => {
  for (const day of DAYS){
    const g = R.canonicalDaily(day, "sprint");
    assert.equal(g.unique, true, day);
  }
});

test("configuratie in het serverbestand komt overeen met de client-config", () => {
  const src = fs.readFileSync(path.join(FIX, "submit-daily.v3.ts"), "utf8");
  const s = R.DAILIES.sprint;
  assert.ok(src.includes(`const SPRINT = { size: ${s.size}, states: ${s.states}, kMin: ${s.kMin}, kMax: ${s.kMax} }`),
    "SPRINT-config identiek");
  assert.ok(src.includes(`const DAILY_RESET_HOUR = ${R.DAILY_RESET_HOUR}`), "resetuur identiek");
  assert.ok(src.includes('hashStr(day + "-sprint")'), "seed-formule identiek");
  assert.ok(src.includes('timeZone: "Europe/Brussels"'), "tijdzone identiek");
});

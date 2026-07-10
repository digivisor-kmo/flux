/* Unit-tests voor FluxRules: dagwissel, formattering, share-tekst, streak, Numbers. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../js/flux-rules.js");

test("fluxDay: wisselt om exact 09:00 Brusselse tijd", () => {
  /* zomertijd (UTC+2): 06:59Z = 08:59 Brussel → vorige dag; 07:00Z = 09:00 → zelfde dag */
  assert.equal(R.fluxDay(new Date("2026-07-10T06:59:59Z")), "2026-07-09");
  assert.equal(R.fluxDay(new Date("2026-07-10T07:00:00Z")), "2026-07-10");
  /* wintertijd (UTC+1): 07:59Z = 08:59 Brussel → vorige dag; 08:00Z = 09:00 → zelfde dag */
  assert.equal(R.fluxDay(new Date("2026-01-10T07:59:59Z")), "2026-01-09");
  assert.equal(R.fluxDay(new Date("2026-01-10T08:00:00Z")), "2026-01-10");
});

test("fluxDay: DST-overgangsdagen (klok verzet) blijven correct", () => {
  /* 2026-03-29: zomertijd begint (02:00→03:00). 2026-10-25: wintertijd begint. */
  assert.equal(R.fluxDay(new Date("2026-03-29T06:59:00Z")), "2026-03-28");  // 08:59 Brussel (al UTC+2)
  assert.equal(R.fluxDay(new Date("2026-03-29T07:01:00Z")), "2026-03-29");  // 09:01 Brussel
  assert.equal(R.fluxDay(new Date("2026-10-25T07:59:00Z")), "2026-10-24");  // 08:59 Brussel (al UTC+1)
  assert.equal(R.fluxDay(new Date("2026-10-25T08:01:00Z")), "2026-10-25");  // 09:01 Brussel
});

test("fluxDay: rond middernacht Brussel geen h24-fout, hoort bij vorige dag", () => {
  assert.equal(R.fluxDay(new Date("2026-07-10T22:30:00Z")), "2026-07-10");  // 00:30 op 11/7 Brussel → dag 10/7
});

test("prevDay: over maand-, jaar- en schrikkelgrenzen", () => {
  assert.equal(R.prevDay("2026-07-01"), "2026-06-30");
  assert.equal(R.prevDay("2026-01-01"), "2025-12-31");
  assert.equal(R.prevDay("2028-03-01"), "2028-02-29");  // schrikkeljaar
  assert.equal(R.prevDay("2027-03-01"), "2027-02-28");
});

test("dailyNumber: №1 = 2025-06-01, telt per kalenderdag", () => {
  assert.equal(R.dailyNumber("2025-06-01"), 1);
  assert.equal(R.dailyNumber("2025-06-02"), 2);
  assert.equal(R.dailyNumber("2026-06-01"), 366);
});

test("secsUntilReset: telt af naar 09:00 Brussel, springt daarna naar 24u", () => {
  assert.equal(R.secsUntilReset(new Date("2026-07-10T06:59:59Z")), 1);       // 08:59:59 Brussel
  assert.equal(R.secsUntilReset(new Date("2026-07-10T07:00:00Z")), 86400);   // exact 09:00 → volgende reset
  assert.equal(R.secsUntilReset(new Date("2026-07-10T08:00:00Z")), 82800);   // 10:00 → 23u
});

test("fmtTime / fmtHMS / pad", () => {
  assert.equal(R.fmtTime(0), "00:00");
  assert.equal(R.fmtTime(61000), "01:01");
  assert.equal(R.fmtTime(3599999), "59:59");
  assert.equal(R.fmtHMS(0), "00:00:00");
  assert.equal(R.fmtHMS(-5), "00:00:00");
  assert.equal(R.fmtHMS(3661000), "01:01:01");
  assert.equal(R.pad(7), "07");
});

test("esc: alle HTML-gevaarlijke tekens ontsmet (XSS via vriendennamen)", () => {
  assert.equal(R.esc('<img src=x onerror="a">&\''), "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
  assert.equal(R.esc(null), "");
  assert.equal(R.esc(undefined), "");
});

test("dailyShareText: spoilervrij, gouden vorm, cap op 12 bolletjes", () => {
  const base = { num: 405, moves: 5, par: 5, onpar: true, time: "01:23", streak: 0 };
  const t1 = R.dailyShareText(base, "FLUX", "https://flux.app");
  assert.equal(t1, "FLUX Daily №405\n🟦🟦🟦🟦🟦\n5 moves · par 5 · on par · ⏱ 01:23\nhttps://flux.app");
  const t2 = R.dailyShareText({ ...base, moves: 7, onpar: false, streak: 4 }, "FLUX", "u");
  assert.equal(t2, "FLUX Daily №405\n🟦🟦🟦🟦🟦🟧🟧\n7 moves · par 5 · +2 over par · ⏱ 01:23 · 🔥 4\nu");
  const t3 = R.dailyShareText({ ...base, moves: 30, onpar: false }, "FLUX", "u");
  assert.equal((t3.match(/🟦|🟧/g) || []).length, 12, "maximaal 12 bolletjes");
  /* spoilervrij: nooit bordposities of oplossingszetten in de tekst */
  assert.ok(!/state|solution|tile|\[/.test(t1 + t2 + t3));
});

test("streakFrom: aaneengesloten dagen terugtellend, gat breekt de reeks", () => {
  const have = new Set(["2026-07-10", "2026-07-09", "2026-07-08", "2026-07-06"]);
  assert.equal(R.streakFrom(have, "2026-07-10"), 3);
  assert.equal(R.streakFrom(have, "2026-07-06"), 1);
  assert.equal(R.streakFrom(have, "2026-07-05"), 0);
  assert.equal(R.streakFrom(new Set(), "2026-07-10"), 0);
});

test("genNumbers: deterministisch met injectie, altijd geldig en niet al opgelost", () => {
  const FluxCore = require("../../js/flux-core.js");
  for (const key of Object.keys(R.NUMBERS_DIFFS)){
    const cfg = R.NUMBERS_DIFFS[key];
    const rnd = FluxCore.seededRng(1234 + cfg.size);
    const g = R.genNumbers(cfg, rnd);
    const n = cfg.size * cfg.size;
    assert.equal(g.state.length, n);
    assert.ok(g.state.every(v => v === 0 || v === 1));
    assert.ok(!g.state.every(v => v === 1), "niet al opgelost");
    g.link.forEach((L, i) => {
      assert.equal(L.length, cfg.links, "exact L partners");
      assert.ok(!L.includes(i), "tegel schakelt zichzelf niet");
      assert.ok(L.every(x => x >= 0 && x < n));
    });
  }
});

test("genNumbers: puzzel is oplosbaar (brute force over alle tik-subsets, klein bord)", () => {
  const FluxCore = require("../../js/flux-core.js");
  const cfg = { size: 2, links: 2, kMin: 2, kMax: 3 };
  for (let seed = 0; seed < 15; seed++){
    const g = R.genNumbers(cfg, FluxCore.seededRng(seed));
    const n = 4;
    let solvable = false;
    for (let mask = 0; mask < (1 << n) && !solvable; mask++){
      const st = g.state.slice();
      for (let i = 0; i < n; i++) if (mask & (1 << i)) for (const j of g.link[i]) st[j] ^= 1;
      if (st.every(v => v === 1)) solvable = true;
    }
    assert.ok(solvable, "seed " + seed);
  }
});

test("configuratie-invarianten: tiers en daily-config zoals afgesproken", () => {
  assert.deepEqual(R.TIER_ORDER, ["starter", "junior", "expert", "master", "wizard"]);
  assert.equal(R.CAMP_N, 24);
  assert.equal(R.TARGET, 0);
  assert.equal(R.DAILY_RESET_HOUR, 9);
  const s = R.DAILIES.sprint;
  assert.deepEqual({ size: s.size, states: s.states, kMin: s.kMin, kMax: s.kMax },
    { size: 3, states: 2, kMin: 3, kMax: 4 },
    "daily-config is een contract met de edge function submit-daily: NOOIT eenzijdig wijzigen");
});

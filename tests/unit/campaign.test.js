/* Campagne: de geëmbedde 120-puzzelset is een contract met alle spelers.
   Elke puzzel moet oplosbaar zijn met exact de geclaimde par, en de
   moeilijkheidscurve moet kloppen. betterBest is het merge-hart van de
   cross-device sync en moet commutatief + idempotent blijven. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const FluxCore = require("../../js/flux-core.js");
const R = require("../../js/flux-rules.js");

test("alle 120 campagnepuzzels: geldig bord, oplosbaar, par exact zoals geclaimd", () => {
  for (const tier of R.TIER_ORDER){
    const cfg = R.FREE_DIFFS[tier];
    const set = R.CAMP_PUZZLES[tier];
    assert.equal(set.length, R.CAMP_N, tier + ": 24 puzzels");
    set.forEach((e, i) => {
      const id = tier + " #" + (i + 1);
      assert.equal(e.s.length, cfg.size * cfg.size, id + ": bordgrootte");
      assert.ok(e.s.every(v => Number.isInteger(v) && v >= 0 && v < cfg.states), id + ": staten geldig");
      assert.ok(!e.s.every(v => v === R.TARGET), id + ": niet al opgelost");
      const sol = FluxCore.solve(e.s, R.TARGET, cfg.size, cfg.states);
      assert.ok(sol, id + ": oplosbaar");
      assert.equal(sol.par, e.p, id + ": par klopt");
    });
  }
});

test("par-curve per tier: niet-dalend en de laatste puzzel is de moeilijkste", () => {
  for (const tier of R.TIER_ORDER){
    const pars = R.CAMP_PUZZLES[tier].map(e => e.p);
    for (let i = 1; i < pars.length; i++)
      assert.ok(pars[i] >= pars[i - 1], tier + ": par daalt bij puzzel " + (i + 1));
    assert.equal(pars[pars.length - 1], Math.max(...pars), tier + ": eindigt op max");
  }
});

test("campPuzzle: geeft verse kopieën (muteren corrumpeert de tabel niet)", () => {
  const a = R.campPuzzle("starter", 0);
  a.state[0] = 99;
  const b = R.campPuzzle("starter", 0);
  assert.notEqual(b.state[0], 99);
  assert.equal(a.par, b.par);
  assert.equal(a.cfg, R.FREE_DIFFS.starter);
});

test("betterBest: minst zetten wint, dan snelste tijd", () => {
  const slow = { moves: 8, timeMs: 60000, onpar: false };
  const fast = { moves: 8, timeMs: 30000, onpar: false };
  const few  = { moves: 6, timeMs: 90000, onpar: false };
  assert.equal(R.betterBest(slow, fast).timeMs, 30000);
  assert.equal(R.betterBest(fast, few).moves, 6);
  assert.equal(R.betterBest(few, fast).moves, 6);
});

test("betterBest: onpar is sticky (ooit op par = altijd op par)", () => {
  const oldPar = { moves: 9, timeMs: 5000, onpar: true };
  const newBetter = { moves: 7, timeMs: 4000, onpar: false };
  const m = R.betterBest(oldPar, newBetter);
  assert.equal(m.moves, 7);
  assert.equal(m.onpar, true, "par-badge mag nooit meer verdwijnen");
});

test("betterBest: commutatief en idempotent (veilig voor multi-device sync)", () => {
  const a = { moves: 7, timeMs: 40000, onpar: true };
  const b = { moves: 7, timeMs: 35000, onpar: false };
  assert.deepEqual(R.betterBest(a, b), R.betterBest(b, a), "volgorde-onafhankelijk");
  assert.deepEqual(R.betterBest(a, a), { ...a, onpar: true });
  /* herhaald mergen verandert niets meer (idempotent) */
  const m = R.betterBest(a, b);
  assert.deepEqual(R.betterBest(m, b), m);
  assert.deepEqual(R.betterBest(m, a), m);
});

test("betterBest: null-kanten (eerste sync, nieuw toestel)", () => {
  const a = { moves: 5, timeMs: 1000, onpar: true };
  assert.equal(R.betterBest(null, a), a);
  assert.equal(R.betterBest(a, null), a);
  assert.equal(R.betterBest(null, null), null);
});

test("hints reizen mee met de winnende oplossing (v2.5.0-gedrag)", () => {
  const a = { moves: 9, timeMs: 5000, onpar: false, hints: 3 };
  const b = { moves: 7, timeMs: 9000, onpar: false, hints: 0 };
  assert.equal(R.betterBest(a, b).hints, 0, "hints horen bij de beste solve");
});

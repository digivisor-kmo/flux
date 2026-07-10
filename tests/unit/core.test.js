/* Unit-tests voor FluxCore: de wiskundige ruggengraat (sectie 2+3 projectplan).
   Elke regel hier beschermt de lineariteit over Z/S en de bewezen par. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const FluxCore = require("../../js/flux-core.js");

const { brush, applyTap, createSolved, isSolved, solve, generate, hashStr, seededRng } = FluxCore;

/* referentie: kortste oplossing via breedte-eerst zoeken (onafhankelijk van de solver) */
function bfsPar(state, target, size, S){
  const n = size * size;
  const key = s => s.join(",");
  const goal = new Array(n).fill(target);
  let frontier = new Map([[key(state), state]]);
  const seen = new Set(frontier.keys());
  for (let depth = 0; depth <= 40; depth++){
    for (const s of frontier.values()) if (key(s) === key(goal)) return depth;
    const next = new Map();
    for (const s of frontier.values()){
      for (let i = 0; i < n; i++){
        const t = s.slice(); applyTap(t, i, size, S);
        const k = key(t);
        if (!seen.has(k)){ seen.add(k); next.set(k, t); }
      }
    }
    frontier = next;
    if (!frontier.size) break;
  }
  return null;
}

test("brush: plus-kruis binnen het bord, geen wrap", () => {
  assert.deepEqual(brush(4, 3).sort((a,b)=>a-b), [1,3,4,5,7]);   // midden 3x3
  assert.deepEqual(brush(0, 3).sort((a,b)=>a-b), [0,1,3]);       // hoek
  assert.deepEqual(brush(1, 3).sort((a,b)=>a-b), [0,1,2,4]);     // rand
  assert.deepEqual(brush(8, 3).sort((a,b)=>a-b), [5,7,8]);       // hoek rechtsonder
});

test("applyTap: +1 mod S op precies de kwast, rest onaangeroerd", () => {
  const st = createSolved(3, 0);
  applyTap(st, 4, 3, 3);
  assert.deepEqual(st, [0,1,0, 1,1,1, 0,1,0]);
  applyTap(st, 4, 3, 3); applyTap(st, 4, 3, 3);   // 3e keer: terug naar 0 (mod 3)
  assert.ok(isSolved(st, 0));
});

test("lineariteit: volgorde van tikken maakt niet uit", () => {
  const rng = seededRng(42);
  for (let trial = 0; trial < 20; trial++){
    const taps = Array.from({length: 6}, () => Math.floor(rng() * 16));
    const a = createSolved(4, 0), b = createSolved(4, 0);
    for (const t of taps) applyTap(a, t, 4, 3);
    for (const t of taps.slice().reverse()) applyTap(b, t, 4, 3);
    assert.deepEqual(a, b);
  }
});

test("S keer dezelfde tik = identiteit", () => {
  for (const S of [2, 3, 4]){
    const st = createSolved(3, 0);
    for (let k = 0; k < S; k++) applyTap(st, 2, 3, S);
    assert.ok(isSolved(st, 0), "S=" + S);
  }
});

test("solver-par == BFS-par (onafhankelijke referentie), oplossing lost echt op", () => {
  const cases = [[3, 2, 40], [3, 3, 25], [2, 3, 30], [2, 2, 30]];
  for (const [N, S, trials] of cases){
    const rng = seededRng(N * 100 + S);
    for (let t = 0; t < trials; t++){
      const g = generate(N, S, 0, Math.min(N * N, 1 + Math.floor(rng() * 5)), rng, false);
      const sol = solve(g.state, 0, N, S);
      assert.ok(sol, "oplosbaar");
      assert.equal(sol.par, bfsPar(g.state, 0, N, S), `par ${N}x${N} S${S}`);
      const st = g.state.slice();
      for (let i = 0; i < sol.solution.length; i++)
        for (let k = 0; k < sol.solution[i]; k++) applyTap(st, i, N, S);
      assert.ok(isSolved(st, 0), "oplossing lost het bord op");
    }
  }
});

test("generate: elke scramble is oplosbaar met bewezen par, alle tierformaten", () => {
  for (const [N, S] of [[3,2],[4,2],[3,3],[4,3],[5,3]]){
    const rng = seededRng(N * 10 + S);
    for (let t = 0; t < 25; t++){
      const g = generate(N, S, 0, 2 + Math.floor(rng() * 5), rng, false);
      assert.ok(!isSolved(g.state, 0), "niet al opgelost");
      assert.ok(Number.isInteger(g.par) && g.par > 0, "par bekend");
      const sol = solve(g.state, 0, N, S);
      assert.equal(sol.par, g.par, "par klopt met verse solve");
    }
  }
});

test("generate met requireUnique levert unieke optimale oplossing (daily-eis)", () => {
  const rng = seededRng(777);
  for (let t = 0; t < 30; t++){
    const g = generate(3, 2, 0, 3 + Math.floor(rng() * 2), rng, true);
    assert.equal(g.unique, true);
  }
});

test("generate: k groter dan het bord hangt niet (guard-regressie)", () => {
  const g = generate(2, 2, 0, 99, seededRng(1), false);   // hing vroeger oneindig
  assert.ok(Number.isInteger(g.par));
});

test("hashStr + seededRng: deterministisch (gouden waarden beschermen de daily-seed)", () => {
  assert.equal(hashStr("2026-07-10-sprint"), hashStr("2026-07-10-sprint"));
  assert.notEqual(hashStr("2026-07-10-sprint"), hashStr("2026-07-11-sprint"));
  /* gouden waarde: als dit wijzigt, krijgt IEDEREEN een andere daily → bewuste beslissing vereist */
  assert.equal(hashStr("2026-01-01-sprint"), 1946862698);
  const r = seededRng(1946862698);
  assert.equal(Math.floor(r() * 1e6), 888070);
});

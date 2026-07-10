/**
 * Pure spellogica-module: geen DOM, geen framework.
 * Exacte mechaniek volgens sectie 2 van de projectinstructie.
 * Lineair over Z/S: niet breken zonder expliciete beslissing.
 */
const FluxCore = (function () {
  "use strict";

  function brush(i, size) {
    const r = Math.floor(i / size), c = i % size, out = [i];
    if (r > 0) out.push(i - size);
    if (r < size - 1) out.push(i + size);
    if (c > 0) out.push(i - 1);
    if (c < size - 1) out.push(i + 1);
    return out;
  }

  function applyTap(state, i, size, states) {
    const aff = brush(i, size);
    for (const j of aff) state[j] = (state[j] + 1) % states;
    return aff;
  }

  function createSolved(size, target) {
    return new Array(size * size).fill(target);
  }

  function isSolved(state, target) {
    return state.every(v => v === target);
  }

  /* ---------- solver / par-engine (sectie 3) ----------
     De mechaniek is lineair over Z/S (S priem): oplossen = A·x = b over GF(S),
     met x_i = aantal tikken op tegel i (mod S). Par = minimale som van tikken
     over alle geldige oplossingen (particuliere oplossing + nulruimte). */

  function buildMatrix(size) {
    const n = size * size;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let j = 0; j < n; j++) brush(j, size).forEach(i => { A[i][j] = 1; });
    return A;
  }

  function modInv(x, S) { for (let k = 1; k < S; k++) if ((x * k) % S === 1) return k; return 1; }

  /* Gauss-Jordan over GF(S): particuliere oplossing + basis van de nulruimte */
  function solveLinear(A, b, S) {
    const n = A.length;
    const M = A.map((row, i) => row.concat([b[i]]).map(v => ((v % S) + S) % S));
    let rank = 0; const pivotCol = [];
    for (let col = 0; col < n && rank < n; col++) {
      let p = -1;
      for (let r = rank; r < n; r++) if (M[r][col] !== 0) { p = r; break; }
      if (p < 0) continue;
      [M[rank], M[p]] = [M[p], M[rank]];
      const iv = modInv(M[rank][col], S);
      for (let c = col; c <= n; c++) M[rank][c] = (M[rank][c] * iv) % S;
      for (let r = 0; r < n; r++) {
        if (r !== rank && M[r][col] !== 0) {
          const f = M[r][col];
          for (let c = col; c <= n; c++) M[r][c] = ((M[r][c] - f * M[rank][c]) % S + S) % S;
        }
      }
      pivotCol[rank] = col; rank++;
    }
    for (let r = rank; r < n; r++) if (M[r][n] !== 0) return null;   /* strijdig */
    const x = new Array(n).fill(0);
    for (let r = 0; r < rank; r++) x[pivotCol[r]] = M[r][n];
    const isPivot = new Array(n).fill(false); pivotCol.forEach(c => { isPivot[c] = true; });
    const basis = [];
    for (let f = 0; f < n; f++) {
      if (isPivot[f]) continue;
      const v = new Array(n).fill(0); v[f] = 1;
      for (let r = 0; r < rank; r++) v[pivotCol[r]] = ((-M[r][f]) % S + S) % S;
      basis.push(v);
    }
    return { x, basis };
  }

  /**
   * Lost een bord op. Geeft { solution, par, unique, nullity } of null.
   * solution[i] = optimaal aantal tikken op tegel i; par = som daarvan;
   * unique = of die optimale oplossing de enige is.
   */
  function solve(state, target, size, S) {
    const n = size * size;
    const b = state.map(v => ((target - v) % S + S) % S);
    const r = solveLinear(buildMatrix(size), b, S);
    if (!r) return null;
    const d = r.basis.length, total = Math.pow(S, d);
    if (total > 100000) return null;   /* nulruimte te groot om te enumereren */
    let best = null, bestW = Infinity, count = 0;
    for (let t = 0; t < total; t++) {
      const cand = r.x.slice();
      let tt = t;
      for (let bi = 0; bi < d; bi++) {
        const c = tt % S; tt = (tt - c) / S;
        if (c) for (let i = 0; i < n; i++) cand[i] = (cand[i] + c * r.basis[bi][i]) % S;
      }
      let w = 0; for (let i = 0; i < n; i++) w += cand[i];
      if (w < bestW) { bestW = w; best = cand; count = 1; }
      else if (w === bestW) count++;
    }
    return { solution: best, par: bestW, unique: count === 1, nullity: d };
  }

  /**
   * Genereert een puzzel met bewezen par (via de solver).
   * requireUnique: blijf proberen tot de optimale oplossing uniek is (voor dailies).
   */
  function generate(size, states, target, k, rng, requireUnique) {
    rng = rng || Math.random;
    k = Math.min(k, size * size);   /* guard: k > aantal tegels zou oneindig lussen */
    for (let attempt = 0; attempt < 80; attempt++) {
      const state = createSolved(size, target);
      const used = new Set();
      while (used.size < k) used.add(Math.floor(rng() * size * size));
      const taps = [...used];
      for (const i of taps) applyTap(state, i, size, states);
      if (isSolved(state, target)) continue;
      const sol = solve(state, target, size, states);
      if (!sol) continue;
      if (requireUnique && !sol.unique) continue;
      return { state, taps, par: sol.par, unique: sol.unique, solution: sol.solution };
    }
    /* fallback: laatste poging zonder uniciteitseis */
    const state = createSolved(size, target);
    applyTap(state, 0, size, states);
    const sol = solve(state, target, size, states);
    return { state, taps: [0], par: sol.par, unique: sol.unique, solution: sol.solution };
  }

  /* deterministische RNG voor dailies (mulberry32) + string-hash */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { brush, applyTap, createSolved, isSolved, generate, solve, hashStr, seededRng };
})();
if (typeof module !== "undefined") module.exports = FluxCore;

/* Node-export zodat de testsuite exact dezelfde module gebruikt als de app */
if (typeof module !== "undefined" && module.exports) module.exports = FluxCore;

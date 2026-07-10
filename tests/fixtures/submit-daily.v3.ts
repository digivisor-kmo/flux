import { createClient } from "jsr:@supabase/supabase-js@2";

/* ============ FluxCore: identiek aan de client (sectie 2/3 projectplan) ============ */
function brush(i: number, size: number): number[] {
  const r = Math.floor(i / size), c = i % size, out = [i];
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}
function applyTap(state: number[], i: number, size: number, states: number) {
  for (const j of brush(i, size)) state[j] = (state[j] + 1) % states;
}
function createSolved(size: number, target: number): number[] { return new Array(size * size).fill(target); }
function isSolved(state: number[], target: number): boolean { return state.every(v => v === target); }
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededRng(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildMatrix(size: number): number[][] {
  const n = size * size;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) for (const i of brush(j, size)) A[i][j] = 1;
  return A;
}
function modInv(x: number, S: number): number { for (let k = 1; k < S; k++) if ((x * k) % S === 1) return k; return 1; }
function solveLinear(A: number[][], b: number[], S: number) {
  const n = A.length;
  const M = A.map((row, i) => row.concat([b[i]]).map(v => ((v % S) + S) % S));
  let rank = 0; const pivotCol: number[] = [];
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
  for (let r = rank; r < n; r++) if (M[r][n] !== 0) return null;
  const x = new Array(n).fill(0);
  for (let r = 0; r < rank; r++) x[pivotCol[r]] = M[r][n];
  const isPivot = new Array(n).fill(false); pivotCol.forEach(c => { isPivot[c] = true; });
  const basis: number[][] = [];
  for (let f = 0; f < n; f++) {
    if (isPivot[f]) continue;
    const v = new Array(n).fill(0); v[f] = 1;
    for (let r = 0; r < rank; r++) v[pivotCol[r]] = ((-M[r][f]) % S + S) % S;
    basis.push(v);
  }
  return { x, basis };
}
function solve(state: number[], target: number, size: number, S: number) {
  const n = size * size;
  const b = state.map(v => ((target - v) % S + S) % S);
  const r = solveLinear(buildMatrix(size), b, S);
  if (!r) return null;
  const d = r.basis.length, total = Math.pow(S, d);
  if (total > 100000) return null;
  let best: number[] | null = null, bestW = Infinity, count = 0;
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
  return { solution: best!, par: bestW, unique: count === 1, nullity: d };
}
function generate(size: number, states: number, target: number, k: number, rng: () => number, requireUnique: boolean) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const state = createSolved(size, target);
    const used = new Set<number>();
    while (used.size < k) used.add(Math.floor(rng() * size * size));
    const taps = [...used];
    for (const i of taps) applyTap(state, i, size, states);
    if (isSolved(state, target)) continue;
    const sol = solve(state, target, size, states);
    if (!sol) continue;
    if (requireUnique && !sol.unique) continue;
    return { state, par: sol.par };
  }
  const state = createSolved(size, target);
  applyTap(state, 0, size, states);
  const sol = solve(state, target, size, states)!;
  return { state, par: sol.par };
}

/* ============ daily-config: MOET gelijk blijven aan de client ============ */
const SPRINT = { size: 3, states: 2, kMin: 3, kMax: 4 };
const TARGET = 0;

/* De "FLUX-dag" wisselt om 09:00 Belgische tijd. IDENTIEK aan de client. */
const DAILY_RESET_HOUR = 9;
function fluxDay(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)!.value;
  const y = +g("year"), m = +g("month"), d = +g("day"), h = +g("hour");
  if (h < DAILY_RESET_HOUR) {
    const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function canonicalDaily(day: string) {
  const rng = seededRng(hashStr(day + "-sprint"));
  const k = SPRINT.kMin + Math.floor(rng() * (SPRINT.kMax - SPRINT.kMin + 1));
  return generate(SPRINT.size, SPRINT.states, TARGET, k, rng, true);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user }, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !user) return json({ error: "niet ingelogd" }, 401);

    const body = await req.json();
    const day = String(body.day ?? "");
    const taps = body.taps;
    const elapsedMs = Number(body.elapsedMs);
    const hints = Math.max(0, Math.floor(Number(body.hints) || 0));

    /* alleen de daily van vandaag (FLUX-dag, 09:00 Brussel) */
    if (day !== fluxDay()) return json({ error: "dag klopt niet" }, 400);
    if (!Array.isArray(taps) || taps.length === 0 || taps.length > 500) return json({ error: "zetten ongeldig" }, 400);
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return json({ error: "tijd ongeldig" }, 400);

    /* canonieke puzzel: ophalen of deterministisch aanmaken */
    let { data: puzzle } = await admin.from("daily_puzzles").select("*").eq("day", day).maybeSingle();
    if (!puzzle) {
      const gen = canonicalDaily(day);
      await admin.from("daily_puzzles").upsert(
        { day, size: SPRINT.size, states: SPRINT.states, state: gen.state, par: gen.par },
        { onConflict: "day", ignoreDuplicates: true });
      const res2 = await admin.from("daily_puzzles").select("*").eq("day", day).single();
      puzzle = res2.data;
    }
    if (!puzzle) return json({ error: "daily onbeschikbaar" }, 500);

    /* zetten herspelen: vertrouw nooit een client-score */
    const st = (puzzle.state as number[]).slice();
    const n = puzzle.size * puzzle.size;
    for (const t of taps) {
      if (!Number.isInteger(t) || t < 0 || t >= n) return json({ error: "zet ongeldig" }, 400);
      applyTap(st, t, puzzle.size, puzzle.states);
    }
    if (!isSolved(st, TARGET)) return json({ error: "zetten lossen de puzzel niet op" }, 400);
    const moves = taps.length;

    /* voortgangsrij (voor 'attempts'). */
    const { data: prog } = await admin.from("daily_progress")
      .select("started_at, attempts").eq("user_id", user.id).eq("day", day).maybeSingle();
    const attempts = Math.max(1, prog?.attempts ?? Math.floor(Number(body.attempts) || 1));

    /* enige tijd-sanity: niet onmenselijk snel (min. 150ms per zet). Een LANGERE tijd is
       nooit verdacht — nadenken telt gewoon mee — dus we vergelijken niet meer met de
       serverklok. Die vergelijking verwierp eerlijke oplossingen onterecht (wie voor de
       eerste tik nadacht, telde die tijd bij zich maar niet bij de server). */
    if (elapsedMs < moves * 150) return json({ error: "tijd onmogelijk" }, 400);

    /* eerste geldige oplossing telt; daarna niet meer te overschrijven */
    const { error: ierr } = await admin.from("daily_results").insert({
      user_id: user.id, day, time_ms: Math.round(elapsedMs),
      moves, par: puzzle.par, hints, attempts,
    });
    if (ierr && !String(ierr.message).includes("duplicate")) return json({ error: ierr.message }, 500);

    await admin.from("daily_progress").delete().eq("user_id", user.id).eq("day", day);

    const { data: result } = await admin.from("daily_results").select("*")
      .eq("user_id", user.id).eq("day", day).single();
    return json({ ok: true, result });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

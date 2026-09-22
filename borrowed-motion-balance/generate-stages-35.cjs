// Run: node generate-stages-35.cjs
// 35 worlds x 30 stages = 1050. Rule: borrowed-motion-easy-v1 (+ wall cells).
// Difficulty axes: board (3x3->4x4), pieces (2->4), min-moves, wall count.
// Outputs web/stages-data.js (window.BM_DATA) and validation-report-35.json.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const ROOT = __dirname;
const RULES = 'borrowed-motion-easy-v1';
const VECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const WORLD_SIZE = 30;

let seed = 20260922;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
const clone = s => s.map(p => p.slice());
const key = s => s.flat().join(',');
const poskey = s => s.map(p => p.slice(0, 2).join(',')).join(';');
function pairsFor(n) { const o = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) o.push([a, b]); return o; }

// wall-aware outcome (identical logic to rules.cjs / game.js)
function outcome(s, pair, n, walls) {
  const t = clone(s), [a, b] = pair;[t[a][2], t[b][2]] = [t[b][2], t[a][2]];
  const proposed = t.map((p, i) => {
    if (i !== a && i !== b) return p.slice(0, 2);
    const [dx, dy] = VECTORS[p[2]], x = p[0] + dx, y = p[1] + dy;
    const blocked = x < 0 || x >= n || y < 0 || y >= n || s.some(q => q[0] === x && q[1] === y) || (walls && walls.has(x + ',' + y));
    return blocked ? p.slice(0, 2) : [x, y];
  });
  return t.map((p, i) => { const q = proposed[i], c = proposed.filter(r => r[0] === q[0] && r[1] === q[1]).length > 1; return [c ? p[0] : q[0], c ? p[1] : q[1], p[2]]; });
}

function explore(start, n, cap, walls) {
  const pairs = pairsFor(start.length);
  const states = [start], index = new Map([[key(start), 0]]), distance = [0], ways = [1], parent = [null], goals = new Map();
  for (let i = 0; i < states.length; i++) {
    if (states.length > cap) return null;
    const s = states[i], pk = poskey(s), d = distance[i];
    if (!goals.has(pk)) goals.set(pk, { positions: s.map(p => p.slice(0, 2)), distance: d, ways: 0, node: i });
    const g = goals.get(pk); if (d === g.distance) g.ways += ways[i];
    for (let a = 0; a < pairs.length; a++) {
      const t = outcome(s, pairs[a], n, walls), k = key(t); let j = index.get(k);
      if (j === undefined) { j = states.length; index.set(k, j); states.push(t); distance.push(d + 1); ways.push(ways[i]); parent.push([i, a]); }
      else if (distance[j] === d + 1) ways[j] += ways[i];
    }
  }
  return { states, goals, parent, pairs, total: states.length };
}

// canonical key up to the board's 8 symmetries, including wall layout
function canonical(start, targets, n, walls) {
  const variants = [];
  for (let reflect = 0; reflect < 2; reflect++) for (let rotate = 0; rotate < 4; rotate++) {
    const tf = (x, y) => { let X = x, Y = y; if (reflect) X = n - 1 - X; for (let k = 0; k < rotate; k++)[X, Y] = [n - 1 - Y, X]; return [X, Y]; };
    const rows = start.map((p, i) => {
      let [x, y, d] = p, [gx, gy] = targets[i], [dx, dy] = VECTORS[d];
      if (reflect) { x = n - 1 - x; gx = n - 1 - gx; dx = -dx; }
      for (let k = 0; k < rotate; k++) { [x, y] = [n - 1 - y, x];[gx, gy] = [n - 1 - gy, gx];[dx, dy] = [-dy, dx]; }
      const nd = VECTORS.findIndex(v => v[0] === dx && v[1] === dy);
      return [x, y, nd, gx, gy].join(',');
    }).sort();
    const wrows = (walls || []).map(w => tf(w[0], w[1]).join(',')).sort();
    variants.push(n + '|' + rows.join(';') + '|' + wrows.join(';'));
  }
  return variants.sort()[0];
}

// choose wall cells + piece start on the remaining free cells
function randomLayout(n, pieces, wallCount) {
  const cells = shuffle(Array.from({ length: n * n }, (_, i) => [i % n, Math.floor(i / n)]));
  const walls = cells.slice(0, wallCount);
  const startCells = cells.slice(wallCount, wallCount + pieces);
  const start = startCells.map(c => [c[0], c[1], Math.floor(random() * 4)]);
  const wallSet = new Set(walls.map(w => w[0] + ',' + w[1]));
  return { start, walls, wallSet };
}

const STATE_CAP = 7000;

// ---- world curve: 35 worlds, escalating (board -> pieces -> min -> walls) ----
// name = existing chapter tier (reuses i18n keys in the game)
const WORLDS = [
  // 3x3 basics
  { n: 3, pieces: 2, walls: 0, base: 1, lo: 1, hi: 2, name: '규칙 익히기' }, // 1
  { n: 3, pieces: 3, walls: 0, base: 2, lo: 1, hi: 3, name: '규칙 익히기' }, // 2
  { n: 3, pieces: 3, walls: 0, base: 3, lo: 2, hi: 4, name: '편안한 반복' }, // 3
  { n: 3, pieces: 3, walls: 0, base: 4, lo: 3, hi: 5, name: '편안한 반복' }, // 4
  { n: 3, pieces: 3, walls: 0, base: 5, lo: 4, hi: 6, name: '편안한 반복' }, // 5
  // 3x3 + walls
  { n: 3, pieces: 3, walls: 1, base: 3, lo: 2, hi: 4, name: '순서 계획' }, // 6
  { n: 3, pieces: 3, walls: 1, base: 4, lo: 3, hi: 5, name: '순서 계획' }, // 7
  { n: 3, pieces: 3, walls: 1, base: 5, lo: 4, hi: 6, name: '순서 계획' }, // 8
  { n: 3, pieces: 3, walls: 2, base: 4, lo: 3, hi: 5, name: '순서 계획' }, // 9
  { n: 3, pieces: 3, walls: 2, base: 5, lo: 4, hi: 6, name: '순서 계획' }, // 10
  // 4x4, 3 pieces
  { n: 4, pieces: 3, walls: 0, base: 3, lo: 3, hi: 4, name: '넓은 보드 적응' }, // 11
  { n: 4, pieces: 3, walls: 0, base: 4, lo: 3, hi: 5, name: '넓은 보드 적응' }, // 12
  { n: 4, pieces: 3, walls: 0, base: 5, lo: 4, hi: 6, name: '넓은 보드 적응' }, // 13
  { n: 4, pieces: 3, walls: 0, base: 6, lo: 5, hi: 7, name: '넓은 보드 적응' }, // 14
  { n: 4, pieces: 3, walls: 1, base: 4, lo: 3, hi: 5, name: '4×4 계획' }, // 15
  { n: 4, pieces: 3, walls: 1, base: 5, lo: 4, hi: 6, name: '4×4 계획' }, // 16
  { n: 4, pieces: 3, walls: 1, base: 6, lo: 5, hi: 7, name: '4×4 계획' }, // 17
  { n: 4, pieces: 3, walls: 2, base: 5, lo: 4, hi: 7, name: '4×4 계획' }, // 18
  { n: 4, pieces: 3, walls: 2, base: 6, lo: 5, hi: 8, name: '4×4 계획' }, // 19
  { n: 4, pieces: 3, walls: 3, base: 6, lo: 5, hi: 8, name: '4×4 계획' }, // 20
  // 4x4, 4 pieces
  { n: 4, pieces: 4, walls: 0, base: 3, lo: 3, hi: 4, name: '네 조각 입문' }, // 21
  { n: 4, pieces: 4, walls: 0, base: 4, lo: 3, hi: 5, name: '네 조각 입문' }, // 22
  { n: 4, pieces: 4, walls: 0, base: 5, lo: 4, hi: 6, name: '네 조각 입문' }, // 23
  { n: 4, pieces: 4, walls: 0, base: 6, lo: 5, hi: 7, name: '네 조각 입문' }, // 24
  { n: 4, pieces: 4, walls: 1, base: 4, lo: 3, hi: 5, name: '네 조각 계획' }, // 25
  { n: 4, pieces: 4, walls: 1, base: 5, lo: 4, hi: 6, name: '네 조각 계획' }, // 26
  { n: 4, pieces: 4, walls: 1, base: 6, lo: 5, hi: 7, name: '네 조각 계획' }, // 27
  { n: 4, pieces: 4, walls: 1, base: 7, lo: 6, hi: 8, name: '네 조각 계획' }, // 28
  { n: 4, pieces: 4, walls: 2, base: 5, lo: 4, hi: 7, name: '네 조각 계획' }, // 29
  { n: 4, pieces: 4, walls: 2, base: 6, lo: 5, hi: 8, name: '네 조각 계획' }, // 30
  { n: 4, pieces: 4, walls: 2, base: 7, lo: 6, hi: 9, name: '네 조각 계획' }, // 31
  { n: 4, pieces: 4, walls: 3, base: 6, lo: 5, hi: 8, name: '긴 여정' }, // 32
  { n: 4, pieces: 4, walls: 3, base: 7, lo: 6, hi: 9, name: '긴 여정' }, // 33
  { n: 4, pieces: 4, walls: 4, base: 7, lo: 6, hi: 9, name: '긴 여정' }, // 34
  { n: 4, pieces: 4, walls: 4, base: 8, lo: 7, hi: 9, name: '긴 여정' }, // 35
];

// ---- pool collection per (n,pieces,walls,depth) ----
const bk = (n, p, w, d) => `${n}-${p}-${w}-${d}`;
const pool = {};
const seenAll = new Set();

// distinct (n,pieces,walls) combos with the union of depth bands they need
const combos = new Map();
for (const W of WORLDS) {
  const ck = `${W.n}-${W.pieces}-${W.walls}`;
  if (!combos.has(ck)) combos.set(ck, { n: W.n, pieces: W.pieces, walls: W.walls, depths: new Set(), need: 0 });
  const c = combos.get(ck);
  for (let d = W.lo; d <= W.hi; d++) c.depths.add(d);
  c.need += WORLD_SIZE;
}

for (const c of combos.values()) {
  const depths = [...c.depths].sort((a, b) => a - b);
  for (const d of depths) pool[bk(c.n, c.pieces, c.walls, d)] = pool[bk(c.n, c.pieces, c.walls, d)] || [];
  const perDepthCap = Math.ceil(c.need / depths.length) + 40; // generous
  const need = new Set(depths.map(d => bk(c.n, c.pieces, c.walls, d)));
  const maxRuns = 120000;
  const t0 = Date.now(); let runs = 0;
  while (need.size > 0 && runs < maxRuns) {
    runs++;
    const { start, walls, wallSet } = randomLayout(c.n, c.pieces, c.walls);
    const g = explore(start, c.n, STATE_CAP, wallSet);
    if (!g) continue;
    for (const goal of g.goals.values()) {
      const d = goal.distance;
      if (!c.depths.has(d)) continue;
      const b = bk(c.n, c.pieces, c.walls, d);
      if (!need.has(b)) continue;
      if (c.pieces >= 3 && d > 1 && goal.ways < 2) continue; // avoid single-line forced puzzles
      const cck = canonical(start, goal.positions, c.n, walls);
      if (seenAll.has(cck)) continue;
      seenAll.add(cck);
      pool[b].push({ n: c.n, pieces: c.pieces, walls, start, targets: goal.positions.map(p => p.slice()), depth: d, ways: goal.ways });
      if (pool[b].length >= perDepthCap) need.delete(b);
    }
  }
  console.log(`collect ${c.n}x${c.n}-${c.pieces}p-w${c.walls}: need=${c.need} runs=${runs} ms=${Date.now() - t0} ` +
    depths.map(d => `d${d}:${pool[bk(c.n, c.pieces, c.walls, d)].length}`).join(' '));
}
for (const b in pool) pool[b] = shuffle(pool[b]);

// ---- assign stages world by world ----
const rhythm = [0, 0, 1, 0, -1, 0, 1, 0, 0, -1];
const tutorialDepths = [1, 1, 2, 2, 1, 2, 2, 3, 2, 3];

function pick(n, pieces, walls, desired, lo, hi) {
  // exact depth, then within [lo,hi] spiraling, then any depth for this combo
  const order = [desired];
  for (let off = 1; off <= 9; off++) { if (desired - off >= 1) order.push(desired - off); order.push(desired + off); }
  for (const d of order) { const b = bk(n, pieces, walls, d); if (pool[b] && pool[b].length) return pool[b].pop(); }
  return null;
}
function pickFallback(n, pieces, walls, desired) {
  // relax walls downward (keep board+pieces), then any wall for this board+pieces
  for (let w = walls; w >= 0; w--) { const p = pick(n, pieces, w, desired, 1, 9); if (p) return p; }
  for (let w = 0; w <= 4; w++) { const p = pick(n, pieces, w, desired, 1, 9); if (p) return p; }
  return null;
}

const known1 = [[0, 1, 1], [2, 1, 3]]; // stage 1 tutorial
const selected = [];
let shortfalls = 0;
for (let seq = 1; seq <= WORLDS.length * WORLD_SIZE; seq++) {
  const w = Math.floor((seq - 1) / WORLD_SIZE);
  const W = WORLDS[w];
  const localIdx = (seq - 1) % WORLD_SIZE;
  let desired;
  if (w === 0 && localIdx < 10) { desired = tutorialDepths[localIdx]; }
  else desired = Math.min(W.hi, Math.max(W.lo, W.base + rhythm[localIdx % 10]));

  let pickd;
  if (seq === 1) pickd = { n: 3, pieces: 2, walls: [], start: known1, targets: [[0, 0], [2, 2]], depth: 1, ways: 1 };
  else {
    pickd = pick(W.n, W.pieces, W.walls, desired, W.lo, W.hi);
    if (!pickd) { pickd = pickFallback(W.n, W.pieces, W.walls, desired); shortfalls++; }
  }
  assert(pickd, `no candidate for seq ${seq} world ${w + 1} ${W.n}x${W.n} ${W.pieces}p w${W.walls} d${desired}`);
  const prev = selected[selected.length - 1];
  const role = seq <= 2 ? 'tutorial' : prev && pickd.depth < prev.min ? 'recovery' : prev && pickd.depth > prev.min ? 'stretch' : 'practice';
  const stage = {
    id: 'SS-' + String(seq).padStart(4, '0'), seq, chapter: W.name, role,
    n: pickd.n, pieces: pickd.pieces, start: pickd.start, targets: pickd.targets,
    min: pickd.depth, ways: pickd.ways,
  };
  if (pickd.walls && pickd.walls.length) stage.walls = pickd.walls.map(x => x.slice());
  selected.push(stage);
}
if (shortfalls) console.log(`WARN: ${shortfalls} stages used a fallback (walls/depth relaxed)`);

// ---- validate every stage: exact shortest distance, replayable ----
function validate(s) {
  const wallSet = new Set((s.walls || []).map(w => w[0] + ',' + w[1]));
  const g = explore(s.start, s.n, STATE_CAP * 3, wallSet);
  assert(g, `explore aborted validating ${s.id}`);
  const target = s.targets.map(t => t.join(',')).join(';');
  const goal = g.goals.get(target);
  assert(goal, `target unreachable ${s.id}`);
  assert.equal(goal.distance, s.min, `min mismatch ${s.id}: ${goal.distance} vs ${s.min}`);
  // backtrack a shortest path and replay it
  const sol = []; let node = goal.node;
  while (node) { const [pn, a] = g.parent[node]; sol.unshift(g.pairs[a]); node = pn; }
  let state = clone(s.start);
  for (const [idx, pair] of sol.entries()) {
    state = outcome(state, pair, s.n, wallSet);
    const atGoal = state.every((p, i) => p[0] === s.targets[i][0] && p[1] === s.targets[i][1]);
    assert.equal(atGoal, idx === s.min - 1, `goal timing ${s.id}`);
  }
}
for (const s of selected) validate(s);

// ---- reports + write web/stages-data.js ----
const perWorld = WORLDS.map((W, w) => {
  const slice = selected.slice(w * WORLD_SIZE, (w + 1) * WORLD_SIZE);
  const mins = slice.map(s => s.min);
  const wallStages = slice.filter(s => s.walls).length;
  return { world: w + 1, board: `${W.n}x${W.n}`, pieces: W.pieces, walls: W.walls, chapter: W.name, minRange: [Math.min(...mins), Math.max(...mins)], avgMin: +(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(2), wallStages };
});
const depthHist = {}; for (const s of selected) depthHist[s.min] = (depthHist[s.min] || 0) + 1;
const report = {
  created: new Date().toISOString().slice(0, 10), rules_version: RULES, seed: 20260922,
  worlds: WORLDS.length, world_size: WORLD_SIZE, delivered: selected.length, unique_pool: seenAll.size,
  fallbacks: shortfalls, minimum_moves_histogram: depthHist, per_world: perWorld,
};
fs.writeFileSync(path.join(ROOT, 'validation-report-35.json'), JSON.stringify(report, null, 2) + '\n');

const data = { rules: RULES, dir: { 0: 'right', 1: 'down', 2: 'left', 3: 'up' }, stages: selected };
fs.writeFileSync(path.join(ROOT, 'web', 'stages-data.js'), 'window.BM_DATA=' + JSON.stringify(data) + ';\n');
console.log(JSON.stringify({ delivered: report.delivered, worlds: report.worlds, fallbacks: report.fallbacks, unique_pool: report.unique_pool, depthHist }, null, 1));
console.log('per-world avgMin:', perWorld.map(p => p.avgMin).join(' '));

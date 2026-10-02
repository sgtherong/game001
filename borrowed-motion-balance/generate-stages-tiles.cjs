// Run: node generate-stages-tiles.cjs gen <world>   (월드 하나 생성 → tiles-out/w<world>.json, 여러 개를 동시에 돌려도 됨)
//      node generate-stages-tiles.cjs merge         (tiles-out/*.json을 web/stages-data.js에 넣고 1050판 전체 검증)
// 후반 월드 일부를 '방향 칸'·'회전 칸' 스테이지로 바꾼다(나머지 월드는 web/stages-data.js 그대로 유지).
// 기존 플레이어의 앞쪽 진행(월드 1~17)은 손대지 않는다. 규칙은 rules.cjs 한 곳(게임 game.js와 동일한지 검사함).
// 칸 종류: 0~3 = 방향 칸(들어선 조각이 그 방향을 봄), 4 = 회전 칸(시계 방향 90°). 칸은 막지 않는다.
// 품질 조건: 칸을 지우면 최소 이동 수가 달라지거나 풀 수 없게 되는 판만 채택 = 칸이 실제로 풀이에 쓰인다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { outcome, TILE_TURN } = require('./rules.cjs');
const ROOT = __dirname;
const DATA = path.join(ROOT, 'web', 'stages-data.js');
const WORLD_SIZE = 30;
const STATE_CAP = 7000;

let seed = 20261002;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clone = s => s.map(p => p.slice());
const key = s => s.flat().join(',');
const poskey = s => s.map(p => p.slice(0, 2).join(',')).join(';');
function pairsFor(n) { const o = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) o.push([a, b]); return o; }
const setOf = cells => new Set((cells || []).map(c => c[0] + ',' + c[1]));
const mapOf = tiles => new Map((tiles || []).map(c => [c[0] + ',' + c[1], c[2]]));

function explore(start, n, cap, walls, tiles) {
  const pairs = pairsFor(start.length);
  const states = [start], index = new Map([[key(start), 0]]), distance = [0], ways = [1], parent = [null], goals = new Map();
  for (let i = 0; i < states.length; i++) {
    if (states.length > cap) return null;
    const s = states[i], pk = poskey(s), d = distance[i];
    if (!goals.has(pk)) goals.set(pk, { positions: s.map(p => p.slice(0, 2)), distance: d, ways: 0, node: i });
    const g = goals.get(pk); if (d === g.distance) g.ways += ways[i];
    for (let a = 0; a < pairs.length; a++) {
      const t = outcome(s, pairs[a], n, walls, tiles), k = key(t); let j = index.get(k);
      if (j === undefined) { j = states.length; index.set(k, j); states.push(t); distance.push(d + 1); ways.push(ways[i]); parent.push([i, a]); }
      else if (distance[j] === d + 1) ways[j] += ways[i];
    }
  }
  return { states, goals, parent, pairs, total: states.length };
}

// 바꿀 월드(1부터). dir = 방향 칸 수, turn = 회전 칸 수. 새 요소가 처음 나오면 난이도를 살짝 낮췄다가 다시 올린다.
const NEW_WORLDS = [
  { w: 18, n: 4, pieces: 3, walls: 0, dir: 1, turn: 0, base: 4, lo: 3, hi: 5, name: '방향 칸' },
  { w: 19, n: 4, pieces: 3, walls: 1, dir: 1, turn: 0, base: 5, lo: 4, hi: 6, name: '방향 칸' },
  { w: 20, n: 4, pieces: 3, walls: 1, dir: 2, turn: 0, base: 6, lo: 5, hi: 7, name: '방향 칸' },
  { w: 27, n: 4, pieces: 4, walls: 0, dir: 0, turn: 1, base: 4, lo: 3, hi: 5, name: '회전 칸' },
  { w: 28, n: 4, pieces: 4, walls: 1, dir: 0, turn: 1, base: 5, lo: 4, hi: 6, name: '회전 칸' },
  { w: 29, n: 4, pieces: 4, walls: 1, dir: 0, turn: 2, base: 6, lo: 5, hi: 7, name: '회전 칸' },
  { w: 32, n: 4, pieces: 4, walls: 1, dir: 1, turn: 1, base: 5, lo: 4, hi: 7, name: '칸 섞기' },
  { w: 33, n: 4, pieces: 4, walls: 2, dir: 1, turn: 1, base: 6, lo: 5, hi: 8, name: '칸 섞기' },
  { w: 34, n: 4, pieces: 4, walls: 2, dir: 2, turn: 1, base: 7, lo: 6, hi: 9, name: '칸 섞기' },
  { w: 35, n: 4, pieces: 4, walls: 2, dir: 1, turn: 2, base: 8, lo: 7, hi: 9, name: '칸 섞기' },
];
const rhythm = [0, 0, 1, 0, -1, 0, 1, 0, 0, -1];

// ---- 기존 데이터 읽기 ----
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(DATA, 'utf8'), sandbox);
const data = sandbox.window.BM_DATA;
const stages = data.stages;
assert.equal(stages.length, 35 * WORLD_SIZE);
// 바꿀 월드의 기존 판은 중복 검사에서 뺀다(다시 돌려도 같은 결과가 나오게)
const replaced = new Set(NEW_WORLDS.map(W => W.w - 1));
const seen = new Set(stages.filter((s, i) => !replaced.has(Math.floor(i / WORLD_SIZE))).map(s => sig(s.n, s.start, s.targets, s.walls, s.tiles)));
function sig(n, start, targets, walls, tiles) {
  return n + '|' + start.map((p, i) => p.join(',') + '>' + targets[i].join(',')).join(';') + '|' +
    (walls || []).map(c => c.join(',')).sort().join(';') + '|' + (tiles || []).map(c => c.join(',')).sort().join(';');
}

function randomLayout(W) {
  const cells = shuffle(Array.from({ length: W.n * W.n }, (_, i) => [i % W.n, Math.floor(i / W.n)]));
  let k = 0;
  const walls = cells.slice(k, k += W.walls);
  const tiles = [];
  for (let i = 0; i < W.dir; i++) { const c = cells[k++]; tiles.push([c[0], c[1], Math.floor(random() * 4)]); }
  for (let i = 0; i < W.turn; i++) { const c = cells[k++]; tiles.push([c[0], c[1], TILE_TURN]); }
  const start = cells.slice(k, k + W.pieces).map(c => [c[0], c[1], Math.floor(random() * 4)]);
  return { walls, tiles, start };
}

// 칸 종류마다 '그 종류를 지우면 풀이가 달라지는지' — 섞인 월드에서도 두 종류 모두 쓰이게
function tilesMatter(start, n, walls, tiles, posKey, d) {
  // 한 종류만 있는 월드: 그 칸을 빼면 달라져야 함. 섞인 월드: 칸을 모두 빼면 달라져야 함(종류별로 따지면 너무 드묾)
  const kinds0 = [...new Set(tiles.map(t => (t[2] === TILE_TURN ? 'turn' : 'dir')))];
  const kinds = kinds0.length > 1 ? ['all'] : kinds0;
  for (const kind of kinds) {
    const rest = kind === 'all' ? [] : tiles.filter(t => (t[2] === TILE_TURN ? 'turn' : 'dir') !== kind);
    const g = explore(start, n, STATE_CAP, walls, mapOf(rest));
    if (!g) return false; // 판단 불가 → 채택 안 함
    const goal = g.goals.get(posKey);
    if (goal && goal.distance === d) return false; // 그 종류 없이도 같은 수로 풀림 = 장식
  }
  return true;
}

const MODE = process.argv[2], OUT = path.join(ROOT, 'tiles-out');
if (MODE === 'gen') {
  const W = NEW_WORLDS.find(x => x.w === Number(process.argv[3]));
  assert(W, 'usage: gen <world> — one of ' + NEW_WORLDS.map(x => x.w).join(','));
  seed = 20261002 + W.w * 7919; // 월드마다 고정 시드 → 다시 돌려도 같은 결과
  const want = []; // 이 월드 30판의 목표 최소 이동 수
  for (let i = 0; i < WORLD_SIZE; i++) {
    let d = Math.min(W.hi, Math.max(W.lo, W.base + rhythm[i % 10]));
    if (i < 3) d = W.lo; // 새 요소 첫 판들은 쉽게
    want.push(d);
  }
  const need = {}; want.forEach(d => { need[d] = (need[d] || 0) + 1; });
  const pool = {}; for (const d in need) pool[d] = [];
  const t0 = Date.now(); let runs = 0;
  const done = () => Object.keys(need).every(d => pool[d].length >= need[d]);
  while (!done() && runs < 400000) {
    runs++;
    const L = randomLayout(W);
    const wallSet = setOf(L.walls), tileMap = mapOf(L.tiles);
    const g = explore(L.start, W.n, STATE_CAP, wallSet, tileMap);
    if (!g) continue;
    for (const goal of g.goals.values()) {
      const d = goal.distance;
      if (!pool[d] || pool[d].length >= need[d]) continue;
      if (W.pieces >= 3 && d > 1 && goal.ways < 2) continue; // 외길 퍼즐 제외
      const pk = goal.positions.map(p => p.join(',')).join(';');
      if (!tilesMatter(L.start, W.n, wallSet, L.tiles, pk, d)) continue;
      const sg = sig(W.n, L.start, goal.positions, L.walls, L.tiles);
      if (seen.has(sg)) continue;
      seen.add(sg);
      pool[d].push({ start: clone(L.start), targets: goal.positions.map(p => p.slice()), walls: L.walls.map(c => c.slice()), tiles: L.tiles.map(c => c.slice()), min: d, ways: goal.ways });
      break; // 한 배치에서 한 판만 — 비슷한 판이 몰리지 않게
    }
  }
  assert(done(), `world ${W.w}: not enough candidates after ${runs} runs ` + JSON.stringify(Object.fromEntries(Object.keys(need).map(d => [d, pool[d].length + '/' + need[d]]))));
  console.log(`world ${W.w} ${W.name}: runs=${runs} ms=${Date.now() - t0}`);
  const picked = want.map(d => pool[d].pop());
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `w${W.w}.json`), JSON.stringify(picked));
  process.exit(0);
}
assert.equal(MODE, 'merge', 'usage: gen <world> | merge');
for (const W of NEW_WORLDS) {
  const picked = JSON.parse(fs.readFileSync(path.join(OUT, `w${W.w}.json`), 'utf8'));
  for (let i = 0; i < WORLD_SIZE; i++) {
    const seq = (W.w - 1) * WORLD_SIZE + i + 1;
    const p = picked[i];
    const sg = sig(W.n, p.start, p.targets, p.walls, p.tiles);
    assert(!seen.has(sg), `duplicate stage across worlds (world ${W.w} #${i + 1})`); seen.add(sg);
    const prev = stages[seq - 2];
    const st = {
      id: 'SS-' + String(seq).padStart(4, '0'), seq, chapter: W.name,
      role: prev && p.min < prev.min ? 'recovery' : prev && p.min > prev.min ? 'stretch' : 'practice',
      n: W.n, pieces: W.pieces, start: p.start, targets: p.targets, min: p.min, ways: p.ways,
    };
    if (p.walls.length) st.walls = p.walls;
    st.tiles = p.tiles;
    stages[seq - 1] = st;
  }
}

// ---- 게임(game.js)의 규칙이 rules.cjs와 똑같은지: game.js에서 규칙 부분만 떼어 비교 ----
const gsrc = fs.readFileSync(path.join(ROOT, 'web', 'game.js'), 'utf8');
const gpart = gsrc.slice(gsrc.indexOf('const VECTORS'), gsrc.indexOf('function pairsFor'));
const gctx = {}; vm.runInNewContext(gpart + '\nthis.outcome = outcome;', gctx);
// ---- 전체 1050판 검증: 최소 이동 수 정확 + 풀이 재생 + 게임 규칙과 일치 ----
for (const s of stages) {
  const walls = setOf(s.walls), tiles = mapOf(s.tiles);
  const g = explore(s.start, s.n, STATE_CAP * 3, walls, tiles);
  assert(g, `explore aborted validating ${s.id}`);
  const goal = g.goals.get(s.targets.map(t => t.join(',')).join(';'));
  assert(goal, `target unreachable ${s.id}`);
  assert.equal(goal.distance, s.min, `min mismatch ${s.id}`);
  const sol = []; let node = goal.node;
  while (node) { const [pn, a] = g.parent[node]; sol.unshift(g.pairs[a]); node = pn; }
  let st = clone(s.start), gst = clone(s.start);
  for (const [i, pair] of sol.entries()) {
    st = outcome(st, pair, s.n, walls, tiles);
    gst = gctx.outcome(gst, pair, s.n, walls, tiles);
    assert.equal(key(st), key(gst), `game.js rule differs ${s.id}`);
    assert.equal(st.every((p, k) => p[0] === s.targets[k][0] && p[1] === s.targets[k][1]), i === s.min - 1, `goal timing ${s.id}`);
  }
  // 시작 칸이 벽·칸 위에 있으면 안 된다
  for (const p of s.start) assert(!walls.has(p[0] + ',' + p[1]) && !tiles.has(p[0] + ',' + p[1]), `piece starts on wall/tile ${s.id}`);
}

data.rules = 'borrowed-motion-easy-v2-tiles';
fs.writeFileSync(DATA, 'window.BM_DATA=' + JSON.stringify(data) + ';\n');
const perWorld = [];
for (let w = 0; w < 35; w++) {
  const sl = stages.slice(w * WORLD_SIZE, (w + 1) * WORLD_SIZE), m = sl.map(s => s.min);
  perWorld.push({ world: w + 1, chapter: sl[0].chapter, avgMin: +(m.reduce((a, b) => a + b, 0) / m.length).toFixed(2), tileStages: sl.filter(s => s.tiles).length, wallStages: sl.filter(s => s.walls).length });
}
fs.writeFileSync(path.join(ROOT, 'validation-report-tiles.json'), JSON.stringify({ created: new Date().toISOString().slice(0, 10), seed: 20261002, rules: data.rules, delivered: stages.length, per_world: perWorld }, null, 2) + '\n');
console.log('validated', stages.length, 'stages; tile stages:', stages.filter(s => s.tiles).length);
console.log(perWorld.map(p => `${p.world}:${p.avgMin}${p.tileStages ? '*' : ''}`).join(' '));

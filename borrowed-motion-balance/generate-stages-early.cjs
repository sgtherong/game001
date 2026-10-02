// Run: node generate-stages-early.cjs gen <world>   (월드 하나 생성 → early-out/w<world>.json, 여러 개 동시에 가능)
//      node generate-stages-early.cjs merge         (early-out/*.json을 web/stages-data.js에 넣고 1050판 전체 검증)
// 앞쪽 월드 1~17과 그 뒤 칸 없는 월드(21~26, 30~31)를 새 난이도 곡선으로 다시 만든다(새 칸 월드는 그대로).
// 2026-10-02 측정: 예전 월드 1은 조각 2개라 고를 쌍이 하나뿐 → 30판 모두 무작위로 눌러도 100% 풀림,
// 1~300판이 전부 3×3이라 비슷한 판이 길게 이어졌다. 그래서:
//  - 조각 2개는 처음 3판(규칙 익히기)만, 벽은 월드 3, 4×4는 월드 5, 조각 4개는 월드 10에 등장
//  - 무작위로 눌러도 쉽게 풀리는 판 제외(3수 이상인데 이동 예산 안에 30% 넘게 풀리면 버림)
//  - 같은 월드 안에서 '풀이 모양'(조각별 시작→목표 상대 위치+방향)이 겹치는 판 제외
//  - 월드마다 다른 리듬(10판 단위 오르내림을 월드별로 섞음) + 월드 안에서 점점 어렵게
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { outcome } = require('./rules.cjs');
const ROOT = __dirname;
const DATA = path.join(ROOT, 'web', 'stages-data.js');
const OUT = path.join(ROOT, 'early-out');
const WORLD_SIZE = 30;
const STATE_CAP = 7000;
const VECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

let seed = 1;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clone = s => s.map(p => p.slice());
const key = s => s.flat().join(',');
const poskey = s => s.map(p => p.slice(0, 2).join(',')).join(';');
function pairsFor(n) { const o = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) o.push([a, b]); return o; }
const setOf = cells => new Set((cells || []).map(c => c[0] + ',' + c[1]));
const mapOf = tiles => new Map((tiles || []).map(c => [c[0] + ',' + c[1], c[2]]));
const budgetFor = m => m + Math.max(2, Math.ceil(m * 0.5)); // game.js와 같은 이동 예산

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

// 무작위로 쌍을 골라 눌렀을 때 이동 예산 안에 풀리는 비율(별도 난수열 — 생성 시드에 영향 없음)
function randomSolveRate(start, targets, n, walls, min, trials = 240) {
  let rs = 12345; const r = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  const P = pairsFor(start.length), B = budgetFor(min); let ok = 0;
  for (let k = 0; k < trials; k++) {
    let st = clone(start);
    for (let m = 0; m < B; m++) {
      st = outcome(st, P[Math.floor(r() * P.length)], n, walls);
      if (st.every((p, i) => p[0] === targets[i][0] && p[1] === targets[i][1])) { ok++; break; }
    }
  }
  return ok / trials;
}

// 보드 8대칭(회전·뒤집기) + 벽까지 같은 판은 하나로
function canonical(start, targets, n, walls) {
  const variants = [];
  for (let reflect = 0; reflect < 2; reflect++) for (let rotate = 0; rotate < 4; rotate++) {
    const tf = (x, y) => { let X = x, Y = y; if (reflect) X = n - 1 - X; for (let k = 0; k < rotate; k++) [X, Y] = [n - 1 - Y, X]; return [X, Y]; };
    const rows = start.map((p, i) => {
      let [x, y, d] = p, [gx, gy] = targets[i], [dx, dy] = VECTORS[d];
      if (reflect) { x = n - 1 - x; gx = n - 1 - gx; dx = -dx; }
      for (let k = 0; k < rotate; k++) { [x, y] = [n - 1 - y, x]; [gx, gy] = [n - 1 - gy, gx]; [dx, dy] = [-dy, dx]; }
      return [x, y, VECTORS.findIndex(v => v[0] === dx && v[1] === dy), gx, gy].join(',');
    }).sort();
    variants.push(n + '|' + rows.join(';') + '|' + (walls || []).map(w => tf(w[0], w[1]).join(',')).sort().join(';'));
  }
  return variants.sort()[0];
}
// 풀이 모양: 조각마다 (목표-시작) 상대 위치 + 시작 방향. 위치·번호만 다른 '같은 느낌' 판을 거른다
const patternKey = (start, targets) => start.map((p, i) => [targets[i][0] - p[0], targets[i][1] - p[1], p[2]].join(',')).sort().join(';');

// ---- 새 곡선 (월드 1~17). name은 게임의 단원 이름 키(CHAPTER_KEY)와 같은 한국어 ----
const WORLDS = [
  { w: 1, n: 3, pieces: 3, walls: 0, lo: 2, hi: 4, name: '규칙 익히기' },   // 1~3판만 조각 2개(튜토리얼)
  { w: 2, n: 3, pieces: 3, walls: 0, lo: 3, hi: 5, name: '편안한 반복' },
  { w: 3, n: 3, pieces: 3, walls: 1, lo: 3, hi: 5, name: '순서 계획' },     // 벽 등장
  { w: 4, n: 3, pieces: 3, walls: 1, lo: 4, hi: 6, name: '순서 계획' },
  { w: 5, n: 4, pieces: 3, walls: 0, lo: 3, hi: 5, name: '넓은 보드 적응' }, // 4×4 등장
  { w: 6, n: 4, pieces: 3, walls: 0, lo: 4, hi: 6, name: '넓은 보드 적응' },
  { w: 7, n: 4, pieces: 3, walls: 1, lo: 4, hi: 6, name: '4×4 계획' },
  { w: 8, n: 4, pieces: 3, walls: 1, lo: 5, hi: 7, name: '4×4 계획' },
  { w: 9, n: 4, pieces: 3, walls: 2, lo: 5, hi: 7, name: '4×4 계획' },
  { w: 10, n: 4, pieces: 4, walls: 0, lo: 3, hi: 5, name: '네 조각 입문' },  // 조각 4개 등장
  { w: 11, n: 4, pieces: 4, walls: 0, lo: 4, hi: 6, name: '네 조각 입문' },
  { w: 12, n: 3, pieces: 3, walls: 2, lo: 5, hi: 6, name: '순서 계획' },     // 작은 판 고난도(분위기 전환)
  { w: 13, n: 4, pieces: 4, walls: 1, lo: 4, hi: 6, name: '네 조각 계획' },
  { w: 14, n: 4, pieces: 4, walls: 1, lo: 5, hi: 7, name: '네 조각 계획' },
  { w: 15, n: 4, pieces: 3, walls: 2, lo: 6, hi: 8, name: '4×4 계획' },
  { w: 16, n: 4, pieces: 4, walls: 2, lo: 5, hi: 7, name: '네 조각 계획' },
  { w: 17, n: 4, pieces: 4, walls: 1, lo: 6, hi: 8, name: '네 조각 계획' },
  // 월드 18 이후 새 칸 월드 사이에 끼어 있던 예전 월드(21~26, 30~31)도 이 곡선에 맞춘다(예전엔 21에서 평균 3수로 뚝 떨어졌음)
  { w: 21, n: 4, pieces: 4, walls: 1, lo: 5, hi: 7, name: '네 조각 계획' },
  { w: 22, n: 4, pieces: 4, walls: 2, lo: 5, hi: 7, name: '네 조각 계획' },
  { w: 23, n: 4, pieces: 3, walls: 3, lo: 6, hi: 8, name: '4×4 계획' },
  { w: 24, n: 4, pieces: 4, walls: 1, lo: 6, hi: 8, name: '네 조각 계획' },
  { w: 25, n: 4, pieces: 4, walls: 2, lo: 6, hi: 8, name: '네 조각 계획' },
  { w: 26, n: 4, pieces: 4, walls: 2, lo: 6, hi: 9, name: '긴 여정' },
  { w: 30, n: 4, pieces: 4, walls: 3, lo: 6, hi: 9, name: '긴 여정' },
  { w: 31, n: 4, pieces: 4, walls: 3, lo: 7, hi: 9, name: '긴 여정' },
];
const TUTORIAL = [ // 월드 1의 1~3판: 조각 2개로 규칙만 익힌다(1판은 손가락 코치가 쓰는 고정 판)
  { start: [[0, 1, 1], [2, 1, 3]], targets: [[0, 0], [2, 2]], min: 1, ways: 1 },
];
const MAX_RANDOM = d => (d <= 2 ? 0.5 : 0.3);

// 월드 안 30판의 목표 최소 수: 앞 2판은 쉬운 몸풀기, 이후 lo→hi로 점점, 월드마다 다르게 섞인 리듬
function depthPlan(W) {
  const base = [-1, 0, 0, 1, 0, -1, 1, 0, 0, 1];
  const plan = [];
  for (let blk = 0; blk < 3; blk++) {
    const r = shuffle(base);
    for (let k = 0; k < 10; k++) {
      const i = blk * 10 + k, ramp = W.lo + (W.hi - W.lo) * (i / 29);
      const warm = W.w === 1 ? 6 : 2; // 월드 1은 튜토리얼(1~3판) 뒤 4~6판도 쉬운 2수로 이어 준다
      plan.push(i < warm ? W.lo : Math.max(W.lo, Math.min(W.hi, Math.round(ramp + r[k] * 0.6))));
    }
  }
  return plan;
}

function randomLayout(n, pieces, wallCount) {
  const cells = shuffle(Array.from({ length: n * n }, (_, i) => [i % n, Math.floor(i / n)]));
  const walls = cells.slice(0, wallCount);
  const start = cells.slice(wallCount, wallCount + pieces).map(c => [c[0], c[1], Math.floor(random() * 4)]);
  return { start, walls, wallSet: setOf(walls) };
}

// 조건에 맞는 판을 depth별 필요 개수만큼 모은다
function collect(n, pieces, wallCount, need, seenCanon, seenPattern, opts = {}) {
  const pool = {}; for (const d in need) pool[d] = [];
  const done = () => Object.keys(need).every(d => pool[d].length >= need[d]);
  let runs = 0;
  while (!done() && runs < 300000) {
    runs++;
    const L = randomLayout(n, pieces, wallCount);
    const g = explore(L.start, n, STATE_CAP, L.wallSet);
    if (!g) continue;
    for (const goal of shuffle([...g.goals.values()])) {
      const d = goal.distance;
      if (!pool[d] || pool[d].length >= need[d]) continue;
      if (pieces >= 3 && d > 1 && goal.ways < 2) continue; // 외길 퍼즐 제외
      if (!opts.allowEasy && randomSolveRate(L.start, goal.positions, n, L.wallSet, d) > MAX_RANDOM(d)) continue;
      const cc = canonical(L.start, goal.positions, n, L.walls);
      if (seenCanon.has(cc)) continue;
      const pk = patternKey(L.start, goal.positions) + '|' + wallCount;
      if (seenPattern.has(pk)) continue;
      seenCanon.add(cc); seenPattern.add(pk);
      pool[d].push({ start: clone(L.start), targets: goal.positions.map(p => p.slice()), walls: L.walls.map(c => c.slice()), min: d, ways: goal.ways });
      break; // 한 배치에서 한 판만
    }
  }
  assert(done(), `not enough candidates (${n}x${n} ${pieces}p w${wallCount}) after ${runs} runs: ` + JSON.stringify(Object.fromEntries(Object.keys(need).map(d => [d, pool[d].length + '/' + need[d]]))));
  return { pool, runs };
}

// ---- 기존 데이터 ----
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(DATA, 'utf8'), sandbox);
const data = sandbox.window.BM_DATA;
const stages = data.stages;
assert.equal(stages.length, 35 * WORLD_SIZE);
const remade = new Set(WORLDS.map(W => W.w - 1)); // 다시 만드는 월드(0부터)
const keptCanon = new Set(stages.filter((s, i) => !remade.has(Math.floor(i / WORLD_SIZE)) && !s.tiles).map(s => canonical(s.start, s.targets, s.n, s.walls)));

const MODE = process.argv[2];
if (MODE === 'gen') {
  const W = WORLDS.find(x => x.w === Number(process.argv[3]));
  assert(W, 'usage: gen <world> — one of ' + WORLDS.map(x => x.w).join(','));
  seed = 20261003 + W.w * 104729;
  const t0 = Date.now();
  const plan = depthPlan(W);
  const seenCanon = new Set(keptCanon), seenPattern = new Set();
  const picked = new Array(WORLD_SIZE);
  let first = 0;
  if (W.w === 1) {
    // 1판 고정, 2~3판은 조각 2개(1수·2수)
    picked[0] = TUTORIAL[0]; seenCanon.add(canonical(TUTORIAL[0].start, TUTORIAL[0].targets, 3, []));
    const two = collect(3, 2, 0, { 1: 1, 2: 1 }, seenCanon, seenPattern, { allowEasy: true }).pool;
    picked[1] = two[1].pop(); picked[2] = two[2].pop();
    first = 3;
  }
  const need = {}; for (let i = first; i < WORLD_SIZE; i++) need[plan[i]] = (need[plan[i]] || 0) + 1;
  const { pool, runs } = collect(W.n, W.pieces, W.walls, need, seenCanon, seenPattern);
  for (let i = first; i < WORLD_SIZE; i++) picked[i] = pool[plan[i]].pop();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `w${W.w}.json`), JSON.stringify(picked));
  console.log(`world ${W.w}: runs=${runs} ms=${Date.now() - t0} mins=${picked.map(p => p.min).join('')}`);
  process.exit(0);
}

assert.equal(MODE, 'merge', 'usage: gen <world> | merge');
const allCanon = new Set(keptCanon);
for (const W of WORLDS) {
  const picked = JSON.parse(fs.readFileSync(path.join(OUT, `w${W.w}.json`), 'utf8'));
  assert.equal(picked.length, WORLD_SIZE);
  picked.forEach((p, i) => {
    const seq = (W.w - 1) * WORLD_SIZE + i + 1, n = W.w === 1 && i < 3 ? 3 : W.n;
    const cc = canonical(p.start, p.targets, n, p.walls);
    assert(!allCanon.has(cc), `duplicate stage across worlds (world ${W.w} #${i + 1})`); allCanon.add(cc);
    const prev = stages[seq - 2];
    const st = {
      id: 'SS-' + String(seq).padStart(4, '0'), seq, chapter: W.name,
      role: seq <= 3 ? 'tutorial' : prev && p.min < prev.min ? 'recovery' : prev && p.min > prev.min ? 'stretch' : 'practice',
      n, pieces: p.start.length, start: p.start, targets: p.targets, min: p.min, ways: p.ways,
    };
    if (p.walls && p.walls.length) st.walls = p.walls;
    stages[seq - 1] = st;
  });
}

// ---- 전체 검증: 최소 수 정확 + 풀이 재생 + game.js 규칙과 일치 ----
const gsrc = fs.readFileSync(path.join(ROOT, 'web', 'game.js'), 'utf8');
const gctx = {}; vm.runInNewContext(gsrc.slice(gsrc.indexOf('const VECTORS'), gsrc.indexOf('function pairsFor')) + '\nthis.outcome = outcome;', gctx);
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
    st = outcome(st, pair, s.n, walls, tiles); gst = gctx.outcome(gst, pair, s.n, walls, tiles);
    assert.equal(key(st), key(gst), `game.js rule differs ${s.id}`);
    assert.equal(st.every((p, k) => p[0] === s.targets[k][0] && p[1] === s.targets[k][1]), i === s.min - 1, `goal timing ${s.id}`);
  }
}
fs.writeFileSync(DATA, 'window.BM_DATA=' + JSON.stringify(data) + ';\n');
const per = [];
for (let w = 0; w < 35; w++) {
  const sl = stages.slice(w * WORLD_SIZE, (w + 1) * WORLD_SIZE);
  per.push({ world: w + 1, chapter: sl[0].chapter, board: sl[3].n, pieces: sl[3].pieces, avgMin: +(sl.reduce((a, s) => a + s.min, 0) / 30).toFixed(2),
    avgRandom: +(sl.reduce((a, s) => a + (s.tiles ? 0 : randomSolveRate(s.start, s.targets, s.n, setOf(s.walls), s.min, 120)), 0) / 30).toFixed(2) });
}
fs.writeFileSync(path.join(ROOT, 'validation-report-early.json'), JSON.stringify({ created: new Date().toISOString().slice(0, 10), delivered: stages.length, per_world: per }, null, 2) + '\n');
console.log('validated', stages.length);
console.log(per.map(p => `${p.world}:${p.board}x${p.pieces}p m${p.avgMin} r${Math.round(p.avgRandom * 100)}%`).join('\n'));

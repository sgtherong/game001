// Run: node generate-stages-more.cjs gen <world>   (새 월드 하나 생성 → more-out/w<world>.json, 여러 개 동시에 가능)
//      node generate-stages-more.cjs merge         (more-out/*.json을 web/stages-data.js에 넣고 3000판 전체 검증)
// 여행지를 35곳 → 100곳으로 늘린다(2026-10-06). 월드 1~34는 그대로, 새 여행지 65곳(월드 35~99)을 그 뒤에 넣고
// 마지막 월드 100은 우주 — 예전 우주(SS-1021~1050)보다 어려운 새 판(SS-3001~3030, 아래 SPACE)으로 바꿨다.
// 새 여행지 판의 id는 SS-1051부터. seq(게임 칸에 보이는 번호)는 전체 순서로 다시 매긴다.
// 품질 조건은 generate-stages-early.cjs·generate-stages-tiles.cjs와 같다:
//  외길 퍼즐 제외, 무작위로 눌러도 쉽게 풀리는 판 제외, 칸이 있으면 칸 없이 같은 수로 풀리는 판 제외(칸이 실제로 쓰임),
//  보드 8대칭(칸 방향까지)으로 같은 판 제외(전체 3000판), 같은 월드 안 '풀이 모양' 중복 제외.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { outcome, TILE_TURN } = require('./rules.cjs');
const ROOT = __dirname;
const DATA = path.join(ROOT, 'web', 'stages-data.js');
const OUT = path.join(ROOT, 'more-out');
const WORLD_SIZE = 30;
const STATE_CAP = 7000;
const KEEP = 34;           // 그대로 두는 앞쪽 월드 수
const TOTAL_WORLDS = 100;  // 마지막은 우주
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

// 무작위로 쌍을 골라 눌렀을 때 이동 예산 안에 풀리는 비율(칸 포함, 별도 난수열)
function randomSolveRate(start, targets, n, walls, tiles, min, trials = 200) {
  let rs = 12345; const r = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  const P = pairsFor(start.length), B = budgetFor(min); let ok = 0;
  for (let k = 0; k < trials; k++) {
    let st = clone(start);
    for (let m = 0; m < B; m++) {
      st = outcome(st, P[Math.floor(r() * P.length)], n, walls, tiles);
      if (st.every((p, i) => p[0] === targets[i][0] && p[1] === targets[i][1])) { ok++; break; }
    }
  }
  return ok / trials;
}

// 보드 8대칭(회전·뒤집기)으로 같은 판은 하나로 — 벽·칸(방향 칸은 방향도 함께 돌린다)까지
function canonical(s) {
  const n = s.n, variants = [];
  const dirOf = (d, reflect, rotate) => {
    let [dx, dy] = VECTORS[d];
    if (reflect) dx = -dx;
    for (let k = 0; k < rotate; k++) [dx, dy] = [-dy, dx];
    return VECTORS.findIndex(v => v[0] === dx && v[1] === dy);
  };
  for (let reflect = 0; reflect < 2; reflect++) for (let rotate = 0; rotate < 4; rotate++) {
    const tf = (x, y) => { let X = x, Y = y; if (reflect) X = n - 1 - X; for (let k = 0; k < rotate; k++) [X, Y] = [n - 1 - Y, X]; return [X, Y]; };
    const rows = s.start.map((p, i) => [...tf(p[0], p[1]), dirOf(p[2], reflect, rotate), ...tf(s.targets[i][0], s.targets[i][1])].join(',')).sort();
    const walls = (s.walls || []).map(w => tf(w[0], w[1]).join(',')).sort();
    const tiles = (s.tiles || []).map(c => [...tf(c[0], c[1]), c[2] === TILE_TURN ? TILE_TURN : dirOf(c[2], reflect, rotate)].join(',')).sort();
    variants.push(n + '|' + rows.join(';') + '|' + walls.join(';') + '|' + tiles.join(';'));
  }
  return variants.sort()[0];
}
const patternKey = (start, targets) => start.map((p, i) => [targets[i][0] - p[0], targets[i][1] - p[1], p[2]].join(',')).sort().join(';');

// 칸이 장식이 아닌지: 한 종류만 있으면 그 칸을 빼고, 섞여 있으면 모두 빼고 다시 풀어 본다
function tilesMatter(start, n, walls, tiles, posKey, d) {
  const kinds0 = [...new Set(tiles.map(t => (t[2] === TILE_TURN ? 'turn' : 'dir')))];
  const kinds = kinds0.length > 1 ? ['all'] : kinds0;
  for (const kind of kinds) {
    const rest = kind === 'all' ? [] : tiles.filter(t => (t[2] === TILE_TURN ? 'turn' : 'dir') !== kind);
    const g = explore(start, n, STATE_CAP, walls, mapOf(rest));
    if (!g) return false;
    const goal = g.goals.get(posKey);
    if (goal && goal.distance === d) return false;
  }
  return true;
}

// ---- 새 월드 65곳의 난이도 ----
// 다섯 가지 느낌을 돌아가며: 벽 판 / 방향 칸 / 회전 칸 / 조각 3개 깊은 판 / 칸 섞기.
// 바퀴(5월드)마다 기본 난이도가 조금씩 오르고, 바퀴 첫 월드는 한숨 돌리게 살짝 낮춘다. 최대는 9수(우주와 같은 천장).
const KINDS = [
  k => ({ pieces: 4, walls: 2 + (k % 2), dir: 0, turn: 0, name: '긴 여정' }),
  k => ({ pieces: 4, walls: 1 + (k % 2), dir: 2 + (k >= 6 ? 1 : 0), turn: 0, name: '방향 칸' }),
  k => ({ pieces: 4, walls: 1 + (k % 2), dir: 0, turn: 2, name: '회전 칸' }),
  k => ({ pieces: 3, walls: 3 + (k >= 6 ? 1 : 0), dir: k % 2, turn: 0, name: '4×4 계획' }),
  k => ({ pieces: 4, walls: 2, dir: 1 + (k >= 8 ? 1 : 0), turn: 1, name: '칸 섞기' }),
];
// 마지막 우주(월드 100): 2026-10-06 사용자 요청으로 예전 우주(SS-1021~1050, 평균 7.87수 — 앞 월드보다 쉬웠음)를
// 새 판으로 교체. 칸 4개(방향 2·회전 2)+벽 2, 8~10수, 최단 풀이 가짓수가 적은 판(ways ≤ maxWays)만 = 길이 좁다.
// 탐색 상한(STATE_CAP)은 그대로 — 게임 힌트(solveNext)가 같은 상한으로 풀기 때문.
const SPACE = { w: TOTAL_WORLDS, n: 4, pieces: 4, walls: 2, dir: 2, turn: 2, lo: 8, hi: 10, maxWays: 6, name: '칸 섞기' };
function worldSpec(w) { // w: 1부터, 35~99 (100은 SPACE)
  if (w === TOTAL_WORLDS) return SPACE;
  const j = w - (KEEP + 1), k = Math.floor(j / KINDS.length), kind = j % KINDS.length;
  const base = Math.min(8, 6 + Math.floor(k / 4)) - (kind === 0 ? 1 : 0);
  return Object.assign({ w, n: 4, lo: base - 1, hi: Math.min(9, base + 1) }, KINDS[kind](k));
}
const rhythm = [0, 0, 1, 0, -1, 0, 1, 0, 0, -1];
function depthPlan(W) {
  const want = [];
  for (let i = 0; i < WORLD_SIZE; i++) {
    const ramp = W.lo + (W.hi - W.lo) * (i / 29);
    let d = Math.round(ramp + rhythm[(i + W.w) % 10] * 0.6);
    if (i < 2) d = W.lo; // 몸풀기
    if (W === SPACE && i === WORLD_SIZE - 1) d = W.hi; // 마지막 판은 가장 길게
    want.push(Math.max(W.lo, Math.min(W.hi, d)));
  }
  return want;
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

// ---- 기존 데이터: 앞 34월드 + 우주 30판(id로 찾음 — merge 뒤에 다시 돌려도 같은 결과) ----
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(DATA, 'utf8'), sandbox);
const data = sandbox.window.BM_DATA;
const byId = new Map(data.stages.map(s => [s.id, s]));
const sid = i => 'SS-' + String(i).padStart(4, '0');
const kept = []; for (let i = 1; i <= KEEP * WORLD_SIZE; i++) kept.push(byId.get(sid(i)));
// 예전 우주 판(SS-1021~1050)은 더 이상 쓰지 않지만, 아직 데이터에 있으면 새 판과 겹치지 않게 중복 검사에만 넣는다
const space = []; for (let i = KEEP * WORLD_SIZE + 1; i <= (KEEP + 1) * WORLD_SIZE; i++) if (byId.get(sid(i))) space.push(byId.get(sid(i)));
assert(kept.every(Boolean), 'base stages missing');
const baseCanon = new Set(kept.concat(space).map(canonical));

const MODE = process.argv[2];
if (MODE === 'gen') {
  const w = Number(process.argv[3]);
  assert(w > KEEP && w <= TOTAL_WORLDS, `usage: gen <world ${KEEP + 1}..${TOTAL_WORLDS}>`);
  const W = worldSpec(w);
  seed = 20261006 + w * 104729;
  const t0 = Date.now();
  const want = depthPlan(W);
  const need = {}; want.forEach(d => { need[d] = (need[d] || 0) + 1; });
  const pool = {}; for (const d in need) pool[d] = [];
  const seenCanon = new Set(baseCanon), seenPattern = new Set();
  const done = () => Object.keys(need).every(d => pool[d].length >= need[d]);
  let runs = 0;
  while (!done() && runs < 600000) {
    runs++;
    const L = randomLayout(W);
    const wallSet = setOf(L.walls), tileMap = mapOf(L.tiles);
    const g = explore(L.start, W.n, STATE_CAP, wallSet, tileMap);
    if (!g) continue;
    for (const goal of shuffle([...g.goals.values()])) {
      const d = goal.distance;
      if (!pool[d] || pool[d].length >= need[d]) continue;
      if (goal.ways < 2) continue; // 외길 퍼즐 제외
      if (W.maxWays && goal.ways > W.maxWays) continue; // 우주: 길이 좁은 판만
      const pk = goal.positions.map(p => p.join(',')).join(';');
      const cand = { n: W.n, start: L.start, targets: goal.positions, walls: L.walls, tiles: L.tiles };
      const cc = canonical(cand);
      if (seenCanon.has(cc)) continue;
      const pat = patternKey(L.start, goal.positions);
      if (seenPattern.has(pat)) continue;
      if (L.tiles.length && !tilesMatter(L.start, W.n, wallSet, L.tiles, pk, d)) continue;
      if (randomSolveRate(L.start, goal.positions, W.n, wallSet, tileMap, d) > 0.3) continue;
      seenCanon.add(cc); seenPattern.add(pat);
      pool[d].push({ start: clone(L.start), targets: goal.positions.map(p => p.slice()), walls: L.walls.map(c => c.slice()), tiles: L.tiles.map(c => c.slice()), min: d, ways: goal.ways });
      break; // 한 배치에서 한 판만
    }
  }
  assert(done(), `world ${w}: not enough candidates after ${runs} runs ` + JSON.stringify(Object.fromEntries(Object.keys(need).map(d => [d, pool[d].length + '/' + need[d]]))));
  const picked = want.map(d => pool[d].pop());
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `w${w}.json`), JSON.stringify({ spec: W, picked }));
  console.log(`world ${w} ${W.name} ${W.pieces}p w${W.walls} d${W.dir} t${W.turn} ${W.lo}-${W.hi}: runs=${runs} ms=${Date.now() - t0} mins=${picked.map(p => p.min).join('')}`);
  process.exit(0);
}

assert.equal(MODE, 'merge', 'usage: gen <world> | merge');
const stages = kept.slice();
const allCanon = new Set(baseCanon);
let nextId = (KEEP + 1) * WORLD_SIZE + 1; // SS-1051부터
for (let w = KEEP + 1; w <= TOTAL_WORLDS; w++) {
  if (w === TOTAL_WORLDS) nextId = TOTAL_WORLDS * WORLD_SIZE + 1; // 새 우주는 SS-3001부터(예전 우주 기록과 섞이지 않게)
  const { spec: W, picked } = JSON.parse(fs.readFileSync(path.join(OUT, `w${w}.json`), 'utf8'));
  assert.equal(picked.length, WORLD_SIZE);
  picked.forEach((p, i) => {
    const st = { n: W.n, start: p.start, targets: p.targets, walls: p.walls, tiles: p.tiles };
    const cc = canonical(st);
    assert(!allCanon.has(cc), `duplicate stage across worlds (world ${w} #${i + 1})`); allCanon.add(cc);
    const out = { id: sid(nextId++), seq: 0, chapter: W.name, role: 'practice', n: W.n, pieces: p.start.length, start: p.start, targets: p.targets, min: p.min, ways: p.ways };
    if (p.walls.length) out.walls = p.walls;
    if (p.tiles.length) out.tiles = p.tiles;
    stages.push(out);
  });
}
assert.equal(stages.length, TOTAL_WORLDS * WORLD_SIZE);
stages.forEach((s, i) => {
  s.seq = i + 1;
  if (i >= KEEP * WORLD_SIZE) { const prev = stages[i - 1]; s.role = s.min < prev.min ? 'recovery' : s.min > prev.min ? 'stretch' : 'practice'; }
});
assert.equal(new Set(stages.map(s => s.id)).size, stages.length, 'duplicate ids');

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
  for (const p of s.start) assert(!walls.has(p[0] + ',' + p[1]) && !tiles.has(p[0] + ',' + p[1]), `piece starts on wall/tile ${s.id}`);
}
data.stages = stages;
fs.writeFileSync(DATA, 'window.BM_DATA=' + JSON.stringify(data) + ';\n');
const per = [];
for (let w = 0; w < TOTAL_WORLDS; w++) {
  const sl = stages.slice(w * WORLD_SIZE, (w + 1) * WORLD_SIZE);
  per.push({ world: w + 1, chapter: sl[5].chapter, pieces: sl[5].pieces, avgMin: +(sl.reduce((a, s) => a + s.min, 0) / 30).toFixed(2), wallStages: sl.filter(s => s.walls).length, tileStages: sl.filter(s => s.tiles).length });
}
fs.writeFileSync(path.join(ROOT, 'validation-report-more.json'), JSON.stringify({ created: new Date().toISOString().slice(0, 10), delivered: stages.length, per_world: per }, null, 2) + '\n');
console.log('validated', stages.length);
console.log(per.map(p => `${p.world}:${p.pieces}p m${p.avgMin}${p.tileStages ? '*' : ''}`).join(' '));

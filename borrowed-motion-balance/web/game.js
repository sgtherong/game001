/* 빌린 움직임 — web build
 * Core rule (borrowed-motion-easy-v1), ported 1:1 from rules.cjs:
 * pick two pieces -> swap their directions -> those two pieces each try to
 * step one cell in the new direction. A step is blocked by the board edge or
 * by any cell occupied in the ORIGINAL state. If both selected pieces aim at
 * the same empty cell, both stay. Win = every piece sits on its target cell
 * (final arrow direction does not matter).
 */
'use strict';

const VECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // 0=right 1=down 2=left 3=up
const DIR_LABEL = ['→', '↓', '←', '↑'];
const PIECE_COLORS = ['#e8743b', '#2f8f83', '#7b6cd9', '#c0497b']; // supports up to 4

const clone = s => s.map(p => p.slice());
const key = s => s.flat().join(',');

function outcome(s, pair, n) {
  const t = clone(s), [a, b] = pair;
  [t[a][2], t[b][2]] = [t[b][2], t[a][2]];
  const proposed = t.map((p, i) => {
    if (i !== a && i !== b) return p.slice(0, 2);
    const [dx, dy] = VECTORS[p[2]], x = p[0] + dx, y = p[1] + dy;
    const blocked = x < 0 || x >= n || y < 0 || y >= n || s.some(q => q[0] === x && q[1] === y);
    return blocked ? p.slice(0, 2) : [x, y];
  });
  return t.map((p, i) => {
    const q = proposed[i];
    const collision = proposed.filter(r => r[0] === q[0] && r[1] === q[1]).length > 1;
    return [collision ? p[0] : q[0], collision ? p[1] : q[1], p[2]];
  });
}

function pairsFor(n) {
  const out = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) out.push([a, b]);
  return out;
}

const isGoal = (state, targets) =>
  state.every((p, i) => p[0] === targets[i][0] && p[1] === targets[i][1]);

// Deterministic hint: shortest first move from the CURRENT state to any goal
// arrangement (computed live from where the player is now, per design spec).
function solveNext(state, targets, n) {
  if (isGoal(state, targets)) return null;
  const pairs = pairsFor(state.length);
  const startKey = key(state);
  const parent = new Map([[startKey, null]]);
  const queue = [state];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    for (const pr of pairs) {
      const t = outcome(s, pr, n), k = key(t);
      if (parent.has(k)) continue;
      parent.set(k, { from: key(s), pair: pr });
      if (isGoal(t, targets)) {
        let ck = k;
        while (parent.get(ck).from !== startKey) ck = parent.get(ck).from;
        return parent.get(ck).pair;
      }
      queue.push(t);
    }
  }
  return null; // unreachable from here without undo
}

/* ---------- persistence ---------- */
const SAVE_KEY = 'bm_progress_v1';
function loadProgress() {
  let p = { completed: {}, best: {}, solo: {}, last: 0, tutorialSeen: false, settings: { sound: true } };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) p = Object.assign(p, JSON.parse(raw));
  } catch (e) {}
  if (!p.settings) p.settings = { sound: true };
  return p;
}
function saveProgress(p) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (e) {}
}

/* ---------- album (travel stickers) ---------- */
// One sticker per 5 first-clears; 6 stickers complete page one (at 30 clears).
const STICKERS = [
  { emoji: '🧭', name: '나침반' },
  { emoji: '🗺️', name: '지도' },
  { emoji: '🎒', name: '배낭' },
  { emoji: '📸', name: '사진' },
  { emoji: '✈️', name: '비행기' },
  { emoji: '🏝️', name: '섬' },
];
const CLEARS_PER_STICKER = 5;
const firstClearCount = () => Object.values(progress.completed).filter(Boolean).length;
const stickersEarned = () => Math.min(STICKERS.length, Math.floor(firstClearCount() / CLEARS_PER_STICKER));

/* ---------- sound (WebAudio synth, no asset files) + haptics ---------- */
const Sound = (() => {
  let ctx = null, master = null, echo = null;
  const ready = () => {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = false; }
      if (ctx) {
        master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
        // gentle feedback delay for warmth/space
        const d = ctx.createDelay(); d.delayTime.value = 0.13;
        const fb = ctx.createGain(); fb.gain.value = 0.24;
        const wet = ctx.createGain(); wet.gain.value = 0.9;
        d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
        echo = d;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  // one enveloped oscillator voice, optional pitch glide + echo send
  function voice(freq, dur, o = {}) {
    const c = ready(); if (!c) return;
    const { type = 'sine', gain = 0.15, when = 0, attack = 0.008, glide = 0, wet = 0.4 } = o;
    const t = c.currentTime + when;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    if (echo && wet) { const s = c.createGain(); s.gain.value = gain * wet; g.connect(s); s.connect(echo); }
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  const on = () => progress.settings && progress.settings.sound !== false;
  const SEL = [523.25, 587.33, 659.25, 783.99];               // C5 D5 E5 G5 by piece
  const LOCK = [523.25, 659.25, 783.99, 987.77, 1174.66];      // rising as pieces land
  return {
    selectAt(i) { if (on()) voice(SEL[i % SEL.length], 0.13, { type: 'triangle', gain: 0.12, attack: 0.004, wet: 0.3 }); },
    select() { this.selectAt(0); },
    swap() { if (on()) { voice(660, 0.1, { type: 'triangle', gain: 0.09, glide: 500, wet: 0.4 }); voice(500, 0.12, { type: 'triangle', gain: 0.08, when: 0.045, glide: 680, wet: 0.4 }); } },
    move() { if (on()) voice(300, 0.17, { type: 'sine', gain: 0.13, glide: 540, wet: 0.5 }); },
    blocked() { if (on()) { voice(150, 0.15, { type: 'sawtooth', gain: 0.1, glide: 85, wet: 0.2 }); voice(95, 0.1, { type: 'square', gain: 0.05, when: 0.02, wet: 0.1 }); } },
    lock(step) { if (on()) { const f = LOCK[Math.min(step, LOCK.length - 1)]; voice(f, 0.55, { type: 'sine', gain: 0.18, attack: 0.003, wet: 0.9 }); voice(f * 2, 0.35, { type: 'triangle', gain: 0.05, when: 0.004, wet: 0.6 }); } },
    win() { if (on()) [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => voice(f, 0.5, { type: 'triangle', gain: 0.16, when: i * 0.085, wet: 0.8 })); },
    sticker() { if (on()) [784, 988, 1319, 1568].forEach((f, i) => voice(f, 0.4, { type: 'sine', gain: 0.14, when: i * 0.07, wet: 0.9 })); },
    unlock() { ready(); }, // call on first user gesture
  };
})();
function haptic(ms) { try { if (progress.settings && progress.settings.sound !== false && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

/* ---------- confetti (canvas, respects reduced motion) ---------- */
function confettiBurst() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.getElementById('confetti');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width = cv.clientWidth, H = cv.height = cv.clientHeight;
  const colors = ['#e8743b', '#2f8f83', '#7b6cd9', '#c0497b', '#e8a45c'];
  const parts = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.35,
    vx: (Math.random() - 0.5) * 9, vy: -6 - Math.random() * 8,
    s: 5 + Math.random() * 7, c: colors[(Math.random() * colors.length) | 0],
    a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.4, life: 0,
  }));
  cv.style.opacity = '1';
  let raf;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.life++; p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.a += p.va;
      if (p.y < H + 20) alive = true;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (alive) raf = requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W, H); cv.style.opacity = '0'; cancelAnimationFrame(raf); }
  }
  frame();
}

/* ---------- game state ---------- */
const STAGES = window.BM_DATA.stages;
let progress = loadProgress();

const G = {
  index: 0,
  stage: null,
  state: null,      // [[x,y,dir],...]
  history: [],      // committed states for undo
  selected: [],     // piece indices, max 2
  usedHint: false,  // hint used on this attempt
  animating: false,
};

/* ---------- DOM ---------- */
const $ = sel => document.querySelector(sel);
const boardEl = $('#board');
const gridEl = $('#grid');
const layerEl = $('#layer');
const stageTitleEl = $('#stageTitle');
const chapterEl = $('#chapter');
const moveCountEl = $('#moveCount');
const minMovesEl = $('#minMoves');
const hintTextEl = $('#hintText');
const btnUndo = $('#btnUndo');
const btnRestart = $('#btnRestart');
const btnHint = $('#btnHint');
const btnCommit = $('#btnCommit');
const btnCancel = $('#btnCancel');
const overlay = $('#overlay');
const stageListEl = $('#stageList');
const progressBarEl = $('#progressBar');
const progressTextEl = $('#progressText');

/* ---------- rendering ---------- */
const GAP = 8; // must match #grid gap in CSS

// geometry of the inner coordinate box (#layer), recomputed on layout changes
function geom() {
  const n = G.stage.n;
  const W = layerEl.clientWidth || boardEl.clientWidth - 20;
  const cell = (W - (n - 1) * GAP) / n;
  const center = c => c * (cell + GAP) + cell / 2;
  return { n, W, cell, center };
}

function buildBoard() {
  const n = G.stage.n;
  boardEl.style.setProperty('--n', n);
  gridEl.innerHTML = '';
  layerEl.innerHTML = '';

  for (let i = 0; i < n * n; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    gridEl.appendChild(cell);
  }

  G.stage.targets.forEach((t, i) => {
    const g = document.createElement('div');
    g.className = 'target';
    g.dataset.i = i;
    g.style.setProperty('--c', PIECE_COLORS[i]);
    g.innerHTML = `<span>${i + 1}</span>`;
    layerEl.appendChild(g);
  });

  G.state.forEach((p, i) => {
    const tok = document.createElement('button');
    tok.className = 'piece';
    tok.dataset.i = i;
    tok.style.setProperty('--c', PIECE_COLORS[i]);
    tok.innerHTML = `<span class="num">${i + 1}</span><span class="arrow"></span><span class="stop">정지</span>`;
    tok.addEventListener('click', () => onPieceClick(i));
    layerEl.appendChild(tok);
  });

  G.state.forEach((p, i) => {
    const gh = document.createElement('div');
    gh.className = 'pv-ghost';
    gh.dataset.i = i;
    gh.style.setProperty('--c', PIECE_COLORS[i]);
    gh.innerHTML = `<span>${i + 1}</span>`;
    layerEl.appendChild(gh);
  });

  applyStaticGeometry();
  refreshPieces();
}

function pieceEls() { return [...layerEl.querySelectorAll('.piece')]; }
function ghostEls() { return [...layerEl.querySelectorAll('.pv-ghost')]; }
function targetEls() { return [...layerEl.querySelectorAll('.target')]; }

// size + place elements that do not depend on preview (targets, token sizes, fonts)
function applyStaticGeometry() {
  const { cell, center } = geom();
  const pieceSize = cell * 0.82;
  const fs = Math.round(cell * 0.34) + 'px';

  targetEls().forEach((el, i) => {
    const t = G.stage.targets[i];
    el.style.width = cell + 'px';
    el.style.height = cell + 'px';
    el.style.left = center(t[0]) + 'px';
    el.style.top = center(t[1]) + 'px';
    el.style.fontSize = fs;
  });
  pieceEls().forEach(el => {
    el.style.width = pieceSize + 'px';
    el.style.height = pieceSize + 'px';
    el.querySelector('.num').style.fontSize = fs;
  });
  ghostEls().forEach(el => {
    el.style.width = pieceSize + 'px';
    el.style.height = pieceSize + 'px';
    el.style.fontSize = fs;
  });
}

function refreshPieces(previewState) {
  const { center } = geom();
  const toks = pieceEls();
  const ghosts = ghostEls();

  // decide displayed direction: if two selected, show swapped directions
  const shown = clone(G.state);
  if (G.selected.length === 2) {
    const [a, b] = G.selected;
    [shown[a][2], shown[b][2]] = [shown[b][2], shown[a][2]];
  }

  G.state.forEach((p, i) => {
    const tok = toks[i];
    tok.style.left = center(p[0]) + 'px';
    tok.style.top = center(p[1]) + 'px';
    const arrow = tok.querySelector('.arrow');
    arrow.style.transform = `rotate(${shown[i][2] * 90}deg)`;
    tok.classList.toggle('selected', G.selected.includes(i));
    tok.classList.toggle('on-target',
      p[0] === G.stage.targets[i][0] && p[1] === G.stage.targets[i][1]);
    tok.classList.remove('will-stop');
  });

  // ghosts + stop badges
  ghosts.forEach(g => g.classList.remove('show'));
  if (previewState) {
    G.selected.forEach(i => {
      const from = G.state[i], to = previewState[i];
      const moved = from[0] !== to[0] || from[1] !== to[1];
      if (moved) {
        const g = ghosts[i];
        g.style.left = center(to[0]) + 'px';
        g.style.top = center(to[1]) + 'px';
        g.classList.add('show');
      } else {
        toks[i].classList.add('will-stop');
      }
    });
  }
}

/* ---------- interaction ---------- */
function onPieceClick(i) {
  if (G.animating) return;
  Sound.unlock();
  const pos = G.selected.indexOf(i);
  if (pos !== -1) {
    G.selected.splice(pos, 1);
  } else if (G.selected.length < 2) {
    G.selected.push(i);
  } else {
    // replace oldest
    G.selected = [G.selected[1], i];
  }
  Sound.selectAt(i); haptic(8);
  updatePreview();
}

function updatePreview() {
  let preview = null;
  if (G.selected.length === 2) {
    preview = outcome(G.state, G.selected, G.stage.n);
    boardEl.classList.add('previewing');
  } else {
    boardEl.classList.remove('previewing');
  }
  refreshPieces(preview);
  btnCommit.disabled = G.selected.length !== 2;
  btnCancel.disabled = G.selected.length === 0;
  hintTextEl.textContent = G.selected.length === 2
    ? '미리보기 — 조각의 방향을 바꾸고 한 칸 움직입니다. 좋으면 이동하세요.'
    : '조각 두 개를 선택하세요.';
}

function commitMove() {
  if (G.selected.length !== 2 || G.animating) return;
  const tg = G.stage.targets;
  const onTgt = st => st.map((p, i) => p[0] === tg[i][0] && p[1] === tg[i][1]);
  const before = onTgt(G.state);
  const next = outcome(G.state, G.selected, G.stage.n);
  const anyBlocked = G.selected.some(i =>
    G.state[i][0] === next[i][0] && G.state[i][1] === next[i][1]);
  const after = onTgt(next);
  const arrivals = next.map((_, i) => i).filter(i => after[i] && !before[i]);
  const placedAfter = after.filter(Boolean).length;
  const willWin = after.every(Boolean);

  G.history.push(clone(G.state));
  G.state = next;
  G.selected = [];
  G.animating = true;
  boardEl.classList.remove('previewing');
  refreshPieces();
  updateHud();

  Sound.swap();
  if (anyBlocked) { Sound.blocked(); haptic([12, 30, 12]); } else { Sound.move(); haptic(16); }
  // target lock-in: ring pulse (always) + rising chime (except on the winning move,
  // where the win jingle takes over)
  arrivals.forEach((i, k) => {
    setTimeout(() => {
      pulseTarget(i);
      if (!willWin) { Sound.lock(placedAfter - arrivals.length + k); haptic(10); }
    }, 300 + k * 90);
  });

  setTimeout(() => {
    G.animating = false;
    if (isGoal(G.state, G.stage.targets)) onWin();
    else updatePreview();
  }, 320);
}

// ring pulse on a target + brief glow on the piece that just landed there
function pulseTarget(i) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t = targetEls()[i], p = pieceEls()[i];
  if (t) { t.classList.remove('lit'); void t.offsetWidth; t.classList.add('lit'); }
  if (p) { p.classList.remove('arrived'); void p.offsetWidth; p.classList.add('arrived'); }
}

// quick white flash on win
function screenFlash() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const f = document.getElementById('flash');
  if (!f) return;
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}

function undo() {
  if (!G.history.length || G.animating) return;
  G.state = G.history.pop();
  G.selected = [];
  refreshPieces();
  updateHud();
  updatePreview();
}

function restart() {
  if (G.animating) return;
  G.state = clone(G.stage.start);
  G.history = [];
  G.selected = [];
  G.usedHint = false;
  refreshPieces();
  updateHud();
  updatePreview();
}

function useHint() {
  if (G.animating) return;
  const pair = solveNext(G.state, G.stage.targets, G.stage.n);
  if (!pair) {
    hintTextEl.textContent = '지금 상태에서는 되돌리기로 유효한 상태로 돌아가세요.';
    return;
  }
  G.usedHint = true;
  G.selected = pair.slice();
  updatePreview();
  hintTextEl.textContent = `힌트: 조각 ${pair[0] + 1} 과(와) ${pair[1] + 1} 을(를) 선택했어요. 미리보기를 확인하고 이동하세요.`;
}

/* ---------- win ---------- */
function onWin() {
  const moves = G.history.length;
  const st = G.stage;
  const firstClear = !progress.completed[st.id];
  const stickersBefore = stickersEarned();
  progress.completed[st.id] = true;
  if (!progress.best[st.id] || moves < progress.best[st.id]) progress.best[st.id] = moves;
  if (!G.usedHint && (!progress.solo[st.id] || moves < progress.solo[st.id]))
    progress.solo[st.id] = moves;
  saveProgress(progress);

  const newSticker = firstClear && stickersEarned() > stickersBefore;
  const optimal = moves === st.min;
  overlay.querySelector('.badge').textContent = optimal ? '🏆' : '🎉';
  overlay.querySelector('.result-title').textContent = optimal ? '최단으로 성공!' : '성공!';
  overlay.querySelector('.result-sub').innerHTML =
    `${moves}번 이동 · 최소 ${st.min}번` +
    (G.usedHint ? ' · 힌트 사용' : (optimal ? ' · 완벽해요' : '')) +
    (firstClear ? '' : ' · 다시 완료');
  const hasNext = G.index < STAGES.length - 1;
  overlay.querySelector('#btnNext').style.display = hasNext ? '' : 'none';
  overlay.classList.add('show');
  Sound.win(); haptic([20, 40, 60]); confettiBurst(); screenFlash();
  pieceEls().forEach((el, k) => { setTimeout(() => { el.classList.remove('win-bounce'); void el.offsetWidth; el.classList.add('win-bounce'); }, k * 70); });
  renderStageList();
  renderProgress();

  if (newSticker) setTimeout(() => showStickerReward(stickersEarned() - 1), 900);
}

/* ---------- hud / navigation ---------- */
function updateHud() {
  moveCountEl.textContent = G.history.length;
}

function loadStage(index) {
  G.index = Math.max(0, Math.min(STAGES.length - 1, index));
  G.stage = STAGES[G.index];
  G.state = clone(G.stage.start);
  G.history = [];
  G.selected = [];
  G.usedHint = false;
  progress.last = G.index;
  saveProgress(progress);

  stageTitleEl.textContent = `${G.stage.id} · ${G.index + 1}/${STAGES.length}`;
  chapterEl.textContent = G.stage.chapter;
  minMovesEl.textContent = G.stage.min;
  overlay.classList.remove('show');
  buildBoard();
  updateHud();
  updatePreview();
  renderStageList();
  renderProgress();
}

function renderProgress() {
  const done = Object.keys(progress.completed).filter(k => progress.completed[k]).length;
  progressBarEl.style.width = (done / STAGES.length * 100) + '%';
  progressTextEl.textContent = `${done} / ${STAGES.length} 완료`;
}

function renderStageList() {
  stageListEl.innerHTML = '';
  let currentChapter = null;
  let chips = null;
  STAGES.forEach((s, i) => {
    if (s.chapter !== currentChapter) {
      currentChapter = s.chapter;
      const h = document.createElement('div');
      h.className = 'chapter-head';
      h.textContent = s.chapter;
      stageListEl.appendChild(h);
      chips = document.createElement('div');
      chips.className = 'chips';
      stageListEl.appendChild(chips);
    }
    const b = document.createElement('button');
    b.className = 'stage-chip';
    b.textContent = s.seq;
    if (progress.completed[s.id]) b.classList.add('done');
    if (i === G.index) b.classList.add('current');
    b.title = `${s.id} · 최소 ${s.min}수`;
    b.addEventListener('click', () => { loadStage(i); closeDrawer(); });
    chips.appendChild(b);
  });
}

/* ---------- album ---------- */
const albumOverlay = $('#albumOverlay');
function renderAlbum() {
  const earned = stickersEarned();
  const grid = $('#albumGrid');
  grid.innerHTML = '';
  STICKERS.forEach((s, i) => {
    const cell = document.createElement('div');
    cell.className = 'sticker' + (i < earned ? ' got' : '');
    cell.innerHTML = i < earned
      ? `<span class="emoji">${s.emoji}</span><span class="nm">${s.name}</span>`
      : `<span class="emoji">?</span>`;
    grid.appendChild(cell);
  });
  const clears = firstClearCount();
  const next = earned < STICKERS.length ? (earned + 1) * CLEARS_PER_STICKER - clears : 0;
  $('#albumStatus').textContent = earned >= STICKERS.length
    ? '첫 페이지 완성! 모두 모았어요 🎉'
    : `스티커 ${earned}/${STICKERS.length} · 다음 스티커까지 ${next}개 더 완료`;
}
function openAlbum() { renderAlbum(); albumOverlay.classList.add('show'); }
function closeAlbum() { albumOverlay.classList.remove('show'); }

function showStickerReward(index) {
  const s = STICKERS[index];
  // keep the win overlay (with the "다음 문제" button) behind this modal so it
  // returns after the sticker/album is closed
  const so = $('#stickerOverlay');
  $('#stickerEmoji').textContent = s.emoji;
  $('#stickerName').textContent = `‘${s.name}’ 스티커 획득!`;
  $('#stickerSub').textContent = `여행 앨범에 붙였어요 · ${stickersEarned()}/${STICKERS.length}`;
  so.classList.add('show');
  Sound.sticker(); haptic([30, 40, 30, 40, 60]); confettiBurst();
}

/* ---------- tutorial ---------- */
const tutorial = $('#tutorial');
function openTutorial() { tutorial.classList.add('show'); }
function closeTutorial() {
  tutorial.classList.remove('show');
  progress.tutorialSeen = true; saveProgress(progress);
}

/* ---------- settings ---------- */
function applySoundIcon() {
  const on = progress.settings.sound !== false;
  const b = $('#btnSound');
  if (b) { b.textContent = on ? '🔊 소리 켜짐' : '🔇 소리 꺼짐'; b.classList.toggle('off', !on); }
}
function toggleSound() {
  progress.settings.sound = progress.settings.sound === false;
  saveProgress(progress); applySoundIcon();
  if (progress.settings.sound) { Sound.unlock(); Sound.select(); }
}

/* ---------- PWA ---------- */
function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------- drawer ---------- */
const drawer = $('#drawer');
function openDrawer() { drawer.classList.add('open'); }
function closeDrawer() { drawer.classList.remove('open'); }

/* ---------- wire up ---------- */
btnUndo.addEventListener('click', undo);
btnRestart.addEventListener('click', restart);
btnHint.addEventListener('click', useHint);
btnCommit.addEventListener('click', commitMove);
btnCancel.addEventListener('click', () => { G.selected = []; updatePreview(); });
$('#btnNext').addEventListener('click', () => loadStage(G.index + 1));
$('#btnReplay').addEventListener('click', () => { overlay.classList.remove('show'); restart(); });
$('#btnStages').addEventListener('click', openDrawer);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#drawerBackdrop').addEventListener('click', closeDrawer);

// album
$('#btnAlbum').addEventListener('click', openAlbum);
$('#albumClose').addEventListener('click', closeAlbum);
$('#albumBackdrop').addEventListener('click', closeAlbum);
$('#stickerOk').addEventListener('click', () => { $('#stickerOverlay').classList.remove('show'); openAlbum(); });

// tutorial / help
$('#btnHelp').addEventListener('click', openTutorial);
$('#tutorialStart').addEventListener('click', closeTutorial);

// settings
$('#btnSound').addEventListener('click', toggleSound);

document.addEventListener('keydown', e => {
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  else if (e.key === 'Enter' && !btnCommit.disabled) commitMove();
  else if (e.key === 'Escape') { G.selected = []; updatePreview(); }
  else if (e.key === 'r') restart();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!G.stage) return;
    applyStaticGeometry();
    const preview = G.selected.length === 2 ? outcome(G.state, G.selected, G.stage.n) : null;
    refreshPieces(preview);
  }, 120);
});

// unlock audio on the first user gesture (autoplay policies)
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

// init
applySoundIcon();
registerSW();
// start at last played stage
loadStage(progress.last || 0);
// first-run tutorial
if (!progress.tutorialSeen) openTutorial();

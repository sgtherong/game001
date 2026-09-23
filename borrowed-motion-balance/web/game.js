/* 빌린 움직임 — web build
 * Core rule (borrowed-motion-easy-v1), ported 1:1 from rules.cjs:
 * pick two pieces -> swap their directions -> those two pieces each try to
 * step one cell in the new direction. A step is blocked by the board edge or
 * by any cell occupied in the ORIGINAL state. If both selected pieces aim at
 * the same empty cell, both stay. Win = every piece sits on its target cell
 * (final arrow direction does not matter).
 */
'use strict';

// i18n shortcut + chapter-name mapping (data chapters are Korean; map to keys)
const t = (k, v) => window.I18N.t(k, v);
const CHAPTER_KEY = {
  '규칙 익히기': 'ch_learn', '편안한 반복': 'ch_relax', '순서 계획': 'ch_plan',
  '넓은 보드 적응': 'ch_board', '4×4 계획': 'ch_plan4', '네 조각 입문': 'ch_four_intro',
  '네 조각 계획': 'ch_four_plan', '긴 여정': 'ch_journey',
};
const chapterName = ko => (CHAPTER_KEY[ko] ? t(CHAPTER_KEY[ko]) : ko);
const WORLD_SIZE = 30; // stages per world in the picker
const worldOf = index => Math.floor(index / WORLD_SIZE); // 0-based world of a stage index
const worldLabel = index => t('world', { n: worldOf(index) + 1 });

const VECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // 0=right 1=down 2=left 3=up
const DIR_LABEL = ['→', '↓', '←', '↑'];
const PIECE_COLORS = ['#e8743b', '#2f8f83', '#7b6cd9', '#c0497b']; // supports up to 4

const clone = s => s.map(p => p.slice());
const key = s => s.flat().join(',');

// walls: optional Set of "x,y" strings marking impassable cells (kept identical to rules.cjs)
function outcome(s, pair, n, walls) {
  const t = clone(s), [a, b] = pair;
  [t[a][2], t[b][2]] = [t[b][2], t[a][2]];
  const proposed = t.map((p, i) => {
    if (i !== a && i !== b) return p.slice(0, 2);
    const [dx, dy] = VECTORS[p[2]], x = p[0] + dx, y = p[1] + dy;
    const blocked = x < 0 || x >= n || y < 0 || y >= n || s.some(q => q[0] === x && q[1] === y) || (walls && walls.has(x + ',' + y));
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
function solveNext(state, targets, n, walls) {
  if (isGoal(state, targets)) return null;
  const pairs = pairsFor(state.length);
  const startKey = key(state);
  const parent = new Map([[startKey, null]]);
  const queue = [state];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    for (const pr of pairs) {
      const t = outcome(s, pr, n, walls), k = key(t);
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
  let p = {
    completed: {}, best: {}, solo: {}, last: 0, tutorialSeen: false,
    settings: { sound: true },
    hints: { date: '', free: 0, ad: 0 }, // daily hint quotas (free / rewarded-ad)
    premium: false, theme: 'default',
    worldsDone: {}, themeUnlocked: false, // world-clear rewards
    daily: {}, streak: { n: 0, last: '' }, // daily challenge state
    weekly: { week: '', days: [], claimed: [] }, // weekly daily-challenge reward
    bonusHints: 0, // reward hints (persist across days, spent after free quota)
    reached: 0, // furthest stage index unlocked via linear main progression
  };
  try {
    // 저장소는 platform.js의 Store(포털=SDK data / 그 외=localStorage). 미로드 시 localStorage 폴백.
    const raw = window.Store ? Store.get(SAVE_KEY) : localStorage.getItem(SAVE_KEY);
    if (raw) p = Object.assign(p, JSON.parse(raw));
  } catch (e) {}
  if (!p.settings) p.settings = { sound: true };
  if (!p.hints) p.hints = { date: '', free: 0, ad: 0 };
  if (!p.worldsDone) p.worldsDone = {};
  if (!p.daily) p.daily = {};
  if (!p.streak) p.streak = { n: 0, last: '' };
  if (!p.weekly || !Array.isArray(p.weekly.days)) p.weekly = { week: '', days: [], claimed: [] };
  if (!Array.isArray(p.weekly.claimed)) p.weekly.claimed = [];
  if (typeof p.bonusHints !== 'number') p.bonusHints = 0;
  if (typeof p.reached !== 'number') p.reached = 0;
  // migrate: existing players keep access up to their furthest completed stage
  return p;
}
function saveProgress(p) {
  try { if (window.Store) Store.set(SAVE_KEY, JSON.stringify(p)); else localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (e) {}
}

/* ---------- monetization (prototype: ad/payment points are stubbed) ----------
 * Model from the commercial design doc:
 *  - free: 3 hints/day (undo/restart/preview always free)
 *  - rewarded ad: +1 hint, max 3/day and at most 1 per stage attempt
 *  - premium one-time (proposed ₩4,900): unlimited hints, no ad button,
 *    exclusive theme, restore. Real ads (AdMob) and IAP are wired later in a
 *    native wrapper — here the ad is simulated and the purchase is a test unlock.
 */
const FREE_HINTS_PER_DAY = 3;
const AD_HINTS_PER_DAY = 3;
const MOVES_PER_AD = 3; // extra moves granted per rewarded ad when the budget runs out
const PREMIUM_PRICE = '₩4,900';
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function resetDailyIfNeeded() {
  if (!progress.hints || progress.hints.date !== todayKey()) {
    progress.hints = { date: todayKey(), free: 0, ad: 0 };
    saveProgress(progress);
  }
}
const isPremium = () => !!progress.premium;
// 포털(CrazyGames 등)은 표준 IAP가 없어 유료 결제를 노출하지 않는다(광고 기반 수익).
const onPortal = () => !!(window.AdsManager && window.AdsManager.isPortal);
const freeHintsLeft = () => { resetDailyIfNeeded(); return Math.max(0, FREE_HINTS_PER_DAY - progress.hints.free); };
const adHintsLeft = () => { resetDailyIfNeeded(); return Math.max(0, AD_HINTS_PER_DAY - progress.hints.ad); };
const bonusHintsLeft = () => Math.max(0, progress.bonusHints || 0); // weekly-reward hints (not reset daily)
const hintsAvailable = () => freeHintsLeft() + bonusHintsLeft(); // free quota + reward pool

/* ---------- weekly reward (Mon–Sun daily-challenge streak) ---------- */
// day-count milestones within one week -> bonus reward hints
const WEEKLY_MILESTONES = [{ days: 3, hints: 3 }, { days: 5, hints: 5 }, { days: 7, hints: 10 }];
function weekKeyOf(dateStr) { // Monday's date of that week, as the week's id
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // 0 = Monday
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}
function ensureWeek() { // roll the tracker over when a new week starts
  const wk = weekKeyOf(todayKey());
  if (!progress.weekly || progress.weekly.week !== wk) {
    progress.weekly = { week: wk, days: [], claimed: [] };
    saveProgress(progress);
  }
}
const weeklyDaysDone = () => { ensureWeek(); return progress.weekly.days.length; };
// lightweight analytics log (prototype) — separate key so progress stays small
function logEvent(name, data = {}) {
  try {
    const k = 'bm_events_v1';
    const arr = JSON.parse(localStorage.getItem(k) || '[]');
    arr.push({ t: Date.now(), name, stage: G.stage && G.stage.id, ...data });
    while (arr.length > 300) arr.shift();
    localStorage.setItem(k, JSON.stringify(arr));
  } catch (e) {}
}

/* ---------- album (travel stickers) ---------- */
// One sticker per 5 first-clears; 6 stickers complete page one (at 30 clears).
const STICKERS = [
  { emoji: '🧭', key: 'st_compass' },
  { emoji: '🗺️', key: 'st_map' },
  { emoji: '🎒', key: 'st_backpack' },
  { emoji: '📸', key: 'st_photo' },
  { emoji: '✈️', key: 'st_plane' },
  { emoji: '🏝️', key: 'st_island' },
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
    // 광고 표시 중 전체 음소거 (포털 규격: 광고 시작 시 음소거, 종료 시 복구)
    mute() { if (ctx && master) master.gain.value = 0; },
    unmute() { if (ctx && master) master.gain.value = 0.85; },
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
const STAGE_INDEX = new Map(STAGES.map((s, i) => [s.id, i]));
let progress = loadProgress();
// a stage is unlocked if it's within the reached frontier or already completed
const isUnlocked = i => i <= progress.reached || !!progress.completed[STAGES[i].id];
// keep the reached frontier consistent with completed stages (migration + safety)
function reconcileReached() {
  let maxDone = -1;
  for (const id in progress.completed) {
    if (progress.completed[id]) { const ix = STAGE_INDEX.get(id); if (ix != null && ix > maxDone) maxDone = ix; }
  }
  const target = Math.min(STAGES.length - 1, maxDone + 1);
  if (target > progress.reached) { progress.reached = target; saveProgress(progress); }
}

const G = {
  index: 0,
  stage: null,
  state: null,      // [[x,y,dir],...]
  history: [],      // committed states for undo
  selected: [],     // piece indices, max 2
  usedHint: false,  // hint used on this attempt
  attemptAdUsed: false, // a rewarded-ad hint was used on this attempt (max 1)
  animating: false,
  daily: null,      // slot 0-2 when playing a daily puzzle, else null
  clearsSinceAd: 0, // stage clears since the last midgame ad (portal interstitial cadence)
  budgetBonus: 0,   // extra moves added to this attempt's move budget (e.g., rewarded ad)
};

/* ---------- DOM ---------- */
const $ = sel => document.querySelector(sel);
const boardEl = $('#board');
const gridEl = $('#grid');
const layerEl = $('#layer');
const stageTitleEl = $('#stageTitle');
const chapterEl = $('#chapter');
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
    const x = i % n, y = Math.floor(i / n); // row-major grid → (x,y), origin top-left
    if (G.wallSet && G.wallSet.has(x + ',' + y)) cell.classList.add('wall');
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
    tok.innerHTML = `<span class="num">${i + 1}</span><span class="arrow"></span><span class="stop">${t('stop_badge')}</span>`;
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

/* ---------- hint demo (non-destructive move preview animation) ---------- */
// After a hint selects the pair, briefly slide those two pieces to where the
// move would take them, then slide back — so the player sees HOW they move.
let hintDemoTimers = [];
function clearHintDemo() {
  hintDemoTimers.forEach(clearTimeout);
  hintDemoTimers = [];
  pieceEls().forEach(el => { el.style.zIndex = ''; el.classList.remove('demo'); });
}
function demoHint(pair) {
  clearHintDemo();
  if (!G.stage || G.animating) return;
  const n = G.stage.n, { center } = geom();
  const next = outcome(G.state, pair, n, G.wallSet);
  const toks = pieceEls();
  const slideOut = () => pair.forEach(i => {
    const el = toks[i]; if (!el) return;
    el.style.zIndex = 7; el.classList.add('demo');
    el.style.left = center(next[i][0]) + 'px';
    el.style.top = center(next[i][1]) + 'px';
  });
  const slideBack = () => { clearHintDemo(); updatePreview(); }; // restore truth (state may be unchanged)
  hintDemoTimers.push(setTimeout(slideOut, 260));  // let the arrow swap register first
  hintDemoTimers.push(setTimeout(slideBack, 260 + 640)); // hold at destination, then return
}

/* ---------- interaction ---------- */
function onPieceClick(i) {
  if (G.animating) return;
  clearHintDemo();
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
  const outOfMoves = movesLeft() <= 0;
  let preview = null;
  if (G.selected.length === 2 && !outOfMoves) {
    preview = outcome(G.state, G.selected, G.stage.n, G.wallSet);
    boardEl.classList.add('previewing');
  } else {
    boardEl.classList.remove('previewing');
  }
  refreshPieces(preview);
  // 예산 소진 + 비프리미엄 → '광고 보고 +이동' 버튼 노출 (프리미엄은 광고 없음, 되돌리기/재시작 사용)
  const canAdMoves = outOfMoves && !isPremium();
  btnCommit.disabled = G.selected.length !== 2 || outOfMoves; // 예산 소진 시 이동 불가
  btnCancel.disabled = G.selected.length === 0;
  hintTextEl.textContent = outOfMoves ? t(canAdMoves ? 'moves_out' : 'moves_out_noad')
    : t(G.selected.length === 2 ? 'preview_hint' : 'select_two');
  const mmRow = $('#moreMovesRow'), mmBtn = $('#btnMoreMoves');
  if (mmRow && mmBtn) {
    mmRow.hidden = !canAdMoves;
    if (canAdMoves) mmBtn.textContent = t('more_moves_btn', { n: MOVES_PER_AD });
  }
}

function commitMove() {
  if (G.selected.length !== 2 || G.animating) return;
  if (movesLeft() <= 0) return; // 이동 예산 소진 — 되돌리기/재시작 필요
  clearHintDemo();
  const tg = G.stage.targets;
  const onTgt = st => st.map((p, i) => p[0] === tg[i][0] && p[1] === tg[i][1]);
  const before = onTgt(G.state);
  const next = outcome(G.state, G.selected, G.stage.n, G.wallSet);
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
  clearHintDemo();
  G.state = G.history.pop();
  G.selected = [];
  refreshPieces();
  updateHud();
  updatePreview();
}

function restart() {
  if (G.animating) return;
  clearHintDemo();
  G.state = clone(G.stage.start);
  G.history = [];
  G.selected = [];
  G.usedHint = false;
  G.attemptAdUsed = false;
  G.budgetBonus = 0; // 재시작 시 예산 원복(전체 이동 복구)
  refreshPieces();
  updateHud();
  updatePreview();
}

// hint entry point — routes through free quota / rewarded ad / premium
function useHint() {
  if (G.animating) return;
  const pair = solveNext(G.state, G.stage.targets, G.stage.n, G.wallSet);
  if (!pair) {
    // stuck (needs undo): always free, never charged or ad-gated
    hintTextEl.textContent = t('hint_stuck_free');
    logEvent('hint_stuck_free');
    return;
  }
  if (isPremium()) { applyHint(pair, 'premium'); return; }
  if (freeHintsLeft() > 0) { progress.hints.free++; saveProgress(progress); applyHint(pair, 'free'); return; }
  // free quota gone → spend a weekly-reward hint before asking for an ad
  if (bonusHintsLeft() > 0) { progress.bonusHints--; saveProgress(progress); applyHint(pair, 'bonus'); return; }
  // free exhausted → offer a rewarded ad if available for this day/attempt
  if (adHintsLeft() > 0 && !G.attemptAdUsed) { offerAd(pair); return; }
  hintTextEl.textContent = t('hint_none_left');
  if (!onPortal()) openStore(t('store_note_hint')); // 포털에선 프리미엄 유도 대신 안내만
}
function applyHint(pair, src) {
  G.usedHint = true;
  G.selected = pair.slice();
  updatePreview();
  demoHint(pair); // animate the suggested move so the player sees how the two pieces move
  const left = isPremium() ? t('hint_left_unlimited') : t('hint_left_free', { n: hintsAvailable() });
  hintTextEl.textContent = t('hint_applied', { a: pair[0] + 1, b: pair[1] + 1, left });
  updateHintButton();
  logEvent('hint_used', { src });
}
function updateHintButton() {
  if (!btnHint) return;
  const badge = isPremium() ? '∞' : `(${hintsAvailable()})`;
  btnHint.innerHTML = `💡 ${t('hint_btn')} <span style="color:var(--muted);font-weight:600">${badge}</span>`;
}

/* ---------- rewarded ad (routed through AdsManager adapter) ---------- */
let pendingHintPair = null, adTimer = null, adReason = 'hint'; // 'hint' | 'moves'
function offerAd(pair) {
  pendingHintPair = pair;
  adReason = 'hint';
  $('#adOfferTitle').textContent = t('ad_offer_title');
  $('#adOfferDesc').textContent = t('ad_offer_desc');
  logEvent('ad_offer', { platform: AdsManager.platform, reason: 'hint' });
  $('#adOffer').classList.add('show');
}
// 이동 예산 소진 시 보상형 광고로 +이동 제안
function offerMoreMoves() {
  adReason = 'moves';
  pendingHintPair = null;
  $('#adOfferTitle').textContent = t('ad_moves_title', { n: MOVES_PER_AD });
  $('#adOfferDesc').textContent = t('ad_moves_desc', { n: MOVES_PER_AD });
  logEvent('ad_offer', { platform: AdsManager.platform, reason: 'moves' });
  $('#adOffer').classList.add('show');
}
// user accepted the offer -> ask the platform to show a rewarded ad.
// On 'local' this resolves via the simulated ad UI (showSimulatedAd);
// on a portal it resolves from that portal's SDK.
function watchAd() {
  const reason = adReason;
  $('#adOffer').classList.remove('show');
  logEvent('ad_impression', { platform: AdsManager.platform, reason });
  AdsManager.showRewarded().then(rewarded => {
    if (rewarded) {
      logEvent('ad_reward_granted', { platform: AdsManager.platform, reason });
      if (reason === 'moves') {
        G.budgetBonus = (G.budgetBonus || 0) + MOVES_PER_AD; // 이번 판 이동 예산 +N
        updateHud(); updatePreview();
      } else {
        resetDailyIfNeeded(); progress.hints.ad++; saveProgress(progress);
        G.attemptAdUsed = true;
        if (pendingHintPair) { applyHint(pendingHintPair, 'ad'); pendingHintPair = null; }
      }
    } else {
      logEvent('ad_no_reward', { platform: AdsManager.platform, reason });
      hintTextEl.textContent = t('ad_no_reward');
      pendingHintPair = null;
    }
  }).catch(() => {
    logEvent('ad_error', { platform: AdsManager.platform, reason });
    hintTextEl.textContent = t('ad_error');
    pendingHintPair = null;
  });
}
// local adapter's rewarded UI: resolves true (reward) / false (skipped)
function showSimulatedAd() {
  return new Promise(resolve => {
    const modal = $('#adPlay'); modal.classList.add('show');
    const rewardBtn = $('#adReward'), skipBtn = $('#adClose');
    rewardBtn.disabled = true;
    const wrap = $('#adCountWrap'); wrap.hidden = false;
    let sec = 3;
    wrap.innerHTML = t('ad_count', { n: '<span id="adCount">' + sec + '</span>' });
    clearInterval(adTimer);
    adTimer = setInterval(() => {
      sec--;
      const c = $('#adCount'); if (c) c.textContent = sec;
      if (sec <= 0) { clearInterval(adTimer); rewardBtn.disabled = false; wrap.hidden = true; }
    }, 1000);
    const done = result => {
      clearInterval(adTimer); modal.classList.remove('show');
      rewardBtn.onclick = null; skipBtn.onclick = null; resolve(result);
    };
    rewardBtn.onclick = () => done(true);
    skipBtn.onclick = () => done(false);
  });
}
// close the offer (declined before watching)
function closeAd() {
  const reason = adReason;
  $('#adOffer').classList.remove('show');
  pendingHintPair = null;
  logEvent('ad_dismissed', { platform: AdsManager.platform, reason });
  if (reason === 'moves') updatePreview(); // 이동 예산 안내(moves_out)로 복귀
  else hintTextEl.textContent = t('ad_closed');
}

/* ---------- store / premium ---------- */
function openStore(note) { renderStore(note || ''); $('#store').classList.add('show'); logEvent('store_open'); }
function closeStore() { $('#store').classList.remove('show'); }
function renderStore(note) {
  resetDailyIfNeeded();
  $('#storeNote').textContent = note || '';
  $('#storeNote').hidden = !note;
  $('#storeStatus').textContent = isPremium()
    ? t('store_status_premium')
    : t('store_status_free', { free: freeHintsLeft(), fmax: FREE_HINTS_PER_DAY, ad: adHintsLeft(), amax: AD_HINTS_PER_DAY })
      + (bonusHintsLeft() > 0 ? ' · ' + t('store_status_bonus', { n: bonusHintsLeft() }) : '');
  // 포털에선 유료 결제 UI(구매/보유/복원/약관)를 숨긴다 — 힌트는 광고 기반, 테마는 무료.
  const portal = onPortal();
  $('#premiumCard').hidden = portal || isPremium();
  $('#premiumOwned').hidden = portal || !isPremium();
  $('#restorePurchase').hidden = portal;
  const legal = document.querySelector('#store .store-legal'); if (legal) legal.hidden = portal;
  $('#themeRow').hidden = !canDusk(); // theme selectable via premium/world-1 reward (or free on portal)
  $('#premiumPrice').textContent = PREMIUM_PRICE;
  updateThemeButtons();
}
function buyPremium() {
  // PROTOTYPE ONLY — no real payment. Native build wires this to store IAP.
  progress.premium = true;
  saveProgress(progress);
  logEvent('purchase_success', { product: 'premium', prototype: true });
  applyThemePack(); updateHintButton();
  renderStore(t('premium_activated'));
}
function restorePurchase() {
  logEvent('purchase_restore', { prototype: true });
  applyThemePack(); updateHintButton();
  renderStore(isPremium() ? t('restored') : t('restore_none'));
}

/* ---------- theme packs ---------- */
// default (free) · mint (free, unlocked by clearing World 1) · dusk (premium-only)
function themeAllowed(pack) {
  if (pack === 'default') return true;
  if (pack === 'mint') return !!progress.themeUnlocked || isPremium();
  if (pack === 'dusk') return isPremium() || onPortal(); // 포털엔 결제가 없어 무료 개방(코스메틱)
  return false;
}
function currentThemePack() {
  let p = progress.theme || 'default';
  if (p === 'premium') p = 'dusk'; // back-compat with earlier saves
  return themeAllowed(p) ? p : 'default';
}
function applyThemePack() {
  document.documentElement.dataset.pack = currentThemePack();
}
function setThemePack(pack) {
  if (!themeAllowed(pack)) return;
  progress.theme = pack; saveProgress(progress);
  applyThemePack(); updateThemeButtons();
}
function updateThemeButtons() {
  const cur = currentThemePack();
  const defs = [
    ['#themeDefault', 'default', 'theme_default'],
    ['#themeMint', 'mint', 'theme_mint'],
    ['#themePremium', 'dusk', 'theme_dusk'],
  ];
  for (const [sel, pack, key] of defs) {
    const el = $(sel); if (!el) continue;
    const locked = !themeAllowed(pack);
    el.classList.toggle('sel', cur === pack && !locked);
    el.classList.toggle('locked', locked);
    el.innerHTML = t(key) + (locked ? ' <span class="lk">🔒</span>' : '');
  }
}
const canDusk = () => themeAllowed('mint') || themeAllowed('dusk'); // any extra theme available

/* ---------- progress backup / restore (Base64 code) ---------- */
function exportCode() {
  try { return 'SS1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, p: progress })))); }
  catch (e) { return ''; }
}
function importCode(code) {
  try {
    code = String(code).trim();
    if (code.startsWith('SS1.')) code = code.slice(4);
    const obj = JSON.parse(decodeURIComponent(escape(atob(code))));
    const p = (obj && obj.p) ? obj.p : obj; // tolerate a raw progress object too
    if (!p || typeof p !== 'object' || typeof p.completed !== 'object') return false;
    if (window.Store) Store.set(SAVE_KEY, JSON.stringify(p)); else localStorage.setItem(SAVE_KEY, JSON.stringify(p));
    return true;
  } catch (e) { return false; }
}
function openBackup() {
  $('#backupCode').value = exportCode();
  $('#importCode').value = '';
  $('#backupStatus').textContent = '';
  $('#backup').classList.add('show');
  logEvent('backup_open');
}
function closeBackup() { $('#backup').classList.remove('show'); }
function copyBackup() {
  const code = $('#backupCode').value;
  const ok = () => { $('#backupStatus').textContent = t('backup_copied'); };
  const fallback = () => { try { $('#backupCode').select(); document.execCommand('copy'); ok(); } catch (e) {} };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok).catch(fallback);
    else fallback();
  } catch (e) { fallback(); }
}
function doRestore() {
  if (importCode($('#importCode').value)) {
    $('#backupStatus').textContent = t('backup_ok');
    logEvent('backup_restore_ok');
    setTimeout(() => location.reload(), 700);
  } else {
    $('#backupStatus').textContent = t('backup_bad');
    logEvent('backup_restore_bad');
  }
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
  const tier = starTier(moves, st.min);
  const badgeEl = overlay.querySelector('.badge');
  badgeEl.innerHTML = [1, 2, 3].map(n => `<span class="st${n <= tier ? ' on' : ''}">★</span>`).join('');
  badgeEl.className = 'badge stars';
  overlay.querySelector('.result-title').textContent = t(optimal ? 'win_title_optimal' : 'win_title');
  overlay.querySelector('.result-sub').innerHTML =
    t('result_moves', { moves, min: st.min }) +
    (G.usedHint ? t('result_used_hint') : (optimal ? t('result_perfect') : '')) +
    (firstClear ? '' : t('result_recleared'));
  const daily = G.daily != null;
  const btnNextEl = overlay.querySelector('#btnNext');
  if (daily) {
    // record today's daily completion + streak
    const dk = todayKey();
    progress.daily[dk] = progress.daily[dk] || [false, false, false];
    progress.daily[dk][G.daily] = true;
    if (progress.daily[dk].every(Boolean)) {
      if (progress.streak.last !== dk) {
        progress.streak.n = (progress.streak.last === shiftDay(dk, -1)) ? (progress.streak.n + 1) : 1;
        progress.streak.last = dk;
      }
      // credit this day toward the weekly reward tracker
      ensureWeek();
      if (!progress.weekly.days.includes(dk)) progress.weekly.days.push(dk);
    }
    saveProgress(progress);
    btnNextEl.style.display = ''; btnNextEl.textContent = t('daily_back');
    overlay.dataset.mode = 'daily';
  } else {
    // linear progression: clearing unlocks the next stage
    progress.reached = Math.max(progress.reached, Math.min(STAGES.length - 1, G.index + 1));
    saveProgress(progress);
    const hasNext = G.index < STAGES.length - 1;
    btnNextEl.textContent = t('win_next');
    btnNextEl.style.display = hasNext ? '' : 'none';
    overlay.dataset.mode = 'normal';
  }
  overlay.classList.add('show');
  if (window.AdsManager) { AdsManager.gameplayStop(); AdsManager.happyTime(1); } // portal signals
  // midgame ad every 3rd clear (portal-gated via config; a no-op off-portal)
  G.clearsSinceAd = (G.clearsSinceAd || 0) + 1;
  if (G.clearsSinceAd >= 3) {
    G.clearsSinceAd = 0;
    if (window.AdsManager) { logEvent('midgame_ad', { platform: AdsManager.platform }); AdsManager.showInterstitial(); }
  }
  Sound.win(); haptic([20, 40, 60]); confettiBurst(); screenFlash();
  pieceEls().forEach((el, k) => { setTimeout(() => { el.classList.remove('win-bounce'); void el.offsetWidth; el.classList.add('win-bounce'); }, k * 70); });
  renderProgress();

  // world-clear reward: did this first-clear complete its whole world?
  // (skipped in daily mode to keep the daily flow clean)
  let worldDone = false, themeJustUnlocked = false;
  if (firstClear && !daily) {
    const w = worldOf(G.index);
    if (!progress.worldsDone[w]) {
      const start = w * WORLD_SIZE, end = Math.min(STAGES.length, start + WORLD_SIZE);
      let all = true;
      for (let i = start; i < end; i++) { if (!progress.completed[STAGES[i].id]) { all = false; break; } }
      if (all) {
        progress.worldsDone[w] = true;
        if (!progress.themeUnlocked) { progress.themeUnlocked = true; themeJustUnlocked = true; }
        saveProgress(progress);
        worldDone = true;
        setTimeout(() => showWorldReward(w, themeJustUnlocked), 900);
      }
    }
  }
  // one reward popup at a time: world milestone takes priority over a sticker
  if (!daily && !worldDone && newSticker) setTimeout(() => showStickerReward(stickersEarned() - 1), 900);
}

// world completion celebration (keeps the win overlay behind, like sticker reward)
function showWorldReward(w, themeUnlocked) {
  $('#worldEmoji').textContent = themeUnlocked ? '🎨' : '🏅';
  $('#worldTitle').textContent = t('world_done_title', { n: w + 1 });
  $('#worldSub').textContent = themeUnlocked ? t('world_done_theme') : t('world_done_go');
  $('#worldOverlay').classList.add('show');
  Sound.sticker(); haptic([30, 40, 30, 40, 60]); confettiBurst();
}

/* ---------- move budget ---------- */
// 각 스테이지의 이동 예산 = 최소이동 + 여유(약 +50%, 최소 +2). min 기반 자동 산출.
function budgetFor(min) { return min + Math.max(2, Math.ceil(min * 0.5)); }
function moveBudgetBase() { return G.stage ? budgetFor(G.stage.min) : 0; }
function moveBudget() { return moveBudgetBase() + (G.budgetBonus || 0); }
function movesLeft() { return moveBudget() - G.history.length; }

// 별 등급(표시 전용): 3=최소이동, 2=예산 여유의 절반 이내, 1=그 외 클리어
function starTier(moves, min) {
  if (moves == null) return 0;
  if (moves <= min) return 3;
  const half = Math.max(1, Math.ceil((budgetFor(min) - min) / 2));
  return moves <= min + half ? 2 : 1;
}

/* ---------- hud / navigation ---------- */
function updateHud() {
  const min = G.stage ? G.stage.min : 0;
  btnUndo.innerHTML = `${t('undo')} <span style="color:var(--muted);font-weight:600">${t('undo_meta', { n: G.history.length, max: moveBudget(), min })}</span>`;
}

function loadStage(index, dailySlot = null) {
  clearHintDemo();
  G.index = Math.max(0, Math.min(STAGES.length - 1, index));
  G.stage = STAGES[G.index];
  G.wallSet = new Set((G.stage.walls || []).map(w => w[0] + ',' + w[1])); // impassable cells
  G.state = clone(G.stage.start);
  G.history = [];
  G.selected = [];
  G.usedHint = false;
  G.attemptAdUsed = false;
  G.budgetBonus = 0;
  G.daily = dailySlot; // non-null => playing today's daily puzzle
  if (dailySlot === null) { progress.last = G.index; saveProgress(progress); } // daily doesn't move main progress
  updateHintButton();

  stageTitleEl.textContent = `${G.stage.id} · ${G.index + 1}/${STAGES.length}`;
  chapterEl.textContent = worldLabel(G.index);
  overlay.classList.remove('show');
  buildBoard();
  updateHud();
  updatePreview();
  renderProgress();
  if (window.AdsManager) AdsManager.gameplayStart(); // portal signal: level active
}

function renderProgress() {
  const done = Object.keys(progress.completed).filter(k => progress.completed[k]).length;
  progressBarEl.style.width = (done / STAGES.length * 100) + '%';
  progressTextEl.textContent = t('progress_done', { done, total: STAGES.length });
}

function renderStageList() {
  stageListEl.innerHTML = '';
  const total = STAGES.length;
  const worldCount = Math.ceil(total / WORLD_SIZE);
  const curWorld = worldOf(G.index);
  for (let w = 0; w < worldCount; w++) {
    const start = w * WORLD_SIZE, end = Math.min(total, start + WORLD_SIZE);
    const items = [];
    for (let i = start; i < end; i++) items.push({ s: STAGES[i], i });
    const done = items.filter(({ s }) => progress.completed[s.id]).length;
    const details = document.createElement('details');
    details.className = 'chapter';
    const isCur = w === curWorld;
    if (isCur) details.open = true;
    const theme = chapterName(STAGES[start].chapter); // difficulty flavor of this world
    const sum = document.createElement('summary');
    sum.className = 'chapter-head';
    sum.innerHTML =
      `<span class="cv"></span>` +
      `<span class="nm">${t('world', { n: w + 1 })} <em>${theme}</em></span>` +
      `<span class="cnt">${done}/${items.length}</span>`;
    details.appendChild(sum);
    const chips = document.createElement('div');
    chips.className = 'chips';
    details.appendChild(chips);
    // lazy: build a world's chips only when it is (or becomes) open — keeps
    // opening the drawer O(one world), so the stage count can grow freely
    const build = () => { if (details.dataset.built) return; details.dataset.built = '1'; buildChips(chips, items); };
    details.addEventListener('toggle', () => { if (details.open) build(); });
    if (isCur) build();
    stageListEl.appendChild(details);
  }
  const openEl = stageListEl.querySelector('details[open]');
  if (openEl) requestAnimationFrame(() => { try { openEl.scrollIntoView({ block: 'nearest' }); } catch (e) {} });
}
function buildChips(chips, items) {
  const frag = document.createDocumentFragment();
  for (const { s, i } of items) {
    const b = document.createElement('button');
    b.className = 'stage-chip';
    const done = !!progress.completed[s.id];
    const unlocked = isUnlocked(i);
    b.innerHTML = `<span class="sc-num">${s.seq}</span>`;
    if (done) {
      b.classList.add('done');
      const tier = starTier(progress.best[s.id], s.min); // 1~3단계, 색으로 구분
      b.insertAdjacentHTML('beforeend', `<span class="sc-star t${tier}">★</span>`);
    } else if (!unlocked) {
      b.classList.add('locked');
      b.insertAdjacentHTML('beforeend', `<span class="sc-lock">🔒</span>`);
    }
    if (i === G.index) b.classList.add('current');
    b.title = `${s.id} · ${s.min}`;
    if (unlocked) b.addEventListener('click', () => { loadStage(i); closeDrawer(); });
    else b.disabled = true;
    frag.appendChild(b);
  }
  chips.appendChild(frag);
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
      ? `<span class="emoji">${s.emoji}</span><span class="nm">${t(s.key)}</span>`
      : `<span class="emoji">?</span>`;
    grid.appendChild(cell);
  });
  const clears = firstClearCount();
  const next = earned < STICKERS.length ? (earned + 1) * CLEARS_PER_STICKER - clears : 0;
  $('#albumStatus').textContent = earned >= STICKERS.length
    ? t('album_status_done')
    : t('album_status', { n: earned, total: STICKERS.length, k: next });
}
function openAlbum() { renderAlbum(); albumOverlay.classList.add('show'); }
function closeAlbum() { albumOverlay.classList.remove('show'); }

function showStickerReward(index) {
  const s = STICKERS[index];
  // keep the win overlay (with the "다음 문제" button) behind this modal so it
  // returns after the sticker/album is closed
  const so = $('#stickerOverlay');
  $('#stickerEmoji').textContent = s.emoji;
  $('#stickerName').textContent = t('sticker_got', { name: t(s.key) });
  $('#stickerSub').textContent = t('sticker_sub', { n: stickersEarned(), total: STICKERS.length });
  so.classList.add('show');
  Sound.sticker(); haptic([30, 40, 30, 40, 60]); confettiBurst();
}

/* ---------- daily challenge (date-seeded 3 puzzles) ---------- */
let _dailyPools = null;
function dailyPools() {
  if (_dailyPools) return _dailyPools;
  const easy = [], med = [], hard = [];
  STAGES.forEach((s, i) => { if (s.min <= 2) easy.push(i); else if (s.min <= 4) med.push(i); else hard.push(i); });
  _dailyPools = [easy.length ? easy : [0], med.length ? med : [0], hard.length ? hard : [0]];
  return _dailyPools;
}
function hashStr(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dailyIndices(dateStr) {
  const pools = dailyPools(), base = hashStr('swapstep-' + dateStr);
  return pools.map((pool, k) => pool[(((base ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0) % pool.length)]);
}
function shiftDay(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}
const dailyOverlay = $('#daily');
function openDaily() { renderDaily(); dailyOverlay.classList.add('show'); logEvent('daily_open'); }
function closeDaily() { dailyOverlay.classList.remove('show'); }
function renderDaily() {
  const dk = todayKey();
  const idxs = dailyIndices(dk);
  const done = progress.daily[dk] || [false, false, false];
  $('#dailyDate').textContent = dk;
  $('#dailyStreak').textContent = t('daily_streak', { n: progress.streak.n || 0 });
  const labels = [t('daily_easy'), t('daily_medium'), t('daily_hard')];
  const wrap = $('#dailyList'); wrap.innerHTML = '';
  idxs.forEach((idx, slot) => {
    const s = STAGES[idx];
    const card = document.createElement('button');
    card.className = 'daily-card' + (done[slot] ? ' done' : '');
    card.innerHTML =
      `<span class="dc-lv">${labels[slot]}</span>` +
      `<span class="dc-meta">${s.n}×${s.n} · ${s.pieces}p · min ${s.min}</span>` +
      `<span class="dc-go">${done[slot] ? '✓' : '▶'}</span>`;
    card.addEventListener('click', () => { closeDaily(); loadStage(idx, slot); });
    wrap.appendChild(card);
  });
  $('#dailyAllDone').hidden = !done.every(Boolean);
  renderWeekly();
}

/* ---------- weekly reward panel ---------- */
function renderWeekly() {
  const n = weeklyDaysDone(); // completed days this week (0–7)
  const cntEl = $('#weeklyCount'); if (cntEl) cntEl.textContent = t('weekly_progress', { n });
  // 7 day dots, filled up to n
  const dots = $('#weeklyDots');
  if (dots) {
    dots.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const dot = document.createElement('span');
      dot.className = 'wk-dot' + (i < n ? ' on' : '');
      dots.appendChild(dot);
    }
  }
  // milestone reward chips
  const wrap = $('#weeklyRewards');
  if (!wrap) return;
  wrap.innerHTML = '';
  WEEKLY_MILESTONES.forEach((ms, i) => {
    const claimed = progress.weekly.claimed.includes(i);
    const ready = n >= ms.days && !claimed;
    const chip = document.createElement('button');
    chip.className = 'wk-reward' + (claimed ? ' claimed' : ready ? ' ready' : '');
    chip.disabled = !ready;
    chip.innerHTML =
      `<span class="wk-goal">${t('weekly_days', { d: ms.days })}</span>` +
      `<span class="wk-prize">💡 +${ms.hints}</span>` +
      `<span class="wk-state">${claimed ? '✓' : ready ? t('weekly_claim') : '🔒'}</span>`;
    if (ready) chip.addEventListener('click', () => claimWeekly(i));
    wrap.appendChild(chip);
  });
}

function claimWeekly(i) {
  ensureWeek();
  const ms = WEEKLY_MILESTONES[i];
  if (!ms || progress.weekly.claimed.includes(i) || weeklyDaysDone() < ms.days) return;
  progress.weekly.claimed.push(i);
  progress.bonusHints = (progress.bonusHints || 0) + ms.hints;
  saveProgress(progress);
  logEvent('weekly_reward', { days: ms.days, hints: ms.hints });
  Sound.sticker(); haptic([30, 40, 30, 40, 60]); confettiBurst();
  renderWeekly();
  updateHintButton();
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
  if (b) { b.textContent = on ? t('sound_on') : t('sound_off'); b.classList.toggle('off', !on); }
}
function toggleSound() {
  progress.settings.sound = progress.settings.sound === false;
  saveProgress(progress); applySoundIcon();
  if (progress.settings.sound) { Sound.unlock(); Sound.select(); }
}

/* ---------- branding (rebranding config) ---------- */
function applyBranding() {
  const b = window.BM_BRAND || {};
  const name = b.name || 'SwapStep', tag = b.tagline || '';
  const brandEl = document.querySelector('header .brand');
  if (brandEl) brandEl.innerHTML = name + (tag ? `<small>${tag}</small>` : '');
  if (name) document.title = name;
  // recolor only when a licensee set a non-default accent (keeps themes intact by default)
  if (b.accent && b.accent !== '#d98b4a') document.documentElement.style.setProperty('--accent', b.accent);
}

/* ---------- sitelock block screen ---------- */
function showSiteLock() {
  const name = (window.BM_BRAND && window.BM_BRAND.name) || 'SwapStep';
  const url = (window.BM_BRAND && window.BM_BRAND.officialUrl) || 'https://www.crazygames.com';
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;'
    + 'align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;'
    + 'background:#f3ead9;color:#3a3226;font-family:system-ui,-apple-system,sans-serif';
  d.innerHTML =
    '<div style="font-size:44px">🔒</div>'
    + '<div style="font-size:20px;font-weight:800">' + name + '</div>'
    + '<div style="font-size:14px;max-width:300px;line-height:1.55;color:#8a7f6d">' + t('sitelock_msg') + '</div>'
    + '<a href="' + url + '" target="_blank" rel="noopener" style="margin-top:4px;padding:12px 22px;'
    + 'border-radius:14px;background:#d98b4a;color:#fff;font-weight:700;text-decoration:none">'
    + t('sitelock_play') + '</a>';
  document.body.appendChild(d);
}

/* ---------- PWA (self-host only) ---------- */
function registerSW() {
  // 포털(CrazyGames 등)은 게임 번들을 자체 iframe에 재호스팅한다. 서비스워커/오프라인
  // 캐시는 자체호스팅·gh-pages 전용 기능이므로 포털에서는 등록하지 않는다.
  if (window.AdsManager && window.AdsManager.isPortal) return;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------- drawer ---------- */
const drawer = $('#drawer');
function openDrawer() { renderStageList(); drawer.classList.add('open'); } // build list on open only
function closeDrawer() { drawer.classList.remove('open'); }

/* ---------- wire up ---------- */
btnUndo.addEventListener('click', undo);
btnRestart.addEventListener('click', restart);
btnHint.addEventListener('click', useHint);
btnCommit.addEventListener('click', commitMove);
btnCancel.addEventListener('click', () => { G.selected = []; updatePreview(); });
$('#btnNext').addEventListener('click', () => {
  if (overlay.dataset.mode === 'daily') { overlay.classList.remove('show'); openDaily(); }
  else loadStage(G.index + 1);
});
$('#btnReplay').addEventListener('click', () => { overlay.classList.remove('show'); restart(); });
$('#btnStages').addEventListener('click', openDrawer);
// daily challenge
$('#btnDaily').addEventListener('click', openDaily);
$('#dailyClose').addEventListener('click', closeDaily);
$('#dailyBackdrop').addEventListener('click', closeDaily);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#drawerBackdrop').addEventListener('click', closeDrawer);

// album
$('#btnAlbum').addEventListener('click', openAlbum);
$('#albumClose').addEventListener('click', closeAlbum);
$('#albumBackdrop').addEventListener('click', closeAlbum);
$('#stickerOk').addEventListener('click', () => { $('#stickerOverlay').classList.remove('show'); openAlbum(); });
$('#worldOk').addEventListener('click', () => { $('#worldOverlay').classList.remove('show'); });

// tutorial / help
$('#btnHelp').addEventListener('click', openTutorial);
$('#tutorialStart').addEventListener('click', closeTutorial);

// settings
$('#btnSound').addEventListener('click', toggleSound);

// language selector
const langSelect = $('#langSelect');
window.I18N.langs.forEach(code => {
  const o = document.createElement('option');
  o.value = code; o.textContent = window.I18N.name(code);
  langSelect.appendChild(o);
});
langSelect.value = window.I18N.lang;
langSelect.addEventListener('change', () => window.I18N.setLang(langSelect.value));
// re-render dynamic strings when language changes (static handled by I18N.apply)
function refreshDynamic() {
  if ($('#langSelect')) $('#langSelect').value = window.I18N.lang;
  updateHud(); updateHintButton(); applySoundIcon(); renderProgress();
  if (G.stage) chapterEl.textContent = worldLabel(G.index);
  document.querySelectorAll('#layer .piece .stop').forEach(el => el.textContent = t('stop_badge')); // 배지 언어 갱신
  updatePreview();
  if (drawer.classList.contains('open')) renderStageList();
  if ($('#store').classList.contains('show')) renderStore('');
  if (albumOverlay.classList.contains('show')) renderAlbum();
  if (dailyOverlay.classList.contains('show')) renderDaily();
}
window.onLangChange = refreshDynamic;

// backup / restore
$('#btnBackup').addEventListener('click', openBackup);
$('#backupClose').addEventListener('click', closeBackup);
$('#backupBackdrop').addEventListener('click', closeBackup);
$('#backupCopy').addEventListener('click', copyBackup);
$('#backupRestore').addEventListener('click', doRestore);

// store / monetization
$('#btnStore').addEventListener('click', () => openStore());
$('#storeClose').addEventListener('click', closeStore);
$('#storeBackdrop').addEventListener('click', closeStore);
$('#buyPremium').addEventListener('click', buyPremium);
$('#restorePurchase').addEventListener('click', restorePurchase);
$('#themeDefault').addEventListener('click', () => setThemePack('default'));
$('#themeMint').addEventListener('click', () => setThemePack('mint'));
$('#themePremium').addEventListener('click', () => setThemePack('dusk'));
// rewarded ad — offer buttons; the play-modal buttons (#adReward/#adClose)
// are wired per-invocation by showSimulatedAd (local adapter)
$('#adWatch').addEventListener('click', watchAd);
$('#adOfferClose').addEventListener('click', closeAd);
$('#btnMoreMoves').addEventListener('click', offerMoreMoves);

document.addEventListener('keydown', e => {
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  else if (e.key === 'Enter' && !btnCommit.disabled) commitMove();
  // Escape는 포털(CrazyGames)에서 전체화면 종료용이라 게임 동작에 쓰지 않는다. 선택 해제는 '취소' 버튼 사용.
  else if (e.key === 'r') restart();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!G.stage) return;
    applyStaticGeometry();
    const preview = G.selected.length === 2 ? outcome(G.state, G.selected, G.stage.n, G.wallSet) : null;
    refreshPieces(preview);
  }, 120);
});

// unlock audio on the first user gesture (autoplay policies)
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

// init — bring up the platform + storage backend first (SDK loads on portals),
// then load progress from the correct backend, then render the UI.
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r('timeout'), ms))]);
async function boot() {
  // 사이트락: 허용되지 않은 호스트면 게임 대신 안내 화면을 띄우고 중단(광고/SDK도 로드 안 함)
  if (window.BM_hostAllowed && !window.BM_hostAllowed()) { showSiteLock(); return; }
  if (window.AdsManager) {
    try {
      const name = await withTimeout(AdsManager.init({
        onRewardedSimulate: showSimulatedAd,
        onAdStarted: () => { Sound.mute(); },   // 광고 실제 표시 → 음소거
        onAdEnded: () => { Sound.unmute(); },   // 광고 종료(성공/실패) → 복구
      }), 6000); // SDK가 멈춰도 게임은 항상 뜨도록 타임아웃 후 진행
      logEvent('platform_ready', { platform: name });
    } catch (e) {}
  }
  // 포털 SDK 저장소가 준비됐다면 그 백엔드에서 진행도를 다시 읽는다(부팅 전엔 localStorage 기본값).
  if (window.Store && Store.backend === 'sdk') progress = loadProgress();

  reconcileReached();        // unlock up to the furthest completed stage (migration)
  applyBranding();           // apply rebranding config (name/tagline/accent)
  window.I18N.apply();       // fill static data-i18n strings
  applySoundIcon();
  resetDailyIfNeeded();
  applyThemePack();
  updateHintButton();
  registerSW();
  loadStage(progress.last || 0);        // start at last played stage
  if (!progress.tutorialSeen) openTutorial(); // first-run tutorial
}
boot();

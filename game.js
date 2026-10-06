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
  '방향 칸': 'ch_dir', '회전 칸': 'ch_turn', '칸 섞기': 'ch_mix',
};
const chapterName = ko => (CHAPTER_KEY[ko] ? t(CHAPTER_KEY[ko]) : ko);
const WORLD_SIZE = 30; // stages per world in the picker
const worldOf = index => Math.floor(index / WORLD_SIZE); // 0-based world of a stage index
const WORLD_TINTS = 7; // 배경 색조 순환 개수(기본 테마에서만 적용; index.html의 data-world-tint 규칙과 짝)
function applyWorldTint(index) { document.documentElement.dataset.worldTint = String(worldOf(index) % WORLD_TINTS); }

const VECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // 0=right 1=down 2=left 3=up
const DIR_LABEL = ['→', '↓', '←', '↑'];
const PIECE_COLORS = ['#e8743b', '#2f8f83', '#7b6cd9', '#c0497b']; // supports up to 4
// 조각·목표의 짝 표시: 숫자를 쓰면 "1번부터 순서대로 누르라"는 뜻으로 읽혀서(사람 테스트에서 확인) 색 + 모양으로 짝을 표시한다.
// 윤곽이 서로 확실히 다른 해·달·별·하트(여행 앨범 분위기)라 작은 화면·색 구분이 어려운 사람도 짝을 찾는다.
// 순서(조각 색): 해=주황 달=초록 별=보라 하트=분홍
const SHAPE_SVG = [
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.8" fill="currentColor"/><path d="M18.6 12L21.4 12M16.7 16.7L18.6 18.6M12 18.6L12 21.4M7.3 16.7L5.4 18.6M5.4 12L2.6 12M7.3 7.3L5.4 5.4M12 5.4L12 2.6M16.7 7.3L18.6 5.4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 3.6a8.6 8.6 0 1 0 5 13.4 7 7 0 0 1-5-13.4z" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.4S3.6 15.5 3.6 9.6A4.5 4.5 0 0 1 12 7.2a4.5 4.5 0 0 1 8.4 2.4c0 5.9-8.4 10.8-8.4 10.8z" fill="currentColor"/></svg>',
];
const SHAPE_CHAR = ['☀︎', '☾', '★', '♥︎']; // 힌트 문구 안에서 쓰는 글자(︎ = 이모지 그림 말고 글자 모양으로)
const SHAPE_NAME = ['sun', 'moon', 'star', 'heart'];

const clone = s => s.map(p => p.slice());
const key = s => s.flat().join(',');

// walls: optional Set of "x,y" strings marking impassable cells (kept identical to rules.cjs)
// tiles: optional Map "x,y" -> kind. 0~3 = 방향 칸(들어선 조각의 화살표가 그 방향이 됨),
//        TILE_TURN(4) = 회전 칸(들어선 조각의 화살표가 시계 방향으로 90°). 칸은 막지 않는다.
const TILE_TURN = 4;
function applyTiles(s, out, pair, tiles) {
  if (!tiles || !tiles.size) return out;
  for (const i of pair) {
    const p = out[i];
    if (p[0] === s[i][0] && p[1] === s[i][1]) continue; // 실제로 들어선 조각만
    const k = tiles.get(p[0] + ',' + p[1]);
    if (k != null) p[2] = k === TILE_TURN ? (p[2] + 1) % 4 : k;
  }
  return out;
}
function outcome(s, pair, n, walls, tiles) {
  const t = clone(s), [a, b] = pair;
  [t[a][2], t[b][2]] = [t[b][2], t[a][2]];
  const proposed = t.map((p, i) => {
    if (i !== a && i !== b) return p.slice(0, 2);
    const [dx, dy] = VECTORS[p[2]], x = p[0] + dx, y = p[1] + dy;
    const blocked = x < 0 || x >= n || y < 0 || y >= n || s.some(q => q[0] === x && q[1] === y) || (walls && walls.has(x + ',' + y));
    return blocked ? p.slice(0, 2) : [x, y];
  });
  return applyTiles(s, t.map((p, i) => {
    const q = proposed[i];
    const collision = proposed.filter(r => r[0] === q[0] && r[1] === q[1]).length > 1;
    return [collision ? p[0] : q[0], collision ? p[1] : q[1], p[2]];
  }), pair, tiles);
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
function solveNext(state, targets, n, walls, tiles) {
  if (isGoal(state, targets)) return null;
  const pairs = pairsFor(state.length);
  const startKey = key(state);
  const parent = new Map([[startKey, null]]);
  const queue = [state];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    for (const pr of pairs) {
      const t = outcome(s, pr, n, walls, tiles), k = key(t);
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
    cloud: { linked: false, email: '' }, // Google 계정 클라우드 동기화 상태
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
  if (!p.cloud) p.cloud = { linked: false, email: '' };
  // migrate: existing players keep access up to their furthest completed stage
  return p;
}
function saveProgress(p) {
  try { if (window.Store) Store.set(SAVE_KEY, JSON.stringify(p)); else localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (e) {}
  if (p.cloud && p.cloud.linked && window.CloudSync && CloudSync.user) CloudSync.pushDebounced(CloudSync.user.uid, p);
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
const WIN_REVEAL_MS = 650; // 마지막 이동 후 결과 창이 뜨기까지(판 위 축하 동작을 먼저 보여줌)
// 플레이로 얻는 보너스 힌트(매일 초기화 안 됨): 광고가 없는 곳(포털 Basic 단계 등)에서도 막히면 쓸 수 있게
const HINTS_PER_STICKER = 1, HINTS_PER_GOLD = 2, HINTS_PER_WORLD = 3;
const AD_GRACE_CLEARS = 10; // 첫 10판은 중간 광고 없음
const ADS_EVERY_CLEARS = 3; // 그 뒤 3판마다 레벨 전환 때 중간 광고(포털 SDK가 3분 간격도 따로 지킴)
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
// 광고 제안을 보여줘도 되는지(CrazyGames Basic 단계·SDK 로드 실패면 false → 광고 버튼 숨김)
// 유료 결제를 보여줄 수 있는지(포털·공개 사이트=false → 프리미엄 구매/복원/약관 숨김, 황혼 테마 무료)
const paymentsOn = () => !!(window.AdsManager && window.AdsManager.paymentsEnabled);
const adsOn = () => !window.AdsManager || window.AdsManager.adsEnabled !== false;
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

/* ---------- 오류 대비 ----------
 * 게임이 다 뜨기 전에 오류가 나면 빈 화면 대신 '새로고침' 안내를 띄운다. 오류는 이용 기록(logEvent)에 남긴다.
 * 광고 SDK 등 다른 사이트 스크립트의 오류("Script error.", 파일 정보 없음)는 게임 오류로 보지 않는다. */
let booted = false;
{ // 라이선스로 이름을 바꾼 빌드면 로딩 화면 이름도 바꾼다
  const nm = window.BM_BRAND && window.BM_BRAND.name, el = document.querySelector('#splash .sp-brand');
  if (el && nm && nm !== 'SwapStep') el.textContent = nm;
}
function hideSplash() {
  const sp = document.getElementById('splash'); if (!sp) return;
  sp.classList.add('gone'); setTimeout(() => sp.remove(), 400);
}
function showCrash() {
  if (document.getElementById('crash')) return;
  const tr = (k, en) => { try { const v = t(k); return v && v !== k ? v : en; } catch (e) { return en; } };
  const d = document.createElement('div');
  d.id = 'crash';
  d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;'
    + 'justify-content:center;gap:16px;padding:24px;text-align:center;background:#f3ead9;color:#3a3226;'
    + 'font-family:system-ui,-apple-system,sans-serif';
  d.innerHTML = '<div style="font-size:44px">🧩</div>'
    + '<div style="font-size:15px;max-width:300px;line-height:1.55">' + tr('crash_msg', 'Something went wrong while loading the game.') + '</div>'
    + '<button style="padding:12px 22px;border:0;border-radius:14px;background:#d98b4a;color:#fff;font-weight:700;font-size:15px;cursor:pointer">'
    + tr('crash_reload', 'Reload') + '</button>';
  d.querySelector('button').addEventListener('click', () => location.reload());
  document.body.appendChild(d);
  hideSplash();
}
const ownScript = f => { try { return !!f && new URL(f, location.href).origin === location.origin; } catch (e) { return false; } };
window.addEventListener('error', e => {
  if (!ownScript(e.filename)) return;
  logEvent('js_error', { msg: String(e.message).slice(0, 200), src: String(e.filename).split('/').pop(), line: e.lineno });
  if (!booted) showCrash();
});
window.addEventListener('unhandledrejection', e => {
  const r = e.reason; logEvent('js_error', { msg: String((r && r.message) || r).slice(0, 200), kind: 'promise' });
});

/* ---------- album (travel stickers) ---------- */
// One sticker per 5 first-clears; 6 stickers complete page one (at 30 clears).
/* ---------- travel album: one page per world ----------
 * 월드마다 여행지 1곳. 그 월드에서 5문제 클리어마다 스티커 1장(6장), 30문제를 모두 3★로
 * 깨면 골드 스티커. 1페이지(여행 준비)는 예전 6장 그대로(이름 키 유지). 이름은 i18n.js 대신
 * 여기 5개 언어를 함께 둔다(35곳×5언어를 키로 쪼개면 관리가 더 어려움). */
const ALBUM = [
  { icon: '🧳', name: { en: 'Getting Ready', ko: '여행 준비', es: 'Preparativos', pt: 'Preparativos', ru: 'Сборы' },
    st: ['🧭', '🗺️', '🎒', '📸', '✈️', '🏝️'], keys: ['st_compass', 'st_map', 'st_backpack', 'st_photo', 'st_plane', 'st_island'] },
  { icon: '🗼', name: { en: 'Paris', ko: '파리', es: 'París', pt: 'Paris', ru: 'Париж' }, st: ['🥐', '🗼', '🎨', '🍷', '🧀', '🚲'] },
  { icon: '🎡', name: { en: 'London', ko: '런던', es: 'Londres', pt: 'Londres', ru: 'Лондон' }, st: ['💂', '☕', '🚌', '🎡', '☂️', '👑'] },
  { icon: '🌷', name: { en: 'Amsterdam', ko: '암스테르담', es: 'Ámsterdam', pt: 'Amsterdã', ru: 'Амстердам' }, st: ['🌷', '🛶', '🏘️', '🌬️', '🥞', '🚤'] },
  { icon: '🎻', name: { en: 'Vienna', ko: '빈', es: 'Viena', pt: 'Viena', ru: 'Вена' }, st: ['🎻', '🎹', '🍰', '🎼', '🏰', '🦢'] },
  { icon: '🏔️', name: { en: 'Swiss Alps', ko: '스위스 알프스', es: 'Alpes suizos', pt: 'Alpes suíços', ru: 'Швейцарские Альпы' }, st: ['🏔️', '🍫', '⛷️', '🐄', '🔔', '🚠'] },
  { icon: '🎭', name: { en: 'Venice', ko: '베네치아', es: 'Venecia', pt: 'Veneza', ru: 'Венеция' }, st: ['🎭', '🚣', '🍨', '🕊️', '🧵', '🌉'] },
  { icon: '🏛️', name: { en: 'Rome', ko: '로마', es: 'Roma', pt: 'Roma', ru: 'Рим' }, st: ['🏛️', '🍝', '🍦', '⛲', '🛵', '🏺'] },
  { icon: '💃', name: { en: 'Barcelona', ko: '바르셀로나', es: 'Barcelona', pt: 'Barcelona', ru: 'Барселона' }, st: ['💃', '⚽', '🥘', '🎸', '⛪', '🌞'] },
  { icon: '⛵', name: { en: 'Santorini', ko: '산토리니', es: 'Santorini', pt: 'Santorini', ru: 'Санторини' }, st: ['🌊', '⛵', '🐙', '🍋', '☀️', '🐚'] },
  { icon: '🌋', name: { en: 'Iceland', ko: '아이슬란드', es: 'Islandia', pt: 'Islândia', ru: 'Исландия' }, st: ['🌋', '🧊', '🐋', '♨️', '🌌', '🐑'] },
  { icon: '🕌', name: { en: 'Istanbul', ko: '이스탄불', es: 'Estambul', pt: 'Istambul', ru: 'Стамбул' }, st: ['🕌', '🧿', '🍢', '🐈', '🛍️', '🎠'] },
  { icon: '🐪', name: { en: 'Cairo', ko: '카이로', es: 'El Cairo', pt: 'Cairo', ru: 'Каир' }, st: ['🐪', '🏜️', '🔺', '📜', '🌴', '🪲'] },
  { icon: '🦁', name: { en: 'Kenya Safari', ko: '케냐 사파리', es: 'Safari en Kenia', pt: 'Safári no Quênia', ru: 'Сафари в Кении' }, st: ['🦁', '🦒', '🐘', '🦓', '🐆', '🥾'] },
  { icon: '🏙️', name: { en: 'Dubai', ko: '두바이', es: 'Dubái', pt: 'Dubai', ru: 'Дубай' }, st: ['🏙️', '🐫', '🌇', '💎', '🚁', '🛥️'] },
  { icon: '🐅', name: { en: 'India', ko: '인도', es: 'India', pt: 'Índia', ru: 'Индия' }, st: ['🍛', '🐅', '🪔', '🎆', '🧣', '🐒'] },
  { icon: '🛕', name: { en: 'Bangkok', ko: '방콕', es: 'Bangkok', pt: 'Bangkok', ru: 'Бангкок' }, st: ['🛺', '🥭', '🛕', '🌶️', '🥥', '🐓'] },
  { icon: '🌾', name: { en: 'Bali', ko: '발리', es: 'Bali', pt: 'Bali', ru: 'Бали' }, st: ['🏄', '🌾', '🦎', '🎋', '🍹', '🙏'] },
  { icon: '🐼', name: { en: 'Beijing', ko: '베이징', es: 'Pekín', pt: 'Pequim', ru: 'Пекин' }, st: ['🐼', '🥟', '🏮', '🐉', '🧧', '🍵'] },
  { icon: '🏯', name: { en: 'Seoul', ko: '서울', es: 'Seúl', pt: 'Seul', ru: 'Сеул' }, st: ['🏯', '🍚', '🎤', '🍗', '🥢', '🎮'] },
  { icon: '🗻', name: { en: 'Tokyo', ko: '도쿄', es: 'Tokio', pt: 'Tóquio', ru: 'Токио' }, st: ['🍣', '🗻', '🎎', '🍜', '🌸', '🚄'] },
  { icon: '🦘', name: { en: 'Sydney', ko: '시드니', es: 'Sídney', pt: 'Sydney', ru: 'Сидней' }, st: ['🦘', '🐨', '🦈', '🏏', '🌞', '🏖️'] },
  { icon: '🥝', name: { en: 'New Zealand', ko: '뉴질랜드', es: 'Nueva Zelanda', pt: 'Nova Zelândia', ru: 'Новая Зеландия' }, st: ['🥝', '🏞️', '🧗', '🌿', '🚣', '🐏'] },
  { icon: '🌺', name: { en: 'Hawaii', ko: '하와이', es: 'Hawái', pt: 'Havaí', ru: 'Гавайи' }, st: ['🌺', '🍍', '🐢', '🌈', '🤙', '🌅'] },
  { icon: '🌉', name: { en: 'San Francisco', ko: '샌프란시스코', es: 'San Francisco', pt: 'São Francisco', ru: 'Сан-Франциско' }, st: ['🌉', '🚋', '🌁', '🍞', '🦀', '🚴'] },
  { icon: '🗽', name: { en: 'New York', ko: '뉴욕', es: 'Nueva York', pt: 'Nova York', ru: 'Нью-Йорк' }, st: ['🗽', '🍕', '🚕', '🥯', '🎭', '🌃'] },
  { icon: '🍁', name: { en: 'Canada', ko: '캐나다', es: 'Canadá', pt: 'Canadá', ru: 'Канада' }, st: ['🍁', '🐻', '🏒', '🦌', '❄️', '🍯'] },
  { icon: '🌮', name: { en: 'Mexico', ko: '멕시코', es: 'México', pt: 'México', ru: 'Мексика' }, st: ['🌮', '🌵', '🎺', '🥑', '🎊', '🦅'] },
  { icon: '🦜', name: { en: 'Caribbean', ko: '카리브해', es: 'Caribe', pt: 'Caribe', ru: 'Карибы' }, st: ['🏴‍☠️', '🦜', '🐠', '💰', '⚓', '🐬'] },
  { icon: '🦋', name: { en: 'Amazon', ko: '아마존', es: 'Amazonas', pt: 'Amazônia', ru: 'Амазония' }, st: ['🐸', '🦋', '🐊', '🌳', '🍃', '🐍'] },
  { icon: '🦙', name: { en: 'Peru', ko: '페루', es: 'Perú', pt: 'Peru', ru: 'Перу' }, st: ['🦙', '🌽', '🧶', '🌄', '🥔', '🎶'] },
  { icon: '🥁', name: { en: 'Rio de Janeiro', ko: '리우데자네이루', es: 'Río de Janeiro', pt: 'Rio de Janeiro', ru: 'Рио-де-Жанейро' }, st: ['🎉', '🥁', '🦩', '🌊', '⛰️', '🍌'] },
  { icon: '🐧', name: { en: 'Antarctica', ko: '남극', es: 'Antártida', pt: 'Antártida', ru: 'Антарктида' }, st: ['🐧', '🛷', '🌨️', '⛸️', '🧤', '🔭'] },
  { icon: '🦌', name: { en: 'Lapland', ko: '라플란드', es: 'Laponia', pt: 'Lapônia', ru: 'Лапландия' }, st: ['🎅', '🦌', '🌌', '🛷', '❄️', '🧣'] },
  { icon: '🚀', name: { en: 'Space', ko: '우주', es: 'El espacio', pt: 'Espaço', ru: 'Космос' }, st: ['🚀', '🌙', '🪐', '🛰️', '☄️', '🌟'] },
];
const CLEARS_PER_STICKER = 5;
const STICKERS_PER_PAGE = 6;
// 나중에 추가한 언어의 여행지 이름(ALBUM 순서 그대로). 표에 없으면 영어로
const ALBUM_EXTRA = {
  de: ['Reisevorbereitung', 'Paris', 'London', 'Amsterdam', 'Wien', 'Schweizer Alpen', 'Venedig', 'Rom', 'Barcelona', 'Santorin', 'Island', 'Istanbul', 'Kairo', 'Kenia-Safari', 'Dubai', 'Indien', 'Bangkok', 'Bali', 'Peking', 'Seoul', 'Tokio', 'Sydney', 'Neuseeland', 'Hawaii', 'San Francisco', 'New York', 'Kanada', 'Mexiko', 'Karibik', 'Amazonas', 'Peru', 'Rio de Janeiro', 'Antarktis', 'Lappland', 'Weltall'],
  fr: ['Préparatifs', 'Paris', 'Londres', 'Amsterdam', 'Vienne', 'Alpes suisses', 'Venise', 'Rome', 'Barcelone', 'Santorin', 'Islande', 'Istanbul', 'Le Caire', 'Safari au Kenya', 'Dubaï', 'Inde', 'Bangkok', 'Bali', 'Pékin', 'Séoul', 'Tokyo', 'Sydney', 'Nouvelle-Zélande', 'Hawaï', 'San Francisco', 'New York', 'Canada', 'Mexique', 'Caraïbes', 'Amazonie', 'Pérou', 'Rio de Janeiro', 'Antarctique', 'Laponie', 'L’espace'],
};
const placeName = w => {
  const n = ALBUM[w].name, l = window.I18N.lang;
  return n[l] || (ALBUM_EXTRA[l] && ALBUM_EXTRA[l][w]) || n.en;
};
const stickerName = (w, k) => (ALBUM[w].keys ? t(ALBUM[w].keys[k]) : placeName(w));
const worldRange = w => [w * WORLD_SIZE, Math.min(STAGES.length, (w + 1) * WORLD_SIZE)];
function worldClears(w) {
  const [a, b] = worldRange(w); let n = 0;
  for (let i = a; i < b; i++) if (progress.completed[STAGES[i].id]) n++;
  return n;
}
const worldStickers = w => Math.min(STICKERS_PER_PAGE, Math.floor(worldClears(w) / CLEARS_PER_STICKER));
function worldGold(w) {
  const [a, b] = worldRange(w);
  for (let i = a; i < b; i++) { const s = STAGES[i]; if (starTier(progress.best[s.id], s.min) !== 3) return false; }
  return true;
}
const albumTotal = () => ALBUM.length * (STICKERS_PER_PAGE + 1);
function albumEarned() {
  let n = 0;
  for (let w = 0; w < ALBUM.length; w++) n += worldStickers(w) + (worldGold(w) ? 1 : 0);
  return n;
}

/* ---------- sound (WebAudio synth, no asset files) + haptics ---------- */
const Sound = (() => {
  let ctx = null, master = null, echo = null;
  // 광고 중 음소거와 포털 사이트 음소거는 따로 기억 — 광고가 끝나도 사이트가 음소거면 계속 조용히
  let adMuted = false, siteMuted = false;
  const level = () => (adMuted || siteMuted ? 0 : 0.85);
  const applyLevel = () => { if (master) master.gain.value = level(); };
  const ready = () => {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = false; }
      if (ctx) {
        master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination);
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
    const { type = 'sine', gain = 0.15, when = 0, attack = 0.008, glide = 0, wet = 0.4, dest = master } = o;
    const t = c.currentTime + when;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest);
    if (echo && wet) { const s = c.createGain(); s.gain.value = gain * wet; g.connect(s); s.connect(echo); }
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  const on = () => progress.settings && progress.settings.sound !== false;
  /* 배경 음악: 음원 없이 즉석 합성(용량 0). 잔잔한 화음(C–Am–F–G) + 가끔 마림바 멜로디.
   * master를 거치므로 광고 중·사이트 음소거가 그대로 적용된다. 탭을 벗어나면 오디오 전체를 멈춘다. */
  const BEAT = 60 / 76;
  const CHORDS = [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]];
  const MEL = [[523.25, 659.25, 783.99, 1046.5], [440.0, 523.25, 659.25, 880.0], [349.23, 440.0, 523.25, 698.46], [392.0, 493.88, 587.33, 783.99]];
  let music = null;
  const musicOn = () => progress.settings && progress.settings.music !== false;
  const rnd = n => { let x = Math.imul(n ^ 0x5bd1e995, 2654435761) >>> 0; x = (x ^ (x >>> 15)) >>> 0; return (x % 1000) / 1000; }; // 같은 박자엔 같은 음
  function beat(step, at) {
    const c = ctx, w = Math.max(0, at - c.currentTime), bar = Math.floor(step / 4) % 4, d = music.g;
    if (step % 4 === 0) {
      CHORDS[bar].forEach(f => voice(f, BEAT * 4.2, { type: 'sine', gain: 0.018, attack: 0.9, when: w, wet: 0.5, dest: d }));
      voice(CHORDS[bar][0] / 2, BEAT * 3.5, { type: 'triangle', gain: 0.026, attack: 0.05, when: w, wet: 0.2, dest: d });
    }
    if (rnd(step) < 0.55) {
      const f = MEL[bar][Math.floor(rnd(step + 977) * 4)];
      voice(f, 0.55, { type: 'sine', gain: 0.03, attack: 0.004, when: w, wet: 0.7, dest: d });
      voice(f * 2, 0.2, { type: 'sine', gain: 0.007, attack: 0.004, when: w, wet: 0.4, dest: d });
    }
    if (step % 8 === 6 && rnd(step + 31) < 0.6) { // 반 박자 뒤 꾸밈음
      voice(MEL[bar][2], 0.4, { type: 'sine', gain: 0.02, attack: 0.004, when: w + BEAT / 2, wet: 0.7, dest: d });
    }
  }
  function schedule() {
    if (!music || !ctx) return;
    while (music.next < ctx.currentTime + 0.5) { beat(music.step, music.next); music.next += BEAT; music.step++; }
  }
  const SEL = [523.25, 587.33, 659.25, 783.99];               // C5 D5 E5 G5 by piece
  const LOCK = [523.25, 659.25, 783.99, 987.77, 1174.66];      // rising as pieces land
  return {
    // 마림바처럼 둥근 소리: 사인 기음 + 옅은 2배음, 짧게 감쇠 (거친 톱니/사각파는 쓰지 않는다)
    selectAt(i) { if (on()) { const f = SEL[i % SEL.length]; voice(f, 0.16, { type: 'sine', gain: 0.13, attack: 0.003, wet: 0.3 }); voice(f * 2, 0.08, { type: 'sine', gain: 0.035, attack: 0.003, wet: 0.2 }); } },
    select() { this.selectAt(0); },
    swap() { if (on()) { voice(587.33, 0.09, { type: 'sine', gain: 0.08, glide: 784, wet: 0.35 }); voice(784, 0.1, { type: 'sine', gain: 0.07, when: 0.05, glide: 587.33, wet: 0.35 }); } },
    move() { if (on()) { voice(392, 0.16, { type: 'sine', gain: 0.12, glide: 523.25, wet: 0.45 }); voice(784, 0.09, { type: 'triangle', gain: 0.03, when: 0.03, wet: 0.3 }); } },
    // 막힘: 나무 블록을 '톡' 두드린 소리 — 틀렸다는 경고음이 아니라 부딪힘 느낌
    // 방향/회전 칸: 짧게 '휙' 올라가는 소리
    tile() { if (on()) { voice(660, 0.12, { type: 'sine', gain: 0.09, glide: 990, wet: 0.5 }); voice(1320, 0.07, { type: 'sine', gain: 0.025, when: 0.04, wet: 0.4 }); } },
    blocked() { if (on()) { voice(240, 0.09, { type: 'sine', gain: 0.12, attack: 0.002, glide: 170, wet: 0.15 }); voice(480, 0.04, { type: 'triangle', gain: 0.03, attack: 0.002, wet: 0.05 }); } },
    lock(step) { if (on()) { const f = LOCK[Math.min(step, LOCK.length - 1)]; voice(f, 0.55, { type: 'sine', gain: 0.18, attack: 0.003, wet: 0.9 }); voice(f * 2, 0.35, { type: 'triangle', gain: 0.05, when: 0.004, wet: 0.6 }); } },
    win() { if (on()) [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => voice(f, 0.5, { type: 'triangle', gain: 0.16, when: i * 0.085, wet: 0.8 })); },
    sticker() { if (on()) [784, 988, 1319, 1568].forEach((f, i) => voice(f, 0.4, { type: 'sine', gain: 0.14, when: i * 0.07, wet: 0.9 })); },
    unlock() { ready(); this.startMusic(); }, // call on first user gesture
    startMusic() {
      if (music || !musicOn()) return;
      const c = ready(); if (!c) return;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(1, c.currentTime + 2.5); // 서서히 들어오게
      g.connect(master);
      music = { g, next: c.currentTime + 0.15, step: 0, timer: setInterval(schedule, 150) };
      schedule();
    },
    stopMusic() {
      if (!music) return;
      const m = music; music = null; clearInterval(m.timer);
      try { m.g.gain.cancelScheduledValues(ctx.currentTime); m.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); } catch (e) {}
      setTimeout(() => { try { m.g.disconnect(); } catch (e) {} }, 900);
    },
    // 탭/앱을 벗어나면 소리 전체 정지, 돌아오면 재개(광고·사이트 음소거 상태는 그대로)
    setHidden(h) {
      if (!ctx) return;
      try { if (h) ctx.suspend(); else ctx.resume(); } catch (e) {}
      if (!h && music) music.next = Math.max(music.next, ctx.currentTime + 0.1);
    },
    // 광고 표시 중 전체 음소거 (포털 규격: 광고 시작 시 음소거, 종료 시 복구)
    mute() { adMuted = true; applyLevel(); },
    unmute() { adMuted = false; applyLevel(); },
    // 포털 사이트의 음소거 설정(CrazyGames muteAudio) — 게임 안 소리 설정보다 우선
    setSiteMuted(m) { siteMuted = !!m; applyLevel(); },
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
// 잠금 해제선 = 0번부터 "끊김 없이" 연속 클리어한 개수. 데일리 챌린지는 전체 스테이지에서
// 아무 번호나 뽑으므로, 그걸로 찍힌 뒤쪽 클리어 하나가 해제선을 끌어올리면 안 된다(과거엔 최댓값 기준이라
// 데일리로 월드26 문제 하나 풀면 그 앞이 전부 풀렸음). 매 부팅 재계산이라 이미 부풀려진 저장값도 자동 복구.
function contiguousReached(completed) {
  let i = 0;
  while (i < STAGES.length && completed[STAGES[i].id]) i++;
  return Math.min(STAGES.length - 1, i);
}
function reconcileReached() {
  const target = contiguousReached(progress.completed);
  let changed = false;
  if (target !== progress.reached) { progress.reached = target; changed = true; }
  if (progress.last > progress.reached) { progress.last = progress.reached; changed = true; }
  if (changed) saveProgress(progress);
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
const movesInfoEl = $('#movesInfo');
const goalInfoEl = $('#goalInfo');
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
    const tk = G.tileMap && G.tileMap.get(x + ',' + y);
    if (tk === TILE_TURN) { cell.classList.add('tile', 'tile-turn'); cell.innerHTML = TURN_SVG; }
    else if (tk != null) { cell.classList.add('tile', 'tile-dir'); cell.innerHTML = `<span style="transform:rotate(${tk * 90}deg)">${TILE_ARROW_SVG}</span>`; }
    if (tk != null && G.stage.targets.some(t => t[0] === x && t[1] === y)) cell.classList.add('under-target');
    gridEl.appendChild(cell);
  }

  G.stage.targets.forEach((t, i) => {
    const g = document.createElement('div');
    g.className = 'target';
    g.dataset.i = i;
    g.style.setProperty('--c', PIECE_COLORS[i]);
    g.innerHTML = `<span class="mark">${SHAPE_SVG[i]}</span>`;
    layerEl.appendChild(g);
  });

  G.state.forEach((p, i) => {
    const tok = document.createElement('button');
    tok.className = 'piece';
    tok.dataset.i = i;
    tok.style.setProperty('--c', PIECE_COLORS[i]);
    tok.setAttribute('aria-label', SHAPE_NAME[i]);
    tok.innerHTML = `<span class="num">${SHAPE_SVG[i]}</span><span class="arrow">${ARROW_SVG}</span>`;
    tok.addEventListener('click', () => onPieceClick(i));
    layerEl.appendChild(tok);
  });

  applyStaticGeometry();
  refreshPieces();
}

// 오른쪽을 가리키는 굵은 화살표(회전으로 방향 표시) — 이 게임의 핵심 정보라 크게
const ARROW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// 칸 무늬: 방향 칸(속이 빈 화살표) / 회전 칸(시계 방향 고리 화살표)
const TILE_ARROW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.5h9V5l8 7-8 7v-4.5h-9z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const TURN_SVG = '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M18.6 3.2v4.6H14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

// 화살표 회전 각도: 이전 각도에서 가장 가까운 쪽으로 돌린다(→에서 ↑로 갈 때 270° 역회전하지 않게).
// 회전 칸은 항상 시계 방향 +90°.
function arrowAngle(el, d, cw) {
  const prev = el._ang == null ? d * 90 : el._ang;
  let delta = ((d * 90 - prev) % 360 + 540) % 360 - 180; // -180..180
  if (cw && delta <= 0) delta += 360;
  el._ang = prev + delta;
  return el._ang;
}

function pieceEls() { return [...layerEl.querySelectorAll('.piece')]; }
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
    const mk = el.querySelector('.num'); mk.style.width = mk.style.height = Math.round(cell * 0.29) + 'px'; // 큰 화살표와 겹치지 않는 크기
    el.style.setProperty('--badge', Math.round(cell * 0.34) + 'px'); // 도착 체크 배지 크기
  });
}

function refreshPieces() {
  const { center, cell } = geom();
  const toks = pieceEls();
  const off = cell * 0.09; // 숫자를 화살표 반대쪽으로 미는 거리(위·아래 화살표와 숫자가 겹치지 않게)

  // decide displayed direction: if two selected, show swapped directions
  const shown = clone(G.state);
  if (G.selected.length === 2) {
    const [a, b] = G.selected;
    [shown[a][2], shown[b][2]] = [shown[b][2], shown[a][2]];
  }
  if (G.dirShown) G.dirShown.forEach((d, i) => { shown[i][2] = d; }); // 칸 효과 전 방향(연출용)

  G.state.forEach((p, i) => {
    const tok = toks[i];
    tok.style.left = center(p[0]) + 'px';
    tok.style.top = center(p[1]) + 'px';
    const arrow = tok.querySelector('.arrow');
    const d = shown[i][2];
    arrow.style.transform = `rotate(${arrowAngle(arrow, d, G.turnCW && G.turnCW.has(i))}deg)`;
    tok.querySelector('.num').style.transform = `translate(${-VECTORS[d][0] * off}px, ${-VECTORS[d][1] * off}px)`;
    tok.classList.toggle('selected', G.selected.includes(i));
    tok.classList.toggle('hinted', !!(G.hintPair && G.hintPair.includes(i)) && !G.selected.includes(i));
    tok.classList.toggle('on-target',
      p[0] === G.stage.targets[i][0] && p[1] === G.stage.targets[i][1]);
  });
}

/* ---------- hint demo (non-destructive move preview animation) ---------- */
// After a hint selects the pair, slide those two pieces to where the move would
// take them and back — so the player sees HOW they move. Repeats until the player
// acts (piece tap / move / cancel / undo / restart / stage change → clearHintDemo).
let hintDemoTimers = [];
function resetDemoPieces() { pieceEls().forEach(el => { el.style.zIndex = ''; el.classList.remove('demo'); }); }
function clearHintDemo() {
  hintDemoTimers.forEach(clearTimeout);
  hintDemoTimers = [];
  resetDemoPieces();
}
// 힌트로 추천된 두 조각(G.hintPair)이 화살표를 맞바꾼 채 목적지로 갔다 돌아오는 시연을 반복
function demoHint(pair) {
  clearHintDemo();
  if (!G.stage || G.animating) return;
  const n = G.stage.n, { center } = geom();
  const next = outcome(G.state, pair, n, G.wallSet, G.tileMap);
  const later = (fn, ms) => hintDemoTimers.push(setTimeout(fn, ms));
  const same = () => !G.selected.length && G.hintPair && G.hintPair[0] === pair[0] && G.hintPair[1] === pair[1];
  const slideOut = () => {
    if (G.animating || !same()) { clearHintDemo(); return; }
    const toks = pieceEls();
    pair.forEach((i, k) => {
      const el = toks[i]; if (!el) return;
      const d = next[i][2], off = geom().cell * 0.09; // 맞바꾼 방향 + 숫자는 반대쪽으로
      const ar = el.querySelector('.arrow'); ar.style.transform = `rotate(${arrowAngle(ar, d)}deg)`;
      el.querySelector('.num').style.transform = `translate(${-VECTORS[d][0] * off}px, ${-VECTORS[d][1] * off}px)`;
      if (next[i][0] === G.state[i][0] && next[i][1] === G.state[i][1]) { bumpPiece(i, next[i][2]); return; }
      el.style.zIndex = 7; el.classList.add('demo');
      el.style.left = center(next[i][0]) + 'px';
      el.style.top = center(next[i][1]) + 'px';
    });
    later(slideBack, 720); // 목적지에서 잠깐 멈췄다가 복귀
  };
  const slideBack = () => {
    resetDemoPieces();
    refreshPieces();
    later(slideOut, 1100);
  };
  later(slideOut, 320);
}

/* ---------- interaction ---------- */
// 조각을 하나 누르면 들어 올리고, 두 번째를 누르면 화살표가 맞바뀌는 걸 잠깐 보여준 뒤 바로 이동한다.
// 같은 조각을 다시 누르면 선택 해제. (예전의 '미리보기 → 이동 버튼' 3단계 조작은 포털 심사에서 느리다는 평)
const SWAP_SHOW_MS = 240;
function onPieceClick(i) {
  if (G.animating || G.selected.length === 2) return;
  clearHintDemo();
  Sound.unlock();
  G.tipMsg = '';
  if (movesLeft() <= 0) { Sound.blocked(); haptic([12, 30, 12]); updatePreview(); return; }
  if (G.selected.includes(i)) {
    G.selected = [];
    Sound.selectAt(i);
    updatePreview();
    return;
  }
  G.selected.push(i);
  Sound.selectAt(i); haptic(8);
  if (G.selected.length < 2) { updatePreview(); return; }
  refreshPieces();
  coachUpdate();
  Sound.swap();
  G.animating = true; // 화살표 교환을 보여주는 동안 입력 잠금
  setTimeout(() => { G.animating = false; commitMove(); }, SWAP_SHOW_MS);
}

// 보드 아래 한 줄 안내 + 버튼 상태 갱신 (예전 이름 유지: 여러 곳에서 호출)
function updatePreview() {
  const outOfMoves = movesLeft() <= 0;
  refreshPieces();
  // 예산 소진 + 비프리미엄 → '광고 보고 +이동' 버튼 노출 (프리미엄은 광고 없음, 되돌리기/재시작 사용)
  const canAdMoves = outOfMoves && !isPremium() && adsOn();
  let msg = '';
  if (outOfMoves) msg = t(canAdMoves ? 'moves_out' : 'moves_out_noad');
  else if (G.hintPair && G.hintMsg) msg = G.hintMsg;
  else if (G.tipMsg) msg = G.tipMsg;
  else if (G.introMsg) msg = G.introMsg;
  else if (G.daily == null && G.index < WORLD_SIZE && !G.history.length && !G.selected.length && !coachOn) msg = t('select_two');
  hintTextEl.textContent = msg;
  btnUndo.classList.toggle('attn', outOfMoves);
  btnRestart.classList.toggle('attn', outOfMoves && !canAdMoves);
  const mmRow = $('#moreMovesRow'), mmBtn = $('#btnMoreMoves');
  if (mmRow && mmBtn) {
    mmRow.hidden = !canAdMoves;
    if (canAdMoves) mmBtn.textContent = t('more_moves_btn', { n: MOVES_PER_AD });
  }
  coachUpdate();
}

function commitMove() {
  if (G.selected.length !== 2 || G.animating) return;
  if (movesLeft() <= 0) { G.selected = []; updatePreview(); return; } // 이동 예산 소진 — 되돌리기/재시작 필요
  clearHintDemo();
  const tg = G.stage.targets;
  const onTgt = st => st.map((p, i) => p[0] === tg[i][0] && p[1] === tg[i][1]);
  const before = onTgt(G.state);
  const next = outcome(G.state, G.selected, G.stage.n, G.wallSet, G.tileMap);
  const blocked = G.selected.filter(i => G.state[i][0] === next[i][0] && G.state[i][1] === next[i][1]);
  const after = onTgt(next);
  const arrivals = next.map((_, i) => i).filter(i => after[i] && !before[i]);
  const placedAfter = after.filter(Boolean).length;
  const willWin = after.every(Boolean);

  // 칸 효과: 조각이 칸에 도착한 '뒤에' 화살표가 바뀌는 걸 보이도록, 잠깐 바뀌기 전 방향으로 그린다
  const raw = outcome(G.state, G.selected, G.stage.n, G.wallSet); // 칸 효과 없는 결과
  const tiled = G.selected.filter(i => raw[i][2] !== next[i][2]);

  G.history.push(clone(G.state));
  G.state = next;
  G.selected = [];
  G.hintPair = null; G.hintMsg = '';
  G.animating = true;
  if (tiled.length) G.dirShown = new Map(tiled.map(i => [i, raw[i][2]]));
  refreshPieces();
  updateHud();
  if (tiled.length) setTimeout(() => {
    G.dirShown = null;
    G.turnCW = new Set(tiled.filter(i => G.tileMap.get(next[i][0] + ',' + next[i][1]) === TILE_TURN));
    refreshPieces();
    G.turnCW = null;
    tiled.forEach(i => flashTile(next[i][0], next[i][1]));
    Sound.tile();
    G.introMsg = ''; // 새 칸 소개 문구는 칸이 처음 작동하면 내린다
  }, 200);

  blocked.forEach(i => bumpPiece(i, next[i][2]));
  if (blocked.length) {
    Sound.blocked(); haptic([12, 30, 12]);
    // 처음 막혀 봤을 때만 규칙을 한 줄로 알려준다(경험하는 순간에 설명)
    if (!progress.tipBlocked) { progress.tipBlocked = true; saveProgress(progress); G.tipMsg = t('tip_blocked'); }
  } else { Sound.move(); haptic(16); }
  // target lock-in: ring pulse + sparkles (always) + rising chime (except on the winning move,
  // where the win jingle takes over)
  arrivals.forEach((i, k) => {
    setTimeout(() => {
      pulseTarget(i); sparkle(i);
      if (!willWin) { Sound.lock(placedAfter - arrivals.length + k); haptic(10); }
    }, 300 + k * 90);
  });

  setTimeout(() => {
    G.animating = false;
    if (coachOn) endCoach();
    if (isGoal(G.state, G.stage.targets)) onWin();
    else updatePreview();
  }, 360);
}

// 막힌 조각: 화살표 방향으로 툭 부딪혔다가 제자리
function bumpPiece(i, dir) {
  const el = pieceEls()[i]; if (!el) return;
  const d = geom().cell * 0.14;
  el.style.setProperty('--dx', VECTORS[dir][0] * d + 'px');
  el.style.setProperty('--dy', VECTORS[dir][1] * d + 'px');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 400);
}

// 목표 도착: 조각 색 반짝이가 사방으로 튄다
function sparkle(i) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { cell, center } = geom(), t = G.stage.targets[i];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.random() * 0.4, r = cell * (0.45 + Math.random() * 0.25);
    const s = document.createElement('div');
    s.className = 'spark';
    s.style.left = center(t[0]) + 'px'; s.style.top = center(t[1]) + 'px';
    s.style.setProperty('--c', k % 3 === 0 ? '#f5c518' : PIECE_COLORS[i]);
    s.style.setProperty('--tx', Math.cos(a) * r + 'px'); s.style.setProperty('--ty', Math.sin(a) * r + 'px');
    layerEl.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }
}

/* ---------- first-play coach: in-game tutorial on Level 1 ---------- */
// 텍스트 규칙 창 대신, 처음 플레이하는 사람에게 손가락이 누를 조각을 가리키며 한 줄씩 안내(건너뛰기 가능).
const coachEl = $('#coach');
let coachOn = false;
function startCoach() {
  coachOn = !progress.tutorialSeen && G.index === 0 && G.daily == null;
  coachUpdate();
}
function endCoach() {
  coachOn = false;
  coachEl.hidden = true;
  if (!progress.tutorialSeen) { progress.tutorialSeen = true; saveProgress(progress); }
  if (G.stage && !G.animating) updatePreview();
}
function coachUpdate() {
  if (!coachOn || !G.stage) { coachEl.hidden = true; return; }
  const pair = solveNext(G.state, G.stage.targets, G.stage.n, G.wallSet, G.tileMap);
  const target = pair && (G.selected.length ? pair.find(i => !G.selected.includes(i)) : pair[0]);
  if (target == null) { coachEl.hidden = true; return; }
  coachEl.hidden = false;
  $('#coachText').textContent = t(G.selected.length ? 'coach_2' : 'coach_1');
  const wrap = coachEl.parentElement.getBoundingClientRect();
  const { center } = geom(), lay = layerEl.getBoundingClientRect(), p = G.state[target];
  const f = $('#coachFinger');
  f.style.left = (lay.left - wrap.left + center(p[0])) + 'px';
  f.style.top = (lay.top - wrap.top + center(p[1])) + 'px';
}

// 방향/회전 칸이 작동한 순간 그 칸을 반짝
function flashTile(x, y) {
  const el = gridEl.children[y * G.stage.n + x]; if (!el) return;
  el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire');
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
  G.hintPair = null; G.hintMsg = ''; G.tipMsg = '';
  Sound.selectAt(0);
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
  G.hintPair = null; G.hintMsg = ''; G.tipMsg = '';
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
  if (G.selected.length) { G.selected = []; refreshPieces(); }
  if (G.hintPair) { demoHint(G.hintPair); return; } // 이미 보여준 힌트는 다시 써도 차감 없이 시연만 반복
  const pair = solveNext(G.state, G.stage.targets, G.stage.n, G.wallSet, G.tileMap);
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
  if (adsOn() && adHintsLeft() > 0 && !G.attemptAdUsed) { offerAd(pair); return; }
  hintTextEl.textContent = t(adsOn() ? 'hint_none_left' : 'hint_none_left_noad');
  if (paymentsOn()) openStore(t('store_note_hint')); // 결제가 없는 곳(포털·공개 사이트)에선 프리미엄 유도 대신 안내만
}
// 추천된 두 조각을 빛나게 표시하고 이동 모습을 시연 — 실제로 누르는 건 플레이어
function applyHint(pair, src) {
  G.usedHint = true;
  G.selected = [];
  G.hintPair = pair.slice();
  const left = isPremium() ? t('hint_left_unlimited') : t('hint_left_free', { n: hintsAvailable() });
  G.hintMsg = t('hint_applied', { a: SHAPE_CHAR[pair[0]], b: SHAPE_CHAR[pair[1]], left });
  updatePreview();
  demoHint(pair);
  updateHintButton();
  logEvent('hint_used', { src });
}
function updateHintButton() {
  const c = $('#hintCount'); if (!c) return;
  c.textContent = isPremium() ? '∞' : String(hintsAvailable());
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
    : t(adsOn() ? 'store_status_free' : 'store_status_free_noad', { free: freeHintsLeft(), fmax: FREE_HINTS_PER_DAY, ad: adHintsLeft(), amax: AD_HINTS_PER_DAY })
      + (bonusHintsLeft() > 0 ? ' · ' + t('store_status_bonus', { n: bonusHintsLeft() }) : '');
  // 결제가 없는 곳(포털·공개 사이트)에선 유료 결제 UI(구매/보유/복원/약관)를 숨긴다 — 테마는 무료.
  const portal = !paymentsOn();
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
  if (pack === 'dusk') return isPremium() || !paymentsOn(); // 결제가 없는 곳엔 무료 개방(코스메틱)
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
  const box = $('#cloudSyncBox');
  if (box) box.style.display = (window.CloudSync && CloudSync.enabled) ? '' : 'none';
  renderCloudStatus();
  logEvent('backup_open');
}
function closeBackup() { $('#backup').classList.remove('show'); }

/* ---------- progress backup / restore (Google account, Firestore) ----------
 * 병합은 "손해 없음"이 원칙: 두 쪽 중 더 앞선 값을 취하고(진행 단계),
 * 클리어/기록은 합집합으로 남긴다(어느 쪽이든 이미 딴 것은 절대 사라지지 않음). */
function mergeProgress(local, cloud) {
  if (!cloud) return local;
  const out = Object.assign({}, local);
  out.completed = Object.assign({}, cloud.completed, local.completed);
  // max를 쓰면 예전 버그로 부풀려진 클라우드 값이 되살아나고, 부팅 시 재계산과 충돌해 새로고침이 반복될 수 있다
  out.reached = contiguousReached(out.completed);
  if (out.last > out.reached) out.last = out.reached;
  out.solo = Object.assign({}, cloud.solo, local.solo);
  out.best = {};
  const bestKeys = new Set([...Object.keys(local.best || {}), ...Object.keys(cloud.best || {})]);
  bestKeys.forEach(k => {
    const a = (local.best || {})[k], b = (cloud.best || {})[k];
    out.best[k] = (a == null) ? b : (b == null ? a : Math.min(a, b));
  });
  out.worldsDone = Object.assign({}, cloud.worldsDone, local.worldsDone);
  out.themeUnlocked = !!(local.themeUnlocked || cloud.themeUnlocked);
  out.premium = !!(local.premium || cloud.premium);
  out.bonusHints = Math.max(local.bonusHints || 0, cloud.bonusHints || 0);
  out.tutorialSeen = !!(local.tutorialSeen || cloud.tutorialSeen);
  return out;
}
function renderCloudStatus() {
  const statusEl = $('#cloudStatus'), btn = $('#btnGoogleSync');
  if (!statusEl || !btn) return;
  const del = $('#btnCloudDelete');
  if (del) del.hidden = !(progress.cloud && progress.cloud.linked);
  if (progress.cloud && progress.cloud.linked) {
    statusEl.textContent = t('cloud_linked', { email: progress.cloud.email || '' });
    btn.textContent = t('cloud_signout');
  } else {
    statusEl.textContent = t('cloud_hint');
    btn.textContent = t('cloud_signin');
  }
}
// 이용자 요청: 계정(클라우드)에 저장된 진행 기록 삭제 → 연결도 해제(다시 올라가지 않게). 이 기기 기록은 유지.
async function cloudDelete() {
  if (!window.CloudSync || !(progress.cloud && progress.cloud.linked)) return;
  if (!confirm(t('cloud_delete_confirm'))) return;
  const statusEl = $('#cloudStatus');
  try {
    if (statusEl) statusEl.textContent = t('cloud_syncing');
    const user = CloudSync.user || await CloudSync.restoreSession(4000) || await CloudSync.signIn();
    await CloudSync.remove(user.uid);
    await CloudSync.signOut();
    progress.cloud = { linked: false, email: '' };
    saveProgress(progress);
    renderCloudStatus();
    if (statusEl) statusEl.textContent = t('cloud_deleted');
    logEvent('cloud_delete');
  } catch (e) {
    if (statusEl) statusEl.textContent = t('cloud_sync_err');
  }
}
async function cloudSignInOrOut() {
  if (!window.CloudSync) return;
  if (progress.cloud && progress.cloud.linked) {
    CloudSync.signOut().catch(() => {});
    progress.cloud = { linked: false, email: '' };
    saveProgress(progress);
    renderCloudStatus();
    logEvent('cloud_unlink');
    return;
  }
  const statusEl = $('#cloudStatus');
  try {
    if (statusEl) statusEl.textContent = t('cloud_syncing');
    const user = await CloudSync.signIn();
    const cloudData = await CloudSync.pull(user.uid);
    const merged = mergeProgress(progress, cloudData);
    merged.cloud = { linked: true, email: user.email || '' };
    progress = merged;
    saveProgress(progress);
    await CloudSync.push(user.uid, progress);
    if (statusEl) statusEl.textContent = t('cloud_sync_ok');
    logEvent('cloud_link_ok');
    setTimeout(() => location.reload(), 700);
  } catch (e) {
    if (statusEl) statusEl.textContent = t('cloud_sync_err');
    logEvent('cloud_link_err');
  }
}
// 이전에 연결한 적 있는 기기/브라우저라면 조용히 세션을 복원하고 최신 진행도를 병합한다.
// 변경된 게 없으면(이미 최신) 새로고침하지 않는다 — 매 부팅마다 깜빡이지 않도록.
async function trySilentCloudRestore() {
  if (!(progress.cloud && progress.cloud.linked)) return;
  if (!window.CloudSync || !CloudSync.enabled) return;
  try {
    const user = await CloudSync.restoreSession(4000);
    if (!user) return;
    const cloudData = await CloudSync.pull(user.uid);
    if (!cloudData) return;
    const merged = mergeProgress(progress, cloudData);
    merged.cloud = { linked: true, email: user.email || progress.cloud.email || '' };
    if (JSON.stringify(merged) !== JSON.stringify(progress)) {
      progress = merged;
      saveProgress(progress);
      await CloudSync.push(user.uid, progress).catch(() => {});
      location.reload();
    }
  } catch (e) {}
}
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
  const sw = worldOf(G.index);
  const stickersBefore = worldStickers(sw), goldBefore = worldGold(sw);
  progress.completed[st.id] = true;
  if (!progress.best[st.id] || moves < progress.best[st.id]) progress.best[st.id] = moves;
  if (!G.usedHint && (!progress.solo[st.id] || moves < progress.solo[st.id]))
    progress.solo[st.id] = moves;
  saveProgress(progress);

  const newSticker = worldStickers(sw) > stickersBefore;
  const newGold = !goldBefore && worldGold(sw); // 다시 풀어 3★로 올려도 달성될 수 있음
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
    // 공유용 오늘의 별 기록(오늘 것만 보관, 더 좋은 기록 유지)
    if (!progress.dailyStars || progress.dailyStars.d !== dk) progress.dailyStars = { d: dk, s: [0, 0, 0] };
    progress.dailyStars.s[G.daily] = Math.max(progress.dailyStars.s[G.daily] || 0, tier);
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
    if (!hasNext) overlay.querySelector('.result-sub').innerHTML += t('all_done'); // 마지막 레벨: 완주 축하 + 데일리 안내
    overlay.dataset.mode = 'normal';
  }
  // 결과 창은 조금 늦게: 마지막 조각이 도착해 튀어 오르는 축하 동작을 판 위에서 먼저 보여준다.
  // 그 사이 입력은 잠근다(G.animating) — 창이 뜨면 창이 입력을 막는다.
  // 포털 신호(gameplayStop)는 창이 뜰 때 syncGameplay가 보낸다. happytime은 월드 완주·골드 스티커에서만.
  G.animating = true;
  clearTimeout(G.winTimer);
  G.winTimer = setTimeout(() => { G.animating = false; overlay.classList.add('show'); syncGameplay(); }, WIN_REVEAL_MS);
  // 중간 광고는 클리어 순간이 아니라 '다음 문제'를 누를 때(레벨 전환) 띄운다 — 3판마다.
  // 처음 온 플레이어는 AD_GRACE_CLEARS판을 깰 때까지 광고 없이 게임에 빠져들게 둔다.
  if (!daily && Object.keys(progress.completed).length > AD_GRACE_CLEARS) {
    G.clearsSinceAd = (G.clearsSinceAd || 0) + 1;
    if (G.clearsSinceAd >= ADS_EVERY_CLEARS) G.adDue = true;
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
      }
    }
  }
  const earned = (newSticker ? HINTS_PER_STICKER : 0) + (newGold ? HINTS_PER_GOLD : 0) + (worldDone ? HINTS_PER_WORLD : 0);
  if (earned) { progress.bonusHints = (progress.bonusHints || 0) + earned; saveProgress(progress); updateHintButton(); logEvent('hints_earned', { n: earned }); }
  // 보상 팝업은 한 번에 하나씩: 월드 완주 → 골드 → 일반 스티커 순으로 이어서 보여준다.
  // 데일리에서 딴 스티커는 앨범에만 조용히 붙는다(데일리 흐름을 끊지 않도록).
  if (!daily) {
    const q = [];
    if (worldDone) q.push(() => showWorldReward(sw, themeJustUnlocked));
    if (newGold) q.push(() => showStickerReward(sw, 'gold'));
    if (newSticker) q.push(() => showStickerReward(sw, worldStickers(sw) - 1));
    G.rewardQueue = q;
    if (q.length) setTimeout(nextReward, WIN_REVEAL_MS + 900);
  }
}
function nextReward() {
  const fn = G.rewardQueue && G.rewardQueue.shift();
  if (fn) { fn(); return true; }
  return false;
}

// world completion celebration (keeps the win overlay behind, like sticker reward)
function showWorldReward(w, themeUnlocked) {
  $('#worldEmoji').textContent = themeUnlocked ? '🎨' : '🏅';
  $('#worldTitle').textContent = t('world_done_title', { n: w + 1 });
  $('#worldSub').textContent = (themeUnlocked ? t('world_done_theme') : t('world_done_go')) + '\n' + t('reward_hints', { n: HINTS_PER_WORLD });
  $('#worldOverlay').classList.add('show');
  Sound.sticker(); haptic([30, 40, 30, 40, 60]); confettiBurst();
  if (window.AdsManager) AdsManager.happyTime(1);
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
  if (!G.stage) return;
  movesInfoEl.textContent = t('moves_info', { n: G.history.length, max: moveBudget() });
  goalInfoEl.textContent = t('goal_info', { min: G.stage.min });
}
// 상단 라벨: "Level 41" + "World 2 · Paris" (데일리는 "Daily Challenge" + 난이도)
function renderStageLabels() {
  if (!G.stage) return;
  if (G.daily != null) {
    stageTitleEl.textContent = t('daily_title');
    chapterEl.textContent = [t('daily_easy'), t('daily_medium'), t('daily_hard')][G.daily];
  } else {
    stageTitleEl.textContent = t('level', { n: G.index + 1 });
    chapterEl.textContent = t('album_page', { n: worldOf(G.index) + 1, place: placeName(worldOf(G.index)) });
  }
}

// 새 칸을 처음 만나는 판: 보드 아래에 한 줄 소개 + 그 칸들을 반짝(칸이 처음 작동할 때까지 문구 유지)
// 이미 본 종류여도, 그 칸이 처음 나오는 월드의 첫 판에서는 다시 알려준다.
function introduceTiles() {
  if (!G.tileMap.size) return;
  const kinds = [...G.tileMap.values()];
  const hasTurn = kinds.includes(TILE_TURN), hasDir = kinds.some(k => k !== TILE_TURN);
  const seen = progress.seenTiles || (progress.seenTiles = {});
  const kind = hasTurn && !seen.turn ? 'turn' : hasDir && !seen.dir ? 'dir' : null;
  if (!kind) return;
  seen[kind] = true; saveProgress(progress);
  G.introMsg = t(kind === 'turn' ? 'tip_turn_tile' : 'tip_dir_tile');
  setTimeout(() => G.tileMap.forEach((k, c) => {
    if ((k === TILE_TURN) === (kind === 'turn')) { const [x, y] = c.split(',').map(Number); flashTile(x, y); }
  }), 450);
}
function loadStage(index, dailySlot = null) {
  clearHintDemo();
  clearTimeout(G.winTimer); G.animating = false; // 결과 창 대기 중에 다른 스테이지로 가도 옛 결과가 뜨지 않게
  G.index = Math.max(0, Math.min(STAGES.length - 1, index));
  G.stage = STAGES[G.index];
  G.wallSet = new Set((G.stage.walls || []).map(w => w[0] + ',' + w[1])); // impassable cells
  G.tileMap = new Map((G.stage.tiles || []).map(c => [c[0] + ',' + c[1], c[2]])); // 방향 칸·회전 칸
  G.dirShown = null; // 칸 효과 연출 중 잠깐 보여줄 '바뀌기 전' 방향
  G.state = clone(G.stage.start);
  G.history = [];
  G.selected = [];
  G.usedHint = false;
  G.attemptAdUsed = false;
  G.budgetBonus = 0;
  G.hintPair = null; G.hintMsg = ''; G.tipMsg = ''; G.introMsg = '';
  G.daily = dailySlot; // non-null => playing today's daily puzzle
  if (dailySlot === null) { progress.last = G.index; saveProgress(progress); } // daily doesn't move main progress
  updateHintButton();

  renderStageLabels();
  applyWorldTint(G.index);
  overlay.classList.remove('show');
  buildBoard();
  coachOn = false;
  introduceTiles();
  updateHud();
  updatePreview();
  renderProgress();
  startCoach();
  syncGameplay(); // portal signal: level active (창이 하나도 안 떠 있을 때만)
}

// 진행 막대: 지금 월드 안에서 몇 문제 깼는지(x/30) — 전체 1050 대신 손에 잡히는 목표
function renderProgress() {
  if (!G.stage) return;
  const w = worldOf(G.index), done = worldClears(w), total = worldRange(w)[1] - worldRange(w)[0];
  progressBarEl.style.width = (done / total * 100) + '%';
  progressTextEl.textContent = `${done}/${total}`;
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
let albumPage = 0;
function renderAlbum() {
  const w = albumPage, page = ALBUM[w];
  const reached = w * WORLD_SIZE <= progress.reached || worldClears(w) > 0;
  const earned = worldStickers(w), gold = worldGold(w);
  $('#albumPageName').textContent = (reached ? '' : '🔒 ') + t('album_page', { n: w + 1, place: placeName(w) });
  $('#albumPrev').disabled = w === 0;
  $('#albumNext').disabled = w === ALBUM.length - 1;
  const grid = $('#albumGrid');
  grid.innerHTML = '';
  page.st.forEach((emoji, k) => {
    const got = k < earned;
    const cell = document.createElement('div');
    cell.className = 'sticker' + (got ? ' got' : '');
    cell.innerHTML = got
      ? `<span class="emoji">${emoji}</span>` + (page.keys ? `<span class="nm">${stickerName(w, k)}</span>` : '')
      : `<span class="emoji">?</span>`;
    grid.appendChild(cell);
  });
  const goldEl = $('#albumGold');
  goldEl.className = 'sticker gold-slot' + (gold ? ' got' : '');
  goldEl.innerHTML = `<span class="emoji">${gold ? page.icon : '★'}</span><span class="nm">${t(gold ? 'album_gold_name' : 'album_gold_hint')}</span>`;
  const next = (earned + 1) * CLEARS_PER_STICKER - worldClears(w);
  $('#albumStatus').textContent = gold ? t('album_gold_done')
    : earned >= STICKERS_PER_PAGE ? t('album_page_full')
      : t('album_page_status', { n: earned, total: STICKERS_PER_PAGE, k: next });
  $('#albumTotal').textContent = t('album_total', { n: albumEarned(), total: albumTotal() });
}
function openAlbum(page) {
  albumPage = page != null ? page : worldOf(G.index || 0);
  renderAlbum(); albumOverlay.classList.add('show');
}
function closeAlbum() { albumOverlay.classList.remove('show'); }
function flipAlbum(d) { albumPage = Math.max(0, Math.min(ALBUM.length - 1, albumPage + d)); renderAlbum(); }

// k: 페이지 안 스티커 번호(0~5) 또는 'gold'
function showStickerReward(w, k) {
  const isGold = k === 'gold';
  // keep the win overlay (with the "다음 문제" button) behind this modal so it
  // returns after the sticker/album is closed
  const so = $('#stickerOverlay');
  so.dataset.page = w;
  so.classList.toggle('gold', isGold);
  $('#stickerEmoji').textContent = isGold ? ALBUM[w].icon : ALBUM[w].st[k];
  $('#stickerName').textContent = t(isGold ? 'sticker_gold_got' : 'sticker_got', { name: isGold ? placeName(w) : stickerName(w, k) });
  $('#stickerSub').textContent = t('sticker_sub', { n: albumEarned(), total: albumTotal() })
    + '\n' + t('reward_hints', { n: isGold ? HINTS_PER_GOLD : HINTS_PER_STICKER });
  so.classList.add('show');
  Sound.sticker(); haptic([30, 40, 30, 40, 60]); confettiBurst();
  if (isGold && window.AdsManager) AdsManager.happyTime(1);
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
  const ds = progress.dailyStars && progress.dailyStars.d === dk ? progress.dailyStars.s : [0, 0, 0]; // 오늘 딴 별
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
      `<span class="dc-meta">${s.n}×${s.n} · ${done[slot] && ds[slot] ? '★'.repeat(ds[slot]) + '☆'.repeat(3 - ds[slot]) : t('goal_info', { min: s.min })}</span>` +
      `<span class="dc-go">${done[slot] ? '✓' : '▶'}</span>`;
    card.addEventListener('click', () => { closeDaily(); loadStage(idx, slot); });
    wrap.appendChild(card);
  });
  $('#dailyAllDone').hidden = !done.every(Boolean);
  // 결과 공유: 오늘 3문제를 다 깼고 결제·외부 링크가 없는 포털이 아닐 때만(포털은 외부 링크 금지)
  $('#dailyShare').hidden = !done.every(Boolean) || onPortal();
  renderWeekly();
}
// 워들처럼 이모지 결과 한 덩어리 — 공유 시트가 있으면 그것을, 없으면 클립보드로
async function shareDaily() {
  const dk = todayKey();
  const ds = progress.dailyStars && progress.dailyStars.d === dk ? progress.dailyStars.s : [0, 0, 0];
  const labels = [t('daily_easy'), t('daily_medium'), t('daily_hard')];
  const name = (window.BM_BRAND && window.BM_BRAND.name) || 'SwapStep';
  const url = (window.BM_BRAND && window.BM_BRAND.shareUrl) || (location.origin + location.pathname);
  const lines = [`${name} · ${t('daily_title')} ${dk}`]
    .concat(labels.map((l, k) => `${l} ${'⭐'.repeat(ds[k] || 1)}${'▫️'.repeat(3 - (ds[k] || 1))}`))
    .concat([t('daily_streak', { n: progress.streak.n || 0 }), url]);
  const text = lines.join('\n');
  logEvent('daily_share');
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); $('#dailyShareMsg').textContent = t('share_copied'); }
  catch (e) { $('#dailyShareMsg').textContent = text; }
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
function openTutorial() {
  const tt = $('#tutTiles'); if (tt) tt.hidden = !(progress.seenTiles && (progress.seenTiles.dir || progress.seenTiles.turn)); // 칸을 만난 뒤에만 설명
  tutorial.classList.add('show');
}
function closeTutorial() {
  tutorial.classList.remove('show');
  progress.tutorialSeen = true; saveProgress(progress);
}

/* ---------- settings ---------- */
function applySoundIcon() {
  const on = progress.settings.sound !== false;
  const b = $('#btnSound');
  if (b) { b.textContent = on ? t('sound_on') : t('sound_off'); b.classList.toggle('off', !on); }
  const mOn = progress.settings.music !== false, mb = $('#btnMusic');
  if (mb) { mb.textContent = mOn ? t('music_on') : t('music_off'); mb.classList.toggle('off', !mOn); }
}
function toggleSound() {
  progress.settings.sound = progress.settings.sound === false;
  saveProgress(progress); applySoundIcon();
  if (progress.settings.sound) { Sound.unlock(); Sound.select(); }
}
function toggleMusic() {
  progress.settings.music = progress.settings.music === false;
  saveProgress(progress); applySoundIcon();
  if (progress.settings.music) Sound.startMusic(); else Sound.stopMusic();
}

/* ---------- branding (rebranding config) ---------- */
function applyBranding() {
  const b = window.BM_BRAND || {};
  const name = b.name || 'SwapStep', tag = b.tagline || '';
  const brandEl = document.querySelector('header .brand');
  // 기본 이름이면 표지와 같은 두 색(주황 Swap + 청록 Step), 라이선스로 바꾼 이름은 그대로
  const nameHtml = name === 'SwapStep' ? '<span class="a">Swap</span><span class="b">Step</span>' : name;
  if (brandEl) brandEl.innerHTML = nameHtml + (tag ? `<small>${tag}</small>` : '');
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
$('#coachSkip').addEventListener('click', endCoach);
$('#btnNext').addEventListener('click', async e => {
  if (overlay.dataset.mode === 'daily') { overlay.classList.remove('show'); openDaily(); return; }
  if (G.adDue && window.AdsManager) {
    // 광고 요청~종료 동안 버튼을 막아 진행하지 못하게 한다(포털 규격)
    const btn = e.currentTarget; btn.disabled = true;
    G.adDue = false; G.clearsSinceAd = 0;
    logEvent('midgame_ad', { platform: AdsManager.platform });
    try { await AdsManager.showInterstitial(); } catch (err) {}
    btn.disabled = false;
  }
  loadStage(G.index + 1);
});
$('#btnReplay').addEventListener('click', () => { overlay.classList.remove('show'); restart(); });
$('#btnStages').addEventListener('click', openDrawer);
// daily challenge
$('#btnDaily').addEventListener('click', openDaily);
$('#dailyClose').addEventListener('click', closeDaily);
$('#dailyShare').addEventListener('click', shareDaily);
$('#dailyBackdrop').addEventListener('click', closeDaily);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#drawerBackdrop').addEventListener('click', closeDrawer);

// album
$('#btnAlbum').addEventListener('click', () => openAlbum());
$('#albumPrev').addEventListener('click', () => flipAlbum(-1));
$('#albumNext').addEventListener('click', () => flipAlbum(1));
$('#albumClose').addEventListener('click', closeAlbum);
$('#albumBackdrop').addEventListener('click', closeAlbum);
$('#stickerOk').addEventListener('click', () => {
  const so = $('#stickerOverlay'); so.classList.remove('show');
  if (!nextReward()) openAlbum(Number(so.dataset.page));
});
$('#worldOk').addEventListener('click', () => { $('#worldOverlay').classList.remove('show'); nextReward(); });

// tutorial / help
$('#btnHelp').addEventListener('click', openTutorial);
$('#tutorialStart').addEventListener('click', closeTutorial);

// settings
$('#btnSound').addEventListener('click', toggleSound);
$('#btnMusic').addEventListener('click', toggleMusic);
document.addEventListener('visibilitychange', () => Sound.setHidden(document.hidden));

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
// 개인정보처리방침 링크: 영어가 먼저인 페이지라, 한국어로 하던 사람은 한국어 부분(#ko)으로 바로 연다
function updatePrivacyLinks() {
  document.querySelectorAll('a[href^="privacy.html"]').forEach(a => { a.setAttribute('href', 'privacy.html' + (window.I18N.lang === 'ko' ? '#ko' : '')); });
}
function refreshDynamic() {
  updatePrivacyLinks();
  if ($('#langSelect')) $('#langSelect').value = window.I18N.lang;
  updateHud(); updateHintButton(); applySoundIcon(); renderProgress(); renderStageLabels();
  if (G.hintPair) G.hintMsg = t('hint_applied', { a: SHAPE_CHAR[G.hintPair[0]], b: SHAPE_CHAR[G.hintPair[1]],
    left: isPremium() ? t('hint_left_unlimited') : t('hint_left_free', { n: hintsAvailable() }) });
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
$('#btnGoogleSync').addEventListener('click', cloudSignInOrOut);
$('#btnCloudDelete').addEventListener('click', cloudDelete);

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
  if (document.querySelector('.modal.show, .overlay.show, .drawer.open')) return; // 창이 떠 있으면 게임 키 무시
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  // 숫자 키 1~4 = 그 번호 조각 누르기 (두 개 누르면 이동). Escape는 포털 전체화면 종료용이라 쓰지 않는다.
  else if (/^[1-4]$/.test(e.key) && !e.ctrlKey && !e.metaKey && G.stage && +e.key <= G.state.length) onPieceClick(+e.key - 1);
  else if (e.key === 'r' || e.key === 'R') restart();
  else if (e.key === 'h' || e.key === 'H') useHint();
});

// 포털 gameplayStart/Stop: 결과·메뉴·상점 등 어떤 창이든 떠 있으면 '멈춤', 모두 닫히면 '플레이 중'.
// 창마다 호출을 넣는 대신 창들의 class 변화를 지켜보고 한곳에서 판단한다(중복 신호 없음).
let gameplayOn = false;
function syncGameplay() {
  if (!window.AdsManager) return;
  const on = !!G.stage && !document.querySelector('.modal.show, .overlay.show, .drawer.open');
  if (on === gameplayOn) return;
  gameplayOn = on;
  if (on) AdsManager.gameplayStart(); else AdsManager.gameplayStop();
}
if (window.MutationObserver) {
  const mo = new MutationObserver(syncGameplay);
  document.querySelectorAll('.modal, .overlay, .drawer').forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['class'] }));
}

let resizeTimer;
const relayoutBoard = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!G.stage) return;
    applyStaticGeometry();
    refreshPieces();
    coachUpdate();
  }, 120);
};
window.addEventListener('resize', relayoutBoard);
// 세로 화면에선 보드가 남는 높이에 맞춰지므로 창 크기가 그대로여도(안내문 줄 수, '+이동' 줄 등) 크기가 바뀐다
if (window.ResizeObserver) new ResizeObserver(relayoutBoard).observe(layerEl);

// unlock audio on the first user gesture (autoplay policies)
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

// init — bring up the platform + storage backend first (SDK loads on portals),
// then load progress from the correct backend, then render the UI.
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r('timeout'), ms))]);
async function boot() {
  // 사이트락: 허용되지 않은 호스트면 게임 대신 안내 화면을 띄우고 중단(광고/SDK도 로드 안 함)
  if (window.BM_hostAllowed && !window.BM_hostAllowed()) { hideSplash(); showSiteLock(); return; }
  if (window.AdsManager) {
    try {
      const name = await withTimeout(AdsManager.init({
        onRewardedSimulate: showSimulatedAd,
        onAdStarted: () => { Sound.mute(); },   // 광고 실제 표시 → 음소거
        onAdEnded: () => { Sound.unmute(); },   // 광고 종료(성공/실패) → 복구
        onMuteChange: m => { Sound.setSiteMuted(m); }, // 포털 사이트 음소거 설정 따르기
      }), 6000); // SDK가 멈춰도 게임은 항상 뜨도록 타임아웃 후 진행
      logEvent('platform_ready', { platform: name });
    } catch (e) {}
  }
  // 포털 SDK 저장소가 준비됐다면 그 백엔드에서 진행도를 다시 읽는다(부팅 전엔 localStorage 기본값).
  if (window.Store && Store.backend === 'sdk') progress = loadProgress();
  // 포털이 알려주는 사용자 언어 우선(직접 고른 언어가 있으면 그대로)
  if (window.AdsManager && AdsManager.locale) { window.I18N.adoptLocale(AdsManager.locale); langSelect.value = window.I18N.lang; }

  reconcileReached();        // unlock up to the furthest completed stage (migration)
  applyBranding();           // apply rebranding config (name/tagline/accent)
  if (onPortal()) { const dl = $('#drawerLegal'); if (dl) dl.hidden = true; } // 포털: 외부 링크 숨김
  window.I18N.apply();       // fill static data-i18n strings
  updatePrivacyLinks();
  applySoundIcon();
  resetDailyIfNeeded();
  applyThemePack();
  updateHintButton();
  registerSW();
  if (window.AdsManager) AdsManager.loadingStop(); // 로딩 끝 → 이어서 loadStage가 gameplayStart
  loadStage(progress.last || 0);        // start at last played stage
  // 첫 플레이 안내는 규칙 창 대신 1레벨 화면 안에서 손가락으로(startCoach, loadStage에서 호출)
  trySilentCloudRestore(); // 백그라운드: 이전에 연결한 계정이면 조용히 최신 진행도로 맞춘다
  booted = true;
  hideSplash();
}
boot().catch(e => { logEvent('js_error', { msg: String((e && e.message) || e).slice(0, 200), kind: 'boot' }); showCrash(); });

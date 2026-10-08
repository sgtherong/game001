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
  migrateProgress(p);
  // migrate: existing players keep access up to their furthest completed stage
  return p;
}
// 저장 형식 2(2026-10-06): 여행지 35곳 → 100곳. 월드 35 자리에 새 여행지(노르웨이 피오르)가 들어오고, 우주는 더 어려운
// 새 판(SS-3001~)으로 바뀌어 맨 끝(월드 100)에 있다. 판 기록은 id라 그대로 두고, 월드 번호로 저장한 '월드 완주' 중
// 예전 우주(0부터 34) 표시만 지운다(새 우주는 아직 안 깬 것). 클라우드·백업에서 온 예전 기록에도 적용.
const SAVE_FORMAT = 2;
function migrateProgress(p) {
  if (!p || (p.format || 1) >= SAVE_FORMAT) return p;
  if (p.worldsDone) delete p.worldsDone[34];
  p.format = SAVE_FORMAT;
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
const WIN_REVEAL_MS = 1650; // 마지막 이동 후 결과 창이 뜨기까지(통통 → 조각이 목표로 쏙 → 여행지 그림을 판 위에서 먼저 보여줌)
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
// 스티커 600장(100곳×6)은 서로 모두 다른 이모지(2026-10-06, 여행지마다 후보를 적고 최소 비용 흐름으로 겹치지 않게 배정).
const ALBUM = [
  { icon: '🧳', name: { en: 'Getting Ready', ko: '여행 준비', es: 'Preparativos', pt: 'Preparativos', ru: 'Сборы' },
    st: ['🧭', '🗺️', '🎒', '📸', '✈️', '🏝️'], keys: ['st_compass', 'st_map', 'st_backpack', 'st_photo', 'st_plane', 'st_island'] },
  { icon: '🗼', name: { en: 'Paris', ko: '파리', es: 'París', pt: 'Paris', ru: 'Париж' }, st: ['🥐', '🗼', '🥖', '👗', '💄', '👠'] },
  { icon: '🎡', name: { en: 'London', ko: '런던', es: 'Londres', pt: 'Londres', ru: 'Лондон' }, st: ['💂', '🚌', '☂️', '🎓', '📮', '🛎️'] },
  { icon: '🌷', name: { en: 'Amsterdam', ko: '암스테르담', es: 'Ámsterdam', pt: 'Amsterdã', ru: 'Амстердам' }, st: ['🌷', '🚲', '🌬️', '🚤', '🧀', '🖼️'] },
  { icon: '🎻', name: { en: 'Vienna', ko: '빈', es: 'Viena', pt: 'Viena', ru: 'Вена' }, st: ['🎻', '🎹', '🍰', '🎼', '🎂', '📯'] },
  { icon: '🏔️', name: { en: 'Swiss Alps', ko: '스위스 알프스', es: 'Alpes suizos', pt: 'Alpes suíços', ru: 'Швейцарские Альпы' }, st: ['⛷️', '🔔', '🚠', '🫕', '⌚', '🏦'] },
  { icon: '🎭', name: { en: 'Venice', ko: '베네치아', es: 'Venecia', pt: 'Veneza', ru: 'Венеция' }, st: ['🎭', '🚣', '🍨', '🕊️', '🧵', '🪟'] },
  { icon: '🏛️', name: { en: 'Rome', ko: '로마', es: 'Roma', pt: 'Roma', ru: 'Рим' }, st: ['🏛️', '🍝', '🍦', '⛲', '⚔️', '🛡️'] },
  { icon: '💃', name: { en: 'Barcelona', ko: '바르셀로나', es: 'Barcelona', pt: 'Barcelona', ru: 'Барселона' }, st: ['💃', '⚽', '🥘', '🎸', '⛪', '🌹'] },
  { icon: '⛵', name: { en: 'Santorini', ko: '산토리니', es: 'Santorini', pt: 'Santorini', ru: 'Санторини' }, st: ['🌊', '⛵', '🐙', '☀️', '🐴', '🫐'] },
  { icon: '🌋', name: { en: 'Iceland', ko: '아이슬란드', es: 'Islandia', pt: 'Islândia', ru: 'Исландия' }, st: ['🌋', '🐋', '🐑', '🪓', '🧖', '🌒'] },
  { icon: '🕌', name: { en: 'Istanbul', ko: '이스탄불', es: 'Estambul', pt: 'Istambul', ru: 'Стамбул' }, st: ['🕌', '🍢', '🐈', '🎠', '🥙', '🍬'] },
  { icon: '🐪', name: { en: 'Cairo', ko: '카이로', es: 'El Cairo', pt: 'Cairo', ru: 'Каир' }, st: ['🔺', '📜', '🪲', '🪶', '👁️', '🐱'] },
  { icon: '🦁', name: { en: 'Kenya Safari', ko: '케냐 사파리', es: 'Safari en Kenia', pt: 'Safári no Quênia', ru: 'Сафари в Кении' }, st: ['🦁', '🦒', '🦓', '🐆', '🦏', '🚙'] },
  { icon: '🏙️', name: { en: 'Dubai', ko: '두바이', es: 'Dubái', pt: 'Dubai', ru: 'Дубай' }, st: ['🏙️', '🐫', '💎', '🏗️', '🛍️', '🏊'] },
  { icon: '🐅', name: { en: 'India', ko: '인도', es: 'India', pt: 'Índia', ru: 'Индия' }, st: ['🍛', '🐅', '🪔', '🎆', '🧣', '🥻'] },
  { icon: '🛕', name: { en: 'Bangkok', ko: '방콕', es: 'Bangkok', pt: 'Bangkok', ru: 'Бангкок' }, st: ['🛺', '🥭', '🛕', '🥊', '🦟', '🥋'] },
  { icon: '🌾', name: { en: 'Bali', ko: '발리', es: 'Bali', pt: 'Bali', ru: 'Бали' }, st: ['🏄', '🌾', '🎋', '🍹', '🧘', '🐖'] },
  { icon: '🐼', name: { en: 'Beijing', ko: '베이징', es: 'Pekín', pt: 'Pequim', ru: 'Пекин' }, st: ['🐼', '🥟', '🧧', '🦆', '🪁', '🀄'] },
  { icon: '🏯', name: { en: 'Seoul', ko: '서울', es: 'Seúl', pt: 'Seul', ru: 'Сеул' }, st: ['🏯', '🍚', '🍗', '🎮', '📱', '📺'] },
  { icon: '🗻', name: { en: 'Tokyo', ko: '도쿄', es: 'Tokio', pt: 'Tóquio', ru: 'Токио' }, st: ['🍣', '🌸', '🗻', '🎎', '🚄', '🎌'] },
  { icon: '🦘', name: { en: 'Sydney', ko: '시드니', es: 'Sídney', pt: 'Sydney', ru: 'Сидней' }, st: ['🦘', '🐨', '🦈', '🏏', '🎵', '🕷️'] },
  { icon: '🥝', name: { en: 'New Zealand', ko: '뉴질랜드', es: 'Nueva Zelanda', pt: 'Nova Zelândia', ru: 'Новая Зеландия' }, st: ['🥝', '🏞️', '🪂', '🐏', '🏉', '🧝'] },
  { icon: '🌺', name: { en: 'Hawaii', ko: '하와이', es: 'Hawái', pt: 'Havaí', ru: 'Гавайи' }, st: ['🌺', '🍍', '🤙', '🩴', '🐔', '🩳'] },
  { icon: '🌉', name: { en: 'San Francisco', ko: '샌프란시스코', es: 'San Francisco', pt: 'São Francisco', ru: 'Сан-Франциско' }, st: ['🌉', '🌁', '🍞', '🚴', '🚃', '💻'] },
  { icon: '🗽', name: { en: 'New York', ko: '뉴욕', es: 'Nueva York', pt: 'Nova York', ru: 'Нью-Йорк' }, st: ['🗽', '🍕', '🚕', '🥯', '🎟️', '🐀'] },
  { icon: '🍁', name: { en: 'Canada', ko: '캐나다', es: 'Canadá', pt: 'Canadá', ru: 'Канада' }, st: ['🍁', '🐻', '🏒', '🍯', '🦫', '🥞'] },
  { icon: '🌮', name: { en: 'Mexico', ko: '멕시코', es: 'México', pt: 'México', ru: 'Мексика' }, st: ['🌮', '🌵', '🥑', '🎊', '💀', '🪅'] },
  { icon: '🦜', name: { en: 'Caribbean', ko: '카리브해', es: 'Caribe', pt: 'Caribe', ru: 'Карибы' }, st: ['🏴‍☠️', '🦜', '💰', '⚓', '☠️', '🔑'] },
  { icon: '🦋', name: { en: 'Amazon', ko: '아마존', es: 'Amazonas', pt: 'Amazônia', ru: 'Амазония' }, st: ['🦋', '🌳', '🍃', '🐜', '🪱', '🌩️'] },
  { icon: '🦙', name: { en: 'Peru', ko: '페루', es: 'Perú', pt: 'Peru', ru: 'Перу' }, st: ['🦙', '🌽', '🧶', '🥔', '🎶', '🐹'] },
  { icon: '🥁', name: { en: 'Rio de Janeiro', ko: '리우데자네이루', es: 'Río de Janeiro', pt: 'Rio de Janeiro', ru: 'Рио-де-Жанейро' }, st: ['🎉', '🥁', '🦩', '🏐', '🛹', '🩲'] },
  { icon: '🐧', name: { en: 'Antarctica', ko: '남극', es: 'Antártida', pt: 'Antártida', ru: 'Антарктида' }, st: ['🐧', '🛷', '🌨️', '⛸️', '🧤', '📡'] },
  { icon: '🦌', name: { en: 'Lapland', ko: '라플란드', es: 'Laponia', pt: 'Lapônia', ru: 'Лапландия' }, st: ['🎅', '🎄', '🎁', '🧦', '🍪', '☃️'] },
  // ---- 2026-10-06 추가: 두 번째 세계 일주(월드 35~99). 이름은 7개 언어를 함께 둔다 ----
  { icon: '⛴️', name: { en: 'Norwegian Fjords', ko: '노르웨이 피오르', es: 'Fiordos noruegos', pt: 'Fiordes da Noruega', ru: 'Норвежские фьорды', de: 'Norwegische Fjorde', fr: 'Fjords de Norvège' }, st: ['⛴️', '🌧️', '🐳', '🪝', '🛳️', '🍓'] },
  { icon: '🧜‍♀️', name: { en: 'Copenhagen', ko: '코펜하겐', es: 'Copenhague', pt: 'Copenhague', ru: 'Копенгаген', de: 'Kopenhagen', fr: 'Copenhague' }, st: ['🧜‍♀️', '🧱', '🎡', '🛴', '🕯️', '🎪'] },
  { icon: '🦄', name: { en: 'Scotland', ko: '스코틀랜드', es: 'Escocia', pt: 'Escócia', ru: 'Шотландия', de: 'Schottland', fr: 'Écosse' }, st: ['🦄', '⛳', '🦕', '🧥', '🥧', '🏌️'] },
  { icon: '☘️', name: { en: 'Ireland', ko: '아일랜드', es: 'Irlanda', pt: 'Irlanda', ru: 'Ирландия', de: 'Irland', fr: 'Irlande' }, st: ['☘️', '🍀', '🍲', '🪕', '🌦️', '🧚'] },
  { icon: '🧇', name: { en: 'Bruges', ko: '브뤼헤', es: 'Brujas', pt: 'Bruges', ru: 'Брюгге', de: 'Brügge', fr: 'Bruges' }, st: ['🧇', '🍫', '🍟', '🍺', '🪡', '🧁'] },
  { icon: '🥨', name: { en: 'Berlin', ko: '베를린', es: 'Berlín', pt: 'Berlim', ru: 'Берлин', de: 'Berlin', fr: 'Berlin' }, st: ['🚆', '🎧', '🌭', '🖌️', '🎛️', '🧸'] },
  { icon: '🏰', name: { en: 'Bavaria', ko: '바이에른', es: 'Baviera', pt: 'Baviera', ru: 'Бавария', de: 'Bayern', fr: 'Bavière' }, st: ['🏰', '🥨', '🐄', '🍻', '🎿', '🍖'] },
  { icon: '🕰️', name: { en: 'Prague', ko: '프라하', es: 'Praga', pt: 'Praga', ru: 'Прага', de: 'Prag', fr: 'Prague' }, st: ['🕰️', '🗝️', '🦇', '🧙', '⏰', '🪄'] },
  { icon: '🦢', name: { en: 'Hallstatt', ko: '할슈타트', es: 'Hallstatt', pt: 'Hallstatt', ru: 'Гальштат', de: 'Hallstatt', fr: 'Hallstatt' }, st: ['🦢', '🏘️', '🏡', '🌼', '🪵', '💧'] },
  { icon: '🛁', name: { en: 'Budapest', ko: '부다페스트', es: 'Budapest', pt: 'Budapeste', ru: 'Будапешт', de: 'Budapest', fr: 'Budapest' }, st: ['🛁', '🌶️', '🧩', '🫑', '🚊', '🥒'] },
  { icon: '🩰', name: { en: 'Saint Petersburg', ko: '상트페테르부르크', es: 'San Petersburgo', pt: 'São Petersburgo', ru: 'Санкт-Петербург', de: 'Sankt Petersburg', fr: 'Saint-Pétersbourg' }, st: ['🩰', '🪆', '👸', '♟️', '🎇', '👑'] },
  { icon: '🌻', name: { en: 'Provence', ko: '프로방스', es: 'Provenza', pt: 'Provença', ru: 'Прованс', de: 'Provence', fr: 'Provence' }, st: ['🌻', '💜', '🐝', '🧼', '🍑', '🦗'] },
  { icon: '🏎️', name: { en: 'Monaco', ko: '모나코', es: 'Mónaco', pt: 'Mônaco', ru: 'Монако', de: 'Monaco', fr: 'Monaco' }, st: ['🏎️', '🛥️', '🏁', '💍', '🥂', '🕶️'] },
  { icon: '🍇', name: { en: 'Tuscany', ko: '토스카나', es: 'Toscana', pt: 'Toscana', ru: 'Тоскана', de: 'Toskana', fr: 'Toscane' }, st: ['🍇', '🫒', '🍅', '🐗', '🧄', '🍷'] },
  { icon: '🍋', name: { en: 'Amalfi Coast', ko: '아말피 해안', es: 'Costa Amalfitana', pt: 'Costa Amalfitana', ru: 'Амальфитанское побережье', de: 'Amalfiküste', fr: 'Côte amalfitaine' }, st: ['🍋', '🌅', '🦑', '🍾', '🥗', '🛵'] },
  { icon: '🦉', name: { en: 'Athens', ko: '아테네', es: 'Atenas', pt: 'Atenas', ru: 'Афины', de: 'Athen', fr: 'Athènes' }, st: ['🦉', '⚱️', '🏃', '🥇', '🏟️', '⚡'] },
  { icon: '🚋', name: { en: 'Lisbon', ko: '리스본', es: 'Lisboa', pt: 'Lisboa', ru: 'Лиссабон', de: 'Lissabon', fr: 'Lisbonne' }, st: ['🚋', '🐟', '🍮', '🎙️', '🛤️', '🍒'] },
  { icon: '🫖', name: { en: 'Marrakech', ko: '마라케시', es: 'Marrakech', pt: 'Marrakech', ru: 'Марракеш', de: 'Marrakesch', fr: 'Marrakech' }, st: ['🫖', '🧿', '🥿', '🧺', '🫓', '🪘'] },
  { icon: '🏜️', name: { en: 'Sahara', ko: '사하라 사막', es: 'Desierto del Sahara', pt: 'Deserto do Saara', ru: 'Сахара', de: 'Sahara', fr: 'Sahara' }, st: ['🐪', '⭐', '🦂', '🌞', '🌠', '🌡️'] },
  { icon: '🎈', name: { en: 'Cappadocia', ko: '카파도키아', es: 'Capadocia', pt: 'Capadócia', ru: 'Каппадокия', de: 'Kappadokien', fr: 'Cappadoce' }, st: ['🎈', '🏺', '🕳️', '🍶', '🌤️', '🍎'] },
  { icon: '🪨', name: { en: 'Petra', ko: '페트라', es: 'Petra', pt: 'Petra', ru: 'Петра', de: 'Petra', fr: 'Pétra' }, st: ['🐐', '🔦', '🪙', '⛏️', '🌑', '🦴'] },
  { icon: '⛱️', name: { en: 'Zanzibar', ko: '잔지바르', es: 'Zanzíbar', pt: 'Zanzibar', ru: 'Занзибар', de: 'Sansibar', fr: 'Zanzibar' }, st: ['⛱️', '🐬', '🚪', '🦞', '🌰', '🍉'] },
  { icon: '🥥', name: { en: 'Seychelles', ko: '세이셸', es: 'Seychelles', pt: 'Seicheles', ru: 'Сейшелы', de: 'Seychellen', fr: 'Seychelles' }, st: ['👙', '🧴', '🍧', '🌱', '🍐', '🦤'] },
  { icon: '🦎', name: { en: 'Madagascar', ko: '마다가스카르', es: 'Madagascar', pt: 'Madagascar', ru: 'Мадагаскар', de: 'Madagaskar', fr: 'Madagascar' }, st: ['🦎', '🐒', '🐾', '🐞', '🐛', '🦔'] },
  { icon: '🌈', name: { en: 'Victoria Falls', ko: '빅토리아 폭포', es: 'Cataratas Victoria', pt: 'Cataratas Vitória', ru: 'Водопад Виктория', de: 'Victoriafälle', fr: 'Chutes Victoria' }, st: ['🌈', '🦛', '🚁', '🐃', '🪢', '🌀'] },
  { icon: '⛰️', name: { en: 'Cape Town', ko: '케이프타운', es: 'Ciudad del Cabo', pt: 'Cidade do Cabo', ru: 'Кейптаун', de: 'Kapstadt', fr: 'Le Cap' }, st: ['⛰️', '🚡', '🌍', '🦦', '🦡', '🍔'] },
  { icon: '🤿', name: { en: 'Maldives', ko: '몰디브', es: 'Maldivas', pt: 'Maldivas', ru: 'Мальдивы', de: 'Malediven', fr: 'Maldives' }, st: ['🤿', '🛩️', '🏨', '🍸', '🩱', '✨'] },
  { icon: '🐘', name: { en: 'Sri Lanka', ko: '스리랑카', es: 'Sri Lanka', pt: 'Sri Lanka', ru: 'Шри-Ланка', de: 'Sri Lanka', fr: 'Sri Lanka' }, st: ['🐘', '🍵', '🚂', '🦚', '📿', '🎣'] },
  { icon: '⛺', name: { en: 'Himalayas', ko: '히말라야', es: 'Himalaya', pt: 'Himalaia', ru: 'Гималаи', de: 'Himalaya', fr: 'Himalaya' }, st: ['🏔️', '🙏', '🐂', '🚩', '🪜', '⛑️'] },
  { icon: '🍈', name: { en: 'Samarkand', ko: '사마르칸트', es: 'Samarcanda', pt: 'Samarcanda', ru: 'Самарканд', de: 'Samarkand', fr: 'Samarcande' }, st: ['🍈', '🔷', '🥜', '🧞', '🏵️', '💠'] },
  { icon: '🐎', name: { en: 'Mongolia', ko: '몽골', es: 'Mongolia', pt: 'Mongólia', ru: 'Монголия', de: 'Mongolei', fr: 'Mongolie' }, st: ['🐎', '⛺', '🏹', '🤼', '🦖', '🥛'] },
  { icon: '🐒', name: { en: 'Angkor Wat', ko: '앙코르와트', es: 'Angkor Wat', pt: 'Angkor Wat', ru: 'Ангкор-Ват', de: 'Angkor Wat', fr: 'Angkor Vat' }, st: ['🌄', '🗡️', '🕸️', '🔱', '🌕', '🔍'] },
  { icon: '🐉', name: { en: 'Ha Long Bay', ko: '하롱베이', es: 'Bahía de Ha Long', pt: 'Baía de Ha Long', ru: 'Бухта Халонг', de: 'Halong-Bucht', fr: 'Baie d’Along' }, st: ['🐉', '🐲', '🦪', '👒', '🌯', '🍥'] },
  { icon: '🌇', name: { en: 'Singapore', ko: '싱가포르', es: 'Singapur', pt: 'Singapura', ru: 'Сингапур', de: 'Singapur', fr: 'Singapour' }, st: ['🌇', '🍜', '🚇', '🛬', '🪴', '💫'] },
  { icon: '🐋', name: { en: 'Philippines', ko: '필리핀', es: 'Filipinas', pt: 'Filipinas', ru: 'Филиппины', de: 'Philippinen', fr: 'Philippines' }, st: ['🎤', '🚐', '🍠', '🐷', '🏀', '🧃'] },
  { icon: '🌃', name: { en: 'Hong Kong', ko: '홍콩', es: 'Hong Kong', pt: 'Hong Kong', ru: 'Гонконг', de: 'Hongkong', fr: 'Hong Kong' }, st: ['🌃', '🥢', '🥠', '🥡', '🥮', '🏢'] },
  { icon: '🥟', name: { en: 'Shanghai', ko: '상하이', es: 'Shanghái', pt: 'Xangai', ru: 'Шанхай', de: 'Shanghai', fr: 'Shanghai' }, st: ['🌆', '🚅', '🏬', '🚦', '🌂', '🕹️'] },
  { icon: '🧋', name: { en: 'Taipei', ko: '타이베이', es: 'Taipéi', pt: 'Taipé', ru: 'Тайбэй', de: 'Taipeh', fr: 'Taipei' }, st: ['🧋', '🏮', '🚝', '🧨', '🍄', '🎴'] },
  { icon: '🐟', name: { en: 'Busan', ko: '부산', es: 'Busan', pt: 'Busan', ru: 'Пусан', de: 'Busan', fr: 'Busan' }, st: ['🎞️', '⚾', '🖍️', '🪣', '🥽', '🚍'] },
  { icon: '🍊', name: { en: 'Jeju Island', ko: '제주도', es: 'Isla de Jeju', pt: 'Ilha de Jeju', ru: 'Остров Чеджу', de: 'Insel Jeju', fr: 'Île de Jeju' }, st: ['🍊', '👵', '🥓', '🥕', '🚶', '🍂'] },
  { icon: '⛩️', name: { en: 'Kyoto', ko: '교토', es: 'Kioto', pt: 'Quioto', ru: 'Киото', de: 'Kyoto', fr: 'Kyoto' }, st: ['⛩️', '👘', '🍡', '🍱', '🎍', '🎐'] },
  { icon: '🐙', name: { en: 'Osaka', ko: '오사카', es: 'Osaka', pt: 'Osaka', ru: 'Осака', de: 'Osaka', fr: 'Osaka' }, st: ['🎏', '🍙', '🎯', '🍘', '🍳', '🎳'] },
  { icon: '⛄', name: { en: 'Hokkaido', ko: '홋카이도', es: 'Hokkaido', pt: 'Hokkaido', ru: 'Хоккайдо', de: 'Hokkaido', fr: 'Hokkaidō' }, st: ['⛄', '❄️', '🧈', '🥃', '🏂', '🚜'] },
  { icon: '🐠', name: { en: 'Great Barrier Reef', ko: '그레이트배리어리프', es: 'Gran Barrera de Coral', pt: 'Grande Barreira de Coral', ru: 'Большой Барьерный риф', de: 'Great Barrier Reef', fr: 'Grande Barrière de corail' }, st: ['🐠', '🐚', '🧜‍♂️', '🐡', '🧽', '🌏'] },
  { icon: '🪃', name: { en: 'Uluru', ko: '울루루', es: 'Uluru', pt: 'Uluru', ru: 'Улуру', de: 'Uluru', fr: 'Uluru' }, st: ['🪃', '🐍', '🔥', '🪰', '🐁', '🌜'] },
  { icon: '🏝️', name: { en: 'Fiji', ko: '피지', es: 'Fiyi', pt: 'Fiji', ru: 'Фиджи', de: 'Fidschi', fr: 'Fidji' }, st: ['🥥', '🐣', '🥬', '🏈', '🍽️', '🎖️'] },
  { icon: '🌴', name: { en: 'Bora Bora', ko: '보라보라', es: 'Bora Bora', pt: 'Bora Bora', ru: 'Бора-Бора', de: 'Bora Bora', fr: 'Bora-Bora' }, st: ['🌴', '🛖', '🦐', '💒', '🛏️', '🎀'] },
  { icon: '🗿', name: { en: 'Easter Island', ko: '이스터섬', es: 'Isla de Pascua', pt: 'Ilha de Páscoa', ru: 'Остров Пасхи', de: 'Osterinsel', fr: 'Île de Pâques' }, st: ['🗿', '🐓', '🪨', '🥚', '🐇', '🌔'] },
  { icon: '🧊', name: { en: 'Patagonia', ko: '파타고니아', es: 'Patagonia', pt: 'Patagônia', ru: 'Патагония', de: 'Patagonien', fr: 'Patagonie' }, st: ['🧊', '🦊', '🏍️', '🌪️', '🛣️', '🐮'] },
  { icon: '🧉', name: { en: 'Buenos Aires', ko: '부에노스아이레스', es: 'Buenos Aires', pt: 'Buenos Aires', ru: 'Буэнос-Айрес', de: 'Buenos Aires', fr: 'Buenos Aires' }, st: ['🧉', '🥩', '🎨', '🪗', '📚', '🎽'] },
  { icon: '🔭', name: { en: 'Atacama Desert', ko: '아타카마 사막', es: 'Desierto de Atacama', pt: 'Deserto do Atacama', ru: 'Пустыня Атакама', de: 'Atacama-Wüste', fr: 'Désert d’Atacama' }, st: ['🔭', '🌌', '🛸', '🌓', '🔆', '🔋'] },
  { icon: '🧂', name: { en: 'Uyuni Salt Flat', ko: '우유니 소금사막', es: 'Salar de Uyuni', pt: 'Salar de Uyuni', ru: 'Солончак Уюни', de: 'Salar de Uyuni', fr: 'Salar d’Uyuni' }, st: ['🧂', '🪞', '☁️', '📷', '🚞', '⏳'] },
  { icon: '🐢', name: { en: 'Galápagos', ko: '갈라파고스', es: 'Galápagos', pt: 'Galápagos', ru: 'Галапагосы', de: 'Galápagos', fr: 'Galápagos' }, st: ['🐢', '🦭', '🐦', '🔬', '🦀', '🧪'] },
  { icon: '☕', name: { en: 'Colombia', ko: '콜롬비아', es: 'Colombia', pt: 'Colômbia', ru: 'Колумбия', de: 'Kolumbien', fr: 'Colombie' }, st: ['☕', '💐', '📖', '🍭', '🚟', '🫔'] },
  { icon: '🦥', name: { en: 'Costa Rica', ko: '코스타리카', es: 'Costa Rica', pt: 'Costa Rica', ru: 'Коста-Рика', de: 'Costa Rica', fr: 'Costa Rica' }, st: ['🦥', '🐸', '🌿', '🍌', '🦝', '🦺'] },
  { icon: '🚗', name: { en: 'Havana', ko: '아바나', es: 'La Habana', pt: 'Havana', ru: 'Гавана', de: 'Havanna', fr: 'La Havane' }, st: ['🚗', '🎺', '📻', '🚖', '🕺', '🥫'] },
  { icon: '🎢', name: { en: 'Florida', ko: '플로리다', es: 'Florida', pt: 'Flórida', ru: 'Флорида', de: 'Florida', fr: 'Floride' }, st: ['🎢', '🐊', '🏖️', '🐭', '🛫', '🎾'] },
  { icon: '🎷', name: { en: 'New Orleans', ko: '뉴올리언스', es: 'Nueva Orleans', pt: 'Nova Orleans', ru: 'Новый Орлеан', de: 'New Orleans', fr: 'La Nouvelle-Orléans' }, st: ['🎷', '🍤', '🎩', '⚜️', '🍩', '🔮'] },
  { icon: '💦', name: { en: 'Niagara Falls', ko: '나이아가라 폭포', es: 'Cataratas del Niágara', pt: 'Cataratas do Niágara', ru: 'Ниагарский водопад', de: 'Niagarafälle', fr: 'Chutes du Niagara' }, st: ['💦', '🚢', '🌫️', '☔', '🌥️', '🎫'] },
  { icon: '🤠', name: { en: 'Grand Canyon', ko: '그랜드캐니언', es: 'Gran Cañón', pt: 'Grand Canyon', ru: 'Гранд-Каньон', de: 'Grand Canyon', fr: 'Grand Canyon' }, st: ['🤠', '🏜️', '🦅', '🏇', '🛻', '🧢'] },
  { icon: '🎰', name: { en: 'Las Vegas', ko: '라스베이거스', es: 'Las Vegas', pt: 'Las Vegas', ru: 'Лас-Вегас', de: 'Las Vegas', fr: 'Las Vegas' }, st: ['🎰', '🃏', '🎲', '💡', '♠️', '♦️'] },
  { icon: '🎬', name: { en: 'Hollywood', ko: '할리우드', es: 'Hollywood', pt: 'Hollywood', ru: 'Голливуд', de: 'Hollywood', fr: 'Hollywood' }, st: ['🎬', '🍿', '🎥', '🏆', '📽️', '🌟'] },
  { icon: '🦬', name: { en: 'Yellowstone', ko: '옐로스톤', es: 'Yellowstone', pt: 'Yellowstone', ru: 'Йеллоустон', de: 'Yellowstone', fr: 'Yellowstone' }, st: ['🦬', '♨️', '💨', '🐿️', '🥾', '🦨'] },
  { icon: '🏕️', name: { en: 'Banff', ko: '밴프', es: 'Banff', pt: 'Banff', ru: 'Банф', de: 'Banff', fr: 'Banff' }, st: ['🏕️', '🛶', '🦌', '🌲', '🧗', '🥌'] },
  { icon: '🐺', name: { en: 'Alaska', ko: '알래스카', es: 'Alaska', pt: 'Alasca', ru: 'Аляска', de: 'Alaska', fr: 'Alaska' }, st: ['🐺', '🐕', '🦣', '🛢️', '🌝', '🥶'] },
  { icon: '🚀', name: { en: 'Space', ko: '우주', es: 'El espacio', pt: 'Espaço', ru: 'Космос', de: 'Weltall', fr: 'L’espace' }, st: ['🚀', '🌙', '🪐', '🛰️', '☄️', '👽'] }, // 항상 마지막
];
const CLEARS_PER_STICKER = 5;
const STICKERS_PER_PAGE = 6;
// 나중에 추가한 언어의 여행지 이름(ALBUM 순서 그대로). 표에 없으면 영어로
const ALBUM_EXTRA = {
  de: ['Reisevorbereitung', 'Paris', 'London', 'Amsterdam', 'Wien', 'Schweizer Alpen', 'Venedig', 'Rom', 'Barcelona', 'Santorin', 'Island', 'Istanbul', 'Kairo', 'Kenia-Safari', 'Dubai', 'Indien', 'Bangkok', 'Bali', 'Peking', 'Seoul', 'Tokio', 'Sydney', 'Neuseeland', 'Hawaii', 'San Francisco', 'New York', 'Kanada', 'Mexiko', 'Karibik', 'Amazonas', 'Peru', 'Rio de Janeiro', 'Antarktis', 'Lappland'],
  fr: ['Préparatifs', 'Paris', 'Londres', 'Amsterdam', 'Vienne', 'Alpes suisses', 'Venise', 'Rome', 'Barcelone', 'Santorin', 'Islande', 'Istanbul', 'Le Caire', 'Safari au Kenya', 'Dubaï', 'Inde', 'Bangkok', 'Bali', 'Pékin', 'Séoul', 'Tokyo', 'Sydney', 'Nouvelle-Zélande', 'Hawaï', 'San Francisco', 'New York', 'Canada', 'Mexique', 'Caraïbes', 'Amazonie', 'Pérou', 'Rio de Janeiro', 'Antarctique', 'Laponie'],
};
const placeName = w => {
  const n = ALBUM[w].name, l = window.I18N.lang;
  return n[l] || (ALBUM_EXTRA[l] && ALBUM_EXTRA[l][w]) || window.I18N.place(w) || n.en;
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
    tok.innerHTML = `<span class="face"><span class="num">${SHAPE_SVG[i]}</span></span><span class="arrow">${ARROW_SVG}</span>`;
    tok.addEventListener('click', () => onPieceClick(i));
    layerEl.appendChild(tok);
  });

  applyStaticGeometry();
  refreshPieces();
}

// 오른쪽을 가리키는 굵은 화살표(회전으로 방향 표시) — 이 게임의 핵심 정보라 크게
const ARROW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// 조각의 무늬(해·달·별·하트)가 얼굴 역할 — 눈 표정은 유치하다는 피드백으로 뺐다(2026-10-06).
// 무늬를 화살표 반대쪽으로 밀어 화살표와 겹치지 않게 한다. 반응은 움직임으로: 막히면 툭(bump), 도착하면 무늬가 반짝(.arrived)
function setFace(tok, d, cell) {
  const off = cell * 0.1;
  tok.querySelector('.face').style.transform = `translate(${-VECTORS[d][0] * off}px, ${-VECTORS[d][1] * off}px)`;
}

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
    const mk = el.querySelector('.num'); mk.style.width = mk.style.height = Math.round(cell * 0.31) + 'px'; // 조각의 얼굴 역할을 하는 무늬 — 크게
    el.style.setProperty('--badge', Math.round(cell * 0.34) + 'px'); // 도착 체크 배지 크기
  });
}

function refreshPieces() {
  const { center, cell } = geom();
  const toks = pieceEls();

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
    setFace(tok, d, cell);
    tok.classList.toggle('selected', G.selected.includes(i));
    tok.classList.toggle('hinted', !!(G.hintPair && G.hintPair.includes(i)) && !G.selected.includes(i));
    tok.classList.toggle('on-target',
      p[0] === G.stage.targets[i][0] && p[1] === G.stage.targets[i][1]);
  });
  renderPeek();
}

/* ---------- 미리보기 부스터 ----------
 * 켜 두면(그 판 동안) 조각 하나를 골랐을 때, 다른 조각 각각과 짝지으면 두 조각이 어디로 가는지
 * 짝 조각 색의 점선으로 보여 준다. 막혀서 제자리면 ✕. 하루 FREE_PEEKS번 무료(프리미엄은 무제한). */
const FREE_PEEKS = 5;
const peeksLeft = () => {
  if (isPremium()) return Infinity;
  if (!progress.peek || progress.peek.date !== todayKey()) progress.peek = { date: todayKey(), used: 0 };
  return Math.max(0, FREE_PEEKS - progress.peek.used);
};
function updatePeekButton() {
  const c = $('#peekCount'), b = $('#btnPeek'); if (!c || !b) return;
  const left = peeksLeft();
  c.textContent = left === Infinity ? '∞' : String(left);
  b.classList.toggle('on', !!G.peekOn);
}
function usePeek() {
  if (G.animating || !G.stage || G.challenge) return;
  if (G.peekOn) { G.tipMsg = t('peek_on'); updatePreview(); return; } // 이미 켜져 있으면 안내만 다시
  if (peeksLeft() <= 0) { G.tipMsg = t('peek_none_left'); updatePreview(); return; }
  if (!isPremium()) { progress.peek.used++; saveProgress(progress); }
  G.peekOn = true;
  G.tipMsg = t('peek_on');
  logEvent('peek_used');
  updatePeekButton(); updatePreview();
}
function renderPeek() {
  let svg = layerEl.querySelector('.peek-layer');
  if (!G.peekOn || G.selected.length !== 1 || G.animating) { if (svg) svg.remove(); return; }
  const { center, cell, W } = geom();
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'peek-layer'); svg.setAttribute('aria-hidden', 'true');
    layerEl.appendChild(svg);
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
  const a = G.selected[0], n = G.stage.n;
  let html = '';
  G.state.forEach((_, b) => {
    if (b === a) return;
    const nx = outcome(G.state, a < b ? [a, b] : [b, a], n, G.wallSet, G.tileMap);
    const col = PIECE_COLORS[b], k = (b - (b > a ? 1 : 0)) - 1; // 짝마다 선을 조금씩 비켜 그린다
    const sh = k * cell * 0.07;
    [a, b].forEach(i => {
      const x0 = center(G.state[i][0]), y0 = center(G.state[i][1]), x1 = center(nx[i][0]), y1 = center(nx[i][1]);
      if (x0 === x1 && y0 === y1) { // 막힘: 조각 모서리에 ✕
        const cx = x0 + cell * 0.3 + sh, cy = y0 + cell * 0.3;
        html += `<g class="pk-x" style="color:${col}"><circle cx="${cx}" cy="${cy}" r="${cell * 0.1}"/><path d="M${cx - cell * 0.045} ${cy - cell * 0.045}L${cx + cell * 0.045} ${cy + cell * 0.045}M${cx + cell * 0.045} ${cy - cell * 0.045}L${cx - cell * 0.045} ${cy + cell * 0.045}"/></g>`;
      } else {
        const ox = (y1 !== y0 ? sh : 0), oy = (x1 !== x0 ? sh : 0);
        // 선은 조각 가장자리에서 시작(얼굴을 가리지 않게), 도착 칸엔 동그라미
        const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0), sx = x0 + dx * cell * 0.42, sy = y0 + dy * cell * 0.42;
        html += `<g class="pk-go" style="color:${col}"><path d="M${sx + ox} ${sy + oy}L${x1 + ox} ${y1 + oy}"/><circle cx="${x1 + ox}" cy="${y1 + oy}" r="${cell * 0.11}"/></g>`;
      }
    });
  });
  svg.innerHTML = html;
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
      const d = next[i][2]; // 맞바꾼 방향 + 얼굴은 반대쪽으로
      const ar = el.querySelector('.arrow'); ar.style.transform = `rotate(${arrowAngle(ar, d)}deg)`;
      setFace(el, d, geom().cell);
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
  const canAdMoves = outOfMoves && !isPremium() && adsOn() && !G.challenge;
  let msg = '';
  if (G.challenge) msg = G.tipMsg || t('ch_status', { n: Math.max(0, movesLeft()) });
  else if (outOfMoves) msg = t(canAdMoves ? 'moves_out' : 'moves_out_noad');
  else if (G.hintPair && G.hintMsg) msg = G.hintMsg;
  else if (G.tipMsg) msg = G.tipMsg;
  else if (G.introMsg) msg = G.introMsg;
  else if (G.daily == null && !G.quickMode && G.index < WORLD_SIZE && !G.history.length && !G.selected.length && !coachOn) msg = t('select_two');
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
  if (G.challenge) G.chMoves++; // 대결: 되돌려도 줄지 않는 '한 이동 수'
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
    else if (G.challenge && movesLeft() <= 0) endChallenge(false); // 대결: 이동을 다 쓰면 실패
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

// 클리어 마무리: 조각들이 차례로 목표 안으로 쏙 들어가 사라지고, 빈 판 가운데에 이 월드의 여행지 그림이 튀어나온다
const CLEAR_FX_DELAY = 480; // 마지막 이동 후 '쏙' 시작까지(그 전엔 통통 튀는 축하)
function playClearFx() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const idx = G.index;
  pieceEls().forEach((el, k) => setTimeout(() => { if (G.index === idx) el.classList.add('cleared'); }, CLEAR_FX_DELAY + k * 90));
  setTimeout(() => {
    if (G.index !== idx || !G.stage) return;
    const e = document.createElement('div');
    e.className = 'win-emoji';
    e.textContent = ALBUM[worldOf(idx)].icon;
    e.style.fontSize = Math.round(geom().cell * 1.25) + 'px';
    layerEl.appendChild(e);
  }, CLEAR_FX_DELAY + pieceEls().length * 90 + 120);
}
function clearClearFx() {
  pieceEls().forEach(el => el.classList.remove('cleared', 'win-bounce'));
  layerEl.querySelectorAll('.win-emoji').forEach(e => e.remove());
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
  coachOn = !progress.tutorialSeen && G.index === 0 && G.daily == null && !G.quickMode;
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
  if (!G.history.length || G.animating) return; // 대결에서도 되돌리기는 되지만 이미 한 이동 수(G.chMoves)는 그대로
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
  clearClearFx(); // '다시 풀기'로 돌아오면 사라졌던 조각을 되살린다
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
  if (G.animating || G.challenge) return;
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
  migrateProgress(local); migrateProgress(cloud);
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
  out.quick = { best: Math.max((local.quick && local.quick.best) || 0, (cloud.quick && cloud.quick.best) || 0), played: Math.max((local.quick && local.quick.played) || 0, (cloud.quick && cloud.quick.played) || 0) };
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
/* ---------- 끝없는 모드(빠른 한 판) ----------
 * 정식 레벨과 별개로 게임 안에서 즉석으로 퍼즐을 만든다. 연속으로 깰수록 어려워진다(조각 수·최소 수·벽·칸).
 * 만드는 법은 generate-stages-*.cjs와 같다: 무작위 배치 → 모든 상태를 넓이 우선 탐색 → 원하는 최소 수의 목표 배치를 고른다.
 * 외길 퍼즐(최단 풀이가 1가지)은 제외. 진행 기록(깬 레벨·스티커)에는 넣지 않고 최고 연속 기록만 저장한다. */
const QUICK_CAP = 6000; // 탐색 상태 상한(4×4·조각 4개에서도 수십 ms)
function quickSpec(s) {
  const pieces = s < 4 ? 3 : 4;
  const lo = Math.min(7, 3 + Math.floor(s / 3));
  return { n: 4, pieces, walls: s < 2 ? 0 : 1 + (s % 4 === 3 ? 1 : 0), tile: s >= 5 && s % 2 === 1, lo, hi: lo + 1 };
}
// 시작 배치에서 갈 수 있는 모든 상태를 넓이 우선 탐색 → 위치 배치마다 {처음 닿은 거리, 최단 경로 수}. 상한을 넘으면 null
function quickExplore(start, n, wallSet, tileMap) {
  const pairs = pairsFor(start.length);
  const pk = st => st.map(p => p[0] + ',' + p[1]).join(';');
  const states = [start], idx = new Map([[key(start), 0]]), dist = [0], ways = [1], goals = new Map();
  for (let i = 0; i < states.length; i++) {
    if (states.length > QUICK_CAP) return null;
    const st = states[i], d = dist[i], p = pk(st);
    if (!goals.has(p)) goals.set(p, { pos: st.map(q => [q[0], q[1]]), key: p, d, ways: 0 });
    const g = goals.get(p); if (g.d === d) g.ways += ways[i];
    for (const pr of pairs) {
      const nx = outcome(st, pr, n, wallSet, tileMap), kk = key(nx);
      let j = idx.get(kk);
      if (j === undefined) { j = states.length; idx.set(kk, j); states.push(nx); dist.push(d + 1); ways.push(ways[i]); }
      else if (dist[j] === d + 1) ways[j] += ways[i];
    }
  }
  return goals;
}
function genQuickPuzzle(s) {
  const sp = quickSpec(s), n = sp.n;
  for (let tries = 0; tries < 300; tries++) {
    const cells = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push([x, y]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    let k = 0;
    const walls = cells.slice(k, k += sp.walls);
    const tiles = sp.tile ? [[cells[k][0], cells[k++][1], Math.floor(Math.random() * 4)]] : [];
    const start = cells.slice(k, k + sp.pieces).map(c => [c[0], c[1], Math.floor(Math.random() * 4)]);
    const wallSet = new Set(walls.map(c => c[0] + ',' + c[1])), tileMap = new Map(tiles.map(c => [c[0] + ',' + c[1], c[2]]));
    const goals = quickExplore(start, n, wallSet, tileMap);
    if (!goals) continue;
    let pool = [...goals.values()].filter(g => g.d >= sp.lo && g.d <= sp.hi && g.ways >= 2);
    // 칸이 있으면 실제로 풀이에 영향을 주는 판만: 칸 없이 탐색해 같은 수 이하로 풀리면 뺀다(탐색 한 번)
    if (tiles.length && pool.length) {
      const plain = quickExplore(start, n, wallSet, null);
      if (!plain) continue;
      pool = pool.filter(g => { const h = plain.get(g.key); return !h || h.d > g.d; });
    }
    if (!pool.length) continue;
    const g = pool[Math.floor(Math.random() * pool.length)];
    const st = { id: 'QUICK', seq: 0, chapter: '', n, pieces: sp.pieces, start, targets: g.pos, min: g.d, ways: g.ways };
    if (walls.length) st.walls = walls;
    if (tiles.length) st.tiles = tiles;
    return st;
  }
  // 드물게 못 만들면 정식 레벨에서 비슷한 최소 수의 판을 빌려 온다
  const cand = STAGES.filter(x => x.min >= sp.lo && x.min <= sp.hi && x.pieces === sp.pieces);
  const b = cand[Math.floor(Math.random() * cand.length)] || STAGES[0];
  return Object.assign({}, b, { id: 'QUICK' });
}
function startQuick() {
  G.quickStreak = 0; G.quickNext = null;
  logEvent('quick_start');
  nextQuick();
}
function nextQuick() {
  const pre = G.quickNext && G.quickNext.s === (G.quickStreak || 0) ? G.quickNext.st : null; // 결과 창 동안 미리 만들어 둔 퍼즐
  G.quickNext = null;
  loadStage(progress.last || 0, null, pre || genQuickPuzzle(G.quickStreak || 0));
}
function onQuickWin() {
  const moves = G.history.length, st = G.stage, tier = starTier(moves, st.min);
  G.quickStreak = (G.quickStreak || 0) + 1;
  const q = progress.quick || (progress.quick = { best: 0, played: 0 });
  q.played = (q.played || 0) + 1;
  const newBest = G.quickStreak > (q.best || 0);
  if (newBest) q.best = G.quickStreak;
  saveProgress(progress);
  logEvent('quick_win', { streak: G.quickStreak });
  const badgeEl = overlay.querySelector('.badge');
  badgeEl.innerHTML = [1, 2, 3].map(k => `<span class="st${k <= tier ? ' on' : ''}">★</span>`).join('');
  badgeEl.className = 'badge stars';
  overlay.querySelector('.result-title').textContent = t('quick_win', { n: G.quickStreak });
  overlay.querySelector('.result-sub').innerHTML = t('result_moves', { moves, min: st.min }) + ' · '
    + (newBest ? t('quick_new_best') : t('quick_best', { n: q.best }));
  const btnNextEl = overlay.querySelector('#btnNext');
  btnNextEl.style.display = ''; btnNextEl.textContent = t('quick_next');
  $('#btnReplay').style.display = 'none'; // 같은 판을 다시 깨서 연속 기록을 올리지 못하게
  overlay.dataset.mode = 'quick';
  if (Object.keys(progress.completed).length > AD_GRACE_CLEARS) {
    G.clearsSinceAd = (G.clearsSinceAd || 0) + 1;
    if (G.clearsSinceAd >= ADS_EVERY_CLEARS) G.adDue = true;
  }
  G.animating = true;
  clearTimeout(G.winTimer);
  G.winTimer = setTimeout(() => { G.animating = false; overlay.classList.add('show'); syncGameplay(); }, WIN_REVEAL_MS);
  // 다음 퍼즐은 결과 창이 뜬 뒤(연출이 끝난 뒤) 미리 만든다 — '다음 퍼즐'을 누르면 바로 시작
  const s = G.quickStreak;
  setTimeout(() => { if (G.quickMode && G.quickStreak === s) G.quickNext = { s, st: genQuickPuzzle(s) }; }, WIN_REVEAL_MS + 80);
  Sound.win(); haptic([20, 40, 60]); confettiBurst(); screenFlash();
  pieceEls().forEach((el, k) => { setTimeout(() => { el.classList.remove('win-bounce'); void el.offsetWidth; el.classList.add('win-bounce'); }, k * 70); });
  playClearFx();
}

/* ---------- 친구와 겨루기(도전장) ----------
 * 둘 다 처음 보는 새 퍼즐을 한 번만 푼다. 힌트·미리보기 없음. 되돌리기·다시 시작은 되지만 한 이동은 모두 기록에 남고(G.chMoves),
 * 한도(chLimit)를 다 쓰면 실패. (2026-10-06: 처음엔 되돌리기 금지였으나 너무 어렵다는 피드백으로 변경)
 * 승부: 성공 > 실패, 둘 다 성공이면 적은 이동 수, 같으면 무승부(둘 다 최소 수면 '둘 다 완벽').
 * 서버 없이 퍼즐과 보낸 사람 기록을 짧은 코드에 담는다(링크 #ch=코드, 포털에선 코드 복사).
 * 코드 끝의 검증값은 쉽게 고치지 못하게 하는 정도이고, 최소 수는 받는 쪽이 다시 계산한다. */
const CH_VER = 'a';
const b36 = i => i.toString(36);
function chSpec() { // 보내는 사람이 깬 월드 수준에 맞춘 난이도(빠른 한 판 생성기의 단계)
  return Math.min(12, Math.floor(worldOf(progress.reached || 0) * 0.4));
}
const chId = body => hashStr(body.slice(0, 3) + body.slice(4)).toString(36); // 같은 퍼즐+nonce면 기록(4번째 글자)과 상관없이 같은 id
function chCheck(body) { return ('000' + hashStr('swapstep-ch|' + body).toString(36)).slice(-3); }
function encodeChallenge(st, moves, nonce) {
  const n = st.n, cell = c => b36(c[1] * n + c[0]);
  let s = CH_VER + n + b36(st.min) + (moves < 0 ? 'z' : b36(moves)) + st.start.length;
  st.start.forEach((p, i) => { s += cell(p) + p[2] + cell(st.targets[i]); });
  const walls = st.walls || [], tiles = st.tiles || [];
  s += walls.length; walls.forEach(w => { s += cell(w); });
  s += tiles.length; tiles.forEach(c => { s += cell(c) + c[2]; });
  s += nonce;
  return s + chCheck(s);
}
function decodeChallenge(raw) {
  const code = String(raw || '').trim().toLowerCase().replace(/[^0-9a-z]/g, '');
  if (code.length < 12 || code[0] !== CH_VER) return null;
  const body = code.slice(0, -3);
  if (chCheck(body) !== code.slice(-3)) return null;
  let i = 1;
  const rd = () => { if (i >= body.length) throw 0; return parseInt(body[i++], 36); };
  try {
    const n = rd(); if (n !== 3 && n !== 4) return null;
    const pos = () => { const v = rd(); if (!(v < n * n)) throw 0; return [v % n, Math.floor(v / n)]; };
    rd(); // 보낸 쪽이 적은 최소 수 — 믿지 않고 아래에서 다시 계산
    const rr = body[i++], moves = rr === 'z' ? -1 : parseInt(rr, 36);
    const pc = rd(); if (pc < 2 || pc > 4) return null;
    const start = [], targets = [];
    for (let k = 0; k < pc; k++) {
      const p = pos(), d = rd(); if (d > 3) return null;
      start.push([p[0], p[1], d]); targets.push(pos());
    }
    const walls = []; for (let k = rd(); k > 0; k--) walls.push(pos());
    const tiles = []; for (let k = rd(); k > 0; k--) { const p = pos(), kind = rd(); if (kind > TILE_TURN) return null; tiles.push([p[0], p[1], kind]); }
    const nonce = body.slice(i); if (nonce.length !== 4) return null;
    const ck = c => c[0] + ',' + c[1];
    const wallSet = new Set(walls.map(ck)), tileMap = new Map(tiles.map(c => [ck(c), c[2]]));
    const distinct = a => new Set(a.map(ck)).size === a.length && !a.some(c => wallSet.has(ck(c)));
    if (!distinct(start) || !distinct(targets) || tiles.some(c => wallSet.has(ck(c)))) return null;
    const goals = quickExplore(start, n, wallSet, tileMap);
    const g = goals && goals.get(targets.map(ck).join(';'));
    if (!g || g.d < 1) return null;
    if (moves >= 0 && (moves < g.d || moves > chLimit(g.d))) return null;
    const st = { id: 'CH', seq: 0, chapter: '', n, pieces: pc, start, targets, min: g.d };
    if (walls.length) st.walls = walls;
    if (tiles.length) st.tiles = tiles;
    return { stage: st, moves, id: chId(body) };
  } catch (e) { return null; }
}
const chLimit = min => min * 2 + 6; // 대결 이동 한도(되돌린 이동까지 모두 셈)
const chRecords = () => progress.challenges || (progress.challenges = {});
function chMark(id, rec) { // 기기에 남기는 도전 기록(같은 도전장 다시 풀기 방지) — 최근 100개만
  const r = chRecords(); r[id] = rec;
  const ks = Object.keys(r); ks.slice(0, Math.max(0, ks.length - 100)).forEach(k => delete r[k]);
  saveProgress(progress);
}
const chRec = m => (m < 0 ? t('ch_rec_fail') : t('ch_rec_moves', { n: m }));
// 도전장 번호: 같은 퍼즐이면 보낸 사람·받은 사람 화면에 똑같이 보인다(같은 판인지 눈으로 확인)
const chTag = id => '#' + String(id || '').slice(0, 4).toUpperCase();

// 도전장 창: 새로 만들기 / 받은 코드 입력 / 링크로 받은 도전장
function openChallenge(msg) {
  renderChallenge(msg || '');
  $('#challenge').classList.add('show');
}
function closeChallenge() { $('#challenge').classList.remove('show'); }
function renderChallenge(msg) {
  const inc = G.chIncoming, box = $('#chIncoming');
  box.hidden = !inc;
  if (inc) $('#chIncomingRec').textContent = chTag(inc.id) + ' · ' + t('ch_incoming_rec', { r: chRec(inc.moves), min: inc.stage.min });
  $('#chMsg').textContent = msg;
}
function createChallenge() {
  closeChallenge();
  const nonce = Array.from({ length: 4 }, () => b36(Math.floor(Math.random() * 36))).join('');
  // 받는 쪽이 그대로 풀어 볼 수 있는 판인지(코드 왕복) 확인 — 드물게 빌려 온 정식 레벨이 탐색 상한을 넘으면 다시 만든다
  let st = null, dec = null;
  for (let k = 0; k < 6 && !dec; k++) { st = genQuickPuzzle(chSpec()); dec = decodeChallenge(encodeChallenge(st, -1, nonce)); }
  if (!dec) return;
  st = dec.stage;
  const id = dec.id;
  chMark(id, { m: -1, mine: 1 }); // 시작하는 순간 기록(도중에 나가면 실패)
  logEvent('ch_create');
  startChallengePlay({ stage: st, role: 'send', nonce, id, opp: null });
}
function acceptChallenge(raw) {
  const ch = typeof raw === 'string' ? decodeChallenge(raw) : raw;
  if (!ch) { openChallenge(t('ch_bad_code')); return; }
  try { if (/ch=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  const rec = chRecords()[ch.id];
  if (rec && rec.mine) { G.chIncoming = null; openChallenge(chTag(ch.id) + ' · ' + t('ch_mine')); return; }
  if (rec) { G.chIncoming = null; closeChallenge(); showChallengeResult({ stage: ch.stage, role: 'reply', opp: ch.moves, id: ch.id }, rec.m, true); return; }
  G.chIncoming = null;
  chMark(ch.id, { m: -1 });
  closeChallenge();
  logEvent('ch_accept');
  startChallengePlay({ stage: ch.stage, role: 'reply', id: ch.id, opp: ch.moves });
}
function startChallengePlay(ch) {
  loadStage(progress.last || 0, null, ch.stage);
  G.quickMode = false;
  G.challenge = ch;
  G.chMoves = 0;
  G.giveUpArm = 0;
  document.body.classList.add('ch-mode');
  renderStageLabels(); updateHud(); updatePreview(); renderProgress();
}
function giveUpChallenge() {
  if (!G.challenge || G.animating) return;
  if (Date.now() - (G.giveUpArm || 0) > 3000) { // 실수로 누르지 않게 두 번 눌러야 포기
    G.giveUpArm = Date.now();
    G.tipMsg = t('ch_giveup_confirm'); updatePreview();
    return;
  }
  endChallenge(false);
}
function endChallenge(success) {
  const ch = G.challenge, me = success ? G.chMoves : -1;
  if (!ch || ch.done) return;
  ch.done = true; ch.outOfMoves = !success && movesLeft() <= 0;
  const r = chRecords()[ch.id]; if (r) { r.m = me; saveProgress(progress); }
  logEvent('ch_end', { role: ch.role, ok: success });
  G.animating = true;
  clearTimeout(G.winTimer);
  if (success) {
    Sound.win(); haptic([20, 40, 60]); confettiBurst(); screenFlash();
    pieceEls().forEach((el, k) => { setTimeout(() => { el.classList.remove('win-bounce'); void el.offsetWidth; el.classList.add('win-bounce'); }, k * 70); });
    playClearFx();
  } else { Sound.blocked(); haptic([12, 30, 12]); }
  G.winTimer = setTimeout(() => { G.animating = false; showChallengeResult(ch, me); }, success ? WIN_REVEAL_MS : 700);
}
// 결과 창(overlay 재사용). seen=true면 이미 푼 도전장을 다시 연 경우(비교만)
function showChallengeResult(ch, me, seen) {
  G.chResult = { ch, me, seen };
  const min = ch.stage.min, badgeEl = overlay.querySelector('.badge');
  badgeEl.className = 'badge';
  let title, sub;
  if (ch.role === 'send') {
    badgeEl.textContent = me < 0 ? '😵' : '📨';
    title = me < 0 ? t('ch_fail_title') : t('ch_done_title', { n: me });
    sub = (ch.outOfMoves ? t('ch_fail_moves') + ' ' : '') + t('ch_send_sub', { min });
  } else {
    const opp = ch.opp;
    const res = me < 0 && opp < 0 ? 0 : me < 0 ? -1 : opp < 0 ? 1 : Math.sign(opp - me);
    const perfect = res === 0 && me === min;
    badgeEl.textContent = res > 0 ? '🏆' : res < 0 ? '😤' : perfect ? '🌟' : '🤝';
    title = t(res > 0 ? 'ch_win' : res < 0 ? 'ch_lose' : perfect ? 'ch_both_perfect' : 'ch_draw');
    sub = t('ch_compare', { min, me: chRec(me), opp: chRec(opp) });
    if (seen) sub = t('ch_already') + '<br>' + sub;
  }
  overlay.querySelector('.result-title').textContent = title;
  overlay.querySelector('.result-sub').innerHTML = sub + '<br>' + chTag(ch.id);
  const next = $('#btnNext'), rp = $('#btnReplay');
  next.style.display = ''; rp.style.display = '';
  next.textContent = ch.role === 'send' ? t('ch_send') : t('ch_rematch');
  rp.textContent = t('ch_close');
  $('#resultMsg').textContent = '';
  overlay.dataset.mode = 'challenge';
  overlay.classList.add('show');
  syncGameplay();
}
async function shareChallenge() {
  const R = G.chResult; if (!R) return;
  const ch = R.ch, code = encodeChallenge(ch.stage, R.me, ch.nonce);
  const name = (window.BM_BRAND && window.BM_BRAND.name) || 'SwapStep';
  const head = R.me < 0 ? t('ch_share_text_fail', { name }) : t('ch_share_text_ok', { name, n: R.me, min: ch.stage.min });
  // 링크는 포털이 아닐 때만(포털은 외부 링크 금지 → 코드만). 남의 사이트(itch 등) 안에서는 공식 사이트 주소로.
  let tail;
  if (onPortal()) tail = t('ch_share_code', { code });
  else {
    const own = window.AdsManager && window.AdsManager.isOwnSite;
    const base = own ? location.origin + location.pathname : ((window.BM_BRAND && window.BM_BRAND.homeUrl) || 'https://sgtherong.github.io/game001/');
    tail = base + '#ch=' + code;
  }
  const text = head + '\n' + tail;
  logEvent('ch_share');
  const msg = $('#resultMsg');
  try { if (navigator.share && !onPortal()) { await navigator.share({ text }); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); msg.textContent = t('share_copied') + '\n' + tail; }
  catch (e) { msg.textContent = text; }
}
function leaveChallenge() {
  G.chResult = null;
  loadStage(progress.last || 0);
}
// 시작할 때 주소(#ch=코드)로 받은 도전장
function checkIncomingChallenge() {
  const m = /[#&]ch=([0-9a-zA-Z]+)/.exec(location.hash || '');
  if (!m) return;
  const ch = decodeChallenge(m[1]);
  if (!ch) { openChallenge(t('ch_bad_code')); return; }
  const rec = chRecords()[ch.id];
  if (rec) { acceptChallenge(ch); return; } // 이미 푼(또는 내가 만든) 도전장 → 비교 결과·안내만
  G.chIncoming = ch;
  openChallenge();
}

function onWin() {
  if (G.challenge) { endChallenge(true); return; } // 대결: 진행 기록 없이 결과 비교
  if (G.quickMode) { onQuickWin(); return; } // 끝없는 모드: 진행 기록·스티커 없이 연속 기록만
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
  playClearFx();
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
function moveBudget() { return G.challenge ? chLimit(G.stage.min) : moveBudgetBase() + (G.budgetBonus || 0); }
function movesLeft() { return moveBudget() - (G.challenge ? G.chMoves : G.history.length); }

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
  movesInfoEl.textContent = t('moves_info', { n: G.challenge ? G.chMoves : G.history.length, max: moveBudget() });
  goalInfoEl.textContent = t('goal_info', { min: G.stage.min });
  if (G.challenge) renderProgress();
}
// 상단 라벨: "Level 41" + "World 2 · Paris" (데일리는 "Daily Challenge" + 난이도)
function renderStageLabels() {
  if (!G.stage) return;
  if (G.challenge) {
    stageTitleEl.textContent = t('ch_label') + ' ' + chTag(G.challenge.id);
    chapterEl.textContent = G.challenge.role === 'send' ? t('ch_sub_send') : t('ch_sub_reply', { r: chRec(G.challenge.opp) });
  } else if (G.quickMode) {
    stageTitleEl.textContent = t('quick_title');
    chapterEl.textContent = t('quick_streak', { n: G.quickStreak || 0 });
  } else if (G.daily != null) {
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
// custom: 끝없는 모드의 즉석 퍼즐(이때 G.index는 배경 색조·월드 표시용으로 마지막 정식 레벨을 유지)
function loadStage(index, dailySlot = null, custom = null) {
  clearHintDemo();
  clearTimeout(G.winTimer); G.animating = false; // 결과 창 대기 중에 다른 스테이지로 가도 옛 결과가 뜨지 않게
  G.index = Math.max(0, Math.min(STAGES.length - 1, index));
  G.quickMode = !!custom;
  G.stage = custom || STAGES[G.index];
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
  G.peekOn = false; // 미리보기 부스터는 판마다 새로
  G.daily = dailySlot; // non-null => playing today's daily puzzle
  G.challenge = null; document.body.classList.remove('ch-mode'); // 대결은 startChallengePlay가 다시 켠다
  if (dailySlot === null && !custom) { progress.last = G.index; saveProgress(progress); } // daily/quick doesn't move main progress
  updatePeekButton();
  const rp = $('#btnReplay'); if (rp) { rp.style.display = ''; rp.textContent = t('win_replay'); } // 끝없는 모드·대결에서 바꾼 '다시 풀기' 복구
  $('#resultMsg').textContent = '';
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

// 진행 막대: 지금 월드 안에서 몇 문제 깼는지(x/30) — 전체 3000판 대신 손에 잡히는 목표
function renderProgress() {
  if (!G.stage) return;
  if (G.challenge) { // 대결: 남은 이동
    progressBarEl.style.width = Math.max(0, movesLeft()) / moveBudget() * 100 + '%';
    progressTextEl.textContent = `${Math.max(0, movesLeft())}/${moveBudget()}`;
    return;
  }
  if (G.quickMode) { // 빠른 한 판: 최고 연속 기록 대비 지금 연속 기록
    const best = Math.max((progress.quick && progress.quick.best) || 0, G.quickStreak || 0, 1);
    progressBarEl.style.width = Math.min(100, (G.quickStreak || 0) / best * 100) + '%';
    progressTextEl.textContent = t('quick_best', { n: (progress.quick && progress.quick.best) || 0 });
    return;
  }
  const w = worldOf(G.index), done = worldClears(w), total = worldRange(w)[1] - worldRange(w)[0];
  progressBarEl.style.width = (done / total * 100) + '%';
  progressTextEl.textContent = `${done}/${total}`;
}

// 여행 지도: 35개 여행지를 위에서 아래로 구불구불한 길 위에 놓는다. 누르면 아래에서 그 월드의 레벨 칸이 올라온다.
// 줄 높이가 고정이라 점선 길(SVG)을 측정 없이 계산으로 그린다.
const MAP_ROW = 92; // 여행지 한 줄 높이(px)
const mapX = w => 50 + 30 * Math.sin(w * 1.15); // 여행지의 가로 위치(%) — 좌우로 굽이치는 길
function renderStageList() {
  stageListEl.innerHTML = '';
  const total = STAGES.length;
  const worldCount = Math.ceil(total / WORLD_SIZE);
  const curWorld = worldOf(G.index);
  // 맨 위: 끝없는 모드 입구
  const quick = document.createElement('button');
  quick.className = 'quick-entry';
  quick.innerHTML = `<span class="qe-tx"><b>${t('quick_title')}</b><small>${t('quick_best', { n: (progress.quick && progress.quick.best) || 0 })}</small></span><span class="qe-go">▶</span>`;
  quick.addEventListener('click', () => { closeDrawer(); startQuick(); });
  stageListEl.appendChild(quick);

  const map = document.createElement('div');
  map.className = 'trip-map';
  map.style.height = (worldCount * MAP_ROW + 16) + 'px';
  // 점선 길: 여행지 중심을 부드러운 곡선으로 잇는다(가로는 %, 세로는 px — preserveAspectRatio="none" + 선 굵기 고정)
  const H = worldCount * MAP_ROW + 16;
  let d = '';
  for (let w = 0; w < worldCount; w++) {
    const x = mapX(w), y = w * MAP_ROW + MAP_ROW / 2 + 8;
    if (!w) d = `M${x} ${y}`;
    else { const px = mapX(w - 1), py = y - MAP_ROW; d += ` C${px} ${py + MAP_ROW * 0.5} ${x} ${y - MAP_ROW * 0.5} ${x} ${y}`; }
  }
  map.innerHTML = `<svg class="tm-path" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">`
    + `<path d="${d}" class="tm-road"/></svg>`;
  for (let w = 0; w < worldCount; w++) {
    const start = w * WORLD_SIZE, end = Math.min(total, start + WORLD_SIZE);
    let done = 0; for (let i = start; i < end; i++) if (progress.completed[STAGES[i].id]) done++;
    const unlocked = isUnlocked(start);
    const node = document.createElement('button');
    node.className = 'tm-node' + (unlocked ? '' : ' locked') + (progress.worldsDone[w] ? ' done' : '') + (w === curWorld ? ' cur' : '') + (worldGold(w) ? ' gold' : '');
    node.style.left = mapX(w) + '%';
    node.style.top = (w * MAP_ROW + MAP_ROW / 2 + 8) + 'px';
    node.innerHTML = `<span class="tm-ic">${unlocked ? ALBUM[w].icon : '🔒'}</span>`
      + `<span class="tm-lbl">${w + 1}. ${placeName(w)}</span>`
      + `<span class="tm-cnt">${done}/${end - start}</span>`
      + (w === curWorld ? '<span class="tm-pin" aria-hidden="true">📍</span>' : '');
    node.title = chapterName(STAGES[start].chapter);
    if (unlocked) node.addEventListener('click', () => openWorldSheet(w));
    else node.disabled = true;
    map.appendChild(node);
  }
  stageListEl.appendChild(map);
  // 지금 월드가 보이게 스크롤하고, 그 월드의 레벨 칸을 바로 띄운다(이어하기가 한 번에)
  requestAnimationFrame(() => {
    const cur = map.querySelector('.tm-node.cur');
    if (cur) { try { stageListEl.scrollTop = Math.max(0, cur.offsetTop - stageListEl.clientHeight * 0.35); } catch (e) {} }
  });
  openWorldSheet(curWorld);
}
// 아래에서 올라오는 월드 레벨 칸
function openWorldSheet(w) {
  const sheet = $('#worldSheet'); if (!sheet) return;
  const start = w * WORLD_SIZE, end = Math.min(STAGES.length, start + WORLD_SIZE);
  const items = []; for (let i = start; i < end; i++) items.push({ s: STAGES[i], i });
  $('#wsTitle').textContent = `${ALBUM[w].icon} ${t('album_page', { n: w + 1, place: placeName(w) })}`;
  $('#wsSub').textContent = chapterName(STAGES[start].chapter);
  const chips = $('#wsChips'); chips.innerHTML = '';
  buildChips(chips, items);
  sheet.hidden = false;
  stageListEl.querySelectorAll('.tm-node').forEach((n, k) => n.classList.toggle('open', k === w));
}
function closeWorldSheet() { const s = $('#worldSheet'); if (s) s.hidden = true; stageListEl.querySelectorAll('.tm-node.open').forEach(n => n.classList.remove('open')); }
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
  $('#dailyQuickBest').textContent = t('quick_best', { n: (progress.quick && progress.quick.best) || 0 });
  renderWeekly();
}
// 워들처럼 이모지 결과 한 덩어리 — 공유 시트가 있으면 그것을, 없으면 클립보드로
async function shareDaily() {
  const dk = todayKey();
  const ds = progress.dailyStars && progress.dailyStars.d === dk ? progress.dailyStars.s : [0, 0, 0];
  const labels = [t('daily_easy'), t('daily_medium'), t('daily_hard')];
  const name = (window.BM_BRAND && window.BM_BRAND.name) || 'SwapStep';
  // 공유 링크: 공식 사이트에서는 지금 주소, 남의 사이트(itch.io iframe 등)에서는 공식 주소
  const own = window.AdsManager && window.AdsManager.isOwnSite;
  const url = (window.BM_BRAND && window.BM_BRAND.shareUrl) || (own ? location.origin + location.pathname : ((window.BM_BRAND && window.BM_BRAND.homeUrl) || 'https://sgtherong.github.io/game001/'));
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
  if (window.AdsManager && (window.AdsManager.isPortal || !window.AdsManager.isOwnSite)) return; // itch.io 등 남의 사이트에서도 등록 안 함
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
$('#btnPeek').addEventListener('click', usePeek);
$('#coachSkip').addEventListener('click', endCoach);
$('#btnNext').addEventListener('click', async e => {
  if (overlay.dataset.mode === 'challenge') { // 보낸 사람: 도전장 보내기 / 받은 사람: 새 판으로 되받아치기
    if (G.chResult && G.chResult.ch.role === 'send') shareChallenge();
    else { overlay.classList.remove('show'); createChallenge(); }
    return;
  }
  if (overlay.dataset.mode === 'daily') { overlay.classList.remove('show'); openDaily(); return; }
  if (G.adDue && window.AdsManager) {
    // 광고 요청~종료 동안 버튼을 막아 진행하지 못하게 한다(포털 규격)
    const btn = e.currentTarget; btn.disabled = true;
    G.adDue = false; G.clearsSinceAd = 0;
    logEvent('midgame_ad', { platform: AdsManager.platform });
    try { await AdsManager.showInterstitial(); } catch (err) {}
    btn.disabled = false;
  }
  if (overlay.dataset.mode === 'quick') nextQuick(); // 끝없는 모드: 다음 즉석 퍼즐(조금 더 어렵게)
  else loadStage(G.index + 1);
});
$('#btnReplay').addEventListener('click', () => {
  overlay.classList.remove('show');
  if (overlay.dataset.mode === 'challenge') leaveChallenge(); else restart();
});
// 친구와 겨루기
$('#btnGiveUp').addEventListener('click', giveUpChallenge);
$('#dailyChallenge').addEventListener('click', () => { closeDaily(); openChallenge(); });
$('#chMake').addEventListener('click', createChallenge);
$('#chAccept').addEventListener('click', () => acceptChallenge($('#chCode').value));
$('#chIncomingGo').addEventListener('click', () => acceptChallenge(G.chIncoming));
$('#chClose').addEventListener('click', closeChallenge);
$('#chBackdrop').addEventListener('click', closeChallenge);
$('#btnStages').addEventListener('click', openDrawer);
// daily challenge
$('#btnDaily').addEventListener('click', openDaily);
$('#dailyClose').addEventListener('click', closeDaily);
$('#dailyShare').addEventListener('click', shareDaily);
$('#dailyQuick').addEventListener('click', () => { closeDaily(); startQuick(); });
$('#dailyBackdrop').addEventListener('click', closeDaily);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#wsClose').addEventListener('click', closeWorldSheet);
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
// 안드로이드 앱(Capacitor): 뒤로 가기 = 열린 창부터 닫기(아무것도 없으면 앱을 내림), 앱이 백그라운드로 가면 소리 멈춤
if (window.AdsManager && window.AdsManager.isApp) {
  try {
    const AppP = window.Capacitor.Plugins.App;
    AppP.addListener('backButton', () => {
      const sheet = $('#worldSheet');
      if (drawer.classList.contains('open')) { if (sheet && !sheet.hidden) closeWorldSheet(); else closeDrawer(); return; }
      const m = [...document.querySelectorAll('.modal.show')].pop();
      if (m) { m.classList.remove('show'); return; }
      AppP.minimizeApp();
    });
    AppP.addListener('appStateChange', st => Sound.setHidden(!st.isActive));
  } catch (e) {}
}

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
  // 앱에서는 공식 사이트의 방침 페이지(외부 브라우저로 열림), 웹에서는 같은 폴더의 페이지
  const app = window.AdsManager && window.AdsManager.isApp;
  const base = app ? ((window.BM_BRAND && window.BM_BRAND.homeUrl) || 'https://sgtherong.github.io/game001/') + 'privacy.html' : 'privacy.html';
  document.querySelectorAll('a[href*="privacy.html"]').forEach(a => { a.setAttribute('href', base + (window.I18N.lang === 'ko' ? '#ko' : '')); });
}
function refreshDynamic() {
  updatePrivacyLinks();
  if ($('#langSelect')) $('#langSelect').value = window.I18N.lang;
  updateHud(); updateHintButton(); updatePeekButton(); applySoundIcon(); renderProgress(); renderStageLabels();
  if (G.hintPair) G.hintMsg = t('hint_applied', { a: SHAPE_CHAR[G.hintPair[0]], b: SHAPE_CHAR[G.hintPair[1]],
    left: isPremium() ? t('hint_left_unlimited') : t('hint_left_free', { n: hintsAvailable() }) });
  updatePreview();
  if (drawer.classList.contains('open')) renderStageList();
  if ($('#store').classList.contains('show')) renderStore('');
  if (albumOverlay.classList.contains('show')) renderAlbum();
  if (dailyOverlay.classList.contains('show')) renderDaily();
  if ($('#challenge').classList.contains('show')) renderChallenge($('#chMsg').textContent);
  if (G.chResult && overlay.dataset.mode === 'challenge' && overlay.classList.contains('show')) {
    const msg = $('#resultMsg').textContent; showChallengeResult(G.chResult.ch, G.chResult.me, G.chResult.seen); $('#resultMsg').textContent = msg;
  }
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
  else if (e.key === 'p' || e.key === 'P') usePeek();
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
  checkIncomingChallenge();             // 링크(#ch=코드)로 받은 도전장이 있으면 도전장 창
  // 첫 플레이 안내는 규칙 창 대신 1레벨 화면 안에서 손가락으로(startCoach, loadStage에서 호출)
  trySilentCloudRestore(); // 백그라운드: 이전에 연결한 계정이면 조용히 최신 진행도로 맞춘다
  booted = true;
  hideSplash();
}
boot().catch(e => { logEvent('js_error', { msg: String((e && e.message) || e).slice(0, 200), kind: 'boot' }); showCrash(); });

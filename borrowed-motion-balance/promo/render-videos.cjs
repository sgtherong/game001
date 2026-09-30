// CrazyGames 미리보기 영상 생성(가로 1920x1080, 세로 1080x1620, 무음 MP4).
// 규정: 15~20초, 표지로 시작, 빨리감기·검은 여백·기본 마우스 커서·홍보 문구 금지.
//
// 헤드리스 Chrome의 화면 녹화(screencast)는 CSS 픽셀 크기(960x540)로만 나와서 선명한 1080p를
// 얻으려면 매 프레임 스크린샷을 찍어야 하는데, 이건 실시간보다 느리다. 그래서 게임의 시간을
// RATE배로 늦춰(타이머·requestAnimationFrame·CSS 애니메이션 모두) 천천히 찍고, 찍힌 시각을
// 게임 시간으로 환산해 30fps로 다시 엮는다 — 결과 영상은 실제 게임 속도 그대로다.
//
// 사전 준비: node render-covers.cjs (영상 첫 장면에 표지를 쓴다)
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WEB = path.join(__dirname, '..', 'web');
const OUT = path.join(__dirname, 'out');
const PORT = 8130;
const RATE = 0.25;         // 게임 시간이 실제의 1/4 속도로 흐르게 해서 프레임을 촘촘히 찍는다
const FPS = 30;
const COVER_SEC = 1.0, FADE_SEC = 0.5;
const STAGE = 479;         // SS-0480: 월드 16, 4x4·조각 3·벽 1·최소 4수(조각이 제자리인 수가 가장 적은 판)
const WORLD_START = 450;   // 월드 16 첫 스테이지. 앞의 9문제를 깬 상태로 시작 → 이 판이 10번째 = 스티커 2장째(🐅)

const VIDEOS = [
  { name: 'preview-landscape-1920x1080.mp4', vw: 960, vh: 540, dsf: 2, W: 1920, H: 1080, cover: 'cover-landscape-1920x1080.png', bitrate: 10e6 },
  { name: 'preview-portrait-1080x1620.mp4', vw: 600, vh: 900, dsf: 1.8, W: 1080, H: 1620, cover: 'cover-portrait-1080x1620.png', bitrate: 9e6 },
];

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/json' };
function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    const base = p.startsWith('/promo/') ? __dirname : WEB;
    if (p.startsWith('/promo/')) p = p.slice('/promo'.length);
    if (p === '/') p = '/index.html';
    const fp = path.join(base, p);
    if (!fp.startsWith(base)) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);
}

// 페이지의 모든 시계를 RATE배로: setTimeout/setInterval 지연은 늘리고, now/rAF 시각은 줄인다
const timeScaleScript = rate => `(() => {
  const R = ${rate};
  const pn = performance.now.bind(performance), p0 = pn();
  const vnow = () => p0 + (pn() - p0) * R;
  performance.now = vnow;
  const dn = Date.now, d0 = dn();
  Date.now = () => Math.round(d0 + (dn() - d0) * R);
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) / R, ...a);
  window.setInterval = (fn, ms, ...a) => si(fn, (ms || 0) / R, ...a);
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(vnow()));
})();`;

function seedProgress(stages) {
  const completed = {}, best = {};
  for (let i = 0; i < WORLD_START + 9; i++) { completed[stages[i].id] = true; best[stages[i].id] = stages[i].min; }
  return { completed, best, solo: {}, last: STAGE, reached: STAGE, tutorialSeen: true, settings: { sound: false }, theme: 'default' };
}

// 페이지 안에서 도는 시연: 손가락이 조각 두 개 → 이동 버튼을 누르며 최단 해법대로 푼다(시간은 게임 시간 기준)
async function demoInPage() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.createElement('div');
  f.textContent = '👆';
  const FS = 46;
  Object.assign(f.style, {
    position: 'fixed', left: '0', top: '0', fontSize: FS + 'px', lineHeight: '1', zIndex: 100000, pointerEvents: 'none',
    transition: 'transform 380ms cubic-bezier(.3,.7,.3,1), opacity 300ms', opacity: '0',
    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.28))', willChange: 'transform',
  });
  document.body.appendChild(f);
  const TIP = { x: FS * 0.42, y: FS * 0.06 }; // 👆 글자 상자 안의 손끝 위치
  let cur = { x: innerWidth * 0.62, y: innerHeight * 0.92 };
  const place = (p, scale = 1) => { f.style.transform = `translate(${p.x - TIP.x}px, ${p.y - TIP.y}px) scale(${scale})`; };
  const ripple = p => {
    const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: p.x - 22 + 'px', top: p.y - 22 + 'px', width: '44px', height: '44px', borderRadius: '50%',
      border: '3px solid rgba(255,255,255,.95)', boxShadow: '0 0 0 2px rgba(217,139,74,.5)', zIndex: 99999, pointerEvents: 'none',
      transition: 'transform 420ms ease-out, opacity 420ms ease-out', transform: 'scale(.4)', opacity: '1' });
    document.body.appendChild(r);
    requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = 'scale(1.5)'; r.style.opacity = '0'; }));
    setTimeout(() => r.remove(), 600);
  };
  const center = el => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
  const tap = async el => {
    cur = center(el); place(cur); await sleep(400);
    place(cur, 0.86); ripple(cur); await sleep(110);
    el.click(); place(cur); await sleep(90);
  };
  place(cur); await sleep(520);
  f.style.opacity = '1';
  await sleep(200);
  for (let k = 0; k < 8; k++) {
    const pair = solveNext(G.state, G.stage.targets, G.stage.n, G.wallSet);
    if (!pair) break;
    await tap(pieceEls()[pair[0]]); await sleep(170);
    await tap(pieceEls()[pair[1]]); await sleep(560);          // 미리보기(점선 유령)가 보이는 시간
    await tap(document.querySelector('#btnCommit'));
    await sleep(100); while (G.animating) await sleep(30); await sleep(240);
  }
  f.style.opacity = '0';
  while (!document.querySelector('#stickerOverlay.show')) await sleep(40); // 승리 → 0.9초 뒤 스티커 팝업
  await sleep(1900);
}

const jpegSize = buf => { for (let i = 2; i < buf.length;) { const m = buf[i + 1], L = buf.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC2) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + L; } };

async function record(browser, v, stages) {
  const page = await browser.newPage();
  await page.setViewport({ width: v.vw, height: v.vh, deviceScaleFactor: v.dsf });
  const seed = seedProgress(stages);
  await page.evaluateOnNewDocument(`localStorage.clear(); localStorage.setItem('bm_lang_v1','en'); localStorage.setItem('bm_progress_v1', ${JSON.stringify(JSON.stringify(seed))});`);
  await page.evaluateOnNewDocument(timeScaleScript(RATE));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
  const cdp = await page.createCDPSession();
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: RATE }); // CSS 전환·애니메이션도 같은 배율로
  await page.evaluate(i => { loadStage(i); dispatchEvent(new Event('resize')); }, STAGE);
  await new Promise(r => setTimeout(r, 2500)); // 레이아웃·전환이 가라앉을 때까지(실제 시간)

  const dir = path.join(OUT, 'frames-' + path.basename(v.name, '.mp4'));
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  // 끝에 0을 둬서 evaluate가 시연 Promise를 기다리지 않고 바로 돌아오게 한다(그동안 캡처)
  await page.evaluate(`window.__demoDone = false; (${demoInPage.toString()})().then(() => { window.__demoDone = true; }, e => { window.__demoErr = String(e); window.__demoDone = true; }); 0`);
  const t0 = Date.now();
  for (;;) {
    const a = Date.now();
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    const b = Date.now();
    const file = String(frames.length).padStart(5, '0') + '.jpg';
    fs.writeFileSync(path.join(dir, file), buf);
    frames.push({ vt: ((a + b) / 2 - t0) * RATE, file });
    if (frames.length % 20 === 0 && await page.evaluate(() => window.__demoDone)) break;
  }
  const err = await page.evaluate(() => window.__demoErr || null);
  if (err) throw new Error('demo failed: ' + err);
  const size = jpegSize(fs.readFileSync(path.join(dir, frames[0].file)));
  await page.close();
  return { dir, frames, size, realSec: (Date.now() - t0) / 1000 };
}

async function encode(browser, v, rec) {
  const dur = rec.frames[rec.frames.length - 1].vt; // 게임 시간(ms)
  const count = Math.floor(dur / 1000 * FPS);
  const rel = path.relative(__dirname, rec.dir).replace(/\\/g, '/');
  const timeline = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const T = k * 1000 / FPS;
    while (j + 1 < rec.frames.length && rec.frames[j + 1].vt <= T) j++;
    timeline.push(`/promo/${rel}/${rec.frames[j].file}`);
  }
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/promo/encoder.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.encoderReady === true);
  const r = await page.evaluate(opts => window.encodeVideo(opts), {
    width: v.W, height: v.H, fps: FPS, bitrate: v.bitrate, coverUrl: `/promo/out/${v.cover}`,
    coverFrames: Math.round(COVER_SEC * FPS), fadeFrames: Math.round(FADE_SEC * FPS), frames: timeline,
  });
  await page.close();
  const outFile = path.join(OUT, v.name);
  fs.writeFileSync(outFile, Buffer.from(r.base64, 'base64'));
  return { outFile, seconds: r.seconds, mb: fs.statSync(outFile).size / 1048576, uniqueFrames: new Set(timeline).size, outFrames: timeline.length };
}

(async () => {
  for (const v of VIDEOS) if (!fs.existsSync(path.join(OUT, v.cover))) throw new Error(`missing ${v.cover} — run render-covers.cjs first`);
  global.window = {}; require(path.join(WEB, 'stages-data.js'));
  const stages = global.window.BM_DATA.stages;
  const server = serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--mute-audio'] });
  try {
    for (const v of VIDEOS) {
      const rec = await record(browser, v, stages);
      const gameSec = rec.frames[rec.frames.length - 1].vt / 1000;
      console.log(`${v.name}: captured ${rec.frames.length} frames at ${rec.size.join('x')} in ${rec.realSec.toFixed(1)}s real = ${gameSec.toFixed(2)}s game (${(rec.frames.length / gameSec).toFixed(0)} fps of game time)`);
      if (rec.size[0] !== v.W || rec.size[1] !== v.H) throw new Error(`frame size ${rec.size} != ${v.W}x${v.H}`);
      const e = await encode(browser, v, rec);
      console.log(`  -> ${path.basename(e.outFile)}: ${e.seconds.toFixed(2)}s, ${e.mb.toFixed(1)}MB, ${e.uniqueFrames}/${e.outFrames} gameplay frames unique`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

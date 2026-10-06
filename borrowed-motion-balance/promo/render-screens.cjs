// 스토어·포털 소개용 게임 화면 캡처(1280x720, 영어): node render-screens.cjs → out/screen-*.png
// 1) 새 칸 판에서 미리보기 켠 장면  2) 여행 지도  3) 클리어 후 여행지 그림  4) 빠른 한 판
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WEB = path.join(__dirname, '..', 'web');
const OUT = path.join(__dirname, 'out');
const PORT = 8131;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/json' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const fp = path.join(WEB, p === '/' ? 'index.html' : p);
  if (!fp.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(d); });
}).listen(PORT);

// 각 장면: 진행 상태를 만들고(page 안에서 실행) 잠시 기다린 뒤 캡처
const SCENES = [
  { name: 'screen-1-puzzle.png', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 540; i++) progress.completed[STAGES[i].id] = true; reconcileReached(); loadStage(540); await sleep(500);
    usePeek(); onPieceClick(0); await sleep(600);
  } },
  { name: 'screen-2-map.png', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 225; i++) progress.completed[STAGES[i].id] = true;
    for (let w = 0; w < 7; w++) progress.worldsDone[w] = true;
    reconcileReached(); loadStage(225); await sleep(400); openDrawer(); await sleep(600); closeWorldSheet(); await sleep(300);
  } },
  { name: 'screen-3-clear.png', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 300; i++) progress.completed[STAGES[i].id] = true; reconcileReached(); loadStage(300); await sleep(400);
    G.state = G.stage.targets.map((t, i) => [t[0], t[1], G.state[i][2]]); refreshPieces(); await sleep(400);
    confettiBurst(); playClearFx(); await sleep(1250);
  } },
  { name: 'screen-4-quick.png', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 60; i++) progress.completed[STAGES[i].id] = true; reconcileReached();
    progress.quick = { best: 12, played: 30 }; G.quickStreak = 7; nextQuick(); await sleep(700);
  } },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--mute-audio'] });
  try {
    for (const s of SCENES) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(() => { localStorage.clear(); localStorage.setItem('bm_lang_v1', 'en'); });
      await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => endCoach());
      await page.evaluate(`(${s.setup.toString()})()`);
      await page.screenshot({ path: path.join(OUT, s.name) });
      console.log(s.name, errors.length ? 'ERRORS ' + errors.join(' | ') : 'ok');
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });

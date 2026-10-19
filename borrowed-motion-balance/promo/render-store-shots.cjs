// Google Play 스토어 스크린샷(언어별, 문구 + 게임 화면): node render-store-shots.cjs [언어…]
//   → out/store/<언어>/1.png … 4.png (1080x1920). 언어를 안 주면 store-captions.json 의 모든 언어.
// 1) 새 칸 판 + 미리보기  2) 여행 지도  3) 여행 앨범  4) 빠른 한 판
// 게임 화면은 그 언어로 띄워 캡처하고, 위에 큰 문구를 얹은 틀 페이지를 다시 캡처한다.
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WEB = path.join(__dirname, '..', 'web');
const OUT = path.join(__dirname, 'out', 'store');
const PORT = 8132;
const CAPTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'store-captions.json'), 'utf8'));
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CAPTIONS);
const RTL = { ar: 1, he: 1 };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/json' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const fp = path.join(WEB, p === '/' ? 'index.html' : p);
  if (!fp.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(d); });
}).listen(PORT);

// 장면: 진행 상태를 만들고(게임 페이지 안에서 실행) 잠시 기다린다. 장면마다 틀의 강조색
const SCENES = [
  { accent: '#e8743b', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 540; i++) progress.completed[STAGES[i].id] = true; reconcileReached(); loadStage(540); await sleep(500);
    usePeek(); onPieceClick(0); await sleep(600);
  } },
  { accent: '#2f8f83', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 225; i++) progress.completed[STAGES[i].id] = true;
    for (let w = 0; w < 7; w++) progress.worldsDone[w] = true;
    reconcileReached(); loadStage(225); await sleep(400); openDrawer(); await sleep(600); closeWorldSheet();
    document.querySelector('.sound-toggle').style.display = 'none'; await sleep(300); // 설정 버튼 대신 지도가 화면을 채우게
  } },
  { accent: '#7b6cd9', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // 1월드는 모두 ★★★(골드), 2월드(파리)는 20판 → 스티커 4장
    for (let i = 0; i < 50; i++) { const s = STAGES[i]; progress.completed[s.id] = true; progress.best[s.id] = s.min; }
    reconcileReached(); loadStage(50); await sleep(400); openAlbum(1); await sleep(700);
  } },
  { accent: '#c0497b', setup: async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 60; i++) progress.completed[STAGES[i].id] = true; reconcileReached();
    progress.quick = { best: 12, played: 30 }; G.quickStreak = 7; nextQuick(); await sleep(700);
  } },
];

// 틀: 위에 큰 문구(두 줄까지, 넘치면 글자를 줄임), 아래에 둥근 카드 안의 게임 화면
const frameHtml = (lang, cap, img, accent) => `<!doctype html><html lang="${lang}" dir="${RTL[lang] ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 360px; height: 640px; overflow: hidden; }
  body { font-family: "Segoe UI", "Malgun Gothic", "Yu Gothic UI", "Microsoft YaHei UI", "Microsoft JhengHei UI", "Leelawadee UI", "Nirmala UI", system-ui, sans-serif;
    background: radial-gradient(70% 45% at 15% 8%, ${accent}33, transparent 70%), radial-gradient(60% 40% at 95% 95%, #2f8f8326, transparent 70%), linear-gradient(180deg, #fbefe2, #f3ead9);
    color: #3a3226; display: flex; flex-direction: column; align-items: center; }
  .cap { box-sizing: border-box; width: 100%; padding: 30px 26px 0; text-align: center; height: 150px; display: flex; flex-direction: column; justify-content: center; }
  h1 { margin: 0; font-weight: 900; font-size: 30px; line-height: 1.15; letter-spacing: -.01em; text-wrap: balance; }
  :lang(ko) h1, :lang(ko) p { word-break: keep-all; } /* 한국어는 낱말 중간에서 줄을 바꾸지 않게 */
  :lang(ja) h1, :lang(ja) p, :lang(zh) h1, :lang(zh) p, :lang(zh-TW) h1, :lang(zh-TW) p { word-break: auto-phrase; } /* 일본어·중국어는 구절 단위로 */
  p { text-wrap: balance; }
  p { margin: 8px 0 0; font-size: 15px; font-weight: 600; color: #7d715e; line-height: 1.3; }
  .card { margin-top: 10px; width: 266px; height: 473px; border-radius: 26px; overflow: hidden; background: #fff;
    box-shadow: 0 0 0 6px #fffaf0, 0 18px 40px rgba(90,70,40,.28); }
  .card img { display: block; width: 100%; height: 100%; }
</style></head><body>
  <div class="cap"><h1 id="h">${cap[0]}</h1><p id="p">${cap[1]}</p></div>
  <div class="card"><img src="${img}"></div>
  <script>
    // 문구가 칸(두 줄)을 넘으면 글자를 조금씩 줄인다
    const h = document.getElementById('h'), p = document.getElementById('p');
    let fs = 30; while (h.scrollHeight > 72 && fs > 20) { fs -= 1; h.style.fontSize = fs + 'px'; }
    let ps = 15; while (p.scrollHeight > 42 && ps > 11) { ps -= 1; p.style.fontSize = ps + 'px'; }
  </script>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--mute-audio'] });
  try {
    for (const lang of LANGS) {
      const cap = CAPTIONS[lang]; if (!cap) { console.log(lang, 'no captions'); continue; }
      const dir = path.join(OUT, lang); fs.mkdirSync(dir, { recursive: true });
      for (let k = 0; k < SCENES.length; k++) {
        const s = SCENES[k];
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(String(e)));
        await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3 });
        await page.evaluateOnNewDocument(l => { localStorage.clear(); localStorage.setItem('bm_lang_v1', l); }, lang);
        await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
        await page.evaluate(() => endCoach());
        await page.evaluate(`(${s.setup.toString()})()`);
        const shot = await page.screenshot({ encoding: 'base64' });
        await page.setContent(frameHtml(lang, cap[k], 'data:image/png;base64,' + shot, s.accent), { waitUntil: 'load' });
        await page.screenshot({ path: path.join(dir, (k + 1) + '.png') });
        if (errors.length) console.log(lang, k + 1, 'ERRORS', errors.join(' | '));
        await page.close();
      }
      console.log(lang, 'ok');
    }
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });

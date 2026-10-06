// CrazyGames 표지 이미지 생성: cover.html을 규격 크기로 캡처해 out/에 PNG로 저장.
// 1080x1620은 세로 미리보기 영상의 첫 장면(규정: 영상은 표지로 시작)용.
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, 'out');
const SIZES = [
  { name: 'cover-landscape-1920x1080.png', w: 1920, h: 1080, layout: 'landscape' },
  { name: 'cover-portrait-800x1200.png', w: 800, h: 1200, layout: 'portrait' },
  { name: 'cover-square-800x800.png', w: 800, h: 800, layout: 'square' },
  { name: 'cover-portrait-1080x1620.png', w: 1080, h: 1620, layout: 'portrait' },
  // GameDistribution 등록용 5종 + itch.io 표지
  { name: 'gd-1280x720.png', w: 1280, h: 720, layout: 'landscape' },
  { name: 'gd-1280x550.png', w: 1280, h: 550, layout: 'landscape' },
  { name: 'gd-512x512.png', w: 512, h: 512, layout: 'square' },
  { name: 'gd-512x384.png', w: 512, h: 384, layout: 'landscape' },
  { name: 'gd-512x340.png', w: 512, h: 340, layout: 'landscape' },
  { name: 'itch-cover-630x500.png', w: 630, h: 500, layout: 'landscape' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  const url = 'file:///' + path.join(__dirname, 'cover.html').replace(/\\/g, '/');
  for (const s of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
    await page.goto(`${url}?layout=${s.layout}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('body[data-ready="1"]');
    const m = await page.evaluate(() => {
      const t = document.querySelector('.title').getBoundingClientRect(), b = document.querySelector('.board').getBoundingClientRect();
      const pct = (v, total) => Math.round(v / total * 100);
      return { font: document.fonts.check('700 40px Fredoka'), titleTop: pct(t.top, innerHeight), titleLeft: pct(t.left, innerWidth),
        boardTop: pct(b.top, innerHeight), boardBottom: pct(b.bottom, innerHeight) };
    });
    // CrazyGames 크롭 화면에 표시되는 왼쪽 위 라벨 영역(가로%, 세로%) — 제목이 여기와 겹치면 안 된다
    const zone = { landscape: [40, 19], portrait: [40, 10], square: [35, 30] }[s.layout];
    const labelClear = m.titleTop >= zone[1] + 2 || m.titleLeft >= zone[0] + 2;
    await page.screenshot({ path: path.join(OUT, s.name), type: 'png' });
    console.log(`${s.name}  font:${m.font} title top ${m.titleTop}% left ${m.titleLeft}% (label zone ${zone[0]}x${zone[1]}%: ${labelClear ? 'clear' : 'OVERLAP'}), board ${m.boardTop}-${m.boardBottom}%`);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

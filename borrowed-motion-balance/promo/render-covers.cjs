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
    const font = await page.evaluate(() => document.fonts.check('700 40px Fredoka'));
    await page.screenshot({ path: path.join(OUT, s.name), type: 'png' });
    console.log(`${s.name}  (font loaded: ${font})`);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

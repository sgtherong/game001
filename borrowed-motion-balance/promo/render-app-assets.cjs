// 안드로이드 앱·Google Play용 그림: node render-app-assets.cjs
//  - out/app/play-icon-512.png        Play 스토어 아이콘(512x512, 불투명)
//  - out/app/feature-1024x500.png     Play 대표 이미지(cover.html 가로 배치)
//  - ../android-app/android/app/src/main/res/ 런처 아이콘(옛·둥근·적응형 전경) + 시작 화면 그림
// 그림 원본은 app-icon.html(해·달 조각 + 맞바꾸는 곡선 화살표)과 cover.html.
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, 'out', 'app');
const RES = path.join(__dirname, '..', 'android-app', 'android', 'app', 'src', 'main', 'res');
const ICON = 'file:///' + path.join(__dirname, 'app-icon.html').replace(/\\/g, '/');
const COVER = 'file:///' + path.join(__dirname, 'cover.html').replace(/\\/g, '/');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function shot(browser, url, w, h, file, { round = false, transparent = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  if (round) await page.addStyleTag({ content: 'html{border-radius:50%;overflow:hidden}' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: transparent || round });
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  try {
    await shot(browser, ICON + '?mode=full', 512, 512, path.join(OUT, 'play-icon-512.png'));
    await shot(browser, COVER + '?layout=landscape', 1024, 500, path.join(OUT, 'feature-1024x500.png'));
    for (const [d, k] of Object.entries(DENS)) {
      const L = Math.round(48 * k), F = Math.round(108 * k);
      await shot(browser, ICON + '?mode=full', L, L, path.join(RES, `mipmap-${d}`, 'ic_launcher.png'));
      await shot(browser, ICON + '?mode=full', L, L, path.join(RES, `mipmap-${d}`, 'ic_launcher_round.png'), { round: true });
      await shot(browser, ICON + '?mode=fg', F, F, path.join(RES, `mipmap-${d}`, 'ic_launcher_foreground.png'), { transparent: true });
    }
    // 옛 시작 화면 그림(splash.png)도 같은 크기로 교체: 베이지 바탕 가운데 아이콘(안드로이드 12+는 테마의 시작 화면 설정을 쓴다)
    for (const dir of fs.readdirSync(RES).filter(n => n.startsWith('drawable'))) {
      const f = path.join(RES, dir, 'splash.png');
      if (!fs.existsSync(f)) continue;
      const buf = fs.readFileSync(f), w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      const s = Math.round(Math.min(w, h) * 0.32);
      await page.setContent(`<body style="margin:0;background:#f3ead9;display:grid;place-items:center;width:${w}px;height:${h}px"><iframe src="${ICON}?mode=fg" style="border:0;width:${s * 1.6}px;height:${s * 1.6}px;background:transparent" allowtransparency="true"></iframe></body>`, { waitUntil: 'networkidle0' });
      await page.screenshot({ path: f });
      await page.close();
    }
    console.log('app assets ok');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

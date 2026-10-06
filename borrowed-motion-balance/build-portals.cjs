// Run: node build-portals.cjs [--gd=<GameDistribution 게임 ID>]
// web/ 폴더로 포털별 업로드 파일을 만든다 → 저장소 맨 위에 zip(최상위에 index.html):
//   swapstep-crazygames.zip       CrazyGames (광고 여부는 branding.js의 crazygamesAds)
//   swapstep-gamedistribution.zip GameDistribution (--gd 로 받은 게임 ID를 branding.js에 넣는다. 없으면 만들지 않음)
//   swapstep-itch.zip             itch.io (개인정보처리방침 포함)
// 공통: artifact.html·공유 미리보기 이미지는 빼고, index.html의 링크 공유용 메타(공식 사이트 주소)를 지운다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const REPO = path.join(ROOT, '..');
const DIST = path.join(ROOT, 'dist');
const BASE = ['branding.js', 'game.js', 'i18n.js', 'platform.js', 'stages-data.js', 'sw.js', 'index.html',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

const gdArg = process.argv.find(a => a.startsWith('--gd='));
const gdId = gdArg ? gdArg.slice(5).trim() : '';

function stripShareMeta(html) {
  const a = html.indexOf('<!-- 링크 공유 미리보기');
  const b = html.indexOf('<meta name="twitter:card"');
  if (a < 0 || b < 0) throw new Error('share meta block not found in index.html');
  return html.slice(0, a) + html.slice(html.indexOf('\n', b) + 1);
}

function build(name, extra, patchBranding) {
  const dir = path.join(DIST, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of BASE.concat(extra)) fs.copyFileSync(path.join(WEB, f), path.join(dir, f));
  const idx = path.join(dir, 'index.html');
  fs.writeFileSync(idx, stripShareMeta(fs.readFileSync(idx, 'utf8')));
  if (patchBranding) {
    const bp = path.join(dir, 'branding.js');
    fs.writeFileSync(bp, patchBranding(fs.readFileSync(bp, 'utf8')));
  }
  const zip = path.join(REPO, `swapstep-${name}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${dir}\\*' -DestinationPath '${zip}'`], { stdio: 'inherit' });
  console.log(`${path.basename(zip)}  ${(fs.statSync(zip).size / 1024).toFixed(0)}KB  (${fs.readdirSync(dir).length} files)`);
}

build('crazygames', []);
if (gdId) {
  if (!/^[0-9a-f]{32}$/i.test(gdId)) console.warn(`WARN: GameDistribution 게임 ID 형식이 예상(32자리 16진수)과 다릅니다: ${gdId}`);
  build('gamedistribution', [], b => {
    if (!/gdGameId: '[^']*'/.test(b)) throw new Error('gdGameId not found in branding.js');
    return b.replace(/gdGameId: '[^']*'/, `gdGameId: '${gdId}'`);
  });
} else {
  console.log('swapstep-gamedistribution.zip  (건너뜀: --gd=<게임 ID> 가 없음)');
}
build('itch', ['privacy.html']);

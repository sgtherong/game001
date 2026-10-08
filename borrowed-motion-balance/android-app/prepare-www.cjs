// ../web 의 게임 파일을 앱에 담을 www/ 로 복사한다(Capacitor가 이 폴더를 앱 안에 넣는다).
// 웹 전용 파일(Artifact용 페이지, 링크 공유 이미지, 오프라인 캐시용 서비스워커·manifest)은 뺀다 — 앱은 원래 오프라인으로 돈다.
const fs = require('fs');
const path = require('path');
const WEB = path.join(__dirname, '..', 'web');
const WWW = path.join(__dirname, 'www');
const FILES = ['index.html', 'branding.js', 'i18n.js', 'platform.js', 'stages-data.js', 'game.js', 'privacy.html', 'icon-192.png', 'icon-512.png'];
fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(WEB, f), path.join(WWW, f));
// 링크 공유용 메타(공식 사이트 주소)와 웹 앱 manifest 링크는 앱에 필요 없다
let html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const a = html.indexOf('<!-- 링크 공유 미리보기'), b = html.indexOf('<meta name="twitter:card"');
if (a < 0 || b < 0) throw new Error('share meta block not found');
html = html.slice(0, a) + html.slice(html.indexOf('\n', b) + 1);
html = html.replace(/<link rel="manifest"[^>]*>\r?\n?/, '');
fs.writeFileSync(path.join(WWW, 'index.html'), html);
console.log('www ready:', fs.readdirSync(WWW).join(', '));

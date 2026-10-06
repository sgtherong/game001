/* 스왑스텝 service worker — offline app shell */
const CACHE = 'swapstep-v59';
const ASSETS = [
  './',
  './index.html',
  './branding.js',
  './i18n.js',
  './platform.js',
  './game.js',
  './stages-data.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './privacy.html',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 인터넷 우선: 온라인이면 항상 최신 파일(새로 받은 파일로 캐시도 갱신), 오프라인일 때만 저장본.
// 예전엔 저장본 우선이라 배포 직후 첫 방문에 옛 버전이 떠서, 도전장 링크(#ch=)를 열어도 도전장 기능이 없는 옛 게임이 평소 레벨을 보여 줬다.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});

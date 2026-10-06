/* 스왑스텝 — 플랫폼/광고 추상화 레이어 (SDK Adapter)
 *
 * 게임 코드는 window.AdsManager 의 단일 인터페이스만 호출한다:
 *   AdsManager.init({ onRewardedSimulate })  // 시작 시 1회
 *   AdsManager.showRewarded() -> Promise<boolean>   // 보상형 광고 (true=보상 지급)
 *   AdsManager.showInterstitial() -> Promise<void>  // 전면(레벨 전환) — config로 gate
 *   AdsManager.gameplayStart() / gameplayStop() / happyTime()
 *   AdsManager.platform  // 현재 어댑터 이름
 *
 * 접속 도메인으로 플랫폼을 감지해 해당 SDK를 "동적으로" 로드한다.
 * 포털이 아닌 곳(자체 호스팅/Artifact)에서는 local(시뮬레이션) 어댑터로 동작한다.
 * 새 포털 추가 = 아래에 어댑터 하나 추가 + detect()에 도메인 규칙 추가. 게임 코드는 불변.
 */
(function () {
  'use strict';

  const config = {
    interstitialEnabled: false, // 기획서상 첫 출시엔 전면광고 미사용. 포털 배포 시 켠다.
  };

  // 광고 표시 중 오디오/게임 훅. 게임이 init()에서 onAdStarted/onAdEnded를 넘긴다.
  // 포털 규격: 광고가 "실제로 표시될 때"만 음소거하고, 종료(성공/실패) 시 복구한다.
  // muteChange(muted): 포털 사이트의 음소거 설정(CrazyGames settings.muteAudio) — 게임 설정보다 우선
  const hooks = { adStarted() {}, adEnded() {}, muteChange() {} };

  /* ---------- 진행도 저장소 (Store) ----------
   * 포털 iframe에서는 브라우저가 서드파티 localStorage를 파티셔닝/차단할 수 있어
   * 진행도가 유지되지 않을 수 있다. CrazyGames는 SDK data 모듈(도메인/앱 간 영속)을
   * 권장하므로 포털에선 그것을, 그 외(자체호스팅/Artifact)에선 localStorage를 쓴다.
   * 게임 코드는 window.Store 만 호출한다. get/set/remove 는 동기.
   * backend 는 AdsManager.init()이 SDK 로드 후 initFor()로 확정한다. */
  const Store = {
    backend: 'local', // 'local' | 'sdk'
    _sdk: null,
    initFor(name) {
      try {
        const d = window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data;
        if (name === 'crazygames' && d && typeof d.getItem === 'function') {
          this._sdk = d; this.backend = 'sdk'; return;
        }
      } catch (e) {}
      this.backend = 'local';
    },
    get(key) {
      try { return this.backend === 'sdk' ? this._sdk.getItem(key) : localStorage.getItem(key); }
      catch (e) { try { return localStorage.getItem(key); } catch (_) { return null; } }
    },
    set(key, val) {
      try { if (this.backend === 'sdk') this._sdk.setItem(key, val); else localStorage.setItem(key, val); }
      catch (e) { try { localStorage.setItem(key, val); } catch (_) {} }
    },
    remove(key) {
      try { if (this.backend === 'sdk') this._sdk.removeItem(key); else localStorage.removeItem(key); }
      catch (e) {}
    },
  };
  window.Store = Store;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('SDK load failed: ' + src));
      document.head.appendChild(s);
    });
  }

  /* ---------- 클라우드 저장 (Google 로그인, Firebase) ----------
   * 자체호스팅/Artifact 전용 — 포털 iframe에서는 팝업 로그인이 막히는 경우가 많아
   * game.js가 onPortal()로 UI 자체를 숨긴다. Firebase Auth(Google)로 로그인하고
   * Firestore progress/{uid} 문서에 진행도 JSON을 저장/복원한다.
   * apiKey 등은 Firebase 웹 설정값으로, 공개 저장소에 커밋해도 되는 값이다
   * (보안은 Firestore 규칙 + Auth 승인된 도메인으로 건다). */
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBhVB-3P9w8m8g-UsAFLlaOaQzm8PkPNSA',
    authDomain: 'swapstep-e0af4.firebaseapp.com',
    projectId: 'swapstep-e0af4',
    storageBucket: 'swapstep-e0af4.firebasestorage.app',
    messagingSenderId: '393234633662',
    appId: '1:393234633662:web:bbd0bdce761ea85b891fef',
  };
  const FB_VER = '10.14.1';
  let fbReady = null; // Promise, SDK 로드+init 1회만
  function ensureFirebase() {
    if (!fbReady) {
      fbReady = (async () => {
        await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
        await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`);
        await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore-compat.js`);
        if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
      })();
    }
    return fbReady;
  }

  const CloudSync = {
    get enabled() { return !!(window.AdsManager && window.AdsManager.isOwnSite && !window.AdsManager.isPortal); },
    _user: null,
    get user() { return this._user; },
    async signIn() {
      await ensureFirebase();
      const provider = new window.firebase.auth.GoogleAuthProvider();
      const cred = await window.firebase.auth().signInWithPopup(provider);
      this._user = cred.user;
      return this._user;
    },
    async signOut() {
      try { await ensureFirebase(); await window.firebase.auth().signOut(); } catch (e) {}
      this._user = null;
    },
    // 같은 기기/브라우저에서 이전에 로그인한 적 있으면 자동 복원(세션 유지); 없으면 null.
    restoreSession(timeoutMs) {
      return ensureFirebase().then(() => new Promise(resolve => {
        let done = false;
        const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs || 4000);
        const unsub = window.firebase.auth().onAuthStateChanged(u => {
          if (done) return;
          done = true; clearTimeout(timer); unsub();
          this._user = u; resolve(u);
        });
      })).catch(() => null);
    },
    async pull(uid) {
      await ensureFirebase();
      const snap = await window.firebase.firestore().collection('progress').doc(uid).get();
      if (!snap.exists) return null;
      try { return JSON.parse(snap.data().json); } catch (e) { return null; }
    },
    async push(uid, progressObj) {
      await ensureFirebase();
      await window.firebase.firestore().collection('progress').doc(uid)
        .set({ json: JSON.stringify(progressObj), updatedAt: Date.now() });
    },
    // 이용자 요청 시 계정에 저장된 진행 기록 삭제(개인정보 삭제 요청 대응)
    async remove(uid) {
      await ensureFirebase();
      clearTimeout(this._pushTimer);
      await window.firebase.firestore().collection('progress').doc(uid).delete();
    },
    _pushTimer: null,
    pushDebounced(uid, progressObj) {
      clearTimeout(this._pushTimer);
      this._pushTimer = setTimeout(() => { this.push(uid, progressObj).catch(() => {}); }, 1500);
    },
  };
  window.CloudSync = CloudSync;

  /* ---------- sitelock (도난 방지) ----------
   * 번들을 복사해 무단 도메인에 재호스팅하는 걸 막는다. 게임이 실제 서빙되는
   * location.hostname 만 검사하므로 크로스오리진에 안전하다(포털/GD 파트너 사이트는
   * 각 플랫폼 자체 도메인에서 서빙되므로 그대로 허용). 정식 배포처·미리보기·개발환경은
   * 모두 허용하고, 불확실하면(에러/빈 host) 허용(fail-open)해 정상 유저를 절대 막지 않는다.
   * 라이선시/추가 도메인은 branding.js의 BM_BRAND.allowedHosts 로 확장한다.
   * (참고: 클라이언트 사이트락은 우회 가능한 "약한 억제책"이다.) */
  function hostAllowed() {
    const ALLOW = [
      'crazygames', '1001juegos',                        // CrazyGames
      'poki', 'poki-gdn',                                // Poki
      'gamedistribution', 'gamemonetize',                // GameDistribution / GameMonetize
      'sgtherong.github.io',                             // 소유자 gh-pages
      'itch.io', 'itch.zone',                            // itch.io(게임 파일은 itch.zone에서 서빙)
      'claude.ai', 'claudeusercontent.com', 'anthropic', // Claude Artifact 미리보기
    ];
    const extra = (window.BM_BRAND && Array.isArray(window.BM_BRAND.allowedHosts))
      ? window.BM_BRAND.allowedHosts.map(String) : [];
    const list = ALLOW.concat(extra).map(s => String(s).toLowerCase());
    const match = v => { v = (v || '').toLowerCase(); return !!v && list.some(k => v.includes(k)); };
    // 1) 서빙 호스트(게임 파일이 올라간 도메인)
    let h;
    try { h = (location.hostname || '').toLowerCase(); } catch (e) { return true; }
    if (!h) return true; // file:// / 샌드박스 → 개발·미리보기
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local')) return true;
    if (list.some(k => h === k || h.endsWith('.' + k) || h.includes(k))) return true;
    // 2) 정식 임베더(포털 iframe / Claude Artifact)면 허용 — 허용만 넓히므로 안전
    try { if (match(document.referrer)) return true; } catch (e) {}
    try {
      const ao = location.ancestorOrigins;
      if (ao) for (let i = 0; i < ao.length; i++) if (match(ao[i])) return true;
    } catch (e) {}
    return false;
  }
  window.BM_hostAllowed = hostAllowed;

  /* ---------- adapters ---------- */

  // 자체 호스팅/개발/Artifact: 게임이 넘겨준 시뮬레이션 광고 UI를 사용
  const local = {
    name: 'local',
    async init(opts) { this._sim = opts && opts.onRewardedSimulate; },
    gameplayStart() {}, gameplayStop() {}, happyTime() {},
    showRewarded() {
      if (!this._sim) return Promise.resolve(true);
      hooks.adStarted();
      return Promise.resolve(this._sim())
        .then(r => { hooks.adEnded(); return r; }, () => { hooks.adEnded(); return false; });
    },
    showInterstitial() { return Promise.resolve(); },
  };

  // Poki
  const poki = {
    name: 'poki',
    async init() {
      await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
      await window.PokiSDK.init();
      if (window.PokiSDK.gameLoadingFinished) window.PokiSDK.gameLoadingFinished();
    },
    gameplayStart() { try { window.PokiSDK.gameplayStart(); } catch (e) {} },
    gameplayStop() { try { window.PokiSDK.gameplayStop(); } catch (e) {} },
    happyTime(v) { try { window.PokiSDK.happyTime(v == null ? 1 : v); } catch (e) {} },
    showRewarded() {
      hooks.adStarted();
      return window.PokiSDK.rewardedBreak()
        .then(x => { hooks.adEnded(); return !!x; }).catch(() => { hooks.adEnded(); return false; });
    },
    showInterstitial() {
      // commercialBreak(beforeAd): beforeAd가 실제 표시 직전에 호출됨 → 그때 음소거
      return window.PokiSDK.commercialBreak(() => hooks.adStarted())
        .then(() => hooks.adEnded()).catch(() => hooks.adEnded());
    },
  };

  // CrazyGames (SDK v3)
  const crazygames = {
    name: 'crazygames',
    async init() {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      const SDK = window.CrazyGames.SDK;
      await SDK.init();
      try { SDK.game.loadingStart(); } catch (e) {} // 끝은 게임이 첫 화면을 그린 뒤 AdsManager.loadingStop()
      // 사이트 음소거 설정(정식 출시 필수): 시작 값 반영 + 바뀔 때마다 반영
      try {
        hooks.muteChange(!!(SDK.game.settings && SDK.game.settings.muteAudio));
        SDK.game.addSettingsChangeListener(s => {
          const cur = s && s.muteAudio != null ? s.muteAudio : SDK.game.settings && SDK.game.settings.muteAudio;
          hooks.muteChange(!!cur);
        });
      } catch (e) {}
    },
    loadingStop() { try { window.CrazyGames.SDK.game.loadingStop(); } catch (e) {} },
    gameplayStart() { try { window.CrazyGames.SDK.game.gameplayStart(); } catch (e) {} },
    gameplayStop() { try { window.CrazyGames.SDK.game.gameplayStop(); } catch (e) {} },
    happyTime() { try { window.CrazyGames.SDK.game.happytime(); } catch (e) {} },
    // 사용자 언어(예: "en-US") — 문서 권장: 브라우저 언어보다 이 값으로 게임 언어를 정한다
    locale() { try { return window.CrazyGames.SDK.user.systemInfo.locale || ''; } catch (e) { return ''; } },
    showRewarded() {
      return new Promise((res, rej) => {
        try {
          window.CrazyGames.SDK.ad.requestAd('rewarded', {
            adStarted: () => hooks.adStarted(),                 // 실제 표시 시 음소거
            adFinished: () => { hooks.adEnded(); res(true); },  // 완주 → 보상 지급
            // 미충전/광고차단 등 → 게임이 "광고를 불러오지 못했어요"를 띄우도록 reject
            adError: e => { hooks.adEnded(); rej(e || new Error('ad error')); },
          });
        } catch (e) { hooks.adEnded(); rej(e); }
      });
    },
    showInterstitial() {
      return new Promise(res => {
        try {
          window.CrazyGames.SDK.ad.requestAd('midgame', {
            adStarted: () => hooks.adStarted(),
            adFinished: () => { hooks.adEnded(); res(); },
            adError: () => { hooks.adEnded(); res(); },
          });
        } catch (e) { hooks.adEnded(); res(); }
      });
    },
  };

  // GameDistribution (공식 HTML5 SDK — github.com/GameDistribution/GD-HTML5/wiki)
  // 게임 ID는 GD 개발자 사이트에서 게임을 등록하면 받는다 → branding.js의 gdGameId(포털 빌드 때 채움).
  // SDK_GAME_PAUSE = 광고 시작(음소거), SDK_GAME_START = 광고 끝(복구). 보상형은 SDK_REWARDED_WATCH_COMPLETE로 확인.
  // 규칙: 광고는 사용자가 버튼을 눌렀을 때만(우리는 '다음 문제'·'광고 보기' 버튼에서만 요청한다).
  const gamedistribution = {
    name: 'gamedistribution',
    _rewardDone: false,
    async init() {
      const id = (window.GD_OPTIONS && window.GD_OPTIONS.gameId) || (window.BM_BRAND && window.BM_BRAND.gdGameId);
      if (!id) throw new Error('GameDistribution gameId not set (branding.js gdGameId)');
      window.GD_OPTIONS = {
        gameId: id,
        onEvent: ev => {
          switch (ev && ev.name) {
            case 'SDK_GAME_PAUSE': hooks.adStarted(); break;
            case 'SDK_GAME_START': hooks.adEnded(); break;
            case 'SDK_REWARDED_WATCH_COMPLETE': gamedistribution._rewardDone = true; break;
          }
        },
      };
      await loadScript('https://html5.api.gamedistribution.com/main.min.js');
      for (let i = 0; i < 40 && !window.gdsdk; i++) await new Promise(r => setTimeout(r, 100)); // SDK 객체가 생길 때까지(최대 4초)
      if (!window.gdsdk) throw new Error('gdsdk not available');
      this.preloadRewarded();
    },
    preloadRewarded() { try { window.gdsdk.preloadAd('rewarded').catch(() => {}); } catch (e) {} },
    gameplayStart() {}, gameplayStop() {}, happyTime() {},
    // 끝까지 봤을 때만 true. 광고가 없거나 오류면 reject → 게임이 "광고를 불러오지 못했어요"
    showRewarded() {
      this._rewardDone = false;
      return Promise.resolve(window.gdsdk.showAd('rewarded'))
        .then(() => { const ok = this._rewardDone; this._rewardDone = false; this.preloadRewarded(); return ok; },
          e => { this.preloadRewarded(); throw e || new Error('rewarded ad error'); });
    },
    showInterstitial() {
      try { return Promise.resolve(window.gdsdk.showAd()).catch(() => {}); } catch (e) { return Promise.resolve(); }
    },
  };

  // 포털인데 SDK를 못 불러왔을 때(광고 차단 등): 연습용 가짜 광고 화면(local) 대신
  // 광고 요청을 실패로 돌려 게임이 "광고를 불러오지 못했어요"를 보여주게 한다.
  const unavailable = {
    name: 'unavailable',
    async init() {},
    gameplayStart() {}, gameplayStop() {}, happyTime() {},
    showRewarded() { return Promise.reject(new Error('ads unavailable')); },
    showInterstitial() { return Promise.resolve(); },
  };

  function detect() {
    const h = location.hostname;
    if (/(^|\.)poki\.com$/.test(h) || /poki/.test(h)) return poki;
    if (/crazygames|1001juegos/.test(h)) return crazygames;
    if (/gamedistribution/.test(h)) return gamedistribution; // (GameMonetize는 SDK가 달라 아직 미지원)
    return local; // self-host / gh-pages / artifact / dev
  }

  let adapter = local;
  let adapterReady = false, gameLoaded = false, loadingStopSent = false;
  const crazygamesAdsAllowed = () => !!(window.BM_BRAND && window.BM_BRAND.crazygamesAds);
  // 로드 시점에 포털 여부를 확정(동기). SW/PWA 게이팅 등에서 init() 완료 전에 참조 가능.
  const IS_PORTAL = detect() !== local;
  // 개발 환경(내 PC·파일로 열기)에서만 연습용 광고 화면·테스트 결제를 보여준다.
  // 공개 사이트(gh-pages·Artifact)에선 진짜 광고·결제가 붙기 전까지 둘 다 숨긴다 —
  // 실제 가격을 보여주며 돈을 받지 않는 화면은 이용자를 오해하게 만든다.
  const IS_DEV = (() => {
    try { const h = location.hostname || ''; return !h || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local'); }
    catch (e) { return false; }
  })();
  // 우리 공식 사이트(또는 개발 환경)인지. 구글 로그인(Firebase 승인 도메인)·오프라인 캐시·공유 링크는 여기서만 쓴다.
  // itch.io처럼 남의 사이트 iframe 안에서는 로그인 팝업이 막히고 캐시가 꼬일 수 있어 끈다.
  const IS_OWN = IS_DEV || (() => {
    try {
      const h = (location.hostname || '').toLowerCase();
      const own = ['sgtherong.github.io'].concat((window.BM_BRAND && window.BM_BRAND.ownHosts) || []);
      return own.some(k => h === k || h.endsWith('.' + k));
    } catch (e) { return false; }
  })();

  const AdsManager = {
    config,
    isPortal: IS_PORTAL, // true면 포털 iframe(자체호스팅 전용 기능은 끈다)
    isOwnSite: IS_OWN,   // true면 우리 공식 사이트·개발 환경(로그인·오프라인 캐시 사용)
    get platform() { return adapter.name; },
    // 포털이 알려주는 사용자 언어(없으면 빈 문자열 → 브라우저 언어 유지)
    get locale() { try { return adapter.locale ? adapter.locale() : ''; } catch (e) { return ''; } },
    // false면 게임이 광고 제안(보상형) 버튼 자체를 숨긴다: SDK를 못 불러왔거나, CrazyGames Basic 단계
    get adsEnabled() {
      if (adapter === unavailable) return false;
      if (adapter.name === 'crazygames') return crazygamesAdsAllowed();
      if (adapter === local) return IS_DEV; // 광고 네트워크가 없는 공개 사이트엔 광고 제안 안 함
      return true;
    },
    // 유료 결제(프리미엄) 화면을 보여도 되는지: 네이티브 앱 결제(window.BM_IAP)가 붙었거나 개발 환경일 때만
    get paymentsEnabled() { return !IS_PORTAL && (!!window.BM_IAP || IS_DEV); },
    async init(opts) {
      // 광고 표시 중 오디오 훅 등록(게임이 mute/unmute 제공)
      if (opts) {
        if (typeof opts.onAdStarted === 'function') hooks.adStarted = opts.onAdStarted;
        if (typeof opts.onAdEnded === 'function') hooks.adEnded = opts.onAdEnded;
        if (typeof opts.onMuteChange === 'function') hooks.muteChange = opts.onMuteChange;
      }
      adapter = detect();
      // CrazyGames expects midgame (interstitial) ads at natural breaks — enable them there (Full 단계만).
      if (adapter.name === 'crazygames') config.interstitialEnabled = crazygamesAdsAllowed();
      if (adapter.name === 'gamedistribution') config.interstitialEnabled = true; // GD는 레벨 전환 광고가 기본 수익원
      try { await adapter.init(opts); }
      catch (e) {
        const fb = IS_PORTAL ? unavailable : local;
        console.warn('[AdsManager] "' + adapter.name + '" init failed, falling back to ' + fb.name + ':', e);
        adapter = fb; await fb.init(opts);
      }
      Store.initFor(adapter.name); // SDK 로드 후 저장소 백엔드 확정
      adapterReady = true;
      // 게임이 6초 타임아웃으로 먼저 떠서 loadingStop을 이미 요청했다면, init 안의 loadingStart와 짝을 맞춘다
      if (gameLoaded) this.loadingStop();
      return adapter.name;
    },
    // 게임이 첫 화면을 다 그렸을 때 1회 (CrazyGames loadingStop; 다른 곳은 할 일 없음)
    loadingStop() {
      gameLoaded = true;
      if (!adapterReady || loadingStopSent) return;
      loadingStopSent = true;
      try { if (adapter.loadingStop) adapter.loadingStop(); } catch (e) {}
    },
    gameplayStart() { try { adapter.gameplayStart(); } catch (e) {} },
    gameplayStop() { try { adapter.gameplayStop(); } catch (e) {} },
    happyTime(v) { try { adapter.happyTime(v); } catch (e) {} },
    showRewarded() { try { return Promise.resolve(adapter.showRewarded()); } catch (e) { return Promise.resolve(false); } },
    showInterstitial() {
      if (!config.interstitialEnabled) return Promise.resolve();
      try { return Promise.resolve(adapter.showInterstitial()); } catch (e) { return Promise.resolve(); }
    },
  };

  window.AdsManager = AdsManager;
})();

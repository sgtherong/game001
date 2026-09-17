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

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('SDK load failed: ' + src));
      document.head.appendChild(s);
    });
  }

  /* ---------- adapters ---------- */

  // 자체 호스팅/개발/Artifact: 게임이 넘겨준 시뮬레이션 광고 UI를 사용
  const local = {
    name: 'local',
    async init(opts) { this._sim = opts && opts.onRewardedSimulate; },
    gameplayStart() {}, gameplayStop() {}, happyTime() {},
    showRewarded() { return this._sim ? this._sim() : Promise.resolve(true); },
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
    showRewarded() { return window.PokiSDK.rewardedBreak().then(x => !!x).catch(() => false); },
    showInterstitial() { return window.PokiSDK.commercialBreak().catch(() => {}); },
  };

  // CrazyGames (SDK v3)
  const crazygames = {
    name: 'crazygames',
    async init() {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      await window.CrazyGames.SDK.init();
    },
    gameplayStart() { try { window.CrazyGames.SDK.game.gameplayStart(); } catch (e) {} },
    gameplayStop() { try { window.CrazyGames.SDK.game.gameplayStop(); } catch (e) {} },
    happyTime() { try { window.CrazyGames.SDK.game.happytime(); } catch (e) {} },
    showRewarded() {
      return new Promise(res => {
        try { window.CrazyGames.SDK.ad.requestAd('rewarded', { adFinished: () => res(true), adError: () => res(false) }); }
        catch (e) { res(false); }
      });
    },
    showInterstitial() {
      return new Promise(res => {
        try { window.CrazyGames.SDK.ad.requestAd('midgame', { adFinished: () => res(), adError: () => res() }); }
        catch (e) { res(); }
      });
    },
  };

  // GameDistribution / GameMonetize (portal build must define window.GD_OPTIONS.gameId)
  const gamedistribution = {
    name: 'gamedistribution',
    async init() {
      if (!window.GD_OPTIONS) throw new Error('GD_OPTIONS(gameId) not set by portal build');
      await loadScript('https://html5.api.gamedistribution.com/main.min.js');
    },
    gameplayStart() {}, gameplayStop() {}, happyTime() {},
    showRewarded() {
      return new Promise(res => {
        try { window.gdsdk.showAd('rewarded').then(() => res(true)).catch(() => res(false)); }
        catch (e) { res(false); }
      });
    },
    showInterstitial() {
      return new Promise(res => {
        try { window.gdsdk.showAd().then(() => res()).catch(() => res()); }
        catch (e) { res(); }
      });
    },
  };

  function detect() {
    const h = location.hostname;
    if (/(^|\.)poki\.com$/.test(h) || /poki/.test(h)) return poki;
    if (/crazygames|1001juegos/.test(h)) return crazygames;
    if (/gamedistribution|gamemonetize/.test(h)) return gamedistribution;
    return local; // self-host / gh-pages / artifact / dev
  }

  let adapter = local;

  const AdsManager = {
    config,
    get platform() { return adapter.name; },
    async init(opts) {
      adapter = detect();
      // CrazyGames expects midgame (interstitial) ads at natural breaks — enable them there.
      if (adapter.name === 'crazygames') config.interstitialEnabled = true;
      try { await adapter.init(opts); }
      catch (e) {
        console.warn('[AdsManager] "' + adapter.name + '" init failed, falling back to local:', e);
        adapter = local; await local.init(opts);
      }
      return adapter.name;
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

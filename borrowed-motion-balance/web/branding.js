/* 스왑스텝 — 브랜딩 설정 (리브랜딩용)
 *
 * 비독점 라이선스 구매자는 게임 코드를 건드리지 않고 이 파일만 바꿔서
 * 사이트 브랜딩(이름·부제·강조색)을 교체할 수 있습니다.
 *   name    : 헤더에 크게 표시되는 브랜드명 (문서 제목에도 사용)
 *   tagline : 헤더 브랜드명 아래 작게 표시되는 부제 (빈 문자열이면 숨김)
 *   accent  : 기본 강조색(버튼·강조). 기본값과 다르면 게임 전체 색조가 바뀜.
 * 앱 아이콘(icon-*.png)과 PWA manifest 는 별도 파일이므로 함께 교체하세요.
 */
window.BM_BRAND = {
  name: 'SwapStep',
  tagline: '',
  accent: '#d98b4a',
  // 사이트락 확장: 자신의 배포 도메인을 추가하면 그 도메인에서도 실행됩니다.
  //   예) allowedHosts: ['mygame.com', 'itch.io']
  allowedHosts: [],
  // 사이트락 차단 화면의 "공식 사이트에서 플레이" 링크 (기본: CrazyGames).
  // CrazyGames 게임 URL이 정해지면 여기에 넣으세요. 예) 'https://www.crazygames.com/game/swapstep'
  officialUrl: 'https://www.crazygames.com',
  // CrazyGames 광고 사용 여부. Basic 단계는 광고 금지(QA 도구: "Ads are not allowed in basic launch")라
  // false면 광고 보기 버튼·중간 광고를 모두 숨긴다. Full 단계로 초대받으면 true로 바꿔 다시 업로드하세요.
  crazygamesAds: false,
  // GameDistribution 게임 ID(GD 개발자 사이트에서 게임을 등록하면 받음). GD 업로드용 빌드에서만 채운다.
  gdGameId: '',
  // 공식 사이트 주소(남의 사이트 안에서 '결과 공유'할 때 붙는 링크). 공식 사이트 도메인을 늘리려면 ownHosts에 추가.
  homeUrl: 'https://sgtherong.github.io/game001/',
  ownHosts: [],
  // 플레이 통계(GameAnalytics, gameanalytics.com 무료). 게임을 등록하면 받는 Game Key / Secret Key를 넣으면 켜진다.
  // 비어 있으면 통계를 전혀 보내지 않는다. 포털 빌드에서는 넣어도 꺼진다. 켤 때 개인정보처리방침·Play 데이터 보안 설문도 함께 고칠 것.
  gaGameKey: '',
  gaSecretKey: '',
  // 안드로이드 앱 광고(AdMob). AdMob에 앱을 등록하고 광고 단위 2개(보상형·전면)를 만들면 받는 ID를 넣는다.
  //   test: true 면 Google 공식 테스트 광고(돈이 안 됨, 시험용). 셋 다 비어 있고 test:false 면 앱에 광고 없음.
  //   앱 ID는 여기 말고 android-app/android/app/src/main/res/values/strings.xml 의 admob_app_id 에 넣는다.
  admob: { rewardedId: '', interstitialId: '', test: false },
  // 안드로이드 앱 결제: Play 콘솔 › 수익 창출 › 인앱 상품에서 만든 상품 ID(예: 'premium'). 비어 있으면 앱에 결제 없음.
  iapPremiumId: '',
  // 통계에 붙는 게임 버전(앱 versionName과 맞춘다)
  version: '1.2.0',
};

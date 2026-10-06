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
};

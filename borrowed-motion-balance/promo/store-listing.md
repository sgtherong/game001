# SwapStep — 포털·스토어 등록 자료

업로드 파일은 `node build-portals.cjs [--gd=<게임 ID>]`로 만든다(저장소 맨 위에 zip 생성).
이미지는 `promo/out/`: `node render-covers.cjs`(표지), `node render-screens.cjs`(게임 화면), `node render-videos.cjs`(영상).

## 공통 문구 (영어)

**Short description (1줄)**
Swap two arrows, step once — a calm, clever puzzle with 3000 levels.

**Description**
SwapStep is a calm, clever puzzle game about trading directions. Tap two pieces and they swap their arrows, then both take one step in their new direction. Get every piece onto the target with the same color and shape to clear the level.

It sounds simple, but every swap moves two pieces at once. Plan your order, use walls to stop pieces where you need them, and find the shortest solution for three stars.

- 100 destinations and 3000 handmade-feeling levels on a travel map, from cozy 3x3 boards to tricky 4x4 puzzles
- New twists along the way: walls, arrow tiles and spin tiles
- Quick play: endless generated puzzles that get harder as your streak grows
- Daily Challenge with three fresh puzzles every day and weekly rewards
- Collect travel stickers for your album
- Challenge a friend: send the same new puzzle and see who solves it in fewer moves
- Free undo and restart, hints and a peek booster when you're stuck
- Plays in 31 languages, including English, Korean, Japanese, Chinese, Spanish, Portuguese, French, German, Arabic and Hindi

**Controls**
Tap a piece, then tap another: the two pieces swap their arrows and each steps one cell.
Keyboard: 1-4 select pieces (sun, moon, star, heart), P peek, H hint, R restart, Ctrl+Z undo.

**Tags / category**: Puzzle · Logic · Brain · Relaxing · Casual · 2D · Mobile

---

## GameDistribution (developer.gamedistribution.com)

1. 회원가입 → **Add game** → 게임 정보 입력 → 저장하면 **Game ID**(32자리)가 나온다.
2. 게임 설정에서 **Rewarded ads 사용 체크**(안 하면 보상형 광고 요청이 막힘 — GD 문서 경고).
3. Game ID를 넣어 빌드: `node build-portals.cjs --gd=<Game ID>` → `swapstep-gamedistribution.zip` 업로드.
4. 이미지: `gd-1280x720.png`, `gd-1280x550.png`, `gd-512x512.png`, `gd-512x384.png`, `gd-512x340.png`
5. 정보: Category Puzzle, Mobile ready 예(가로·세로 모두), 위 Description·Controls.
6. 광고 동작(빌드에 들어 있음): 레벨 전환('Next' 버튼) 광고는 처음 10판 이후 3판마다(GD SDK가 빈도도 따로 제한),
   보상형은 힌트·이동 추가 버튼에서만. 광고 중 음소거(SDK_GAME_PAUSE/START). 결제·구글 로그인은 숨김.

## itch.io (itch.io/game/new)

1. Kind of project: **HTML** → `swapstep-itch.zip` 업로드 → **This file will be played in the browser** 체크.
2. Embed options: Viewport **960 x 600**, **Mobile friendly** 체크(Orientation: Default), **Fullscreen button** 체크.
3. Cover image: `itch-cover-630x500.png` · Screenshots: `screen-1-puzzle.png` ~ `screen-4-quick.png`
   (영상은 itch에 직접 올릴 수 없으니 YouTube에 올린 뒤 링크를 넣거나 생략)
4. Classification: Games · Genre **Puzzle** · Tags: puzzle, logic, casual, relaxing, brain-teaser, minimalist
5. Pricing: **No payments** 또는 **Donate**(후원) — 게임 안에는 광고·결제가 없다.
6. 빌드 동작: 광고·결제·구글 로그인·오프라인 캐시 꺼짐, 개인정보처리방침 포함, 공유 링크는 공식 사이트 주소.

---

## Google Play (안드로이드 앱)

### 빌드
- 앱 프로젝트: `android-app/` (Capacitor 8 — 게임 파일을 앱 안에 담음, 인터넷 없이 실행)
- 빌드 도구(이 PC): `C:\Users\DT-0020\android-tools`(JDK 21, Android SDK API 36, Node 22) — 시스템 설정은 건드리지 않음
- 게임을 고친 뒤 새 버전 만들기(Git Bash):
  ```
  export PATH="/c/Users/DT-0020/android-tools/node22:$PATH" JAVA_HOME="C:/Users/DT-0020/android-tools/jdk21" ANDROID_HOME="C:/Users/DT-0020/android-tools/sdk"
  cd borrowed-motion-balance/android-app && node prepare-www.cjs && npx cap sync android
  # android/app/build.gradle 의 versionCode(+1)·versionName 올리기
  cd android && ./gradlew bundleRelease
  ```
  결과: `android/app/build/outputs/bundle/release/app-release.aab`
- 업로드 서명 키: `android-app/swapstep-upload.jks` + `android-app/keystore.properties`(비밀번호) — **저장소에 올리지 않음. 두 파일을 함께 안전한 곳(USB·비밀번호 관리자 등)에 백업.**
  잃어버리면 Play 콘솔에서 업로드 키 재설정을 요청해야 한다(Play 앱 서명 사용 시).
- 앱 모드 동작: 광고·결제·구글 로그인 없음(무료), 뒤로 가기 = 열린 창 닫기 → 앱 내림, 백그라운드면 소리 멈춤,
  개인정보처리방침은 공식 사이트 페이지로 열림.

### 앱 정보
- 패키지 이름: `com.zeropercent.swapstep` · 버전 1.1.0 (versionCode 2 — 31개 언어; 1.0.0은 versionCode 1) · targetSdk 36 · 권한: 인터넷, 진동
- 카테고리: 게임 › 퍼즐 · 무료 · 광고 포함: **아니요**(1.0.0 기준)
- 개인정보처리방침 URL: https://sgtherong.github.io/game001/privacy.html

### 스토어 등록 정보
- 앱 아이콘: `promo/out/app/play-icon-512.png` · 그래픽 이미지: `promo/out/app/feature-1024x500.png`
- 휴대폰 스크린샷(언어별, 문구가 들어간 판): `node render-store-shots.cjs` → `promo/out/store/<언어>/1.png ~ 4.png` (1080x1920, 31개 언어).
  Play 콘솔에서 언어를 고른 뒤 그 언어 폴더의 4장을 올린다(es는 es-ES·es-419, pt는 pt-BR·pt-PT에 같이, he는 iw-IL, nb는 no-NO). 문구는 `promo/store-captions.json`.
  (예전 문구 없는 영어 캡처: `node render-screens.cjs phone` → `promo/out/phone-*.png`)
- 한국어
  - 앱 이름(30자): SwapStep - 화살표 바꾸기 퍼즐
  - 간단한 설명(80자): 두 조각의 화살표를 맞바꾸고 한 칸씩! 여행지 100곳, 3000판의 차분한 두뇌 퍼즐
  - 자세한 설명:
    스왑스텝은 방향을 맞바꾸는 차분한 퍼즐 게임이에요. 조각 두 개를 누르면 두 조각의 화살표가 서로 바뀌고, 각자 새 방향으로 한 칸씩 움직여요. 모든 조각을 색과 모양이 같은 목표로 보내면 성공!
    간단해 보이지만 한 번에 두 조각이 함께 움직여서 순서를 잘 계획해야 해요. 벽으로 조각을 멈추고, 최단 풀이로 별 세 개에 도전해 보세요.
    · 여행 지도를 따라 세계 100곳을 도는 3000판의 레벨
    · 벽, 방향 칸, 회전 칸 같은 새로운 장치
    · 빠른 한 판: 연속으로 깰수록 어려워지는 끝없는 퍼즐
    · 매일 새로 나오는 오늘의 도전과 주간 보상
    · 여행 스티커 앨범 모으기
    · 되돌리기·다시 시작은 언제나 무료, 막히면 힌트와 미리보기
    · 인터넷 없이도 플레이 가능 · 31개 언어
- **언어별 등록 정보(33개, 한국어·영어 포함): [`play-listing.md`](play-listing.md)** — 앱 이름·간단한 설명·자세한 설명을 언어마다 붙여 넣기. 위 한국어 문구와 같은 내용이며 Play용(광고 없음·오프라인 강조)으로 다듬은 판.
- ※ 레벨 수·여행지 수는 출시 시점의 게임과 맞출 것(2026-10-08 기준 3000판·여행지 100곳)

### 광고·결제·통계 켜기 (1.2.0부터 코드 준비됨 — 계정을 만든 뒤 아래 순서대로)
지금 1.2.0 빌드는 세 기능이 모두 **꺼진 상태**(설정값이 비어 있음)라 1.1.0과 똑같이 동작한다.
단, 1.2.0에는 광고 SDK가 들어 있어서 Play 콘솔에서 **광고 ID(AD_ID) 사용 신고**가 필요하다. 광고를 켜기 전이라면 1.1.0을 올려도 된다.

1. **통계(GameAnalytics)** — gameanalytics.com 가입 → 게임 추가(플랫폼: Android와 HTML5 각각 또는 하나) → Game Key / Secret Key
   → `web/branding.js` 의 `gaGameKey`·`gaSecretKey` 에 넣기. 포털 빌드에서는 넣어도 자동으로 꺼진다.
   보내는 것: 레벨 시작·클리어·포기(월드·레벨 번호, 이동 수, 별, 걸린 초), 힌트·미리보기·광고·상점 사용, 튜토리얼 완료/건너뛰기,
   기기 종류·OS·국가(IP로 추정), 익명 기기 ID. 이름·이메일은 보내지 않는다. 메뉴의 "📊 익명 플레이 통계 보내기"로 끌 수 있다.
2. **광고(AdMob)** — admob.google.com 가입 → 앱 추가(Android, Play에 올린 앱 연결) → **앱 ID**(ca-app-pub-…~…)
   → 광고 단위 2개 만들기: **보상형**(힌트·이동 추가), **전면**(레벨 사이) → 광고 단위 ID 2개
   → 앱 ID는 `android-app/android/app/src/main/res/values/strings.xml` 의 `admob_app_id`, 광고 단위 ID는 `branding.js` 의 `admob.rewardedId`·`interstitialId`.
   → AdMob › 개인정보 보호 및 메시지 › **유럽 규정 메시지(GDPR) 만들기**(게임이 처음 켤 때 Google 동의 창을 띄움; 메뉴에 "광고 개인정보 선택" 버튼이 자동으로 생김).
   → 시험할 때는 `admob: { test: true }` 로 빌드하면 Google 공식 테스트 광고가 나온다(돈 안 됨). **자기 광고를 직접 누르면 계정 정지** — 시험은 테스트 광고로만.
   광고 동작: 보상형은 버튼을 눌렀을 때만, 전면 광고는 처음 10판 이후 3판마다 '다음 문제'를 누를 때. 프리미엄 구매자는 광고 없음.
3. **결제(Google Play 결제)** — Play 콘솔 › 수익 창출 › 제품 › **인앱 상품** 만들기: 상품 ID `premium`, 가격 설정(예: ₩4,900), 활성화
   (그 전에 결제 프로필(판매자 계정) 등록 필요) → `branding.js` 의 `iapPremiumId: 'premium'`.
   가격은 Play가 그 나라 통화로 알려준 값이 상점에 표시된다. 재설치·기기 변경 시 같은 구글 계정이면 자동 복원.
   시험: Play 콘솔 › 설정 › 라이선스 테스트에 본인 계정을 넣으면 실제 돈 없이 구매 시험 가능(비공개 테스트 트랙에서).
4. 위 값을 넣은 뒤: `versionCode` 올리기 → 앱 다시 빌드 → 웹도 다시 배포(통계 키는 웹에도 적용됨).
5. **문서 함께 고치기(필수)**: 개인정보처리방침(`web/privacy.html`, 영어·한국어 — "광고와 분석" 항목을 AdMob·GameAnalytics 사용으로),
   Play 콘솔 **데이터 보안** 설문(기기 ID·앱 활동·진단 정보 수집/공유: AdMob·GameAnalytics), **광고 포함: 예**, 광고 ID 신고, 콘텐츠 등급 설문의 광고 항목.

### 콘솔 설문 답변(1.0.0 기준)
- 데이터 보안(Data safety): **수집·공유하는 데이터 없음**. 진행 기록은 기기에만 저장되고 외부로 보내지 않음.
  암호화 전송·삭제 요청 항목은 "해당 없음"(수집 데이터 없음).
- 광고: 없음 · 앱 액세스: 로그인 없이 모든 기능 사용 가능
- 콘텐츠 등급(IARC 설문): 폭력·성적 표현·도박·약물·사용자 간 소통·위치 공유 모두 없음 → 전체 이용가 예상
- 대상 연령: **13세 이상 권장**(13세 미만 포함 시 가족 정책 추가 요건이 붙음)
- 뉴스 앱 아님 · 정부 앱 아님 · 금융 기능 없음 · 건강 앱 아님

### 출시 순서(개인 개발자 계정)
1. Play 콘솔 개발자 등록(25달러) → 본인 인증
2. 앱 만들기 → 위 정보·설문 입력 → **비공개 테스트** 트랙에 AAB 업로드
3. 테스터 12명 이상을 이메일 목록(또는 Google 그룹)으로 추가 → 14일 연속 유지
4. 14일 뒤 콘솔에서 프로덕션 접근 신청 → 심사 → 출시

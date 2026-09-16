# 스왑스텝 (SwapStep)

두 조각의 화살표 방향을 서로 맞바꾼 뒤, 그 두 조각만 한 칸 움직여 모든 조각을 목표에 도착시키는 캐주얼 퍼즐 게임입니다.

## 규칙

- 조각 **두 개**를 선택하면 두 조각의 **화살표 방향이 서로 바뀝니다**.
- 그 두 조각만 **새 방향으로 한 칸** 이동합니다. (미리보기 후 실행)
- 보드 밖이나 시작 시 다른 조각이 있던 칸으로는 이동할 수 없습니다. 두 조각이 같은 빈칸을 향하면 둘 다 멈춥니다. 막혀도 방향 교환은 적용됩니다.
- 모든 조각이 **자기 번호 목표 칸**에 도착하면 성공. 경로와 최종 방향은 자유입니다.
- 시간·이동 횟수 제한 없음. 되돌리기·재시작·힌트는 무료입니다.

## 실행 방법

`borrowed-motion-balance/web/index.html`을 브라우저로 열면 바로 실행됩니다. 외부 의존성·서버가 필요 없습니다(스테이지 데이터 임베드, `fetch` 미사용).

로컬 서버로 열면(예: `npx serve borrowed-motion-balance/web`) PWA 설치·오프라인 기능까지 동작합니다.

## 기능

- **1000 스테이지, 8개 챕터** (규칙 익히기 → 편안한 반복 → 순서 계획 → 넓은 보드 적응 → 4×4 계획 → 네 조각 입문 → 네 조각 계획 → 긴 여정)
- 보드 3×3·4×4, 조각 2~4개, 최소 이동 1~9수 (완전 탐색으로 검증, 대칭 중복 제거)
- 이동 미리보기(막힘 시 "정지" 표시), 무료 되돌리기·재시작
- 현재 상태에서 결정적으로 계산하는 다음 한 수 힌트(BFS)
- 온보딩 튜토리얼, 여행 앨범 스티커 수집
- 완료 연출(컨페티·효과음·햅틱), 진행 저장(localStorage)
- PWA(홈화면 설치·오프라인·세로 화면)

## 폴더 구성

```
borrowed-motion-balance/
├─ web/                     # 웹 게임 (플레이 가능)
│  ├─ index.html            # 게임 화면·스타일
│  ├─ game.js               # 게임 로직 (rules.cjs의 규칙을 1:1 구현)
│  ├─ stages-data.js        # 임베드된 1000 스테이지
│  ├─ manifest.webmanifest  # PWA 매니페스트
│  ├─ sw.js                 # 서비스워커 (오프라인)
│  └─ icon-*.png            # 앱 아이콘
├─ rules.cjs                # 순수 규칙 함수 (선택한 두 조각 이동)
├─ generate-stages-1000.cjs # 1000 스테이지 생성·검증 (현재 게임에 사용)
├─ stages-1000.json         # 1000 스테이지 데이터
├─ validation-report-1000.json
├─ generate-stages.cjs      # 초기 100 스테이지 생성기 (참고용)
├─ stages-100.json          # 초기 100 스테이지 (참고용)
└─ validation-report.json
```

## 스테이지 생성/검증

```bash
node borrowed-motion-balance/generate-stages-1000.cjs
```

고정 시드(20260915)로 후보 풀(약 5,600개 유니크)과 1000개 스테이지를 재생성합니다. 각 스테이지는 완전 탐색으로 클리어 가능성과 최단 이동 수를 검증하고(대칭·조각 번호 중복 제거), 인게임 힌트가 빠르도록 도달 가능 상태 수를 7,000 이하로 제한합니다. 생성 후 `web/stages-data.js`는 `stages-1000.json`에서 다시 만듭니다:

```bash
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('borrowed-motion-balance/stages-1000.json','utf8'));const stages=d.stages.map(s=>({id:s.stage_id,seq:s.sequence,chapter:s.chapter,role:s.intended_role,n:s.board_size,pieces:s.piece_count,start:s.start,targets:s.targets,min:s.min,ways:s.ways}));fs.writeFileSync('borrowed-motion-balance/web/stages-data.js','window.BM_DATA='+JSON.stringify({rules:d.rules_version,dir:{0:'right',1:'down',2:'left',3:'up'},stages})+';\n')"
```

## 광고/플랫폼 어댑터 (수익화)

`web/platform.js`는 광고 호출을 단일 인터페이스로 추상화합니다. 게임 코드는 `AdsManager.showRewarded()` 등만 호출하고, 접속 **도메인**에 따라 플랫폼 SDK(Poki·CrazyGames·GameDistribution)를 동적으로 로드·호출합니다. 포털이 아닌 곳(자체 호스팅·gh-pages·Artifact)에서는 `local`(시뮬레이션) 어댑터로 동작합니다.

```
AdsManager.showRewarded()   // Promise<boolean> — 보상형 광고 (true=보상 지급)
AdsManager.showInterstitial() // 전면(레벨 전환) — config.interstitialEnabled 로 gate (기본 off)
AdsManager.gameplayStart() / gameplayStop() / happyTime()
AdsManager.platform          // 현재 어댑터 이름
```

새 포털 추가 = `platform.js`에 어댑터 하나 추가 + `detect()`에 도메인 규칙 추가. **게임 코드는 수정하지 않습니다.** 결제(프리미엄)는 `game.js`의 `buyPremium`/`restorePurchase`에 스토어 IAP를 연결하면 됩니다.

## 규칙 버전

`borrowed-motion-easy-v1` — 벽·회전 바닥 등 추가 장치는 포함하지 않은 기본 규칙입니다.

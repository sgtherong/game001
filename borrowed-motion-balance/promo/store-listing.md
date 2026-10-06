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
- Free undo and restart, hints and a peek booster when you're stuck
- Plays in 7 languages: English, Korean, Spanish, Portuguese, Russian, German, French

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

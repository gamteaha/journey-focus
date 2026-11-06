# 서울 티켓 에디션 01

서울을 첫 도시 에디션으로 표시한다. 화면 전체와 상단 헤더는 따뜻한 크림색 `#f5efdf`이다. 티켓 본문은 불투명 황갈색 `#dfc397`, 확인용 표는 `#d4b787`, 시간·추천 정거장 영역은 이전의 밝은 `#d6bc91`로 복원했다. 숫자판은 밝은 종이색을 유지한다. 배경 지도와 반투명 효과는 표시하지 않는다. 탑승 준비 로딩 화면의 별도 배경은 유지한다.

편집 티켓에서 횃불이가 나오는 캐릭터 영역은 불투명 세이지 그린 `#b3bea0`으로 구분한다. 캐릭터 선택 버튼은 밝은 녹색이며 선택된 버튼은 진한 녹색으로 표시한다. 모바일에서 아래로 이동하는 캐릭터 영역에도 같은 색을 적용한다.

티켓은 평면적인 불투명 색면으로 표현한다. 종이 노이즈, 두께·접힘·눌림 그림자, 숫자판 그라데이션과 스티커의 추가 그림자는 제거했다. 기존 스티커 배치, 세이지 그린 캐릭터 영역, 한글 서체와 입력 기능은 유지한다. 발급 후 절취표에도 같은 평면 표현을 적용한다.

한글 제목·역 이름·소제목·캐릭터 이름은 고운바탕 Bold, 시간 숫자와 추천 제목은 고운바탕 Regular를 사용한다. 작은 안내와 버튼은 고운돋움으로 맞춘다. 영문 로고·표제는 기존 서체를 유지한다. `public/fonts/gowun/`에 Google Fonts의 WOFF2 글자 묶음과 OFL 라이선스를 함께 보관하며, CSS의 Unicode 범위에 따라 필요한 묶음만 요청한다. 폰트 파일 자체는 변경하지 않았다. 탑승 화면에만 적용하며 객실 HUD의 글꼴은 별도다.

머리말에 궁궐·남산타워, 왼쪽 여백에 전철·회중시계, 캐릭터 옆에 하트 스티커를 배치한다. `서울행 / SEOUL · 01` 도장은 한 개만 사용한다. 장식은 클릭을 가로채지 않으며 입력과 겹치지 않는 전용 여백에 둔다. 발급 후 절취표에는 같은 종이색과 궁궐·도장을 사용한다.

모바일에서는 궁궐 그림과 도장만 남기고 가장자리 장식·남산타워·자유석 표시를 숨긴다. 폭 370px 이하의 편집 표에서는 궁궐도 생략하고 서울 도장을 유지한다. 교통카드 앞면은 기존 사용자 제공 이미지로 표시한다. 시간, 추천 경로, 무제한, 캐릭터 선택 및 태그/절취 동작을 유지한다.

`public/boarding.mjs`의 `SEOUL_TICKET`이 도시 이름·마크·그림을 관리하며, 장식은 `data-city="seoul"`과 `public/seoul-ticket.css`로 분리한다. 앞으로 다른 도시의 티켓에 도시별 그림과 도장을 구성할 수 있도록 장식과 입력 영역을 분리했다. 현재 운행 데이터와 선택 가능한 노선은 서울 2호선이다.

## 자산

- `public/images/seoul-map-background.png`: 사용자 제공 원본을 이전 디자인 자산으로 보관한다. 현재 화면 배경에는 사용하지 않는다.
- `public/images/seoul-stickers/`: 사용 중인 손그림 스티커 5종. 생성 프롬프트와 전체 8종 설명은 `seoul-stickers.md` 참고.
- `public/images/seoul-ticket-watercolor.png`, `public/images/seoul-route-paper.svg`: 이전 디자인 자산으로 보관하며 현재 티켓에서는 사용하지 않는다.
- 캡처: 루트 `tmp/seoul-ticket-preview.png`, `tmp/ticket-editor-qa/`, `tmp/journey-picker-qa/`.
- 확인: `node scripts/ticket-editor-check.mjs`와 `node scripts/journey-picker-check.mjs`. 장식과 입력의 비겹침, 작은 창/모바일, 실제 그림 로드, 종류 전환 후 값 유지, 시간 추천과 표 발급을 확인한다.

## 최종 이미지 생성 프롬프트

도구: 내장 `image_gen.imagegen`, 새 이미지 생성, `transparent_background: true`.

> Create a single small decorative watercolor travel-sticker illustration for a Seoul train-ticket web UI. Subject: Namsan Seoul Tower, recognizable short observation tower with a slim red-white antenna, rising from one low rounded sage-green hill, with one tiny traditional Korean tiled-roof hanok pavilion nestled beside it. It is ONE compact unified cluster, not a sticker sheet. Style: charming hand-painted Korean travel journal, delicate dark graphite outlines, muted sage, warm ivory, faded grey-blue and small terracotta roof details; soft watercolor wash and subtle paper-paint texture within the subjects. Restrained, sophisticated, cute rather than childish, readable at 110px wide. Wide horizontal composition approximately 2:1, centered with modest transparent margins. Fully transparent background. No background scene, no floor rectangle, no circular badge, no white sticker border, no cast shadow outside the artwork. NO text, NO letters, NO logos, NO stamps, NO extra buildings, NO people, NO trains. Export the illustration only, to be used as a small ticket decoration.

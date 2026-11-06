# 서울 티켓 에디션 01

서울을 첫 도시 에디션으로 표시한다. 머리말의 작은 수채화 그림 한 묶음(남산타워·한옥), `서울행 / SEOUL · 01` 도장 한 개, 옅은 장식용 노선 무늬로 구성한다. 그림과 도장을 역·시간 입력 위에 겹치지 않고 머리말에만 배치한다. 발급 후 절취표에도 같은 그림과 도장이 이어진다.

모바일에서는 그림 크기를 줄이고 자유석 표시를 숨긴다. 폭 370px 이하의 편집 표에서는 그림을 생략하고 서울 도장을 유지한다. 교통카드 앞면은 기존 사용자 제공 이미지로 표시한다. 시간, 추천 경로, 무제한, 캐릭터 선택 및 태그/절취 동작을 유지한다.

`public/boarding.mjs`의 `SEOUL_TICKET`이 도시 이름·마크·그림을 관리하며, 장식은 `data-city="seoul"`과 `public/seoul-ticket.css`로 분리한다. 앞으로 다른 도시의 티켓에 도시별 그림과 도장을 구성할 수 있도록 장식과 입력 영역을 분리했다. 현재 운행 데이터와 선택 가능한 노선은 서울 2호선이다.

## 자산

- `public/images/seoul-ticket-watercolor.png`: 내장 imagegen 도구로 새로 생성한 투명 배경 수채화 그림. 생성 원본을 복사했으며 추가로 자르거나 수정하지 않았다.
- `public/images/seoul-route-paper.svg`: 코드로 직접 그린 장식용 노선과 강 모양. 실제 지리·선로 안내용 지도는 아니다.
- 캡처: 루트 `tmp/seoul-ticket-preview.png`, `tmp/ticket-editor-qa/`, `tmp/journey-picker-qa/`.
- 확인: `node scripts/ticket-editor-check.mjs`와 `node scripts/journey-picker-check.mjs`. 장식과 입력의 비겹침, 작은 창/모바일, 실제 그림 로드, 종류 전환 후 값 유지, 시간 추천과 표 발급을 확인한다.

## 최종 이미지 생성 프롬프트

도구: 내장 `image_gen.imagegen`, 새 이미지 생성, `transparent_background: true`.

> Create a single small decorative watercolor travel-sticker illustration for a Seoul train-ticket web UI. Subject: Namsan Seoul Tower, recognizable short observation tower with a slim red-white antenna, rising from one low rounded sage-green hill, with one tiny traditional Korean tiled-roof hanok pavilion nestled beside it. It is ONE compact unified cluster, not a sticker sheet. Style: charming hand-painted Korean travel journal, delicate dark graphite outlines, muted sage, warm ivory, faded grey-blue and small terracotta roof details; soft watercolor wash and subtle paper-paint texture within the subjects. Restrained, sophisticated, cute rather than childish, readable at 110px wide. Wide horizontal composition approximately 2:1, centered with modest transparent margins. Fully transparent background. No background scene, no floor rectangle, no circular badge, no white sticker border, no cast shadow outside the artwork. NO text, NO letters, NO logos, NO stamps, NO extra buildings, NO people, NO trains. Export the illustration only, to be used as a small ticket decoration.

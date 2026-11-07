# Journey Focus

실제 공간정보와 3D 풍경을 이용한 집중 여정 프로젝트입니다. 2호선 본선 43개 역의 OSM 선로에서 시간별 도착역을 추천하며, `∞ 무제한`을 선택하면 같은 속도로 계속 순환합니다. 누적 공부 시간과 완료한 바퀴 수를 표시합니다. [무제한 순환 안내](apps/journey-focus/docs/unlimited-loop.md).

**배포 사이트:** https://journey-focus.gamteaha.workers.dev/

서울·인천·스위스·사막에서 같은 설정·음악·화면 전환을 사용합니다. 완료 승차권과 도장을 모아 달빛 오아시스, 세계여행 무한 순환을 열 수 있습니다. [여권·해금·세계여행 안내](apps/journey-focus/docs/travel-passport.md).

## 구성

- `apps/journey-focus/`: Node.js로 바로 실행하는 로컬 앱, 테스트, 렌더링 문서, 풍경 모델.
- `hosted/`: 배포 사이트의 서버와 소스. Sites / Cloudflare Workers 환경용입니다.
- `assets-source/subway-car/`: 사용자가 제공한 지하철 모델 원본과 이미지. 로컬 객실 테스트에서 FBX를 불러옵니다.
- `assets-source/characters/blue-flame/`: 사용자 제공 캐릭터 원형과 채색·관절·걷기/앉기 작업본. 실행용 GLB는 `apps/journey-focus/public/models/blue-flame.glb`입니다.
- `.env.example`: 필요한 API 설정 이름. 실제 키는 저장소에 포함하지 않습니다.

## 다른 컴퓨터에서 실행

Node.js 24 이상과 Git을 설치한 뒤 실행합니다.

```powershell
git clone https://github.com/gamteaha/journey-focus.git
cd journey-focus
Copy-Item .env.example .env.local
```

루트 `.env.local`에 본인의 VWorld 및 서울 T Data 키를 입력합니다. VWorld 개발용 서비스 URL은 `http://localhost:5173`입니다.

```powershell
cd apps/journey-focus
node server.mjs
```

브라우저에서 http://localhost:5173 을 엽니다. 로컬 앱은 별도 npm 패키지 설치가 필요 없습니다.

## 검증

```powershell
cd apps/journey-focus
npm.cmd test
npm.cmd run check
```

최근 변경은 [승차권 입장 흐름](apps/journey-focus/docs/boarding-flow.md), [객실 전체 화면과 좌석 상호작용](apps/journey-focus/docs/immersive-game.md), [캐릭터 객실 테스트](apps/journey-focus/docs/cabin-prototype.md)에 있습니다. 승차권에서 노선·시간·캐릭터 색상을 고르고, 절취선을 일자로 그어 종이표를 자르거나, 카드를 단말기에 끌어 놓아 입장합니다. 태그음·한국어 승차 안내·지원 기기 진동을 연결했습니다. 확인 후에는 [열차 도착 로딩 화면](apps/journey-focus/docs/arrival-loading.md)에서 객실 렌더링과 초기 창밖 지형 준비를 기다린 뒤 입장합니다. 객실은 브라우저 화면을 채우며 역 안내는 위쪽 전광판, 시간은 출발 후 오른쪽 위에 표시합니다. 의자를 클릭해 선택한 색을 확인하고 캐릭터 옆 ‘앉기’ 버튼으로 확정합니다. 출발 후 [캐릭터 공부 화면](apps/journey-focus/docs/study-character-view.md)은 좌석을 정면으로 바라보며 머리 위에 누적 집중시간을 표시합니다. 사용자 제공 모델에 채색·관절을 추가해 대기·걷기·앉기를 연결했습니다. 친구 접속은 아직 구현하지 않았습니다.

## 로컬 비교 화면

- http://localhost:5173/render-study/ : 동일 장소의 재질·조명 비교
- http://localhost:5173/render-study-front/ : 카메라 정면광 재비교, 선택한 6번 포함
- http://localhost:5173/video-pilot/ : 같은 선로의 원본/6번 10초 영상과 다운로드

비교 사진과 영상은 `apps/journey-focus/public/review/`에 보존했습니다. 6번은 정면광 1.2, 그림자 끔, AO, 색감 보정 70%이며 로컬 앱의 기본 스타일입니다. AI 시안은 정지 이미지이며 AI 동영상 변환은 아직 실행하지 않았습니다.

## 데이터와 풍경

VWorld WebGL 3.0, 서울 T Data 역 좌표, 기본 구간의 OSM 철도 선형을 사용합니다. 지면 기준 카메라 높이 30m는 시험값이며 실제 고가 선로 높이는 미검증입니다. 풀·나무·집의 재구성은 이전 경춘선 시험으로 현재 도시 기본 여정에서는 사용하지 않습니다. 풍경 모델 출처와 라이선스는 `apps/journey-focus/public/assets/`의 카탈로그 및 각 모델의 출처 파일을 확인하세요.

## 온라인 배포

Cloudflare에 직접 배포하려면 [Cloudflare 배포 안내](cloudflare/README.md)를 따릅니다. 저장소 루트의 `wrangler.jsonc`가 최신 로컬 앱을 준비하고 서버 API와 함께 배포합니다. Cloudflare 프로젝트 이름은 `journey-focus`, Root directory는 `/`, Deploy command는 `npx wrangler deploy`입니다.

`hosted/`에는 현재 사이트의 배포 소스를 보존했습니다. API 키는 호스팅 서비스의 런타임 비밀 설정으로 따로 등록해야 합니다. `.env.local`, 인증 토큰, 설치된 의존성, 브라우저 프로필과 임시 다운로드는 Git에 포함하지 않습니다.

이번 로컬 앱 변경은 `hosted/` 및 기존 ChatGPT Sites 배포 사이트에 반영하지 않았습니다. 별도 Cloudflare 직접 배포 설정은 최신 `apps/journey-focus/`를 사용합니다.

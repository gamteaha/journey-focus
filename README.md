# Journey Focus

실제 공간정보와 3D 풍경을 이용한 집중 타이머 프로젝트입니다. 로컬 앱의 기본 여정은 2호선 성수→건대입구 실제 OSM 선로입니다.

**배포 사이트:** https://journey-focus-train.indigonova38.chatgpt.site

사이트는 현재 소유자 계정으로 로그인해서 이용하는 비공개 상태입니다.

## 구성

- `apps/journey-focus/`: Node.js로 바로 실행하는 로컬 앱, 테스트, 렌더링 문서, 풍경 모델.
- `hosted/`: 배포 사이트의 서버와 소스. Sites / Cloudflare Workers 환경용입니다.
- `assets-source/subway-car/`: 사용자가 제공한 지하철 모델 원본과 이미지. GLB 변환 및 앱 연결 전입니다.
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

최근 변경은 [도시 기본 여정](apps/journey-focus/docs/city-default.md), [6번 스타일과 영상 시험](apps/journey-focus/docs/style6-video-pilot.md)에 있습니다. 49개 단위 테스트와 브라우저에서 조명·지도 잠금·화면 높이·영상 재생을 확인했습니다.

## 로컬 비교 화면

- http://localhost:5173/render-study/ : 동일 장소의 재질·조명 비교
- http://localhost:5173/render-study-front/ : 카메라 정면광 재비교, 선택한 6번 포함
- http://localhost:5173/video-pilot/ : 같은 선로의 원본/6번 10초 영상과 다운로드

비교 사진과 영상은 `apps/journey-focus/public/review/`에 보존했습니다. 6번은 정면광 1.2, 그림자 끔, AO, 색감 보정 70%이며 로컬 앱의 기본 스타일입니다. AI 시안은 정지 이미지이며 AI 동영상 변환은 아직 실행하지 않았습니다.

## 데이터와 풍경

VWorld WebGL 3.0, 서울 T Data 역 좌표, 기본 구간의 OSM 철도 선형을 사용합니다. 지면 기준 카메라 높이 30m는 시험값이며 실제 고가 선로 높이는 미검증입니다. 풀·나무·집의 재구성은 이전 경춘선 시험으로 현재 도시 기본 여정에서는 사용하지 않습니다. 풍경 모델 출처와 라이선스는 `apps/journey-focus/public/assets/`의 카탈로그 및 각 모델의 출처 파일을 확인하세요.

## 온라인 배포

`hosted/`에는 현재 사이트의 배포 소스를 보존했습니다. API 키는 호스팅 서비스의 런타임 비밀 설정으로 따로 등록해야 합니다. `.env.local`, 인증 토큰, 설치된 의존성, 브라우저 프로필과 임시 다운로드는 Git에 포함하지 않습니다.

이번 로컬 앱 변경은 `hosted/` 및 기존 배포 사이트에 반영하지 않았습니다.

# Journey Focus

경춘선의 실제 공간정보와 3D 풍경을 이용한 집중 타이머 프로젝트입니다.

**배포 사이트:** https://journey-focus-train.indigonova38.chatgpt.site

사이트는 현재 소유자 계정으로 로그인해서 이용하는 비공개 상태입니다.

## 구성

- `apps/journey-focus/`: Node.js로 바로 실행하는 로컬 앱, 테스트, 렌더링 문서, 풍경 모델.
- `hosted/`: 배포 사이트의 서버와 소스. Sites / Cloudflare Workers 환경용입니다.
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

상세 결과는 [릴리스 검증 기록](apps/journey-focus/docs/release-candidate.md), 렌더링 방향은 [렌더링 로드맵](apps/journey-focus/docs/rendering-roadmap.md)에 있습니다.

## 데이터와 풍경

VWorld WebGL 3.0, 서울 T Data 역 좌표, 기본 구간의 OSM 철도 선형을 사용합니다. 가까운 풀·나무·집은 별도 모델로 재구성한 시험 구간이며, 실제 현장 배치나 실사 수준의 복원을 검증한 것은 아닙니다. 모델 출처와 라이선스는 `public/assets/`의 카탈로그 및 각 모델의 출처 파일을 확인하세요.

## 온라인 배포

`hosted/`에는 현재 사이트의 배포 소스를 보존했습니다. API 키는 호스팅 서비스의 런타임 비밀 설정으로 따로 등록해야 합니다. `.env.local`, 인증 토큰, 설치된 의존성, 브라우저 프로필과 임시 다운로드는 Git에 포함하지 않습니다.

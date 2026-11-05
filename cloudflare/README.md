# Cloudflare Workers 직접 배포

기존 ChatGPT Sites 프로젝트와 별도로, GitHub 저장소를 Cloudflare Workers에 연결해 배포하는 설정입니다. 사이트 주소를 아는 사람이 접속할 수 있는 일반 웹사이트로 배포됩니다. ChatGPT Sites의 소유자 로그인 제한은 이 별도 Worker에 적용되지 않습니다.

## Cloudflare 화면 설정

프로젝트 `journey-focus` → Settings → Builds에서 아래처럼 설정합니다.

| 항목 | 값 |
|---|---|
| Root directory | 저장소 루트 `/` |
| Build command | 비워 두기 |
| Deploy command | `npx wrangler deploy` |

루트 `wrangler.jsonc`에 서버 진입점과 정적 파일 위치가 있습니다. `wrangler deploy`가 `node cloudflare/build.mjs`를 자동 실행하므로 별도 Build command는 필요 없습니다. Build command를 필수로 입력해야 하는 화면에서는 `npm run build`를 사용해도 됩니다. 이 경우 파일 준비가 두 번 실행되며 결과는 같습니다.

프로젝트 이름은 `journey-focus`와 일치해야 합니다. 다른 이름을 쓰려면 `wrangler.jsonc`의 `name`도 변경합니다.

## API 키

프로젝트 Settings → Variables and Secrets → Add → Type: Secret에서 두 항목을 등록하고 Deploy합니다.

- `VWORLD_API_KEY`: 브이월드 인증키
- `TDATA_API_KEY`: 서울 T Data 인증키

키 값, `.env.local`, Cloudflare 인증 토큰은 GitHub에 올리지 않습니다. T Data 키는 Worker에서만 사용합니다. 브이월드 키는 브라우저 SDK를 초기화하는 데 필요하므로 SDK URL에 포함됩니다. 브이월드 인증키의 서비스 URL/도메인 허용 설정을 새 배포 주소에 맞춰 확인해야 합니다.

## 로컬 검증

```powershell
npm ci
npm run test:cloudflare
npm run deploy:check
```

`deploy:check`는 Cloudflare에 게시하지 않고 Wrangler 설정, 서버 번들 및 정적 파일을 검사합니다. `dist/cloudflare`에는 실행에 필요한 HTML·CSS·모듈·풍경 에셋·지하철 모델만 생성합니다. 개발 비교 사진과 영상은 제외합니다.

## 배포 후 확인

- `/api/status`: `vworldConfigured`, `tdataConfigured`가 모두 `true`
- `/api/stations`: 성수와 건대입구 2개 역
- 승차권 선택 → 탑승 로딩 → 객실 모델과 지도 → 좌석 선택 → 출발

이전 실패 로그의 `Could not detect a directory containing static files`는 저장소 루트에서 Wrangler 설정과 배포 파일을 찾지 못한 오류입니다. 이 설정이 포함된 새 커밋을 GitHub에 올린 뒤 다시 빌드해야 합니다.

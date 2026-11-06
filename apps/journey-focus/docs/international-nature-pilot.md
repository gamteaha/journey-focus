# 독립된 해외 자연 철도 여정 · 2026-11-06

> 2026-11-07 업데이트: 스위스 별도 객실과 횃불이, 오른쪽 좌석 선택을 연결했다. 아래는 최초 풍경 시험 기록이며, 현재 화면은 오른쪽 창밖만 제공하고 모든 진입에서 선로 시작점부터 출발한다. 최신 내용은 `swiss-cabin.md` 참조.

여행지마다 실제 현지 선로를 선택한다. 서울에서 해외로 이어지는 가상 경로나 여러 나라 풍경을 섞은 노선은 만들지 않는다. 현재 구현 범위는 해외 창밖 풍경의 별도 시험이며, 기존 서울 승차권과 객실은 유지한다.

## 우선순위

아래 순서는 데이터 연결 용이성, 실제 선로 확보, 가까운 나무/건물 모델 의존도에 대한 개발 판단이다. 풍경 품질 또는 성능을 보장하는 점수가 아니다.

| 순위 | 후보 | 확인한 근거 | 아직 필요한 것 |
| --- | --- | --- | --- |
| 1 | 스위스 베르니나선 · 라고 비앙코 | 정부 quantized-mesh 지형 + SWISSIMAGE WMTS를 가입/키 없이 연결. 실제 OSM 선로 확보 및 브라우저 렌더링 성공 | 근거리 지면 질감, 실제 차창 높이, 장시간 이동 성능 |
| 2 | 노르웨이 라우마선 | 실제 자연 경관 철도. Kartverket의 공개 지형 데이터/API 존재 | 해당 구간 항공사진 사용 조건·접근 경로, 지형 변환, 숲·교량·터널 표현 |
| 3 | 뉴질랜드 트랜즈알파인 | 평원·협곡·산악을 지나는 실제 철도. Cesium 전 세계 지형에서 뉴질랜드 자료 지원 | 구간별 영상 품질·이용 조건 및 계정/호스팅 선택 검증 |
| 4 | 이집트 사막 구간 | 룩소르–아스완 등 실제 철도 연결 확인. 세계 지형은 활용 후보 | 사막이 실제로 보이는 선로 구간 선별, 영상/지형 품질. 나일강 노선 전체를 모래언덕·피라미드 노선이라고 소개하지 않음 |

### 공식 출처

- 베르니나: https://www.myswitzerland.com/en-ch/experiences/bernina-express/
- 라고 비앙코–알프 그륌 지역: https://www.myswitzerland.com/en-us/experiences/alp-gruem/
- 스위스 지형 API: https://docs.geo.admin.ch/visualize-data/terrain-service.html
- 스위스 WMTS: https://docs.geo.admin.ch/visualize-data/wmts.html
- 스위스 서비스 이용 조건: https://www.geo.admin.ch/en/general-terms-of-use-fsdi (무료, 가입 불필요, fair use 및 출처 표시)
- 라우마: https://www.visitnorway.com/plan-your-trip/getting-around/by-train/rauma-line/
- 노르웨이 지형: https://www.kartverket.no/api-og-data/terrengdata
- 트랜즈알파인: https://www.christchurchnz.com/visit/getting-around/listing/tranzalpine-kiwirail-scenic-journeys-3563155
- 이집트 철도 연결: https://www.experienceegypt.eg/files/Luxor-Eng.pdf
- 세계 지형: https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/

## 실제 구현한 첫 시험

경로: `/alpine-pilot/` (명시적 index 경로 `/alpine-pilot/index.html`도 지원).

- CesiumJS 1.123 공식 CDN 고정 버전. Cesium ion 토큰이나 VWorld 키를 사용하지 않는다. 외부 CDN과 스위스 서비스 연결은 필요하다.
- 지형: `https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/`. 확인 당시 metadata는 20250101 타일을 참조한다.
- 영상: `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg`. EPSG:3857 Capabilities의 ResourceURL 사용. 최대 요청 레벨 19로 제한.
- OSM 공식 읽기 API 한 개 bbox 응답에서 RhB 협궤 본선의 연결 그래프를 만든다. 역 정차 노드 Ospizio Bernina 13839385690 → Alp Grüm 9164120795 사이의 연속 경로 약 4.56km에서, 터널·설해 방호시설·교량으로 표시된 구간을 제외한다.
- 가장 긴 연속 야외 구간 1,588m, 원본 노드 76개. way IDs 827912966, 827912967, 51838352. 정확한 출처·좌표·재수집 시점은 `public/alpine-pilot/route.json`에 기록한다. 두 역 전 구간 구현이 아니다.
- 움직임은 원본 선로 구간을 선형 보간하며 지름길로 이동하지 않는다. 높이는 스위스 지형을 최대 15m 간격으로 샘플링한 후 +3m. 실제 철도 측량 높이/차창 높이가 아니며 터널이나 다리를 지면 높이로 통과하지 않도록 제외했다.
- 20km/h와 60km/h 빠른 확인, 좌우 창가, 위치 슬라이더, 재생/일시정지/처음으로. 실제 시간표와 연결하지 않는다.
- 카메라 직접 드래그/줌 금지. 화면이 숨겨지면 이동을 멈춘다. 첫 화면은 시험 구간 50% 오른쪽 호수 시야.
- 실행 중 AI 생성 호출 없음. 비용은 이 시험에서 유료 생성 API가 아니라 웹 호스팅/트래픽·외부 데이터 서비스 조건에 따라 달라진다.

## 관찰과 한계

오른쪽 중간 구간에서 호수와 맞은편 산을 확인했다. 왼쪽은 가까운 비탈이 시야를 가려 후보로 불리하다. 원본 항공사진을 지형에 입히는 방식이므로 근거리 지면과 수직 절벽은 늘어져 보일 수 있다. 첫 로드 시험은 약 24초였고 다른 위치의 정지 화면은 약 25~29 FPS였지만 기기·캐시·화면 크기에 따라 달라진다. 이를 무지연이나 완성 품질로 표현하지 않는다.

실제 선로 수평 좌표가 있다는 사실과, 실제 열차 차창의 모든 구조물을 재현했다는 것은 다르다. 레일·전차선·차량·나무 모델은 추가하지 않았고, 영상에 찍힌 눈만 보인다. 지도 영상은 실시간/계절 선택 영상이 아니다. 현재 단계는 연결/시야/이동 검증이다.

브라우저에서 20km/h로 6초 재생해 약 33.5m 이동했으며 당시 28 FPS였다. 이동 중 타일 10개가 로딩 중이므로 모든 지형이 미리 준비되었다는 의미는 아니다. 재생/일시정지, 좌우 전환, 처음으로, 위치 슬라이더, 출처 패널 및 390×844 화면의 가로 넘침 없음을 확인했다. 테스트 중 JavaScript 오류는 없었고 Cloudflare 관련 테스트 8개와 배포 빌드가 통과했다.

화면 확인 후 진행 순서: 오른쪽 시야 평가 → 카메라 높이·근거리 품질 개선 → 스위스 독립 여행지 선택 → 스위스 티켓/객실 연결 → 다음 국가 시험.

## 재현

- 원본 재수집: `node scripts/build-alpine-rail.mjs --fetch` (앱 폴더에서 실행). 기본 실행은 루트 tmp의 캐시 사용. 공개 배포에는 선별된 경로 JSON만 포함하고 전체 OSM 응답은 포함하지 않는다.
- API 키 없이 개발 서버의 `/alpine-pilot/`를 연다.
- QA 캡처 및 결과: 루트 `tmp/alpine-qa/`.

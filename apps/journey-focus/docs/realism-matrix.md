# 동일 장소 실사감 비교 · 2026-11-04

로컬 갤러리: http://localhost:5173/render-study/ (각 사진을 누르면 확대).

성수→건대입구 OSM 선형 진행률50%, 경도127.0634654558/위도37.5423413250, 진행방향110.7039도+오른쪽90도, 경사-4도, 화각65도, 지형+30m 시험 시점. 실제 고가 표고는 미검증이다. 고정 카메라 해발42.6336m에서 원본·색감/안개·HBAO·조명/그림자·조합을 캡처했다. SDK Cesium1.99에서 실제 stage ready와 render error 없음 확인.

PBR 첫 시도는 현재 SDK의 czm_modelMaterial에 metallic 필드가 없어 컴파일 실패했다. roughness/specular를 지원 필드로 수정해 재시도했고 최종3개 재질 변형 모두 오류 표시 없이 렌더됐다. 타일셋 customShader 연결과 환경광 계수 변경을 확인했으나 시각적인 외벽 개선은 거의 없다. 고해상도 외벽·유리/콘크리트 구분 재질을 새로 확보한 것은 아니다. 타일셋 접근의 내부 _tileset 참조는 QA 실험에만 사용했고 일반 앱 코드에 채택하지 않았다.

환경광 계수만의 별도 시험도 성공했다. 최종 갤러리의08번은 PBR+환경광 조합이며 단독 시험 이미지와 혼동하지 않는다. 조명·그림자는 기존 사진에 포함된 그림자와 함께 어두워지는 결과를 보였다. Lumen/레이트레이싱, 새로운 고해상도 데이터 전환은 시행하지 않았다. 프레임 성능·실제 이동 일관성은 이 정지 비교로 보장하지 않는다.

AI 정지 시안은 built-in image_gen 도구(imagegen 스킬)로01-original.png를 편집했다. 경로 tmp/realism-comparison/07-ai-concept.png. 카메라 구도와 지리적 배치를 유지하도록 요청했으나 결과에는 창문·도로·나무 등 생성된 세부가 포함되므로 실제 복원으로 표시하면 안 된다. 원본 출처 표기와 AI 정지 시안 배지를 유지했다. 실제 앱이나 영상 필터에 연결하지 않았고 영상의 시점 간 일관성은 미검증이다. 사용 프롬프트 요약은 같은 폴더 ai-prompt.txt에 저장했다.

캡처/갤러리/결과JSON: 저장소 tmp/realism-comparison. 재현 scripts/realism-matrix.mjs, --materials, --ibl-only. 최종 결과사진10장, PBR 실패를 고친 결과로 갤러리 갱신. 실험 효과는 전용 QA 탭에서만 적용했고 앱 기본 효과는 변경하지 않았다.

검증: 기존49개 테스트 통과. 갤러리 PNG를 utf8이 아닌 Buffer로 제공하도록 보완 후 서버 테스트2개 재통과. 갤러리 이미지 확대 동작 확인.

## 카메라 정면광으로 교체한 두 번째 비교

새 갤러리: http://localhost:5173/render-study-front/
기존 표시번호04·05·06·09의 광원만 카메라 방향 DirectionalLight, intensity1.2, shadowMap.enabled=false / viewer.shadows=false로 교체했다. 다른 효과 값은 유지했다. 재현: node scripts/realism-matrix.mjs --front-revision.
이미지·결과JSON은 tmp/realism-comparison-front. 네 가지 모두 동일한 카메라 좌표/높이42.63361788m, 강도1.2, 그림자끔, shaderReady=true, mapError 비어있음을 검증했다. 나머지6개 원본 PNG는 바이트 단위로 이전 파일과 동일하다. AI 시안도 이전 결과를 재사용했다. 기본 앱/공개배포에는 새 광원을 적용하지 않았다. 갤러리10개 이미지 로딩과 확대 동작 확인.

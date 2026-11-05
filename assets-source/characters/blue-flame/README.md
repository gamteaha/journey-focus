# 사용자 제공 파란 불꽃 캐릭터 원형

2026-11-05 사용자가 제공한 `Downloads/white_mesh.glb`를 변경 없이 보존했습니다.

- SHA-256: `B35D7E333AC37947B8D5D72DBAEC92FB562B5E6A8792069DF9A0210324482C1A`
- 크기: 360,912 bytes
- glTF 2.0 binary, 단일 메시, 정점 10,002개, 삼각형 20,000개
- 위치와 삼각형 인덱스만 포함. 재질·색상·텍스처·UV·관절·애니메이션 없음
- 외부 이미지나 외부 버퍼 참조 없음
- 제작 도구가 기록한 generator: `https://github.com/mikedh/trimesh`

Blender 4.5.15에서 실제 import 및 정면·사선·후면 렌더링을 확인했습니다. 불꽃 머리와 얼굴, 옷, 꼬리의 입체 형상은 존재합니다. 렌더링의 흰색 재질과 조명·배경은 검사 장면에만 적용했으며 원본 GLB는 수정하지 않았습니다.

검사 이미지와 보고서는 로컬 `tmp/white-character-review/`에 있습니다. `tmp/inspect-white-character.py`는 검사를 재현한 임시 스크립트입니다.

## 채색·관절 작업본

- `blue-flame-rigged.blend`: Blender 4.5.15에서 편집 가능한 작업본. 2K 텍스처를 파일 안에 함께 보관합니다.
- `blue-flame-basecolor.png`: 원래 캐릭터의 파란 불꽃·흰 얼굴·노란 볼·재킷을 참고해 표면 위치별로 채색한 UV 아틀라스입니다. 원래 이미지의 텍스처를 복구한 결과가 아닌 재현한 채색입니다.
- `build-character.py`: 원본을 바꾸지 않고 채색, UV, 13개 관절과 정규화한 스킨 가중치, Idle/Walk/Sit 동작을 생성하는 재현 스크립트입니다.
- `rig-info.json`: 높이·관절·동작 정보입니다.
- 실행 파일: `apps/journey-focus/public/models/blue-flame.glb`. 약 1.1MB, 삼각형 20,000개, 텍스처와 동작 포함.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe' --background --factory-startup --python 'assets-source\characters\blue-flame\build-character.py' -- --render
```

실제 게임은 GLTFLoader와 AnimationMixer로 이 파일을 불러옵니다. 기존 승차권의 블루·민트·앰버 선택은 기본 텍스처의 불꽃과 재킷 색을 바꾸며, 얼굴과 볼 색은 유지합니다. 애니메이션 교체 시 짧게 섞고, 앉은 자세는 마지막 프레임을 유지합니다.

관절과 채색은 초기 작업본입니다. 표정 리깅, 손가락, 책 읽기, 정밀한 어깨 변형은 구현하지 않았습니다. 원형의 팔과 몸통이 가까이 붙어 있어 팔 동작 범위를 작게 제한했습니다. 친구 동기화는 이번 작업에 포함되지 않습니다.

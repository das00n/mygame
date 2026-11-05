# 표현 방식 조사 — 덱빌더·파티 던전 게임은 어떻게 보여 주나 (Phase 10, 결정 D8 근거)

> 작성 2026-11-04 · 범위: 덱빌딩 로그라이크 12종 + 문화 고유 화풍 참고 1종의 **표현 방식**(2D/3D·시점·전투 무대·탐험·본진·애니메이션·화풍·UI 비율·엔진과 팀), 그리고 한국 시각 문화 모티프 9가지
> 표기: ❓ = 한 곳에서만 확인했거나 교차 확인 못 함 · ⚠️ = 출처끼리 다름 · (관찰) = 공개 스크린숏·영상에서 본 것으로 글 출처가 없음
> 쓰임: [표현 설계](../10-presentation.md)의 선택지와 추천 근거. 원문·이미지는 싣지 않고 요약과 링크만 남긴다. 개인 이름은 쓰지 않고 역할로 적는다.

---

## 0. 요약 — 추천을 움직인 발견 7가지

| # | 발견 | 근거 | 우리에게 |
|---|---|---|---|
| F1 | **파티·진형 덱빌더의 주류는 2D 측면 무대**다. 아군 왼쪽, 적 오른쪽, 적 머리 위에 의도. 진형이 화면 가로 순서로 곧장 읽힌다 | StS·DD1·AtO·Griftlands. MT는 측면 단면을 층으로 쌓았다 | 선두·중열·후열 = 화면 가로 순서. 학습 비용이 거의 없다 |
| F2 | **DD1은 전투와 탐험을 같은 측면 시점으로 두었다.** 이유는 "화면 전환과 추가 아트 에셋을 줄이려고" | [위키백과 DD](https://en.wikipedia.org/wiki/Darkest_Dungeon) | D7(DD식 탐험)을 고른 우리는 같은 무대·같은 인형을 길목과 전투에 그대로 쓸 수 있다 |
| F3 | **2D 컷아웃(스파인류 뼈대) 애니메이션이 업계 표준**이다. 포토샵으로 그린 부품을 뼈대로 움직인다 | DD1·AtO·Roguebook 공식·개발사 서술, StS2 ❓ | 인형 하나를 부품으로 나누면 러프(코드 SVG) → 본 제작(그린 부품 + 뼈대)으로 구조를 그대로 옮길 수 있다 |
| F4 | **3D로 옮긴 DD2는 팀이 5명에서 14명으로 늘었다.** 손그림 2D 화풍을 3D로 옮기는 일을 "큰 도전"이라 했다 | [위키백과 DD2](https://en.wikipedia.org/wiki/Darkest_Dungeon_II) · [PC Gamer 인터뷰](https://www.pcgamer.com/interview-darkest-dungeon-2s-new-3d-look-monsters-the-narrator-and-its-surprising-aspirational-spirit) ❓ | 3D·2.5D는 같은 범위를 두 배 이상의 인원으로 만든다. 소규모 팀에는 위험 |
| F5 | **아트가 약해도 가독성으로 성공**할 수 있다(StS1). 그러나 개발자 스스로 "그림을 못 그린다"고 인정했고, 2편에서는 아트 디렉터와 전담 애니메이터를 두고 애니메이션·전환·VFX를 크게 늘렸다 | [PCGamesN](https://www.pcgamesn.com/slay-the-spire-2/art-direction) · [Checkpoint](https://checkpointgaming.net/reviews/2019/01/slay-the-spire-review/) | "러프로 먼저 검증 → 확정 뒤 정교화"(10·11단계)는 실제로 성공한 경로다. 러프 단계의 목표는 **예쁨이 아니라 읽힘** |
| F6 | **작은 팀은 제약으로 가독성을 지킨다.** Cobalt Core는 픽셀 해상도 때문에 아이콘·글자를 줄일 수 없어 정보량이 자연히 제한됐고, 화면을 고정한 채 짧고 힘 있는 애니메이션만 썼다 | [Game Developer](https://gamedeveloper.com/design/how-cobalt-core-makes-movement-as-exciting-as-fighting-in-its-roguelike-deckbuilder-combat) | 390px 폰 폭이 우리의 제약이다. 폰에서 읽히는 만큼만 화면에 올린다 |
| F7 | **파티 연계는 연출이 보여 줘야 한다.** CZN은 전투 연출이 화려하고 읽힌다는 평을 받았지만 캐릭터별 컷인이 개인기를 앞세운다(관찰). 3인 공유 덱이라는 구조도 우리와 같다 | [finalboss](https://finalboss.io/chaos-zero-nightmare-looks-incredible-in-battle-but) · [gamingonphone](https://gamingonphone.com/reviews/chaos-zero-nightmare-game-review) | 영웅 1인 컷인 대신 **영웅 사이를 잇는 연출**(받는소리 실, 장단 북, 합기)을 주인공으로 둔다(P1·P5) |

> 문화 쪽 발견: **꼭두의 세 역할(호위·돌봄·연희)이 우리 파티 역할(수호·지원·광대)과 겹친다.** 꼭두는 망자를 저승까지 배웅하는 목인 행렬이다. "망자를 배웅하는 일행"이라는 우리 서사와 그대로 맞는다(§4.4).
> 원귀는 **넋전**(한지로 오린 망자의 몸) 모티프로 그리면 해원 연출(구겨진 종이가 펴지고 떠오른다)과 처치 연출(잿빛으로 구겨진다)이 재료의 성질만으로 갈린다(§4.3).

---

## 1. 한눈에 비교

| 게임 | 차원 | 카메라·시점 | 전투 무대(진형·의도·상태) | 탐험 | 본진·허브 | 애니메이션 | 엔진 · 팀 |
|---|---|---|---|---|---|---|---|
| **Slay the Spire** | 2D | 측면 고정 | 주인공 1명 왼쪽 · 적 오른쪽, 머리 위 의도 아이콘 + **정확한 수치** | StS 층 분기 노드 지도(세로 스크롤) | 없음(시작 이벤트) | 2D 뼈대·트윈(관찰) ❓ | libGDX(Java) · 핵심 2인 + 일러스트 1 |
| **Slay the Spire 2** | 2D | 측면 고정 | 1편 구조 유지, 애니·전환·VFX 확대 | 노드 지도 | 없음 | Spine2D ❓ | Unity → **Godot** 이전 · 아트 디렉터·전담 애니메이터 합류 |
| **Monster Train** | 2D | 측면 **단면 4층**(위에 화로) | 층마다 아군·적 유닛이 마주 선다. 층 = 진형 | 분기 철로 지도 | 메뉴(클랜·언약) | 2D(관찰) | Unity · 소규모(크레딧상 아트 1) |
| **Monster Train 2** | 2D | 같음 | 1편보다 색이 더 튄다. "더 붐빈다"는 이용자 평 | 같음 | 메뉴 | 2D | Unity ❓ |
| **Cobalt Core** | 2D 픽셀 | 위아래로 마주 본 두 함선(관찰) | 함선 부품 줄 단위 조준, 적 다음 행동 표시, 이동 카드로 피하기 | 노드 지도 | 함교(대화) | 픽셀 스프라이트 | FNA/MonoGame(XNA 계열) · Aseprite + Blender · 2~3인 |
| **Darkest Dungeon** | 2D | **측면** — 전투와 탐험 같은 시점 | 4칸 랭크 대 4칸 랭크, 위치가 기술·피격을 정한다. 의도 표시 없음 | **측면 횡스크롤 복도 + 방 지도**, 횃불 빛 0~100 | 햄릿(한 장의 마을 그림, 건물 클릭) | 포토샵 그림 + **Spine** | 자체 엔진 · 핵심 6 + 사운드·음악·내레이션 3 |
| **Darkest Dungeon II** | 2D 인물 + **3D** 환경(하이브리드) | 길: 3D 마차 주행 / 전투: 측면 | 4칸 랭크 유지 | **3D 도로를 마차로 달린다**, 마차 등불이 희망 | 여관(구간 사이) · **희망의 제단**(메타, 투자할수록 왕국 풍경이 복원) | 2D 인물 + 3D | Unity · 5명 → 14명 |
| **Across the Obelisk** | 2D | 측면 | 영웅 4 왼쪽 · 적 오른쪽 | 노드 지도 + 마을(상점) | 마을·메뉴 | 포토샵 + **Spine**, 일부 프레임 애니 | Unity ❓ · 소규모 |
| **Roguebook** | 2D 전투 + 3D풍 지도 ❓ | 측면 전투 / 육각 지도 | 영웅 2명 앞뒤 교대 | **잉크·붓으로 지워 여는 육각 지도**("백지 위 전승서") | 책(해금 트리) | **Spine**(개발자 포럼) | Unity ❓ · Abrakam |
| **Gordian Quest** | 3D 인물 ❓ | 비스듬한 전투 격자 | 아군·적이 작은 격자 위에 선다. 이동에 AP | 노드 지도(월드) | 캠페인 거점 | 3D ❓ | Unity + Maya ❓ |
| **Inscryption** | 3D + 픽셀 + 실사 | **1인칭** — 오두막 탁자 맞은편 | 탁자 위 4칸 레인 카드 대결 | 탁자 위 지도·방 탐색(1인칭) | 없음 | 3D·픽셀 혼합 | Unity · 1인 중심 |
| **Balatro** | 2D 픽셀 + 셰이더 | 정면 탁자 | 포커 손패 + 점수 계산 연출 | 없음(블라인드 선택) | 없음 | 트윈 + 소용돌이 배경 셰이더 | LÖVE(Lua) · **1인** |
| **Wildfrost** | 2D | 정면 보드 | **2레인 × 3칸**(적과 거울), 유닛마다 카운터 | 노드 지도 | **스노드웰 마을**(건물을 지어 해금) | 2D 카툰 | Unity · 소규모 |
| **Chaos Zero Nightmare** | 2D 스프라이트 ❓ | 측면 ❓ | 3인 공유 덱, 화려한 공격 컷신 | — | 가챠 RPG 메뉴 | 애니메 컷신 | ❓ · PC(STOVE)·모바일, F2P |
| *추가* **Griftlands** | 2D | 측면 | 주인공 + 고용 동료 | 지도·이벤트 | — | 손그림 애니메이션, 칠한 배경 | Klei |
| *추가* **Pentiment** | 2D | 측면 패럴랙스 | (덱빌더 아님) | 마을 횡이동 | — | 판화·채식 필사본 화풍 | Obsidian · 학자 자문 |

---

## 2. 게임별 상세

### 2.1 Slay the Spire (2017 앞서 해보기 · 2019 정식)
- **표현**: 2D 측면 고정 무대. 주인공 왼쪽, 적 오른쪽. 의도는 처음에 "다음 턴" 문장이었다가 **아이콘 의도**로 바뀌었고, 플레이테스터들이 **정확한 수치**를 더 좋아했다 ([위키백과](https://en.wikipedia.org/wiki/Slay_the_Spire)).
- **탐험**: 층마다 분기 노드 지도. FTL에서 영향 ([위키백과](https://en.wikipedia.org/wiki/Slay_the_Spire)).
- **기술·팀**: libGDX(Java). 개발 2인 + 카드·이벤트 일러스트 1인 ([위키백과](https://en.wikipedia.org/wiki/Slay_the_Spire)).
- **평**: "기능적이지만 아름답지는 않다"([Checkpoint](https://checkpointgaming.net/reviews/2019/01/slay-the-spire-review/)), Wildfrost 리뷰는 "Spire의 화풍은 기껏해야 기능적"([Prima](https://primagames.com/?p=319908)). 공동 창업자 겸 프로그래머가 "그림을 못 그린다"며 원작 비주얼의 문제를 인정했다 ([PCGamesN](https://www.pcgamesn.com/slay-the-spire-2/art-direction)).
- **UI : 장면** — 장면 약 60 : UI 40 (관찰). 손패·에너지·더미가 아래와 양옆을 차지한다.

### 2.2 Slay the Spire 2 (2026-03-05 앞서 해보기)
- 2년 넘게 Unity로 만들다가 2023년 Unity 요금 정책 논란 뒤 **Godot으로 옮겼다** ([위키백과](https://en.wikipedia.org/wiki/Slay_the_Spire_II) · [PC Gamer](https://www.pcgamer.com/games/card-games/slay-the-spire-2-ditched-unity-for-open-source-engine-godot-after-2-years-of-development)).
- 아트 디렉터와 전담 애니메이터가 합류했다. 방향: "훨씬 많은 애니메이션과 전환", "VFX를 많이", "더 선명하고 덜 회화적인" 디자인, 원작의 "조금 으스스하지만 재미있는" 분위기 유지 ([PCGamesN](https://www.pcgamesn.com/slay-the-spire-2/art-direction)).
- 애니메이션 도구가 Spine2D라는 서술은 한 곳뿐이다 ❓ ([G2A 첫인상](https://www.g2a.com/news/features/slay-the-spire-2-early-access-first-impressions/)). 앞서 해보기 빌드에는 일부 카드·아이템에 **임시 아트**가 들어 있다 ([위키백과](https://en.wikipedia.org/wiki/Slay_the_Spire_II)).
- **우리에게**: 규칙이 먼저 완성되고 아트가 뒤따른 사례. 임시 아트를 공개 빌드에 두는 것도 업계에서 받아들여진다.

### 2.3 Monster Train 1·2 (2020 · 2025)
- **표현**: 기차 단면을 **세로 4층**으로 쌓은 측면 무대. 맨 위층이 지켜야 할 화로이고, 아래 3층에 유닛을 배치한다 ([위키백과](https://en.wikipedia.org/wiki/Monster_Train)). 층마다 아군과 적이 마주 서므로 "층 = 진형"이 화면 구조 그 자체다.
- **화풍**: Hearthstone의 만화풍과 MTG의 사실풍 사이의 일러스트 2D ([Capsule Computers](https://www.capsulecomputers.com.au/?p=307594)). 1편은 "색과 애니메이션의 불협화음"이라는 비판도 있었다 ❓.
- **2편**: 화풍은 크게 바뀌지 않고 색이 더 튄다 ([Gamer Social Club](https://gamersocialclub.ca/2025/05/21/monster-train-2-review)). "더 붐벼서 요소를 구분하기 어렵다"는 이용자 의견 ❓ ([Tildes](https://tildes.net/~games/1n2r/monster_train_2_release_date_trailer_coming_may_21)).
- **기술**: Unity ([위키백과](https://en.wikipedia.org/wiki/Monster_Train)). 크레딧상 아트 담당 1인.
- **우리에게**: 진형을 **화면 구조로** 보여 주면 설명이 필요 없다. 다만 유닛·효과가 늘면 붐빈다 → 상태 표시 상한이 필요하다.

### 2.4 Cobalt Core (2023)
- **표현**: 픽셀 아트. 플레이어 함선과 적 함선이 마주 보고, 함선은 **부품의 1차원 줄**이다. 이동 카드로 줄을 밀어 적 공격을 피하고 약점을 겨눈다. 적의 다음 행동이 보인다 ([위키백과](https://en.wikipedia.org/wiki/Cobalt_Core) · [Game Developer](https://gamedeveloper.com/design/how-cobalt-core-makes-movement-as-exciting-as-fighting-in-its-roguelike-deckbuilder-combat)).
- **가독성 방법**(Game Developer 인터뷰):
  - 픽셀 해상도 때문에 "아이콘이나 글자를 줄여서 해결할 수 없었고", 그래서 디자인이 붐비지 않았다.
  - Into the Breach처럼 정보는 많아도 한눈에 읽히게 한다.
  - 함선 실루엣으로 부품 종류를 알린다. 아이콘·상태가 들어갈 빈자리를 미리 둔다.
  - 화면은 고정하고, 그 안에서 애니메이션과 소리로 타격감을 낸다. 카드 숫자는 거의 한 자리.
- **기술·팀**: XNA 계열(FNA/MonoGame) 자체 엔진, Aseprite·Blender, VS Code. 핵심 2인 + 작곡 1인. 첫 시제품은 Tabletop Simulator.
- **평**: Metacritic 94. 픽셀 초상화·함선 디자인 호평, "흔한 레트로 픽셀"이라는 소수 의견 ([PC Gamer](https://www.pcgamer.com/cobalt-core-review/) · [Rogueliker](https://rogueliker.com/cobalt-core-review)).
- **우리에게**: 3인 공유 덱 + 승무원 "실종"이라는 가장 가까운 규칙 선례이면서, **제약으로 가독성을 지킨** 표현 선례.

### 2.5 Darkest Dungeon (2016)
- **표현**: **측면 시점을 전투와 탐험 모두에** 썼다. "전환과 추가 아트 에셋을 줄이는 방법"이었다 ([위키백과](https://en.wikipedia.org/wiki/Darkest_Dungeon)). 영웅 4명이 랭크에 서고, 앞쪽은 근접·피격, 뒤쪽은 원거리.
- **탐험**: 파티가 방과 복도를 **측면으로 횡스크롤**한다. 화면 구석의 던전 지도로 방을 고르고, 복도 칸(1~8칸)은 상태·빛 기준으로 한 라운드다. 빛 0~100은 새 칸에서 더 빨리 준다 ([DD 위키 — 빛](https://darkestdungeon.wiki.gg/wiki/Light_Meter) · [던전 지도](https://darkestdungeon.wiki.gg/wiki/Corridor)).
- **화풍**: 목판화와 채식 필사본의 모습, 르네상스 판화와 동유럽 회화, 현대 만화가들 ([위키백과](https://en.wikipedia.org/wiki/Darkest_Dungeon)). 아트 디렉터는 "오래되고 닳은" 느낌을 원했다. 짙게 고인 검정·거친 채색·평면적 스타일이 메커닉(빛)과 분위기를 받친다 ([Game Developer — IGF](https://www.gamedeveloper.com/audio/road-to-the-igf-red-hook-studios-i-darkest-dungeon-i-)).
- **애니메이션**: 포토샵으로 그리고 **Spine**으로 움직였다 ([Game Developer — IGF](https://www.gamedeveloper.com/audio/road-to-the-igf-red-hook-studios-i-darkest-dungeon-i-)). 공격 순간 카메라가 확 다가가 정지 자세로 끊어 보여 준다(관찰) ❓. 이 "카메라 밀기로 정지 자세를 감춘다"는 기법을 따라 한 사례가 있다 ([사례 글](https://community.articulate.com/blog/articles/how-i-built-this-grim-depths-%E2%80%94-a-jrpg-prototype-in-storyline-360/1240130/replies/1242001)).
- **본진**: 햄릿은 한 장의 마을 그림에 건물을 눌러 들어가는 구조 ([위키백과](https://en.wikipedia.org/wiki/Darkest_Dungeon)). 업그레이드가 마을 풍경을 얼마나 바꾸는지는 ❓.
- **기술·팀**: 경량 자체 엔진. 2015년 핵심 6인 + 사운드·음악·내레이션 3인. IGF 시각 예술상 후보 ([위키백과](https://en.wikipedia.org/wiki/Darkest_Dungeon)).
- **우리에게**: D7의 원형. 측면 무대 하나로 **길목·방·전투**가 모두 해결된다. 단, 의도 표시가 없다는 점은 StS 쪽을 따른다.

### 2.6 Darkest Dungeon II (2021 앞서 해보기 · 2023 정식)
- **표현**: 인물·전투는 2D 모습을 지키고 환경은 3D로 옮긴 **하이브리드** ([PC Gamer](https://www.pcgamer.com/interview-darkest-dungeon-2s-new-3d-look-monsters-the-narrator-and-its-surprising-aspirational-spirit) 검색 요약 ❓). 리뷰는 두꺼운 선 화풍이 3D로 잘 넘어왔다고 평했다 ❓.
- **탐험**: **마차**가 세계를 다니는 주된 수단이다. 마차의 불꽃이 파티의 희망이고, 꺼질수록 불리하다 ([위키백과](https://en.wikipedia.org/wiki/Darkest_Dungeon_II)).
- **허브**: 구간 사이에 여관. 메타 진행은 **희망의 제단** — 투자할수록 왕국 풍경이 점점 복원된다 ([DD 위키 — 희망의 제단](https://darkestdungeon.wiki.gg/wiki/Altar_of_Hope) · [PC Gamer](https://www.pcgamer.com/big-darkest-dungeon-2-update-introduces-progression-system-and-hero-memories)).
- **기술·팀**: Unity로 2D → 3D 전환. 팀 5명 → 14명 ([위키백과](https://en.wikipedia.org/wiki/Darkest_Dungeon_II)). 아트 디렉터는 손그림 2D를 3D로 옮기는 일이 큰 도전이었다고 했다 ❓.
- **평**: Steam 75%(DD1 90%). 표현보다 메타·구조가 논쟁거리였다.
- **우리에게**: 3D는 **인원을 크게 늘려야** 했다. "투자하면 풍경이 복원된다"는 허브 연출은 P6(자라는 본진)의 좋은 근거다.

### 2.7 Across the Obelisk (2021 · 2022 정식)
- **표현**: 측면 무대에 영웅 4명 대 적. 노드 지도와 마을(상점).
- **애니메이션**: 2D 아트를 포토샵으로 그리고(일부 프레임 애니메이션 포함) **대부분 Spine**으로 움직였다. 소규모 팀(디자이너·UI 아티스트·2D 아티스트·아트 리드·프로듀서·Unity 개발자)이 압축된 일정으로 DLC 하나를 만든 사례 ([N-iX 사례](https://gamestudio.n-ix.com/case-study/across-the-obelisk-dlc/)).
- **평**: "최상급 비주얼·애니메이션"([Softpedia](https://www.softpedia.com/reviews/games/pc/across-the-obelisk-review-536823.shtml))과 "플래시 애니메이션 같다·흔한 판타지"가 갈린다 ([OpenCritic](https://www.opencritic.com/game/13580/across-the-obelisk)) ⚠️.
- **우리에게**: Spine 컷아웃은 저렴하지만, 화풍에 개성이 없으면 "플래시 같다"는 평을 받는다. **재료감(한지·목인)이 그 개성을 맡아야** 한다.

### 2.8 Roguebook (2021)
- **표현**: 영웅 2명의 덱을 합친 공유 덱. 전투는 측면, 탐험은 **전승서의 빈 페이지 같은 육각 지도**를 전투에서 얻은 잉크와 붓으로 칠해 연다 ([Checkpoint](https://checkpointgaming.net/reviews/2021/06/roguebook-review-great-card-battles-to-pass-the-time/) · [위키백과](https://en.wikipedia.org/wiki/Roguebook)). StS 분기 지도와 다르게 하려고 열린 지도로 만들었다.
- **애니메이션**: 대부분 Spine ([개발자 포럼 글](https://ko.esotericsoftware.com/forum/d/15383)) ❓. 엔진 Unity ❓(제3자 목록).
- **평**: 화풍이 "밝고 개성 있다", 잉크 공개가 가끔 어긋난다 ([PSU](https://www.psu.com/reviews/roguebook-ps5-review/)).
- **우리에게**: **"그려서 드러나는 지도"** — 넋등 빛이 닿는 만큼 한지 지도가 드러나는 표현의 선례.

### 2.9 Gordian Quest (2022)
- **표현**: 아군·동맹·적이 **작은 격자** 위에 서고 이동에 AP가 든다. 월드는 노드 네트워크(전투·탐색·휴식·이야기) ([Gaming Trend](https://gamingtrend.com/gordian-quest-review-deckbuilding-dungeons-and-dice/) · [Checkpoint](https://checkpointgaming.net/reviews/2022/06/gordian-quest-review-thieves-zombies-and-plenty-of-adventure/)).
- **기술**: Unity, 모델링·애니메이션 Maya ❓ ([WN Hub 인터뷰](https://wnhub.io/news/marketing/item-297)).
- **평**: 화풍·전투 애니메이션 호평. 인터페이스가 직관적이지 않다는 지적.
- **우리에게**: 3D 인물 + 격자는 위치 규칙이 복잡할 때 의미가 있다. 우리 진형은 **한 줄 3칸**이라 격자가 필요 없다.

### 2.10 Inscryption (2021)
- **표현**: 1막은 **1인칭** — 오두막 탁자 맞은편의 상대와 카드 대결. 2막은 위에서 본 픽셀 RPG, 3막은 방 격자. 전체로 3D·픽셀·손그림·실사를 섞었다 ([위키백과](https://en.wikipedia.org/wiki/Inscryption)).
- **평**: "90년대 플로피 디스크 게임의 저주받은 환생"(Eurogamer), 초반의 기괴한 분위기 극찬, 후반에는 그 느낌이 옅어진다는 평 ([위키백과](https://en.wikipedia.org/wiki/Inscryption)).
- **기술·팀**: Unity, 1인 중심 개발.
- **우리에게**: 탁자·1인칭은 **분위기**에 강하다. 그러나 파티가 화면에 몸으로 서지 않는다 → P3(몸이 있는 카드)·P4(애착)와 맞지 않는다.

### 2.11 Balatro (2024)
- **표현**: 정면 탁자. 손패와 점수 계산이 화면의 전부다. "레트로 VCR 같은 비주얼"([위키백과](https://en.wikipedia.org/wiki/Balatro)). 소용돌이 배경은 셰이더 하나로 그린다(팬이 원본 코드에서 옮긴 셰이더가 공개돼 있다 [Godot Shaders](https://godotshaders.com/shader/balatro-paint-mix/)). CRT 효과 설정은 ❓.
- **기술·팀**: LÖVE(Lua), **1인 개발**. 음악은 외주 1인.
- **우리에게**: **셰이더 하나·트윈 몇 개**로 화면 전체의 손맛을 만든 사례. 러프 단계의 CSS 변형 연출도 같은 원리다.

### 2.12 Wildfrost (2023)
- **표현**: 정면 보드. 아군 6칸(**2레인 × 3**)이 적 6칸과 거울처럼 마주 보고, 유닛마다 턴 카운터가 있다 ([위키백과](https://en.wikipedia.org/wiki/Wildfrost)).
- **허브**: **스노드웰** — 런 사이에 돌아와 건물을 지어 카드·부족·이벤트를 해금한다 ([Steam](https://store.steampowered.com/app/1811990/Wildfrost) · [팬 위키](https://wildfrostwiki.com/Snowdwell)).
- **평**: 카툰 화풍 극찬("개성이 넘친다"). "Spire는 기능적, Wildfrost는 쇼를 훔친다"([Prima](https://primagames.com/?p=319908)). 귀여운 외형과 높은 난도의 대비가 화제였다.
- **기술**: Unity.
- **우리에게**: 허브가 **자라는 마을**로 보이는 선례(P6). 귀엽거나 아기자기한 외형이 어려운 게임을 가리지 않는다.

### 2.13 Chaos Zero Nightmare (2025-10) — 반면교사
- **표현**: 3인 공유 덱, 화려한 애니메 컷신 공격, "탄력 있는" 캐릭터 스프라이트 ❓ ([Playday](https://playday.one/2025/12/01/chaos-zero-nightmare-review)). 버프·디버프가 겹겹이 쌓여도 전투 UI는 읽힌다 ([gamingonphone](https://gamingonphone.com/reviews/chaos-zero-nightmare-game-review)).
- **평**: "전장은 프리미엄, 연결부는 싸구려" — 기본 UI·스플래시 아트·비주얼 노벨식 이야기 장면의 완성도가 전투보다 낮다 ([finalboss](https://finalboss.io/chaos-zero-nightmare-looks-incredible-in-battle-but)).
- **플랫폼**: PC(STOVE)·모바일, F2P 가챠.
- **우리에게**:
  - 표현 측면의 교훈은 두 가지다. ① 전투만 공들이고 **본진·이야기 화면을 방치하지 않는다**(우리 본진은 P6 기둥이다). ② 캐릭터 1인 컷인은 개인기를 보여 줄 뿐 **연계를 보여 주지 않는다**.
  - 사용자가 지적한 "파티 연계 부재"는 [시스템 조사](systems-reference.md) §2.3에서 구조 문제로 해석했다(언론 문장은 찾지 못했다 ❓).

### 2.14 추가 — Griftlands (2021)
- 측면 무대, 손그림 애니메이션 인물 + 칠한 배경. 인물의 몸짓·표정이 대사를 받친다는 호평과 "전투가 밋밋하다"는 평 ([PC Gamer](https://pcgamer.com/griftlands-review) · [Engadget](https://www.engadget.com/2017/06/12/dont-starve-sci-fi-rpg-gritty-cartoon/)).
- **우리에게**: 2D 측면에서도 인물 연기가 애착을 만든다. 같은 Klei의 손그림 파이프라인은 비싸다(관찰).

### 2.15 추가 — Pentiment (2022): 문화 고유 화풍을 게임 화면으로
- 16세기 채식 필사본과 목판화를 화풍으로 삼았다. 아트 디렉터는 필사본 영인본과 디지털 컬렉션으로 얼굴·장면·색을 연구했고, 중세사 **학자 자문**이 아트에도 의견을 냈다 ([Game Developer](https://www.gamedeveloper.com/art/deep-dive-the-art-of-pentiment) · [Gamereactor](https://www.gamereactor.eu/the-history-behind-pentiment-and-the-creation-of-its-artistic-style-1191273/) · [Inverse](https://inverse.com/gaming/pentiment-game-art-interview)).
- 원전의 제약이 화면을 정했다: 목판화 인물은 거의 **정면이나 3/4 측면**이고, 화면 "안쪽으로 걸어 들어가는" 각도는 그리기 어려웠다.
- **우리에게**: 무신도·꼭두·넋전도 정면·측면의 평면 도상이다. **2D 측면 무대가 원전의 시각 문법과 맞는다.** 자문(감수)을 아트 단계에서 받는다는 계획의 선례이기도 하다.

### 2.16 추가 — Chaos Zero Nightmare 화면 배치 (PC · 2026-11-05)

> D8 결정과 함께 받은 지시: CZN 의 파티 연계 설계는 반면교사(§2.13)지만 **PC 화면 배치**(전투 HUD · 손패 · 캐릭터 판 · 적 정보 · 턴·자원 · 허브)는 참고한다. 화면 위치를 글로 적은 출처가 드물다 — 글 출처로 확인한 것과 공개 스크린숏·영상에서 본 것((관찰) ❓)을 나눈다.

| 요소 | 확인한 것 | 출처 |
|---|---|---|
| 행동력(AP) | 매 턴 3, 카드마다 AP 비용. 적을 격파하면 AP 1 | [Prydwen 전투 기초](https://www.prydwen.gg/chaos-zero-nightmare/guides/combat-explained) ❓(검색 요약만, 본문 접근 거부) · [플레이포럼](https://www.playforum.net/news/curationView.html?idxno=632939) · [공식 효과 사전](https://kazena.co.kr/glossary) |
| 손패 | 턴마다 5장, 최대 10장. 보존 없는 카드는 턴 끝에 무덤으로 | 플레이포럼 · [ifanzine](https://www.ifanzine.com/chaos-zero-nightmare-combat/) |
| 뽑을 더미 · 무덤 | **뽑을 더미는 UI 왼쪽, 무덤(버린 더미)은 오른쪽** — 무덤 칸에 버린 수와 이번 턴 쓴 카드 | [itemlevel](https://itemlevel.net/chaos-zero-nightmare-combat-guide/) |
| 공용 게이지 | 파티의 EP(에고) 게이지가 **전장 아래**에 있다. 전투 사이에 이어진다 | itemlevel |
| 적 정보 | 적마다 **체력 막대 옆에 행동 카운트**(그 적이 움직이기까지 남은 카드 사용 수), 그 **아래 아이콘이 다음 행동**(예상 피해 포함), 강인도 막대는 체력 막대 아래, 약점 속성 아이콘은 행동 카운트 옆 | itemlevel · ifanzine · 공식 효과 사전 |
| 의도 종류 | 단일 공격 · 다단 공격 · 상태 이상 · 스트레스 등 | [Prydwen 베타 분석](https://blog.prydwen.gg/?p=12320) ❓(검색 요약만) |
| 아군 판 | 전투원마다 정신력(스트레스) 게이지. 피해는 붉게, 스트레스는 보라로 | itemlevel ⚠️ — 한 가이드는 "파티가 체력 막대 하나를 나눈다"고 적었다 |
| 전장 | 전투원 셋이 왼쪽, 적이 오른쪽에 측면으로 선다. 손패는 아래 가운데에 부채꼴, 턴 종료는 오른쪽 아래 | (관찰) ❓ |
| 연출 | 에고 스킬(캐릭터별 컷신)이 전장을 덮는다. 전투 연출은 화려하고 읽힌다는 평 | 플레이포럼 캡션 · [finalboss](https://finalboss.io/chaos-zero-nightmare-looks-incredible-in-battle-but) · §2.13 |
| 허브(로비) | 캐릭터 일러스트를 배경으로 한 한 장 화면 + 메뉴. 호감도를 올리면 특별 로비 일러스트를 연다 | [GameWith 호감도](https://gamewith.net/chaoszeronightmare/71516) ❓(검색 요약만) · (관찰) |
| 평 | UI는 간결하지만 툴팁·메뉴는 덜 다듬어졌다. 연결부(기본 UI·스플래시)가 전투보다 낮다 | [gamingonphone](https://gamingonphone.com/reviews/chaos-zero-nightmare-game-review/) · finalboss |

**우리에게** (따른 것 · 버린 것은 [표현 설계](../10-presentation.md) §4.9)
- 따른다: 위 전장 · 아래 손패 띠의 두 단, 왼쪽 아래 자원(에너지)과 뽑을 더미, 오른쪽 아래 턴 종료, 전장 아래 공용 게이지(우리는 장단 북 · 받는소리), 적 정보를 몸 아래 체력 막대 둘레에 모으기, 아군마다 체력 + 정신력(귀기) 막대, 허브를 한 장의 장면 + 메뉴로.
- 버린다: 캐릭터 1인 컷신이 전장을 덮는 연출(연계와 정보를 가린다, X5), 캐릭터 일러스트 중심 로비(우리 허브는 자라는 마을, P6), 행동 카운트(우리 규칙이 아니다), 파티 공유 체력(쓰러짐·사망이 영웅마다).

---

## 3. 비교에서 나온 패턴

| # | 패턴 | 사례 | 저승굿 적용 |
|---|---|---|---|
| V1 | **진형 = 화면의 가로 순서** | StS·DD·AtO, MT(층) | 후열 → 중열 → 선두 → 굿상 → 원귀(앞 → 뒤)를 왼쪽부터 |
| V2 | **의도는 머리 위, 정확한 숫자** | StS(아이콘 → 수치), CC | 의도 배지 = 행동 그림 + 수치 + **대상 칸**(우리만의 정보). 대상 영웅과 선으로 잇는다 |
| V3 | **전투·탐험 같은 무대** | DD1 | 길목 = 같은 측면 무대를 걷는다. 방에 들어서면 그 자리가 전투가 된다 |
| V4 | **빛 = 화면의 어둠** | DD1 횃불, DD2 마차 등불 | 넋등 5구간을 무대의 비네트·앞쪽 어둠으로 보여 준다 |
| V5 | **2D 컷아웃 뼈대 애니메이션** | DD1·AtO·Roguebook | 러프: 부품별 SVG + CSS 변형 → 본: 그린 부품 + Spine 뼈대 |
| V6 | **자라는 허브가 보인다** | DD2 제단(풍경 복원), Wildfrost 마을 | 마을 파노라마: 시설이 서면 건물·사람·금줄·솟대가 는다 |
| V7 | **제약이 가독성을 지킨다** | CC 픽셀 해상도 | 390px 폰에서 읽히는 정보만 무대에 올리고, 나머지는 무대 밑 목록으로 |
| V8 | **문화 원전의 시각 문법을 따른다** | Pentiment | 무신도·꼭두·넋전의 평면 정면·측면 도상 → 측면 무대 |

| # | 안티패턴 | 사례 | 대응 |
|---|---|---|---|
| X1 | 전투만 공들이고 본진·이야기를 방치 | CZN | 마을·사당·계보도도 같은 무대 문법으로 그린다 |
| X2 | 색·효과 과잉으로 붐빔 | MT1 비판, MT2 이용자 평 | 상태 칩은 원귀마다 최대 3개 + "더 보기", 효과는 한지·먹 톤 위에 오방색 강조만 |
| X3 | 개성 없는 컷아웃 = "플래시 같다" | AtO 일부 평 | 재료감(한지 결·목인 칠·먹선)과 실루엣 규칙으로 개성을 만든다 |
| X4 | 3D 전환으로 팀이 커짐 | DD2(5 → 14명) | 3D는 본 제작 범위를 두 배 이상 키운다 — 추천에서 뺀다 |
| X5 | 1인 컷인이 연계를 가린다 | CZN(관찰) | 연출의 주인공은 영웅 사이의 **실·장단** |

---

## 4. 한국 시각 문화 — 게임이 빌릴 수 있는 모티프

공통 원칙: **도상을 복제하지 않고 재료·구도·색의 문법만 빌린다.** 실제 무신도·명도 도상, 실존 신령의 얼굴, 지정 굿의 의례 순서를 그대로 그리지 않는다([무속 지식 정리](lore/shamanism-primer.md) §8.4).

### 4.1 무신도(巫神圖) — 무당이 모시는 신령 그림
- **생김새**: 무속에서 섬기는 신의 형상을 그린 그림. 신당 정면 벽에 여러 폭을 걸고 그 앞에 신단을 차린다. 현존 가장 오래된 예로 꼽히는 제주 내왓당 무신도는 광물성 안료·먹·부분 금박으로 한지에 그렸고, 신마다 **얼굴에 붉은 점**이 있으며 대부분 부채를 든다. 펄럭이는 옷자락에 움직임이 있다 ([위키백과 — 내왓당 무신도](https://en.wikipedia.org/wiki/Naewat-dang_shamanic_paintings) · [서울시 미디어허브 — 금성당 샤머니즘박물관](https://mediahub.seoul.go.kr/archives/1161804)). 화려한 색, 관복·갑옷 복식, 과장된 눈의 정면 시선이 특징이라는 서술 ❓(검색 요약).
- **게임에서**: 영웅의 **볼 붉은 점**·평면 채색(러프 인형에 이미 적용), 신령(굿상 설치물)·가호 카드의 액자형 구도, 사당 화면의 위패 뒤 벽.
- **주의**: 무신도는 **신의 얼굴로 모셔지는 신체(神體)**다. 실제 무신도를 본뜨지 않는다. 신령은 모두 가상 이름이고 적으로 쓰지 않는다. 참고 도록은 서지 K56·EN04([서지](lore/bibliography.md)).

### 4.2 민화(民畵)
- **생김새**: 조선 후기 떠돌이·무명 화가의 생활 그림. 까치호랑이(어리숙한 호랑이 = 권세, 까치 = 서민), 십장생, 책거리. 원색, 투박한 붓질, 캐리커처 같은 과장, 해학과 풍자. 대문에 걸어 복을 빌고 액을 막았다 ([위키백과 — Minhwa](https://en.wikipedia.org/wiki/Minhwa)).
- **게임에서**: 마을 화면과 **해학 장면**(사자 검문 놀이 싸움, 탈꾼, 대감 가호)의 화풍. 배경의 산·구름·소나무는 원근보다 **겹 평면**으로.
- **주의**: 해학은 원전에 있는 만큼만(무속 지식 정리 §8.3). 무당·재가집을 조롱하는 캐리커처로 쓰지 않는다.

### 4.3 넋전(넋) — 한지로 오린 망자의 몸
- **생김새**: 흰 한지를 사람 모양으로 오린 망자의 **신체**. 의례 중 망자와 동일시한다. 진도 씻김굿에서 약 20cm ([국가민속대백과 — 넋](https://folkency.nfm.go.kr/kr/topic/detail/1878) · [진도씻김굿](https://folkency.nfm.go.kr/kr/topic/detail/2854)). 종이 사람 형상의 넋을 돗자리에 말아 씻기고, 넋을 꺼내 원혼이 떠났는지 보는 '넋올리기'가 이어진다 ([주간경향](https://weekly.khan.co.kr/article/13558)). 제주에서는 신을 나타내는 오린 종이를 '기메'라 한다 ([위키백과 — 내왓당](https://en.wikipedia.org/wiki/Naewat-dang_shamanic_paintings)).
- **게임에서**: **원귀의 기본 실루엣**(한지 결·오림 술·빈 눈). 해원 = 구겨진 종이가 펴지고 한(恨)의 빛깔이 빠져 하얗게 떠오른다. 처치 = 잿빛으로 안으로 구겨진다. 쓰러진 영웅 위에 떠 있는 **작은 넋**(넋 부르기)도 같은 재료다.
- **주의**: 넋은 실제 의례에서 **망자 그 자체**다. 찢기·불태우기·짓밟기 같은 훼손 연출을 피하고, 처치도 "구겨져 주저앉음"까지만. 넋당석·길베·지전 같은 관련 무구는 [무속 지식 정리](lore/shamanism-primer.md) §6.

### 4.4 꼭두 — 상여를 장식하는 목인(木人)
- **생김새**: 상여에 올린 채색 나무 인형. 사람·영물·신선의 모습. 약 한 자(30cm) 높이로 상여 네 면에 무리 지어 놓았다. 역할은 세 가지:
  - **호위** — 행렬 맨 앞, 말·호랑이를 탄 엄한 얼굴의 무사. 망자를 이끌고 악귀를 쫓는다.
  - **돌봄** — 살아 있을 때처럼 보살피는 시종(여성·부부·승려·무당·저승사자 모습).
  - **연희** — 재주꾼·악사. 망자와 유족을 위로한다.
  
  시대에 따라 조선 무관 → 일제강점기 경찰 → 해방 뒤 군인으로 차림이 바뀌었다. 슬픔을 "축제 같은 행렬"로 바꾸려는 **장난스럽고 익살맞은** 조형이다 ([위키백과 — Kkoktu](https://en.wikipedia.org/wiki/Kkoktu) · [코리아타임스](https://www.koreatimes.co.kr/amp/lifestyle/arts-theater/20241031/kokdu-koreas-whimsical-companions-for-souls-final-voyage-to-afterlife) · [코리아중앙데일리 — 국립민속박물관 전시](https://www.koreajoongangdaily.com/lifestyle/national-folk-museum-assembles-hundreds-of-traditional-dolls-for-kokdu-exhibition/12404358)).
- **게임에서**: **영웅의 조형 언어.** 세 역할이 우리 파티(수호 = 승려·차사, 돌봄·지원 = 만신·법사·잽이, 연희 = 잽이·탈꾼)와 겹친다. 원귀를 배웅하는 일행이 곧 꼭두 행렬이다. 목인이라 **딱딱한 움직임이 결점이 아니라 특징**이 되고(컷아웃 애니메이션 비용↓), 쓰러짐은 "인형이 넘어진다"로 피 없이 표현된다.
- **주의**: 실제 꼭두 소장품의 얼굴·형태를 복제하지 않는다. 일제강점기 경찰 같은 시대 차림은 쓰지 않는다(가상 조선풍).

### 4.5 지화(紙花) — 종이꽃
- **생김새**: 한지로 만든 꽃(모란·국화·연꽃 등). 불교 의례·무속·민간 행사에 썼다. 무속에서는 **신화(神花)**라 부르며 사람과 신을 잇는 매개로 여겼고, 의례 뒤 태웠기 때문에 옛 기록이 적다 ([코리아타임스](https://www.koreatimes.co.kr/amp/lifestyle/koreanheritage/20150415/jihwa-paper-flowers)). 동해안별신굿에서는 굿상 뒤에 지화를 병풍처럼 둘러 신을 모신 꽃밭으로 꾸민다 ([경북매일](https://kbmaeil.com/article/202409180405625) · [더럼대 워크숍 안내](https://pay.durham.ac.uk/event-durham/musicon-concert-songs-beneath-the-sacred-tree)). 서울굿 지화는 신을 받치고·부르고·놀리고·보내는 매개라는 연구 ❓(초록).
- **게임에서**: 굿상·굿청의 **틀(프레임)**, 해원 순간의 꽃잎 연출, 마을의 성장 장식.
- **주의**: 지화는 불교 의례에도 많다 — 굿청과 절 장엄을 섞지 않는다.

### 4.6 오방색
- **생김새**: 청(동·목) · 적(남·화) · 황(중앙·토) · 백(서·금) · 흑(북·수). 다섯 색의 균형이 건강한 삶에 필요하다고 여겼다. 공예·의복·건축·악기·깃발·음식에 쓴다 ([위키백과 — Obangsaek](https://en.wikipedia.org/wiki/Obangsaek)). 무구 **오방신장기**는 빨강 재수 · 흰색 명복 · 노랑 조상 · 파랑 우환 · 검정 죽음이다 ([국가민속대백과 — 오방신장기](https://folkency.nfm.go.kr/kr/topic/detail/2577)).
- **게임에서**: 영웅 색은 이미 오방색 계열이다(플레이어블 `HERO_COLOR`). 의도 깃발 색(공격 = 적, 이동 = 황, 귀기 = 청), 오방기 보상, 금줄 장식. 바탕은 먹·쪽빛·한지로 눌러 두고 **오방색은 강조에만** 쓴다(안티패턴 X2).
- **주의**: 검정기는 실제 굿에서 거의 쓰지 않게 되었다 → 칠흑에서만(탐험 규칙 §11).

### 4.7 탈
- **생김새**: 탈춤은 2022년 유네스코 인류무형문화유산. 말뚝이(양반을 풍자하는 하인), 미얄할미, 양반, 붉고 긴 얼굴의 영노 같은 괴물 탈. 관객이 거의 원형으로 둘러싸는 맨바닥 무대이고, 한쪽 **개복청**에서 탈과 옷을 갈아입는다 ([위키백과 — Talchum](https://en.wikipedia.org/wiki/Talchum)).
- **게임에서**: 탈꾼의 **진형 = 탈** 규칙(선두 말뚝이 · 중열 양반 · 후열 할미)을 얼굴 교체로 보여 준다. 무대 가장자리의 "갈아입는 곳" 개념은 만신의 무복 갈아입기(강신) 연출에도 쓸 수 있다.
- **주의**: 지역 탈(하회·봉산 등)의 특정 탈을 복제하지 않는다. 하회탈 일부는 국보다.

### 4.8 굿청·굿판의 무대
- **생김새**: 굿은 '거리' 단위로 진행된다. 제단은 첫 거리에서 불과 물로 정화하고, 흰색은 정결의 상징이다. 무당은 거리마다 **무복을 여러 번 갈아입는다**. 노래·춤·공수·기도가 리듬 있는 움직임으로 이어진다 ([위키백과 — Gut](https://en.wikipedia.org/wiki/Gut_(ritual))). 굿상 뒤의 지화 병풍(§4.5), 무구(방울·부채·신칼·오방기·명도)는 [무속 지식 정리](lore/shamanism-primer.md) §6, 악사 편성은 §7.
- **게임에서**: 전투 무대 = **굿판**. 위쪽의 금줄·종이 술은 "부정이 들지 못하는 의례 공간"을 알리는 틀이고, 영웅 앞의 **굿상**이 설치물 열이다. 장단 북·받는소리 실은 악사와 무당의 메기고 받기다.
- **주의**: 지정 굿(진도씻김굿·서울새남굿 등)의 거리 순서·상차림을 그대로 재현하지 않는다(민감 요소 '중간').

### 4.9 상여 장식
- **생김새**: 상여는 관을 덮어 묘지까지 운반하는 가마. 밝은 채색이 "떠나는 이를 정성껏 보낸다"는 뜻이다. 꼭대기에는 노랑·파랑 용이 얽힌 용마루를 두어 악귀를 막고, 봉황 꼭두에는 방울·술을 달아 소리와 움직임을 더한다 ([포틀랜드 미술관 — 봉황 꼭두](https://portlandartmuseum.org/the-poster-project/phoenix-shaped-kkokdu-2/) · [국립민속박물관 상여 사진](https://davidkennardphotography.com/photos/655-Traditional-Korean-Funeral-Bier.xhtml)).
- **게임에서**: 1막 보스 **넘어가지 못한 상여**의 조형(멈춘 상여 + 상여꾼), 해원 뒤 "끝까지 보내 주는" 행렬 연출. 영웅(꼭두)과 상여가 **같은 조형 언어**라서 "멈춘 행렬을 다시 걷게 한다"는 의미가 화면만으로 전해진다.
- **주의**: 상여는 죽음 의례 그 자체다. 공포보다 **처연함**(1막 문서 §6 감수 대상). 용·봉황을 괴물로 쓰지 않는다.

---

## 5. 재현 윤리 — 표현 단계 점검표

기준: [무속 지식 정리](lore/shamanism-primer.md) §8 · [매체 조사](lore/media-references.md) §5 · [영웅](../03-heroes.md) §8.

| 항목 | 지킬 것 |
|---|---|
| 실존 신령 | 적으로 쓰지 않는다. 신령은 굿상·가호(보상)로만, 가상 이름으로. 손님(마마) 같은 지금 모셔지는 신령은 **공격 대상이 되지 않는 화면**으로만(2막 문서 §6) |
| 무신도·명도 | 실물 도상을 본뜨지 않는다. 재료·구도·채색 문법만 빌린다 |
| 넋·상여 | 훼손 연출 금지. 해원은 "풀림·배웅", 처치도 "주저앉음"까지 |
| 고어 | 피·상처 대신 긴장·정적(작두), 금(상흔은 균열선), 그을음 |
| 씌임 | "귀신이 붙었다"는 신앙 안의 언어. 광기·발작 연출 금지 |
| 저승사자 외형 | **검은 갓 + 검은 두루마기(또는 정장)의 저승사자**(드라마 〈도깨비〉 계열, 〈KPop Demon Hunters〉 사자 보이즈)를 쓰지 않는다. 차사는 군졸 차림·벙거지·적패지·오라, 색도 검정을 피한다(러프 인형은 적갈색 벙거지) |
| 〈신과함께〉 | 시왕 **재판정**·국선변호사·삼차사 트리오, 일곱 지옥의 장대한 CG 지옥도를 피한다. 열두 대문은 재판이 아니라 **줄 선 넋과 닫힌 문**으로 |
| 〈쌍갑포차〉 | 이승과 저승 사이 '그승', 포장마차에서 꿈으로 들어가는 구도, 한복 차림 주모 주인공의 이미지를 피한다 |
| 〈샤MONEY즘〉 | 현대 도시 직업 무당의 배틀 연출, 살굿·맞굿·금살원 같은 창작 의례와 그 이펙트를 피한다 |
| 중국·일본 이미지 | 도사 모자·음양사 복장·부적 디자인을 섞지 않는다(법사 = 유건·경문). 지화와 사찰 장엄도 구분 |
| 감수 | 아트 단계(11단계) 착수 전 무속 연구자·전승자 감수, 크레딧 표기. 첫 화면 창작물 고지 |

---

## 6. 엔진·기술 메모 (결정 D9 근거)

| 사실 | 출처 | 뜻 |
|---|---|---|
| Spine 공식 런타임이 PixiJS v8을 지원한다(WebGL·WebGPU). 에디터와 런타임의 major.minor를 맞춰야 한다 | [Esoteric — spine-pixi](https://esotericsoftware.com/spine-pixi) · [블로그](https://esotericsoftware.com/blog/spine-pixi-v8-runtime-released) | 웹 스택에서도 DD식 Spine 컷아웃을 쓸 수 있다 |
| CrossCode는 100% HTML5(Canvas 2D) 자체 엔진을 NW.js로 감싸 Steam에 냈다. 콘솔 이식은 성능이 큰 난관이었다 | [Steam 토론](https://steamcommunity.com/app/368340/discussions/0/1291817208507901095) · [RPG Site](https://www.rpgsite.net/news/9249-deck13-and-radical-fish-games-provide-an-update-on-the-console-versions-of-crosscode) | 웹 기술로 PC 패키지(D1)는 충분하다. 콘솔은 나중에 비용이 든다 |
| Vampire Survivors는 PC판을 Phaser(웹)에서 Unity로 옮겼다(콘솔·모바일은 이미 Unity) | [GamingOnLinux](https://gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17) | 웹으로 시작해 성공 뒤 엔진을 옮긴 선례 — 규칙 엔진이 화면과 분리돼 있으면 옮기기 쉽다 |
| StS2는 Unity에서 Godot으로 옮기는 데 2년치 작업을 갱신했다 | [위키백과](https://en.wikipedia.org/wiki/Slay_the_Spire_II) | 엔진 결정은 본 제작 **전에** 해야 싸다 |

---

## 7. 확인 못 한 것

- StS1의 인물 애니메이션 도구(Spine 여부), StS2의 Spine2D 사용(한 곳만).
- DD1 공격 연출(카메라 밀기 + 정지 자세)의 공식 설명. DD1 햄릿 업그레이드가 마을 그림을 바꾸는지.
- DD2 아트 디렉터 인터뷰 원문(검색 요약만 확인).
- Monster Train·Wildfrost·Across the Obelisk·Roguebook의 팀 규모. Roguebook·Gordian Quest·AtO의 엔진은 제3자 목록.
- Chaos Zero Nightmare의 엔진과 인물이 2D인지 3D인지, 전투 카메라. 전투 화면의 아군·적·손패·턴 종료 위치와 로비 메뉴 배치는 글 출처가 없어 (관찰)로만 적었다(§2.16). Prydwen 가이드 본문은 접근이 막혀 검색 요약만 보았다.
- Balatro의 CRT 효과 설정.
- 무신도 "정면 시선·과장된 눈"의 일반화(검색 요약). 넋전의 지역별 제작법(국가민속대백과 본문은 스크립트로 그려져 이번에 읽지 못했다 — 무속 지식 정리의 기존 인용을 따랐다).
- UI : 장면 비율은 모두 (관찰) 추정이다.

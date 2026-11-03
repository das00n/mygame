# Cobalt Core — 적 함선과 게임 구조 정리

출처: https://cobaltcore.wiki.gg (CC BY-SA), 2026-11-03 수집. 분석용이며 게임에 들어가지 않는다.
데이터: `data/research/enemies/cobaltcore.json`(적 51: 함선 41 + 피날레 10페이즈),
`data/research/structure/cobaltcore.json`(유물 93, 이벤트 22+부트 시퀀스, 플레이어 함선 5, 규칙).
수집기: `tools/research/scrape_cobaltcore_world.py` (카드 수집기 `scrape_cobaltcore.py`의 API 도구를 재사용).

## 1. 게임 구조

### 1-1. 구역(Zone)과 적 구성 — 위키 내비박스(1.1 패치 이후 기준)

| 구역 | 일반 | 엘리트 | 보스 | 고정 첫 전투 |
|---|---|---|---|---|
| 1 Lazuli Nebula | 8 | 3 (Humble Approach, Fireball, Needler) | Crystalline Entity / 대체 Crystalline Takeover | Cicada Mk1 |
| 2 Sapphire Cluster | 8 | 3 (Crystalline Offshoot, Rail Cannon, Rogue Starnacle) | The Dreadnought / 대체 Mecha Riggs | Cicada Mk2 |
| 3 Void's Cradle | 8 | 3 (Mining Drill, Buried Relic, Rusting Colossus) | The Cobalt (최종) | Cicada Mk3 |
| 기타 | 이벤트 전용 2 (Glorious Sport Arena, Soggins), 이벤트 재사용 3 (Cicada Mk2, Stag, Fireball), 수리소 1 (Cleo) | | | |
| 피날레 | 10페이즈 연속 전투(크리스털에 갇힌 동료 7 + Riggs? + ??? 2) | | | |

- 매 구역의 첫 전투는 같은 적(Cicada)의 강화판이다 — "같은 적이 진화해서 돌아온다"는 학습 장치.
- 1.1에서 추가된 적(Minesweeper, Solar Sail, Replicator, Rail Cannon, 대체 보스 2)은 몇 판을 해야 등장한다.

### 1-2. 지도 노드

| 노드 | 내용 | 보상 |
|---|---|---|
| 일반 적 | 구역별 일반 적 | 카드 선택 |
| 엘리트 | 같은 엘리트는 구역당 1회, 구역의 엘리트 수보다 많이 나오지 않음 | 카드(언커먼·레어 확률↑) + 유물 3택1 (Harder+ 2택1) |
| 보스 | 구역 끝 | 향상된 카드 + 보스 유물 + 최대 선체 +2 (Harder+ +1) |
| 이벤트 | 22종(코덱스 23), 루프당 1회, 구역 제한·선행 조건(선체 70% 미만 등) | 이벤트별 |
| 유물 | 무작위 1개 (Artemis의 Cargo Hold면 2택1) | 유물 |
| 수리소 | 구역당 중간 2곳 + 보스 직전 1곳(필수), 갈림길 때문에 다 못 들를 수 있음 | 아래 표 |
| 출구 | 다음 구역으로 | — |

- 위키에는 구역당 노드 수·행 수·노드 가중치가 없다(공백). 확인된 빈도는 수리소(2+1)와 엘리트 상한뿐.
- 미리 강화된 카드 보상 확률: 1구역 0%, 2구역 50%, 3구역 100% (Hard 이상에서 절반).

### 1-3. 수리소(Repair Yard, 상점 역할) — 아래 중 하나만 고른다

| 선택지 | 효과 |
|---|---|
| 수리 | 최대 선체의 50% 회복 |
| 카드 강화 / 카드 제거 | 1장 (Jettison Hatch 유물이면 2장 제거) |
| Fight me (2승 이후) | 점주 Cleo와 전투(선체 40/보호막 10). 이기면 Broken Glasses(에너지 +1), 이후 수리소는 전부 빈다 |

돈(골드) 경제가 없다. 강화·제거·회복이 같은 노드에서 서로 경쟁하는 기회비용 구조다.

### 1-4. 난이도 (Hardmode 유물, 누적)

| 단계 | 변화 |
|---|---|
| Normal | 기본 |
| Hard | 조종석 Weak(+1 피해), Basic Shot +1, 미리 강화된 카드 확률 절반, 최대 선체 -1, 이벤트가 덜 관대 |
| Harder | + 제거 불가 쓰레기 카드 Corrupted Core, 최대 선체 -3, 보스 처치 선체 +1만, 엘리트 유물 2택1 |
| Hardest | + 부트 시퀀스에서 단점 강제, 조종석 Brittle(피해 2배), 선체 50%로 시작, 대부분의 적이 행동·약점 변경 |

Hardest의 적 변경 예: Humble Approach 날개 Armored, Crystalline Entity 빈 칸 3개 + 매 턴 부품 셔플, Mining Drill 첫 행동 2연속, Ion Ranger 매 턴 폼 변경, Monarch 시작 드론 3개, Stag 공격에 열기 부여.

### 1-5. 시간 루프와 해금

- 한 판 = 한 "루프". 두 번째 루프부터 매번 **부트 시퀀스**: 무작위 3개 보너스 중 1개(최대 선체 +3, 커먼 유물, Warp Prep→보스 유물 교체, 카드 2장 제거, 언커먼 3택1, 레어 1장, 강화 등). Hardest는 단점(Debris 카드 / 최대 보호막 -1 / 최대 선체 -2)을 먼저 골라야 한다.
- 기억(Memories) 18개를 모두 되찾으면 **피날레**: CAT이 The Cobalt를 몰고 동료 크리스털 함선 10페이즈를 연달아 격파. 1에너지로 시작해 동료를 구할 때마다 그 동료 카드 1장 + 에너지 +1. 지면 즉시 재시작(사실상 연출 전투). 첫 클리어 시 CAT 해금.
- 기억이 어떤 조건으로 풀리는지는 위키에 없다(Mechanics 문서의 Meta-Progression 칸이 비어 있음).
- 진행도 게이트: 1.1 신규 적(몇 판 후), Tower의 환경 변수(3판·1승), Cleo 전투(2승), Crystallized Crew 이벤트(3승+Isaac), Sports!(Drake 해금), 데일리(게임 클리어 후).

### 1-6. 승무원과 함선

| 승무원(3명 선택) | 해금 |
|---|---|
| Dizzy, Riggs, Peri | 기본 |
| Isaac → Drake → Max | 승리 → Isaac으로 승리 → Drake로 승리 (사슬형) |
| Books | 캐릭터 문서: 첫 보스 5회 처치 / 업적 문서: 1구역 보스 뒤 Books와 만날 때마다 진행 + 1승 (위키 내부 불일치) |
| CAT | 기억 전부 + 피날레 |

시작 덱 = Basic Block, Basic Dodge, Basic Shot ×2 + 승무원마다 고유 카드 2장. 2구역 이벤트 Crystallized Crew로 런 중 승무원 교체 가능(빠진 승무원 카드·유물은 유지).

| 함선 | 선체/보호막 | 폭 | 기믹 | 해금 |
|---|---|---|---|---|
| Artemis | 12/4 | 5 | 기믹 없음, 유물 노드 +1택 | 기본 |
| Ares | 8/4 | 4 | 대포 2문 수동 전환, 비활성 대포 Armored, 드로우 -1 | Hard 승리 |
| Jupiter | 12/4 | 6 | 대포 없음 — 띄운 드론이 공격을 대신 쏨, Weak 통신부 | 유물 40종 발견 |
| Gemini | 11/4 | 5 | 카드 1장마다 대포·미사일 베이 좌우 자동 전환 | 시작 3인 없이 승리 |
| Tiderunner | 7/3 | 6 | 손패 맨 왼쪽/오른쪽 카드를 내면 그 방향으로 1칸 이동, 고정 닻 카드 | 10승 |

### 1-7. 유물 93종 (위키 마스터 표)

| 소유 | 수 | 비고 |
|---|---|---|
| 승무원 전용 | 45 | 커먼 31 + 보스 14 (각 승무원 4~7) |
| 공용 | 25 | 커먼 24 + 시작 Warp Prep |
| 공용 보스 | 6 | Glass Cannon, Simplicity, Dirty Engines, Genesis, Hi Freq Intercom, Warp Mastery |
| 함선 전용 | 13 | 시작 7 + 보스 5 + Jupiter 커먼 1 |
| 특수 | 4 | Hardmode, Scrap Armor(이벤트), Broken Glasses(Cleo), The Cobalt Core(피날레) |

보스 유물의 상당수가 "에너지 +1 + 단점"(Glass Cannon: 대포 Weak, Dirty Engines: 2턴마다 쓰레기 카드). 승무원 유물이 절반이라 파티 구성이 유물 풀을 바꾼다.

## 2. 적 설계 패턴

### 2-1. 레인(열) 전투와 의도 표시
- 전장은 3줄: 플레이어 줄 / 중간줄(midrow) / 적 줄. 모든 공격은 **부품이 있는 열을 따라 직진**한다. 빈 칸(스캐폴드)은 통과.
- 적에게는 덱이 없다. **부품마다** 이번 턴 의도(공격 수치, 보호막, 발사, 디버프, 카드 투입)가 그 열에 빨갛게 표시된다. 한 턴 = 여러 부품 의도의 묶음, 2~3개 묶음을 순환(행동 정보가 있는 함선 33척의 행동 77개 중 attack 59, missile 17, shield 13, buff 13, debuff 12, card 8, drone 7 — 한 행동에 여러 태그).
- 순서: 적이 먼저 "어디로 움직여 무엇을 노릴지" 정하고(Move any number of spaces / Aims at player) 의도를 보인다 → 플레이어는 카드·회피(Evade)로 자기 함선을 옮겨 맞을 부위를 고른다 → 드론 턴 → 적 행동. 즉 **회피 = 위치 선택**이고, 맞을 부위(약한 조종석, 장갑 부품, 빈 칸)를 고르는 퍼즐이다.
- 적 조준 AI가 다양하다: 플레이어 조준(대부분) / 빈 칸 조준(Monarch: 드론 배치) / 공 조준(Sports) / 소행성 무시 vs 회피(Mining Drill 두 행동이 다름) / 엔진 잠긴 대상의 중앙 조준(Ion Ranger) / 세 위치 순환(Aquatic Lifeform) / 멀리 도망갔다 돌아와 사격(Evolutionary Perfection) / 미사일 베이를 멀리 두는 자세(DX-5).
- 보스 이동 규칙: Dreadnought는 매 턴 플레이어 중심 쪽으로 2칸, 겹치는 부품이 없으면 경고 후 **정면 정렬(square up)** 하고 이동량만큼 과열 + 다음 턴 대포 +1. Cobalt는 매 턴 3칸 이동하되 정렬하지 않는다(회피 빌드 보상). Crystalline Entity는 부품 4개 이상이 비켜나 있으면 턴 수에 비례한 칸만큼 따라온다. Cleo는 매 턴 플레이어 중앙에 맞춘다.

### 2-2. 부품 특성 = 약점 지도
- Weak(+1), Brittle(×2), Armored(-1, 다단히트에 강함), Concussable(맞으면 그 부품 의도 취소), Empty(통과). 스턴 공격도 의도를 취소한다.
- Goliath: Brittle 부품이 맞으면 반응 장갑(Reflexive Coating)이 턴 끝까지 장갑으로 바꾼다. Dreadnought: 왼쪽 베이 Weak, 오른쪽 둘 Concussable. Cobalt: 중앙 대포 Weak(최대 피해), 양옆 대포 Armored+Concussable.
- Aquatic Lifeform은 **빈 칸에서** 쏴서 스턴으로 막을 수 없다 — 규칙의 예외를 적 개성으로 쓴다.

### 2-3. 중간줄(midrow) 오브젝트
- 미사일(2), 큰 미사일(3), 시커(레인 무시·가장 가까운 부품 추적), 공격/보호막 드론, 우주 기뢰(파괴한 쪽이 피해), 소행성(엄폐), 듀얼 드론(양쪽을 다 쏨, Minesweeper 전용), 버블(첫 공격 무효), 축구공.
- 미사일은 **한 턴 늦게 터지는 공격**이라 "지금 막을지, 다음 턴 비켜날지" 선택을 만든다. 어떤 공격이든 오브젝트를 파괴하므로 플레이어의 사격이 방어 수단도 된다.
- 적이 자기 오브젝트에 걸리게 유도할 수 있다(Monarch는 자기 드론을 부수고, Goliath는 자기 기뢰를 쏘게 만들 수 있다). Cleo만 의도 표시 없이 턴 시작에 시커 11발을 쏜다 — 규칙 파괴가 곧 "하지 말아야 할 싸움"의 신호.

### 2-4. 덱 오염과 승무원 봉쇄
- 카드 투입: Trash(Pupa·Cobalt), Toxic·Miasma(Tower), Comm Jam(Scarab, 제거 어려움), Fear(Aquatic), Oxygen Leak(Spike Jr), Fumes(DX-5), Safety Override(Needler, 뽑는 순간 Temp Payback로 반격 피해).
- **승무원 실종(Character is Missing)**: Tower 조종석이 무작위 승무원 1명에게 건다. 그 승무원 카드는 비용·특성은 그대로인데 효과가 없고, 낼 때마다 1씩 줄어 0이 되면 복구. CAT도 자기 카드로 자신을 실종시킨다. 파티 단위로 "한 명을 침묵"시키는 적 동사.
- 이동 봉쇄: Engine Stall(다음 이동 실패), Engine Lock(이동 불가). Ion Ranger는 잠근 뒤 중앙을 노려 양 대포를 맞힌다 — 디버프와 다음 공격이 짝을 이룬다.

### 2-5. 스케일링과 시계
- Powerdrive 누적(Cicada 3종, Chariot, Buried Relic), 사용할 때마다 피해 +1(Gnat, Ion Ranger), 다단 횟수 +1(Goliath, Mining Drill), 총 피해 +1/턴(Crystalline Entity).
- 스스로 줄어드는 적: Rusting Colossus(자기 부식), Replicator(이온 폭풍이 양쪽 보호막 -2/턴, 대신 매 턴 대포 2문 증식). "버틸까, 빨리 잡을까"를 적마다 다르게 묻는다.
- 결정론이 기본이고 무작위는 소수(Gnat 2택, Hopper, Crystalline Entity 피해 분배)뿐이라 읽기 쉽다. 복잡도는 숨은 정보가 아니라 **위치**에서 나온다.

### 2-6. 특수 규칙 전투
- Chariot: 전투 전 "명예 결투" 제안 — 서로 약점을 안 노리면 선체 4 이하에서 떠난다(보상 유지). 배신하면 Powerdrive +1, 이후 플레이어 약점만 노림.
- Sports!(Glorious Sport Arena): 적을 맞히면 옐로카드, 3장이면 실격. 공(축구공)을 상대 골로 밀어야 승리.
- Missile Mayhem: 자기 미사일에 맞는 Soggins를 지켜야 하는 호위전. Buried Relic: 잠든 동안 한 카드로 처치하면 쉬움, 맞으면 깨어나 선체 +15. 벽에 갇힌 전장(Walled In), 소행성 지대, 태양 플레어·태양풍 환경 변수.

## 3. 주요 보스

| 보스 | 선체/보호막 | 폭 | 핵심 |
|---|---|---|---|
| Crystalline Entity (1) | 30/0 (Hardest 34) | 12 | 전 부품이 대포, 총 피해 4부터 매 턴 +1을 무작위 분배. 멀어지면 따라옴 |
| Crystalline Takeover (1 대체) | 21/7 | ? | 위키 스텁(행동 정보 없음) |
| The Dreadnought (2) | 20/12 (Hardest 24) | 12 | 대포 5문에 매 턴 총 7 분배, 홀수 턴 임시 보호막 3, 짝수 턴 미사일 3. 회피하면 정렬 + 과열 + 피해 +1 |
| Mecha Riggs (2 대체) | 25/6 (Hardest 29) | ? | 위키 스텁 |
| The Cobalt (3, 최종) | 45/15 | 11 | 3턴 순환(2턴째 Trash 투입), 매 턴 3칸 이동·정렬 안 함. 모든 난이도 동일. 행동 상세는 위키에 이미지로만 있음 |
| Cleo (수리소) | 40/10 | ? | 1·2턴 중앙 6부터 바깥으로 줄어드는 사격(총 42), 3턴 시커 11발. 사실상 1턴 처치용 |

## 4. 파티·대형(formation) 게임에 주는 시사점

1. **의도를 "열/칸 단위"로 보여 주고, 대응을 "대형 이동"으로 만든다.** 카드와 별개로 저장되는 이동 자원(Evade)이 회피·조준을 동시에 담당해 매 턴 공수 트레이드오프를 만든다. 파티 게임이면 "대형 이동 토큰"으로 옮길 수 있다.
2. **적은 먼저 움직여 조준하고, 플레이어는 의도를 본 뒤 움직인다.** 조준 AI 유형(플레이어/빈 칸/목표물/장애물 회피/정렬 금지)만 바꿔도 같은 공격이 전혀 다른 퍼즐이 된다 — 적 AI를 "조준 규칙 + 2~3턴 순환"으로 작게 설계할 수 있다.
3. **보스마다 반(反)카이팅 규칙을 명시**한다(정렬+페널티, 추적, 또는 정렬 금지로 회피 빌드를 보상). 대형 게임에서 "적이 비어 있는 칸을 노리지 않게" 하는 장치가 필요하다.
4. **대형 칸마다 특성을 둔다.** 플레이어 조종석이 난이도에 따라 Weak→Brittle이 되듯, 파티의 리더/후열 칸에 약점을 두고 적도 Weak·Armored·Concussable 칸을 가지면 "어디를 맞을지·어디를 칠지"가 결정의 중심이 된다.
5. **중간 지대(오브젝트 줄)를 세 번째 층으로.** 지연 공격(미사일), 유도 공격(시커), 엄폐물, 파괴 시 반격(기뢰), 양쪽을 때리는 중립 오브젝트는 두 대형 사이 전장에 그대로 옮길 수 있다.
6. **"승무원 실종"은 파티 게임 전용 적 동사로 가치가 크다.** 특정 동료의 카드를 무력화하되, 그 카드를 내서 풀게 하면 덱 압박과 해제 비용이 함께 생긴다. 덱 오염 카드는 각자 해제 조건이 달라야 한다(플레이하면 사라짐 / 제거 불가 / 뽑을 때 발동).
7. **스케일링 시계로 전투 길이를 조절**한다: 누적 버프, 사용할 때마다 +1, 매 턴 총 피해 +1. 스스로 약해지는 적을 섞으면 "버티기 vs 속공"이 적마다 달라진다.
8. **같은 적의 진화판을 각 구역 첫 전투에 고정**하면 성장 체감과 학습이 동시에 된다(Cicada Mk1→Mk3).
9. **특수 규칙 전투를 이벤트로 넣는다**(명예 결투, 공놀이, 호위, 잠든 적, 벽에 갇힌 전장). 같은 전투 엔진으로 규칙만 바꿔 변화를 만든다.
10. **보상 구조**: 일반=카드, 엘리트=카드+유물 택1, 보스=보스 유물+최대 체력, 수리소=회복/강화/제거 중 1택(돈 없음), 루프마다 부트 보너스. 승무원 전용 유물이 절반이라 파티 구성이 곧 유물 풀이다.

## 5. 완결성 점검과 공백

- 적 문서: Category:Enemies 43쪽 = 함선 41 + 개요(Enemies) + 피날레. 위키 내비박스 41항목과 함선 41쪽이 정확히 일치한다.
- 불일치(원인): Enemies·Common Enemy·Elite·Boss 개요 문서에 1.1 신규 6종이 없음(갱신 안 됨), Common Enemy 문서는 Mining Drill을 여전히 일반 적으로 표기(1.1에서 엘리트로 승격), Category:Bosses에 대체 보스 2종 누락, DJA-2 Solar Sail 정보상자 구역이 1구역(내비박스·1.1 패치 노트는 2구역).
- 스텁 12쪽 중 행동 정보가 전혀 없는 적 8종: Stinger, Solar Sail, Replicator(전략 문단에서 행동 일부만), Rail Cannon(패치 노트만), Rogue Starnacle, Crystalline Offshoot, Crystalline Takeover, Mecha Riggs. Rusting Colossus 선체는 위키에 "??". The Cobalt의 3턴 행동은 이미지로만 있다.
- 유물: 마스터 표 93 = {{Artifact}} 문서 93 = 카테고리 93. 메인 페이지의 "80 artifacts"는 오래된 문구.
- 이벤트: 표 22 = 문서 22(Garbage Girl Repairs는 카테고리 태그 누락), 코덱스 23(Fake Distress Signal의 Drake 변형 포함). 부트 시퀀스는 별도 특수 이벤트로 추가.
- 위키에 없음: 구역당 노드 수·가중치, 카드 보상 장수, 기억 18개의 해금 조건.

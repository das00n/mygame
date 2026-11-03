# 탐험 레이어 레퍼런스 — Darkest Dungeon식 던전 탐험 × 덱빌딩

> 작성 2026-11-03 · 범위: 「저승굿」의 원정 지도를 StS식 분기 지도 대신 **DD1식 방·복도 던전**으로 설계하기 위한 조사.
> 영웅 시스템(스트레스·Death's Door·퀵·관계)은 [`systems-reference.md`](systems-reference.md)에서 다뤘다. 본진(햄릿) 건물은 다른 문서 범위라서 **보급 상점만** 다룬다.
>
> 표기: (출처 URL) = 직접 열어 확인 · (검색 요약) = 검색 결과 요약으로만 확인 · ⚠️ = 출처끼리 다르거나 해석이 필요함 · ❓ = 확인 못 함
> 평점은 2026-11-03 Steam 영문 리뷰 기준이다. 계획서·systems-reference와 같은 스냅숏을 쓰고, 이번에 새로 조회한 것은 "새로 조회"로 표시했다.

---

## 0. 요약

- **DD1의 탐험은 시계 하나(횃불)와 짐 하나(16칸 인벤토리)로 "더 갈까, 돌아갈까"를 만드는 장치다.**
  빛은 새 칸마다 −6, 지나온 칸마다 −1 줄고, 횃불 1개가 +25를 채운다. 어두울수록 적이 세지고 스트레스가 늘지만 전리품도 는다.
- **캠핑 횟수는 원정 길이가 정한다**(짧음 0 / 중간 1 / 긺 2). 여유 12점을 영웅별 캠프 스킬에 나눠 쓰고, 33% 확률로 밤 습격이 온다.
  → 덱빌더 휴식처의 확장판으로 옮기기 좋다.
- **비판은 네 곳에 몰렸다**: 무작위 허기 판정, 되돌아가기(스트레스·재출현), 슬롯 부족(전리품 버리기), 피할 수 없는 기습.
  DD2는 던전을 빼고 **한 방향 길 + 저절로 줄어드는 불꽃**으로 바꿨다. 그러자 "탐험이 사라졌다"는 반발이 나왔다.
- **공간 탐험이 있는 덱빌더는 탐험 자원을 전투 보상으로 다시 채우게 해서 탐험과 전투를 한 고리로 묶는다**(Roguebook의 잉크).
  Gordian Quest는 보급이 떨어지면 **쓸 수 없는 카드(Waste)를 덱에 넣는다** — 탐험 자원이 덱 상태로 바로 이어지는 선례다.
- **StS 1막 = 전투 약 10회 + 휴식처 2–3회**(확률표로 계산한 추정). **"중간 길 원정 1회 ≈ StS 1막"**에 맞추면 덱 성장 속도를 비교할 수 있다.
- **권고 요지**
  - 넋등을 **유일한 시계**로 둔다. 어둠은 **상태 카드와 보상 선택지**로 덱에 닿게 한다.
  - 캠프는 **영웅별 굿거리**(강화·제거·인연·장례)로 만든다.
  - 카드 보상은 **처음 치르는 전투에서만** 준다.
  - 되돌아가기는 **즉시 이동**으로 처리한다.

---

## 1. Darkest Dungeon 1 — 던전 탐험 규칙과 수치

### 1.1 원정(퀘스트) 구조

| 유형 | 목표 | 메모 | 출처 |
|---|---|---|---|
| Explore | 방의 **90%**에 들어간다 | 전투에서 도망쳐도 그 방은 탐사한 것으로 친다. 비밀 방도 진행도에 들어간다 | [Quest](https://darkestdungeon.wiki.gg/wiki/Quest) · [Secret Room](https://darkestdungeon.wiki.gg/wiki/Secret_Room) |
| Cleanse | 방 전투를 모두 이긴다 | 복도 전투는 세지 않는다. 정찰되고 다른 길이 있으면 피할 수 있다 | [Quest](https://darkestdungeon.wiki.gg/wiki/Quest) |
| Gather | 특수 기물에서 퀘스트 아이템을 모은다 | 완료하면 마을 이벤트(예: Warrens → 그 주 보급품 무료) | 〃 |
| Activate | 출발할 때 받은 퀘스트 아이템으로 기물을 활성화한다 | 완료하면 다음 주 그 지역 퀘스트에서 Resolve +33%, 피해 +15% | 〃 |
| Boss | 보스를 처치한다 | **항상 중간 길이** | 〃 · [Expedition](https://darkestdungeon.wiki.gg/wiki/Expedition) |
| Darkest Dungeon | Resolve 6 전용 고정 퀘스트 4개 | 도중에 철수하면 영웅 1명이 희생된다 | [Darkest Dungeon (location)](https://darkestdungeon.wiki.gg/wiki/Darkest_Dungeon_(location)) |

| 항목 | 짧음 | 중간 | 긺 | 출처 |
|---|---|---|---|---|
| 크기 | 방 "한 줌" | 분기 있음 | 분기와 막다른 길이 많음 | [Expedition](https://darkestdungeon.wiki.gg/wiki/Expedition) |
| 장작(= 캠프 횟수) | 0 | 1 | 2 (Exhausting 4) | [Camping](https://darkestdungeon.wiki.gg/wiki/Camping) |
| 비밀 방 | 언급 없음 ❓ | 50% 확률로 1개 | 50% 확률로 1개 | [Secret Room](https://darkestdungeon.wiki.gg/wiki/Secret_Room) |
| Resolve XP (Apprentice / Veteran / Champion) | 2 / 4 / 8 | 3 / 6 / 12 | 4 / 8 / 16 | [Quest](https://darkestdungeon.wiki.gg/wiki/Quest) |
| 보스 해금 진척 (Apprentice / Veteran / Champion) | 50 / 33 / 20% | 75 / 50 / 30% | 100 / 67 / 40% | 〃 (넘친 진척은 다음 보스로 이월) |

- **보상**: 골드(난이도·길이에 비례, 액수 ❓), 지역 가보, 트링킷 1개(위키는 "퀘스트를 고르는 주된 기준"이라고 쓴다), 보스 진척.
  목표를 달성해야만 받는다 ([Quest](https://darkestdungeon.wiki.gg/wiki/Quest)).

### 1.2 지도 — 방과 복도

| 요소 | 규칙 | 출처 |
|---|---|---|
| 연결 | 방은 상하좌우로 최대 4개 방과 복도로 이어진다. 들어가면 방의 위치는 모두 보인다(내용은 안 보임) | [Dungeon map](https://darkestdungeon.wiki.gg/wiki/Dungeon_map) · 위치 공개는 (검색 요약) |
| 복도 | **1–8칸**. 한 칸 = 상태이상·빛 기준으로 1라운드 | 〃 |
| 방 종류 | 기물 방(활성화·수집 목표가 아니면 대개 전투 동반) · 보물 방(가보 상자나 금고 + 전투) · 전투 방 · 보스 방 · 입구(늘 비어 있고 캠핑 불가) | 〃 |
| 보스 위치 | 입구에서 **방 개수로 가장 먼 방**. 동점이면 더 아래, 그다음 더 오른쪽. 복도 길이는 따지지 않는다 | 〃 |
| 지역별 모양 | Warrens는 대체로 3×4 격자(첫 방에서 거의 다 정찰됨), Weald는 길고 구불구불, Ruins는 복도 미로 | 〃 · [Warrens](https://darkestdungeon.wiki.gg/wiki/Warrens) · [Ruins](https://darkestdungeon.wiki.gg/wiki/Ruins) |
| 예외 | Darkest Dungeon·Wolves at the Door는 고정 배치, Courtyard는 방 단위로 공개, Farmstead는 탐험이 없다(웨이브) | [Dungeon map](https://darkestdungeon.wiki.gg/wiki/Dungeon_map) |

**생성기 예시** — 짧은 Crypts 탐사 퀘스트의 `map_generator.darkest` 값 ([Steam 모딩 스레드](https://steamcommunity.com/app/262060/discussions/4/490123938439142849)).
두 값은 최소·최대로 보이지만, 필드 의미는 글쓴이와 댓글의 비공식 해석이다 ⚠️.

| 필드 | 값 | 필드 | 값 |
|---|---|---|---|
| 방 / 복도 / 격자 | 9 / 10 / 4×3 | 목표 방 수 / 연결도 | 9 / 0.9 |
| 복도 전투 | 2–4 | 복도 덫 | 2–3 |
| 복도 장애물 | 0–2 | 복도 기물 | 9 |
| 복도 허기 | 1–3 | 방 전투 | 1–3 |
| 지키는 기물(방) | 0–1 | 지키는 보물(방) | 1 |

- → **짧은 원정의 전투는 3–7회 안팎**이다.
- 긴 원정은 방 16–17개라는 플레이어 증언이 있다 ([Steam](https://steamcommunity.com/app/262060/discussions/0/5197701062326189931), 검색 요약 ⚠️). 중간 원정의 방 수는 ❓.
- NG+(Stygian 계열 패치)는 방 수를 "기본 +50% → +30%"로 줄였다는 패치 노트가 있다 (검색 요약 ⚠️).

### 1.3 이동·되돌아가기·재출현

| 규칙 | 내용 | 출처 |
|---|---|---|
| 이동 | 목적지 방을 정해야 복도를 건널 수 있다 | [Expedition](https://darkestdungeon.wiki.gg/wiki/Expedition) |
| 빛 소모 | **새 칸 −6**(Stygian·Bloodmoon −7), **지나온 칸 −1** | [Light Meter](https://darkestdungeon.wiki.gg/wiki/Light_Meter) |
| 되돌아가기 | 뒤로(오른쪽→왼쪽) 걸으면 느리고 스트레스가 크게 늘며, 영웅이 불평 대사를 한다 | [Dungeon map](https://darkestdungeon.wiki.gg/wiki/Dungeon_map) · [Expedition](https://darkestdungeon.wiki.gg/wiki/Expedition) |
| 이동 중 스트레스 | 복도에서 가끔 무작위로 스트레스를 받는다. Courtyard는 한 칸마다 무작위 영웅 1명이 +1 | 〃 · [Courtyard](https://darkestdungeon.wiki.gg/wiki/Courtyard) |
| 재출현 | 지나온 복도에 다시 들어가면 빈 칸에 전투 → 허기 → 덫 순으로 생성을 판정한다. 아직 정리 안 한 칸이 있으면 그 칸은 막힌다 | [Dungeon map](https://darkestdungeon.wiki.gg/wiki/Dungeon_map) |
| 재출현 확률 (기본 / 빛 ≤50 / 빛 0) | 전투 5 / 7.5 / 10% (Stygian 7.5 / 10 / 12.5%) · 허기 7.5 / 10 / 12.5% · 덫 5 / 7.5 / 10% | 〃 |
| 복도 파밍 | 원정 막바지에 복도를 들락거리며 전투를 다시 만들어 전리품을 얻는 공략이 있다 | 〃 |

### 1.4 복도 칸의 내용

| 칸 | 효과 | 대처 | 출처 |
|---|---|---|---|
| 전투 | 복도 전투 | 정찰된 경우 다른 길이 있으면 우회 | [Dungeon map](https://darkestdungeon.wiki.gg/wiki/Dungeon_map) |
| 기물 | 복도에는 여러 개, 방에는 1개. 길을 막지 않는다 | §1.9 | [Curios](https://darkestdungeon.wiki.gg/wiki/Curios) |
| 덫 | 무작위 영웅 1명에게 HP 피해 + **스트레스 15**. Ruins: 최대 HP 25/28/30%(난이도별) · Weald: Blight · Warrens: 10% + Bleed · Cove: 10% + 속도·회피 디버프 12라운드 · Courtyard: 고정 피해 15/18 + 50% 확률로 적 소환 ⚠️(표 해석) | 정찰된 덫은 해제를 시도한다. 확률 = Trap Resist + 40%(Veteran +20, Champion +40 보정). 성공하면 스트레스 −8. 정찰 안 된 덫은 Trap Resist로 피한다. 기본 해제율은 Grave Robber 90% ~ Flagellant 40% | [Trap](https://darkestdungeon.wiki.gg/wiki/Trap) |
| 장애물 | 지나갈 수 없다. Weald에 가장 많다 | 삽: 대가 없음. 맨손: 파티 최대 HP 20% 피해 + 스트레스 15 + **빛 −20** | [Obstacles](https://darkestdungeon.wiki.gg/wiki/Obstacles) · [Weald](https://darkestdungeon.wiki.gg/wiki/Weald) |
| 허기 | 숨은 칸이다. 1인당 음식 1(각자 HP 5% 회복)을 먹이거나, 거부하면 각자 HP −20%·스트레스 +20. 파티가 함께 먹는다 | 먹은 뒤 현재·다음 복도는 허기 면제(허기 버퍼). 출발할 때와 캠핑 뒤에도 적용 | [Hunger](https://darkestdungeon.wiki.gg/wiki/Hunger) |
| 비밀 방 | 금색 별 칸. 치명 정찰로만 보인다 | 안에 Ancient Artifact(열쇠 필요) | [Secret Room](https://darkestdungeon.wiki.gg/wiki/Secret_Room) |

### 1.5 빛(Light Meter)

| 구간 | 정찰 | 적 기습당함 | 영웅 기습당함 | 추가 전리품 (기물 / 전투) | 스트레스 | 적 명중 / 피해 / 치명 | 영웅 치명 |
|---|---|---|---|---|---|---|---|
| Radiant 100–76 | +15% | +25% | — | 25% / 25% | — | — | — |
| Dim 75–51 | +7.5% | +15% | — | 50% / 50% | +10% | — / — / +1% | — |
| Shadowy 50–26 | — | +10% | +15% | 75% / 75% | +20% | +5 / +10% / +2% | +1% |
| Dark 25–1 | — | +5% | +25% | 95% / 75% | +30% | +10 / +15% / +3% | +2% |
| Black as Pitch 0 | — | — | +40% | — / 아이템 종류 2개 추가 | +40% | +12.5 / +25% / +5% | +3% |

⚠️ 위키 표에 빈 칸이 많아서, 정찰을 뺀 나머지 열의 구간 정렬은 해석이다(두 번 조회했는데 적 기습당함 열의 정렬이 서로 달랐다). 출처: [Light Meter](https://darkestdungeon.wiki.gg/wiki/Light_Meter).
영웅 회피도 밝을수록 오른다(Radiant +7.5, Dim +4).

| 규칙 | 내용 | 출처 |
|---|---|---|
| 횃불 | 빛 +25, 75골드, 8개 묶음. 자기 턴이면 전투 중에도 쓸 수 있다 | [Torch](https://darkestdungeon.wiki.gg/wiki/Torch) · [Light Meter](https://darkestdungeon.wiki.gg/wiki/Light_Meter) |
| 일부러 낮추기 | 언제든 25 단위로 낮출 수 있다. 전투 직후 빛을 낮춰 전리품을 노리기도 한다(대신 정찰 확률이 떨어진다) | 〃 · [Scouting](https://darkestdungeon.wiki.gg/wiki/Scouting) |
| 캠프 | 캠프를 마치고 탐험을 이어 가면 100이 된다(Occultist의 Dark Ritual은 −100) | [Camping](https://darkestdungeon.wiki.gg/wiki/Camping) · [Camping Skills](https://darkestdungeon.wiki.gg/wiki/Camping_Skills) |
| 빛 0의 위협 | 복도 전투마다 Shambler 기습 1 / 8 / 12%(Apprentice / Veteran / Champion) | [Light Meter](https://darkestdungeon.wiki.gg/wiki/Light_Meter) |
| 지역 예외 | Courtyard는 Bloodlight로 고정된다(스트레스 +10%, 출혈 저항 −10%). 횃불은 전투 1회 동안 파티 명중 +3. Farmstead는 웨이브마다 바뀌는 조명 효과로 대체된다 | 〃 · [Farmstead](https://darkestdungeon.wiki.gg/wiki/Farmstead) |
| 검산(우리 계산) | 짧은 원정을 방 9 + 복도 10 × 평균 3칸으로 가정하면 새 칸 ≈ 39 × 6 = 234 → 횃불 약 9개로 Radiant를 유지한다. 플레이어 권장량 6–8개(§1.7)는 일부러 Dim까지 내려간다는 뜻이다 | 평균 복도 길이 3칸은 가정 ❓ |

### 1.6 정찰

| 항목 | 규칙 |
|---|---|
| 판정 시점 | 새 방에 들어갈 때, 그리고 방 전투를 이긴 뒤 |
| 확률 | 기본 25%, Radiant +15% |
| 범위 | 일반: 이웃한 복도 전부 + 그 끝 방(복도 1개 거리). **치명**(정찰 성공의 50%): 복도 2개 거리. 정찰 확률이 100%를 넘으면 치명 확률 = 정찰 확률의 절반 |
| 독점 정보 | **덫은 정찰로만, 비밀 방은 치명 정찰로만** 보인다 |
| 전투 효과 | 정찰된 전투는 우리가 기습당할 확률이 내려가고 적을 기습할 확률이 오른다(수치 ❓) |
| 보너스원 | 트링킷 +10–25%, 캠프 스킬 +20–30%(4전투), 지역 퀵 |

출처: [Scouting](https://darkestdungeon.wiki.gg/wiki/Scouting)

### 1.7 보급품 — 가격과 권장량

| 품목 | 가격 | 묶음 | 기능 | 대표 기물 상호작용 |
|---|---|---|---|---|
| 음식 | 75 | 12 | 소량 회복, 허기·캠프 식사 | Weald 사체(+약초 → 음식 2), Warrens 식탁 |
| 횃불 | 75 | 8 | 빛 +25 | Shambler's Altar(보스 소환), 책 더미(태우면 스트레스 +100) |
| 삽 | 250 | 4 | 장애물 제거 | 따개비 상자 100%, Bas-Relief(스트레스 +100) |
| 해골 열쇠 | 200 | 6 | 기물 전용 | 가보 상자·잠긴 석관·고대 유물 |
| 붕대 | 150 | 6 | 출혈 치료 | 거미줄·미라 "철저 수색" |
| 해독제 | 150 | 6 | Blight 치료 | 독 덫 상자 |
| 약초 | 200 | 6 | 디버프 치료 | 음식 기물의 병 제거, 안전 채취 |
| 성수 | 150 | 6 | 저항 버프 | Eldritch Altar(부정 퀵 제거 100%), 고해소, 성수반 |
| Laudanum | 100 | 6 | Horror 치료 | — |
| 장작 | 비매품 | 1 | 캠프 시작 | 길이에 따라 0 / 1 / 2개 지급 |

- 출발 전에 되팔면 산 값을 그대로 돌려받는다. 귀환 뒤 남은 보급은 "크게 깎인 값"으로 정산된다(액수 ❓).
  Crusader는 성수 1, Houndmaster는 개 간식 2를 무료로 가져온다.
  출처: [Provision](https://darkestdungeon.wiki.gg/wiki/Provision) · [Curios](https://darkestdungeon.wiki.gg/wiki/Curios)

**권장량** — 공식 수치는 없고 플레이어 증언이다 ([Steam 스레드](https://steamcommunity.com/app/262060/discussions/0/1696045708647193695))

| 길이 | 음식 | 횃불 | 삽 |
|---|---|---|---|
| 짧음 | 8 (안전하게 12) | 6–8 (많게는 12) | 1–3 |
| 중간 | 12–20 (대개 16) | 12–18 | 2–5 |
| 긺 | 16–24 | 14–22 | 3–6 |

- 지역별 보정
  - Ruins: 성수·열쇠, 음식 넉넉히(음식 기물이 없다)
  - Weald: 삽·해독제·붕대·약초, 되돌아가기용 횃불
  - Warrens: 해독제·약초·붕대·성수, 삽 1–2(음식 기물이 많다)
  - Cove: 삽(굴·따개비 상자)·열쇠·약초
  - 출처: [Ruins](https://darkestdungeon.wiki.gg/wiki/Ruins) · [Weald](https://darkestdungeon.wiki.gg/wiki/Weald) · [Warrens](https://darkestdungeon.wiki.gg/wiki/Warrens) · [Cove](https://darkestdungeon.wiki.gg/wiki/Cove)

### 1.8 짐 한도

| 칸 | 한도 | 출처 |
|---|---|---|
| 원정 인벤토리 | **16칸. 보급품과 전리품이 함께 쓴다** | [Inventory](https://darkestdungeon.wiki.gg/wiki/Inventory) |
| 골드 | 칸당 1,750(Antiquarian 1명당 +750) | 〃 |
| 보석 / 가보 / 트링킷 | 종류당 5 / 칸당 3·6·12(종류별) / 칸당 1 | 〃 |
| 퀘스트 보상 | 별도 6칸(성공 시) | 〃 |

- 보급을 쓰면 칸이 비고, 그 자리에 전리품이 들어간다. **보급 소비 자체가 짐 공간을 만드는** 구조다.
- 그래도 중간·긴 원정에서는 "전리품의 1/4을 버려야 한다"는 불만이 2015년부터 나왔다 ([Steam](https://steamcommunity.com/app/262060/discussions/0/612823460255638265), 검색 요약).

### 1.9 기물(Curio)

| 항목 | 내용 |
|---|---|
| 상호작용 | 맨손으로 만지거나 보급품을 쓴다. 맞는 보급품은 대개 좋은 결과를 보장한다(열쇠 → 잠긴 상자 ≈100%, 성수 → Eldritch Altar 부정 퀵 제거 100%). 틀린 보급품은 벌을 받는다(책 더미에 횃불 → 스트레스 +100) |
| 결과 범주 | 전리품(골드·보석·트링킷·가보·보급·음식·일지) · 버프/디버프(대개 "캠프까지") · 스트레스 ±·회복 · 퀵 · 질병·Bleed·Blight · 부정 퀵 정화 · 정찰·빛 변화·적 소환·퀘스트 진행 |
| 수량 | 공용 약 12종(복도 7·방 1·보물 방 3·비밀 방 1). 지역 고유: Ruins 11, Weald 10, Warrens 9, Cove 8 + 퀘스트용 기물 |
| 확률 예 | Sack: 골드 75% / 없음 25% · Discarded Pack: 전리품 60% / 지도 20% / 없음 20% · Confession Booth: 스트레스 +15 50% / 전리품 25% / 퀵 제거 25% |
| 강제 상호작용 | 퀵·고통 때문에 특정 태그(Treasure·Worship·Unholy·Body…)의 기물을 억지로 만진다(Kleptomaniac 35%, Fearful 50% 등) |
| 영웅 | 효과는 대개 **선택한 영웅 1명**에게만 간다 → 저항 높은 영웅을 고른다. Antiquarian이 있으면 기물 전리품이 늘어난다 |

출처: [Curios](https://darkestdungeon.wiki.gg/wiki/Curios)

### 1.10 캠핑

| 항목 | 규칙 | 출처 |
|---|---|---|
| 조건 | 장작 1개, 입구가 아닌 정리된 방 | [Camping](https://darkestdungeon.wiki.gg/wiki/Camping) |
| 식사(4인 기준) | 굶기 0(HP −20%, 스트레스 +15) / 반 끼 2(효과 없음) / 한 끼 4(HP +10%) / 잔치 8(HP +25%, 스트레스 −10). 사망자 1명당 필요량이 ¼씩 줄어든다(3인 잔치 = 6) | 〃 |
| 여유(Respite) | **12점**(특정 DLC 조합은 14) | 〃 |
| 캠프 스킬 | 영웅당 3개로 시작해 최대 4개. Survivalist에서 배우고 원정 중에도 바꿀 수 있다. 비용 1–5. 공용 예: Encourage(2, 동료 스트레스 −15), Wound Care(2, HP 15% + Bleed·Blight 제거), Pep Talk(2, 4전투 동안 스트레스 피해 −15%). 버프는 대개 **4전투** 지속 | 〃 · [Camping Skills](https://darkestdungeon.wiki.gg/wiki/Camping_Skills) |
| 밤 습격 | **33%**. 항상 기습당하고, 빛이 0이 되며, 도주할 수 없다. 적은 그 던전의 일반 조합에서 무작위(보스 제외). 대신 어둠 보너스로 전리품이 좋다 | [Night-Time Ambush](https://darkestdungeon.wiki.gg/wiki/Night-Time_Ambush) |
| 습격 방지 | Zealous Vigil·Bandit's Sense·Hound's Watch·Sanctuary(4점), Unspeakable Commune(3점) | 〃 · [Camping Skills](https://darkestdungeon.wiki.gg/wiki/Camping_Skills) |
| 빛 | 캠프 뒤 100 | [Camping](https://darkestdungeon.wiki.gg/wiki/Camping) |

### 1.11 철수·포기·전멸

| 상황 | 규칙 | 출처 |
|---|---|---|
| 전투 도주 | 영웅 턴에 깃발을 누른다. **첫 시도 70%, 시도마다 +5%**. 실패하면 그 턴을 날린다. 성공하면 **스트레스 +25**. 방 전투면 들어온 복도로, 복도 전투면 이전 방으로 물러난다. 그 전투는 그대로 남는다 | [Retreating](https://darkestdungeon.wiki.gg/wiki/Retreating) |
| 도주 불가 | 기습당한 첫 라운드, Shrieker, 최종 보스, 밤 습격 | 〃 · [Night-Time Ambush](https://darkestdungeon.wiki.gg/wiki/Night-Time_Ambush) |
| 원정 포기 | 전투 밖에서 언제든, 100% 성공. **스트레스 +20**(수정치 무시, 100을 넘어도 판정 없음). 부정 퀵 확률이 오른다. **전리품은 유지, 퀘스트 보상은 잃는다** | [Retreating](https://darkestdungeon.wiki.gg/wiki/Retreating) · [Expedition](https://darkestdungeon.wiki.gg/wiki/Expedition) |
| 목표 달성 후 | 전투 밖이면 대가 없이 바로 귀환한다(입구까지 걸어갈 필요 없음) | [Expedition](https://darkestdungeon.wiki.gg/wiki/Expedition) |
| 전멸 | 모은 전리품을 모두 잃는다. 이미 달성한 목표의 보상은 받는다 | 〃 |
| Darkest Dungeon | 포기·도주하면 1명이 희생된다(혼자 남은 경우는 제외) | [Darkest Dungeon (location)](https://darkestdungeon.wiki.gg/wiki/Darkest_Dungeon_(location)) |

### 1.12 보스 굴과 떠도는 위협

| 유형 | 내용 | 출처 |
|---|---|---|
| 보스 퀘스트 | 항상 중간 길이. 보스는 입구에서 가장 먼 방에 있다. 일반 퀘스트를 완료해 진척을 쌓아야 열린다(§1.1) | [Quest](https://darkestdungeon.wiki.gg/wiki/Quest) · [Dungeon map](https://darkestdungeon.wiki.gg/wiki/Dungeon_map) |
| 떠도는 보스 | Collector(복도에 나타난다. 도주한 뒤 그 복도에 다시 들어가면 또 나온다), Shambler(빛 0 복도 전투, 또는 Shambler's Altar에 횃불), Fanatic(Crimson Court, 감염 영웅이 많은 파티를 노린다) | [Retreating](https://darkestdungeon.wiki.gg/wiki/Retreating) · [Ruins](https://darkestdungeon.wiki.gg/wiki/Ruins) · [Courtyard](https://darkestdungeon.wiki.gg/wiki/Courtyard) |
| Darkest Dungeon | 퀘스트 4개(중간·긺·Exhausting·짧음). 배치와 전투가 고정이다. 덫·장애물·밤 습격이 없고, 일반 전투는 전리품이 없다. 최종 퀘스트는 횃불·음식이 필요 없다 | [Darkest Dungeon (location)](https://darkestdungeon.wiki.gg/wiki/Darkest_Dungeon_(location)) |

### 1.13 지역별 탐험 규칙

| 지역 | 지도 | 덫 | 핵심 보급 | 고유 규칙 |
|---|---|---|---|---|
| Ruins | 복도 미로 | 물리(최대 HP 25–30%) | 성수·열쇠 | 음식 기물이 없다 |
| Warrens | 3×4 격자, 첫 방에서 거의 다 정찰된다 | Bleed·Blight | 해독제·약초·붕대·성수 | 음식 기물 4종. 약초 없이 먹으면 질병 12.5–25% |
| Weald | 길고 구불구불, 되돌아가기가 잦다 | Blight | 삽(장애물 최다)·해독제·약초 | 사체 + 약초 → 음식 2 |
| Cove | ❓(위키에 설명 없음) | Bleed·Blight·디버프 | 삽·열쇠·약초 | 기물에서 질병 |
| Courtyard (DLC) | Epic 퀘스트는 방 단위로 공개 | 고피해·적 소환 | 횃불(Shifting Mists 제거) | Bloodlight 고정, 칸마다 스트레스 1. 초대장 1장으로 시작·재개하고, 떠나도 스트레스가 없으며 이어서 할 수 있다. 장작은 Wine Crate + 삽에서만 |
| Farmstead (DLC) | 탐험 없음: 웨이브(10킬) → 방(기물 1개) | 없음 | 열쇠(Stockpile) | 허기·장작 없음. Miller's Hearth에서 캠핑. 도주 페널티 없음 |
| Darkest Dungeon | 고정 | 없음 | 음식·횃불·붕대·해독제(삽·열쇠·Laudanum은 쓸모없음) | 철수하면 희생, Never Again |

출처: 각 지역 위키 페이지([Ruins](https://darkestdungeon.wiki.gg/wiki/Ruins) · [Warrens](https://darkestdungeon.wiki.gg/wiki/Warrens) · [Weald](https://darkestdungeon.wiki.gg/wiki/Weald) · [Cove](https://darkestdungeon.wiki.gg/wiki/Cove) · [Courtyard](https://darkestdungeon.wiki.gg/wiki/Courtyard) · [Farmstead](https://darkestdungeon.wiki.gg/wiki/Farmstead) · [DD location](https://darkestdungeon.wiki.gg/wiki/Darkest_Dungeon_(location)))

### 1.14 탐험에 대한 비판과 DD2의 대응

| 비판 | 근거 | DD1 안에서의 완화 | DD2의 대응 |
|---|---|---|---|
| **무작위 허기** | "fed every 200 meters", "every 2nd or at most 3rd room"(Daikataro, [Steam 2017](https://steamcommunity.com/app/262060/discussions/0/135509124606679272)). 먹은 직후 3칸 연속으로 허기(Macdallan, [Steam 2015](https://steamcommunity.com/app/262060/discussions/0/487870763316839396/?ctp=2)). "허기를 횃불 같은 게이지로" 바꾸자는 제안도 있다 | 지금 위키 기준으로는 허기 버퍼가 있다(도입 시점 ❓). Mill 지구가 허기 판정을 없앤다 | 허기 판정이 없다고 알려져 있다 ❓(위키에서 확인 못 함) |
| **되돌아가기** | 뒤로 걸으면 스트레스, 재출현, 빛 소모. Weald의 긴 길, 탐사 90% 목표 | 지나온 칸은 빛 −1 | 길이 한 방향이고 갈림길에서 고른다 ([NME](https://www.nme.com/features/darkest-dungeon-2-how-redhook-studios-are-reinventing-their-roguelike-classic-3085987)) |
| **짐 부족** | 16칸을 함께 쓰다가 전리품을 버린다(§1.8) | 보급을 써서 칸을 비운다 | 역마차 칸이 정해져 있고, 넘치면 버려야 진행한다(검색 요약) — 문제는 남았다 |
| **복도 RNG** | 정찰 안 된 덫·전투, 빛 0의 Shambler | 정찰·트링킷·캠프 스킬 | 길 종류 5가지를 보여 준다. Watchtower가 지역 전체를 공개한다 ([Roads](https://darkestdungeon.wiki.gg/wiki/Roads)) |
| **밤 습격** | 33%, 항상 기습당하고 빛 0, 도주 불가 | 방지 스킬 5종 | 캠핑이 사라지고 지역 끝 여관에서 쉰다 ([The Inn](https://darkestdungeon.wiki.gg/wiki/The_Inn)) |
| **늘어짐** | 엔드게임 제약으로 게임이 지나치게 길어진다([RPGamer](https://rpgamer.com/review/darkest-dungeon-review/), 검색 요약) | — | 약 4시간짜리 단일 여정 ([NME](https://www.nme.com/features/darkest-dungeon-2-how-redhook-studios-are-reinventing-their-roguelike-classic-3085987)) |

- 빛 체계 자체는 리뷰에서 결함보다 **위험·보상 장치**로 평가받는다.
  어두울수록 적이 세지고 전리품이 좋아져서 "밀고 갈지 돌아갈지"가 간단하지 않다는 평이다([Giant Bomb 유저 리뷰](https://giantbomb.com/user-reviews/id/65194/swords-to-rust-hearts-to-dust), 검색 요약).

---

## 2. Darkest Dungeon 2 — 길과 지역 지도 (대조용)

### 2.1 구조

| 요소 | 규칙 | 출처 |
|---|---|---|
| 여정 | Altar of Hope → Crossroads(파티 구성) → 지역 여러 개 → Mountain(고해 보스). 끝까지 가면 약 4시간 | [Regions](https://darkestdungeon.wiki.gg/wiki/Regions) · [NME](https://www.nme.com/features/darkest-dungeon-2-how-redhook-studios-are-reinventing-their-roguelike-classic-3085987) |
| 지역 | 본편 4개(Sprawl·Tangle·Foetor·Shroud) + Tundra(Kingdoms 전용) + 보너스 2개(Sluice·Catacombs). 고해마다 지나는 지역 수가 다르다(수 ❓) | [Regions](https://darkestdungeon.wiki.gg/wiki/Regions) |
| 지역 안 | 노드를 길로 잇는다. StS처럼 갈림길이 있는 좁은 길이고, 처음에는 일부만 보인다 | 〃 · NME |
| 노드 | Shrine of Reflection · Hoarder · Field Hospital · Desperate Few · Resistance · Oblivion's Ingress · Creature Den · Oasis · Watchtower · Academic's Cache/Study · Chirurgeon's Table · **Oblivion's Rampart(지역 끝 전투)** · Inn, 그리고 Lair(항상 공개, 지역 목표) | [Regions](https://darkestdungeon.wiki.gg/wiki/Regions) |
| 길 5종 | 전투(길 전투) / 위험(갑옷 −1) / 험로(바퀴 −1) / 균열(Loathing +1) / 안전. 갑옷이나 바퀴가 없으면 습격(수리 전투). 잔해를 밟으면 전리품이 나오기도 한다 | [Roads](https://darkestdungeon.wiki.gg/wiki/Roads) |
| 정찰 | 지역에 들어갈 때 노드·길이 숨겨지거나 공개된다(퀵·마차 아이템·펫·지역 수식어). Watchtower에 가면 그 뒤가 전부 보인다 | 〃 |
| 여관 | 지역마다 끝에 1개. HP 25 / 50 / 100% 회복, 스트레스 −1~3, 숙련 훈련·상점·마차 수리. 다음 지역 2–3개 중 하나를 고른다(수식어·목표 표시) | [The Inn](https://darkestdungeon.wiki.gg/wiki/The_Inn) · [Roads](https://darkestdungeon.wiki.gg/wiki/Roads) |
| Kingdoms (2025) | 여관·캠프 격자 지도에서 하루 1회 이동. 지역은 **40리그 = 노드 3개**로 짧아지고, 노드 사이 불꽃 소모가 그만큼 커진다. 여관 아이템 효과는 대개 3지역 | [Kingdoms](https://darkestdungeon.wiki.gg/wiki/Kingdoms) |

### 2.2 불꽃(Flame) — DD1 횃불의 후속

| 항목 | 규칙 |
|---|---|
| 범위 | 0–100. **새 지역에 들어가면 100** |
| 소모 | 이동하면서 저절로 준다(기본값 ❓). Loathing과 지역 수식어(±33%)가 속도를 바꾼다. **전투를 질질 끌면(stalling)** 줄고, 일부 적 공격도 깎는다 |
| 회복 | 도움 조우 +15~30, 전투 노드(Ingress·Lair·Rampart)를 마치면 조금, Glimmer of Hope +15. "이기적 선택"은 불꽃을 깎는 대신 보상이 크다 |
| 구간(Denial 기준) | Bright 100–76: 즉사 저항 +6%, 라운드 시작 Blind 10% · Dim 75–51: +3%, 5% · Shadowy 50–26: −3%, 적 선공 +15% · Darkness 25–1: −6%, Blind 5%, 적 선공 +33% · Pitch 0: −9%, Blind 10%, 적 선공 +100% |
| 0 / 30 미만 | 0이면 Cultist가 습격한다(이기면 +40). 30 미만이면 길 전투에 Shambler가 나올 수 있다 |
| 고해별 차이 | 고해 5개가 구간 효과를 따로 가진다(예: Obsession은 받는 치유 +33% → −50%) |
| 쉬운 모드 | Radiant Flame: 실패할수록 강해진다(이동 소모 −25%, 버프 2–5개) |

출처: [Flame](https://darkestdungeon.wiki.gg/wiki/Flame).
→ DD1과 달리 **어둠의 전리품 보너스가 없다**(Infernal Flame "Stygian Blaze" 예외). 어둠이 순수한 위험이 됐다.

### 2.3 왜 바꿨나, 어떻게 받아들여졌나

| 구분 | 내용 | 출처 |
|---|---|---|
| 의도 | Sigman: 햄릿 다음에 또 거점을 만드는 것은 "lacklustre"했다. "Freeing things up from a single base allowed us to lean into the journey aspect." Bourassa: 판을 키우고 햄릿 밖 세계를 보여 주고 싶었다 | [NME](https://www.nme.com/features/darkest-dungeon-2-how-redhook-studios-are-reinventing-their-roguelike-classic-3085987) |
| 의도 | "Oregon Trail meets Darkest Dungeon". "journeys are powerful because they are so easy to explain", "How much flour? How many bullets?" — 여정의 핵심은 자원 결정이다 | [Superjump](https://superjumpmagazine.com/exploring-the-darkness-tyler-sigman-talks-about-co-creating-the-darkest-dungeon-games) |
| 호평 | 이동이 게임북처럼 위험·보상 선택을 준다. 스킬·망루로 미리 정찰할 수 있다 | [TheSixthAxis 7/10](https://www.thesixthaxis.com/?p=440690) |
| 혹평 | "원작의 보드게임 같은 이동이 더 좋았다". 마차 이동이 반복적이고 성가시며, 결과가 RNG에 맡겨진다 | 〃 |
| 혹평 | 마차가 1편의 자유로운 탐험을 없앴다([Vaporlens](https://vaporlens.app/app/1940340/darkest_dungeon_ii), AI 요약 ⚠️). "던전이 없다, 전투에서 전투로 가는 건틀릿, 장기 자원 관리가 없다"(RPGHQ 포럼, 검색 요약) | — |
| 옹호 | "1편의 지루한 그라인드를 빼고 전투를 앞세웠다"(Steam 유저, 검색 요약). 반복해서 하는 빠른 로그라이트(Push Square 7/10) | [Push Square](https://www.pushsquare.com/reviews/ps5/darkest-dungeon-2) |
| 수치 | Steam 75%(12,160). Metacritic 81(systems-reference) / 82([Wikipedia](https://en.wikipedia.org/wiki/Darkest_Dungeon_II)) ⚠️. 유저 점수 6.1(검색 요약) | — |

> **시사점**: DD2는 되돌아가기·허기·짐 문제를 **공간을 없애서** 풀었다. 그 대가로 "어디로 갈지"가 갈림길 선택으로 줄었고, 반발이 따랐다.
> 우리는 공간을 남기고 **지루함의 원인(되돌아가기 비용·무작위 허기·슬롯 테트리스)만 없애는** 쪽이 맞다.

---

## 3. 공간 탐험이 있는 덱빌더

### 3.1 비교

| 게임 | 평판 | 지도 구조 | 런당 전투 | 보상 주기 | 휴식·캠프 | 탐험이 쓰는 자원 |
|---|---|---|---|---|---|---|
| **Roguebook** (2021) | Steam 84%(2,001), MC 78 | 장마다 안개 덮인 **육각 지도**. 붓(반경 2)과 잉크(직선 3칸, 상위 잉크 4·5칸)로 칠해서 공개한다. 이동 제한은 없다 | 장 3개 + 보스. 대부분의 전투는 선택이다. 장당 수 ❓ | 전투마다 **잉크·붓 보장** + 골드. 카드는 지도의 "지혜의 금고"(드래프트)·상점·레벨업에서 얻는다. 지도의 보석은 카드 소켓에 박아 강화한다. 덱 크기 임계치마다 재능 | ❓(칠하기 아이템에 Heart가 있으나 효과 미확인) | 잉크·붓(전투로 다시 채움) |
| **Gordian Quest** | Steam 87%(1,852), Gamingtrend 85, COG 80 | 막 4개, 막마다 지도와 거점(Garrison)이 있다. 칸으로 이동하면 이벤트(전투·상자). 던전은 깊이가 다양하다. Area 모드는 사다리(아미다쿠지)형 경로이고 되돌아갈 수 없다 | ❓ | 전투 → XP·골드·아이템. 레벨업 → 스킬 그리드(카드 추가·강화) | **DD식 캠프**: 정해진 시간을 활동에 나눈다(카드 제작 수 시간, 채집 1시간). 회복·강화·카드 획득 | **보급**: 걷거나 캠프하면 줄고, 0이면 걸음마다 Exhaustion(쓸 수 없는 Waste 카드). 판정에 카드를 바치면 휴식 전까지 그 카드가 소진된다 |
| **Book of Demons** (2018) | Steam 90%(3,869) 새로 조회 | 실시간 던전 크롤러. **Flexiscope**: 슬라이더로 던전 길이(약 10분–1시간)를 고르고, 게임이 플레이 속도를 배워 시간을 예측한다 | 길이에 비례 | 카드 = 아이템·주문·스킬, 룬으로 강화 | ❓ | 세션 시간 |
| **Iratus** (2020) | Steam 84%(2,978) 새로 조회, MC 78 | 지도를 이동하며 전투·퀘스트·상자를 만난다. DD식 전투 | ❓ | 시체 재료로 하수인 제작 | ❓ | 거의 없음 — "탐험은 아주 단순하고 전투에 무게"(TechRaptor), "던전을 탐험하는 게 아니라 속도감"(Prima) (둘 다 검색 요약 ⚠️) |
| **Gloomhaven** (디지털, 2021) | Steam 81%(10,277) 새로 조회 | 시나리오 단위로 방을 연다 | 시나리오 1 = 전투 1 | 시나리오 보상 | 짧은 휴식: 버린 카드 중 무작위 1장 영구 상실 / 긴 휴식: 1장 골라 상실 + 회복 2 + 아이템 재충전. 손패 2장을 낼 수도 쉴 수도 없으면 탈진 | **카드 자체가 체력 시계** |

출처:
- Roguebook — [Game*Spark](https://www.gamespark.jp/article/2021/06/29/110002.html) · [KeenGamer 7.5](https://www.keengamer.com/articles/reviews/pc-reviews/roguebook-review-pc-slay-the-book/) · [Opinionated Gamers](https://opinionatedgamers.com/2021/07/13/dale-yu-review-of-roguebook-pc-game-on-steam/) · [GamePretty](https://gamepretty.com/roguebook-beginner-guide-tips/)
- Gordian Quest — [Gamingtrend](https://gamingtrend.com/gordian-quest-review-deckbuilding-dungeons-and-dice/) · [GIGAZINE](https://gigazine.net/gsc_news/en/20210223-gordian-quest) · [StackUp](https://www.stackup.org/amp/gordian-quest-basics-guide) · [COG](https://cogconnected.com/review/gordian-quest-review/)
- 기타 — [Book of Demons Steam](https://store.steampowered.com/app/449960/Book_of_Demons/) · [Iratus Steam](https://store.steampowered.com/app/807120/Iratus_Lord_of_the_Dead/) · [Iratus Wikipedia](https://en.wikipedia.org/wiki/Iratus:_Lord_of_the_Dead) · [Gloomhaven Steam](https://store.steampowered.com/app/780290/Gloomhaven/) · [Gloomhaven 휴식 규칙](https://rules.dized.com/gloomhaven/rule/resting-1/short-rest)(검색 요약)

### 3.2 메모 — 탐험이 덱에 들어가는 방식

- **Roguebook — 탐험 자원 고리**: 전투 → 잉크 → 지도 공개 → 카드·보석·골드 → 더 강한 덱 → 더 많은 전투.
  - 보스로 가는 길은 늘 열려 있다. 잉크가 떨어지면 보스로 간다. 한 판은 60–120분이고 세 레벨로 이뤄진다(Opinionated Gamers).
  - 공략 우선순위: 넓게 밝히는 Sky Tower → 전투 → Rune → 보석·연금술사(GamePretty).
  - 재능은 덱 크기 임계치에서 열린다. 임계치는 14/18/22/26/30/34([GamePretty](https://gamepretty.com/roguebook-all-talents-list-how-to-unlock/))라는 서술과 첫 단계 15([LadiesGamers](https://ladiesgamers.com/roguebook-headed-for-steam-switch-and-more/))라는 서술이 엇갈린다 ⚠️. 카드를 많이 모으게 하는 장치다.
  - 비판
    - 지도를 다 볼 수 없어서 운에 좌우된다(PC Gamer 78, 검색 요약).
    - 잉크 운이 나쁘면 약한 채로 진행한다.
    - 덱이 강하면 마지막 장이 전투 1회로 줄어든다(KeenGamer).
- **Gordian Quest — 보급이 덱을 오염시킨다.**
  - 보급이 바닥나거나 캠프에서 강화하면 쓸 수 없는 Waste 카드가 덱에 들어와 손패를 막는다(GIGAZINE, StackUp).
  - 이벤트 d20 판정에 카드를 바쳐 보정을 받으면, 그 카드는 휴식 전까지 소진된다(Gamingtrend).
  - 휴식(캠프·마을·소모품)이 이를 지운다.
  - 비판: 막 4개가 비슷하고 반복적이다(COG 80).
- **Book of Demons** — 원정 길이를 **플레이어가 고르는** 선례다. 짧은 세션은 호평이고, 긴 세션은 지루해진다는 평이 있다([COGconnected](https://cogconnected.com/review/book-of-demons-review/), 검색 요약).
- **Iratus** — DD 전투를 가져오면서 탐험은 줄였다. 프리뷰에서 탐험이 "가장 재미없고 가장 쉬운 부분"이라는 평을 받았다(Cubed3, 검색 요약).
- **Gloomhaven** — 덱이 아니라 손패가 닳아서 시간을 잰다. **휴식 = 카드 1장 영구 상실**이라는 강한 결합이다. 런 덱빌더가 아니라서 개념만 참고한다.

---

## 4. Slay the Spire 지도 — 대체할 기준선

### 4.1 규칙

| 항목 | 규칙 | 출처 |
|---|---|---|
| 막 구조 | 3막(+ 열쇠를 모으면 4막). 1막은 17층: 1층 일반 전투(쉬운 풀), 9층 보물, **15층 휴식처**, 16층 보스, 17층 보스 상자. 2·3막도 같은 배치 | [Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation) |
| 격자 | 7×15 격자에서 경로를 6번 생성한다. 경로는 교차하지 않고, 시작점은 최소 2개 | [kosgames](https://kosgames.com/slay-the-spire-map-generation-guide-26769/) |
| 확률 | 일반 53% · 미지 22% · 휴식 12% · 엘리트 8% · 상인 5% (Ascension 1+: 엘리트 16%, 일반 45%) | [Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation) · kosgames |
| 배치 규칙 | 엘리트·휴식처는 6층 미만에 없음. 엘리트·상인·휴식처는 연달아 나오지 않음. 갈림길의 목적지는 서로 달라야 함. 14층에는 휴식처 없음 | kosgames |
| 미지(?) | 들어갈 때 전투·상인·보물·이벤트 중 하나로 정해진다. 나온 종류의 확률은 기본값으로 돌아가고, 나머지는 오른다 | [Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation) |
| 보상 | 일반 전투: 골드 10–20, 카드 3택, 가끔 포션. 엘리트: 유물 + 골드 25–35 + 카드 3택(희귀 확률↑). 1·2막 보스: 골드 95–105, 희귀 카드 3택, 보스 유물 3택 | [Map Locations](https://slaythespire.wiki.gg/wiki/Map_Locations) |
| 휴식처 | 회복(최대 HP 30%) **또는** 카드 1장 강화 | 〃 |
| 상인 | 캐릭터 카드 5 · 무색 카드 2 · 유물 3 · 포션 3, 카드 제거 1회 | 〃 |

### 4.2 페이싱 — 우리 추정

확률표로 단순 계산한 값이다. 경로 선택은 무시했다.

| 막당 | 값 | 계산 |
|---|---|---|
| 무작위 층 | 12층(2–8, 10–14) | — |
| 일반 전투 | 약 7–8 | 1층 1회 + 12 × 53% ≈ 6.4 (+ 미지 일부) |
| 엘리트 | 약 1 (공격적인 경로라면 2–3) | 12 × 8% |
| 휴식처 | 약 2–3 | 15층 1회 + 12 × 12% ≈ 1.4 |
| 상인 / 미지 | 약 0.6 / 약 2.6 | 12 × 5% / 12 × 22% |
| **전투 합계(보스 포함)** | **약 10** | — |
| 런(3막) | 전투 약 30, 카드 보상 화면 약 28, 강화 4–6, 제거 0–3 | — |

→ **"1막 = 전투 약 10 + 휴식 2–3 + 상점 1 + 이벤트 2–3"**을 비교 단위로 쓴다.

---

## 5. 종합 — 「저승굿」 탐험 레이어

전제(기존 설계): 3인 공유 덱, 시작 덱 12장, 카드 보상 3택(영웅마다 1장), 원정 동안 HP 유지, 원정이 끝나면 덱 리셋([`02-core-rules.md`](../02-core-rules.md) §1·§9).

### 5.1 탐험 메커닉 × 목적 × 판정

| DD 메커닉 | 목적(무엇을 만드나) | 판정 | 덱빌더용 변형 |
|---|---|---|---|
| 방·복도 격자 + 길이 3단계 | 경로 계획, 원정 규모 선택 | **유지** | 방 수는 DD 수준. 고리형 연결을 늘려 막다른 길을 줄인다 |
| 빛(0–100, 5구간) | 유일한 시계 + 위험/보상 다이얼 | **유지·변형** | 넋등. 어둠은 상태 카드와 보상 선택지로 덱에 닿는다(§5.3) |
| 정찰 | 정보 → 경로 선택 | **유지** | 영웅 카드·캠프 행동이 정찰을 올린다. "덫은 정찰로만 보인다"는 규칙 유지 |
| 기습·선제 | 전투 시작 조건의 변동 | **변형** | 덱 언어로 바꾼다: 선제 = 첫 턴 드로우 +2, 기습당함 = 첫 턴 드로우 −2 |
| 복도 전투 | 이동에 위험을 붙인다 | **유지** | 생성된 복도 전투는 카드 보상 있음 |
| 재출현 | (의도와 달리) 파밍을 부른다 | **변형** | 넋등이 어둠(≤25) 이하일 때만 재출현. 보상은 엽전뿐 |
| 덫 | 정찰의 가치, 영웅 차별화 | **변형** | 해제 = 영웅 속성 판정. 실패하면 그 영웅이 주인인 상태 카드(상처) + HP |
| 장애물 + 삽 | 보급 계획 | **변형** | 저승 관문 → 노잣돈으로 통과. 억지로 지나가면 HP·스트레스·넋등을 잃는다 |
| 무작위 허기 칸 | 시간 압박, 음식 소비 | **폐기** | 끼니는 캠프에서만 먹는다. 시계는 넋등 하나 |
| 보급품 9종 | 출발 전 계획, 기물 지식 | **축소** | 6종, 종류별 고정 칸 |
| 16칸 공유 인벤토리 | 더 갈까 / 돌아갈까 | **변형** | 보급 칸과 전리품을 분리한다. 본진 재료만 무게 한도 |
| 기물 + 보급품 상호작용 | 이벤트·지식 보상 | **유지·강화** | 영웅별 선택지를 둬서 파티가 결과를 바꾸게 한다. 처음 발견한 뒤에는 힌트를 준다 |
| 캠핑(여유 12, 영웅별 스킬) | 중간 회복·버프·이야기 | **유지·확장** | 길굿 = 강화·제거·장례·인연 + 끼니(§5.4) |
| 밤 습격 33% | 캠핑의 대가 | **변형** | 확률을 미리 보여 주고, 쌀이나 망보기로 0%로 만들 수 있게 |
| 전투 도주 70%(+5%), 원정 포기 | 탈출구, 밀어붙이기의 하한 | **유지** | 보스·습격 전투는 도주 불가. 목표를 달성하면 바로 귀환 |
| 퀘스트 유형 | 원정마다 다른 경로 압력 | **변형** | 탐사 목표 75%. 수집·활성화 대상의 위치는 처음부터 표시 |
| 지역 고유 규칙 | 지역 정체성 | **유지** | 지역 = 지도 모양 × 덫 상태 카드 × 필요 보급 |
| 떠도는 보스 | 긴장 | **변형** | 칠흑에서만 나온다. 나오기 전에 경고 연출 |

### 5.2 덱 성장 페이싱 — 원정 길이 단계

원칙
1. **카드 보상은 처음 치르는 전투에서만 준다**(방 전투, 생성된 복도 전투, 밤 습격).
   재출현 전투는 엽전·재료만 준다 → DD식 복도 파밍을 막는다.
2. 보상은 3택이고 영웅마다 1장씩이다. 수호 방(엘리트)은 희귀 확률이 오르고 신물(유물)을 준다.
3. 강화·제거는 **캠프가 주 경로**, 기물이 보조 경로다.

| 단계 | 방 | 첫 전투(카드 보상) | 수호 방 | 길굿 | 기물 | 끝 덱(채택률 70% 가정) | 강화 | 제거 | 목표 시간 | StS 대비 |
|---|---|---|---|---|---|---|---|---|---|---|
| 짧은 길 | 8–9 | 5–6 | 0–1 | 0 | 4–6 | ≈16장 | 기물 0–1 | 기물 0–1 | 20–30분 | 막 ½ |
| 중간 길 | 12–13 | 9–11 | 1–2 | 1 | 8–10 | ≈19–20장 | 2–3 | 1 | 45–60분 | **막 1** |
| 긴 길 | 16–17 | 13–16 | 2–3 | 2 | 12–15 | ≈22–23장 | 4–6 | 1–2 | 75–100분 | 막 1.5 |
| 보스 길 | 중간 + 보스 굴 | 9–11 + 보스 | 1–2 | 1 | 8–10 | ≈20장 | 2–3 | 1 | 약 60분 | 막 1 + 보스 |

- 근거
  - DD 짧은 원정은 방 9개에 전투 3–7회, 긴 원정은 방 16–17개(§1.2). 장작은 0 / 1 / 2.
  - StS 1막은 전투 약 10회에 휴식 2–3회(§4.2).
- **덱이 원정마다 리셋되므로(H5) 짧은 길에서는 덱이 거의 자라지 않는다.**
  짧은 길은 재료·인연·숙련을 얻는 원정으로 두고, 덱빌딩의 재미는 중간 길 이상에서 나오게 한다.
- 후반 선택지: **"깊은 원정"** = 긴 길 두 개를 길굿으로 잇는다(StS 2–3막에 해당). 덱 완성 쾌감을 따로 준다.
- 보스 굴은 위치와 보스 정체를 원정 시작 때 공개한다.
  StS 지도의 보스 아이콘, Roguebook의 최종 보스 공개 장식처럼 **보스를 보고 덱을 짜게** 한다(StS 보스 아이콘은 일반 상식 ⚠️).

### 5.3 넋등·보급품 ↔ 덱

**넋등 구간** — 출발값이다. DD1 수치를 빌렸고, Phase 7 시뮬레이션에서 조정한다.

| 넋등 | 정찰 | 전투 시작 | 적 | 카드 보상 | 엽전 | 스트레스 |
|---|---|---|---|---|---|---|
| 환함 100–76 | +15%p | 선제 확률 +25% | — | 3택 | — | — |
| 흐림 75–51 | +7.5%p | 선제 +15% | — | 3택 | +25% | +10% |
| 어스름 50–26 | — | 기습당함 +15%, **그늘 1장** | 피해 +10% | 3택, 희귀 확률↑ | +50% | +20% |
| 어둠 25–1 | — | 기습당함 +25%, **그늘 2장** | 피해 +15% | **4택** | +75% | +30% |
| 칠흑 0 | — | 기습당함 +40%, **그늘 3장** | 피해 +25%, 저승 그림자 출현 가능 | 4택 + 희귀 1장 보장 | +100% | +40% |

| 장치 | 규칙(제안) | 덱과의 고리 | 근거 |
|---|---|---|---|
| **그늘**(상태 카드) | 사용 불가·휘발. 전투를 시작할 때 넋등 구간만큼 뽑을 더미에 섞인다 | 어둠이 손패를 막는다. 덱이 클수록 덜 아프다 → 큰 덱에 보상을 주는 장치(Roguebook 재능)와 이어 붙일 수 있다 | GQ Waste 카드, StS 상태 카드 |
| 촛불 사용(전투 중) | 행동 비용 0, 넋등 +25, 손패의 그늘을 모두 소멸 | 보급품이 전투 중 포션 역할을 한다 | DD 횃불은 전투 중에도 쓸 수 있다 |
| **어둠의 소비자** | 일부 영웅 카드만 "손에 그늘이 있으면 …", "그늘을 소멸시키고 …" | 어둠 전략이 **파티 구성의 선택**이 된다(소비자는 1–2명, findings R2) | DD Occultist Dark Ritual, 저조도 트링킷 |
| 보상 선택지 | 어둠 이하에서는 4택 | 위험을 덱 품질과 맞바꾼다. DD의 "어둠 = 전리품"을 덱 언어로 옮긴 것 | DD 추가 전리품 25–95% |
| 스트레스 배율 | 어두울수록 스트레스가 늘고, 50/100 임계에서 씌임(동요) 카드가 들어온다 | 넋등이 영웅의 정신을 거쳐 덱에 닿는다 | core-rules §7 |
| 술 | 스트레스 −10, 서낭당·무덤 공양 | 씌임 카드를 예방한다 | DD Laudanum·성수 |
| 부적 | 잠긴 기물·봉인 해제. 원정 중 씌임 카드 1장 정화 | 저주 관리 | DD 열쇠·성수 |
| 노잣돈(지전) | 관문 통과, 저승차사를 매수해 복도 전투 1회 회피 | **전투를 돈으로 피하면 카드 보상도 포기한다** → 덱 성장과 체력 보존을 맞바꾼다 | DD 삽, DD2 이기적 선택 |
| 쌀 | 캠프 끼니(회복·스트레스), 뒷전 차림(습격 방지) | 캠프 행동 예산 | DD 식사 |
| 향 | 기물 정화, 점(정찰 확장), 신당 상호작용 | 정보 → 경로 → 전투 선택 | DD 성수, 정찰 |

- **상한 규칙**: 그늘(어둠) + 씌임(스트레스) + 상처(덫)가 한꺼번에 쌓이면 데스 스파이럴이 생긴다.
  전투 1회에 새로 들어오는 상태 카드는 최대 4장으로 제한하고, 그늘은 휘발이라 덱에 남지 않게 한다.
- **보급품 칸**: 종류마다 고정 칸 1개(묶음 한도 DD 수준: 촛불 8, 쌀 12, 나머지 4–6). 엽전은 무제한이다.
  본진 재료만 무게 한도를 둬서 "더 갈까"를 남긴다(재료 경제는 본진 문서 범위).
- **출발 화면**: 길이·지역별 **권장량**을 보여 준다. DD는 공식 권장량이 없어서 포럼 지식에 기댔다(§1.7).

### 5.4 길굿(캠프) = 덱빌더의 휴식처

| 항목 | 제안 | 근거 |
|---|---|---|
| 횟수 | 중간 1, 긴 2. 허가 아이템 "굿상 차림"을 길이에 따라 지급 | DD 장작 0 / 1 / 2 |
| 끼니(쌀, 3인 기준) | 굶김 0: HP −20%, 스트레스 +15 / 반상 2: 효과 없음 / 밥상 3: HP +10% / 잔칫상 6: HP +25%, 스트레스 −10 | DD 식사(3인 잔치 6) |
| 여유 | 12점 | DD |
| 굿거리 | 영웅마다 4개를 장착하고 그중에서 쓴다. 공용 + 영웅 고유 | DD 3–4개 |
| 밤 습격 | 기본 25%, 캠프 전에 표시한다. **뒷전 차림(쌀 2)** 또는 망보기를 하면 0%. 습격을 받으면 기습당함 확정(첫 턴 드로우 −2), 도주 불가, 카드 보상 4택 | DD 33%·항상 기습·빛 0·도주 불가 |
| 넋등 | 캠프 뒤 100 | DD |

| 굿거리(캠프 행동) | 여유 | 효과 | 덱 | 제한 |
|---|---|---|---|---|
| 다듬기 | 4 | 이 영웅의 카드 1장 강화 | 강화 | 영웅당 캠프 1회 |
| 덜어내기 | 5 | 덱에서 카드 1장 제거(누구 카드든) | **제거** | 캠프당 1회 |
| 상처 돌보기 | 2 | 동료 HP 15%, 상처 해제 | — | 공용 |
| 다독이기 | 2 | 동료 스트레스 −15 | 씌임 예방 | 공용 |
| 넋 달래기 | 3 | 씌임 카드 1장 제거 | 저주 제거 | 무속형 영웅 |
| 망보기 | 3 | 밤 습격 방지 | — | 수호형 영웅 |
| 점치기 | 3 | 이웃 복도 2개 정찰 | 정보 | 탐색형 영웅 |
| 이야기 | 3 | 두 영웅의 인연 +2 | 합기 카드 해금 진행 | 공용 |
| 장례 | 4 | 애도 카드 정리 → 신물(유품) 1장 | core-rules §6 | 사망자가 있을 때 |
| 굿 연습 | 3 | 다음 3전투 동안 영웅 버프 | — | DD식 "4전투 버프" |

- **보정**: 여유 12점 ≈ 강화 2(8점) + 회복·스트레스(4점).
  StS 휴식처는 한 곳에서 "강화 1 또는 회복 30%" 중 하나이므로, **길굿 1회 ≈ StS 휴식처 2곳 + DD 캠프 버프**다.
  중간 길(길굿 1회 + 회복 기물)이 StS 1막의 휴식 2–3회와 비슷해진다.
- 강화·제거·장례·인연이 모두 같은 12점을 두고 경쟁한다. **"누구의 카드를 다듬을까, 누구의 마음을 돌볼까"가 한 화면의 결정이 된다.**

### 5.5 피해야 할 안티패턴

| # | 안티패턴 | 증상(사례) | 대책 |
|---|---|---|---|
| X1 | 되돌아가기 지루함 | 뒤로 걸을 때의 스트레스, 재출현, Weald 긴 길, 탐사 90%(DD1) | 방문한 방은 클릭하면 바로 이동(넋등만 칸당 −1). 고리형 배치, 탐사 75%, 목표 달성 즉시 귀환 |
| X2 | 무작위 허기 | "200미터마다 먹인다"(Steam) | 허기 칸 폐기, 끼니는 캠프에서만 |
| X3 | 인벤토리 테트리스 | 16칸 공유, 전리품 1/4 버림(DD1) | 보급 종류별 고정 칸, 엽전 무제한, 재료만 한도 |
| X4 | 불공정 기습 | 밤 습격(항상 기습·빛 0·도주 불가), 빛 0 Shambler(DD1) | 확률 표시와 방지 수단. 기습 페널티는 드로우 −2 수준으로 묶는다 |
| X5 | 복도 파밍 | 재출현 전투로 전리품 수확(DD1) | 재출현 = 카드 보상 없음, 어둠에서만 |
| X6 | 위키 지식 기물 | 맞는 보급품을 모르면 손해(책 더미 +100 스트레스) | 처음 발견하면 도감 힌트, 맞는 보급품 아이콘 |
| X7 | 시계가 둘 이상 | 빛 + 허기(DD1) | 넋등 하나 |
| X8 | 상태 카드 겹침 | 덱이 막혀 데스 스파이럴(GQ Waste, Roguebook 부활 카드) | 그늘은 휘발, 전투당 유입 상한 4 |
| X9 | 원정 장기화 | 긴 세션이 지루함(Book of Demons), 막 반복(GQ), 엔드게임 늘어짐(DD1) | 길이 3단계, 기본 60분 이내 |
| X10 | 탐험 = 운 | 잉크 운(Roguebook), "RNG에 맡김"(DD2) | 영웅 행동으로 **확정 정찰**하는 수단을 준다 |
| X11 | 공간 삭제 | "탐험이 사라졌다"(DD2) | 공간은 유지하고 지루함만 걷어낸다 |
| X12 | 길이가 덱 성장을 결정 | 짧은 원정은 덱이 안 자라서 덱빌딩이 사라짐 | 짧은 길의 역할을 재료·인연으로 분리, 덱 쾌감은 중간 길 이상 |

### 5.6 권고

1. **원정 = DD1식 방·복도 던전 1개, 길이 3단계 + 보스 길.**
   방 8–9 / 12–13 / 16–17, 카드 보상 전투 5–6 / 9–11 / 13–16, 길굿 0 / 1 / 2. **중간 길 = StS 1막**을 페이싱 기준으로 고정한다(§5.2).
2. **카드 보상은 처음 치르는 전투에서만.**
   재출현 전투는 엽전·재료만, 노잣돈으로 피한 전투는 보상 없음. 전투 수와 덱 성장이 지도 결정과 직결된다.
3. **넋등을 유일한 시계로.**
   새 칸 −6, 지나온 칸 −1, 촛불 +25, 5구간(DD1 그대로). 무작위 허기는 없앤다.
4. **어둠은 덱 언어로 표현한다.**
   그늘 상태 카드(휘발, 구간별 0–3장), 기습당함 = 드로우 −2, 어둠 이하 보상 4택·희귀↑.
   일부 영웅만 그늘을 소비하게 해서 "어둠 파티"가 덱 콘셉트가 되게 한다(findings P1·R2).
5. **보급품은 6종·고정 칸.**
   촛불·쌀·향·지전(노잣돈)·부적·술. 종류마다 주 기능 1개 + 기물용 기능 1개. 출발 화면에 길이·지역별 권장량을 보여 준다.
6. **길굿 = 휴식처의 확장.**
   여유 12점을 영웅별 굿거리에 나눠 쓴다(강화 4 · 제거 5 · 씌임 정화 3 · 인연 3 · 장례 4 …).
   끼니는 쌀로. 밤 습격은 표시하고 뒷전 차림·망보기로 막을 수 있게 한다.
7. **기물은 파티가 결과를 바꾸는 이벤트 층.**
   맨손 / 맞는 보급품 / **영웅 고유 선택지** 세 갈래로 만든다. 결과는 카드 추가·강화·변환·제거·씌임·인연·정찰로 덱과 메타에 닿는다.
   처음 발견한 뒤에는 도감 힌트를 준다.
8. **되돌아가기는 비용만 남기고 지루함을 없앤다.**
   방문한 방으로 즉시 이동(넋등만 소모). 고리형 배치, 탐사 75%, 목표를 달성하면 바로 귀환.
9. **정찰과 기습은 숫자를 보여 주고 결정적인 수단을 준다.**
   정찰은 확률(25% + 넋등) + 영웅 행동(점치기·장승)으로 확정. 선제(드로우 +2)·기습당함(드로우 −2) 확률은 전투 진입 전에 표시한다.
10. **지역 = 지도 모양 × 덫 상태 카드 × 필요 보급.**
    DD처럼 지역마다 보급 계획이 달라지게 한다. 예: 미로형 + 부적, 긴 길 + 지전, 격자형 + 술.
    철수 규칙은 DD1을 그대로 쓴다: 도주 70%(+5%)·스트레스 +25, 포기 시 스트레스 +20·전리품 유지·보상 상실, 전멸 시 전리품 상실.

### 5.7 「저승굿」 테마 1차 매핑

메커닉이 먼저이고 이름은 나중이다. 무속 용어의 정확성은 lore 조사(`docs/research/lore/*`)에서 다시 확인한다 ❓.

| 메커닉 | DD 원본 | 「저승굿」 이름(안) | 메모 |
|---|---|---|---|
| 원정 지도 | 던전 | 저승길 | 방 = 마당(터), 복도 = 길목 |
| 빛 | Light Meter | **넋등**(혼불) | 0 = 칠흑. "넋이 길을 잃는다" |
| 빛 보급 | Torch | 촛불 | +25 |
| 식량 | Food | 쌀(메) | 끼니·뒷전 차림 |
| 정화·공양 | Holy Water | 향 | 기물 정화, 점 |
| 통행·잠금 해제 | Shovel / Key | **지전(노잣돈)** | 저승 관문 통행료, 차사 매수 |
| 봉인 해제 | Key / Herbs | 부적 | 씌임 정화 |
| 스트레스 | Laudanum | 술(제주) | 공양 겸용 |
| 캠프 | Camping | **길굿** | 쉼굿은 조어 ❓ |
| 캠프 허가 | Firewood | 굿상 차림 | 길이별 지급 |
| 습격 방지 | 캠프 스킬 | **뒷전 차림** | 굿 끝에 잡귀를 먹여 보내는 거리에서 착안 ❓ |
| 장애물 | Obstacle | 저승 관문(차사 검문)·가시덤불 | 지전 또는 억지 통과 |
| 덫 | Trap | 원귀의 손길 | 상처 상태 카드 |
| 떠도는 위협 | Shambler | 저승 그림자 | 칠흑 전용 |
| 어둠 상태 카드 | — | 그늘 | 휘발 |

| 기물(안) | 맨손 | 맞는 보급품 | 영웅 고유 선택지 | DD 원형 |
|---|---|---|---|---|
| 서낭당 돌무더기 | 돌 얹기: 다음 전투 버프 / 가끔 스트레스 | 술·향 공양 → 카드 1장 강화 | 무속형: 신탁 → 다음 방 2개 정찰 | 제단·성소(Worship) |
| 버려진 상여 | 뒤지기: 엽전·재료 / 원귀 전투 / 씌임 | 지전 → 넋 위로: 인연 +, 신물 | 장례형: 상여소리 → 파티 스트레스 −10 | 석관·미라 |
| 무덤(봉분) | 도굴: 재료↑, 스트레스↑, 씌임 | 술 올리기 → 안전 + 카드 변환 | — | Shallow Grave(삽) |
| 장승 | 읽기: 지도 일부 공개 | 향 → 치명 정찰(비밀 길) | — | Discarded Pack(지도) |
| 저승 샘 | 마시기: HP 회복 / 질병 | 부적 → 정화, 상처 해제 | — | Holy Fountain |
| 굿상 잔해 | 먹기: 쌀 + / 씌임 | 향 → 안전 | — | Dinner Cart |
| 망자의 봇짐 | 뒤지기: 엽전·보급 / 없음 | — | 탐색형: 카드 1장 획득(영웅 풀) | Sack·Discarded Pack |

| 퀘스트(안) | DD 원형 | 경로 압력 |
|---|---|---|
| 길 밝히기 — 방 75% 방문 | Explore 90% | 넓게 돌기 |
| 원귀 소탕 — 방 전투 전부 | Cleanse | 전투 최다 → 덱 성장 최대 |
| 넋 거두기 — 떠도는 넋 N개 회수 | Gather | 표시된 지점 순회 |
| 부정 씻기 — 받아 간 신물로 N곳 정화 | Activate | 표시된 지점 + 보급 |
| 저승 ○○ 퇴치 — 보스 굴 | Boss | 보스 대비 덱 짜기 |
| 시왕 관문 — 고정 연속 퀘스트 | Darkest Dungeon | 최종장 |

---

## 6. 확인하지 못한 사실·주의

| 항목 | 상태 |
|---|---|
| DD1 길이별 방 수 | ❓ 짧음 9는 생성기 예시 1건(필드 의미 비공식 ⚠️), 긺 16–17은 플레이어 증언(검색 요약). 중간은 확인 못 함 |
| DD1 빛 표의 구간 정렬 | ⚠️ 위키 표에 빈 칸이 많다. 정찰(+15 / +7.5)만 확실하고 나머지 열은 해석이다 |
| DD1 퀘스트 보상 골드·가보 액수 | ❓ 위키에 수치 없음 |
| DD1 귀환 후 보급 정산 가격 | ❓ "크게 깎인 값"이라는 서술만 있다 |
| DD1 허기 버퍼 도입 시점 | ❓ 현재 위키에는 있지만, 2015–2017 불만 이후 언제 들어왔는지 확인 못 함 |
| DD1 Cove 지도 특성, 정찰된 전투의 기습 수치 | ❓ |
| DD1 짧은 원정의 비밀 방 | ❓ 위키는 중간·긴 원정만 언급 |
| DD2 이동 중 불꽃 소모 기본값, 고해별 지역 수, Confessions 지역당 노드 수 | ❓ Kingdoms(노드 3개)만 확인 |
| DD2에 허기 판정이 없음 | ❓ 위키에서 직접 확인 못 함 |
| DD2 Metacritic | ⚠️ 81(systems-reference) vs 82(Wikipedia) |
| DD2 반응 일부 | ⚠️ Vaporlens(AI 요약)·RPGHQ·Steam 유저 발언은 검색 요약 |
| Roguebook 재능 임계치 | ⚠️ 14/18/…/34(GamePretty) vs 첫 단계 15(LadiesGamers) |
| Roguebook 장당 전투 수, 회복 수단(Heart) | ❓ |
| Gordian Quest 캠프 총 시간, 습격 여부, 보급 소모량 | ❓ 리뷰 서술만 있고 수치 없음 |
| Iratus 지도 구조(층 수·노드형 여부) | ❓ 리뷰 요약만 있다(TechRaptor·Prima·Cubed3, 검색 요약) |
| StS "보스 아이콘을 지도에 표시" | ⚠️ 일반 상식. 위키 문장으로는 확인 못 함 |
| StS 막당 전투·휴식 횟수 | 확률표로 단순 계산한 **추정**이다(실제 런 통계 아님) |
| §5의 모든 수치(넋등 구간 효과, 원정 길이, 여유 비용) | 설계 **출발값**이다. Phase 7 시뮬레이션에서 조정 |
| 무속 용어(길굿·뒷전·쉼굿) | ❓ lore 조사에서 의미·용례 확인 필요 |

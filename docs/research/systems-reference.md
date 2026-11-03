# 시스템 레퍼런스 — 영속 영웅 × 파티 공유 덱

> 작성 2026-11-03 · 범위: Slay the Spire 식 전투/런 + Darkest Dungeon 식 영속 영웅(성장·장비·영구 사망·애착) 위에서
> **"여러 영웅을 함께 데려가면, 그 조합이 하나의 덱 콘셉트가 된다"** 를 설계하기 위한 시스템 조사.
> 카드 전체 목록(StS·Monster Train·Cobalt Core)은 다른 문서 범위라 여기서는 다루지 않는다.
>
> 표기: (출처 URL) = 직접 열어 확인 · ⚠️ = 출처끼리 다르거나 출처 품질이 낮음 · ❓ = 확인 못 함
> Steam 수치는 2026-11-03 기준 **영문 리뷰** 스냅숏(스토어 페이지 직접 조회)이다.

---

## 0. 요약

- **DD의 애착은 세 가지가 곱해진 결과다: 개체 고유성 × 투자 × 언제든 잃을 수 있음.** 영웅의 개성은 클래스 스킬보다 퀵·트링킷·고통의 이력에서 나온다.
  사망은 즉사가 아니라 확률 판정이다(Death's Door에서 1타당 사망 33%).
  반대로 영입이 무료이고 로스터가 넓어서, 숙련자는 영웅을 소모품으로 다루기도 한다("permalife").
- **공유 덱 파티 게임에서 시너지가 살아난 사례(Cobalt Core, Monster Train)에는 공통점이 있다. 모든 캐릭터 카드가 _같은 대상_ 을 건드린다**(우주선, 열차 층·유닛).
  그래서 카드 문구에 서로를 언급하지 않아도 조합이 생긴다.
- **영웅마다 덱이 따로인 게임**(Across the Obelisk, Gordian Quest, HELLCARD, StS2 co-op)은 협동 플레이에는 잘 맞는다.
  다만 교차 시너지가 "버프·디버프·턴 순서" 수준에 머물고, 덱 콘셉트는 파티가 아니라 영웅 단위로 생긴다.
- **CZN도 3인의 카드를 한 덱에 섞는다.** 하지만 카드 성장(Combatant Epiphany)과 저장(Save Data)이 **캐릭터 단위로 닫혀 있다.**
  그래서 카드가 같은 캐릭터 카드끼리만 고리를 만든다. "시너지가 없다"는 체감의 구조적 원인으로 보인다
  (언론 리뷰에서 이 비판을 직접 확인하지는 못함 — §2.3).
- **다운된 캐릭터의 카드는 "제거"하지 않고 "변환"하는 것이 업계 관행이다.** Roguebook 부활 카드, CZN Breakdown 카드 5장, Cobalt Core *Character Is Missing* 이 그렇다.
  덱빌더에서는 카드 제거가 오히려 강화인 경우가 많아서, **죽음이 덱 압축 버프가 되면 안 된다.**

---

## 1. Darkest Dungeon 1 & 2 — 애착과 상실을 만드는 시스템

### 1.1 DD1 핵심 시스템과 수치

| 시스템 | 규칙·수치 | 애착/상실에 주는 효과 | 출처 |
|---|---|---|---|
| 영입·로스터 | Stage Coach에서 **무료 영입**. 이름·클래스·퀵이 랜덤인 신병이 나온다. 주당 후보 3→7명(Network 업그레이드), 로스터 한도 12→28(Barracks 업그레이드, DLC 3종이 각 +1) | 대체 비용이 낮아서 영구 사망을 견딜 수 있다 | [Heroes](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon)) · [Stage Coach](https://darkestdungeon.wiki.gg/wiki/Stage_Coach) |
| 숙련 신병 | 업그레이드하면 레벨 1/2/3 신병이 18.75%/12.5%/6.25% 확률로 나온다 | 키우는 시간을 돈으로 단축 | [Stage Coach](https://darkestdungeon.wiki.gg/wiki/Stage_Coach) |
| 클래스 | 20개(기본 15 + DLC 5). 같은 클래스는 기본 스탯과 스킬을 공유한다 | 개체 차이는 퀵·트링킷·이력에서 생긴다 | [Heroes](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon)) |
| 랭크·로드아웃 | 4칸 대열. 스킬마다 쓸 수 있는 랭크와 노릴 수 있는 랭크가 정해져 있다. 클래스 스킬(대부분 7개) 중 **4개만 장착**하고, 전투 밖에서 바꾼다 | "부분집합 로드아웃"은 덱 압축과 같은 효과. 대열 조합이 파티의 정체성이 된다 | [Heroes](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon)) |
| 스킬 성장 | 스킬 레벨 1–5. 레벨 2/3/4/5를 사려면 Resolve 1/2/3/5가 필요하다. 비용은 해금 1000, 이후 250·750·1250·2500 골드(Training Regimen으로 최대 50% 할인) | 영웅마다 골드가 쌓인다 = 매몰 비용 | [Guild](https://darkestdungeon.wiki.gg/wiki/Guild) |
| Resolve(레벨) | 0–6. 누적 XP 2/8/14/24/36/48(Darkest 난이도). 레벨당 저항 +10% | — | [Resolve Level](https://darkestdungeon.wiki.gg/wiki/Resolve_Level) |
| 레벨 거부 | Resolve 3 이상은 Apprentice 던전, 5 이상은 Veteran 던전을 거부한다. 레벨이 모자라면 차이 1당 입장 스트레스 +20, 받는 스트레스 +25% | **로스터를 강제로 순환시킨다.** 새 영웅을 계속 키우게 된다 | [Resolve Level](https://darkestdungeon.wiki.gg/wiki/Resolve_Level) |
| Stress | 0–200. 100에서 Resolve 판정을 한다: **Virtue 25%** / Affliction 75%. 200이면 Heart Attack으로 Death's Door에 들어가고, 이미 Death's Door면 사망. 마을로 돌아오면 100으로 깎인다 | 영웅의 정신이 소모 자원이 된다 | [Stress](https://darkestdungeon.wiki.gg/wiki/Stress) · [Affliction](https://darkestdungeon.wiki.gg/wiki/Affliction) |
| Affliction | 7종(Fearful·Paranoid·Selfish·Masochistic·Abusive·Hopeless·Irrational) + DLC 2종. 공통으로 저항 −15%, 최대 HP −10%. 이탈 행동(act-out) 확률 약 29–42%: 파티 스트레스, 명령 거부, 아군·자신 공격, 치료·버프 거부 | 영웅이 "말을 안 듣는" 순간이 이야기를 만든다 | [Affliction](https://darkestdungeon.wiki.gg/wiki/Affliction) |
| Virtue | 기본 25%. 한 번 얻을 때마다 가중치 +1. 다른 파티원 스트레스 6 회복 | 드물게 오는 영웅적 순간이 기억에 남는다 | [Affliction](https://darkestdungeon.wiki.gg/wiki/Affliction) · [Stress](https://darkestdungeon.wiki.gg/wiki/Stress) |
| **Death's Door** | HP 0이면 Death's Door에 들어간다. 이후 피해를 받을 때마다 Deathblow 판정. **기본 저항 67%(사망 33%)**, Flagellant 73%, 상한 87%. 이 상태에서 ACC −10, DMG −25%, SPD −5, Stress +33%. 회복해도 퀘스트가 끝날 때까지 Recovery 디버프(ACC −2, DMG −5%, SPD −1) | "한 대만 더 맞으면 죽을 수도 있다" — 확률적 긴장이 생기고, **구조할 기회**가 남는다 | [Death's Door](https://darkestdungeon.wiki.gg/wiki/Death%27s_Door) |
| 사망 처리 | 장착 트링킷은 떨어지고, 그 전투를 이기면 회수할 수 있다. Graveyard에 이름·레벨·클래스·사인이 기록된다. 희귀 이벤트 *From Beyond* 로 되살아오면 Resolve·퀵은 유지되지만 스킬은 랜덤 4개, 장비는 초기화 | 손실이 **기록**으로 남고 일부는 회수된다 | [Heroes](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon)) · [Graveyard](https://darkestdungeon.wiki.gg/wiki/Graveyard) |
| 퀵 | 긍정 5개·부정 5개까지. 원정 성공 후 확률: 긍정 50 − 0.1×스트레스, 부정 30 + 0.2×스트레스. 부정 퀵은 원정마다 25% 확률로 고착된다. Sanitarium에서 제거하거나 긍정 퀵을 고정(최대 3개) | 같은 클래스여도 개체가 달라진다. 동시에 관리할 일이 된다 | [Quirks](https://darkestdungeon.wiki.gg/wiki/Quirks) |
| 질병 | 최대 3개. 원정 종료 감염 확률 32% − 33%×질병 저항(최저 5%). Sanitarium에서 치료 | — | [Disease](https://darkestdungeon.wiki.gg/wiki/Disease) |
| 트링킷 | 2슬롯. 상당수가 클래스 전용 | 장비가 개체에 쌓이는 투자가 된다 | [Heroes](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon)) |
| 햄릿 | Stage Coach·Guild·Blacksmith·Sanitarium·Tavern·Abbey·Survivalist·Nomad Wagon(+DLC Districts). 업그레이드 통화는 Heirloom(Bust·Portrait·Deed·Crest)이고 던전 반입 한도가 있다 | 영웅이 죽어도 남는 영구 진척 = 영구 사망을 견디게 하는 경제 | [Heirloom](https://darkestdungeon.wiki.gg/wiki/Heirloom) |
| 스트레스 회복 | Tavern·Abbey: 골드를 내고 그 주에는 출전 불가. 대기 중이면 주당 −5(Puppet Theatre가 있으면 −15) | 쉬는 영웅이 생겨서 순환 압력이 된다 | [Stress](https://darkestdungeon.wiki.gg/wiki/Stress) |
| 캠페인 패배 | Stygian 난이도: 86주를 넘기거나 사망자가 12명을 넘으면 패배(세이브 삭제) | 사망자 수 자체가 자원이 된다 | [Game Modes](https://darkestdungeon.wiki.gg/wiki/Game_Modes) |
| Never Again | Darkest Dungeon 퀘스트를 끝낸 영웅은 다시 가지 않는다(Darkest·Stygian 난이도) | 베테랑이 은퇴하고 새 영웅을 키워야 한다 | [fandom](https://darkestdungeon.fandom.com/wiki/Darkest_Dungeon_(location)) |

### 1.2 DD2 — 무엇이 달라졌나

| 항목 | DD2 규칙 | DD1 대비 | 출처 |
|---|---|---|---|
| 구조 | *Confessions*: 4인 파티의 단일 여정(역마차 로드트립). 시작은 "Four heroes and a stagecoach". *Kingdoms*(2025-01-27, 무료): **영속 로스터** + 여관 방어 | 햄릿이 사라졌다가 Kingdoms에서 일부 돌아옴 | [Steam DD2](https://store.steampowered.com/app/1940340/Darkest_Dungeon_II/) · [TBL](https://turnbasedlovers.com/news/darkest-dungeon-ii-to-launch-new-free-game-mode-kingdoms-and-dlc-inhuman-bondage-on-january-2025/) |
| 영웅 | **이름 있는 개인**(예: Highwayman = Dismas). 기본 12 + DLC 3. 시작 스킬 5개, 해금으로 최대 11개, 스킬마다 Mastery 업그레이드 1회 | 랜덤 신병에서 고정 인물 + 개인 서사로 | [Heroes DD2](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon_II)) · [Highwayman](https://darkestdungeon.wiki.gg/wiki/Highwayman_(Darkest_Dungeon_II)) |
| **Paths** | 영웅 대부분이 4개(기본 Wanderer + 3개). 예: Highwayman = Wanderer / Rogue(전열 Riposte) / Sharpshot(후열 원거리) / Yellowhand(Bleed 특화, 랭크 무관). 스탯과 스킬을 서로 맞바꾼다 | 같은 영웅 안에서 "빌드 정체성"을 고른다 | [Paths](https://darkestdungeon.wiki.gg/wiki/Paths) · [Highwayman](https://darkestdungeon.wiki.gg/wiki/Highwayman_(Darkest_Dungeon_II)) |
| Shrine of Reflection | 영웅의 과거 챕터를 체험한다(내레이션 또는 전투 미니게임). 끝내면 스킬이 해금된다 | **성장 = 개인사가 드러나는 과정** → 애착 | [Shrine](https://darkestdungeon.wiki.gg/wiki/Shrine_of_Reflection) |
| Stress | 0–10. 10에 닿으면 **Meltdown 80%**(HP를 10%로, Deathblow 저항 −15%, 모든 동료와 친밀도 하락, 40% 확률로 부정 퀵) 또는 **Resolute 20%**(HP 67% 회복, 친밀도 상승, 40% 확률로 긍정 퀵). 스트레스 7–9에서는 부정 대사가 90% | 스트레스가 관계 시스템과 바로 이어진다(악순환) | [Stress DD2](https://darkestdungeon.wiki.gg/wiki/Stress_(Darkest_Dungeon_II)) |
| Death's Door | 기본 Deathblow 저항 **60%**(Flagellant 75%), 범위 33–90%. **버틴 피격마다 −10%** 누적. 들어갈 때 Weak 토큰과 SPD −3 | 누적형이라 반복해서 맞으면 사망 확률이 오른다 | [DD2 Death's Door](https://darkestdungeon.wiki.gg/wiki/Death%27s_Door_(Darkest_Dungeon_II)) |
| 사망 | Confessions: 그 여정 안에서는 영구(퀵·Memories 손실). 다음 여관에서 빈자리를 채운다. 4명 전멸이면 종료. **Kingdoms: 캠페인 설정에서 부활 / 교체 / 교체 없음 중 선택** | 사망 처벌 강도를 플레이어가 고른다 | [DD2 Death's Door](https://darkestdungeon.wiki.gg/wiki/Death%27s_Door_(Darkest_Dungeon_II)) |
| 장비 | 트링킷 2개 + 전투 아이템 1개(전투 밖에서만 교체) | 비슷함 | [Heroes DD2](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon_II)) |
| 메타 진척 | Altar of Hope(Candles of Hope)로 영구 스탯, 영웅·Path 해금 | 햄릿 대신 들어간 진척 | [Heroes DD2](https://darkestdungeon.wiki.gg/wiki/Heroes_(Darkest_Dungeon_II)) |

### 1.3 DD2 Relationship(Affinity) — 영웅 사이 관계 시스템

| 요소 | 규칙 | 출처 |
|---|---|---|
| 친밀도 | **영웅 쌍마다** 0–20, 시작값 9 | [Relationships](https://darkestdungeon.wiki.gg/wiki/Relationships) |
| 관계 형성 | 여관을 떠날 때 쌍마다 판정. 친밀도 0이면 부정 90% / 1–4 부정 65% / 5–8 부정 33% / 9–13 각 5% / 14–16 긍정 33% / 17–19 긍정 65% / 20 긍정 90%. 첫 여관은 −10% 보정 | 〃 |
| 오르는 경우 | 빈사 아군을 치료·가드·버프할 때, 같은 적을 연달아 칠 때, 아군을 공격한 적을 칠 때, 노드에서 같은 선택을 할 때(+1), 여관 아이템. 10% 확률로 두 배 | 〃 |
| 내리는 경우 | 필요 없는 치료, 스트레스가 높을 때 이동, 노드에서 다른 선택(−1~2). Kingdoms에서는 긍정 관계가 끝나면 −3 | 〃 |
| 긍정 관계 | Respectful(5% 추가 공격·반격), Hopeful(3% 확률로 저항 +50%, 스트레스 회복), Amorous(5% 대신 맞기, 5% 확률로 최대 HP 50% 회복) | 〃 |
| 부정 관계 | Suspicious(Taunt+Vulnerable), Envious(+1 스트레스), Hateful(5% 확률로 파트너를 때림), Resentful(Blind+Weak) | 〃 |
| 카드화된 결과 | 관계가 생기면 파트너에게 **Blessed 스킬**(장착 여부 선택) 또는 **Cursed 스킬**(자동 장착, 해제 불가)이 붙는다 | 〃 |
| 지속 | Confessions 1개 지역 / Kingdoms 5일 | 〃 |

> **시사점**: DD2는 "두 영웅 사이의 이력"을 전투 효과와 스킬 슬롯으로 바꾼 유일한 레퍼런스다.
> 우리 게임에서는 이걸 **듀오 카드**(두 영웅이 함께 출전할 때만 덱에 들어오는 카드)로 옮기면, 애착과 덱 시너지를 같은 시스템으로 묶을 수 있다.

### 1.4 플레이어 반응 — 애착을 만드는 것 / 좌절시키는 것

| 구분 | 관찰 | 출처 |
|---|---|---|
| 설계 의도 | Sigman: "the flaws are key to the characters". Bourassa: 위험과 보상이 높을 때 게임이 가장 좋다 | [GamesBeat](https://gamesbeat.com/darkest-dungeon-designers-really-arent-sadists-were-realists/) |
| 설계 의도 | Affliction은 게임이 아니라 인간 경험(Band of Brothers)에서 착안했다(GDC) | [PC Gamer](https://www.pcgamer.com/uk/how-darkest-dungeon-got-inspiration-from-band-of-brothers-and-aliens) |
| 소모품화 | 숙련자는 "permalife"라고 부른다(영웅은 죽어도 햄릿은 남는다). 잉여 영웅은 출전시키지 말고 해고하라는 조언, 대체하기 힘든 트링킷은 넘기지 말라는 조언 | [QT3 p58](https://forum.quartertothree.com/t/darkest-dungeon/73511?page=58) · [QT3 p36](https://forum.quartertothree.com/t/darkest-dungeon/73511?page=36) |
| 좌절: 처벌 과잉 | 2015년 7월 얼리액세스에서 Corpses·Heart Attack을 추가 → 반발과 리뷰 폭격 → 8월에 끌 수 있는 옵션 추가 | [Kotaku](https://kotaku.com/darkest-dungeon-adds-option-to-turn-off-controversial-f-1725488669) · [GameBanshee](https://www.gamebanshee.com/kukxh) |
| 좌절: 투자 증발 | 최고 레벨 파티와 선조 트링킷을 보스전 한 번에 잃음. RNG 전멸이 지루하다는 180시간 플레이어 | [Steam 토론](https://steamcommunity.com/app/262060/discussions/0/135507403159625050) · [Steam 토론](https://steamcommunity.com/app/262060/discussions/0/1484358860950471626/?ctp=4) |
| 좌절: 그라인드 | 업그레이드 비용은 오르는데 퀘스트 보상은 제자리 | [GOG 리뷰](https://www.gog.com/en/game/darkest_dungeon?page=14) |
| DD2 반응 | 전작보다 캐릭터 투자감이 덜하다(PC Gamer, 검색 요약 인용 — 원문 접근 실패 ⚠️). 햄릿이 없는 것이 가장 큰 불만(Steam 포럼, GamePro) → Kingdoms의 영속 로스터 | [PC Gamer](https://www.pcgamer.com/darkest-dungeon-2-review/) · [Steam 포럼](https://steamcommunity.com/app/1940340/discussions/0/3830918083267104058) · [GamePro](https://gamepro.de/artikel/darkest-dungeon-2-konsolen-review,3416281.html) |
| 평가 | DD1 Steam **90%**(57,397). DD2 Steam **75%**(12,160), Metacritic 81 | [Steam DD1](https://store.steampowered.com/app/262060/Darkest_Dungeon/) · [Steam DD2](https://store.steampowered.com/app/1940340/Darkest_Dungeon_II/) · [MC](https://legacy.prod.metacritic.com/game/pc/darkest-dungeon-ii) |

### 1.5 DD에서 가져올 것 / 버릴 것

| 가져올 것 | 이유 |
|---|---|
| 사망을 **확률 판정**으로(즉사 대신 Death's Door) | 긴장과 구조 기회가 동시에 생긴다. DD1은 고정 33%, DD2는 40%에서 시작해 피격마다 +10% |
| 영웅 개체에 쌓이는 고유성(퀵·장비·이력·관계) | 같은 클래스여도 "그 영웅"이 된다. 소모품화를 막는다 |
| 낮은 대체 비용 + 영웅과 무관한 영구 진척 | 영구 사망을 견딜 수 있게 한다 |
| 로테이션 압력(레벨 거부, 휴식, Never Again, Kingdoms fatigue) | 많은 영웅을 키우게 된다. 우리 게임에서는 → **여러 라인업 = 여러 덱 콘셉트를 경험** |
| 처벌 강도 옵션(DD1 토글, DD2 Kingdoms 사망 설정) | 처벌 과잉에 대한 반발을 흡수한다 |

| 버릴 것 | 이유 |
|---|---|
| 클래스 스킬이 전부 같고 개성은 숫자(퀵)뿐인 구조 | 숙련자일수록 영웅을 소모품으로 본다 |
| 투자 전체가 한 번에 증발하는 손실(트링킷까지) | 리뷰에 나오는 최대 좌절 지점 |
| 영속 캐릭터를 매 런 리셋(DD2 Confessions) | 투자감이 떨어진다 |

---

## 2. 멀티캐릭터 덱빌더의 파티 ↔ 덱 구조

### 2.1 비교표

| 게임 | 출전 인원 | 덱 | 카드의 캐릭터 귀속 | 교차 시너지 수단 | 다운·부재 시 카드 | 런 간 영속 | 평판 |
|---|---|---|---|---|---|---|---|
| **Cobalt Core** (2023) | 크루 3명 / 8명 | **공유 1개** | 크루별 고유 카드 20장 이상, 크루 전용 아티팩트 | **공유 대상 = 우주선**(레인·캐논·Shield·Evade·Heat·Overdrive·드론), CAT의 .EXE | *Character Is Missing*: 에너지는 쓰지만 효과 없음, 1장 쓸 때마다 −1 | 크루의 잃어버린 기억(스토리), 크루·배 해금 | Steam 96%(3,458) |
| **Monster Train 1/2** | 클랜 2개(주 + 동맹), 챔피언은 주 클랜 | **공유 1개** | 클랜별 카드 | **공유 대상 = 열차 3층·유닛**, 공용 키워드, 주/동맹 비대칭 | 해당 없음(캐릭터가 아니라 유닛 카드) | 클랜 레벨 10(카드 해금), Covenant 25 | MT1 96%(12,278) / MT2 95%(5,112), MC 87 |
| **Roguebook** (2021) | 영웅 2명 / 4명+ | **공유 1개**(손패·에너지 공유) | 영웅별 50장 이상, 손패에서 좌우로 구분 | **앞/뒤 위치**(카드를 쓰면 그 영웅이 앞으로), 공유 Block, 위치 조건 카드 | **0코스트 부활 카드로 변환**, 5장 쓰면 부활(1회) ⚠️ | 페이지 → 장식 트리, 영웅 XP → 카드 해금 | Steam 84–85%, MC 78 |
| **Across the Obelisk** | 영웅 4명 / 16명(4클래스) | **영웅별 4개** | 영웅 고유 + 같은 클래스끼리 일부 공유 | 속도 순서의 개별 턴, 버프·디버프, 원소 | ❓ | 영웅 XP → Perk, 카드 해금 | Steam 81%(7,873) |
| **Gordian Quest** | 3명 / 10클래스 | 영웅별 | 클래스 스킬 그리드(특화 3개) | 3×4 레인 그리드, 상태 생산·소비(Bleed) | 캐주얼은 "setback", Hardcore는 영구 사망 | 영웅 레벨·장비, Realm 모드 이월 보상 | Steam 87%(1,852) |
| **HELLCARD** (2023) | 최대 3명(협동, 솔로는 AI 동료) | 플레이어별 | 클래스(Mage·Rogue·Warrior·Tinkerer) | 원형 맵 near/far 구역, 팀 대상 블록·드로우·마나 카드 | ❓ | 시작 아티팩트 해금 | Steam 88%(1,709) |
| **StS2 co-op** (EA 2026-03) | 최대 4명(온라인) | 플레이어별 | 캐릭터 | 동시 턴, 아군 대상 카드·물약, 공유 디버프, 멀티 전용 카드 | 그 전투 동안 기절 → 전투 후 HP 1로 부활 | 솔로와 같은 해금, 멀티 Ascension은 따로 | Steam 91%(71,883), 최근 73% |
| **Chaos Zero Nightmare** (2025-10) | 콤배턴트 3 + 파트너 3 | **공유 1개** | 콤배턴트별 기본 카드 + 고유 카드, 중립 카드 | 범용 수치(피해 증폭·AP·드로우), 파트너 패시브, 일부 키워드 | **Breakdown**: 카드가 Break 카드로 바뀌고 5장 쓰면 복귀(+1 누적) | **콤배턴트별 Save Data** | Steam ❓(PC는 STOVE) |

### 2.2 게임별 메모

**Cobalt Core** — Rocket Rat Games / Brace Yourself Games, 2023-11-08 ([Steam](https://store.steampowered.com/app/2179850/Cobalt_Core/))
- 크루 8명(Dizzy·Riggs·Peri·Isaac·Drake·Max·Books·CAT) 중 3명이 탄다. 시작 크루는 Dizzy·Riggs·Peri ([wiki Characters](https://cobaltcore.wiki.gg/wiki/Characters)).
  **안 데려간 크루의 카드와 전용 아티팩트는 그 런에 나오지 않는다** — 라인업이 곧 카드 풀이다 ([GamePretty](https://gamepretty.com/cobalt-core-starting-guide-for-new-players/)).
- 공유 매개체는 우주선이다. Evade(레인 이동), Overdrive(공격마다 +X), Heat(3 이상이면 과열해 피해 1) 같은 상태를 모든 크루 카드가 함께 쓴다 ([wiki Status](https://cobaltcore.wiki.gg/wiki/Status)).
  예: Dizzy는 Shield·Temp Shield·Stun·반격 담당이고, Drake의 과열과 조합이 언급된다 ([wiki Dizzy](https://cobaltcore.wiki.gg/wiki/Dizzy)).
- 리뷰: 크루마다 고유 카드가 20장 이상이고 겹침이 적다. 조합은 56가지. **공격이나 방어 역할이 빠지면 런이 어렵다** ([TurnBasedLovers](https://turnbasedlovers.com/review/cobalt-core-review)).
- **CAT** 은 런을 시작할 때 **탑승하지 않은 크루 2명** 의 .EXE 카드를 받는다. .EXE 카드는 그 크루 카드의 임시 사본을 만들고, 첫 등장 때 비용이 할인된다 ([wiki CAT](https://cobaltcore.wiki.gg/wiki/CAT)). → "부재한 캐릭터의 카드를 빌려 쓰는" 패턴이다.
- ***Character Is Missing***: 그 캐릭터 카드는 에너지와 카드 특성은 그대로 적용되지만 효과가 없다. 1장 쓸 때마다 상태가 −1, 0이 되면 정상으로 돌아온다 ([wiki](https://cobaltcore.wiki.gg/wiki/Character_Is_Missing)).
- 영속 진척: Cobalt를 파괴할 때마다 크루가 잃어버린 기억을 하나씩 되찾는다 — **캐릭터별 서사 해금** ([Wikipedia](https://en.wikipedia.org/wiki/Cobalt_Core)).

**Monster Train / Monster Train 2** — Shiny Shoe
- MT1: 클랜 5개(+DLC Wurmkin). 주 클랜과 지원 클랜을 골라 두 클랜 카드에 모두 접근한다. 클랜 레벨 10(레벨마다 카드 해금), Covenant 25단계 ([Steam MT1](https://store.steampowered.com/app/1102190/Monster_Train/)).
- MT2(2025-05-21): 신규 클랜 5개. **주 클랜의 챔피언이 출전하고, 동맹 클랜은 카드를 공급한다** ([Shacknews](https://shacknews.com/article/144366/monster-train-2-review-score)).
  클랜당 챔피언 2명, Equipment·Room 카드 추가. Dimensional Challenge 21개는 클랜 조합을 미리 정해 둔 도전이다 ([Game Informer 9.25](https://www.gameinformer.com/review/monster-train-2/engine-ingenuity)).
- 칭찬: 조합 수가 "staggering", 각 클랜이 다른 클랜과 저마다 다르게 시너지를 낸다(GI).
  비판: **어떤 조합은 다른 조합보다 훨씬 잘 된다**, 해금이 느리다, 키워드가 수십 개다(Shacknews).
- 구조 해석: 어떤 클랜의 주문도 어떤 클랜의 유닛이든 강화한다. 층(용량) 위의 유닛이 공유 대상이라서 **교차 시너지가 기본값**이다.

**Roguebook** — Abrakam / Nacon, 2021
- 영웅 2명. 손패와 에너지를 공유하고 카드마다 주인이 있다.
  **앞 영웅만 공격받고**, 앞 영웅만 아이템 보너스를 받으며, **그 영웅의 카드를 쓰면 그 영웅이 앞으로 나온다** ([Game*Spark](https://www.gamespark.jp/article/2021/06/29/110002.html)).
  Block 풀도 하나다. 위치에 따라 비용이나 조건이 달라지는 카드, 위치를 바꿀 때마다 강해지는 효과가 있다 ([Opinionated Gamers](https://opinionatedgamers.com/2021/07/13/dale-yu-review-of-roguebook-pc-game-on-steam/)).
- **다운**: 그 영웅의 카드가 전부 **0코스트 부활 카드**로 바뀌고, 5장을 쓰면 부활한다(1회).
  부활 카드가 덱을 막아서 남은 영웅을 지키기가 더 어려워진다 ([Checkpoint 리뷰, 검색 요약](https://checkpointgaming.net/reviews/2021/06/roguebook-review-great-card-battles-to-pass-the-time/)) ⚠️ 장수는 단일 출처이고, Game*Spark는 'Revival Song' 카드로 서술.
- 재능(Talent)은 **덱 크기 임계치를 넘을 때** 얻는다 → 카드를 많이 모으도록 유도해서, 두 영웅 카드로 덱이 희석되는 문제를 상쇄한다(Game*Spark).
- 평판: Steam 84–85%, Metacritic 78 ([gg.deals](https://gg.deals/gb/game/roguebook/)). 비판: 두 캐릭터 카드를 한 덱에서 관리하다 보니 한 방향으로 좁힌 전략이 어렵다(검색 요약).

**Across the Obelisk** — Dreamsite / Paradox
- 영웅 4명(16명, 4클래스), 1–4인 온라인 협동 ([Steam](https://store.steampowered.com/app/1385380/Across_the_Obelisk/)).
  **영웅마다 덱이 따로**이고, 같은 클래스는 일부 카드를 공유하며, 영웅마다 원소 특화가 있다(예: Cornelius는 불) ([IndieHellzone](https://indiehellzone.com/2023/10/05/across-the-obelisk/)).
- 턴 순서는 속도로 정한다. 블록 카드를 그 라운드 마지막 영웅이 쓰면 낭비라서 팀 순서를 조율해야 한다 ([gameplay.tips](https://gameplay.tips/guides/10302-across-the-obelisk.html)).
- 비판: 솔로로 하면 요소가 너무 많다. **느린 탱커가 적보다 늦게 움직이는 턴 순서**가 답답하다(IndieHellzone).

**Gordian Quest** — Mixed Realms
- 3인 파티, 10클래스 ([Steam](https://store.steampowered.com/app/981430/Gordian_Quest/)). 영웅마다 자기 덱에서 뽑는다.
  3×4 그리드: 후열 시전자는 맞기 어렵고, 궁수는 멀수록 보너스, 레인 이동은 1 AP ([Gamingtrend 85](https://gamingtrend.com/gordian-quest-review-deckbuilding-dungeons-and-dice/)).
- 시너지 예: 한 클래스가 여러 적에게 Bleed를 걸고, 다른 클래스가 그 Bleed로 큰 공격을 한다 — **생산/소비 분리**(Gamingtrend).
- 사망: Hardcore는 영구 사망, 캐주얼에서는 "only a setback"(Steam). 비판: 장비 RNG로 그라인드, 반복적이다 ([COGconnected 80](https://cogconnected.com/review/gordian-quest-review/)).

**HELLCARD** — Thing Trunk, 2023
- 최대 3인 협동. 솔로는 AI 동료와 함께 ([Steam](https://store.steampowered.com/app/1201540/HELLCARD/)). 플레이어마다 자기 덱.
  원형 전장을 near/far 구역으로 나눈다: Warrior는 붙은 적에게 피해 2배, Rogue의 활은 반대 ([Tech-Gaming 76](https://www.tech-gaming.com/hellcard/)).
- 팀 대상 카드: Wrathstealer(팀원에게 블록), Ox(그 블록 2배), Finesse·Wave Laylines(자신과 팀원 드로우, 무료 마나), Solidarity(팀 버프) ([Xbox Wire](https://news.xbox.com/en-us/2025/09/12/master-the-dungeon-essential-tips-to-survive-hellcard-on-xbox/)).
- 한 명이 위협을 밀어내면 다른 한 명이 뭉친 적에게 광역 공격을 넣는다 — 위치를 통한 역할 분담(Tech-Gaming).

**Slay the Spire 2 co-op** — Mega Crit, 얼리액세스 2026-03-05
- 최대 4인 온라인. **덱·골드·에너지·유물이 개인별**이고 보상도 개별이다.
  모두 같은 턴 안에서 행동을 예약하고, 순서대로 처리된다. 적 체력은 인원 비례보다 조금 더 가파르게 늘어난다 ([allthings.how](https://allthings.how/slay-the-spire-2-co-op-multiplayer-every-mechanic-and-rule-explained/)).
- 교차: 아군에게 힐·버프·물약을 쓸 수 있다. 멀티 전용 카드가 있다(자기 블록의 절반을 파티와 나누는 Power, 한 턴 동안 팀원에게 가는 적 공격을 자신에게 돌리는 카드) (allthings.how).
  Vulnerable을 먼저 걸고 팀원들이 공격하는 순서, 팀원이 에너지를 주면 고코스트 카드의 가치가 오르는 점 ([AV Club](https://avclub.com/slay-the-spire-2-early-access-impressions)).
- 다운: 그 전투 동안 쓰러져 있다가 **전투 후 HP 1로 부활**. 전원이 쓰러져야 런이 끝난다 ([Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire_II)).
- 평판: Steam 91%(71,883), 최근 30일 73% ([Steam](https://store.steampowered.com/app/2868840/Slay_the_Spire_2/)). 협동은 "chaotic"하다는 평(IGN, 검색 요약).

### 2.3 Chaos Zero Nightmare 심층

| 항목 | 내용 | 출처 |
|---|---|---|
| 기본 정보 | 개발 Super Creative, 퍼블리셔 Smilegate, 2025-10-22 출시. iOS·Android·PC(STOVE). 가챠 | [RPG Site](https://www.rpgsite.net/games/2493-chaos-zero-nightmare) · [Smilegate](https://newsroom.smilegate.com/en/game/roguelike) |
| 파티 | 콤배턴트 3명 + 파트너 3명. 파트너는 전투에 나오지 않고 스탯, 클래스별 패시브, 두 번째 Ego Skill을 준다(장비처럼 동작) | [OSLink](https://www.oslink.io/blog/guide/chaos-zero-nightmare-gameplay-guide.html) · [BlueStacks](https://www.bluestacks.com/blog/game-guides/chaos-zero-nightmare/cznm-characters-guide-en.html) |
| 덱 | 3인의 카드를 한 덱으로 섞는다("three card pools working together"). 콤배턴트당 시작 카드는 약 4장(기본 공격, 방어 또는 힐, 시그니처)이고, 고유 카드는 Epiphany로 얻는다. 기본 카드 8장 체계라는 서술도 있다 ⚠️. 턴당 3 AP | BlueStacks · [OSLink 전투](https://www.oslink.io/blog/guide/chaos-zero-nightmare-combat-system-and-strategy-guide.html) · [LDShop](https://www.ldshop.gg/blog/chaos-zero-nightmare/save-data.html) |
| HP | **팀 공유 HP 하나** | OSLink 전투 |
| **Epiphany** | 카드를 쓸 때 확률로 발동한다. **Combatant Epiphany** = 카드를 쓴 **그 캐릭터의** 랜덤 고유 카드가 손에 들어오고(그 턴 0코스트), 이후 전투에서도 덱에 남는다. **Card Epiphany** = 쓴 카드가 5종 강화 중 3개 선택지로 변이한다. Divine Epiphany는 드문 강화판 | [Switchblade](https://www.switchbladegaming.com/chaos-zero-nightmare/beginners-guide-25/) · GameWith(검색 요약) |
| **Save Data** | Chaos 런이 끝나면(성공이든 전멸이든) **콤배턴트별로** 저장된다. Vivid Memory(보장: 장비·고유 카드·기본 카드) / Faint Memory(포인트 한도 안에서: 중립 카드 20, Epiphany +10, Divine 20, Monster 카드 80, 제거·복제는 할수록 비싸짐). 한도는 Tier 1 30점에서 티어마다 +10. 저장 데이터를 장착하면 Combat Mission·Simulation을 그 덱으로 시작한다 | [GameWith Save Data](https://gamewith.net/chaoszeronightmare/70847) |
| 정신 | 콤배턴트마다 Stress가 있다 → **Breakdown**: 그 캐릭터 카드가 Break 카드로 바뀌고 Ego가 봉인되며 팀 최대 HP가 줄어든다. **Break 카드 5장을 쓰면 회복하고, 다음번엔 1장 더 필요하다.** 3명 모두 Breakdown이면 Link Crash. 이후 Deep Trauma → 상담(Counseling) 또는 기억 소거 | OSLink 전투 · [GameWith Deep Trauma](https://gamewith.net/chaoszeronightmare/70808) · [Rosenberry](https://www.rosenberryrooms.com/chaos-zero-nightmare-breakdown-guide/) ⚠️저품질 |
| 장르 포지션 | Prydwen은 "Slay the Spire와 Darkest Dungeon의 혼합"이라고 소개한다 — **DD식 스트레스·트라우마를 이미 차용**했다 | Prydwen(검색 요약) |
| 시너지가 있다는 근거 | 공략의 정석은 "카드·Epiphany 효과가 맞물리는 2명 + 서포터 1명". 예: Lilian의 스킬이 1코스트 이하 공격을 강화해 Rin의 카드와 맞물린다. Heidemarie·Hugo·Selena의 추가 공격 연쇄. 시즌 3에 *Link* 키워드(연결된 카드가 함께 묘지로) 추가 | [GameWith 팀](https://gamewith.net/chaoszeronightmare/71400) · 팀 빌딩 가이드(검색 요약) · [InvenGlobal S3](https://labs.invenglobal.com/articles/21028/the-time-to-return-is-now-chaos-zero-nightmare-season-3-brings-massive-changes-to-reduce-fatigue) |
| 비판 근거 | ❓ **"캐릭터 간 카드 연계가 없다"는 비판을 언론·커뮤니티 문장으로 직접 확인하지 못했다.** 확인된 비판은 다른 쪽이다: 가챠가 카드 접근을 좌우한다(Destructoid), Game8 게임플레이 6/10(이유 미확인), 시즌 3 개편은 Save Data 관리와 Chaos 반복 피로를 겨냥 | [Destructoid](https://www.destructoid.com/?p=1131799) · InvenGlobal S3 |

**구조 해석(우리 분석 — 비판이 생길 만한 이유)**

1. **성장 루프가 캐릭터 안에서 닫힌다.** Combatant Epiphany는 "카드를 쓴 그 캐릭터"의 고유 카드를 늘린다. A의 카드를 쓴다고 B의 카드가 성장하지 않는다.
2. **저장 단위가 캐릭터다.** Save Data를 콤배턴트별로 저장하고 다른 팀에서도 장착하므로, 각 캐릭터의 카드 묶음은 **어느 팀에 들어가든 혼자 굴러가야** 한다.
   그 결과 다른 캐릭터를 전제로 하는 카드를 설계하기 어렵다.
3. **교차 시너지가 범용 수치에 맡겨진다.** 피해 증폭, Vulnerable, AP, 드로우, 파트너 패시브 같은 것들이다.
   일부 캐릭터는 자기만의 키워드에 묶여 있다(예: Tiphera는 Created 카드만 드로우 — GameWith 팀 가이드).
   그래서 라인업이 "덱 콘셉트"보다 "스탯 조합"처럼 느껴진다.
4. **다운 규칙(Breakdown)은 오히려 좋은 레퍼런스다.** 카드를 없애지 않고 "회복 카드"로 바꾸며, 회복할수록 필요 장수가 늘어난다.

---

## 3. 우리 게임을 위한 종합

### 3.1 다캐릭터 카드 시너지가 작동하게 하는 패턴

| # | 패턴 | 작동 방식 | 증명 게임 | 우리 게임 적용안 |
|---|---|---|---|---|
| P1 | **공유 대상(shared medium)** | 모든 캐릭터 카드가 같은 대상을 조작한다. 카드끼리 서로를 언급하지 않아도 조합이 생긴다 | Cobalt Core(우주선) · Monster Train(층·유닛) | DD식 **4칸 대열 + 공유 적 상태**를 매개체로 삼는다. 모든 카드는 "대열"과 "적 상태"를 건드린다 |
| P2 | **공용 키워드 + 생산/소비 분리** | 한 캐릭터가 상태를 걸고(setup), 다른 캐릭터가 그 상태로 이득을 본다(payoff) | Gordian Quest(Bleed) · StS2 co-op(Vulnerable 선행) · HELLCARD(넉백 + 광역) · MT(공용 키워드) | 키워드 매트릭스(권고 R2) |
| P3 | **위치·순서 결합** | 카드를 쓰는 순서와 캐릭터 위치가 효과를 바꾼다 | Roguebook(쓰면 앞으로, 위치 조건) · DD(사용·타깃 랭크) · GQ(그리드) · HELLCARD(near/far) | 카드를 쓰면 그 영웅이 선두로 + *Relay* 키워드(R3) |
| P4 | **주/보조 비대칭** | 한쪽이 정체성(승리 조건)을, 한쪽이 카드 풀을 맡는다 → 조합 공간이 정리된다 | Monster Train(주 = 챔피언, 동맹 = 카드) | **리더 영웅**(R4) |
| P5 | **파티가 보상 풀을 정한다** | 출전한 캐릭터의 카드·아티팩트만 등장한다 → 라인업이 곧 덱 콘셉트 | Cobalt Core · Monster Train | 보상·트링킷 풀을 출전 영웅 기준으로 |
| P6 | **부재 캐릭터 카드 차용** | 파티에 없는 캐릭터의 카드를 임시로 빌린다 | Cobalt Core CAT .EXE | 사망·은퇴한 영웅의 "유품" 카드(R6) |
| P7 | **관계 → 전투 효과** | 두 영웅의 이력이 전투 보너스나 스킬이 된다 | DD2 Blessed/Cursed 스킬, Respectful 추가 공격 | **듀오 카드**(R5) |
| P8 | **다운 시 카드 변환** | 카드를 지우지 않고 회복·무효 카드로 바꾼다 → 부재가 손패에서 체감된다 | Roguebook(부활 카드) · CZN(Break 카드 5장, +1) · Cobalt Core(Missing) | 구조(Rally) 카드(R6) |
| P9 | **성장 = 개인 서사** | 캐릭터를 쓰면 과거나 기억이 해금된다 | DD2 Shrine of Reflection · Cobalt Core 기억 | 영웅 카드 진화에 서사 조각을 붙인다 |
| P10 | **덱 크기 보상** | 덱이 커지면 보상을 준다 → 여러 캐릭터 카드로 인한 희석을 상쇄 | Roguebook 재능 | 3인 덱의 밀도 문제를 보정하는 선택지 |

### 3.2 피해야 할 안티패턴

| # | 안티패턴 | 증상 | 사례 | 대책 |
|---|---|---|---|---|
| A1 | **세 개의 덱을 섞기만 함** | 팀 선택이 스탯 선택이 된다. 손패에서 캐릭터끼리 "따로 논다" | CZN 구조(§2.3 해석) | 모든 영웅이 공용 키워드를 최소 1개 생산하고 1개 소비하게 한다. 캐릭터 전용 키워드를 금지하거나 최소화 |
| A2 | **성장·저장이 캐릭터 단위로 닫힘** | 카드가 어떤 팀에서든 혼자 굴러가도록 설계된다 → 교차 카드가 사라진다 | CZN Combatant Epiphany·Save Data | 영속되는 것은 "카드 변이·해금"이고, **덱은 매 런 파티로 조립**한다 |
| A3 | **영웅별 덱·개별 턴** | 덱 콘셉트가 영웅 단위로 생긴다. 시너지가 버프·턴 순서로 줄어든다. 느린 탱커 문제 | ATO | 공유 덱 + 한 턴 안에서 자유롭게 섞어 쓰기 |
| A4 | **범용 시너지뿐** | 누구나 Vulnerable 이득을 본다 → 조합끼리 서로 바꿔도 차이가 없다 | (StS2 co-op 수준의 교차) | 키워드마다 소비자를 1–2 클래스로 제한 |
| A5 | **큐레이션 없는 조합 폭발** | 역할이 비거나 "안 되는 조합"이 생긴다 | Cobalt Core 56조합(공·방 공백), MT "일부 조합이 훨씬 강함" | 조합 전수표 + 시뮬레이션. 역할 공백 경고. 리더 비대칭으로 조합 공간 축소 |
| A6 | **죽음 = 덱 압축** | 카드가 빠져 덱이 오히려 강해지는 역설 | (덱빌더 일반) | 카드를 변환하고, 제거는 휴식처 행동으로만 |
| A7 | **죽음 = 통제 불가한 덱 막힘** | 부활 카드가 덱을 막아 데스 스파이럴 | Roguebook(부활 카드 5장) | 시작 장수를 낮게, 회차마다 +1. 0코스트 + 드로우 1 같은 완충 |
| A8 | **투자 일괄 증발** | 최고 레벨 파티와 트링킷 전멸 → 이탈 | DD1(Corpses·Heart Attack 반발, 트링킷 상실) | 장비 회수, 유품 상속, 처벌 강도 옵션 |
| A9 | **영웅 소모품화** | 영웅을 해고하고 교체하는 것이 최적이 된다 | DD1 "permalife" | 영웅 개체마다 고유한 카드 변이·관계를 둔다 |
| A10 | **영속 캐릭터를 리셋** | 투자감 저하, 허브 부재에 대한 불만 | DD2 Confessions → Kingdoms 추가 | 로스터와 허브를 영속으로 |
| A11 | **복잡한 영속 예산** | 관리 피로·그라인드 | CZN Save Data 포인트 → 시즌 3 피로 완화 개편 | 영속 규칙은 한 줄로 설명할 수 있게 |

### 3.3 영구 사망 × 공유 덱 — 다운·사망한 영웅의 카드를 어떻게 할까

| 옵션 | 사례 | 장점 | 위험 | 판정 |
|---|---|---|---|---|
| A. 즉시 제거 | — | 단순하다 | 덱 압축이 버프가 되고 콘셉트가 무너진다(A6) | ✗ |
| B. 비용만 내는 무효 카드 | Cobalt Core *Missing* | 부재가 손패에서 체감되고, 쓸수록 타이머가 줄어든다 | 순수한 처벌이라 선택지가 없다 | △ 일시적 부재(기절·납치)용 |
| C. 구조 카드로 변환(N장 쓰면 복귀) | Roguebook 5장 · CZN 5장(+1 누적) | 구조할지 공격할지 선택이 생긴다 | 데스 스파이럴(A7) | ○ 전투 중 다운 |
| D. Death's Door 판정 | DD1 사망 33% · DD2 40% + 피격당 10% | 확률적 긴장, 즉사가 아니다 | 운에 따른 좌절 | ○ 다운 상태에서 피격 시 |
| E. 전투 후 HP 1로 자동 부활 | StS2 co-op | 런이 이어진다 | 긴장이 낮다 | 쉬운 난이도 옵션 |
| F. 유품 카드 상속 | CAT .EXE 응용 · DD1 트링킷 회수 | 애도와 기억, 후계자 서사 | 파워 인플레이션 | ○ 영구 사망 후 |
| G. 관계 반응 | DD2 Meltdown 친밀도 하락, 사망 관련 퀵 | 감정이 연쇄된다 | 연쇄 붕괴 | ○ 생존자에게 |

**제안 흐름**

| 단계 | 처리 |
|---|---|
| 전투 중 HP 0 | Death's Door에 들어간다. 그 영웅의 카드(덱·손패·버림 더미)가 **구조(Rally) 카드**로 바뀐다(0코스트) |
| Death's Door 상태 | 이 영웅이 피격되면 Deathblow를 판정한다(저항 60–67%로 시작, 피격마다 −10%). 대열 앞쪽일수록 위험 |
| 구조 성공 | Rally 카드 N장(시작 3장, 같은 전투에서 다시 쓰러질 때마다 +1)을 쓰면 일어나 원래 카드로 돌아온다. 퀘스트가 끝날 때까지 Recovery 디버프 |
| 전투 종료 시 사망 확정 | 카드를 바로 빼지 않고 **애도(Grief) 카드**로 바꾼다(0코스트, 쓰면 소멸하고 작은 효과). 휴식처에서 "장례"를 고르면 한꺼번에 정리하고 **유품 카드 1장**(그 영웅에서 가장 많이 진화한 카드의 기념판)을 남은 파티나 듀오 파트너에게 넘긴다 |
| 런 이후 | 묘지 기록(이름·레벨·사인·마지막 카드). 생존한 관계 파트너에게 슬픔·결의 퀵 판정 |

### 3.4 권고 (8개)

1. **공유 덱 하나, 출전 3명, 4칸 대열.**
   Cobalt Core·CZN·Gordian Quest·HELLCARD가 모두 3인이다. 4인이면 한 영웅의 카드가 손패에서 평균 25%로 묽어진다.
   카드에는 주인과 사용 랭크를 표기하고, 대열을 공유 대상으로 삼는다(P1·P3).
   영구 사망에 대비해 비출전 예비 슬롯 1칸(교대 투입)을 검토한다.
2. **키워드 매트릭스를 설계 규칙으로 고정한다.**
   공용 상태를 6–8개 둔다. 클래스마다 2개를 **생산**하고 1–2개를 **소비**하되, 생산·소비 구성이 클래스끼리 겹치지 않게 한다.
   검증 기준: 모든 2인 쌍에 링크가 1개 이상이고, 3인 조합마다 "지배 키워드"가 달라야 한다(= 라인업이 덱 콘셉트를 바꾼다).
   조합 전수표와 봇 시뮬레이션으로 역할 공백 조합을 찾아낸다(A1·A4·A5).
3. **순서 결합 키워드 *Relay*.**
   "직전 카드가 다른 영웅의 카드면 X" + "카드를 쓰면 그 영웅이 선두로"(Roguebook).
   특정 영웅 이름을 언급하지 않고도 교차 플레이를 강제해서, CZN식 "각자 놀기"를 구조적으로 막는다.
4. **리더 영웅(Monster Train의 주 클랜).**
   원정마다 리더 1명이 승리 조건(시그니처 카드 + 런 중 업그레이드 경로)을 준다. 나머지 두 명은 카드 풀을 공급한다.
   보상·트링킷 풀은 출전한 영웅으로 한정한다(Cobalt Core). 조합 공간이 정리되고 밸런싱 대상도 줄어든다.
5. **관계 = 듀오 카드.**
   DD2식 친밀도(0–20)를 **영웅 개체 쌍**에 저장한다. 임계치를 넘으면 두 사람이 함께 출전할 때만 덱에 들어오는 듀오 카드가 해금된다.
   부정 관계는 Cursed 카드(강제 포함)를 만든다. 애착과 덱 시너지를 같은 시스템으로 묶어서, "이 둘을 같이 보내고 싶다"는 마음이 덱 설계가 되게 한다.
6. **다운·사망 규칙은 "변환", 제거하지 않는다(§3.3).**
   전투 중에는 Rally 카드 3장(+1 누적)과 Deathblow 판정, 사망 후에는 Grief 카드 → 장례 → 유품 상속 → 묘지 기록.
   덱 압축 버프와 데스 스파이럴을 둘 다 피하는 것이 목표다.
7. **영웅의 영속 성장은 "카드 변이 + 로드아웃"으로, 덱은 매 런 조립한다.**
   DD의 "7개 중 4개"를 옮겨, 영웅이 배운 카드 중 N장을 골라 들고 출발한다.
   Epiphany 같은 카드 변이는 **영웅 개체**에 기록한다. 같은 클래스라도 개체마다 덱 조각이 달라져 소모품화를 막는다(A9).
   CZN식 캐릭터별 저장 덱과 포인트 예산은 쓰지 않는다(A2·A11).
8. **상실을 견디게 하는 경제와 로테이션.**
   무료·저가 영입, 파티보다 큰 로스터, 영웅과 무관한 영구 진척(허브), 영웅 1명당 투자 상한(DD Resolve 6처럼).
   휴식·피로·레벨 거부로 로스터를 순환시켜 여러 라인업을 경험하게 한다.
   처벌 강도는 옵션으로 둔다(DD2 Kingdoms 사망 설정, DD1 Corpses 토글의 교훈).

### 3.5 확인하지 못한 사실·주의

| 항목 | 상태 |
|---|---|
| CZN "캐릭터 간 카드 연계가 없다"는 비판 | ❓ 언론 리뷰·커뮤니티에서 해당 문장을 직접 찾지 못했다(영문·국문 검색). 공략은 오히려 시너지 조합을 강조한다. §2.3의 구조 해석은 추론이다 |
| CZN Steam 평점 | ❓ PC는 STOVE 배포로 확인되었고, Steam 페이지·평점은 확인하지 못했다 |
| CZN 콤배턴트당 카드 수(시작 4장 / 기본 8장) | ⚠️ 가이드마다 서술이 다르다 |
| CZN Break 카드 5장 회복 규칙 | ⚠️ OSLink와 저품질 출처 1곳. 공식 문서로는 확인하지 못했다 |
| Roguebook 부활에 필요한 카드 수(5장) | ⚠️ 리뷰 1곳. Game*Spark는 'Revival Song' 카드로 서술 |
| ATO·HELLCARD에서 다운된 영웅의 카드 처리 | ❓ 찾지 못했다 |
| Monster Train 클랜 XP 분배(주 100%, 동맹 50%) | 저품질 출처라 본문에 넣지 않았다 |
| Cobalt Core 크루당 시작 카드 수, 보상 카드 추첨 규칙, 파워형 메타 진척 유무 | ❓ |
| DD2에서 동시에 장착하는 스킬 수 | ❓ 위키에서 확인하지 못했다 |
| PC Gamer DD2 리뷰 원문 | ⚠️ 접근에 실패해 검색 요약만 인용했다 |
| DD1 Bloodmoon 패배 한도(100주·16명 설) | ⚠️ 출처끼리 다르다. 본문에는 Stygian(86주·12명)만 적었다 |

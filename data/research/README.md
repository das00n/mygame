# 조사 데이터

Phase 1-2(카드 전수 조사)와 1-3(메커닉 분해)의 결과물이다. **분석용**이며 게임에 들어가지 않는다.

## 출처와 라이선스

| 파일 | 게임 | 출처 | 라이선스 |
|---|---|---|---|
| `cards/sts1.json` | Slay the Spire | https://slaythespire.wiki.gg | CC BY-SA |
| `cards/sts2.json` | Slay the Spire 2 (앞서 해보기) | https://slaythespire.wiki.gg | CC BY-SA |
| `cards/mt1.json` | Monster Train | https://monster-train.fandom.com | CC BY-SA |
| `cards/mt2.json` | Monster Train 2 | 각 파일의 `source` 참고 | CC BY-SA |
| `cards/cobaltcore.json` | Cobalt Core | https://cobaltcore.wiki.gg | CC BY-SA |

수집 스크립트는 `tools/research/scrape_*.py` 에 있다. 다시 돌리면 최신 위키 내용으로 갱신된다.

## 공통 스키마 (`cards/*.json`)

```jsonc
{
  "game": "게임 이름",
  "source": "위키 URL (라이선스)",
  "retrieved": "YYYY-MM-DD",
  "notes": "버전·누락·제외 항목",
  "keyword_glossary": { "키워드": "한 줄 정의" },
  "cards": [{
    "id": "게임접두어.카드_슬러그",
    "name": "카드 이름",
    "owner": "캐릭터 / 클랜 / 승무원 / Colorless / Curse / Status …",
    "type": "게임 고유 카드 타입",
    "rarity": "게임 고유 희귀도",
    "cost": "문자열 (X, -, U 허용)",
    "cost_upgraded": "강화 시 비용 (같으면 null)",
    "text": "기본 효과 (평문)",
    "text_upgraded": "강화 효과 (없으면 null)",
    "keywords": ["카드가 쓰는 게임 고유 키워드"],
    "extra": { "게임별 추가 필드": "유닛 공격력·체력, 강화 경로 A/B 등" }
  }]
}
```

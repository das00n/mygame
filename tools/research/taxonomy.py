"""메커닉 원자 분류 체계 (Phase 1-3).

세 게임(StS·Monster Train·Cobalt Core)의 카드를 같은 기준으로 태깅하기 위한 사전.
- EFFECTS: 카드가 '하는 일' (피해·방어·드로우 …)
- FAMILIES: 카드끼리 주고받는 '자원·상태 계열'. 카드마다 생산(produce)/소비(consume)를 판정한다.
  생산 = 그 자원을 만들거나 쌓는다. 소비 = 그 자원이 있어야 강해지거나, 그 자원을 써서 효과를 낸다.
- PROPS / CONDITIONS / SCALING: 카드 성질·조건·성장 방식.

정규식은 소문자로 바꾼 평문에 적용한다.
"""

N = r"(?:\d+|x|\(\d+;\d+\))"  # 숫자 / X / (기본;강화)

# ── 효과 원자 ──────────────────────────────────────────────
EFFECTS = {
    "damage":        ("단일 피해",        [rf"deal {N}.*?damage", rf"attack (?:for )?{N}", rf"\bshoot\b", r"deals? damage"]),
    "damage_aoe":    ("광역 피해",        [r"(?:to )?all enem", r"every enem", r"all units", r"to all\b"]),
    "damage_multi":  ("다단 히트",        [rf"{N} times", r"multistrike", r"\btwice\b"]),
    "block":         ("방어 획득",        [rf"gain {N}.*?block", r"\bblock\b", r"\bshield\b", r"\barmor\b", r"temp shield"]),
    "heal":          ("회복",            [r"\bheal", r"restore .*?(?:hp|health)", r"\bregen", r"rejuvenate"]),
    "max_hp":        ("최대 체력",        [r"max(?:imum)? (?:hp|health)"]),
    "draw":          ("드로우",          [r"\bdraw", r"put .*? into your hand"]),
    "discard":       ("버리기",          [r"\bdiscard"]),
    "scry":          ("덱 위 보기·정리",   [r"\bscry", r"look at the top", r"top of your (?:draw pile|deck)"]),
    "tutor":         ("특정 카드 찾기",    [r"choose (?:a|an|\d+) .*?(?:card|attack|skill|power).*?(?:from|in) your (?:draw pile|deck)", r"from your draw pile"]),
    "recall":        ("버린/소멸 더미 회수", [r"from (?:your )?(?:discard|exhaust) pile", r"\brecycle", r"\breturn .*? to your hand"]),
    "energy":        ("에너지 획득",      [r"gain .*?energy", r"gain \[e\]", r"\[e\]", r"\bember\b", r"energy next turn"]),
    "cost_reduce":   ("비용 감소",        [r"costs? (?:\d+ )?less", r"cost 0", r"\bdiscount\b", r"reduce .*?cost"]),
    "stat_up":       ("영구 능력치 상승",  [r"\bstrength\b", r"\bdexterity\b", r"\bfocus\b", r"\boverdrive\b", r"\bpowerdrive\b", r"\brage\b", r"gain(?:s)? \+?\d+ (?:\[attack\]|attack)", r"\bvalor\b"]),
    "debuff":        ("적 약화",          [r"\bvulnerable\b", r"\bweak\b", r"\bfrail\b", r"\bsap\b", r"lock-?on", r"melee weakness", r"spell weakness", r"\bbrittle\b"]),
    "dot_apply":     ("지속 피해 부여",    [r"\bpoison", r"frostbite", r"\bcorrode", r"\boxidation", r"\bbleed", r"\bburn(?:ing)?\b(?! ?out)", r"\bdoom\b"]),
    "generate":      ("카드 생성",        [r"\badd .*? (?:to|into) your (?:hand|draw pile|discard pile|deck)", r"\bcreate", r"\bshivs?\b", r"\bgenerate"]),
    "pollute":       ("자기 덱 오염",      [r"(?:wound|dazed|burn|slimed|void|trash|status) .*?(?:into|to) your", r"add .*?(?:status|curse)"]),
    "exhaust_other": ("다른 카드 소멸",    [r"exhaust (?:a|\d+|all|your|the|any) ", r"\bpurge\b"]),
    "summon":        ("소환·설치",        [r"\bsummon", r"\bchannel", r"\borb", r"\bdrone", r"\bmissile", r"\bmidrow", r"\bmorsel", r"\bimp\b", r"spawn", r"\blaunch\b"]),
    "position":      ("위치 이동",        [r"\bmove\b", r"\bascend\b", r"\bdescend\b", r"\bswap\b", r"\bfront\b", r"\bback\b", r"\bevade\b", r"\bflip\b"]),
    "transform":     ("카드 변형·강화",    [r"\bupgrade", r"\btransform", r"\bevolve", r"permanently"]),
    "control":       ("행동 방해",        [r"\bstun", r"\bdazed\b", r"\brooted\b", r"skip", r"\bstall", r"engine lock", r"\btimestop", r"\bjam\b"]),
    "self_damage":   ("자해",            [r"lose \d+ (?:hp|health)", r"take \d+ damage", r"\bsacrifice"]),
    "economy":       ("골드·보상",        [r"\bgold\b", r"\bcoin", r"card reward", r"\brelic"]),
    "mode":          ("자세·형태 전환",    [r"\bstance\b", r"\bwrath\b", r"\bcalm\b", r"\bdivinity\b", r"\bform\b"]),
}

# ── 자원·상태 계열 (생산/소비 판정 대상) ─────────────────────
#  terms: 이 계열을 가리키는 단어들 (게임마다 이름이 다르다)
FAMILIES = {
    "attack_stat":  ("공격 능력치 (힘·분노·오버드라이브)", [r"strength", r"\brage\b", r"overdrive", r"powerdrive", r"\bvalor\b", r"\+\d+ \[attack\]"]),
    "defense_stat": ("방어 능력치 (민첩·방어 증폭)",      [r"dexterity", r"\barmor\b"]),
    "block":        ("방어도 (블록·실드)",              [r"\bblock\b", r"\bshield\b", r"temp shield"]),
    "vulnerable":   ("받는 피해 증가 (취약·조준)",        [r"vulnerable", r"lock-?on", r"spell weakness", r"melee weakness", r"\bbrittle\b"]),
    "weak":         ("주는 피해 감소 (약화·수액)",        [r"\bweak\b", r"\bsap\b"]),
    "dot":          ("지속 피해 (독·동상·부식)",         [r"poison", r"frostbite", r"corrode", r"oxidation", r"\bbleed", r"\bdoom\b"]),
    "orb_summon":   ("설치물 (오브·드론·미사일·소환물)",   [r"\borbs?\b", r"\bdrones?\b", r"\bmissiles?\b", r"\bmidrow\b", r"\bminions?\b", r"\bmorsels?\b", r"\bimps?\b", r"summon"]),
    "token_card":   ("토큰 카드 (단검·생성 카드)",        [r"\bshivs?\b", r"\bcreate", r"add .*? to your hand"]),
    "energy":       ("에너지·불씨",                    [r"energy", r"\[e\]", r"\bember\b"]),
    "self_status":  ("자기 덱의 상태·저주 카드",          [r"\bstatus\b", r"\bcurses?\b", r"\bwound", r"\bdazed\b", r"\bslimed\b", r"\btrash\b", r"\bburn\b"]),
    "exhaust":      ("소멸",                          [r"exhaust", r"\bpurge\b", r"\bconsume\b"]),
    "discard":      ("버리기",                        [r"discard"]),
    "heat":         ("과열·자해 자원",                  [r"\bheat\b", r"overheat", r"lose \d+ (?:hp|health)", r"\bsacrifice"]),
    "evade":        ("회피·위치",                      [r"\bevade\b", r"\bmove\b", r"\bascend\b", r"\bdescend\b"]),
    "thorns":       ("반사 피해 (가시)",               [r"thorns", r"\bspikes\b", r"damage shield"]),
    "stance":       ("자세·만트라",                    [r"stance", r"\bwrath\b", r"\bcalm\b", r"mantra", r"divinity"]),
}

# 소비 판정: 계열 단어가 아래 문맥 안에 있으면 '소비'로 본다.
CONSUME_CONTEXT = [
    r"for (?:each|every) (?:{t})",
    r"equal to (?:your |its |the |their )?(?:current )?(?:{t})",
    r"(?:double|triple|multiply) .*?(?:{t})",
    r"if .*?(?:has|have|is|are) .*?(?:{t})",
    r"(?:remove|consume|lose|spend|expend) (?:all |\d+ |x )?(?:of (?:your|its) )?(?:{t})",
    r"(?:whenever|when|each time) .*?(?:{t})",
    r"(?:{t}) .*?(?:triggers?|is applied|are applied|is gained)",
    r"per (?:{t})",
    r"(?:{t}) (?:stacks? )?(?:on|of) (?:the |all |each )?(?:target|enem)",
]

# ── 카드 성질 ─────────────────────────────────────────────
PROPS = {
    "exhaust_self": ("사용 후 소멸·1회용", [r"\bexhaust\.?$", r"^exhaust\b", r"\. exhaust\.?", r"\bconsume\b", r"single.?use"]),
    "ethereal":     ("휘발",            [r"\bethereal\b", r"\btemporary\b", r"\bpurge\b"]),
    "retain":       ("보존",            [r"\bretain\b", r"\bholdover\b", r"\bbuoyant\b"]),
    "innate":       ("선천",            [r"\binnate\b", r"\bintrinsic\b"]),
    "unplayable":   ("사용 불가",        [r"\bunplayable\b"]),
    "x_cost":       ("X 비용",          []),  # cost 필드로 판정
    "persistent":   ("지속(파워)",       []),  # type 필드로 판정
}

# ── 조건 ─────────────────────────────────────────────────
CONDITIONS = {
    "if_target_status": ("대상의 상태 조건",   [r"if (?:the )?(?:target|enemy|it) (?:has|is)", r"if .*?enemy .*?(?:has|is)"]),
    "if_self_state":    ("자신 상태 조건",     [r"if you (?:have|are|have no)", r"while you", r"if your"]),
    "if_played_count":  ("이번 턴 사용 수",    [r"cards? (?:you've |you have )?played this turn", r"(?:\d+(?:st|nd|rd|th)) card", r"each card you play"]),
    "if_sequence":      ("직전 카드 조건",     [r"last card", r"previous card", r"if you played"]),
    "if_hp":            ("체력 조건",         [r"(?:hp|health) (?:is )?(?:below|above|less|at)", r"half"]),
    "if_pile":          ("더미·손패 조건",     [r"if your hand", r"cards? in your (?:hand|draw pile|discard pile|exhaust pile)", r"no cards"]),
    "on_trigger":       ("사건 발동형",       [r"\bwhenever\b", r"\bwhen\b", r"at the (?:start|end) of", r"\bslay\b", r"\brevenge\b", r"\bharvest\b", r"\bincant\b", r"\bresolve\b", r"\bextinguish\b", r"\bstrike:"]),
}

# ── 성장 방식 ────────────────────────────────────────────
SCALING = {
    "per_stack":     ("스택 비례",        [r"for each", r"equal to", r"per "]),
    "per_turn":      ("매 턴 누적",       [r"at the start of (?:your|each) turn", r"each turn", r"every turn"]),
    "permanent_run": ("런 전체 영구 성장", [r"permanently", r"for the rest of (?:the|this) (?:run|game)"]),
    "combat_ramp":   ("전투 중 누적",     [r"this combat", r"increase .*? damage", r"\bgrows?\b", r"each time .*? is played"]),
}

"""DD식 던전 생성 몬테카를로 검증 (Phase 5).

docs/05-exploration.md 의 생성 규칙(방·통로 수, 내용물 확률)으로 던전을 많이 만들어
원정 길이별 '첫 전투(카드 보상) 수', 기물 수, 덫 수가 목표 범위에 드는지 확인한다.
목표: docs/research/exploration-reference.md §5.2

실행: python3 tools/design/dungeon_sim.py [--n 20000]
"""
import argparse
import random
import statistics

# ── 생성 규칙 (05-exploration.md §2와 같아야 한다) ─────────────
LENGTHS = {
    # 방 수 범위, 수호 방(엘리트) 수 범위, 길굿(야영) 횟수, 고리 통로 수
    "짧음": {"rooms": (8, 9), "guard": (0, 1), "camps": 0, "loops": 1},
    "보통": {"rooms": (12, 13), "guard": (1, 2), "camps": 1, "loops": 3},
    "김": {"rooms": (16, 17), "guard": (2, 3), "camps": 2, "loops": 5},
}
TILES_PER_CORRIDOR = 3
ROOM = {"battle": 0.45, "curio": 0.28, "event": 0.10, "empty": 0.17}
TILE = {"battle": 0.14, "curio": 0.17, "trap": 0.08, "empty": 0.61}
VISIT = (0.80, 1.00)       # 플레이어가 방문하는 방 비율 (목표: 75% 이상)
AMBUSH = 0.15              # 야영 밤 습격 확률(뒷전 차림·망보기 없을 때)

TARGET = {  # (첫 전투, 기물)
    "짧음": ((5, 6), (4, 6)),
    "보통": ((9, 11), (8, 10)),
    "김": ((13, 16), (12, 15)),
}


def pick(rng, table):
    r, acc = rng.random(), 0.0
    for k, p in table.items():
        acc += p
        if r < acc:
            return k
    return k


def one_run(rng, spec):
    rooms = rng.randint(*spec["rooms"])
    guard = rng.randint(*spec["guard"])
    corridors = (rooms - 1) + spec["loops"]   # 신장 트리 + 고리 통로(되돌아가기를 줄인다)
    visit = rng.uniform(*VISIT)
    normal_rooms = rooms - 1 - guard           # 입구 1개 제외
    out = {"battle": 0, "curio": 0, "trap": 0, "event": 0, "guard": 0}
    for _ in range(normal_rooms):
        if rng.random() < visit:
            k = pick(rng, ROOM)
            if k in out:
                out[k] += 1
    out["guard"] = sum(1 for _ in range(guard) if rng.random() < max(visit, 0.9))
    walked = round(corridors * visit)
    for _ in range(walked * TILES_PER_CORRIDOR):
        k = pick(rng, TILE)
        if k in out:
            out[k] += 1
    out["battle"] += sum(1 for _ in range(spec["camps"]) if rng.random() < AMBUSH)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    ok_all = True
    print(f"{'길이':<4} {'첫전투 평균':>10} {'목표':>8} {'기물 평균':>9} {'목표':>8} {'덫':>5} {'방이벤트':>7} {'수호방':>6}  판정")
    for name, spec in LENGTHS.items():
        runs = [one_run(rng, spec) for _ in range(a.n)]
        m = {k: statistics.mean(r[k] for r in runs) for k in runs[0]}
        (bl, bh), (cl, ch) = TARGET[name]
        ok = bl - 0.5 <= m["battle"] <= bh + 0.5 and cl - 0.5 <= m["curio"] <= ch + 0.5
        ok_all &= ok
        print(f"{name:<4} {m['battle']:>10.1f} {f'{bl}-{bh}':>8} {m['curio']:>9.1f} {f'{cl}-{ch}':>8} {m['trap']:>5.1f} {m['event']:>7.1f} {m['guard']:>6.1f}  {'✅' if ok else '❌'}")
    raise SystemExit(0 if ok_all else 1)


if __name__ == "__main__":
    main()

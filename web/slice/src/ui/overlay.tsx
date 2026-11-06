// 무대 위 HTML 층(새 그림): 의도 배지(그림 · 수치 · 대상 칸 글자 · → 대상) · 원귀 이름판(체력 · 명부 처형선 · 상태 · 해원 조건)
// · 영웅 이름판(체력 · 예상 피해 · 방어 · 귀기 · 개인 자원 · 쓰러짐) · 굿상 판. 자리는 PixiJS 무대와 같은 무대 좌표(layout.ts).

import type { CSSProperties, JSX } from 'preact';
import { capActive, collapsed, deathSaveChance, haewonSatisfied, standing } from '../../../../src/core/engine.ts';
import { intentTargets } from '../../../../src/core/enemy.ts';
import type { CombatState, HeroState } from '../../../../src/core/types.ts';
import { intentView, slotName, type IntentView } from '../../../src/game/combat.ts';
import { D, HERO_COLOR } from '../../../src/game/content.ts';
import { heroName } from '../../../src/game/run.ts';
import { Icon, Pips, St } from '../../../src/ui/common.tsx';
import { HpBar } from '../../../src/ui/scene/stage.tsx';
import { ALTAR_X, PLATE_Y, enemyOrder, enemySlots, heroXs } from '../stage/layout.ts';

const pct = (x: number) => `${(x / 1280) * 100}%`;
const SLOT_MARK: Record<string, string> = { 선두: '선', 중열: '중', 후열: '후' };

function kindClass(iv: IntentView): string {
  if (iv.cancelled) return 'cancel';
  if (['attack', 'attack_debuff'].includes(iv.kind)) return 'k-attack';
  if (iv.kind === 'move') return 'k-move';
  if (['stress', 'pollute', 'possess'].includes(iv.kind)) return 'k-stress';
  return 'k-calm';
}

function markOf(s: CombatState, ei: number, iv: IntentView): string {
  const e = s.enemies[ei];
  const it = D().enemies[e.def].intents[e.intent];
  if (it.target === '전체') return '전';
  if (it.target === '굿상') return '굿';
  if (['자신', '아군 원귀'].includes(it.target)) return '자';
  const ts = intentTargets(s, e, it, true);
  if (ts.length === 1) return SLOT_MARK[slotName(s, ts[0][0])] ?? '?';
  void iv;
  return '?';
}

function resLine(h: HeroState): JSX.Element | null {
  switch (h.id) {
    case 'manshin': return <>신바람 <Pips n={h.personal} max={5} /></>;
    case 'posu': return <>화약 <Pips n={h.personal} max={3} /></>;
    case 'seungnyeo': return <>염주 <b>{h.personal}</b>/9</>;
    default: return null;
  }
}

export interface OverlayProps {
  s: CombatState;
  phase: 'player' | 'enemy';
  inc: number[];
  enemyTargetable: (ei: number) => boolean;
  heroTargetable: (h: HeroState) => boolean;
  onEnemy: (ei: number) => void;
  onHero: (hi: number) => void;
}

export function StageOverlay({ s, phase, inc, enemyTargetable, heroTargetable, onEnemy, onHero }: OverlayProps) {
  const d = D();
  const hx = heroXs(s);
  const slots = enemySlots(s);
  const order = enemyOrder(s);
  const showIntent = phase === 'player' && s.outcome === 0;
  return (
    <div class="sl-ov" data-testid="sl-overlay">
      {s.heroes.map((h) => {
        const x = hx.get(h.idx) ?? 60;
        const t = heroTargetable(h);
        const unb = Math.max(0, (inc[h.idx] ?? 0) - h.block);
        return (
          <div key={`h${h.idx}`} class={`sl-unit hero ${t ? 'targetable' : ''} ${h.downed ? 'downed' : ''} ${h.dead ? 'dead' : ''}`} style={{ left: pct(x - 64), width: pct(128), '--hc': HERO_COLOR[h.id] } as CSSProperties}
            onClick={t ? () => onHero(h.idx) : undefined} data-testid={`hero-${h.id}`} role={t ? 'button' : undefined} aria-label={t ? `${heroName(h.id)} 고르기` : undefined}>
            <div class="sl-plate sl-hplate" style={{ top: `calc(var(--u) * ${PLATE_Y})` }}>
              <div class="row1"><span class="sl-slot">{h.dead ? '떠남' : slotName(s, h.idx)}</span>{unb > 0 && showIntent && !h.downed && !h.dead && <span class="sl-inc" title="보이는 의도로 예상한 피해(방어도 뒤)">−{unb}</span>}</div>
              <div class="nm">{heroName(h.id)}</div>
              {!h.dead && <HpBar hp={h.hp} max={h.maxHp} block={h.block} incoming={h.downed || !showIntent ? 0 : unb} hero />}
              {!h.dead && <div class="sl-stress" title="귀기 (50·100에서 씌임)"><i style={{ width: `${Math.min(100, h.stress)}%` }} /><span>귀기 {h.stress}</span></div>}
              {h.downed && <div class="downed">쓰러짐 · 넋 부르기 {h.rescue}/{h.rescueNeed} · 버틸 {Math.round(deathSaveChance(h.survived) * 100)}%{h.downTurn === s.turn ? ' · 이번 턴 보호' : ''}</div>}
              {!h.dead && !h.downed && <div class="res">{resLine(h)}{h.weak > 0 && <St k="weak" n={h.weak} title="약화: 주는 피해 −25%" />}{h.possess > 0 && <St k="possess" n={h.possess} title="홀림: 카드 효과 없음" />}{s.heroes.some((o) => o.cover === h.idx && standing(o)) && <span class="st good">엄호</span>}</div>}
            </div>
          </div>
        );
      })}
      {order.map((ei) => {
        const e = s.enemies[ei];
        const def = d.enemies[e.def];
        const slot = slots.get(ei)!;
        const t = enemyTargetable(ei);
        const iv = e.alive && e.intent >= 0 && showIntent ? intentView(s, ei) : null;
        const executes = e.alive && e.doom > 0 && e.doom >= e.hp;
        const ok = e.alive && def.haewon.kind !== 'none' && haewonSatisfied(s, e);
        return (
          <div key={`e${e.uid}`} class={`sl-unit enemy ${t ? 'targetable' : ''} ${!e.alive ? 'gone' : ''} ${def.category}`} style={{ left: pct(slot.x - slot.w / 2), width: pct(slot.w) }}
            onClick={t ? () => onEnemy(ei) : undefined} data-testid={`enemy-${ei}`} role={t ? 'button' : undefined} aria-label={t ? `${def.name} 고르기` : undefined}>
            {iv && (
              <div class={`sl-intent ${kindClass(iv)}`} data-testid={`intent-${ei}`} title={iv.effect || iv.name}>
                <span class="r1">
                  <Icon name={iv.icon} size={16} />
                  {iv.per !== null && !iv.cancelled && <b class="dmg">{iv.per}{iv.hits > 1 ? `×${iv.hits}` : ''}</b>}
                  <span class="nm">{iv.cancelled ? '붕괴 — 행동 취소' : iv.name}</span>
                  {!iv.cancelled && <i class="mark" aria-label={`대상 ${markOf(s, ei, iv)}`}>{markOf(s, ei, iv)}</i>}
                </span>
                {!iv.cancelled && iv.targetLabel && <span class="tg">→ {iv.targetLabel}</span>}
              </div>
            )}
            <div class="sl-plate sl-eplate" style={{ top: `calc(var(--u) * ${PLATE_Y})` }}>
              <div class="nm">{def.name}{def.category === 'boss' && <span class="tag"> · 보스</span>}{def.category === 'elite' && <span class="tag"> · 수호</span>}</div>
              {e.alive ? (
                <>
                  <HpBar hp={e.hp} max={e.maxHp} block={e.block} doom={e.doom} />
                  <div class="res">
                    {e.mark > 0 && <St k="mark" n={e.mark} label="점지" title="점지: 쌓이고 줄지 않는다" />}
                    {e.bleed > 0 && <St k="bleed" n={e.bleed} label="상흔" title="상흔: 적 턴 시작에 이만큼 잃는다" />}
                    {e.doom > 0 && <St k="doom" n={e.doom} label="명부" title="명부: 턴 끝에 명부 ≥ 체력이면 처형" />}
                    <St k="shake" n={`${e.shake}/${e.endure}`} label="넋" title="넋흔들림 / 버팀 — 버팀에 닿으면 붕괴" />
                    {collapsed(s, e) && <St k="collapse" label="붕괴" title="받는 피해 ×1.5" />}
                    {e.vuln > 0 && <St k="vuln" n={e.vuln} label="취약" />}
                    {e.weak > 0 && <St k="weak" n={e.weak} label="약화" />}
                    {e.bound && <St k="bound" label="묶임" />}
                    {e.atkBonus > 0 && <St k="buff" n={`+${e.atkBonus}`} title="누적 공격 보너스" />}
                    {executes && <span class="st collapse">처형 예정</span>}
                    {def.cap && <span class="st">빗장 {capActive(s, e) ? `${Math.max(0, def.cap.n - e.capLost)}/${def.cap.n}` : '풀림'}</span>}
                  </div>
                  {def.haewon.kind !== 'none' && <div class={`hw ${ok ? 'ok' : ''}`} title={def.haewon.text} data-testid={`haewon-${ei}`}>{ok ? '◆' : '◇'} 해원 · {def.haewon.text}</div>}
                </>
              ) : (
                <div class={`fate ${e.escaped ? 'escape' : e.haewon ? 'haewon' : 'kill'}`} data-testid={`fate-${ei}`}>{e.escaped ? '달아남' : e.haewon ? '해원' : '처치'}</div>
              )}
            </div>
          </div>
        );
      })}
      <div class="sl-altar" style={{ left: pct(ALTAR_X - 66), width: pct(132), top: `calc(var(--u) * ${PLATE_Y + 8})` }} data-testid="altar">
        <b>굿상</b>
        {s.summons.length === 0 && <span class="dim"> 비었다</span>}
        {s.summons.map((x, i) => {
          const sd = d.summons[x.s];
          return <div key={i} title={sd.text}>{sd.name} · {sd.trigger === 'turn_end' ? '턴 끝' : '턴 시작'} {x.left}</div>;
        })}
      </div>
    </div>
  );
}

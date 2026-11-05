// 마을 파노라마(VillagePanorama · Hanok) · 사당 위패(SadangTablets) · 계보도(Lineage).
// 시설 상태: 빈 부지(말뚝·새끼줄) · 잠긴 부지(점선) · 1단계(초가) · 2단계(기와·금줄·푸른 단청) · 3단계(붉은 단청). 신당 3단계면 솟대.
// 쉬는 사람은 주막 앞, 치료받는 사람은 약방 앞에 선다. 절기마다 하늘빛이 바뀐다(봄·여름·가을·겨울).

import type { JSX } from 'preact';
import { ancestors, buildOptions, displayName, lineage, tier } from '../../../../src/meta/campaign.ts';
import { CD } from '../../../../src/meta/content.ts';
import type { Campaign, FacilityId } from '../../../../src/meta/types.ts';
import { HERO_COLOR } from '../../game/content.ts';
import { HeroParts, Shadow } from './hero.tsx';
import { HANJI, hashOf, pctX, pctY } from './palette.ts';
import { DangsanTree, Hanok, Sotdae, Tablet, type LotState } from './props.tsx';
import { SoulWisp } from './spirit.tsx';
import { Stage } from './stage.tsx';

const W = 1280;

const SEASON_SKY: [string, string, string][] = [
  ['#1e2a44', '#3a3a58', '#6a5a62'], // 봄
  ['#18283a', '#2e4048', '#5a6a4a'], // 여름
  ['#22203a', '#4a3346', '#8a5a40'], // 가을
  ['#1a2234', '#3a4458', '#8a92a4'], // 겨울
];

const LOTS: [FacilityId, number, number, number][] = [
  // id, x, 폭, 높이
  ['sindang', 210, 120, 72],
  ['gaekju', 360, 104, 62],
  ['jumak', 500, 98, 58],
  ['yakbang', 630, 90, 54],
  ['sadang', 760, 100, 62],
  ['jangteo', 900, 112, 52],
  ['mugubang', 1040, 98, 58],
  ['jeonsucheong', 1170, 96, 60],
];

/** 마을 한 장. data-testid=scene 은 지난 판과 같다 */
export function VillagePanorama({ c }: { c: Campaign }) {
  const H = 330;
  const GY = 262;
  const season = Math.floor((c.season % 24) / 6);
  const [a, b, d] = SEASON_SKY[season];
  const opts = buildOptions(c);
  const anc = ancestors(c);
  const svgParts: JSX.Element[] = [];
  const caps: JSX.Element[] = [];
  for (const [id, x, w, h] of LOTS) {
    const def = CD.facilities.find((f) => f.id === id)!;
    const t = tier(c, id);
    const o = opts.find((q) => q.id === id);
    const state: LotState = t > 0 ? 'built' : o && !o.why?.includes('부지') ? 'open' : 'lock';
    const sub = t > 0 ? `${t}단계` : state === 'open' ? '빈 부지' : '잠긴 부지';
    svgParts.push(
      <Hanok key={id} x={x} y={GY} w={w} h={h} label={def.name} sub={sub} state={state} tier={t}>
        {id === 'sindang' && t > 0 && <g transform={`translate(0 ${-h * 0.55})`}>{Array.from({ length: Math.min(3, t) }, (_, k) => <circle key={k} cx={(k - (Math.min(3, t) - 1) / 2) * 22} cy="0" r="8" fill="#e2b23a" stroke="#6a4a1a" />)}</g>}
        {id === 'sadang' && t > 0 && <g transform={`translate(0 ${-h * 0.5})`}>{anc.slice(0, 4).map((f, k, arr) => <rect key={f.person.uid} x={(k - (arr.length - 1) / 2) * 16 - 5} y="-12" width="10" height="24" rx="2" fill="#e8cf7c" stroke="#5a4524" />)}</g>}
        {id === 'jumak' && t > 0 && <g transform={`translate(${w / 2 - 6} ${-h - 14})`}><path d="M0 0 L0 50" stroke="#4a3a2a" stroke-width="3" /><rect x="0" y="0" width="20" height="28" fill="#efe6cf" stroke="#4a3a2a" /></g>}
        {id === 'jangteo' && t > 0 && <g transform="translate(0 -8)">{[-30, 0, 30].map((dx) => <rect key={dx} x={dx - 12} y="-14" width="24" height="12" fill={['#c33427', '#e2b23a', '#2f86a6'][(dx / 30 + 1) | 0]} opacity=".85" />)}</g>}
      </Hanok>,
    );
  }
  // 사람: 쉬는 사람 → 주막, 치료 → 약방, 나머지는 객주·신당 앞
  const spots: Record<string, number[]> = { rest: [470, 535], treat: [605, 655], free: [175, 245, 330, 395, 700, 820, 870, 960] };
  const used: Record<string, number> = { rest: 0, treat: 0, free: 0 };
  c.roster.slice(0, 9).forEach((p) => {
    const kind = p.busy === 'rest' ? 'rest' : p.busy === 'treat' || p.injured ? 'treat' : 'free';
    const xs = spots[kind];
    const x = xs[used[kind]++ % xs.length];
    const v = hashOf(p.uid);
    svgParts.push(
      <g key={p.uid} transform={`translate(${x} ${GY + 34}) scale(${v % 2 ? -0.4 : 0.4} 0.4)`} class="villager-hero">
        <title>{`${displayName(p)}${p.busy === 'rest' ? ' — 주막에서 쉼' : p.busy === 'treat' ? ' — 약방 치료' : ''}`}</title>
        <Shadow />
        <HeroParts id={p.arch} look={{ v }} />
      </g>,
    );
  });
  const rift = Math.max(0, Math.min(CD.rift.max, c.rift));
  const svg = (
    <>
      <defs><linearGradient id="vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={a} /><stop offset=".55" stop-color={b} /><stop offset="1" stop-color={d} /></linearGradient></defs>
      <rect width={W} height={H} fill="url(#vsky)" />
      {/* 저승문 균열: 하늘에 그은 금 (칸 수만큼 길어진다) */}
      {rift > 0 && <path d={`M${980} 20 ${Array.from({ length: rift }, (_, i) => `L${980 + (i % 2 ? 14 : -10) + i * 6} ${20 + (i + 1) * 9}`).join(' ')}`} stroke="#c25a7a" stroke-width={1.5 + rift * 0.25} fill="none" opacity=".75" />}
      {season === 3 && Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 97) % W} cy={(i * 53) % (GY - 40)} r="1.6" fill="#fff" opacity=".6" />)}
      <path d={`M0 190 Q140 110 300 170 T620 140 T940 160 T${W} 130 V${GY} H0 Z`} fill="#2a2c46" opacity=".85" />
      <path d={`M0 220 Q200 175 420 212 T860 200 T${W} 208 V${GY} H0 Z`} fill="#33304a" />
      <path d={`M0 220 Q200 175 420 212 T860 200 T${W} 208 V${GY} H0 Z`} fill="url(#jsg-hanji)" opacity=".6" />
      <rect y={GY - 4} width={W} height={H - GY + 4} fill="#2a2418" />
      <path d={`M0 ${GY + 30} Q${W / 2} ${GY + 12} ${W} ${GY + 34}`} stroke={HANJI} stroke-width="10" opacity=".16" fill="none" />
      <DangsanTree x={70} y={GY} geumjul={tier(c, 'sindang') >= 2} />
      {svgParts}
      {tier(c, 'sindang') >= 3 && <Sotdae x={1258} y={GY} s={0.9} />}
    </>
  );
  caps.push(<div key="s" class="scene-cap" style={{ left: pctX(18), top: pctY(10, H) }}><b>마을</b> · {['봄', '여름', '가을', '겨울'][season]}</div>);
  return <Stage W={W} H={H} cls="scene-stage village-scene" label="마을 풍경 — 시설이 서면 건물·사람·금줄·솟대가 는다" svg={svg} overlay={caps} testid="scene" />;
}

/** 사당: 조상신 위패 + 천도를 기다리는 넋(빈 위패 위에 넋) */
export function SadangTablets({ c }: { c: Campaign }) {
  const anc = ancestors(c);
  const pending = c.fallen.filter((f) => !f.honored);
  const H = 210;
  const items = [...anc.map((f) => ({ f, honored: true })), ...pending.map((f) => ({ f, honored: false }))].slice(0, 12);
  const sp = Math.min(120, 1100 / Math.max(1, items.length));
  const x0 = 640 - ((items.length - 1) * sp) / 2;
  const svg = (
    <>
      <rect width={W} height={H} fill="#1a1410" />
      <rect y="0" width={W} height="20" fill="#2a1a12" />
      <rect x="0" y="150" width={W} height="14" fill="#5a2a18" />
      <rect x="0" y="164" width={W} height={H - 164} fill="#22160e" />
      {items.length === 0 && <text x="640" y="110" text-anchor="middle" font-size="16" fill="#7d7765">아직 조상신이 없다</text>}
      {items.map(({ f, honored }, i) => (
        <g key={f.person.uid} opacity={honored ? 1 : 0.65}>
          <Tablet x={x0 + i * sp} y={150} s={0.95} name={f.person.name} color={HERO_COLOR[f.person.arch]} glow={honored} />
          {!honored && <SoulWisp x={x0 + i * sp + 28} y={70} s={0.22} />}
        </g>
      ))}
    </>
  );
  const caps = items.map(({ f, honored }, i) => (
    <div key={f.person.uid} class={`scene-cap c ${honored ? '' : 'dim'}`} style={{ left: pctX(x0 + i * sp), top: pctY(168, H) }}>{honored ? (f.sinmul ? '신물 1장' : '조상신') : f.wandering ? '떠도는 넋' : '천도 대기'}</div>
  ));
  return <Stage W={W} H={H} cls="scene-stage sadang-scene" label="사당 — 위패" svg={svg} overlay={caps} testid="sadang-scene" />;
}

/** 계보도: 조상신(위패) → 신딸(인형) … 한 줄씩 */
export function LineageScene({ c }: { c: Campaign }) {
  const lines = lineage(c);
  if (!lines.length) return null;
  const H = 150 * Math.min(3, lines.length);
  const svg = (
    <>
      <rect width={W} height={H} fill="#151a2a" />
      {lines.slice(0, 3).map((l, r) => {
        const y = 130 + r * 150;
        const chain = [l.root, ...l.chain];
        return (
          <g key={l.root.person.uid}>
            {chain.map((x, k) => {
              const cx = 120 + k * 220;
              const isFallen = 'person' in x;
              const pp = isFallen ? x.person : x;
              return (
                <g key={pp.uid}>
                  {k > 0 && <path d={`M${cx - 170} ${y - 50} H${cx - 50}`} stroke="#c9a85a" stroke-width="2" stroke-dasharray="5 4" />}
                  {k > 0 && <path d={`M${cx - 50} ${y - 50} l-8 -5 l0 10 Z`} fill="#c9a85a" />}
                  {isFallen ? <Tablet x={cx} y={y} s={0.75} name={pp.name} color={HERO_COLOR[pp.arch]} /> : (
                    <g transform={`translate(${cx} ${y}) scale(0.62)`}><Shadow /><HeroParts id={pp.arch} look={{ v: hashOf(pp.uid) }} /></g>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
  const caps = lines.slice(0, 3).flatMap((l, r) => [l.root, ...l.chain].map((x, k) => {
    const pp = 'person' in x ? x.person : x;
    return <div key={`${r}-${pp.uid}`} class="scene-cap c" style={{ left: pctX(120 + k * 220 + 70), top: pctY(60 + r * 150, H) }}>{pp.name}<br /><span class="tiny dim">{'person' in x ? '조상신' : k === 0 ? '' : '신딸'}</span></div>;
  }));
  return <Stage W={W} H={H} cls="scene-stage lineage-scene" label="계보도 — 신어머니에서 신딸로" svg={svg} overlay={caps} testid="lineage-scene" />;
}

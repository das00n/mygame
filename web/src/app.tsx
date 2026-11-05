// 화면 전환 (표지 → 신당 → 저승길 ⇄ 전투·보상·길굿 → 결과). PC 전용(D8-2): 가로 1024 미만이면 안내하고 전체를 줄인다.

import type { CSSProperties } from 'preact';

import { useEffect, useState } from 'preact/hooks';
import { app, commit, ui, useStore } from './game/store.ts';
import { useAutoDriver } from './ui/auto.tsx';
import { CombatScreen } from './ui/combat.tsx';
import { MapScreen } from './ui/map.tsx';
import { CampScreen, DialogView, Panels, PickerView, ResultScreen, RewardScreen } from './ui/screens.tsx';
import { SceneDefs } from './ui/scene/index.ts';
import { ShrineScreen, TitleScreen } from './ui/shrine.tsx';
import { EndingScreen, SettleScreen, VillageScreen } from './ui/village.tsx';

export function App() {
  const a = useStore();
  useAutoDriver();
  useEffect(() => {
    if (!a.toast) return;
    const t = setTimeout(() => {
      app.toast = null;
      commit();
    }, 2600);
    return () => clearTimeout(t);
  }, [a.toast]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo?.(0, 0);
  }, [a.screen]);
  let body;
  switch (a.screen) {
    case 'title': body = <TitleScreen />; break;
    case 'shrine': body = <ShrineScreen />; break;
    case 'map': body = a.run ? <MapScreen /> : <TitleScreen />; break;
    case 'combat': body = a.combat ? <CombatScreen /> : <TitleScreen />; break;
    case 'reward': body = a.reward ? <RewardScreen /> : <TitleScreen />; break;
    case 'camp': body = a.camp ? <CampScreen /> : <TitleScreen />; break;
    case 'result': body = a.result ? <ResultScreen /> : <TitleScreen />; break;
    case 'village': body = a.campaign ? <VillageScreen /> : <TitleScreen />; break;
    case 'settle': body = a.campaign && a.settlement ? <SettleScreen /> : a.campaign ? <VillageScreen /> : <TitleScreen />; break;
    case 'ending': body = a.campaign?.ending ? <EndingScreen /> : <TitleScreen />; break;
  }
  const fit = usePcFit();
  return (
    <div class={`app ${fit.zoom < 1 ? 'fit' : ''}`} data-screen={a.screen} style={fit.zoom < 1 ? ({ '--fit': fit.zoom } as CSSProperties) : undefined}>
      <SceneDefs />
      {fit.narrow && (
        <div class="pc-notice" data-testid="pc-notice">
          <span>이 판은 <b>PC용</b>이다(가로 1280 이상 권장). 좁은 화면에서는 전체를 줄여서 보여 준다.</span>
          <button class="btn small" onClick={fit.toggle}>{fit.zoom < 1 ? '원래 크기로 계속' : '화면에 맞게 줄이기'}</button>
        </div>
      )}
      {body}
      {a.dialog && a.run && <DialogView />}
      {a.picker && a.run && <PickerView />}
      {ui.panel && <Panels />}
      {a.toast && <div class="toast" data-testid="toast">{a.toast}</div>}
    </div>
  );
}

/** 가로 1024 미만: 안내 + 1024 폭 배치를 화면에 맞게 줄인다(가로 스크롤 없음). 「원래 크기로 계속」을 누르면 줄이지 않는다 */
function usePcFit(): { narrow: boolean; zoom: number; toggle: () => void } {
  const read = () => (typeof window === 'undefined' ? 1280 : window.innerWidth);
  const [w, setW] = useState(read);
  const [keep, setKeep] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const f = () => setW(read());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const narrow = w < 1024;
  return { narrow, zoom: narrow && !keep ? Math.max(0.3, w / 1024) : 1, toggle: () => setKeep(!keep) };
}

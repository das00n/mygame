// 화면 전환 (표지 → 신당 → 저승길 ⇄ 전투·보상·길굿 → 결과).

import { useEffect } from 'preact/hooks';
import { app, commit, ui, useStore } from './game/store.ts';
import { useAutoDriver } from './ui/auto.tsx';
import { CombatScreen } from './ui/combat.tsx';
import { MapScreen } from './ui/map.tsx';
import { CampScreen, DialogView, Panels, PickerView, ResultScreen, RewardScreen } from './ui/screens.tsx';
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
  return (
    <div class="app" data-screen={a.screen}>
      {body}
      {a.dialog && a.run && <DialogView />}
      {a.picker && a.run && <PickerView />}
      {ui.panel && <Panels />}
      {a.toast && <div class="toast" data-testid="toast">{a.toast}</div>}
    </div>
  );
}

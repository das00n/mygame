// 자동 진행 단추와 구동기. 켜 두면 봇이 전투·지도·기물·보상·길굿을 한 걸음씩 둔다.

import { useEffect } from 'preact/hooks';
import { autoStep, resetAuto } from '../game/autoplay.ts';
import { app, commit, commitSettings, settings } from '../game/store.ts';

const SPEED_LABEL = { normal: '보통', fast: '빠름', instant: '즉시' } as const;

export function AutoToggle() {
  return (
    <span class="row" style={{ gap: '4px' }}>
      <button
        class={`btn small ${settings.auto ? 'on' : ''}`}
        data-testid="auto-toggle"
        aria-pressed={settings.auto}
        onClick={() => {
          settings.auto = !settings.auto;
          resetAuto();
          commitSettings();
        }}
      >
        자동 {settings.auto ? '켬' : '끔'}
      </button>
      {settings.auto && (
        <button
          class="btn small ghost"
          data-testid="auto-speed"
          title="자동 진행 빠르기"
          onClick={() => {
            settings.speed = settings.speed === 'normal' ? 'fast' : settings.speed === 'fast' ? 'instant' : 'normal';
            commitSettings();
          }}
        >
          {SPEED_LABEL[settings.speed]}
        </button>
      )}
    </span>
  );
}

/** 그릴 때마다 다음 한 걸음을 예약한다 (즉시면 한 틱에 여러 걸음) */
export function useAutoDriver(): void {
  useEffect(() => {
    if (!settings.auto) return;
    const active = app.dialog || app.picker || ['map', 'combat', 'reward', 'camp'].includes(app.screen)
      || (!!app.campaign && (app.screen === 'village' || app.screen === 'settle' || (app.screen === 'result' && !!app.plan)));
    if (!active) return;
    const delay = settings.speed === 'instant' ? 0 : settings.speed === 'fast' ? 90 : app.screen === 'combat' ? 420 : 300;
    const t = setTimeout(() => {
      const t0 = performance.now();
      let did = false;
      do {
        // 자동 검사용 멈춤 조건 (e2e 가 window.__JSG_STOP 에 둔다): 마을에서 조건이 맞으면 자동 진행을 끈다
        const stop = (globalThis as unknown as { __JSG_STOP?: (a: typeof app) => boolean }).__JSG_STOP;
        if (stop && app.screen === 'village' && stop(app)) {
          settings.auto = false;
          commitSettings();
          break;
        }
        // 원정 안 창(대화)에서 멈추기 (e2e 가 window.__JSG_STOP_DIALOG 에 둔다 — 대문 통행을 손으로 고르게)
        const stopD = (globalThis as unknown as { __JSG_STOP_DIALOG?: (a: typeof app) => boolean }).__JSG_STOP_DIALOG;
        if (stopD && app.dialog && stopD(app)) {
          settings.auto = false;
          commitSettings();
          break;
        }
        if (!settings.auto || !autoStep(app)) break;
        did = true;
        // 즉시 모드라도 결산·마을은 한 번 그린다
        if (app.screen === 'settle' || app.screen === 'village') break;
      } while (settings.speed === 'instant' && performance.now() - t0 < 30 && app.screen !== 'result');
      if (did) commit();
    }, delay);
    return () => clearTimeout(t);
  });
}

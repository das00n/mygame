// 앱 상태 저장소: 하나의 가변 상태 + 구독. 바꾼 뒤 commit() → 저장 + 다시 그리기.

import { useEffect, useReducer } from 'preact/hooks';
import { blankApp } from './actions.ts';
import { loadSettings, saveApp, saveSettings, type StoredSettings } from './save.ts';
import type { AppState } from './types.ts';

export const app: AppState = blankApp();
export const settings: StoredSettings = loadSettings();
// 자동 검사(e2e)가 상태를 읽을 수 있게 둔다 (읽기 전용으로만 쓴다)
(globalThis as unknown as { __JSG_APP?: AppState; __JSG_SETTINGS?: StoredSettings }).__JSG_APP = app;
(globalThis as unknown as { __JSG_SETTINGS?: StoredSettings }).__JSG_SETTINGS = settings;

const listeners = new Set<() => void>();

export function commit(): void {
  saveApp(app);
  for (const f of listeners) f();
}

export function commitSettings(): void {
  saveSettings(settings);
  for (const f of listeners) f();
}

export function useStore(): AppState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const f = () => force(0);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return app;
}

export function replaceApp(next: AppState): void {
  for (const k of Object.keys(app) as (keyof AppState)[]) delete (app as Partial<AppState>)[k];
  Object.assign(app, next);
}

// ── 화면 전용 상태 (저장하지 않는다) ────────────────────────────────
export type Panel = null | 'gloss' | 'deck' | 'menu';
export const ui: { panel: Panel } = { panel: null };

export function setPanel(p: Panel): void {
  ui.panel = p;
  for (const f of listeners) f();
}

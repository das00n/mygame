// localStorage 저장 (모든 접근을 try/catch 로 감싼다 — 저장소가 없어도 게임은 돈다).
// 전투 상태의 통계(Map)는 {__map: [...]} 로 바꿔 저장한다.

import type { AppState } from './types.ts';

const KEY = 'jeoseunggut.save.v1';
const SETTINGS_KEY = 'jeoseunggut.settings.v1';

function replacer(_k: string, v: unknown): unknown {
  if (v instanceof Map) return { __map: [...v.entries()] };
  return v;
}

function reviver(_k: string, v: unknown): unknown {
  if (v && typeof v === 'object' && '__map' in (v as Record<string, unknown>)) return new Map((v as { __map: [unknown, unknown][] }).__map);
  return v;
}

export function saveApp(app: AppState): void {
  try {
    if (!app.run || app.screen === 'title' || app.screen === 'shrine' || app.screen === 'result') return;
    const data = { ...app, toast: null };
    globalThis.localStorage?.setItem(KEY, JSON.stringify(data, replacer));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function loadApp(): AppState | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw, reviver) as AppState;
    // v2 (v0.3 반복 1): 강화판·새 설치물로 정의 번호가 바뀌어 v1 저장은 이어하지 않는다
    if (!v || !v.run || v.run.v !== 2) return null;
    if (v.combat?.s) v.combat.s.log = [];
    return v;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return !!globalThis.localStorage?.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

export interface StoredSettings {
  auto: boolean;
  speed: 'normal' | 'fast' | 'instant';
}

export function loadSettings(): StoredSettings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return { auto: false, speed: ['normal', 'fast', 'instant'].includes(v.speed) ? v.speed : 'normal' };
    }
  } catch {
    /* 무시 */
  }
  return { auto: false, speed: 'normal' };
}

export function saveSettings(s: StoredSettings): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify({ speed: s.speed }));
  } catch {
    /* 무시 */
  }
}

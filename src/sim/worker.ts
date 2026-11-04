// 워커 스레드: 메인에서 받은 조합 작업을 실행하고 결과를 돌려준다.
import { parentPort } from 'node:worker_threads';
import type { HeroId } from '../core/types.ts';
import { runCombatJob, runExpeditionJob, type WhatIf } from './jobs.ts';

export interface JobMsg {
  id: number;
  kind: 'combat' | 'expedition';
  trio: HeroId[];
  n: number;
  whatIf?: WhatIf;
  duo?: boolean;
  region?: number;
}

parentPort!.on('message', (m: JobMsg) => {
  try {
    const result = m.kind === 'combat' ? runCombatJob(m.trio, m.n, !!m.duo, m.region ?? 1) : runExpeditionJob(m.trio, m.n, m.whatIf);
    parentPort!.postMessage({ id: m.id, result });
  } catch (err) {
    parentPort!.postMessage({ id: m.id, error: String((err as Error).stack ?? err) });
  }
});

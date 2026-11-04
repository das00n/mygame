// 간단한 워커 풀: 조합 작업을 코어 수만큼 병렬로 돌린다.
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { HeroId } from '../core/types.ts';
import type { JobMsg } from './worker.ts';

export function argStr(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

export function argFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function argNum(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  return def;
}

export async function runPool<R>(kind: JobMsg['kind'], trios: HeroId[][], n: number, workers: number, onDone?: (done: number, total: number) => void, whatIf?: JobMsg['whatIf'], duo?: boolean, region?: number): Promise<R[]> {
  const count = Math.max(1, Math.min(workers, trios.length, availableParallelism()));
  const results: R[] = new Array(trios.length);
  let next = 0;
  let done = 0;
  await new Promise<void>((resolve, reject) => {
    const pool: Worker[] = [];
    const feed = (w: Worker) => {
      if (next >= trios.length) {
        w.terminate();
        return;
      }
      const id = next++;
      w.postMessage({ id, kind, trio: trios[id], n, whatIf, duo, region } satisfies JobMsg);
    };
    for (let k = 0; k < count; k++) {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { execArgv: ['--import', 'tsx'] });
      w.on('message', (m: { id: number; result?: R; error?: string }) => {
        if (m.error) {
          reject(new Error(m.error));
          for (const x of pool) x.terminate();
          return;
        }
        results[m.id] = m.result as R;
        done++;
        onDone?.(done, trios.length);
        if (done === trios.length) {
          for (const x of pool) x.terminate();
          resolve();
        } else feed(w);
      });
      w.on('error', reject);
      pool.push(w);
      feed(w);
    }
  });
  return results;
}

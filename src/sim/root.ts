// 저장소 루트 경로 (Node 전용 — 시뮬레이터가 결과 파일을 쓸 때만 쓴다).
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

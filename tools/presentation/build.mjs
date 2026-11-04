// 표현안 목업 HTML 을 만든다 → docs/design/presentation/option-*.html
// 실행: node tools/presentation/build.mjs   (그다음 render.mjs 로 PNG)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageA } from './option-a.mjs';
import { pageB } from './option-b.mjs';
import { pageC } from './option-c.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'docs', 'design', 'presentation');
mkdirSync(out, { recursive: true });

export const PAGES = [
  { file: 'option-a-stage.html', html: pageA, screens: ['combat', 'explore', 'village', 'moments'], key: 'a' },
  { file: 'option-b-diorama.html', html: pageB, screens: ['combat', 'explore'], key: 'b' },
  { file: 'option-c-table.html', html: pageC, screens: ['combat', 'explore'], key: 'c' },
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const p of PAGES) {
    writeFileSync(join(out, p.file), p.html());
    console.log('wrote', join('docs/design/presentation', p.file));
  }
}

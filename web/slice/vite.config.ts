// 그래픽 슬라이스(12-graphic-slice) — 플레이어블과 따로 빌드하는 진입점. 결과물은 PixiJS 무대까지 품은 HTML 한 장이다.
// npm run web:slice → web/dist/slice/index.html → (artifact.mjs slice) → web/dist/slice-artifact.html
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: __dirname,
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: '../dist/slice',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
  },
  server: { host: true },
});

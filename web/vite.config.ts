// 저승굿 Prototype ② — 플레이어블 1막. 결과물은 데이터·JS·CSS 를 모두 품은 HTML 한 장이다.
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: __dirname,
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
  },
  server: { host: true },
});

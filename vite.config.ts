import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // iconv-lite（rpgrt 的编码层）依赖 Node 的 buffer / string_decoder
      buffer: 'buffer',
      string_decoder: 'string_decoder',
    },
  },
  define: {
    global: 'globalThis',
  },
  server: {
    fs: {
      // @mywin/rm200x-renderer 以 file: 依赖链接到同级仓库，源码在项目根目录之外；
      // 显式覆盖 allow 时必须同时保留项目根目录
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../mywin-rm200x', import.meta.url)),
      ],
    },
  },
});

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
});

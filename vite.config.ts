import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// DistribPro is an Electron-only desktop app: the renderer talks to the
// SQLite database exclusively through window.api (electron/preload.ts).
// There is no web/online build anymore (DECISIONS D1).
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // The esbuild minifier crashes on large dependency bundles in
    // memory-limited environments; terser handles the build reliably.
    minify: 'terser',
    terserOptions: { compress: { passes: 1 } },
    rollupOptions: {
      external: [/^node:/],
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// OFFLINE=1 builds the customer desktop bundle: Supabase is swapped for a
// local on-disk Postgres (PGlite) and no network calls are compiled in.
const offline = process.env.OFFLINE === '1';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...(offline ? { '@/lib/supabase': fileURLToPath(new URL('./src/lib/localSupabase.ts', import.meta.url)) } : {}),
    },
  },
  build: {
    // The esbuild minifier crashes on large dependency bundles in
    // memory-limited environments; terser handles both builds reliably.
    minify: 'terser',
    terserOptions: { compress: { passes: 1 } },
    rollupOptions: {
      external: [/^node:/],
    },
  },
  ...(offline
    ? {
        define: { 'import.meta.env.VITE_OFFLINE': JSON.stringify('1') },
        optimizeDeps: {
          exclude: ['lucide-react', '@electric-sql/pglite'],
        },
      }
    : {}),
});

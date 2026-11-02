import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Offline mode builds the customer desktop bundle: Supabase is swapped for a
// local Postgres (PGlite) and no network calls are compiled in.
// Use `vite build --mode offline` (works on Windows too). OFFLINE=1 still works.
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const offline = mode === "offline" || process.env.OFFLINE === "1";
  return {
    base: "./",
    plugins: [react()],
    resolve: {
      // Order matters: the offline swap must come BEFORE the generic '@' alias,
      // otherwise '@' wins and the real Supabase client gets bundled (and the
      // offline app crashes on start with "supabaseUrl is required").
      alias: [
        ...(offline
          ? [
              {
                find: /^@\/lib\/supabase$/,
                replacement: fileURLToPath(
                  new URL("./src/lib/localSupabase.ts", import.meta.url),
                ),
              },
            ]
          : []),
        {
          find: "@",
          replacement: fileURLToPath(new URL("./src", import.meta.url)),
        },
      ],
    },
    build: {
      // The esbuild minifier crashes on large dependency bundles in
      // memory-limited environments; terser handles both builds reliably.
      minify: "terser",
      terserOptions: { compress: { passes: 1 } },
      rollupOptions: {
        external: [/^node:/],
      },
    },
    ...(offline
      ? {
          define: { "import.meta.env.VITE_OFFLINE": JSON.stringify("1") },
          optimizeDeps: {
            exclude: ["lucide-react", "@electric-sql/pglite"],
          },
        }
      : {}),
  };
});

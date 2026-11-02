// Bundles scripts/db-test.ts (swapping the IndexedDB database for an in-memory one) and runs it.
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync, rmSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = await build({
  entryPoints: [root + 'scripts/db-test.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  external: ['@electric-sql/pglite'],
  logLevel: 'silent',
  plugins: [{ name: 'stub-db', setup(b) { b.onResolve({ filter: /^\.\/offlineDb$/ }, () => ({ path: root + 'scripts/db-test-stub.ts' })); } }],
});
const tmp = root + '.db-test.tmp.mjs';
writeFileSync(tmp, out.outputFiles[0].text);
try {
  await import(pathToFileURL(tmp).href);
} finally {
  setTimeout(() => rmSync(tmp, { force: true }), 0);
}

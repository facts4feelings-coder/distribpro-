// In-memory stand-in for src/lib/offlineDb.ts used by scripts/db-test.ts
import { PGlite } from '@electric-sql/pglite';
import { OFFLINE_PATCH_SQL, OFFLINE_SCHEMA_SQL, OFFLINE_SEED_SQL } from '../src/lib/offlineSchema';
let p: Promise<PGlite> | null = null;
export function getDb() { if (!p) p = (async () => { const d = new PGlite(); await d.exec(OFFLINE_SCHEMA_SQL); await d.exec(OFFLINE_SEED_SQL); await d.exec(OFFLINE_PATCH_SQL); return d; })(); return p; }
export async function localQuery(sql: string, params: unknown[] = []) { const d = await getDb(); try { return { rows: (await d.query(sql, params)).rows as any[] }; } catch (e) { throw e; } }

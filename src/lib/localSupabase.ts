// Offline supabase-compatible shim.
//
// The app's pages were written against supabase-js's fluent query builder
// (.from().select().eq().order()...). This shim interprets the same call
// chains against the local PGlite database, so the UI code runs unchanged
// with zero internet. Supports the exact subset of features the app uses:
// select (* or named columns + embedded parents via foreign keys), eq/neq,
// gt/gte/lt/lte, like/ilike, in, is, order, limit, range, single, maybeSingle,
// insert, upsert, update, delete, csv export, and textSearch-free queries.

import { localQuery } from './offlineDb';

type Row = Record<string, unknown>;

interface ForeignKey {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
}

// Embedded relations used by the UI: customers?.name, suppliers?.name, employees?.name.
const FOREIGN_KEYS: ForeignKey[] = [
  { childTable: 'customer_invoices', childColumn: 'customer_id', parentTable: 'customers', parentColumn: 'id' },
  { childTable: 'supplier_invoices', childColumn: 'supplier_id', parentTable: 'suppliers', parentColumn: 'id' },
  { childTable: 'payment_vouchers', childColumn: 'customer_id', parentTable: 'customers', parentColumn: 'id' },
  { childTable: 'payment_vouchers', childColumn: 'supplier_id', parentTable: 'suppliers', parentColumn: 'id' },
  { childTable: 'salary_payments', childColumn: 'employee_id', parentTable: 'employees', parentColumn: 'id' },
  { childTable: 'customer_routes', childColumn: 'customer_id', parentTable: 'customers', parentColumn: 'id' },
  { childTable: 'customer_routes', childColumn: 'route_id', parentTable: 'routes', parentColumn: 'id' },
  { childTable: 'gate_passes', childColumn: 'customer_id', parentTable: 'customers', parentColumn: 'id' },
  { childTable: 'salesman_targets', childColumn: 'route_id', parentTable: 'routes', parentColumn: 'id' },
];

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

class PostgrestErrorShim {
  message: string;
  details: string | null;
  hint: string | null;
  code: string;
  constructor(message: string) {
    this.message = message;
    this.details = null;
    this.hint = null;
    this.code = 'PGLITE_ERR';
  }
}

class FilterBuilder {
  private conds: string[] = [];
  private params: unknown[] = [];

  constructor(private table: string) {}

  private addCond(sql: string, value?: unknown) {
    this.conds.push(sql);
    if (value !== undefined) this.params.push(value);
    return this;
  }

  eq(col: string, value: unknown) {
    return this.addCond(`${quoteIdent(col)} = ?`, value);
  }
  neq(col: string, value: unknown) {
    return this.addCond(`${quoteIdent(col)} <> ?`, value);
  }
  gt(col: string, value: unknown) {
    return this.addCond(`${quoteIdent(col)} > ?`, value);
  }
  gte(col: string, value: unknown) {
    return this.addCond(`${quoteIdent(col)} >= ?`, value);
  }
  lt(col: string, value: unknown) {
    return this.addCond(`${quoteIdent(col)} < ?`, value);
  }
  lte(col: string, value: unknown) {
    return this.addCond(`${quoteIdent(col)} <= ?`, value);
  }
  like(col: string, pattern: string) {
    const pat = pattern.replace(/\*/g, '%');
    return this.addCond(`${quoteIdent(col)} LIKE ?`, pat);
  }
  ilike(col: string, pattern: string) {
    const pat = pattern.replace(/\*/g, '%');
    return this.addCond(`${quoteIdent(col)} ILIKE ?`, pat);
  }
  is(col: string, value: unknown) {
    if (value === null) return this.addCond(`${quoteIdent(col)} IS NULL`);
    return this.addCond(`${quoteIdent(col)} IS ?`, value);
  }
  in(col: string, values: unknown[]) {
    const list = (values ?? []).map((v) => quoteLiteral(v)).join(', ');
    return this.addCond(`${quoteIdent(col)} IN (${list || 'NULL'})`);
  }
  or(expr: string) {
    return this.addCond(`(${expr})`);
  }

  buildWhere(): { sql: string; params: unknown[] } {
    return { sql: this.conds.length ? ` WHERE ${this.conds.join(' AND ')}` : '', params: this.params };
  }
}

interface SelectSpec {
  columns: string; // raw select string
  embeds: { alias: string; parentTable: string; fks: { childColumn: string; parentColumn: string }[] }[];
}

function parseSelect(table: string, raw: string | undefined): SelectSpec {
  const select = (raw ?? '*').trim();
  const embeds: SelectSpec['embeds'] = [];
  const parts: string[] = [];
  // Split on top-level commas (respecting parentheses depth).
  let depth = 0, current = '';
  for (const ch of select) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const m = part.match(/^([a-z_]+):([a-z_]+)$/i);
    if (m && m[1] === m[2]) continue; // self-alias, rare
    const embedMatch = part.match(/^([a-z_]+)!?(?:inner|left)?\.?$/i);
    if (embedMatch && embedMatch[1] !== table) {
      const fk = FOREIGN_KEYS.find((f) => f.childTable === table && f.parentTable === embedMatch[1]);
      if (fk) {
        embeds.push({ alias: embedMatch[1], parentTable: fk.parentTable, fks: [{ childColumn: fk.childColumn, parentColumn: fk.parentColumn }] });
        continue;
      }
    }
    parts.push(part);
    // keep plain columns in 'parts'
  }
  // Plain columns = parts minus embedded ones.
  const plainParts = parts.filter((p) => {
    if (p.includes('(')) return false;
    if (embeds.some((e) => e.alias === p)) return false;
    return true;
  });
  void table;
  return { columns: plainParts.length ? plainParts.join(', ') : '*', embeds };
}

class QueryBuilder {
  private fb: FilterBuilder;
  private selectRaw: string | undefined;
  private orderClauses: { col: string; asc: boolean }[] = [];
  private limitVal: number | null = null;
  private offsetVal = 0;
  private aborted = false;

  constructor(private table: string) {
    this.fb = new FilterBuilder(table);
  }

  select(columns?: string) {
    this.selectRaw = columns;
    return this;
  }

  eq(col: string, v: unknown) { this.fb.eq(col, v); return this; }
  neq(col: string, v: unknown) { this.fb.neq(col, v); return this; }
  gt(col: string, v: unknown) { this.fb.gt(col, v); return this; }
  gte(col: string, v: unknown) { this.fb.gte(col, v); return this; }
  lt(col: string, v: unknown) { this.fb.lt(col, v); return this; }
  lte(col: string, v: unknown) { this.fb.lte(col, v); return this; }
  like(col: string, v: string) { this.fb.like(col, v); return this; }
  ilike(col: string, v: string) { this.fb.ilike(col, v); return this; }
  is(col: string, v: unknown) { this.fb.is(col, v); return this; }
  in(col: string, v: unknown[]) { this.fb.in(col, v); return this; }
  or(expr: string) { this.fb.or(expr); return this; }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderClauses.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitVal = n; return this; }
  range(from: number, to: number) { this.offsetVal = from; this.limitVal = to - from + 1; return this; }
  single() { this.limitVal = 1; return this; }
  maybeSingle() { this.limitVal = 1; return this; }
  abortSignal(sig: AbortSignal) { if (sig.aborted) this.aborted = true; return this; }

  private buildSql(): { sql: string; params: unknown[]; spec: SelectSpec } {
    const spec = parseSelect(this.table, this.selectRaw);
    let selectClause = spec.columns === '*' ? '*' : spec.columns.split(',').map((c) => quoteIdent(c.trim())).join(', ');
    const where = this.fb.buildWhere();
    let sql = `SELECT ${selectClause} FROM ${quoteIdent(this.table)}${where.sql}`;
    if (this.orderClauses.length) {
      sql += ' ORDER BY ' + this.orderClauses.map((o) => `${quoteIdent(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ');
    }
    if (this.limitVal !== null) sql += ` LIMIT ${this.limitVal} OFFSET ${this.offsetVal}`;
    return { sql, params: where.params, spec };
  }

  async then<T = Row[]>(resolve?: (value: QueryResult<T>) => unknown, reject?: (e: unknown) => unknown): Promise<unknown> {
    const result = await this.exec<unknown>();
    return resolve ? resolve(result as QueryResult<T>) : result;
  }

  async exec<T = Row>(): Promise<QueryResult<T>> {
    if (this.aborted) {
      return { data: null, error: new PostgrestErrorShim('Query aborted') } as QueryResult<T>;
    }
    const { sql, params, spec } = this.buildSql();
    try {
      let rows: Row[] = (await localQuery(sql, params)).rows as Row[];
      if (spec.embeds.length) {
        rows = await this.attachEmbeds(rows, spec.embeds);
      }
      // supabase-js returns untyped rows (any) here; keep the same looseness so
      // page-level casts behave identically against the local database.
      return { data: rows as unknown as T, error: null };
    } catch (e) {
      return { data: null, error: new PostgrestErrorShim(e instanceof Error ? e.message : String(e)) } as QueryResult<T>;
    }
  }

  private async attachEmbeds<T extends Row>(rows: T[], embeds: SelectSpec['embeds']): Promise<T[]> {
    for (const embed of embeds) {
      const fk = FOREIGN_KEYS.find((f) => f.childTable === this.table && f.parentTable === embed.parentTable);
      if (!fk) continue;
      const parentIds = Array.from(new Set(rows.map((r) => r[fk.childColumn]).filter((v) => v !== null && v !== undefined)));
      const parents: Row[] = [];
      if (parentIds.length) {
        const idList = parentIds.map((id) => quoteLiteral(id)).join(', ');
        const res = await localQuery<Row>(`SELECT * FROM ${quoteIdent(embed.parentTable)} WHERE ${quoteIdent(fk.parentColumn)} IN (${idList})`);
        parents.push(...res.rows);
      }
      const byId = new Map(parents.map((p) => [String(p[fk.parentColumn]), p]));
      for (const r of rows) {
        const key = r[fk.childColumn];
        (r as Row)[embed.alias] = key ? byId.get(String(key)) ?? null : null;
      }
    }
    return rows;
  }
}

export interface QueryResult<T = Row> {
  data: T[] | T | null;
  error: PostgrestErrorShim | null;
  count?: number | null;
  status?: number;
  statusText?: string;
}

class MutationResult {
  private rows: Row[] | null = null;
  private err: PostgrestErrorShim | null = null;

  constructor(private table: string) {}

  async insert(payload: Row | Row[], opts?: { onConflict?: string }) {
    const arr = Array.isArray(payload) ? payload : [payload];
    if (arr.length === 0) { this.rows = []; return this; }
    const cols = Object.keys(arr[0]);
    const colSql = cols.map(quoteIdent).join(', ');
    const values = arr.map((row) => `(${cols.map((c) => quoteLiteral(row[c])).join(', ')})`).join(', ');
    let sql = `INSERT INTO ${quoteIdent(this.table)} (${colSql}) VALUES ${values}`;
    if (opts?.onConflict) {
      sql += ` ON CONFLICT (${opts.onConflict.split(',').map((c) => quoteIdent(c.trim())).join(', ')}) DO UPDATE SET ${cols.map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(', ')}`;
    }
    sql += ' RETURNING *';
    try {
      const res = await localQuery<Row>(sql);
      this.rows = res.rows;
    } catch (e) {
      this.err = new PostgrestErrorShim(e instanceof Error ? e.message : String(e));
    }
    return this;
  }

  async update(payload: Row, where: { sql: string; params: unknown[] }) {
    const sets = Object.keys(payload).map((c) => `${quoteIdent(c)} = ${quoteLiteral(payload[c])}`).join(', ');
    let sql = `UPDATE ${quoteIdent(this.table)} SET ${sets}${where.sql} RETURNING *`;
    try {
      const res = await localQuery<Row>(sql, where.params);
      this.rows = res.rows;
    } catch (e) {
      this.err = new PostgrestErrorShim(e instanceof Error ? e.message : String(e));
    }
    return this;
  }

  async del(where: { sql: string; params: unknown[] }) {
    let sql = `DELETE FROM ${quoteIdent(this.table)}${where.sql} RETURNING *`;
    try {
      const res = await localQuery<Row>(sql, where.params);
      this.rows = res.rows;
    } catch (e) {
      this.err = new PostgrestErrorShim(e instanceof Error ? e.message : String(e));
    }
    return this;
  }

  async then<T = Row[]>(resolve?: (value: QueryResult<T>) => unknown, reject?: (e: unknown) => unknown): Promise<unknown> {
    if (this.err) {
      const result = { data: null, error: this.err } as QueryResult<T>;
      return resolve ? resolve(result) : result;
    }
    const singleRow = this.rows && this.rows.length === 1 ? this.rows[0] : this.rows;
    const result = { data: singleRow as unknown as T, error: null } as QueryResult<T>;
    return resolve ? resolve(result) : result;
  }
}

class FromBuilder {
  constructor(private table: string) {}

  select(columns?: string) {
    return new QueryBuilder(this.table).select(columns);
  }

  insert(payload: Row | Row[], opts?: { onConflict?: string; defaultToObject?: boolean }) {
    return new MutationResult(this.table).insert(payload, opts);
  }

  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    return new MutationResult(this.table).insert(payload, opts);
  }

  update(payload: Row) {
    const builder = new FilterBuilder(this.table);
    const execProxy = new MutationResult(this.table);
    // Return a then-able that applies filters before updating.
    const handler: ProxyHandler<FilterBuilder> = {
      get(target, prop, receiver) {
        if (prop === 'then') {
          return (resolve?: (v: unknown) => unknown) => execProxy.update(payload, target.buildWhere()).then(resolve as never);
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    };
    return new Proxy(builder, handler);
  }

  delete() {
    const builder = new FilterBuilder(this.table);
    const execProxy = new MutationResult(this.table);
    const handler: ProxyHandler<FilterBuilder> = {
      get(target, prop, receiver) {
        if (prop === 'then') {
          return (resolve?: (v: unknown) => unknown) => execProxy.del(target.buildWhere()).then(resolve as never);
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    };
    return new Proxy(builder, handler);
  }

  // RPC: the offline app has two used functions; none needed here.
  rpc() {
    return new QueryBuilder(this.table);
  }
}

export const supabase = {
  from(table: string) {
    return new FromBuilder(table);
  },
};

export default supabase;

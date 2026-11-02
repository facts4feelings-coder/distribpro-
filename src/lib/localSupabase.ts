// Offline supabase-compatible shim.
//
// The app's pages are written against supabase-js's fluent query builder
// (.from().select().eq().order()...). This shim runs the same call chains
// against the local PGlite (Postgres) database so the UI works with zero
// internet.
//
// Design notes:
// - Every builder is lazy and "thenable": nothing runs until it is awaited,
//   exactly like supabase-js. Filters can be chained after insert/update/delete.
// - Values are always sent as bound parameters ($1, $2 ...), never pasted into SQL.
// - Rows are returned through row_to_json(), so numbers, dates and timestamps
//   have the same JSON shape Supabase returns (numeric -> number,
//   date -> 'YYYY-MM-DD', timestamptz -> ISO string).
// - Embedded relations (customers(name), customer_invoices!inner(customer_id),
//   alias:table(cols)) are resolved from the database's real foreign keys.

import { localQuery } from './offlineDb';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Schema metadata (foreign keys + primary keys), loaded once from Postgres.

interface ForeignKey {
  child: string;
  childCol: string;
  parent: string;
  parentCol: string;
}

interface SchemaMeta {
  fks: ForeignKey[];
  pks: Map<string, string[]>;
}

let metaPromise: Promise<SchemaMeta> | null = null;

function loadMeta(): Promise<SchemaMeta> {
  if (!metaPromise) {
    metaPromise = (async () => {
      const fk = await localQuery<{ child: string; child_col: string; parent: string; parent_col: string }>(`
        SELECT cl.relname AS child, a.attname AS child_col, pcl.relname AS parent, pa.attname AS parent_col
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_class pcl ON pcl.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
        WHERE c.contype = 'f'`);
      const pk = await localQuery<{ tbl: string; col: string }>(`
        SELECT cl.relname AS tbl, a.attname AS col
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
        JOIN LATERAL unnest(c.conkey) AS k(attnum) ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        WHERE c.contype = 'p'`);
      const pks = new Map<string, string[]>();
      for (const r of pk.rows) pks.set(r.tbl, [...(pks.get(r.tbl) ?? []), r.col]);
      return {
        fks: fk.rows.map((r) => ({ child: r.child, childCol: r.child_col, parent: r.parent, parentCol: r.parent_col })),
        pks,
      };
    })().catch((e) => {
      metaPromise = null;
      throw e;
    });
  }
  return metaPromise;
}

// ---------------------------------------------------------------------------
// Helpers

function qi(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

class PostgrestErrorShim {
  message: string;
  details: string | null;
  hint: string | null;
  code: string;
  constructor(message: string, code = 'PGLITE_ERR') {
    this.message = message;
    this.details = null;
    this.hint = null;
    this.code = code;
  }
}

export interface QueryResult<T = Row> {
  data: T[] | T | null;
  error: PostgrestErrorShim | null;
  count?: number | null;
  status?: number;
  statusText?: string;
}

class Params {
  values: unknown[] = [];
  add(v: unknown): string {
    if (v instanceof Date) v = v.toISOString();
    else if (v !== null && typeof v === 'object' && !Array.isArray(v)) v = JSON.stringify(v);
    this.values.push(v === undefined ? null : v);
    return `$${this.values.length}`;
  }
}

// Split on commas that are not inside parentheses.
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---------------------------------------------------------------------------
// Filters

type Cond = { col: string; build: (colSql: string, p: Params) => string };

function opCond(col: string, op: string, value: unknown): Cond {
  return {
    col,
    build: (c, p) => {
      switch (op) {
        case 'eq':
          return `${c} = ${p.add(value)}`;
        case 'neq':
          return `${c} <> ${p.add(value)}`;
        case 'gt':
          return `${c} > ${p.add(value)}`;
        case 'gte':
          return `${c} >= ${p.add(value)}`;
        case 'lt':
          return `${c} < ${p.add(value)}`;
        case 'lte':
          return `${c} <= ${p.add(value)}`;
        case 'like':
          return `${c}::text LIKE ${p.add(String(value).replace(/\*/g, '%'))}`;
        case 'ilike':
          return `${c}::text ILIKE ${p.add(String(value).replace(/\*/g, '%'))}`;
        case 'is': {
          if (value === null || value === 'null') return `${c} IS NULL`;
          if (value === true || value === 'true') return `${c} IS TRUE`;
          if (value === false || value === 'false') return `${c} IS FALSE`;
          return `${c} IS NULL`;
        }
        case 'in': {
          const arr = Array.isArray(value) ? value : [];
          if (!arr.length) return 'FALSE';
          return `${c} IN (${arr.map((v) => p.add(v)).join(', ')})`;
        }
        default:
          throw new Error(`Unsupported filter operator: ${op}`);
      }
    },
  };
}

// PostgREST "or" syntax: "name.ilike.%ali%,phone.eq.123"
function parseOrExpr(expr: string): Cond[] {
  return splitTop(expr).map((part) => {
    const m = part.match(/^([\w.]+?)\.(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/);
    if (!m) throw new Error(`Unsupported or() expression: ${part}`);
    const [, col, not, op, raw] = m;
    let value: unknown = raw;
    if (op === 'in') value = raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    const base = opCond(col, op, value);
    return not ? { col, build: (c: string, p: Params) => `NOT (${base.build(c, p)})` } : base;
  });
}

// ---------------------------------------------------------------------------
// Select parsing / SQL generation (recursive for nested embeds)

interface EmbedSpec {
  alias: string;
  table: string;
  hint?: string;
  inner: boolean;
  select: string;
}

interface ParsedSelect {
  columns: { expr: string; alias?: string }[]; // expr '*' or column name
  embeds: EmbedSpec[];
}

function parseSelect(raw: string | undefined): ParsedSelect {
  const columns: ParsedSelect['columns'] = [];
  const embeds: EmbedSpec[] = [];
  for (const part of splitTop((raw ?? '*').trim() || '*')) {
    const embed = part.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?(?:!(inner|left))?\s*\(([\s\S]*)\)$/);
    if (embed) {
      const [, alias, table, hint, inner, sel] = embed;
      const isInner = hint === 'inner' || inner === 'inner';
      embeds.push({
        alias: alias || table,
        table,
        hint: hint && hint !== 'inner' && hint !== 'left' ? hint : undefined,
        inner: isInner,
        select: sel,
      });
      continue;
    }
    if (part === '*') {
      columns.push({ expr: '*' });
      continue;
    }
    const col = part.match(/^(?:(\w+):)?(\w+)(?:::\w+)?$/);
    if (col) columns.push({ expr: col[2], alias: col[1] });
    else throw new Error(`Unsupported select column: ${part}`);
  }
  if (!columns.length && !embeds.length) columns.push({ expr: '*' });
  return { columns, embeds };
}

interface Relation {
  many: boolean; // true = child rows (array), false = parent row (object)
  joinSql: (outer: string, inner: string) => string;
}

function resolveRelation(meta: SchemaMeta, from: string, embed: EmbedSpec): Relation {
  const toParent = meta.fks.filter((f) => f.child === from && f.parent === embed.table && (!embed.hint || f.childCol === embed.hint));
  if (toParent.length >= 1) {
    const f = toParent[0];
    return { many: false, joinSql: (o, i) => `${i}.${qi(f.parentCol)} = ${o}.${qi(f.childCol)}` };
  }
  const toChild = meta.fks.filter((f) => f.child === embed.table && f.parent === from && (!embed.hint || f.childCol === embed.hint));
  if (toChild.length >= 1) {
    const f = toChild[0];
    return { many: true, joinSql: (o, i) => `${i}.${qi(f.childCol)} = ${o}.${qi(f.parentCol)}` };
  }
  throw new Error(`No relationship found between '${from}' and '${embed.table}'`);
}

let aliasSeq = 0;

// Returns the select-list SQL for `table` aliased as `t`, plus EXISTS conditions
// required by !inner embeds.
function buildSelectList(
  meta: SchemaMeta,
  table: string,
  t: string,
  parsed: ParsedSelect,
  embedConds: Map<string, Cond[]>,
  p: Params,
): { list: string; innerConds: string[] } {
  const parts: string[] = [];
  const innerConds: string[] = [];
  for (const c of parsed.columns) {
    if (c.expr === '*') parts.push(`${t}.*`);
    else parts.push(`${t}.${qi(c.expr)}${c.alias ? ` AS ${qi(c.alias)}` : ''}`);
  }
  for (const e of parsed.embeds) {
    const rel = resolveRelation(meta, table, e);
    const ia = `_e${++aliasSeq}`;
    const sub = parseSelect(e.select);
    const conds = embedConds.get(e.alias) ?? [];
    const nested = buildSelectList(meta, e.table, ia, sub, new Map(), p);
    const where = [rel.joinSql(t, ia), ...conds.map((c) => c.build(`${ia}.${qi(c.col)}`, p)), ...nested.innerConds];
    const whereSql = where.join(' AND ');
    const inner = `SELECT ${nested.list} FROM ${qi(e.table)} ${ia} WHERE ${whereSql}`;
    if (rel.many) {
      parts.push(`(SELECT COALESCE(json_agg(_x), '[]'::json) FROM (${inner}) _x) AS ${qi(e.alias)}`);
    } else {
      parts.push(`(SELECT row_to_json(_x) FROM (${inner} LIMIT 1) _x) AS ${qi(e.alias)}`);
    }
    if (e.inner || conds.length) {
      // Like PostgREST: filtering on an embedded table (or !inner) drops
      // parent rows that have no matching embedded row.
      const ea = `_e${++aliasSeq}`;
      const existsWhere = [rel.joinSql(t, ea), ...conds.map((c) => c.build(`${ea}.${qi(c.col)}`, p))].join(' AND ');
      if (e.inner) innerConds.push(`EXISTS (SELECT 1 FROM ${qi(e.table)} ${ea} WHERE ${existsWhere})`);
    }
  }
  return { list: parts.join(', ') || `${t}.*`, innerConds };
}

// ---------------------------------------------------------------------------
// The builder

type Action = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

interface CountOpts {
  count?: 'exact' | 'planned' | 'estimated' | null;
  head?: boolean;
}

class QueryBuilder<T = Row> implements PromiseLike<QueryResult<T>> {
  private action: Action = 'select';
  private selectRaw: string | undefined;
  private returning = false;
  private countMode: string | null = null;
  private head = false;
  private conds: Cond[] = [];
  private orGroups: Cond[][] = [];
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private limitVal: number | null = null;
  private offsetVal = 0;
  private singleMode: 'single' | 'maybe' | null = null;
  private payload: Row[] = [];
  private updateValues: Row = {};
  private onConflict?: string;
  private ignoreDuplicates = false;
  private aborted = false;

  constructor(private table: string) {}

  // ---- actions
  select(columns?: string, opts?: CountOpts) {
    if (this.action === 'select') {
      this.selectRaw = columns;
      if (opts?.count) this.countMode = opts.count;
      if (opts?.head) this.head = true;
    } else {
      this.returning = true;
      this.selectRaw = columns;
    }
    return this;
  }
  insert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean; count?: string }) {
    this.action = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = opts?.onConflict;
    this.ignoreDuplicates = !!opts?.ignoreDuplicates;
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.action = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = opts?.onConflict;
    this.ignoreDuplicates = !!opts?.ignoreDuplicates;
    return this;
  }
  update(values: Row) {
    this.action = 'update';
    this.updateValues = values;
    return this;
  }
  delete() {
    this.action = 'delete';
    return this;
  }

  // ---- filters
  eq(col: string, v: unknown) { this.conds.push(opCond(col, 'eq', v)); return this; }
  neq(col: string, v: unknown) { this.conds.push(opCond(col, 'neq', v)); return this; }
  gt(col: string, v: unknown) { this.conds.push(opCond(col, 'gt', v)); return this; }
  gte(col: string, v: unknown) { this.conds.push(opCond(col, 'gte', v)); return this; }
  lt(col: string, v: unknown) { this.conds.push(opCond(col, 'lt', v)); return this; }
  lte(col: string, v: unknown) { this.conds.push(opCond(col, 'lte', v)); return this; }
  like(col: string, v: string) { this.conds.push(opCond(col, 'like', v)); return this; }
  ilike(col: string, v: string) { this.conds.push(opCond(col, 'ilike', v)); return this; }
  is(col: string, v: unknown) { this.conds.push(opCond(col, 'is', v)); return this; }
  in(col: string, v: unknown[]) { this.conds.push(opCond(col, 'in', v)); return this; }
  match(obj: Row) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  filter(col: string, op: string, v: unknown) { this.conds.push(opCond(col, op, v)); return this; }
  not(col: string, op: string, v: unknown) {
    const base = opCond(col, op, v);
    this.conds.push({ col, build: (c, p) => `NOT (${base.build(c, p)})` });
    return this;
  }
  or(expr: string) { this.orGroups.push(parseOrExpr(expr)); return this; }

  // ---- modifiers
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number) { this.limitVal = n; return this; }
  range(from: number, to: number) { this.offsetVal = from; this.limitVal = to - from + 1; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  abortSignal(sig: AbortSignal) { if (sig?.aborted) this.aborted = true; return this; }
  throwOnError() { return this; }
  returns<U>() { return this as unknown as QueryBuilder<U>; }

  // ---- execution
  then<R1 = QueryResult<T>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private whereSql(t: string, p: Params, embedConds: Map<string, Cond[]>): string[] {
    const out: string[] = [];
    for (const c of this.conds) {
      const dot = c.col.indexOf('.');
      if (dot > 0) {
        const alias = c.col.slice(0, dot);
        const col = c.col.slice(dot + 1);
        embedConds.set(alias, [...(embedConds.get(alias) ?? []), { col, build: c.build }]);
        continue;
      }
      out.push(c.build(`${t}.${qi(c.col)}`, p));
    }
    for (const g of this.orGroups) {
      out.push(`(${g.map((c) => c.build(`${t}.${qi(c.col)}`, p)).join(' OR ')})`);
    }
    return out;
  }

  private async execute(): Promise<QueryResult<T>> {
    if (this.aborted) return { data: null, error: new PostgrestErrorShim('Query aborted'), count: null };
    try {
      const meta = await loadMeta();
      if (this.action === 'select') return await this.runSelect(meta);
      return await this.runMutation(meta);
    } catch (e) {
      return { data: null, error: new PostgrestErrorShim(e instanceof Error ? e.message : String(e)), count: null };
    }
  }

  private finish(rows: Row[], count: number | null, alwaysArray: boolean): QueryResult<T> {
    if (this.singleMode) {
      if (rows.length === 1) return { data: rows[0] as T, error: null, count };
      if (rows.length === 0 && this.singleMode === 'maybe') return { data: null, error: null, count };
      return {
        data: null,
        error: new PostgrestErrorShim(
          rows.length === 0 ? 'JSON object requested, multiple (or no) rows returned' : 'Results contain more than one row',
          'PGRST116',
        ),
        count,
      };
    }
    return { data: (alwaysArray ? rows : rows) as unknown as T[], error: null, count };
  }

  private async runSelect(meta: SchemaMeta): Promise<QueryResult<T>> {
    const p = new Params();
    const t = '_t';
    const embedConds = new Map<string, Cond[]>();
    const where = this.whereSql(t, p, embedConds);
    const parsed = parseSelect(this.selectRaw);
    // Filters on embedded columns imply the embed must exist.
    for (const e of parsed.embeds) if (embedConds.has(e.alias)) e.inner = true;
    const sel = buildSelectList(meta, this.table, t, parsed, embedConds, p);
    const allWhere = [...where, ...sel.innerConds];
    const whereClause = allWhere.length ? ` WHERE ${allWhere.join(' AND ')}` : '';

    let count: number | null = null;
    if (this.countMode) {
      const cp = new Params();
      const ce = new Map<string, Cond[]>();
      const cw = this.whereSql(t, cp, ce);
      const cparsed = parseSelect(this.selectRaw);
      for (const e of cparsed.embeds) if (ce.has(e.alias)) e.inner = true;
      const csel = buildSelectList(meta, this.table, t, cparsed, ce, cp);
      const cAll = [...cw, ...csel.innerConds];
      const res = await localQuery<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${qi(this.table)} ${t}${cAll.length ? ` WHERE ${cAll.join(' AND ')}` : ''}`,
        cp.values,
      );
      count = Number(res.rows[0]?.n ?? 0);
    }
    if (this.head) return { data: null, error: null, count };

    let sql = `SELECT ${sel.list} FROM ${qi(this.table)} ${t}${whereClause}`;
    if (this.orders.length) {
      sql += ' ORDER BY ' + this.orders
        .map((o) => `${t}.${qi(o.col)} ${o.asc ? 'ASC' : 'DESC'}${o.nullsFirst === undefined ? '' : o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST'}`)
        .join(', ');
    }
    const limit = this.singleMode ? Math.min(this.limitVal ?? 2, 2) : this.limitVal;
    if (limit !== null) sql += ` LIMIT ${Number(limit)}`;
    if (this.offsetVal) sql += ` OFFSET ${Number(this.offsetVal)}`;

    const res = await localQuery<{ r: Row }>(`SELECT row_to_json(_q) AS r FROM (${sql}) _q`, p.values);
    return this.finish(res.rows.map((x) => x.r), count, true);
  }

  private async runMutation(meta: SchemaMeta): Promise<QueryResult<T>> {
    const p = new Params();
    let sql: string;
    const t = this.table;

    if (this.action === 'insert' || this.action === 'upsert') {
      if (!this.payload.length) return { data: this.returning ? ([] as unknown as T[]) : null, error: null, count: null };
      const cols = Array.from(new Set(this.payload.flatMap((r) => Object.keys(r))));
      const values = this.payload
        .map((r) => `(${cols.map((c) => (c in r && r[c] !== undefined ? p.add(r[c]) : 'DEFAULT')).join(', ')})`)
        .join(', ');
      sql = `INSERT INTO ${qi(t)} (${cols.map(qi).join(', ')}) VALUES ${values}`;
      const conflictCols =
        this.onConflict?.split(',').map((c) => c.trim()).filter(Boolean) ??
        (this.action === 'upsert' ? meta.pks.get(t) ?? ['id'] : undefined);
      if (conflictCols && conflictCols.length) {
        const updatable = cols.filter((c) => !conflictCols.includes(c));
        if (this.ignoreDuplicates || !updatable.length) {
          sql += ` ON CONFLICT (${conflictCols.map(qi).join(', ')}) DO NOTHING`;
        } else {
          sql += ` ON CONFLICT (${conflictCols.map(qi).join(', ')}) DO UPDATE SET ${updatable
            .map((c) => `${qi(c)} = EXCLUDED.${qi(c)}`)
            .join(', ')}`;
        }
      }
    } else {
      // update / delete: filters apply to the target table directly
      const where: string[] = [];
      for (const c of this.conds) where.push(c.build(qi(c.col), p));
      for (const g of this.orGroups) where.push(`(${g.map((c) => c.build(qi(c.col), p)).join(' OR ')})`);
      const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
      if (this.action === 'update') {
        const entries = Object.entries(this.updateValues).filter(([, v]) => v !== undefined);
        if (!entries.length) return { data: this.returning ? ([] as unknown as T[]) : null, error: null, count: null };
        sql = `UPDATE ${qi(t)} SET ${entries.map(([k, v]) => `${qi(k)} = ${p.add(v)}`).join(', ')}${whereClause}`;
      } else {
        sql = `DELETE FROM ${qi(t)}${whereClause}`;
      }
    }

    if (!this.returning) {
      await localQuery(sql, p.values);
      return { data: null, error: null, count: null };
    }

    // Return the affected rows (with embeds if requested) in Supabase JSON shape.
    const parsed = parseSelect(this.selectRaw);
    const sel = buildSelectList(meta, t, '_t', parsed, new Map(), p);
    const full = `WITH _m AS (${sql} RETURNING *) SELECT row_to_json(_q) AS r FROM (SELECT ${sel.list} FROM _m _t${
      sel.innerConds.length ? ` WHERE ${sel.innerConds.join(' AND ')}` : ''
    }) _q`;
    // Embeds inside RETURNING must resolve relations from the real table name.
    const res = await localQuery<{ r: Row }>(full, p.values);
    return this.finish(res.rows.map((x) => x.r), null, true);
  }
}

class FromBuilder {
  constructor(private table: string) {}
  select(columns?: string, opts?: CountOpts) {
    return new QueryBuilder(this.table).select(columns, opts);
  }
  insert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    return new QueryBuilder(this.table).insert(values, opts);
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    return new QueryBuilder(this.table).upsert(values, opts);
  }
  update(values: Row) {
    return new QueryBuilder(this.table).update(values);
  }
  delete() {
    return new QueryBuilder(this.table).delete();
  }
}

export const supabase = {
  from(table: string) {
    return new FromBuilder(table);
  },
  // The offline app does not use RPC; return an empty successful result.
  rpc() {
    return Promise.resolve({ data: null, error: null });
  },
};

export default supabase;

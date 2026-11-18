// Cloudflare D1 인터페이스(prepare/bind/run/first/all)를 node:sqlite 위에 흉내 낸다 — 실제 마이그레이션 SQL·트리거를 그대로 검증
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA } from '../src/schema.js';

class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.a = []; } // D1 처럼 실행 시점에 컴파일
  get s() { return this.db.prepare(this.sql); }
  bind(...a) { this.a = a; return this; }
  async run() { const r = this.s.run(...this.a); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
  async first() { return this.s.get(...this.a) ?? null; }
  async all() { return { results: this.s.all(...this.a) }; }
}

export function makeDb({ init = true } = {}) {
  const db = new DatabaseSync(':memory:');
  if (init) for (const sql of SCHEMA) db.exec(sql);
  return { raw: db, prepare: (sql) => new Stmt(db, sql), async batch(stmts) { return Promise.all(stmts.map((x) => x.run())); } };
}

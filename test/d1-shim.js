// Cloudflare D1 인터페이스(prepare/bind/run/first/all)를 node:sqlite 위에 흉내 낸다 — 실제 마이그레이션 SQL·트리거를 그대로 검증
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

class Stmt {
  constructor(db, sql) { this.s = db.prepare(sql); this.a = []; }
  bind(...a) { this.a = a; return this; }
  async run() { const r = this.s.run(...this.a); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
  async first() { return this.s.get(...this.a) ?? null; }
  async all() { return { results: this.s.all(...this.a) }; }
}

export function makeDb() {
  const db = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync(new URL('../migrations/', import.meta.url)).sort()) {
    db.exec(fs.readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  return { raw: db, prepare: (sql) => new Stmt(db, sql) };
}

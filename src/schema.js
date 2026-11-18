// 표 정의 — 멱등(IF NOT EXISTS). 첫 요청 때 한 번 적용하므로 따로 마이그레이션을 돌릴 필요가 없다.
// 본문·작성자 칸 불변, 행 삭제 금지(삭제 = status 'hidden'). 사번·이메일·전화 칸 없음.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS intake_questions (
    id INTEGER PRIMARY KEY, affiliation TEXT NOT NULL, name TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
    dedupe_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','hidden')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS intake_dedupe ON intake_questions(dedupe_key)',
  'CREATE INDEX IF NOT EXISTS intake_order ON intake_questions(created_at, id)',
  `CREATE TRIGGER IF NOT EXISTS intake_no_delete BEFORE DELETE ON intake_questions
    BEGIN SELECT RAISE(ABORT, 'intake_questions rows are never deleted'); END`,
  `CREATE TRIGGER IF NOT EXISTS intake_content_fixed BEFORE UPDATE OF affiliation, name, title, body, dedupe_key, created_at ON intake_questions
    BEGIN SELECT RAISE(ABORT, 'intake_questions content is immutable; change status only'); END`,
  'CREATE TABLE IF NOT EXISTS rate_hits (bucket TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS rate_hits_bucket ON rate_hits(bucket, at)',
];

const applied = new WeakMap();
/** 첫 요청에서 표를 만든다 (같은 인스턴스·같은 DB 에서는 한 번만) */
export function ensureSchema(db) {
  if (!applied.has(db)) applied.set(db, db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { applied.delete(db); throw e; }));
  return applied.get(db);
}

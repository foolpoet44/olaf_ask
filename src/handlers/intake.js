// POST /api/intake — 누구나 제출 (로그인 없음)
import { PROFESSORS, RULES, normalize, check, dedupeKey, refOf, sha256Hex } from '../rules.js';
import { ok, fail } from '../http.js';

export async function onRequestPost({ request, env }) {
  const text = await request.text();
  if (text.length > 8192) return fail(413, 'too_large', '요청이 너무 큽니다');
  let body;
  try { body = JSON.parse(text); } catch { return fail(400, 'bad_request', '요청 형식이 올바르지 않습니다'); }

  // 접속자별 횟수 제한 (IP 는 해시로만 저장)
  const now = Math.floor(Date.now() / 1000);
  const bucket = (await sha256Hex(request.headers.get('cf-connecting-ip') || 'unknown')).slice(0, 16);
  const since = now - RULES.rate.windowSec;
  await env.DB.prepare('DELETE FROM rate_hits WHERE at < ?').bind(since).run();
  const c = await env.DB.prepare('SELECT COUNT(*) n, MIN(at) first FROM rate_hits WHERE bucket = ? AND at >= ?').bind(bucket, since).first();
  if (c.n >= RULES.rate.max) {
    return fail(429, 'rate_limited', '잠시 후 다시 시도해 주세요', undefined, { 'retry-after': String(Math.max(1, RULES.rate.windowSec - (now - c.first))) });
  }

  const q = normalize(body);
  const problems = check(q);
  if (problems.length) return fail(400, 'validation', '입력을 확인해 주세요', problems);
  await env.DB.prepare('INSERT INTO rate_hits (bucket, at) VALUES (?, ?)').bind(bucket, now).run();

  const key = await dedupeKey(q);
  const at = new Date().toISOString();
  const r = await env.DB.prepare(
    'INSERT INTO intake_questions (session, professor, affiliation, name, title, body, dedupe_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(dedupe_key) DO NOTHING',
  ).bind(PROFESSORS[q.professor].session, q.professor, q.affiliation, q.name, q.title, q.body, key, at, at).run();
  if (r.meta.changes === 0) { // 같은 성명·본문 재전송 → 기존 접수번호
    const dup = await env.DB.prepare('SELECT id FROM intake_questions WHERE dedupe_key = ?').bind(key).first();
    return ok({ id: dup.id, ref: refOf(dup.id) }, 200);
  }
  return ok({ id: r.meta.last_row_id, ref: refOf(r.meta.last_row_id) }, 201);
}

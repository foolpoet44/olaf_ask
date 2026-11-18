// GET /api/admin/intake — 제출 현황 + 카드 목록 (X-Admin-Key 필요)
import { refOf } from '../rules.js';
import { ok, requireAdmin } from '../http.js';

export async function onRequestGet({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const u = new URL(request.url);
  const where = [];
  const args = [];
  if (u.searchParams.get('hidden') !== '1') where.push("status = 'open'");
  if (u.searchParams.get('affiliation')) { where.push('affiliation = ?'); args.push(u.searchParams.get('affiliation')); }
  if (u.searchParams.get('name')) { where.push('name = ?'); args.push(u.searchParams.get('name')); }

  const [items, subs, aff] = await Promise.all([
    env.DB.prepare(`SELECT * FROM intake_questions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, id`).bind(...args).all(),
    env.DB.prepare("SELECT affiliation, name, title, COUNT(*) n FROM intake_questions WHERE status = 'open' GROUP BY affiliation, name, title ORDER BY name, affiliation").all(),
    env.DB.prepare("SELECT affiliation, COUNT(*) n FROM intake_questions WHERE status = 'open' GROUP BY affiliation ORDER BY affiliation").all(),
  ]);
  return ok({
    summary: {
      total: subs.results.reduce((a, r) => a + r.n, 0),
      submitters: subs.results.map((r) => ({ name: r.name, title: r.title, affiliation: r.affiliation, count: r.n })), // 이름순
      byAffiliation: aff.results.map((r) => ({ affiliation: r.affiliation, count: r.n })),
    },
    items: items.results.map((r) => ({ id: r.id, ref: refOf(r.id), affiliation: r.affiliation, name: r.name, title: r.title, body: r.body, status: r.status, createdAt: r.created_at })),
  });
}

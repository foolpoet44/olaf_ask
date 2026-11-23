// GET /api/admin/intake — 제출 현황 + 대상자별 질문 여부 + 카드 목록 (X-Admin-Key 필요)
// ?session=am|pm 으로 해당 세션만 · ?affiliation= · ?name= · ?hidden=1
import { refOf, SESSIONS, nameKey } from '../rules.js';
import { ROSTER } from '../roster.js';
import { ok, fail, requireAdmin } from '../http.js';

export async function onRequestGet({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const u = new URL(request.url);
  const session = u.searchParams.get('session') || '';
  if (session && !Object.hasOwn(SESSIONS, session)) return fail(400, 'validation', '세션 값 오류');
  const where = [];
  const args = [];
  if (u.searchParams.get('hidden') !== '1') where.push("status = 'open'");
  if (session) { where.push('session = ?'); args.push(session); }
  if (u.searchParams.get('affiliation')) { where.push('affiliation = ?'); args.push(u.searchParams.get('affiliation')); }
  if (u.searchParams.get('name')) { where.push('name = ?'); args.push(u.searchParams.get('name')); }

  const [items, subs] = await Promise.all([
    env.DB.prepare(`SELECT * FROM intake_questions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, id`).bind(...args).all(),
    env.DB.prepare("SELECT session, affiliation, name, title, COUNT(*) n FROM intake_questions WHERE status = 'open' GROUP BY session, affiliation, name, title ORDER BY name, affiliation").all(),
  ]);

  // 대상자 명단과 성명(공백 제거)으로 맞춰 세션별 질문 여부를 만든다
  const counts = new Map(); // nameKey → { am, pm }
  const bySession = { am: 0, pm: 0 };
  for (const r of subs.results) {
    const c = counts.get(nameKey(r.name)) || { am: 0, pm: 0 };
    c[r.session] += r.n;
    bySession[r.session] += r.n;
    counts.set(nameKey(r.name), c);
  }
  const listed = new Set(ROSTER.map((p) => nameKey(p.name)));
  const roster = ROSTER.map(({ empId, ...p }) => ({ ...p, am: counts.get(nameKey(p.name))?.am || 0, pm: counts.get(nameKey(p.name))?.pm || 0 }));
  const unlisted = [...new Map(subs.results.filter((r) => !listed.has(nameKey(r.name))).map((r) => [nameKey(r.name), { name: r.name, affiliation: r.affiliation, title: r.title }])).values()];

  return ok({
    summary: {
      total: bySession.am + bySession.pm,
      bySession,
      rosterTotal: roster.length,
      asked: { am: roster.filter((p) => p.am).length, pm: roster.filter((p) => p.pm).length, any: roster.filter((p) => p.am || p.pm).length },
      roster, // 대상자 전원: 성명·소속·직급·오전/오후 질문 건수 (0 = 미제출)
      unlisted, // 명단에 없는 이름으로 낸 제출자
    },
    items: items.results.map((r) => ({ id: r.id, ref: refOf(r.id), session: r.session, affiliation: r.affiliation, name: r.name, title: r.title, body: r.body, status: r.status, createdAt: r.created_at })),
  });
}

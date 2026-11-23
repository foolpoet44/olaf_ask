// GET /api/admin/intake — 제출 현황 + 대상자별 질문 여부 + 카드 목록 (X-Admin-Key 필요)
// ?professor=cho|nam|song|jung · ?affiliation= · ?name= · ?hidden=1
import { refOf, PROFESSORS, nameKey } from '../rules.js';
import { ROSTER } from '../roster.js';
import { ok, fail, requireAdmin } from '../http.js';

export async function onRequestGet({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const u = new URL(request.url);
  const professor = u.searchParams.get('professor') || '';
  if (professor && !Object.hasOwn(PROFESSORS, professor)) return fail(400, 'validation', '교수 값 오류');
  const where = [];
  const args = [];
  if (u.searchParams.get('hidden') !== '1') where.push("status = 'open'");
  if (professor) { where.push('professor = ?'); args.push(professor); }
  if (u.searchParams.get('affiliation')) { where.push('affiliation = ?'); args.push(u.searchParams.get('affiliation')); }
  if (u.searchParams.get('name')) { where.push('name = ?'); args.push(u.searchParams.get('name')); }

  const [items, subs] = await Promise.all([
    env.DB.prepare(`SELECT * FROM intake_questions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, id`).bind(...args).all(),
    env.DB.prepare("SELECT professor, affiliation, name, title, COUNT(*) n FROM intake_questions WHERE status = 'open' GROUP BY professor, affiliation, name, title").all(),
  ]);

  // 대상자 명단과 성명(공백 제거)으로 맞춰 교수별 질문 여부를 만든다. 교수 미지정(이전 접수)은 other.
  const keys = [...Object.keys(PROFESSORS), 'other'];
  const blank = () => Object.fromEntries(keys.map((k) => [k, 0]));
  const counts = new Map();
  const byProfessor = blank();
  for (const r of subs.results) {
    const k = Object.hasOwn(PROFESSORS, r.professor) ? r.professor : 'other';
    const c = counts.get(nameKey(r.name)) || blank();
    c[k] += r.n;
    byProfessor[k] += r.n;
    counts.set(nameKey(r.name), c);
  }
  const listed = new Set(ROSTER.map((p) => nameKey(p.name)));
  const roster = ROSTER.map(({ empId, ...p }) => ({ ...p, counts: counts.get(nameKey(p.name)) || blank() }));
  const unlisted = [...new Map(subs.results.filter((r) => !listed.has(nameKey(r.name))).map((r) => [nameKey(r.name), { name: r.name, affiliation: r.affiliation, title: r.title }])).values()];
  const total = (c) => keys.reduce((a, k) => a + c[k], 0);

  return ok({
    summary: {
      total: total(byProfessor),
      byProfessor,
      rosterTotal: roster.length,
      askedAny: roster.filter((p) => total(p.counts) > 0).length,
      roster, // 대상자 전원: 성명·소속·직급·교수별 질문 건수 (0 = 미제출)
      unlisted, // 명단에 없는 이름으로 낸 제출자
    },
    items: items.results.map((r) => ({ id: r.id, ref: refOf(r.id), professor: r.professor, session: r.session, affiliation: r.affiliation, name: r.name, title: r.title, body: r.body, status: r.status, createdAt: r.created_at })),
  });
}

// PATCH /api/admin/intake/:id {"status":"open"|"hidden"} — 숨김/해제만 (본문 수정·삭제 없음)
import { ok, fail, requireAdmin } from '../http.js';

export async function onRequestPatch({ request, env, params }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return fail(404, 'not_found', '없는 주소입니다');
  let b;
  try { b = await request.json(); } catch { return fail(400, 'bad_request', '요청 형식이 올바르지 않습니다'); }
  if (!['open', 'hidden'].includes(b?.status)) return fail(400, 'validation', '입력을 확인해 주세요', ['상태 값 오류']);
  const r = await env.DB.prepare('UPDATE intake_questions SET status = ?, updated_at = ? WHERE id = ?').bind(b.status, new Date().toISOString(), id).run();
  return r.meta.changes ? ok({}) : fail(404, 'not_found', '없는 주소입니다');
}

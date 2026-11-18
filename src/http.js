export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const ok = (data = {}, status = 200) => json({ ok: true, data }, status);
export const fail = (status, code, message, problems, headers) => json({ ok: false, error: { code, message, ...(problems ? { problems } : {}) } }, status, headers);

// 상수 시간 문자열 비교
function same(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

/** 사무국 키 검사 — ADMIN_KEY 가 설정되지 않았으면 닫아 둔다. 통과하면 null, 아니면 Response */
export function requireAdmin(request, env) {
  if (!env.ADMIN_KEY) return fail(503, 'admin_disabled', '사무국 키(ADMIN_KEY)가 설정되지 않았습니다');
  const given = request.headers.get('x-admin-key') || '';
  return same(given, env.ADMIN_KEY) ? null : fail(401, 'login_required', '사무국 키가 필요합니다');
}

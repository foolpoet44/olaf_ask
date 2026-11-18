// Cloudflare Worker — 정적 화면(public/)은 assets 가 먼저 응답하고, 맞는 파일이 없는 요청만 여기로 온다.
import { onRequestPost as submit } from './handlers/intake.js';
import { onRequestGet as list } from './handlers/admin-list.js';
import { onRequestPatch as patch } from './handlers/admin-patch.js';
import { ensureSchema } from './schema.js';
import { fail } from './http.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const m = pathname.match(/^\/api\/admin\/intake\/(\d+)$/);
    const route = pathname === '/api/intake' && request.method === 'POST' ? submit
      : pathname === '/api/admin/intake' && request.method === 'GET' ? list
      : m && request.method === 'PATCH' ? patch : null;
    if (!route) return pathname.startsWith('/api/') ? fail(404, 'not_found', '없는 주소입니다') : env.ASSETS.fetch(request);
    if (!env.DB) return fail(503, 'no_database', 'D1 데이터베이스(DB) 연결이 없습니다');
    try {
      await ensureSchema(env.DB);
      return await route({ request, env, params: { id: m?.[1] } });
    } catch (e) {
      console.error('unhandled', e?.message);
      return fail(500, 'internal', '일시적인 오류입니다');
    }
  },
};

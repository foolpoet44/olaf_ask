// Worker 진입점 — 표가 없는 새 DB 에서 첫 요청이 표를 만들고, 라우팅·정적 파일 위임이 맞는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './d1-shim.js';
import worker from '../src/worker.js';

const OK = { professor: 'cho', affiliation: 'DT-1', name: '홍길동', title: '책임', body: '가상 설비의 시뮬레이션 정합도는 어떤 기준으로 확인하나요?' };

test('새 DB: 첫 제출이 표를 만들고 201 · 사무국 목록 · 숨김 · 트리거 동작', async () => {
  const DB = makeDb({ init: false });
  const env = { DB, ADMIN_KEY: 'k', ASSETS: { fetch: async (r) => new Response(`asset:${new URL(r.url).pathname}`) } };
  const call = (method, path, body, key) => worker.fetch(new Request(`http://x${path}`, { method, body: body && JSON.stringify(body), headers: key ? { 'x-admin-key': key } : {} }), env);
  assert.equal((await call('POST', '/api/intake', OK)).status, 201);
  assert.equal((await call('POST', '/api/intake', OK)).status, 200);
  assert.equal((await call('GET', '/api/admin/intake')).status, 401);
  const d = (await (await call('GET', '/api/admin/intake', null, 'k')).json()).data;
  assert.equal(d.summary.total, 1);
  assert.equal((await call('PATCH', '/api/admin/intake/1', { status: 'hidden' }, 'k')).status, 200);
  assert.throws(() => DB.raw.prepare("UPDATE intake_questions SET body = 'x'").run(), /immutable/);
  assert.throws(() => DB.raw.prepare('DELETE FROM intake_questions').run(), /never deleted/);
});

test('라우팅: 화면은 assets 로 · 없는 API 404 · 메서드 불일치 404 · DB 바인딩 없으면 503', async () => {
  const env = { DB: makeDb(), ADMIN_KEY: 'k', ASSETS: { fetch: async (r) => new Response(`asset:${new URL(r.url).pathname}`) } };
  assert.equal(await (await worker.fetch(new Request('http://x/admin'), env)).text(), 'asset:/admin');
  assert.equal(await (await worker.fetch(new Request('http://x/'), env)).text(), 'asset:/');
  assert.equal((await worker.fetch(new Request('http://x/api/nope'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('http://x/api/intake'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('http://x/api/intake', { method: 'POST', body: '{}' }), { ASSETS: env.ASSETS })).status, 503);
});

test('기존 DB(session 칸 없음) 마이그레이션: 칸이 추가되고 기존 행은 교수 미지정', async () => {
  const DB = makeDb({ init: false });
  DB.raw.exec(`CREATE TABLE intake_questions (id INTEGER PRIMARY KEY, affiliation TEXT NOT NULL, name TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, dedupe_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','hidden')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  DB.raw.exec("INSERT INTO intake_questions (affiliation,name,title,body,dedupe_key,created_at,updated_at) VALUES ('a','가','나','본문본문본문본문','k','t','t')");
  const env = { DB, ADMIN_KEY: 'k', ASSETS: { fetch: async () => new Response('') } };
  const call = (method, path, body, key) => worker.fetch(new Request(`http://x${path}`, { method, body: body && JSON.stringify(body), headers: key ? { 'x-admin-key': key } : {} }), env);
  assert.equal((await call('POST', '/api/intake', { ...OK, professor: 'song' })).status, 201);
  const d = (await (await call('GET', '/api/admin/intake', null, 'k')).json()).data;
  assert.deepEqual(d.summary.byProfessor, { cho: 0, nam: 0, song: 1, jung: 0, other: 1 });
});

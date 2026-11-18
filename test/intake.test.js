import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './d1-shim.js';
import { check, normalize, dedupeKey, RULES } from '../src/rules.js';
import { onRequestPost } from '../functions/api/intake.js';
import { onRequestGet } from '../functions/api/admin/intake/index.js';
import { onRequestPatch } from '../functions/api/admin/intake/[id].js';

const OK = { affiliation: 'DT-1', name: '홍길동', title: '책임', body: '가상 설비의 시뮬레이션 정합도는 어떤 기준으로 확인하나요?' };
let env;
beforeEach(() => { env = { DB: makeDb(), ADMIN_KEY: 'test-key' }; });

const post = (body, ip = '1.1.1.1') => onRequestPost({ env, request: new Request('http://x/api/intake', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'cf-connecting-ip': ip } }) });
const get = (qs = '', key = 'test-key') => onRequestGet({ env, request: new Request(`http://x/api/admin/intake${qs}`, { headers: key ? { 'x-admin-key': key } : {} }) });
const patch = (id, body, key = 'test-key') => onRequestPatch({ env, params: { id }, request: new Request('http://x/', { method: 'PATCH', body: JSON.stringify(body), headers: key ? { 'x-admin-key': key } : {} }) });
const j = (r) => r.json();

test('단위: 길이 경계·필수·개인정보 거부 · 오류 문장에 입력값 미포함', async () => {
  const c = (o) => check(normalize({ ...OK, ...o }));
  assert.deepEqual(c({}), []);
  assert.equal(c({ body: 'a'.repeat(9) }).length, 1);
  assert.deepEqual(c({ body: 'a'.repeat(10) }), []);
  assert.deepEqual(c({ body: 'a'.repeat(500) }), []);
  assert.equal(c({ body: 'a'.repeat(501) }).length, 1);
  assert.equal(c({ name: '' }).length, 1);
  assert.equal(c({ name: 'x'.repeat(21) }).length, 1);
  assert.equal(c({ body: '사번 1234567 입니다 알려주세요' }).length, 1);
  assert.equal(c({ body: '메일 a@b.com 으로 부탁드립니다 감사' }).length, 1);
  assert.equal(c({ body: '번호는 010-1234-5678 입니다 연락주세요' }).length, 1);
  assert.ok(!c({ body: '메일 a@b.com 으로 부탁드립니다 감사' }).join().includes('a@b.com'));
  assert.deepEqual(c({ body: '색상 #171717 과 날짜 20261020 은 통과해야 합니다' }), []);
  assert.equal(check(normalize({ ...OK, name: 5 })).length, 1);
  assert.equal(await dedupeKey(normalize(OK)), await dedupeKey(normalize({ ...OK, name: ' 홍길동 ', body: OK.body.toUpperCase() })));
});

test('제출 201 · 같은 내용 재전송 200 + 같은 ref · 1행', async () => {
  const a = await post(OK);
  assert.equal(a.status, 201);
  const ad = (await j(a)).data;
  assert.match(ad.ref, /^Q-\d{4}$/);
  const b = await post(OK);
  assert.equal(b.status, 200);
  assert.equal((await j(b)).data.ref, ad.ref);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM intake_questions').get().n, 1);
});

test('400: 문제 목록 · 저장 안 됨 · 잘못된 JSON 400 · 큰 본문 413 · 개인정보 칸 없음', async () => {
  const r = await post({ ...OK, body: '짧음', name: '' });
  assert.equal(r.status, 400);
  assert.ok((await j(r)).error.problems.length >= 2);
  assert.equal((await post('{깨진')).status, 400);
  assert.equal((await post('x'.repeat(9000))).status, 413);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM intake_questions').get().n, 0);
  const cols = env.DB.raw.prepare('PRAGMA table_info(intake_questions)').all().map((c) => c.name);
  for (const bad of ['email', 'employee_id', 'phone', 'sabun']) assert.ok(!cols.includes(bad));
});

test('횟수 제한: 같은 접속자 11번째 429 + Retry-After · 다른 접속자는 통과', async () => {
  for (let i = 0; i < RULES.rate.max; i++) assert.equal((await post({ ...OK, body: `질문 번호 ${i} 입니다 자세히 알려 주세요` })).status, 201);
  const r = await post({ ...OK, body: '열한 번째 질문입니다 자세히 알려 주세요' });
  assert.equal(r.status, 429);
  assert.ok(r.headers.get('retry-after'));
  assert.equal((await post({ ...OK, body: '다른 접속자의 질문입니다 알려 주세요' }, '2.2.2.2')).status, 201);
});

test('사무국 키: 없음/틀림 401 · 서버에 키 미설정 503(닫힘)', async () => {
  assert.equal((await get('', null)).status, 401);
  assert.equal((await get('', 'wrong')).status, 401);
  assert.equal((await patch('1', { status: 'hidden' }, null)).status, 401);
  env.ADMIN_KEY = undefined;
  assert.equal((await get()).status, 503);
});

test('현황: 건수·이름순 제출자 · 카드 접수순 · 필터 · 판정 키 없음', async () => {
  await post(OK);
  await post({ ...OK, name: '가나다', affiliation: 'PA-1', body: '로봇 안전 인증은 어느 단계에서 확인하나요?' });
  await post({ ...OK, body: '두 번째 질문입니다 근거 데이터는 어디서 얻나요?' });
  const r = await get();
  assert.equal(r.status, 200);
  const { summary, items } = (await j(r)).data;
  assert.equal(summary.total, 3);
  assert.deepEqual(summary.submitters.map((x) => [x.name, x.count]), [['가나다', 1], ['홍길동', 2]]);
  assert.deepEqual(items.map((x) => x.id), [1, 2, 3]);
  assert.doesNotMatch(JSON.stringify(summary) + JSON.stringify(items), /"(rank|score|top|best|recommend)/i);
  assert.equal((await j(await get('?affiliation=PA-1'))).data.items.length, 1);
});

test('숨김은 상태 변경 · 목록·건수에서 빠짐 · 본문 UPDATE·DELETE 는 DB 가 거부', async () => {
  await post(OK);
  assert.equal((await patch('1', { status: 'hidden' })).status, 200);
  assert.equal((await patch('1', { status: 'x' })).status, 400);
  assert.equal((await patch('99', { status: 'hidden' })).status, 404);
  const d = (await j(await get())).data;
  assert.equal(d.summary.total, 0);
  assert.equal(d.items.length, 0);
  assert.equal((await j(await get('?hidden=1'))).data.items.length, 1);
  assert.equal((await patch('1', { status: 'open' })).status, 200);
  assert.throws(() => env.DB.raw.prepare("UPDATE intake_questions SET body = 'x' WHERE id = 1").run(), /immutable/);
  assert.throws(() => env.DB.raw.prepare('DELETE FROM intake_questions WHERE id = 1').run(), /never deleted/);
});

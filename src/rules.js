// 검사 규칙 — 순수 함수 (Workers·Node 공용)
export const RULES = { affiliationMax: 40, nameMax: 20, titleMax: 20, bodyMin: 10, bodyMax: 500, rate: { max: 10, windowSec: 600 } };

// 사번(6~7자리 숫자)·이메일·휴대전화가 들어간 입력은 거부
const PATTERNS = {
  employee_id: /(?<![0-9#\[])[0-9]{6,7}(?![0-9\]])/,
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  phone: /(?<![0-9])01[016789][- .]?[0-9]{3,4}[- .]?[0-9]{4}(?![0-9])/,
};
const MESSAGES = {
  employee_id: '개인정보: 사번으로 보이는 6~7자리 숫자가 있습니다 — 숫자를 하이픈 등으로 나눠 써 주세요',
  email: '개인정보: 이메일 주소가 있습니다',
  phone: '개인정보: 휴대전화 번호가 있습니다',
};

const clean = (v, multiline) => (typeof v === 'string'
  ? v.replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').trim()
  : null);

export const normalize = (b) => ({ affiliation: clean(b?.affiliation), name: clean(b?.name), title: clean(b?.title), body: clean(b?.body, true) });

/** @returns {string[]} 화면에 그대로 보여도 되는 문장 (입력값을 되풀이하지 않는다) */
export function check(q, r = RULES) {
  if ([q.affiliation, q.name, q.title, q.body].some((v) => v === null)) return ['입력 형식이 올바르지 않습니다'];
  const p = [];
  for (const [k, label, max] of [['affiliation', '소속', r.affiliationMax], ['name', '성명', r.nameMax], ['title', '직급', r.titleMax]]) {
    if (!q[k]) p.push(`${label}을(를) 입력해 주세요`);
    else if (q[k].length > max) p.push(`${label}은(는) ${max}자까지입니다`);
  }
  if (q.body.length < r.bodyMin) p.push(`질문을 ${r.bodyMin}자 이상 구체적으로 써 주세요`);
  else if (q.body.length > r.bodyMax) p.push(`질문은 ${r.bodyMax}자까지입니다`);
  const text = [q.affiliation, q.name, q.title, q.body].join('\n');
  for (const [k, re] of Object.entries(PATTERNS)) if (re.test(text)) p.push(MESSAGES[k]);
  return p;
}

const norm = (s) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const dedupeKey = (q) => sha256Hex(`${norm(q.name)}|${norm(q.body)}`);
export const refOf = (id) => `Q-${String(id).padStart(4, '0')}`;

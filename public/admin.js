const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
};
const fmt = (iso) => { const d = new Date(iso); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

$('#askurl').textContent = `${location.origin}/`;
let key = '';
try { key = sessionStorage.getItem('adminKey') || ''; } catch { /* 저장소 차단 */ }
let items = [];
let filtersReady = false;

async function call(path, opt = {}) {
  const r = await fetch(path, { ...opt, headers: { 'content-type': 'application/json', 'x-admin-key': key } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error?.message || `HTTP ${r.status}`), { status: r.status });
  return j.data;
}

async function load() {
  const q = new URLSearchParams();
  if ($('#f-aff').value) q.set('affiliation', $('#f-aff').value);
  if ($('#f-name').value) q.set('name', $('#f-name').value);
  if ($('#f-hidden').checked) q.set('hidden', '1');
  const data = await call('/api/admin/intake?' + q);
  items = data.items;
  drawSummary(data.summary);
  if (!filtersReady) {
    filtersReady = true;
    for (const a of data.summary.byAffiliation) $('#f-aff').append(el('option', { value: a.affiliation }, a.affiliation));
    for (const s of data.summary.submitters) $('#f-name').append(el('option', { value: s.name }, s.name));
  }
  drawCards();
}

function drawSummary(s) {
  const box = $('#summary');
  box.replaceChildren(el('p', {}, el('b', {}, `총 ${s.total}건`), ` · 제출자 ${s.submitters.length}명`));
  if (!s.total) { box.append(el('p', { class: 'muted' }, '아직 접수된 질문이 없습니다')); return; }
  box.append(el('p', { class: 'small' }, s.byAffiliation.map((a) => `${a.affiliation} ${a.count}건`).join(' · ')));
  box.append(el('table', {}, el('thead', {}, el('tr', {}, ['성명', '직급', '소속', '건수'].map((h) => el('th', {}, h)))),
    el('tbody', {}, s.submitters.map((x) => el('tr', {}, el('td', {}, x.name), el('td', {}, x.title), el('td', {}, x.affiliation), el('td', {}, String(x.count)))))));
}

function drawCards() {
  const box = $('#cards');
  box.replaceChildren();
  if (!items.length) { box.append(el('p', { class: 'muted' }, '카드가 없습니다')); return; }
  items.forEach((c, i) => box.append(el('div', { class: 'card', style: c.status === 'hidden' ? 'opacity:.5' : '' },
    el('div', { class: 'small muted' }, `${c.ref} · ${fmt(c.createdAt)}${c.status === 'hidden' ? ' · 숨김' : ''}`),
    el('p', { class: 'pre', style: 'margin:8px 0' }, c.body.length > 120 ? c.body.slice(0, 120) + '…' : c.body),
    el('div', { class: 'small' }, `${c.name} · ${c.title} · ${c.affiliation}`),
    el('div', { class: 'row', style: 'margin-top:8px' },
      el('button', { class: 'primary', onclick: () => stage(i) }, '전체 화면'),
      el('button', { onclick: () => hide(c) }, c.status === 'hidden' ? '숨김 해제' : '숨김')))));
}

async function hide(c) {
  try { await call(`/api/admin/intake/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: c.status === 'hidden' ? 'open' : 'hidden' }) }); } catch (e) { alert(e.message); }
  load();
}

// 전체 화면 공유 — ←/→ 이동 · Esc 닫기 · A 작성자 가리기(화면 표시만)
function stage(start) {
  let k = start;
  let blind = false;
  const meta = el('div', { class: 'meta' });
  const text = el('p', { class: 'stage-text' });
  const count = el('span', {});
  const prev = el('button', {}, '← 이전');
  const next = el('button', {}, '다음 →');
  const mask = el('button', {}, '작성자 가리기 (A)');
  const root = el('div', { class: 'stage' },
    el('div', { class: 'stage-head' }, el('strong', {}, '질문 카드'), meta, mask, el('button', { 'aria-label': '닫기', onclick: () => close() }, '×')),
    el('div', { class: 'stage-body' }, text),
    el('div', { class: 'stage-foot' }, prev, count, next));
  const draw = () => {
    const c = items[k];
    meta.textContent = blind ? c.ref : `${c.ref} · ${c.name} · ${c.title} · ${c.affiliation}`;
    text.textContent = c.body;
    count.textContent = `${k + 1} / ${items.length}`;
    prev.disabled = k === 0;
    next.disabled = k === items.length - 1;
  };
  const move = (d) => { k = Math.max(0, Math.min(items.length - 1, k + d)); draw(); };
  const toggle = () => { blind = !blind; draw(); };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') move(-1); else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'a' || e.key === 'A') toggle(); else if (e.key === 'Escape') close();
  };
  function close() {
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('stage-open');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    root.remove();
  }
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  mask.addEventListener('click', toggle);
  document.addEventListener('keydown', onKey);
  document.body.classList.add('stage-open');
  document.body.append(root);
  root.requestFullscreen?.().catch(() => {}); // 브라우저 전체 화면 (거부돼도 창 가득 표시)
  draw();
}

async function enter() {
  try {
    await load();
    $('#gate').classList.add('hidden');
    $('#app').classList.remove('hidden');
    try { sessionStorage.setItem('adminKey', key); } catch { /* */ }
  } catch (e) {
    $('#gate').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#gate-out').replaceChildren(el('div', { class: 'msg err' }, e.status === 401 ? '사무국 키가 맞지 않습니다' : e.message));
  }
}
$('#enter').addEventListener('click', () => { key = $('#key').value; enter(); });
$('#key').addEventListener('keydown', (e) => { if (e.key === 'Enter') { key = $('#key').value; enter(); } });
for (const id of ['#f-aff', '#f-name', '#f-hidden']) $(id).addEventListener('change', load);
if (key) enter(); else $('#gate').classList.remove('hidden');

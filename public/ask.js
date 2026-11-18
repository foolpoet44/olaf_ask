const $ = (s) => document.querySelector(s);
const MAX = 500;
const show = (kind, text, problems = []) => {
  const out = $('#out');
  out.replaceChildren();
  const box = document.createElement('div');
  box.className = `msg ${kind}`;
  box.textContent = text;
  if (problems.length) {
    const ul = document.createElement('ul');
    for (const p of problems) { const li = document.createElement('li'); li.textContent = p; ul.append(li); }
    box.append(ul);
  }
  out.append(box);
};
const count = () => { $('#count').textContent = `${$('#body').value.trim().length} / ${MAX}자`; };
$('#body').addEventListener('input', count);
count();

$('#submit').addEventListener('click', async () => {
  const btn = $('#submit');
  btn.disabled = true;
  try {
    const r = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ affiliation: $('#affiliation').value, name: $('#name').value, title: $('#title').value, body: $('#body').value }),
    });
    const j = await r.json();
    if (!r.ok) {
      const wait = r.headers.get('retry-after');
      show('err', r.status === 429 ? `잠시 후 다시 시도해 주세요${wait ? ` (약 ${Math.ceil(wait / 60)}분)` : ''}` : j.error?.message || '오류가 발생했습니다', j.error?.problems || []);
    } else {
      $('#body').value = '';
      count();
      show('ok', `접수되었습니다 (${j.data.ref}). 이어서 다른 질문을 낼 수 있습니다.`);
    }
  } catch { show('err', '네트워크 오류입니다. 다시 시도해 주세요'); } finally { btn.disabled = false; }
});

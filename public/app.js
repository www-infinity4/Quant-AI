const log = document.getElementById('log');
const add = (t, me) => {
  const d = document.createElement('div');
  d.className = 'msg' + (me ? ' me' : '');
  d.textContent = t;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
};
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const i = document.getElementById('m');
  const message = i.value.trim();
  if (!message) return;
  add(message, true);
  i.value = '';
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    const d = await r.json();
    add(r.ok ? d.reply : 'Sorry, the assistant is unavailable.');
  } catch { add('Sorry, the assistant is unavailable.'); }
});

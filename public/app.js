const log=document.getElementById('log');
const input=document.getElementById('m');
const add=(t,me)=>{const d=document.createElement('div');d.className='msg'+(me?' me':'');d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight};
async function ask(message){
  if(!message)return;
  add(message,true); input.value='';
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message}),signal:AbortSignal.timeout(12000)});
    const d=await r.json(); add(r.ok?d.reply:'The assistant is unavailable right now.');
  }catch{add('The assistant is unavailable right now.')}
}
document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();ask(input.value.trim())});
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.prompt)));

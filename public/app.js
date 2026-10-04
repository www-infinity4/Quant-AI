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

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function deviceToken(){for(const k of ['starquest_device_token_v1','starquest_device_token_v2','starquest:deviceToken:v1']){const v=localStorage.getItem(k);if(v&&/^sq_/.test(v))return v}return ''}
async function api(path,{method='GET',body}={}){
 const token=deviceToken();if(!token)throw new Error('Open Quant-AI from your authenticated QuantaPhi wallet so it can use your private device identity.');
 const r=await fetch(path,{method,headers:{Authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;
}
let folderCache=[];
async function refreshFolders(){
 const box=document.getElementById('folders'),select=document.getElementById('inventoryFolder');if(!box||!select)return;
 try{const d=await api('/api/folders');const fs=d.folders||[];folderCache=fs;box.innerHTML=fs.length?fs.map(f=>`<div class="folder"><b>${esc(f.name)}</b><span>${Number(f.quant_count||0)} Quants</span><small>${esc(f.description||'')}</small></div>`).join(''):'<p class="muted">No folders yet.</p>';select.innerHTML='<option value="">No folder selected</option>'+fs.map(f=>`<option value="${esc(f.folder_id)}">${esc(f.name)}</option>`).join('')}
 catch(e){box.innerHTML=`<p class="muted">${esc(e.message)}</p>`}
}
async function refreshOwnedQuants(){
 const box=document.getElementById('ownedQuants');if(!box)return;
 try{const d=await api('/api/quants/owned'),qs=d.quants||[];if(!qs.length){box.innerHTML='<p class="muted">No committed search Quants found.</p>';return}
 box.innerHTML=qs.slice(0,100).map(q=>`<div class="owned-quant"><div><b>${esc(q.query||'Search Quant')}</b><small>${esc(q.quant_id)}</small></div><select data-quant="${esc(q.quant_id)}"><option value="">Add to folder…</option>${folderCache.map(f=>`<option value="${esc(f.folder_id)}">${esc(f.name)}</option>`).join('')}</select></div>`).join('');
 box.querySelectorAll('select[data-quant]').forEach(sel=>sel.addEventListener('change',async()=>{if(!sel.value)return;sel.disabled=true;try{await api('/api/folders/add',{method:'POST',body:{folder_id:sel.value,quant_id:sel.dataset.quant}});await refreshFolders().then(refreshOwnedQuants);await refreshOwnedQuants()}catch(e){alert(e.message)}finally{sel.disabled=false}}));
 }catch(e){box.innerHTML=`<p class="muted">${esc(e.message)}</p>`}
}
document.getElementById('folderForm')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api('/api/folders',{method:'POST',body:{name:folderName.value,description:folderDescription.value}});e.target.reset();await refreshFolders();await refreshOwnedQuants()}catch(err){document.getElementById('folders').innerHTML=`<p class="muted">${esc(err.message)}</p>`}finally{b.disabled=false}});
document.getElementById('inventoryForm')?.addEventListener('submit',async e=>{e.preventDefault();const out=document.getElementById('inventoryResult'),b=e.submitter;b.disabled=true;try{const d=await api('/api/inventory/experiments',{method:'POST',body:{folder_id:inventoryFolder.value||null,name:inventoryName.value,item_label:inventoryItem.value,test_quantity:Number(inventoryQty.value),unit_cost_minor:Math.round(Number(inventoryCost.value)*100),target_price_minor:Math.round(Number(inventoryPrice.value)*100),currency:'USD'}});out.innerHTML=`<div class="experiment"><b>${esc(d.name)}</b><p>Test ${d.test_quantity} × ${esc(d.item_label)}. Planned gross margin before other costs: $${(Number(d.gross_margin_minor)/100).toFixed(2)}.</p><small>${(d.evidence||[]).length} supporting Quant/tag evidence rows saved.</small></div>`}catch(err){out.innerHTML=`<p class="muted">${esc(err.message)}</p>`}finally{b.disabled=false}});
refreshFolders();

import {addTransfer,freshness,projectView,handoffText,searchLibrary} from './reader-core.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Project files stay on this device in IndexedDB; nothing is uploaded.
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('recap-reader',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function store(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('projects',mode),s=t.objectStore('projects'),r=fn(s);t.oncomplete=()=>resolve(r?.result);t.onerror=()=>reject(t.error);});}
const loadAll=()=>store('readonly',s=>s.getAll());
let library=[],current=null,query='';
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3500);}
const date=v=>new Date(v).toLocaleString();
function items(list,kind,empty){
  if(!list.length)return `<p class="empty">${empty}</p>`;
  return list.map(i=>`<div class="item ${kind}"><p>${esc(i.text)}</p><div class="meta">${esc([i.certainty,i.sender&&'Speaker: '+i.sender,i.source&&`${i.source}, line ${i.line}`].filter(Boolean).join(' · '))}</div>${i.supersededAt?`<div class="meta">Replaced ${esc(date(i.supersededAt))}: ${esc(i.replacementReason)}</div>`:''}${i.note?`<div class="meta">Note: ${esc(i.note)}</div>`:''}</div>`).join('');
}
function renderList(){
  $('#title').textContent='Recap';$('#back').hidden=true;current=null;
  const results=searchLibrary(library,query);
  $('#main').innerHTML=`<input type="search" id="search" placeholder="Search all projects" value="${esc(query)}" aria-label="Search all projects">`+
   (query?(results.length?results.map(r=>`<button class="card" data-open="${esc(r.key)}"><div class="meta">${esc(r.project)} · ${esc(r.label)}</div><p>${esc(r.text)}</p></button>`).join(''):'<p class="empty">Nothing approved matches.</p>'):
   library.length?library.slice().sort((a,b)=>Date.parse(b.transfer.exportedAt)-Date.parse(a.transfer.exportedAt)).map(e=>{const p=e.transfer.project,next=p.context?.next?.trim();return `<button class="card" data-open="${esc(e.key)}"><h2>${esc(p.name)}</h2>${next?`<p>Next: ${esc(next)}</p>`:''}<div class="meta">${esc(freshness(e.transfer.exportedAt))}</div></button>`;}).join(''):
   `<div class="card"><h2>No projects yet</h2><p>On your PC, open a project in Recap, choose Continue project, then Transfer project. Send the downloaded .recap.json file to this phone and add it here.</p><p class="meta">Files stay on this phone. Nothing is uploaded.</p></div>`);
  const input=$('#search');input.oninput=()=>{query=input.value;renderList();const again=$('#search');again.focus();again.setSelectionRange(query.length,query.length);};
}
function renderProject(entry){
  current=entry;const p=entry.transfer.project,v=projectView(p);
  $('#title').textContent=p.name;$('#back').hidden=false;window.scrollTo(0,0);
  const ctx=k=>v.context.find(c=>c.key===k);
  const field=k=>ctx(k).text?`<section><h3>${esc(ctx(k).label)}</h3><div class="card"><p>${esc(ctx(k).text).replace(/\n/g,'<br>')}</p></div></section>`:'';
  $('#main').innerHTML=`<div class="stale">${esc(freshness(entry.transfer.exportedAt))} Exported ${esc(date(entry.transfer.exportedAt))}.</div>
  <div class="actions"><button id="copy">Copy handoff</button>${navigator.share?'<button id="share" class="secondary">Share</button>':''}</div>
  ${field('next')}${field('goal')}${field('progress')}
  <section><h3>Approved decisions</h3>${items(v.decisions,'','No approved decisions.')}</section>
  <section><h3>Open tasks</h3>${items(v.tasks,'','No open approved tasks.')}</section>
  <section><h3>Open questions</h3>${items(v.questions,'','No approved questions.')}${field('questions')}</section>
  ${v.waiting.length?`<section><h3>Waiting on others</h3>${items(v.waiting,'','')}</section>`:''}
  ${field('constraints')}${field('rejected')}
  <section><h3>Rejected options</h3>${items(v.rejected,'rejected','None recorded.')}</section>
  <section><h3>Proposals, not adopted</h3>${items(v.proposals,'proposal','None recorded.')}</section>
  <section><h3>AI statements, not your decisions</h3>${items(v.ai,'ai','None recorded.')}</section>
  <details><summary>Superseded decisions (${v.superseded.length})</summary>${items(v.superseded,'history','None.')}</details>
  ${field('artifacts')}${field('preferences')}
  ${v.references.length?`<details><summary>References (${v.references.length})</summary>${items(v.references,'','')}</details>`:''}
  <p class="meta">${v.unreviewed} findings were not yet reviewed on the PC and are not shown.</p>
  <details><summary>Full handoff text</summary><pre>${esc(handoffText(entry))}</pre></details>
  <div class="actions"><button id="remove" class="secondary">Remove from this phone</button></div>`;
  $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(handoffText(entry));toast('Handoff copied. Paste it into a new AI chat.');}catch{toast('Copy is not available here. Use Share or open Full handoff text.');}};
  if($('#share'))$('#share').onclick=()=>navigator.share({title:p.name,text:handoffText(entry)}).catch(()=>{});
  $('#remove').onclick=async()=>{if(!confirm(`Remove ${p.name} from this phone? The project on your PC is not affected.`))return;await store('readwrite',s=>s.delete(entry.key));library=library.filter(e=>e.key!==entry.key);renderList();toast('Removed from this phone.');};
}
$('#back').onclick=renderList;
$('#main').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)renderProject(library.find(x=>x.key===b.dataset.open));});
$('#file').onchange=async e=>{
  const messages=[];
  for(const file of e.target.files){
    try{const result=addTransfer(library,await file.text());if(result.status!=='unchanged')await store('readwrite',s=>s.put(result.entry));library=result.library;messages.push(`${result.entry.transfer.project.name}: ${result.status==='replaced'?'updated to the newer copy':result.status==='added'?'added':'already here'}`);}
    catch(error){messages.push(`${file.name}: ${error.message}`);}
  }
  e.target.value='';renderList();toast(messages.join(' · '));
};
try{library=await loadAll();}catch{toast('This browser cannot store projects. Try Chrome.');}
renderList();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

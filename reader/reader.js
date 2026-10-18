import {addFiles as addToLibrary,addSummary,freshness,projectView,handoffText,searchLibrary} from './reader-core.js';
// Product name in one place, so a rename only changes these two lines.
const APP='Recap',PC_STEPS='<b>Continue project</b>, then <b>Transfer project</b>';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Project files stay on this device in IndexedDB; nothing is uploaded.
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('recap-reader',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function store(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('projects',mode),s=t.objectStore('projects'),r=fn(s);t.oncomplete=()=>resolve(r?.result);t.onerror=()=>reject(t.error);});}
const loadAll=()=>store('readonly',s=>s.getAll());
let library=[],current=null,query='',lastResult=null;
// iPhones and some phone browsers cannot pick a whole folder; they get a plain explanation instead of the button.
// Where the button shows but the phone returns nothing, the result card explains the fallback.
const canPickFolder='webkitdirectory' in document.createElement('input')&&!/iPhone|iPad|iPod/i.test(navigator.userAgent);
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3500);}
const date=v=>new Date(v).toLocaleString();
function items(list,kind,empty){
  if(!list.length)return `<p class="empty">${empty}</p>`;
  return list.map(i=>`<div class="item ${kind}"><p>${esc(i.text)}</p><div class="meta">${esc([i.certainty,i.sender&&'Speaker: '+i.sender,i.source&&`${i.source}, line ${i.line}`].filter(Boolean).join(' · '))}</div>${i.supersededAt?`<div class="meta">Replaced ${esc(date(i.supersededAt))}: ${esc(i.replacementReason)}</div>`:''}${i.note?`<div class="meta">Note: ${esc(i.note)}</div>`:''}</div>`).join('');
}
function renderList(){
  $('#title').textContent=APP;$('#back').hidden=true;current=null;
  const results=searchLibrary(library,query);
  const toolbar=`<div class="add-bar"><div class="actions"><button id="add-files">Add project files</button>${canPickFolder?'<button id="add-folder" class="secondary">Add project folder</button>':''}</div>
   <p class="meta">Choose files exported on the PC with ${PC_STEPS} (they end in <b>.recap.json</b>). The reader does not read ordinary documents, chats or notes; other files in a folder are skipped.${canPickFolder?'':' This browser cannot pick a whole folder, so open the folder and select all the project files at once instead.'}</p></div>`;
  const report=lastResult?`<div class="card result"><h3>${esc(addSummary(lastResult))}</h3>${[...lastResult.added,...lastResult.replaced].map(x=>`<p>✓ ${esc(x.project)}</p>`).join('')}${lastResult.skipped.length?`<details><summary>Skipped files (${lastResult.skipped.length})</summary>${lastResult.skipped.slice(0,50).map(x=>`<p class="meta">${esc(x.name)}: ${esc(x.reason)}</p>`).join('')}</details>`:''}${lastResult.folderEmpty?'<p class="meta">No files came back from the folder. This phone may not support choosing folders: tap Add project files, open the folder and select all the files.</p>':''}<button id="dismiss" class="text-button">Close</button></div>`:'';
  $('#main').innerHTML=toolbar+report+`<input type="search" id="search" placeholder="Search all projects" value="${esc(query)}" aria-label="Search all projects">`+
   (query?(results.length?results.map(r=>`<button class="card" data-open="${esc(r.key)}"><div class="meta">${esc(r.project)} · ${esc(r.label)}</div><p>${esc(r.text)}</p></button>`).join(''):'<p class="empty">Nothing approved matches.</p>'):
   library.length?library.slice().sort((a,b)=>Date.parse(b.transfer.exportedAt)-Date.parse(a.transfer.exportedAt)).map(e=>{const p=e.transfer.project,next=p.context?.next?.trim();return `<button class="card" data-open="${esc(e.key)}"><h2>${esc(p.name)}</h2>${next?`<p>Next: ${esc(next)}</p>`:''}<div class="meta">${esc(freshness(e.transfer.exportedAt))}</div></button>`;}).join(''):
   `<div class="card"><h2>No projects yet</h2><p>To bring a project to this phone:</p><ol><li>On your PC, open the project in ${APP}, choose ${PC_STEPS}. A file ending in <b>.recap.json</b> is downloaded.</li><li>Send that file to this phone, for example email it to yourself or put it in Google Drive.</li><li>On the phone, download it from the email or Drive, then tap <b>Add project files</b> above. If the list starts on Recents, tap ☰ and choose <b>Downloads</b> or <b>Drive</b>. Several projects can be selected at once.</li></ol><p class="meta">Files stay on this phone. Nothing is uploaded.</p></div><div class="actions"><button id="sample" class="secondary">Try a sample project</button></div>`);
  if($('#sample'))$('#sample').onclick=async()=>{try{const response=await fetch('sample.recap.json');if(!response.ok)throw Error('Sample not available offline yet.');const text=await response.text();await addFiles([{name:'sample.recap.json',size:text.length,text:async()=>text}]);}catch(error){toast(error.message);}};
  $('#add-files').onclick=()=>$('#file').click();if($('#add-folder'))$('#add-folder').onclick=()=>$('#folder').click();if($('#dismiss'))$('#dismiss').onclick=()=>{lastResult=null;renderList();};
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
async function addFiles(files,{folder=false}={}){
  const result=await addToLibrary(library,files);
  for(const x of [...result.added,...result.replaced]){try{await store('readwrite',st=>st.put(x.entry));}catch{result.skipped.push({name:x.name,reason:'could not be saved on this phone'});}}
  library=result.library;result.folderEmpty=folder&&!files.length;lastResult=result;query='';renderList();toast(addSummary(result));
}
$('#file').onchange=async e=>{await addFiles([...e.target.files]);e.target.value='';};
$('#folder').onchange=async e=>{await addFiles([...e.target.files],{folder:true});e.target.value='';};
// Show the page at once; stored projects appear when storage answers (some phones are slow or block it).
renderList();
Promise.race([loadAll(),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),5000))])
  .then(all=>{library=all||[];if(!current)renderList();})
  .catch(()=>toast('Saved projects could not be opened on this phone. Try reloading, or use Chrome.'));
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

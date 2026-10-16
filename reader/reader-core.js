import {readProjectTransfer} from '../project-transfer.js';
import {handoff,handoffGroup,contextFields} from '../handoff.js';
// Pure reader logic, shared by the phone page and the tests. A stored entry is the transfer file as exported.

// One entry per original project; a newer export replaces an older one, an older one is refused.
export function addTransfer(library,text){
  const transfer=readProjectTransfer(text);
  const key=transfer.project.transfer?.originalProjectId||transfer.project.id;
  const existing=library.find(e=>e.key===key);
  if(existing&&existing.transfer.transferId===transfer.transferId)return {library,status:'unchanged',entry:existing};
  if(existing&&Date.parse(existing.transfer.exportedAt)>Date.parse(transfer.exportedAt))throw Error(`This file is older than the copy already on this phone (exported ${existing.transfer.exportedAt}).`);
  const entry={key,transfer,addedAt:new Date().toISOString()};
  return {library:[...library.filter(e=>e.key!==key),entry],status:existing?'replaced':'added',entry};
}

export function ageInDays(exportedAt,now=Date.now()){return Math.max(0,Math.floor((now-Date.parse(exportedAt))/86400000));}
export function freshness(exportedAt,now=Date.now()){
  const days=ageInDays(exportedAt,now);
  return days===0?'Exported today. Changes made on the PC since then are not shown.':`Exported ${days} day${days>1?'s':''} ago. Changes made on the PC since then are not shown.`;
}

const live=project=>{const ids=new Set(project.sources.filter(s=>!s.ignored).map(s=>s.id));return project.items.filter(i=>ids.has(i.sourceId));};
export function projectView(project){
  const items=live(project),approved=items.filter(i=>i.state==='approved'),group=g=>approved.filter(i=>handoffGroup(i)===g);
  const current=group('current'),source=i=>project.sources.find(s=>s.id===i.sourceId)?.name||'';
  const pick=list=>list.map(i=>({text:i.text,type:i.type,done:!!i.done,certainty:i.certainty||'',sender:i.sender||'',source:source(i),line:i.line,note:i.note||'',supersededAt:i.supersededAt||'',replacementReason:i.replacementReason||''}));
  return {
    context:contextFields.map(([key,label])=>({key,label,text:project.context?.[key]?.trim()||''})),
    decisions:pick(current.filter(i=>i.type==='Decision')),
    tasks:pick(current.filter(i=>i.type==='Task'&&!i.done)),
    questions:pick(current.filter(i=>i.type==='Question')),
    waiting:pick(current.filter(i=>i.type==='Waiting'&&!i.done)),
    references:pick(current.filter(i=>i.type==='Reference')),
    rejected:pick(group('rejected')),proposals:pick(group('proposal')),ai:pick(group('ai')),
    superseded:pick(items.filter(i=>i.state==='superseded')),
    unreviewed:items.filter(i=>i.state==='review').length,
  };
}

export function handoffText(entry){
  return handoff(entry.transfer.project)+`\nPhone copy exported from Recap on ${entry.transfer.exportedAt}; later changes on the PC are not included.\n`;
}

export function searchLibrary(library,query){
  const q=query.trim().toLowerCase();if(!q)return [];
  return library.flatMap(entry=>{const p=entry.transfer.project,ids=new Set(p.sources.filter(s=>!s.ignored).map(s=>s.id));
    const hits=[...Object.values(p.context||{}).filter(v=>v.toLowerCase().includes(q)).map(text=>({text,label:'Context'})),
      ...p.items.filter(i=>ids.has(i.sourceId)&&(i.state==='approved'||i.state==='superseded')&&[i.text,i.note||''].join(' ').toLowerCase().includes(q)).map(i=>({text:i.text,label:i.state==='superseded'?'Superseded '+i.type.toLowerCase():i.type}))];
    return hits.map(hit=>({...hit,key:entry.key,project:p.name}));});
}

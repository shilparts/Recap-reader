// Versioned, platform-neutral snapshots. File transfer is not two-way synchronization.
export const TRANSFER_FORMAT='recap.project';
export const TRANSFER_VERSION=1;
export const MAX_TRANSFER_BYTES=20*1024*1024;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const string=(value,label)=>{if(typeof value!=='string')throw Error('Invalid '+label);};
const date=(value,label)=>{string(value,label);if(!Number.isFinite(Date.parse(value)))throw Error('Invalid '+label);};
const states=new Set(['review','approved','ignored','superseded']);
const types=new Set(['Task','Decision','Waiting','Question','Reference']);

function findings(items,sourceIds){
  if(!Array.isArray(items))throw Error('Invalid findings');
  const ids=new Set();
  for(const i of items){
    if(!object(i))throw Error('Invalid finding');
    for(const field of ['id','sourceId','text'])string(i[field],'finding '+field);
    if(ids.has(i.id)||!sourceIds.has(i.sourceId)||!states.has(i.state)||!types.has(i.type))throw Error('Invalid finding identity, source or state');
    if(!Number.isInteger(i.line)||i.line<1)throw Error('Invalid source line');
    for(const field of ['note','original','sender','role','sentAt','certainty','location','date','replacementReason'])if(i[field]!==undefined)string(i[field],field);
    if(i.done!==undefined&&typeof i.done!=='boolean')throw Error('Invalid completion state');
    if(i.supersededAt!==undefined)date(i.supersededAt,'supersession date');
    ids.add(i.id);
  }
}
function source(s,depth=0){
  if(depth>5||!object(s))throw Error('Invalid source history');
  for(const key of ['id','name','text'])string(s[key],'source '+key);
  for(const key of ['kind','coverage','location'])if(s[key]!==undefined)string(s[key],key);
  if(s.updated!==undefined)date(s.updated,'source update date');
  if(s.ignored!==undefined&&typeof s.ignored!=='boolean')throw Error('Invalid ignored flag');
  const snapshot=v=>{if(!object(v)||v.source?.id!==s.id)throw Error('Invalid source snapshot');source(v.source,depth+1);findings(v.items,new Set([s.id]));};
  if(s.versions!==undefined){if(!Array.isArray(s.versions)||s.versions.length>3)throw Error('Invalid source versions');s.versions.forEach(snapshot);}
  if(s.undoRestore){snapshot(s.undoRestore);snapshot(s.undoRestore.snapshot);}
}
export function validateTransferProject(p){
  if(!object(p))throw Error('Invalid project');
  string(p.id,'project ID');string(p.name,'project name');
  if(!Array.isArray(p.sources)||!Array.isArray(p.activity))throw Error('Invalid project collections');
  const ids=new Set();for(const s of p.sources){source(s);if(ids.has(s.id))throw Error('Duplicate source ID');ids.add(s.id);}
  findings(p.items,ids);
  if(p.context!==undefined){if(!object(p.context))throw Error('Invalid context');Object.values(p.context).forEach(v=>string(v,'context value'));}
  if(p.transfer!==undefined){if(!object(p.transfer))throw Error('Invalid transfer record');for(const key of ['id','originalProjectId'])string(p.transfer[key],'transfer '+key);date(p.transfer.exportedAt,'transfer export date');date(p.transfer.importedAt,'transfer import date');}
  if(p.lastImport!==undefined){if(!Array.isArray(p.lastImport))throw Error('Invalid coverage report');for(const entry of p.lastImport){if(!object(entry))throw Error('Invalid coverage entry');string(entry.name,'coverage name');string(entry.status,'coverage status');}}
  for(const entry of p.activity){if(!object(entry))throw Error('Invalid activity');string(entry.message,'activity message');date(entry.date,'activity date');}
  if(p.updates!==undefined){
    if(!Array.isArray(p.updates))throw Error('Invalid import comparisons');
    for(const u of p.updates){if(!object(u))throw Error('Invalid comparison');string(u.name,'comparison name');date(u.date,'comparison date');for(const list of [u.before,u.after]){if(!Array.isArray(list))throw Error('Invalid comparison findings');for(const i of list){if(!object(i))throw Error('Invalid comparison finding');string(i.text,'comparison text');if(!states.has(i.state))throw Error('Invalid comparison state');}}}
  }
  return p;
}
export function createProjectTransfer(project,exportedAt=new Date().toISOString()){
  validateTransferProject(project);date(exportedAt,'export date');
  return {format:TRANSFER_FORMAT,version:TRANSFER_VERSION,transferId:crypto.randomUUID(),exportedAt,project:structuredClone(project)};
}
export function serializeTransfer(value){
  const text=JSON.stringify(value);
  if(new TextEncoder().encode(text).length>MAX_TRANSFER_BYTES)throw Error('Project transfer exceeds 20 MB. Use a smaller project.');
  return text;
}
export function readProjectTransfer(text){
  if(new TextEncoder().encode(text).length>MAX_TRANSFER_BYTES)throw Error('Project transfer exceeds 20 MB');
  let value;try{value=JSON.parse(text);}catch{throw Error('This is not a valid JSON project file');}
  if(!object(value)||value.format!==TRANSFER_FORMAT)throw Error('Choose a Recap project file, not a workspace backup');
  if(value.version!==TRANSFER_VERSION)throw Error('Unsupported project format version. Update Recap before importing.');
  string(value.transferId,'transfer ID');date(value.exportedAt,'export date');validateTransferProject(value.project);return value;
}
export function importProjectTransfer(workspace,transfer){
  // Validate at the mutation boundary even when a caller bypasses the preview reader.
  const checked=readProjectTransfer(serializeTransfer(transfer));
  if(workspace.projects.some(p=>p.transfer?.id===checked.transferId))throw Error('This exact transfer is already imported');
  const project=structuredClone(checked.project);
  const originalProjectId=project.transfer?.originalProjectId||project.id;
  project.id=crypto.randomUUID();project.name+=' (imported)';
  project.transfer={id:checked.transferId,originalProjectId,exportedAt:checked.exportedAt,importedAt:new Date().toISOString()};
  const next={...workspace,selected:project.id,projects:[...workspace.projects,project]};
  if(new TextEncoder().encode(JSON.stringify(next)).length>MAX_TRANSFER_BYTES-1024)throw Error('Import would exceed the workspace limit. Download backups and free space first.');
  return {workspace:next,project};
}

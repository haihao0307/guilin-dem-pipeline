export const VIEW_REVISION='left-fullscreen-r05';
export const DEFAULT_VIEWS=Object.freeze({landscape:{position:[5,23,37],target:[-2.2,2.8,1],zoom:1.06},portrait:{position:[32.92048,22.17643,14.09967],target:[-6.87952,-0.32357,0.09967],zoom:.86}});
const MODES=['landscape','portrait'];
const clone=p=>structuredClone(p);
export function validView(p){return !!p&&[p.position,p.target].every(a=>Array.isArray(a)&&a.length===3&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<500))&&Number.isFinite(p.zoom)&&p.zoom>=.4&&p.zoom<=3;}
const normalize=p=>({position:p.position.slice(),target:p.target.slice(),zoom:p.zoom,manual:!!p.manual,locked:!!p.locked});
export const defaultView=mode=>({...clone(DEFAULT_VIEWS[mode]),manual:false,locked:false});
function archiveBackup(data,mode,p){if(!validView(p))return;const history=data.archivedBackups[mode]||(data.archivedBackups[mode]=[]),entry=normalize(p);if(!history.some(v=>JSON.stringify(v)===JSON.stringify(entry)))history.push(entry);}
export function prepareViewProfiles(raw){
 let source=null;try{source=typeof raw==='string'&&raw.length<=100000?JSON.parse(raw):raw;}catch{}
 const data={version:1,frameRevision:VIEW_REVISION,layout:MODES.includes(source?.layout)?source.layout:'landscape',profiles:{},backups:{},archivedBackups:{}};
 const supported=source?.version===1;
 for(const mode of MODES){
  const previous=supported&&validView(source.profiles?.[mode])?normalize(source.profiles[mode]):null;
  const backup=supported&&validView(source.backups?.[mode])?normalize(source.backups[mode]):null;
  if(supported&&Array.isArray(source.archivedBackups?.[mode]))for(const p of source.archivedBackups[mode])archiveBackup(data,mode,p);
  if(backup)data.backups[mode]=backup;
  if(supported&&source.frameRevision===VIEW_REVISION){data.profiles[mode]=previous||defaultView(mode);continue;}
  // One migration per release: keep the exact previous user profile before recommending a new frame.
  if(previous){if(backup)archiveBackup(data,mode,backup);data.backups[mode]=previous;}
  data.profiles[mode]=defaultView(mode);
 }
 return data;
}
export function recommendView(data,mode){const p=data.profiles[mode];if(p&&(p.manual||p.locked)){if(data.backups[mode])archiveBackup(data,mode,data.backups[mode]);data.backups[mode]=clone(p);}data.profiles[mode]=defaultView(mode);}
export function restoreView(data,mode){if(!validView(data.backups[mode]))return false;data.profiles[mode]=clone(data.backups[mode]);delete data.backups[mode];return true;}

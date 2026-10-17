import {CAMERA_PRESET_IDS, getCameraPreset} from './camera-presets.mjs';
export const VIEW_STORAGE_KEY='kaopu.train-driver.r16.views.v1';
export const VIEW_REVISION='flat-platform-r09';
const MODES=['landscape','portrait'];
const clone=p=>structuredClone(p);
const poseOnly=({position,target,zoom,projection,presetId,focus})=>({position,target,zoom,...(projection?{projection}:{}),presetId,focus});
export const DEFAULT_VIEWS=Object.freeze(Object.fromEntries(MODES.map(mode=>[mode,Object.freeze(poseOnly(getCameraPreset('platform',mode)))])));
export function validView(p){return !!p&&[p.position,p.target].every(a=>Array.isArray(a)&&a.length===3&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<500))&&Number.isFinite(p.zoom)&&p.zoom>=.4&&p.zoom<=3;}
const normalize=p=>({position:p.position.slice(),target:p.target.slice(),zoom:p.zoom,manual:!!p.manual,locked:!!p.locked,...(p.projection?.kind==='horizontal'&&Number.isFinite(p.projection.referenceAspect)&&p.projection.referenceAspect>=.5&&p.projection.referenceAspect<=4?{projection:{kind:'horizontal',referenceAspect:p.projection.referenceAspect}}:{}),...(CAMERA_PRESET_IDS.includes(p.presetId)?{presetId:p.presetId}:{}),...(CAMERA_PRESET_IDS.includes(p.focus)?{focus:p.focus}:{})});
export const defaultView=mode=>({...clone(DEFAULT_VIEWS[MODES.includes(mode)?mode:'landscape']),manual:false,locked:false});
function archiveBackup(data,mode,p){if(!validView(p))return;const history=data.archivedBackups[mode]||(data.archivedBackups[mode]=[]),entry=normalize(p);if(!history.some(v=>JSON.stringify(v)===JSON.stringify(entry)))history.push(entry);}
function saveBackup(data,mode,p){if(data.backups[mode])archiveBackup(data,mode,data.backups[mode]);data.backups[mode]=clone(p);}
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
  // Only data supplied from the R09 key is considered. R08 is never read/mutated.
  if(previous)saveBackup(data,mode,previous);
  data.profiles[mode]=defaultView(mode);
 }
 return data;
}
export function recommendView(data,mode){const p=data.profiles[mode];if(p&&(p.manual||p.locked||JSON.stringify(normalize(p))!==JSON.stringify(normalize(defaultView(mode))))){if(!p.presetId||!data.backups[mode])saveBackup(data,mode,p);}data.profiles[mode]=defaultView(mode);}
export function selectCameraPreset(data,id,mode=data.layout){
 const preset=getCameraPreset(id,mode),previous=data.profiles[mode];
 if(!preset||!previous||previous.locked)return false;
 // Cycling through presets must not replace the user's original manual view.
 if(!previous.presetId||!data.backups[mode])saveBackup(data,mode,previous);
 data.profiles[mode]={...poseOnly(preset),manual:true,locked:false};
 return true;
}
export function restoreView(data,mode){if(!validView(data.backups[mode]))return false;data.profiles[mode]=clone(data.backups[mode]);delete data.backups[mode];return true;}

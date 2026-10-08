/** R02 authored native phenotype/local-field recipes. The deformation engine,
 * rig, head transfer, original 36 and neutral GNM identity/expression stay intact.
 * Face-specific local fields are necessary: native global weight barely changes
 * cheek/jaw width. Mouth-corner probe limits cheek-volume to .20 for adults,
 * .12 for children. Child profiles never use hollow cheeks or bony adult jaws. */
import{PRESETS as ORIGINAL,STAGES,createPresetState as oldState,presetRecord as oldRecord}from'./PresetCatalogueV1.mjs';
export{STAGES};export const PRESET_SCHEMA='kaopu-human-preset/2';
export const LEGACY_PRESETS=Object.freeze(ORIGINAL.map(p=>Object.freeze({...p,collection:'r01',previewFolder:'presets-r01'})));
const builds=['short-slim','tall-slim','tall-sturdy','short-heavy','rounded','sturdy'];
const names=['窄脸 · 矮个纤瘦','长脸 · 高个骨感','宽颌 · 高个健壮','厚脸 · 矮个丰厚','圆脸 · 饱满圆润','方颌 · 结实体格'];
const childNames=['小巧 · 纤细儿童','清秀 · 高个儿童','宽脸 · 高个结实','圆颊 · 小个厚实','软圆脸 · 圆润儿童','饱满脸 · 结实儿童'];
const teenNames=['窄脸 · 小个清瘦','长脸 · 高个清瘦','宽脸 · 高个健壮','圆颊 · 小个厚实','圆脸 · 饱满少年','宽颌 · 结实少年'];
const symmetric=(out,key,v)=>{out['l-'+key]=v;out['r-'+key]=v;};
// Native face values: fat, cheeks, cheekbones, head width, chin width, chin
// height, chin prominence, neck circumference, double chin. Positive chin-bones
// mainly drops the jaw instead of widening it, so it is used only at <= .10.
const faceRows=[[-.40,-.28,.22,-.09,-.06,.03,.04,-.16,0],[-.50,-.35,.30,-.14,-.10,.10,.08,-.22,0],[.03,.08,.18,.10,.12,.025,.04,.20,0],[.67,.18,-.10,.12,.10,-.06,-.035,.30,.28],[.82,.20,-.13,.15,.10,-.08,-.04,.36,.38],[.12,.13,.22,.13,.12,.02,.06,.25,.035]];
const childFaceRows=[[.06,.07,0,-.04,0,.02],[.03,.04,-.015,-.02,0,.025],[.12,.10,.06,-.02,.03,.08],[.17,.11,.07,-.04,.025,.08],[.20,.12,.10,-.055,.04,.10],[.11,.09,.045,-.025,.025,.07]];
function face(i,stage){const out={};if(stage==='child'){const[f,c,w,h,cw,n]=childFaceRows[i];Object.assign(out,{'head-fat-incr':f,'head-scale-horiz-incr':w,'chin-height-incr':h,'chin-width-incr':cw,'measure-neck-circ-incr':n});symmetric(out,'cheek-volume-incr',c);if(i===3||i===4)out['neck-double-incr']=i===4?.05:.03;return out;}
 const[f,c,b,w,cw,h,p,n,d]=faceRows[i],a=stage==='teen'?.48:stage==='young'?.93:stage==='senior'?.94:1;
 Object.assign(out,{'head-fat-incr':f*a,'head-scale-horiz-incr':w*a,'chin-width-incr':cw*a,'chin-height-incr':h*a,'chin-prominent-incr':p*a,'measure-neck-circ-incr':n*a,'neck-double-incr':d*a});symmetric(out,'cheek-volume-incr',c*a);symmetric(out,'cheek-bones-incr',b*a);
 if(stage==='teen'){if(f<0)out['head-fat-incr']=-.08;if(c<0)symmetric(out,'cheek-volume-incr',-.04);if(b>0)symmetric(out,'cheek-bones-incr',Math.min(.04,b*a));}
 else{if(i<2){if(i===1)symmetric(out,'cheek-inner-incr',-.10);out['chin-bones-incr']=i===1?.10:.04;}else if(i===2||i===5)out['chin-bones-incr']=.08;out['nose-scale-depth-incr']=[-.025,.07,.025,-.025,-.035,.045][i];out['forehead-temple-incr']=i===4?.10:i<2?-.06:.035;}
 if(i===0&&stage!=='teen'){out['head-fat-incr']=-.26*a;symmetric(out,'cheek-volume-incr',-.10*a);symmetric(out,'cheek-bones-incr',.12*a);out['head-scale-horiz-incr']=-.11*a;out['forehead-temple-incr']=-.035;}
 if(stage==='middle')out['head-age-incr']=.10;if(stage==='senior')out['head-age-incr']=.27;return out;}
// Native body values: shoulders, waist, torso depth, hip width, arm fat,
// thigh fat, muscle. No pregnancy/intimate-area controls or arbitrary scaling.
const bodyRows=[[-.12,-.22,-.16,-.08,-.20,-.18,0],[-.14,-.28,-.20,-.09,-.25,-.24,0],[.24,-.035,.04,.035,0,0,.32],[.16,.49,.31,.20,.29,.30,0],[.10,.61,.39,.25,.36,.38,0],[.27,.04,.08,.045,.04,.05,.36]];
function body(i,stage){const out={},gain=stage==='child'?.25:stage==='teen'?.62:stage==='senior'?.87:1,[s,w,d,h,af,lf,m]=bodyRows[i].map(v=>v*gain);Object.assign(out,{'measure-shoulder-dist-incr':s,'measure-waist-circ-incr':w,'torso-scale-depth-incr':d,'hip-scale-horiz-incr':h});symmetric(out,'upperarm-fat-incr',af);symmetric(out,'upperleg-fat-incr',lf);if(m){symmetric(out,'upperarm-shoulder-muscle-incr',m);symmetric(out,'upperleg-muscle-incr',m*.78);out['torso-muscle-dorsi-incr']=m*.75;out['torso-vshape-incr']=m*.6;}if(i===4)out['measure-hips-circ-incr']=.26*gain;if(stage==='child'){out['measure-shoulder-dist-incr']=0;out['torso-scale-depth-incr']=0;for(const k of Object.keys(out))if(k.includes('muscle')||k==='torso-vshape-incr')out[k]=0;}return out;}
const wm={child:[[.30,.30],[.27,.30],[.56,.43],[.87,.30],[.92,.25],[.60,.45]],teen:[[.18,.28],[.16,.32],[.55,.78],[.91,.40],[.95,.24],[.62,.83]],young:[[.08,.18],[.025,.18],[.53,.93],[.98,.30],[1,.12],[.63,1]],adult:[[.075,.17],[.02,.16],[.55,.91],[1,.28],[1,.10],[.66,.96]],middle:[[.07,.14],[.02,.12],[.57,.79],[1,.23],[1,.08],[.68,.82]],senior:[[.085,.10],[.045,.08],[.56,.60],[.97,.18],[1,.06],[.64,.65]]};
const childAges=[.22,.255,.25,.24,.215,.24];
export const PRESETS=Object.freeze(ORIGINAL.map(original=>{const{stage,build}=original,i=builds.indexOf(build),p={...original.phenotypes};[p.weight,p.muscle]=wm[stage][i];if(stage==='child')p.age=childAges[i];const localChanges=Object.fromEntries(Object.entries({...body(i,stage),...face(i,stage)}).map(([k,v])=>[k,Number(v.toFixed(5))]));const buildLabel=(stage==='child'?childNames:stage==='teen'?teenNames:names)[i];return Object.freeze({...original,id:'r02-'+original.id,collection:'r02',previewFolder:'presets-r02',buildLabel,label:`${original.stageLabel} · ${p.gender===1?'女型':'男型'} · ${buildLabel}`,description:`${original.stageLabel}${original.genderLabel}，${buildLabel}。头脂、双颊、颧颌、下巴与颈部使用明确原生参数随体格成组变化。${stage==='child'?'儿童有独立年龄和温和脸颊界限，不使用成人骨感面部配方。':'体重和肌肉使用更宽的原生形态范围。'}这是建模形态标签，不代表精确岁数或体重。`,phenotypes:Object.freeze(p),localChanges:Object.freeze(localChanges),originalPresetId:original.id});}));
export const ALL_PRESETS=Object.freeze([...PRESETS,...LEGACY_PRESETS]);const byId=new Map(ALL_PRESETS.map(p=>[p.id,p]));
export function createPresetState(id,defaults){if(!byId.has(id))throw new RangeError('Unknown preset: '+id);if(!id.startsWith('r02-'))return oldState(id,defaults);const p=byId.get(id),d=typeof defaults==='function'?defaults():defaults;if(!d?.anny?.phenotypes)throw new TypeError('Complete neutral defaults required');const s=structuredClone(d);s.anny.phenotypes={...s.anny.phenotypes,...p.phenotypes};s.anny.localChanges={...p.localChanges};return s;}
export function presetRecord(id,defaults){if(!id.startsWith('r02-'))return oldRecord(id,defaults);const p=byId.get(id);if(!p)throw new RangeError('Unknown preset');return{schema:PRESET_SCHEMA,presetId:p.id,label:p.label,stage:p.stage,build:p.build,collection:'r02',originalPresetId:p.originalPresetId,parameterSource:'anny-native-phenotypes-and-explicit-local-shapes',fittingStatus:'unfitted-preset',calibration:{chronologicalAge:null,height:null,bodyMass:null},childSafetyProfile:p.stage==='child'?'independent-child-cheek-and-jaw-limits':null,state:createPresetState(id,defaults)};}

import {attachNaturalEyeMaterial} from './NaturalEyeShader.mjs';
export const EYE_SCHEMA='kaopu/natural-eyes@2';
export const DEFAULT_EYE=Object.freeze({source:0,irisScale:1,pupil:.39,brightness:1,tint:'#776044',tintAmount:0,innerColor:'#927340',innerAmount:0,scleraWhite:.28,yellow:.035,redness:.06,veinAmount:.38,veinDensity:.65,limbal:.28,rotation:0,contrast:1,wetness:.68,corneaRoughness:.075,scleraRoughness:.29,parallax:.45,limbusWidth:.12,limbusSoftness:.065,pupilFeather:.008,vesselSoftness:.38,contactShadow:.55,tearWetness:.48});
export const EYE_RANGES=Object.freeze({source:[0,1],irisScale:[.86,1.13],pupil:[.22,.62],brightness:[.55,1.45],tintAmount:[0,1],innerAmount:[0,1],scleraWhite:[0,1],yellow:[0,1],redness:[0,1],veinAmount:[0,1],veinDensity:[0,1],limbal:[0,1],rotation:[-180,180],contrast:[.65,1.45],wetness:[0,1],corneaRoughness:[.04,.24],scleraRoughness:[.16,.60],parallax:[0,1],limbusWidth:[.03,.24],limbusSoftness:[.015,.16],pupilFeather:[.003,.035],vesselSoftness:[0,1],contactShadow:[0,1],tearWetness:[0,1]});
export const NATURAL_PRESETS=Object.freeze({
 harveyHazel:{label:'Harvey 01 · 灰绿榛色原纹',values:{source:0,tintAmount:0,innerAmount:0,brightness:1,contrast:1}},
 harveyBlue:{label:'Harvey 02 · 蓝灰原纹',values:{source:1,tintAmount:0,innerAmount:0,brightness:.88,contrast:.9}},
 darkBrown:{label:'深棕',values:{source:0,tint:'#64452f',tintAmount:.94,innerColor:'#765438',innerAmount:.18,brightness:.86}},
 lightBrown:{label:'浅棕',values:{source:0,tint:'#967343',tintAmount:.9,innerColor:'#977341',innerAmount:.23,brightness:1.08}},
 olive:{label:'橄榄绿',values:{source:0,tint:'#64735b',tintAmount:.65,innerColor:'#9c793b',innerAmount:.32,brightness:.95}},
 slate:{label:'自然灰蓝',values:{source:1,tint:'#607887',tintAmount:.82,innerColor:'#7d7862',innerAmount:.22,brightness:.94,contrast:.82}}
});
export function validateEye(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('眼球参数必须为对象');
 const out={...DEFAULT_EYE,...input};
 for(const[k,v]of Object.entries(out)){
  if(!Object.hasOwn(DEFAULT_EYE,k))throw Error('未知眼球参数 '+k);
  if(k==='tint'||k==='innerColor'){if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('虹膜颜色格式无效');}
  else{const[a,b]=EYE_RANGES[k];if(!Number.isFinite(v)||v<a||v>b||(k==='source'&&!Number.isInteger(v)))throw Error('眼球参数超出范围 '+k);}
 }return out;
}
export function validateEyes(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('无效眼球档案');
 if(input.schema==='kaopu/natural-eyes@1')input={...input,schema:EYE_SCHEMA};
 for(const k of Object.keys(input))if(!['schema','enabled','reference','autoPupil','illumination','left','right'].includes(k))throw Error('未知眼球档案字段 '+k);
 const out={schema:EYE_SCHEMA,enabled:true,reference:false,autoPupil:false,illumination:.5,...input,left:validateEye(input.left),right:validateEye(input.right)};
 if(out.schema!==EYE_SCHEMA)throw Error('眼球档案版本不兼容');
 for(const k of ['enabled','reference','autoPupil'])if(typeof out[k]!=='boolean')throw Error('无效眼球开关 '+k);
 if(!Number.isFinite(out.illumination)||out.illumination<0||out.illumination>1)throw Error('明暗参数必须在0–1');return out;
}
export function installNaturalEyes(model){
 if(model.naturalEyes)return model.naturalEyes;
 const api={schema:EYE_SCHEMA,settings:validateEyes(),skins:new Set(),disposed:false,revision:0};
 const archive=model.archive.bind(model),restore=model.restore.bind(model),attach=model.faceSurface.attachSkin;
 api.update=()=>{api.revision++;for(const skin of api.skins)skin.updateNaturalEyes?.();};
 api.set=(patch,side='both')=>{if(!['both','left','right','global'].includes(side))throw Error('未知眼球侧别');const next=structuredClone(api.settings);if(side==='global')Object.assign(next,patch);else for(const s of side==='both'?['left','right']:[side])next[s]={...next[s],...patch};api.settings=validateEyes(next);api.update();return structuredClone(api.settings);};
 api.preset=(id,side='both')=>{const p=NATURAL_PRESETS[id];if(!p)throw Error('未知自然眼球预设');return api.set({...DEFAULT_EYE,...p.values},side);};
 api.assign=id=>{let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);const names=['darkBrown','lightBrown','harveyHazel','olive','slate','darkBrown'];api.preset(names[(h>>>0)%names.length]);api.set({rotation:((h>>>8)%17)-8},'left');api.set({rotation:((h>>>16)%17)-8},'right');return structuredClone(api.settings);};
 model.archive=()=>({...archive(),naturalEyes:structuredClone(api.settings)});
 model.restore=o=>{const next=validateEyes(o?.naturalEyes||{}),old=api.settings;try{api.settings=next;const result=restore(o);api.update();return result;}catch(e){api.settings=old;api.update();throw e;}};
 model.faceSurface.attachSkin=skin=>{attach(skin);attachNaturalEyeMaterial(skin,api);};
 api.report=()=>({schema:EYE_SCHEMA,revision:api.revision,settings:structuredClone(api.settings),materials:[...api.skins].filter(s=>!s.disposed).map(s=>s.naturalEyeExtension),canonicalGeometryReplaced:false,irisAppearanceSource:'callharvey3d Harvey_eye1/Harvey_eye2, MakeHuman system_eye_materials03, CC-BY',optics:'bounded shader refraction/parallax and scene-linked finite-source reflection; not volumetric eye simulation',diagnosticMeaning:false});
 model.naturalEyes=api;return api;
}

import {createLipRails} from './LipMath.mjs';
import {attachLipMaterial} from './LipMaterial.mjs';
export const LIP_SCHEMA='kaopu/lip-structure@1';
export const LIP_DEFAULTS=Object.freeze({schema:LIP_SCHEMA,enabled:true,structure:1,upperVolume:.8,lowerVolume:.7,cupid:.75,tubercle:.8,corners:.55,borderSoftness:.48,furrows:.65,pigment:.68,wetness:.35,dryRoughness:.53,eyeSmoothing:.35});
export const LIP_RANGES={structure:[0,1.5],upperVolume:[0,1.5],lowerVolume:[0,1.5],cupid:[0,1.5],tubercle:[0,1.5],corners:[0,1.5],borderSoftness:[0,1],furrows:[0,1.5],pigment:[0,1],wetness:[0,1],dryRoughness:[.35,.75],eyeSmoothing:[0,1]};
export function validateLip(input={}){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('唇部档案必须是对象');const s={...LIP_DEFAULTS,...input};for(const k of Object.keys(s)){if(k==='schema'){if(s[k]!==LIP_SCHEMA)throw Error('唇部档案版本不兼容');}else if(k==='enabled'){if(typeof s[k]!=='boolean')throw Error('唇部开关无效');}else{const r=LIP_RANGES[k];if(!r||!Number.isFinite(s[k])||s[k]<r[0]||s[k]>r[1])throw Error('唇部参数越界：'+k);}}return s;}
export function installLipStructure(model){
 if(model.lipStructure)return model.lipStructure;
 const api={settings:validateLip(),rails:createLipRails(model),skins:new Set(),revision:0},archive=model.archive.bind(model),restore=model.restore.bind(model),attach=model.faceSurface.attachSkin;
 api.update=()=>{api.revision++;for(const skin of api.skins)skin.updateLips?.();};
 api.set=patch=>{api.settings=validateLip({...api.settings,...patch});api.update();return structuredClone(api.settings);};
 model.archive=()=>({...archive(),lipStructure:structuredClone(api.settings)});
 model.restore=o=>{const next=validateLip(o?.lipStructure||{}),old=api.settings;try{api.settings=next;const result=restore(o);api.update();return result;}catch(e){api.settings=old;api.update();throw e;}};
 model.faceSurface.attachSkin=skin=>{attach(skin);attachLipMaterial(skin,api);};
 model.lipStructure=api;return api;
}

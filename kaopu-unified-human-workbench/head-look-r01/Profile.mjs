export const SCHEMA='kaopu/head-look@1';
export const DEFAULTS=Object.freeze({lighting:true,surface:true,exposure:1,environment:.65,key:3,rim:3.5,azimuth:45,elevation:35,detail:.8,colour:.85,roughness:.72,pigment:.7,wetness:.65,scatter:.6,diagnostic:0});
export const LIMITS=Object.freeze({exposure:[.35,2],environment:[0,1.5],key:[0,6],rim:[0,6],azimuth:[-180,180],elevation:[-20,80],detail:[0,1.8],colour:[0,1.6],roughness:[.48,.9],pigment:[0,1.4],wetness:[0,1.2],scatter:[0,1.5],diagnostic:[0,5]});
export function validate(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('外观档案必须是对象');
 const out={...DEFAULTS,...input};
 for(const [k,v] of Object.entries(out)){
  if(!Object.hasOwn(DEFAULTS,k))throw Error('未知外观参数 '+k);
  if(k==='lighting'||k==='surface'){if(typeof v!=='boolean')throw Error('外观开关必须是布尔值');continue;}
  const [lo,hi]=LIMITS[k];if(!Number.isFinite(v)||v<lo||v>hi||(k==='diagnostic'&&!Number.isInteger(v)))throw Error('外观参数越界 '+k);
 }
 return out;
}
export function installHeadLook(model){
 if(model.headLook)return model.headLook;
 const p={schema:SCHEMA,settings:validate()},archive=model.archive.bind(model),restore=model.restore.bind(model);model.headLook=p;
 model.archive=()=>({...archive(),headLook:{schema:SCHEMA,settings:{...p.settings}}});
 model.restore=o=>{const a=o?.headLook;if(a&&a.schema!==SCHEMA)throw Error('外观档案版本不兼容');const next=validate(a?.settings||{}),old=p.settings;p.settings=next;try{const r=restore(o);p.onRestore?.();return r;}catch(e){p.settings=old;p.onRestore?.();throw e;}};
 return p;
}

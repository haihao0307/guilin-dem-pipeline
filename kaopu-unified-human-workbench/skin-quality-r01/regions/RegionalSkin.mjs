import {REGION_VERSION,REGION_SCHEMA,FIELDS,DEFAULTS,validate} from './RegionalRules.mjs';
import {patchRegionalShader} from './RegionalShader.mjs';
export {FIELDS,DEFAULTS};
export function installRegionalSkin(model){
 if(model.regionalSkin)return model.regionalSkin;
 if(!model.faceSurface?.fields?.landmark)throw Error('Native ET13 face fields required');
 const skins=new Set(),api={settings:{...DEFAULTS},skins,version:REGION_VERSION,debug:false};
 const archive=model.archive.bind(model),restore=model.restore.bind(model),attach=model.faceSurface.attachSkin;
 api.set=patch=>{const next=validate({...api.settings,...patch}),recompile=next.enabled!==api.settings.enabled;api.settings=next;for(const skin of skins){skin.regionalExtension.sync();if(recompile)skin.material.needsUpdate=true;skin.viewer.render();}return api.report();};
 api.report=()=>({version:REGION_VERSION,settings:{...api.settings},materials:[...skins].map(s=>s.regionalExtension.report()),limits:{measuredThickness:false,subsurfaceTransportChanged:false,filmQualityAccepted:false,geometryChanged:false,identityMarksAdded:false,clinicalCalibration:false}});
 api.inspect=on=>{api.debug=!!on;for(const s of skins){s.regionalExtension.sync();s.viewer.render();}};
 model.archive=()=>({...archive(),regionalSkin:{schema:REGION_SCHEMA,topology:model.canonical.topologySha256,settings:{...api.settings}}});
 model.restore=record=>{
  const r=record?.regionalSkin;if(r&&(r.schema!==REGION_SCHEMA||r.topology!==model.canonical.topologySha256))throw Error('Incompatible regional skin archive');
  const next=validate(r?.settings||{...DEFAULTS,enabled:false}),prior=api.settings;
  try{const result=restore(record);api.set(next);return result;}catch(e){api.set(prior);throw e;}
 };
 model.faceSurface.attachSkin=skin=>{attach(skin);attachRegionalSkin(skin,api);};
 model.regionalSkin=api;return api;
}
export function attachRegionalSkin(skin,api=installRegionalSkin(skin.viewer.model)){
 if(skin.regionalExtension)return skin.regionalExtension;
 if(!skin.faceExtension)throw Error('Attach FaceSkin first');
 const m=skin.viewer.model,f=m.faceSurface.fields,L=f.landmark(f.rest,31),R=f.landmark(f.rest,35);
 if(![...L,...R].every(Number.isFinite))throw Error('Native nasal alar landmarks invalid');
 const U={uRAla:{value:{x:L[0]*1000,y:L[1]*1000,z:R[0]*1000,w:R[1]*1000}},uRLipFiltering:{value:1},uRDebug:{value:0}};
 for(const[k]of FIELDS)U['uR'+k[0].toUpperCase()+k.slice(1)]={value:api.settings[k]};
 const before=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material),dispose=skin.dispose.bind(skin);
 const ext={compiles:0,disposed:false,sync(){U.uRLipFiltering.value=api.settings.lipFiltering?1:0;U.uRDebug.value=api.debug?1:0;for(const[k]of FIELDS)U['uR'+k[0].toUpperCase()+k.slice(1)].value=api.settings[k];},report(){return{version:REGION_VERSION,compiles:this.compiles,disposed:this.disposed,alaRestMM:[...L.slice(0,2),...R.slice(0,2)].map(x=>x*1000),newTextures:0,newGeometry:0,eyeMaterialGate:'skin type < 0.5, original face coverage'}}};
 skin.regionalExtension=ext;api.skins.add(skin);
 skin.material.customProgramCacheKey=()=>key()+'/'+REGION_VERSION+'/'+(api.settings.enabled?'regions':'baseline');
 skin.material.onBeforeCompile=shader=>{before(shader);Object.assign(shader.uniforms,U);if(api.settings.enabled&&!ext.disposed)shader.fragmentShader=patchRegionalShader(shader.fragmentShader);ext.compiles++;};
 skin.dispose=()=>{ext.disposed=true;api.skins.delete(skin);dispose();};ext.sync();skin.material.needsUpdate=true;skin.viewer.render();return ext;
}
export function mountRegionalControls(api,root=document.getElementById('control-shell')){
 if(!root)throw Error('Native control shell missing');root.querySelector('#regionalSkinPanel')?.remove();
 const p=document.createElement('section');p.id='regionalSkinPanel';p.style.cssText='padding:12px;color:#e9eeee;background:#24333b;font:13px system-ui';
 p.innerHTML='<b>五官区域材质 R02 · 候选</b><p>同一原生人物；系数为艺术控制，未做厚度透光。</p><button data-r-toggle>对照开关</button> <button data-r-mask>查看区域</button><label style="display:block;padding:8px 0">原唇沟像素过滤 <input type="checkbox" data-r-filter></label>'+FIELDS.map(([k,label,lo,hi,step])=>`<label style="display:block;margin:8px 0">${label}<input style="width:100%" type="range" data-r="${k}" min="${lo}" max="${hi}" step="${step}"><output data-r-value="${k}"></output></label>`).join('');
 const sync=()=>{for(const[k]of FIELDS){p.querySelector(`[data-r="${k}"]`).value=api.settings[k];p.querySelector(`[data-r-value="${k}"]`).textContent=api.settings[k].toFixed(2);}p.querySelector('[data-r-filter]').checked=api.settings.lipFiltering;p.querySelector('[data-r-toggle]').textContent=api.settings.enabled?'区域材质开：点击回退':'区域材质关：点击启用';};
 for(const el of p.querySelectorAll('[data-r]'))el.oninput=()=>{api.set({[el.dataset.r]:+el.value});sync();};p.querySelector('[data-r-filter]').onchange=e=>api.set({lipFiltering:e.target.checked});p.querySelector('[data-r-toggle]').onclick=()=>{api.set({enabled:!api.settings.enabled});sync();};p.querySelector('[data-r-mask]').onclick=()=>api.inspect(!api.debug);root.prepend(p);sync();return{sync,dispose:()=>p.remove()};
}

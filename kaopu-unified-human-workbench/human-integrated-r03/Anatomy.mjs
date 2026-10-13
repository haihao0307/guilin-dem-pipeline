import * as THREE from '../full/source/registration-vendor/three.module.js';
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const S=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(10+t*(6*t-15));};
export const SHAPE_KEYS=['zygoma','malar','buccal','masseter','jaw','temple','brow','vault'];
export const DEFAULTS=Object.freeze({enabled:true,zygoma:.65,malar:.38,buccal:.45,masseter:.40,jaw:.42,temple:.26,brow:.28,vault:.15,pores:.85,poreScale:1,regional:1,oil:.28,scatter:.40,diagnostic:0});
export function validate(input={}){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('结构档案必须是对象');const s={...DEFAULTS,...input};for(const[k,v]of Object.entries(s)){if(!(k in DEFAULTS))throw Error('未知结构参数 '+k);if(k==='enabled'){if(typeof v!=='boolean')throw Error('无效结构开关');continue;}const lo=k==='poreScale'?.65:0,hi=k==='diagnostic'?5:k==='poreScale'?1.8:k==='pores'?1.5:1;if(!Number.isFinite(v)||v<lo||v>hi||(k==='diagnostic'&&!Number.isInteger(v)))throw Error('结构参数越界 '+k);}return s;}
export function installAnatomy(model){if(model.regionalFace)return;const api={schema:'kaopu/unified-regional-face@1',settings:validate()},archive=model.archive.bind(model),restore=model.restore.bind(model);model.regionalFace=api;model.archive=()=>({...archive(),regionalFace:{schema:api.schema,settings:{...api.settings}}});model.restore=o=>{const p=o?.regionalFace;if(p&&p.schema!==api.schema)throw Error('面部分区版本不兼容');const next=validate(p?.settings||{}),old=api.settings;api.settings=next;try{const result=restore(o);api.onRestore?.();return result;}catch(e){api.settings=old;throw e;}};}
const G=(x,y,z,cx,cy,cz,sx,sy,sz)=>Math.exp(-(((Math.abs(x)-cx)/sx)**2+((y-cy)/sy)**2+((z-cz)/sz)**2));
/** Native template metres: broad overlapping anatomical envelopes, NOT muscle
 * fibers drawn on skin. Coefficients are artistic increments, not measurements. */
export function zones(x,y,z){return [
 G(x,y,z,.049,.292,.047,.018,.014,.038),
 G(x,y,z,.035,.273,.060,.020,.023,.035),
 G(x,y,z,.047,.249,.045,.017,.023,.033),
 G(x,y,z,.065,.240,.009,.018,.031,.032),
 G(x,y,z,.062,.216,.004,.020,.018,.043),
 G(x,y,z,.066,.328,.015,.015,.028,.043),
 G(x,y,z,.023,.327,.058,.025,.014,.039),
 Math.exp(-(((y-.370)/.051)**2))*S(.311,.350,y)
 ];}
export function protection(x,y,z,type=0,ear=0){if(type>=.5||ear>0||y<=.203)return 0;let m=S(.203,.222,y)*(1-S(.082,.090,Math.abs(x)));for(const cx of [-.031,.031])m*=S(1,1.75,((x-cx)/.0193)**2+((y-.301)/.0105)**2);m*=S(1,1.9,(x/.0290)**2+((y-.232)/.0170)**2);const front=S(-.034,.026,z);return m*Math.max(front,S(.327,.360,y));}
export function displacement(x,y,z,s,type=0,ear=0){const m=protection(x,y,z,type,ear);if(!m||!s.enabled)return 0;const r=zones(x,y,z);return clamp(m*(.0031*s.zygoma*r[0]+.0021*s.malar*r[1]-.0020*s.buccal*r[2]+.0027*s.masseter*r[3]+.0017*s.jaw*r[4]-.0019*s.temple*r[5]+.00125*s.brow*r[6]+.0012*s.vault*r[7]),-.003,.0045);}
export class AnatomySurface{
 constructor(source){this.source=source;this.geometry=source.clone();this.reference=source.attributes.fRest.array;this.weights=new Float32Array(source.attributes.position.count);this.lastKey='';this.delta=new Float32Array(this.weights.length);this.baseNormals=new Float32Array(this.weights.length*3);}
 update(s){const src=this.source,g=this.geometry,P=src.attributes.position.array,N=src.attributes.normal.array,Q=g.attributes.position.array,R=this.reference,T=src.attributes.csType.array,E=src.attributes.eOwned?.array;Q.set(P);g.computeVertexNormals();this.baseNormals.set(g.attributes.normal.array);const key=SHAPE_KEYS.map(k=>s[k]).join('|')+'|'+s.enabled;let changed=0,max=0;
 if(key!==this.lastKey){for(let i=0;i<T.length;i++){this.weights[i]=protection(R[i*3],R[i*3+1],R[i*3+2],T[i],E?.[i]||0);this.delta[i]=displacement(R[i*3],R[i*3+1],R[i*3+2],s,T[i],E?.[i]||0);}this.lastKey=key;}
 for(let i=0;i<T.length;i++){const d=this.delta[i];if(!d)continue;for(let k=0;k<3;k++)Q[i*3+k]+=N[i*3+k]*d;max=Math.max(max,Math.abs(d)*1000);changed++;}
 if(src.attributes.color){g.attributes.color.array.set(src.attributes.color.array);g.attributes.color.needsUpdate=true;}
 for(const name of ['l19State','l19Detail','eTissue'])if(src.attributes[name]){if(!g.attributes[name]||g.attributes[name].array.length!==src.attributes[name].array.length)g.setAttribute(name,src.attributes[name].clone());else g.attributes[name].array.set(src.attributes[name].array);g.attributes[name].needsUpdate=true;}
 g.attributes.position.needsUpdate=true;g.computeVertexNormals();const QN=g.attributes.normal.array;for(let i=0;i<T.length;i++)if(!this.weights[i]||!s.enabled){QN[i*3]=N[i*3];QN[i*3+1]=N[i*3+1];QN[i*3+2]=N[i*3+2];}else{let x=N[i*3]+QN[i*3]-this.baseNormals[i*3],y=N[i*3+1]+QN[i*3+1]-this.baseNormals[i*3+1],z=N[i*3+2]+QN[i*3+2]-this.baseNormals[i*3+2];const l=Math.hypot(x,y,z)||1;QN[i*3]=x/l;QN[i*3+1]=y/l;QN[i*3+2]=z/l;}g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();this.report={version:'REGIONAL-FACE-R03',changedVertices:changed,maxNormalIncrementMM:max,regions:SHAPE_KEYS,bodyAndOralAndPinnaProtected:true,extraMeshes:0,underSkinAnatomyMesh:false,method:'overlapping native-rest anatomical envelopes; normal-space millimetre display increments',muscleSimulation:false};return g;
 }
 dispose(){this.geometry.dispose();}
}

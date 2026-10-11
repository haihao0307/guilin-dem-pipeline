import {TRAIT_SCHEMA,TRAIT_DEFAULTS,SHAPE_DEFAULTS,validateTraits,validateShape} from './TraitSchema.mjs';
import {paintTraitMaps} from './TraitMaps.mjs';
import {fairUpperLids} from './LidFairing.mjs';
import {point,sub,dot,cross,unit,clamp,smooth} from '../face-transfer/FaceFields.mjs';
import {makeSpline} from '../eye-transfer/EyelidKnowledge.mjs';
export function installIdentity(model){
 if(model.identityLab)return model.identityLab;
 const priorCompute=model.compute.bind(model),priorArchive=model.archive.bind(model),priorRestore=model.restore.bind(model),fields=model.faceSurface.fields;
 const api={schema:TRAIT_SCHEMA,traits:{...TRAIT_DEFAULTS},shape:{...SHAPE_DEFAULTS},maps:null,mapSignature:'',skins:new Set(),before:new Float32Array(model.positions.length),report:null,disposed:false};
 function maps(){const key=JSON.stringify(api.traits);if(key===api.mapSignature)return;const old=api.maps;api.maps=paintTraitMaps(api.traits);api.mapSignature=key;for(const skin of api.skins)skin.updateIdentity?.();old?.dispose();}
 const landmark=(p,i)=>fields.landmark(p,i),mid=(a,b)=>a.map((v,i)=>(v+b[i])*.5);
 function apply(){
  const p=model.positions;api.before.set(p);const before=api.before,s=api.shape,B=model.bodyCount,L=i=>landmark(before,i),eyes=mid(L(39),L(42)),nose=L(30),chin=L(8),x=unit(sub(L(45),L(36)));let up=sub(L(27),chin);up=unit(up.map((v,i)=>v-x[i]*dot(up,x)));let front=unit(cross(x,up));if(dot(front,sub(nose,eyes))<0)front=front.map(v=>-v);
  const project=(p,origin)=>{const d=sub(p,origin);return[dot(d,x),dot(d,up),dot(d,front)];},root=L(27),tip=L(30),span=Math.max(.012,dot(sub(root,tip),up)),scale=clamp(Math.hypot(...sub(L(45),L(36)))/.088,.40,1.9);
  const eyeInfo=[{u:[39,38,37,36],l:[39,40,41,36]},{u:[42,43,44,45],l:[42,47,46,45]}].map(e=>{
   const start=L(e.u[0]),end=L(e.u[3]),axis=unit(sub(end,start)),width=Math.hypot(...sub(end,start)),proj=p=>{const q=sub(p,start);return[dot(q,axis),dot(q,up)];};
   const curve=ids=>{const q=ids.map(i=>proj(L(i)));return makeSpline([[0,q[0][1]],[clamp(q[1][0]/width,.12,.48),q[1][1]],[clamp(q[2][0]/width,.52,.88),q[2][1]],[1,q[3][1]]]);};const upper=curve(e.u),lower=curve(e.l);return{proj,width,upper,gate:smooth(.0003,.0045*scale,upper(.5)-lower(.5))};
  });
  let max=0,affected=0,noseVertices=0,lidVertices=0;
  for(let i=B;i<model.vertexCount;i++){
   if(fields.a[i*4]<.04)continue;const P=point(before,i),q=project(P,root),t=-q[1]/span,noseMask=fields.a[i*4+3];let d=0;
   if(noseMask>.02&&t>0&&t<.88&&s.bridgeMM){d+=s.bridgeMM*.001*scale*noseMask*Math.sin(Math.PI*t/.88)**2*Math.exp(-Math.pow(q[0]/(.011*scale),2));noseVertices++;}
   if(s.crease)for(const e of eyeInfo){const q=e.proj(P),u=q[0]/e.width;if(u<.04||u>.96)continue;const distance=q[1]-e.upper(u);if(distance<.0012*scale||distance>.0075*scale)continue;
    const band=smooth(.0012*scale,.0020*scale,distance)*(1-smooth(.006,.0075,distance/scale)),arc=Math.sin(Math.PI*u)**.8,mask=fields.a[i*4+2]*band*arc*e.gate;
    if(mask<.005)continue;let displacement=0;
    if(s.crease<0){displacement=0;} // Bounded whole-band fairing follows below.
    else{const v=(distance/scale-s.creaseHeightMM*.001)/(s.creaseWidthMM*.001);displacement=-.00065*scale*s.crease*Math.exp(-v*v)+.00018*scale*s.crease*Math.exp(-Math.pow((v+1.7)/1.3,2));}
    d+=clamp(displacement,-.00065*scale,.00045*scale)*mask;lidVertices++;
   }
   if(d){for(let k=0;k<3;k++)p[i*3+k]+=front[k]*d;max=Math.max(max,Math.abs(d));affected++;}
  }
  const fairing=s.crease<0?fairUpperLids(model,before,front,eyeInfo,fields,scale,-s.crease):null;if(fairing){max=Math.max(max,fairing.maxMM/1000);affected+=fairing.changed;lidVertices=fairing.vertices;}
  if(!p.every(Number.isFinite))throw Error('身份层生成非有限几何');maps();for(const skin of api.skins)skin.updateIdentity?.();
  api.report={version:'ET13-I1',shape:{...s},traits:{...api.traits},affectedVertices:affected,noseVertices,lidVertices,fairing,maxAddedDisplacementMM:max*1000,bodyAddedDisplacementMM:0,controlTopologyUnchanged:true,nativeGeneratorPreserved:true,field:api.maps.report,closure:'crease correction fades with measured aperture; not new blink physics',clinicalMeaning:false};return p;
 }
 model.compute=input=>{const old=model.positions.slice(),state=model.state;try{priorCompute(input);return apply();}catch(e){try{priorCompute(state);}catch{}model.positions.set(old);model.state=state;throw e;}};
 model.archive=()=>({...priorArchive(),faceIdentity:{schema:TRAIT_SCHEMA,topology:model.canonical.topologySha256,traits:{...api.traits},shape:{...api.shape}}});
 model.restore=o=>{
  const extra=o?.faceIdentity;if(extra&&(extra.schema!==TRAIT_SCHEMA||extra.topology!==model.canonical.topologySha256))throw Error('不匹配的面部身份档案');
  const nextT=validateTraits(extra?.traits||{...TRAIT_DEFAULTS,enabled:false}),nextS=validateShape(extra?.shape||SHAPE_DEFAULTS),oldT=api.traits,oldS=api.shape;
  try{api.traits=nextT;api.shape=nextS;return priorRestore(o);}catch(e){api.traits=oldT;api.shape=oldS;throw e;}
 };
 api.set=(values={})=>{for(const k of Object.keys(values))if(!['traits','shape'].includes(k))throw Error('未知身份层字段 '+k);const t=validateTraits({...api.traits,...values.traits}),s=validateShape({...api.shape,...values.shape}),oldT=api.traits,oldS=api.shape;try{api.traits=t;api.shape=s;model.compute(model.state);return api.report;}catch(e){api.traits=oldT;api.shape=oldS;throw e;}};
 api.measure=()=>{const p=model.positions,L=i=>landmark(p,i),distance=(a,b)=>Math.hypot(...sub(L(a),L(b)))*1000;return{eyeWidthRightMM:distance(36,39),eyeWidthLeftMM:distance(42,45),intercanthalMM:distance(39,42),alarWidthMM:distance(31,35),mouthWidthMM:distance(48,54),mouthOuterHeightMM:distance(51,57),noseBridge:L(28).map(v=>v*1000),source:'current generated barycentric landmarks, not human measurement'};};
 api.dispose=()=>{api.disposed=true;api.maps?.dispose();api.skins.clear();};model.identityLab=api;apply();return api;
}

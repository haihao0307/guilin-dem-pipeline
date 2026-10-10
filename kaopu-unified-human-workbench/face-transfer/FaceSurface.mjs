import {createFaceFields,surfaceNormals,point,sub,dot,cross,unit,clamp,smooth} from './FaceFields.mjs';
export const FACE_SCHEMA='kaopu/native-face-surface@1';
export const FACE_DEFAULTS=Object.freeze({enabled:true,structure:.75,detail:1,meso:.75,colorDetail:.5,pigment:0,blood:.35,oil:.55,wrap:.28,diffusion:.42,radius:.85,layer:'beauty'});
export function validateFace(input={}){if(typeof input!=='object'||input===null||Array.isArray(input))throw Error('Invalid face settings');const s={...FACE_DEFAULTS,...input};for(const k of Object.keys(s))if(!(k in FACE_DEFAULTS))throw Error('Unknown face setting '+k);if(typeof s.enabled!=='boolean')throw Error('Face enabled must be boolean');for(const k of ['structure','detail','meso','colorDetail','blood','oil','wrap'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1.5)throw Error('Face range invalid '+k);for(const k of ['diffusion','pigment'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1)throw Error('Face range invalid '+k);if(!Number.isFinite(s.radius)||s.radius<.2||s.radius>2)throw Error('Face diffusion radius invalid');if(!['beauty','color','normal','roughness','regions'].includes(s.layer))throw Error('Unknown face view');return s;}
export function installFaceSurface(model){
 if(model.faceSurface)return model.faceSurface;
 const fields=createFaceFields(model),before=new Float32Array(model.positions.length),compute=model.compute.bind(model),archive=model.archive.bind(model),restore=model.restore.bind(model),N=model.vertexCount,B=model.bodyCount;
 const api={schema:FACE_SCHEMA,settings:{...FACE_DEFAULTS},fields,before,skins:new Set(),updates:0,report:null,attachSkin:null};
 const sample=(p,i)=>fields.landmark(p,i),g=(v,s)=>Math.exp(-((v/s)**2)),mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
 function apply(){
  const p=model.positions;before.set(p);const s=api.settings,n=surfaceNormals(p,model.faces),delta=new Float32Array(N),a=fields.a,b=fields.b;
  const L=i=>sample(before,i),mouthL=L(48),mouthR=L(54),upper=L(51),lower=L(57),nose=L(33),chin=L(8),bridge=L(27),width=Math.hypot(...sub(mouthR,mouthL)),scale=clamp(width/.048,.40,1.8),x=unit(sub(mouthR,mouthL));let up=sub(bridge,chin);up=unit(up.map((v,k)=>v-x[k]*dot(up,x)));let front=unit(cross(x,up));if(dot(front,sub(L(30),upper))<0)front=front.map(v=>-v);
  const project=p=>{const d=sub(p,upper);return[dot(d,x),dot(d,up),dot(d,front)];},u=project(upper),lo=project(lower),ns=project(nose),ml=project(mouthL),mr=project(mouthR),ala=[project(L(31)),project(L(35))];
  const maturity=smooth(.22,.70,model.state?.anny?.phenotypes?.age??.66),mouthGap=Math.hypot(...sub(upper,lower)),closedGate=1-smooth(.022,.042,mouthGap/scale);
  const curveDistance=(q,side)=>{const start=ala[side],end=side?mr:ml,bend=[start[0]+(side?1:-1)*.004*scale,(start[1]+end[1])*.55];let d=Infinity;for(let j=0;j<=12;j++){const t=j/12,xx=(1-t)**2*start[0]+2*(1-t)*t*bend[0]+t*t*end[0],yy=(1-t)**2*start[1]+2*(1-t)*t*bend[1]+t*t*end[1];d=Math.min(d,Math.hypot(q[0]-xx,q[1]-yy));}return d;};
  const regionMax={philtrum:0,nasolabial:0,lipBorder:0,alar:0,chin:0};
  if(s.enabled&&s.structure)for(let i=B;i<N;i++){
   const mask=a[i*4];if(mask<.02)continue;const P=point(before,i),q=project(P),normal=point(n,i),f=smooth(.05,.60,dot(normal,front));if(!f)continue;
   const lp=a[i*4+1],noseWeight=a[i*4+3],cheek=b[i*4+1],chinWeight=b[i*4+3],dY=ns[1]-u[1];
   const philtrumGate=dY>.001?smooth(0,.2,(q[1]-u[1])/dY)*(1-smooth(.75,1,(q[1]-u[1])/dY)):0;
   const philtrum=(.00015*(g(q[0]-.0032*scale,.0014*scale)+g(q[0]+.0032*scale,.0014*scale))-.00009*g(q[0],.0018*scale))*philtrumGate*closedGate;
   const fold=-.00022*maturity*g(Math.min(curveDistance(q,0),curveDistance(q,1)),.0019*scale)*cheek;
   const lip=.00013*Math.sin(Math.PI*lp)*closedGate*g(q[0],width*.6);
   let alar=0;for(const c of ala)alar-=.00012*g(q[0]-c[0],.0022*scale)*g(q[1]-c[1],.003*scale)*noseWeight;
   const mental=-.00015*g(q[1]-(lo[1]-.006*scale),.0028*scale)*g(q[0],width*.34)*chinWeight*closedGate;
   for(const[k,v]of Object.entries({philtrum,nasolabial:fold,lipBorder:lip,alar,chin:mental}))regionMax[k]=Math.max(regionMax[k],Math.abs(v)*scale*s.structure*mask*f*1000);
   delta[i]=(philtrum+fold+lip+alar+mental)*scale*s.structure*mask*f;
  }
  // Smooth displacement only, never the native identity mesh or eye/jaw topology.
  for(let it=0;it<2;it++){const old=delta.slice();for(let i=B;i<N;i++){const ns=fields.adjacency[i];if(!ns.size||a[i*4]<.02)continue;let avg=0;for(const j of ns)avg+=old[j];delta[i]=old[i]*.8+avg/ns.size*.2;}}
  let affected=0,max=0;for(let i=B;i<N;i++)if(Math.abs(delta[i])>1e-10){const d=clamp(delta[i],-.00055*scale,.00055*scale);for(let k=0;k<3;k++)p[i*3+k]+=n[i*3+k]*d;affected++;max=Math.max(max,Math.abs(d));}
  if(!p.every(Number.isFinite))throw Error('Nonfinite face composition');api.updates++;api.report={version:'ET12-F1',updates:api.updates,enabled:s.enabled,settings:{...s},fields:fields.report,affectedNativeVertices:affected,maxGeometryDeltaMM:max*1000,regionalRequestedMaxMM:regionMax,originalBodyUnchanged:true,eyeLayerRetained:true,originalHeadIdentityAndRigRetained:true,restCoordinatesStable:true,donorIdentityMeshImported:false,clinicalRecovery:false};for(const skin of api.skins)skin.updateFace?.();return p;
 }
 model.compute=input=>{const old=model.positions.slice(),state=model.state;try{compute(input);return apply();}catch(e){try{compute(state);}catch{}model.positions.set(old);model.state=state;throw e;}};
 model.archive=()=>({...archive(),faceSurface:{schema:FACE_SCHEMA,topology:model.canonical.topologySha256,settings:{...api.settings}}});
 model.restore=o=>{const old=api.settings,extra=o?.faceSurface;if(extra&&(extra.schema!==FACE_SCHEMA||extra.topology!==model.canonical.topologySha256))throw Error('Wrong full-face archive');const next=validateFace(extra?.settings||{...FACE_DEFAULTS,enabled:false});try{api.settings=next;return restore(o);}catch(e){api.settings=old;throw e;}};
 api.set=v=>{const next=validateFace({...api.settings,...v}),old=api.settings;try{api.settings=next;model.compute(model.state);return api.report;}catch(e){api.settings=old;throw e;}};model.faceSurface=api;apply();return api;
}

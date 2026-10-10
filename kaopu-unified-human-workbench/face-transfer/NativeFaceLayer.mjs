import {installNativeEyeLayer} from '../eye-transfer/NativeEyeLayer.mjs';
export const FACE_SCHEMA='kaopu/native-face-transfer@1';
export const FACE_DEFAULTS=Object.freeze({enabled:true,structure:.85,nose:1,cheeks:.9,mouth:1,chin:.8,ears:.6,micro:1,meso:.8,pigment:.65,regional:1,wrap:.32,mode:'beauty'});
export const FACE_MODES=['beauty','gray','regions','normal','roughness','grid'];
export function validateFaceSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid face settings');const v={...FACE_DEFAULTS,...input};
 for(const k of Object.keys(v)){if(!(k in FACE_DEFAULTS))throw Error('Unknown face parameter '+k);if(k==='enabled'){if(typeof v[k]!=='boolean')throw Error('Invalid face enabled');}else if(k==='mode'){if(!FACE_MODES.includes(v[k]))throw Error('Invalid face display mode');}else if(!Number.isFinite(v[k])||v[k]<0||v[k]>1.5)throw Error('Face parameter outside [0,1.5]: '+k);}return v;
}
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const G=(x,w)=>Math.exp(-(x*x)/(w*w)),P=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]],D=(a,b)=>Math.hypot(...a.map((x,j)=>x-b[j]));
export function hashArray(a){let h=2166136261;const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(const x of b)h=Math.imul(h^x,16777619);return(h>>>0).toString(16);}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function normalField(p,f){const n=new Float32Array(p.length);for(let k=0;k<f.length;k+=3){const a=f[k]*3,b=f[k+1]*3,c=f[k+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;for(const i of[a,b,c]){n[i]+=x;n[i+1]+=y;n[i+2]+=z;}}for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}return n;}
/** One-time binding to the existing GNM semantic data and immutable canonical
 * recipes. Neither a photographed identity nor an independent replacement head.
 * Regions, displacement coordinates and material coordinates share this binding. */
export function bindFaceFields(model){
 const {gnm:g,canonical:c,bodyCount:B,vertexCount:N}=model,skinId=g.meta.materialNames.indexOf('skin');
 if(skinId<0)throw Error('Missing original skin semantics');
 const L=Array.from({length:68},(_,i)=>{const p=[0,0,0];for(let j=0;j<3;j++){const v=g.landmarkIndices[i*3+j],w=g.landmarkWeights[i*3+j];for(let k=0;k<3;k++)p[k]+=g.template[v*3+k]*w;}return p;});
 const fields=new Float32Array(N*4),extra=new Float32Array(N*4),coords=new Float32Array(N*3),offsets=new Float32Array(N*5),protectedVertex=new Uint8Array(N),headSkin=new Uint8Array(N),adj=Array.from({length:N},()=>new Set());
 const noseHalf=(L[35][0]-L[31][0])*.5,lipHalf=(L[54][0]-L[48][0])*.5,philtrumY=(L[33][1]+L[51][1])*.5,cheekY=(L[30][1]+L[48][1])*.5;
 const counts={forehead:0,nose:0,cheeks:0,eyelids:0,lips:0,ears:0,chin:0,protected:0},envelope=[];
 for(let hi=0;hi<c.gnmRecipes.length;hi++){
  const i=B+hi,[a,b,t]=c.gnmRecipes[hi],p=[0,1,2].map(k=>g.template[a*3+k]*(1-t)+g.template[b*3+k]*t),r=g.meta.regionNames[g.regionId[t>.5?b:a]]||'unlabelled';
  coords.set([p[0],p[1]-L[33][1],p[2]-L[33][2]],i*3);
  if(g.materialId[a]!==skinId||g.materialId[b]!==skinId){protectedVertex[i]=1;continue;}headSkin[i]=1;
  const front=smooth((p[2]-.075)/.035),ear=smooth((Math.abs(p[0])-.073)/.017)*(1-smooth((p[1]-.310)/.040))*smooth((p[1]-.180)/.035);
  const head=clamp(front+ear),lip=(r==='upper_lip'||r==='lower_lip')?1:0,thin=r.includes('orbital')?1:0,nose=r==='nose'?1:0,cheek=r.includes('cheek')||r.includes('zygomatic')||r.includes('infraorbital')?1:0,fore=r.includes('brow')||r==='forehead'?1:0,chin=r==='chin'?1:0;
  fields.set([fore*head,nose*head,cheek*head,thin*head],i*4);extra.set([lip*head,ear,chin*head,head],i*4);
  let mouthDistance=Infinity;for(let j=60;j<68;j++)mouthDistance=Math.min(mouthDistance,segmentDistance(p,L[j],L[j===67?60:j+1]));
  const eyeNear=thin||r.includes('brow')||r==='forehead',protect=eyeNear||mouthDistance<.0018||p[2]<.080&&!ear;
  protectedVertex[i]=protect?1:0;if(protect)counts.protected++;
  for(const [key,w]of Object.entries({forehead:fore,nose,cheeks:cheek,eyelids:thin,lips:lip,ears:ear,chin}))if(w>.1)counts[key]++;
  if(protect)continue;
  // Bounded sectional refinements, not a new identity model. Mouth-contact and
  // eyelid-contact vertices are protected and never moved by this whole-face layer.
  const noseBridge=.00019*G(p[0],noseHalf*.36)*G(p[1]-(L[28][1]+L[30][1])*.5,.014);
  const alar=-.00019*(G(p[0]-L[35][0],.0028)+G(p[0]-L[31][0],.0028))*G(p[1]-L[33][1]-.001,.004);
  const nasolabial=Math.min(segmentDistance(p,[L[31][0]-.003,L[31][1]],[L[48][0]-.004,L[48][1]-.003]),segmentDistance(p,[L[35][0]+.003,L[35][1]],[L[54][0]+.004,L[54][1]-.003]));
  const cheekRelief=.00022*(G(p[0]-.043,.012)+G(p[0]+.043,.012))*G(p[1]-cheekY,.020)-.00023*G(nasolabial,.0017);
  const columns=(G(p[0]-.0028,.0013)+G(p[0]+.0028,.0013))*.00020-G(p[0],.0017)*.00012;
  const philtrum=columns*G(p[1]-philtrumY,.006);
  const mentolabial=-.00018*G(p[1]-(L[57][1]-.006),.0026)*G(p[0],lipHalf*.8)+.00016*G(p[1]-(L[57][1]-.016),.006)*G(p[0],lipHalf*.8);
  offsets.set([nose*(noseBridge+alar),cheek*cheekRelief,lip*philtrum,(chin||lip)*mentolabial,0],i*5);
  envelope.push(i);
 }
 for(let k=0;k<model.faces.length;k+=3){const t=Array.from(model.faces.subarray(k,k+3));for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3];if(headSkin[a]&&headSkin[b]){adj[a].add(b);adj[b].add(a);}}}
 // Feather only skin-to-skin. No lip pigment leaking onto teeth or eyeballs.
 for(let pass=0;pass<5;pass++){const a=fields.slice(),b=extra.slice();for(let i=B;i<N;i++){if(!adj[i].size)continue;for(let k=0;k<4;k++){let x=0,y=0;for(const j of adj[i]){x+=a[j*4+k];y+=b[j*4+k];}fields[i*4+k]=a[i*4+k]*.6+x/adj[i].size*.4;extra[i*4+k]=b[i*4+k]*.6+y/adj[i].size*.4;}}}
 // Ear relief preserves the original cartilage folds through a bounded local
 // normal-plane highpass. This does not invent an anatomical ear from scratch.
 const nativeRest=new Float32Array(N*3);for(let i=0;i<N;i++)nativeRest.set([coords[i*3],coords[i*3+1],coords[i*3+2]],i*3);
 const restNormals=normalField(nativeRest,model.faces);
 for(const i of envelope)if(extra[i*4+1]>.01&&adj[i].size){const avg=[0,0,0];for(const j of adj[i])for(let k=0;k<3;k++)avg[k]+=nativeRest[j*3+k]/adj[i].size;const n=P(restNormals,i),q=P(nativeRest,i);offsets[i*5+4]=clamp(q.reduce((v,x,k)=>v+(x-avg[k])*n[k],0)*.14,-.00010,.00010)*extra[i*4+1];}
 return {fields,extra,coords,offsets,protectedVertex,headSkin,envelope,counts,landmarks:L,restHeight:D(L[27],L[8]),hashes:{fields:hashArray(fields),extra:hashArray(extra),coords:hashArray(coords)},source:'native GNM labels + original barycentric recipes; immutable identity-independent rest fields',physicalMetricCalibration:false};
}
export function installNativeFaceLayer(model){
 if(model.faceSurface)return model.faceSurface;installNativeEyeLayer(model);
 const fields=bindFaceFields(model),compute=model.compute.bind(model),archive=model.archive.bind(model),restore=model.restore.bind(model),B=model.bodyCount;
 const api={schema:FACE_SCHEMA,settings:{...FACE_DEFAULTS},fields,before:new Float32Array(model.positions.length),revision:0,report:null};
 function apply(){
  const p=model.positions,s=api.settings;api.before.set(p);let max=0,changed=0;const regionMax={nose:0,cheeks:0,mouth:0,chin:0,ears:0};
  const age=model.state?.anny?.phenotypes?.age??2/3,maturity=smooth((age-.24)/.43),scale=clamp(D(model.eyeSurface.landmark(27),model.eyeSurface.landmark(8))/fields.restHeight,.35,2.2);
  if(s.enabled&&s.structure>0){const n=normalField(p,model.faces);for(const i of fields.envelope){let amount=0;for(let k=0;k<5;k++){const key=['nose','cheeks','mouth','chin','ears'][k],term=fields.offsets[i*5+k]*s[key]*(k===1||k===3?maturity:.5+.5*maturity);amount+=term;regionMax[key]=Math.max(regionMax[key],Math.abs(term*scale*s.structure)*1000);}amount=clamp(amount*s.structure*scale,-.00055*scale,.00055*scale);if(Math.abs(amount)>1e-9){for(let k=0;k<3;k++)p[i*3+k]+=n[i*3+k]*amount;changed++;max=Math.max(max,Math.abs(amount));}}}
  let bodyError=0,protectedError=0,nonfinite=0;for(let k=0;k<p.length;k++){if(!Number.isFinite(p[k]))nonfinite++;const d=Math.abs(p[k]-api.before[k]);if(k<B*3)bodyError=Math.max(bodyError,d);else if(fields.protectedVertex[Math.floor(k/3)])protectedError=Math.max(protectedError,d);}
  if(nonfinite||bodyError||protectedError)throw Error('Face transfer violates native protected geometry');
  api.revision++;api.report={version:'ET12-F1',revision:api.revision,enabled:s.enabled,settings:{...s},changedVertices:changed,maxDisplacementMM:max*1000,regionMaxMM:regionMax,bodyErrorMM:bodyError*1000,protectedEyeMouthNonSkinErrorMM:protectedError*1000,originalTopologyUnchanged:true,scanIdentityMeshLoaded:false,nativeScale:scale,maturityGate:maturity,regionCounts:fields.counts,staticFieldHashes:fields.hashes,fieldHashesNow:{fields:hashArray(fields.fields),extra:hashArray(fields.extra),coords:hashArray(fields.coords)},limits:'bounded native-surface refinements, not measured hidden anatomy or whole-body repair; rest mapping is fixed but non-isometric deformations may stretch material'};return p;
 }
 model.compute=input=>{const old=model.positions.slice(),state=model.state;try{compute(input);return apply();}catch(e){model.positions.set(old);model.state=state;throw e;}};
 model.archive=()=>({...archive(),faceSurface:{schema:FACE_SCHEMA,topology:model.canonical.topologySha256,settings:{...api.settings}}});
 model.restore=a=>{const extra=a?.faceSurface;if(extra&&(extra.schema!==FACE_SCHEMA||extra.topology!==model.canonical.topologySha256))throw Error('Incompatible full-face profile');const next=validateFaceSettings(extra?.settings||FACE_DEFAULTS),old=api.settings;try{api.settings=next;return restore(a);}catch(e){api.settings=old;throw e;}};
 api.set=values=>{const next=validateFaceSettings({...api.settings,...values}),old=api.settings;try{api.settings=next;model.compute(model.state);return api.report;}catch(e){api.settings=old;throw e;}};
 model.faceSurface=api;apply();return api;
}

import {makeSpline,sectionOffset,smooth01,KNOWLEDGE_VERSION} from './EyelidKnowledge.mjs';
import {medialRecess,MEDIAL_PROFILE_VERSION} from './MedialProfile.mjs';
export const EYE_LAYER_SCHEMA='kaopu/native-eye-layer@1';
export const EYE_DEFAULTS=Object.freeze({enabled:true,lid:1,brow:1,medial:1,resolution:1,gray:false,grid:false});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]],sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);if(l<1e-10)throw Error('Degenerate native eye frame');return a.map(v=>v/l);},mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
export function validateEyeSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid eye-layer settings');
 const out={...EYE_DEFAULTS,...input};for(const k of Object.keys(out))if(!(k in EYE_DEFAULTS))throw Error('Unknown eye setting '+k);
 for(const k of ['enabled','gray','grid'])if(typeof out[k]!=='boolean')throw Error('Invalid '+k);
 for(const k of ['lid','brow','medial'])if(!Number.isFinite(out[k])||out[k]<0||out[k]>1.5)throw Error('Eye parameter outside [0,1.5]');
 if(![0,1,2].includes(out.resolution))throw Error('Resolution must be 0,1 or2');return out;
}
function normals(p,f){const n=new Float32Array(p.length);for(let k=0;k<f.length;k+=3){const a=f[k],b=f[k+1],c=f[k+2],q=cross(sub(point(p,b),point(p,a)),sub(point(p,c),point(p,a)));for(const i of[a,b,c])for(let j=0;j<3;j++)n[i*3+j]+=q[j];}for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}return n;}
/** Exact triangle axial support query in a head-attached frame, not camera space.
 * Source triangle membership is fixed at binding; only positions move. */
function supportField(local,triangles){
 const size=24,min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const p of local.values())for(let j=0;j<2;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}
 const dx=(max[0]-min[0])/size,dy=(max[1]-min[1])/size,bins=Array.from({length:size*size},()=>[]),cell=(x,y)=>[clamp(Math.floor((x-min[0])/dx),0,size-1),clamp(Math.floor((y-min[1])/dy),0,size-1)];
 for(const t of triangles){const p=t.map(i=>local.get(i));const a=cell(Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1]))),b=cell(Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1])));for(let y=a[1];y<=b[1];y++)for(let x=a[0];x<=b[0];x++)bins[y*size+x].push(p);}
 return (x,y)=>{if(x<min[0]||x>max[0]||y<min[1]||y>max[1])return null;const q=cell(x,y);let z=-Infinity;for(const[a,b,c]of bins[q[1]*size+q[0]]){const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-14)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-6)continue;z=Math.max(z,u*a[2]+v*b[2]+w*c[2]);}return Number.isFinite(z)?z:null;};
}
function frame(landmark,side){
 const ids=side==='right'?{nasal:39,temporal:36,upper:[39,38,37,36],lower:[39,40,41,36]}:{nasal:42,temporal:45,upper:[42,43,44,45],lower:[42,47,46,45]};
 const nasal=landmark(ids.nasal),temporal=landmark(ids.temporal),x=unit(sub(temporal,nasal)),width=Math.hypot(...sub(temporal,nasal));
 const midTop=mix(landmark(ids.upper[1]),landmark(ids.upper[2]),.5),midLow=mix(landmark(ids.lower[1]),landmark(ids.lower[2]),.5),brow=landmark(side==='right'?19:24);
 let v=sub(landmark(27),landmark(8));v=v.map((q,j)=>q-x[j]*dot(v,x));const y=unit(v);let z=unit(cross(x,y));if(dot(z,sub(landmark(30),nasal))<0)z=z.map(q=>-q);
 const project=p=>{const d=sub(p,nasal);return[dot(d,x),dot(d,y),dot(d,z)];};
 const curve=which=>{const p=ids[which].map(i=>project(landmark(i))),s1=clamp(p[1][0]/width,.10,.48),s2=clamp(p[2][0]/width,.52,.90);return makeSpline([[0,p[0][1]],[s1,p[1][1]],[s2,p[2][1]],[1,p[3][1]]]);};
 const upper=curve('upper'),lower=curve('lower'),gap=upper(.5)-lower(.5);
 return {ids,nasal,temporal,x,y,z,width,project,upper,lower,gap,midTop,midLow};
}
export function installNativeEyeLayer(model){
 if(model.eyeSurface)return model.eyeSurface;
 const c=model.canonical,g=model.gnm,N=model.vertexCount,B=model.bodyCount,originalCompute=model.compute.bind(model),originalArchive=model.archive.bind(model),originalRestore=model.restore.bind(model);
 const inverse=new Map();c.gnmRecipes.forEach(([a,b,t],hi)=>{if(a===b||t===0)inverse.set(a,hi+B);if(t===1)inverse.set(b,hi+B);});
 const landmarkRecipes=Array.from({length:68},(_,i)=>Array.from({length:3},(_,j)=>{const native=g.landmarkIndices[i*3+j],vi=inverse.get(native);if(vi===undefined&&((i>=17&&i<48)||i===8))throw Error('Required native eye landmark is not retained');return[vi??B,g.landmarkWeights[i*3+j]];}));
 const getLandmark=(p,i)=>{const out=[0,0,0];for(const[vi,w]of landmarkRecipes[i])for(let j=0;j<3;j++)out[j]+=p[vi*3+j]*w;return out;};
 // Common coordinates: metres, Z up, front -Y. Rest chart is same native body/head.
 const rest=new Float32Array(N*3);rest.set(model.positions);for(let hi=0;hi<c.gnmRecipes.length;hi++){const[a,b,t]=c.gnmRecipes[hi],p=mix(point(g.template,a),point(g.template,b),t),T=c.headTransform.translation;rest.set([p[0]+T[0],-p[2]+T[1],p[1]+T[2]],(B+hi)*3);}
 const restN=normals(rest,model.faces),component=new Int16Array(N).fill(-1),skin=new Uint8Array(N);
 c.gnmRecipes.forEach(([a,b,t],hi)=>{component[B+hi]=g.componentId[t>.5?b:a];skin[B+hi]=g.materialId[a]===0&&g.materialId[b]===0?1:0;});
 const eyes=['right','left'].map(side=>{
  const f=frame(i=>getLandmark(rest,i),side),id=g.meta.componentNames.indexOf(side+'_eye'),vertices=[],triangles=[],patch=[];
  for(let i=B;i<N;i++)if(component[i]===id)vertices.push(i);
  for(let k=0;k<model.faces.length;k+=3){const t=Array.from(model.faces.slice(k,k+3));if(t.every(i=>component[i]===id))triangles.push(t);}
  for(let i=B;i<N;i++)if(skin[i]){
   const q=f.project(point(rest,i)),s=q[0]/f.width,front=dot(point(restN,i),f.z),outer=smooth01((front-.02)/.55);
   if(s>-.18&&s<1.18&&q[1]>-.015&&q[1]<.026&&Math.abs(q[2])<.012&&outer>.001)patch.push({index:i,outer,restS:s});
  }
  if(vertices.length<100||patch.length<100)throw Error('Incomplete native ocular binding');
  return {side,vertices,triangles,patch,referenceWidth:f.width};
 });
 const api={schema:EYE_LAYER_SCHEMA,settings:{...EYE_DEFAULTS},nativePositions:new Float32Array(model.positions.length),revision:0,report:null,rest,skin,eyes,landmarkRecipes};
 function apply(){
  const p=model.positions;api.nativePositions.set(p);const settings=api.settings,rows=[];
  for(const e of eyes){
   const f=frame(i=>getLandmark(api.nativePositions,i),e.side),scale=clamp(f.width/.0255,.35,2.2),local=new Map(e.vertices.map(i=>[i,f.project(point(api.nativePositions,i))])),support=supportField(local,e.triangles),radius=f.width*.57;
   const opening=smooth01((f.gap/scale-.00020)/.0045);let changed=0,maximum=0,medialMM=0,protectedCount=0,minGap=Infinity,baseMinGap=Infinity;
   if(settings.enabled)for(const {index:i,outer}of e.patch){
    const q=f.project(point(api.nativePositions,i)),s=q[0]/f.width;if(s<0||s>1)continue;
    const top=f.upper(s),bottom=f.lower(s),upper=q[1]>(top+bottom)*.5,d=upper?q[1]-top:bottom-q[1];
    if(d<-.0015*scale||d>.025*scale)continue;
    const surface=support(q[0],q[1]);if(surface!==null&&q[2]<surface-.00025*scale)continue;
    let delta=sectionOffset({distance:d,upper,temporal:s,scale,opening,brow:settings.brow*smooth01(((model.state?.anny?.phenotypes?.age??.66)-.18)/.45),lid:settings.lid})*outer;
    if(surface!==null&&s<.18){const r=medialRecess({s,closure:1-opening,anterior:q[2],support:surface,radius});const near=Math.exp(-Math.pow(d/(.0022*scale),2));const back=r.displacement*near*settings.medial*outer;delta-=back;medialMM=Math.max(medialMM,back*1000);}
    delta=clamp(delta,-.0012*scale,.0015*scale);
    if(surface!==null){const limit=Math.min(q[2],surface+.00006*scale);if(q[2]+delta<limit){delta=limit-q[2];protectedCount++;}minGap=Math.min(minGap,q[2]+delta-surface);baseMinGap=Math.min(baseMinGap,q[2]-surface);}
    if(Math.abs(delta)>1e-8){for(let k=0;k<3;k++)p[i*3+k]+=f.z[k]*delta;changed++;maximum=Math.max(maximum,Math.abs(delta));}
   }
   rows.push({side:e.side,widthMM:f.width*1000,nativeOpeningMM:f.gap*1000,openingGate:opening,boundVertices:e.patch.length,changedVertices:changed,maxDisplacementMM:maximum*1000,requestedMedialRecessMM:medialMM,protectedContactSamples:protectedCount,minimumChangedAxialGapMM:Number.isFinite(minGap)?minGap*1000:null,nativeMinimumAxialGapMM:Number.isFinite(baseMinGap)?baseMinGap*1000:null,frame:{nasal:f.nasal,temporal:f.temporal,front:f.z}});
  }
  for(let k=0;k<p.length;k++)if(!Number.isFinite(p[k]))throw Error('Nonfinite transferred eye geometry');
  api.revision++;api.report={version:'ET11-U1',knowledgeVersion:KNOWLEDGE_VERSION,medialVersion:MEDIAL_PROFILE_VERSION,revision:api.revision,enabled:settings.enabled,settings:{...settings},eyes:rows,bodyChanged:false,sourceEyesChanged:false,nativeTopologyUnchanged:true,fixedCorrespondence:true,scanHeadImported:false,clinicalCalibration:false,contactMeaning:'no deeper than native baseline at tested affected vertices; original source intersections are not claimed repaired',units:'metres / Z up / front -Y'};return p;
 }
 model.compute=input=>{const old=model.positions.slice(),oldState=model.state;try{originalCompute(input);return apply();}catch(e){model.positions.set(old);model.state=oldState;throw e;}};
 model.archive=()=>({...originalArchive(),eyeSurface:{schema:EYE_LAYER_SCHEMA,topology:c.topologySha256,settings:{...api.settings}}});
 model.restore=archive=>{
  const old={...api.settings};const extra=archive?.eyeSurface;
  if(extra&&(extra.schema!==EYE_LAYER_SCHEMA||extra.topology!==c.topologySha256))throw Error('Incompatible eye transfer profile');
  const next=validateEyeSettings(extra?.settings||EYE_DEFAULTS);
  try{api.settings=next;return originalRestore(archive);}catch(e){api.settings=old;throw e;}
 };
 api.set=values=>{const next=validateEyeSettings({...api.settings,...values}),old={...api.settings};try{api.settings=next;model.compute(model.state);return api.report;}catch(e){api.settings=old;throw e;}};
 api.landmark=i=>getLandmark(model.positions,i);api.refresh=()=>model.compute(model.state);model.eyeSurface=api;apply();return api;
}

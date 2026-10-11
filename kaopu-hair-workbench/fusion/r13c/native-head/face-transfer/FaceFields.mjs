import {buildSkinRegions} from '../full/ui/skin/SkinRegions.mjs';
export const FACE_FIELDS_VERSION='kaopu/native-face-fields@1';
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const point=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>{const n=Math.hypot(...a);if(n<1e-12)throw Error('Degenerate face frame');return a.map(v=>v/n);};
export function createFaceFields(model){
 const c=model.canonical,g=model.gnm,N=model.vertexCount,B=model.bodyCount,legacy=buildSkinRegions(model),a=new Float32Array(N*4),b=new Float32Array(N*4),eye=new Float32Array(N*4),rest=new Float32Array(N*3),inv=new Map();
 c.gnmRecipes.forEach(([x,y,t],hi)=>{if(x===y||t===0)inv.set(x,B+hi);if(t===1)inv.set(y,B+hi);});
 const lm=Array.from({length:68},(_,i)=>Array.from({length:3},(_,j)=>[inv.get(g.landmarkIndices[i*3+j]),g.landmarkWeights[i*3+j]]));
 for(const i of[8,27,30,31,33,35,36,39,42,45,48,51,54,57])if(lm[i].some(([v])=>v===undefined))throw Error('Retained facial landmark missing: '+i);
 const landmark=(positions,i)=>{const q=[0,0,0];for(const[v,w]of lm[i])if(v!==undefined)for(let k=0;k<3;k++)q[k]+=positions[v*3+k]*w;return q;};
 const eyeCenters={};for(const id of[1,2]){const v=[];for(let i=0;i<g.numVertices;i++)if(g.componentId[i]===id&&g.materialId[i]===6)v.push(point(g.template,i));const center=[0,0,0];for(const p of v)for(let k=0;k<3;k++)center[k]+=p[k]/v.length;let radius=0;for(let i=0;i<g.numVertices;i++)if(g.componentId[i]===id&&g.materialId[i]===5)radius=Math.max(radius,Math.hypot(g.template[i*3]-center[0],g.template[i*3+1]-center[1]));eyeCenters[id]={center,radius};}
 const referenceNormals=surfaceNormals(g.template,g.triangles);const nativeWeights=new Float32Array(g.numVertices*8);const gauss=(v,s)=>Math.exp(-((v/s)**2));
 for(let i=0;i<g.numVertices;i++){
  if(g.materialId[i]!==0)continue;const p=point(g.template,i),name=g.meta.regionNames[g.regionId[i]]||'',face=smooth(.145,.190,p[1])*smooth(-.025,.050,p[2])*smooth(-.05,.35,referenceNormals[i*3+2]),ear=smooth(.069,.090,Math.abs(p[0]))*gauss(p[1]-.290,.050);
  const thin=name.includes('orbital')?.9:name.includes('brow')?.25:name.includes('temple')?.32:0;
  nativeWeights.set([Math.max(face,ear*.8),0,thin,name==='nose'?1:0,name==='forehead'?1:0,/cheek|zygomatic|infraorbital/.test(name)?1:0,ear,name==='chin'?1:0],i*8);
 }
 for(let hi=0;hi<c.gnmRecipes.length;hi++){
  const i=B+hi,[x,y,t]=c.gnmRecipes[hi],p=[0,1,2].map(k=>g.template[x*3+k]*(1-t)+g.template[y*3+k]*t);rest.set(p,i*3);
  if(g.materialId[x]===0&&g.materialId[y]===0){for(let k=0;k<4;k++){a[i*4+k]=nativeWeights[x*8+k]*(1-t)+nativeWeights[y*8+k]*t;b[i*4+k]=nativeWeights[x*8+4+k]*(1-t)+nativeWeights[y*8+4+k]*t;}a[i*4+1]=legacy.regions[i*4+1];}
  const id=g.componentId[t>.5?y:x],r=eyeCenters[id];if(r){const front=smooth(r.center[2]-.004,r.center[2]-.001,p[2]);eye.set([(p[0]-r.center[0])/r.radius,(p[1]-r.center[1])/r.radius,front,id===1?0:1],i*4);}
 }
 const adjacency=Array.from({length:N},()=>new Set());for(let k=0;k<model.faces.length;k+=3)for(const[x,y]of[[model.faces[k],model.faces[k+1]],[model.faces[k+1],model.faces[k+2]],[model.faces[k+2],model.faces[k]]])if(x>=B&&y>=B&&legacy.regions[x*4]&&legacy.regions[y*4]){adjacency[x].add(y);adjacency[y].add(x);}
 for(let pass=0;pass<3;pass++){const A=a.slice(),C=b.slice();for(let i=B;i<N;i++){const ns=adjacency[i];if(!ns.size)continue;for(const k of[0,2,3]){let s=0;for(const j of ns)s+=A[j*4+k];a[i*4+k]=A[i*4+k]*.65+s/ns.size*.35;}for(let k=0;k<4;k++){let s=0;for(const j of ns)s+=C[j*4+k];b[i*4+k]=C[i*4+k]*.65+s/ns.size*.35;}}}
 const counts={face:0,lips:0,thin:0,nose:0,forehead:0,cheek:0,ear:0,chin:0,eyes:0};let bodyWeight=0;
 for(let i=0;i<N;i++){for(const[k,index]of[['face',0],['lips',1],['thin',2],['nose',3]])if(a[i*4+index]>.05)counts[k]++;for(const[k,index]of[['forehead',0],['cheek',1],['ear',2],['chin',3]])if(b[i*4+index]>.05)counts[k]++;if(eye[i*4+2]>.5)counts.eyes++;if(i<B)bodyWeight=Math.max(bodyWeight,...a.slice(i*4,i*4+4),...b.slice(i*4,i*4+4));}
 return {a,b,eye,rest,adjacency,legacy,landmark,report:{version:FACE_FIELDS_VERSION,counts,bodyWeight,source:'same canonical GNM material/region IDs and retained barycentric landmarks; original lip mask reused',fixedAtBind:true,nearestCorrespondenceReselected:false}};
}
export function surfaceNormals(p,faces){const n=new Float32Array(p.length);for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2],q=cross(sub(point(p,b),point(p,a)),sub(point(p,c),point(p,a)));for(const v of[a,b,c])for(let k=0;k<3;k++)n[v*3+k]+=q[k];}for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;for(let k=0;k<3;k++)n[i+k]/=l;}return n;}

import * as THREE from '../full/source/registration-vendor/three.module.js';
import {seedPores,updateSamples,packSamples,CELL_MM,MAX_BUCKET} from './SurfaceSamples.mjs';
const at=(p,i)=>[p[3*i],p[3*i+1],p[3*i+2]];
/** Small refitted triangle BVH. Rays measure the CURRENT model envelope in mm,
 * not an anatomical skin-thickness guess or a painted brightness mask. */
export class PinnaBVH{
 constructor(g){
  const P=g.attributes.position.array,I=g.index.array,W=g.attributes.eOwned.array;this.tri=[];
  for(let i=0;i<I.length;i+=3){const ids=[I[i],I[i+1],I[i+2]];if(ids.some(j=>W[j]<.1))continue;const v=ids.map(j=>at(P,j).map(x=>x*1000)),a=v[0],e1=v[1].map((x,k)=>x-a[k]),e2=v[2].map((x,k)=>x-a[k]);const n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];const len=Math.hypot(...n);if(len<1e-9)continue;this.tri.push({a,e1,e2,n:n.map(x=>x/len),min:[0,1,2].map(k=>Math.min(...v.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...v.map(p=>p[k]))),center:[0,1,2].map(k=>(v[0][k]+v[1][k]+v[2][k])/3)});}
  const make=rows=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of rows)for(let k=0;k<3;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}if(rows.length<=10)return{min,max,rows};let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;rows.sort((a,b)=>a.center[axis]-b.center[axis]);const m=rows.length>>1;return{min,max,left:make(rows.slice(0,m)),right:make(rows.slice(m))};};
  this.root=make(this.tri.slice());
 }
 ray(origin,dir,limit=35){let best=limit,found=false;
  const visit=node=>{let lo=0,hi=best;for(let k=0;k<3;k++){if(Math.abs(dir[k])<1e-10){if(origin[k]<node.min[k]||origin[k]>node.max[k])return;continue}let a=(node.min[k]-origin[k])/dir[k],b=(node.max[k]-origin[k])/dir[k];if(a>b){const t=a;a=b;b=t}lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return;}
   if(!node.rows){visit(node.left);visit(node.right);return}
   for(const t of node.rows){if(t.n[0]*dir[0]+t.n[1]*dir[1]+t.n[2]*dir[2]<.05)continue;
    const p=[dir[1]*t.e2[2]-dir[2]*t.e2[1],dir[2]*t.e2[0]-dir[0]*t.e2[2],dir[0]*t.e2[1]-dir[1]*t.e2[0]],det=t.e1[0]*p[0]+t.e1[1]*p[1]+t.e1[2]*p[2];if(Math.abs(det)<1e-10)continue;
    const v=origin.map((x,k)=>x-t.a[k]),u=(v[0]*p[0]+v[1]*p[1]+v[2]*p[2])/det;if(u<0||u>1)continue;const q=[v[1]*t.e1[2]-v[2]*t.e1[1],v[2]*t.e1[0]-v[0]*t.e1[2],v[0]*t.e1[1]-v[1]*t.e1[0]],b=(dir[0]*q[0]+dir[1]*q[1]+dir[2]*q[2])/det;if(b<0||u+b>1)continue;const d=(t.e2[0]*q[0]+t.e2[1]*q[1]+t.e2[2]*q[2])/det;if(d>.075&&d<best){best=d;found=true;}
   }
  };visit(this.root);return found?best:null;
 }
}
function texture(data,width){const h=Math.ceil(data.length/4/width),t=new THREE.DataTexture(data,width,h,THREE.RGBAFormat,THREE.FloatType);t.colorSpace=THREE.NoColorSpace;t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}
export class EarTissueField{
 constructor(g){this.geometry=g;this.binding=seedPores(g);this.last=null;this.records=[];this.report={ready:false};this.builds=0;this.protectedWeights=g.attributes.eWeight.array;this.active=[];for(let i=0;i<g.attributes.position.count;i++)if(this.protectedWeights[i]>0)this.active.push(i);this.thicknessData=new Float32Array(g.attributes.position.count*4);g.setAttribute('eTissue',new THREE.BufferAttribute(this.thicknessData,4));}
 update(){
  const g=this.geometry,P=g.attributes.position.array,N=g.attributes.normal.array;
  if(this.last&&this.active.every(i=>P[i*3]===this.last[i*3]&&P[i*3+1]===this.last[i*3+1]&&P[i*3+2]===this.last[i*3+2]))return false;
  const start=performance.now();this.last=P.slice();const bvh=new PinnaBVH(g),D=this.thicknessData,values=[];let hits=0,missing=0,coneHits=0;
  for(const i of this.active){
   const n=at(N,i),p=at(P,i).map(x=>x*1000),o=p.map((x,k)=>x-n[k]*.025);let d=bvh.ray(o,n.map(x=>-x)),confidence=d===null?0:1;
   if(d===null){
    // Eight 35-degree cone rays may recover a folded sheet missed by its
    // interpolated normal. Their projected distance is an estimate, marked .65.
    const axis=Math.abs(n[1])<.9?[0,1,0]:[1,0,0],t=[axis[1]*n[2]-axis[2]*n[1],axis[2]*n[0]-axis[0]*n[2],axis[0]*n[1]-axis[1]*n[0]],l=Math.hypot(...t);for(let k=0;k<3;k++)t[k]/=l;
    const v=[n[1]*t[2]-n[2]*t[1],n[2]*t[0]-n[0]*t[2],n[0]*t[1]-n[1]*t[0]],c=Math.cos(Math.PI*35/180),ss=Math.sin(Math.PI*35/180),distances=[];
    for(let j=0;j<8;j++){const a=j*Math.PI/4,dir=n.map((x,k)=>-x*c+(t[k]*Math.cos(a)+v[k]*Math.sin(a))*ss),q=bvh.ray(o,dir,25);if(q!==null)distances.push(q*c);}
    if(distances.length>=2){distances.sort((a,b)=>a-b);d=distances[Math.floor(distances.length*.35)];confidence=.65;coneHits++;}
   }
   const valid=d!==null;D[i*4]=valid?Math.max(.15,d+.025):12;D[i*4+1]=confidence;D[i*4+2]=this.protectedWeights[i];D[i*4+3]=valid?1:0;
   if(valid){values.push(D[i*4]);hits++;}else missing++;
  }
  // Filter only optical fields, never geometry. Unknown points remain opaque;
  // their neighbours feather inward rather than displaying jagged confidence.
  const adj=new Map(),I=g.index.array;for(let k=0;k<I.length;k+=3){const ids=[I[k],I[k+1],I[k+2]];for(const i of ids)if(this.protectedWeights[i]>0){let a=adj.get(i);if(!a)adj.set(i,a=new Set());for(const j of ids)if(j!==i)a.add(j);}}
  const raw=D.slice();
  for(let pass=0;pass<5;pass++){const src=D.slice();for(const i of this.active){if(!raw[i*4+3])continue;const ns=[...(adj.get(i)||[])],valid=ns.filter(j=>raw[j*4+3]),vals=[src[i*4],...valid.map(j=>src[j*4])].sort((a,b)=>a-b);D[i*4]=src[i*4]*.55+vals[vals.length>>1]*.45;}}
  for(let pass=0;pass<12;pass++){const src=D.slice();for(const i of this.active){if(!raw[i*4+3]){D[i*4+1]=0;continue}const ns=[...(adj.get(i)||[])];let sum=0,weight=0;for(const j of ns){const distance=Math.hypot(P[i*3]-P[j*3],P[i*3+1]-P[j*3+1],P[i*3+2]-P[j*3+2])*1000,w=1/Math.max(distance,.12);sum+=src[j*4+1]*w;weight+=w;}D[i*4+1]=Math.min(raw[i*4+1],.30*src[i*4+1]+.70*(sum/Math.max(weight,.001)));}}
  g.attributes.eTissue.needsUpdate=true;
  this.records=updateSamples(this.binding,g);const packed=packSamples(this.records);this.indexTexture?.dispose();this.poreTexture?.dispose();this.indexTexture=texture(packed.ids,512);this.poreTexture=texture(packed.data,512);this.hashSize=packed.size;
  values.sort((a,b)=>a-b);this.builds++;
  this.report={ready:true,version:'EAR-R05.0',sampling:this.binding.method,seed:this.binding.seed,poreCount:this.records.length,seedAreaMM2:this.binding.areaMM2,minimumSeedSeparationMM:this.binding.minimumSeedSeparationMM,poreRadiusMM:[.032,.054],poreDepthMM:[.003,.005],currentSpaceMetric:true,barycentricAnchors:true,planarPoreProjection:false,normalRayHits:hits-coneHits,coneRayEstimates:coneHits,totalRayHits:hits,confidenceFeatherPasses:12,unmeasuredVertices:missing,unmeasuredPolicy:'12mm conservative opaque estimate / zero deep transmission',thicknessMM:{min:values[0],p10:values[Math.floor(values.length*.1)],median:values[Math.floor(values.length*.5)],p90:values[Math.floor(values.length*.9)],max:values.at(-1)},thicknessKind:'normal ray + marked 35deg cone estimate of model envelope, not skin/cartilage histology',hashBucketMaximum:packed.maxBucket,hashSize:packed.size,hashDroppedRecords:0,gpuDataBytes:packed.bytes,cellMM:CELL_MM,slots:MAX_BUCKET,buildMS:performance.now()-start,builds:this.builds,geometryModified:false};
  return true;
 }
 dispose(){this.indexTexture?.dispose();this.poreTexture?.dispose();this.last=null;this.records=[];}
}

const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),scale=(a,s)=>a.map(v=>v*s);
const normalized=a=>scale(a,1/(Math.hypot(...a)||1));
const transform=(m,p)=>[0,1,2].map(k=>m[k*4]*p[0]+m[k*4+1]*p[1]+m[k*4+2]*p[2]+m[k*4+3]);
const inversePoint=(m,p)=>{const d=sub(p,[m[3],m[7],m[11]]);return [0,1,2].map(k=>m[k]*d[0]+m[4+k]*d[1]+m[8+k]*d[2]);};
const nativeView=p=>[p[0],p[2],-p[1]];
const worldPoint=(elements,p)=>[0,1,2].map(k=>elements[k]*p[0]+elements[4+k]*p[1]+elements[8+k]*p[2]+elements[12+k]);
const quaternionFromY=d=>{const n=normalized(d);if(n[1]<-.999999)return [1,0,0,0];return normalized4([n[2],0,-n[0],1+n[1]]);};
const normalized4=q=>q.map(v=>v/(Math.hypot(...q)||1));
const bounds=points=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}return {min,max,center:min.map((v,k)=>(v+max[k])/2)};};

export async function shapeFingerprint(human){
 const data=new TextEncoder().encode(JSON.stringify({schema:'anny-collision-shape/1',names:human.names,parents:Array.from(human.rig.parents),rest:human.rig.restMatrices.map(m=>Array.from(m)),positions:Array.from(human.positions)}));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
}

/** Fit from each actor's actual neutral canonical mesh, rather than applying
 * one adult collider to every age/width preset. Full visual CSR weights and
 * geometry are read only. These conservative primitives are approximate.
 */
export function fitAnnyProxies(human){
 const {names,rig,positions,N,range,packed}=human,head=names.indexOf('head');if(head<0)throw Error('Anny head bone missing');
 const headZ=rig.restMatrices[head][11],headPoints=[],torsoPoints=[];
 for(let i=0;i<N;i++){
  const p=Array.from(positions.slice(i*3,i*3+3));let headWeight=0,torsoWeight=0;
  for(let r=0;r<range[i*2+1];r++){const s=(range[i*2]+r)*8,n=names[packed[s+3]],w=packed[s+4];if(/head|jaw|eye|face/.test(n))headWeight+=w;if(/spine|breast|pelvis/.test(n))torsoWeight+=w;}
  if(headWeight>.5&&p[2]>headZ-human.height*.012)headPoints.push(p);
  if(torsoWeight>.6)torsoPoints.push(p);
 }
 if(headPoints.length<30||torsoPoints.length<30)throw Error('Insufficient canonical surface points for proxy fit');
 const hb=bounds(headPoints),tb=bounds(torsoPoints),proxies=[];
 const register=(region,bone,center,axis,radius,halfHeight,count)=>{
  const index=names.indexOf(bone);if(index<0)throw Error('Missing proxy anchor '+bone);const rest=rig.restMatrices[index];
  proxies.push({bodyRegion:region,boneIndex:index,localCenter:inversePoint(rest,center),localAxisPoint:inversePoint(rest,add(center,axis)),radius,halfHeight,surfaceSamples:count});
 };
 register('head','head',hb.center,[0,0,1],Math.max(...headPoints.map(p=>Math.hypot(...sub(p,hb.center)))),0,headPoints.length);
 // Three transverse capsule bands retain the actual body's width/depth.
 for(const [region,bone,lo,hi] of [['abdomen','spine04',0,.34],['torso','spine02',.34,.72],['upper-torso','spine01',.72,1]]){
  const z0=tb.min[2]+(tb.max[2]-tb.min[2])*lo,z1=tb.min[2]+(tb.max[2]-tb.min[2])*hi,points=torsoPoints.filter(p=>p[2]>=z0&&p[2]<=z1);
  if(points.length<10)continue;const b=bounds(points),initialRadius=Math.max((b.max[1]-b.min[1])/2,(b.max[2]-b.min[2])/2),halfHeight=Math.max(0,(b.max[0]-b.min[0])/2-initialRadius),radius=Math.max(...points.map(p=>Math.hypot(Math.max(0,Math.abs(p[0]-b.center[0])-halfHeight),p[1]-b.center[1],p[2]-b.center[2])));
  register(region,bone,b.center,[1,0,0],radius,halfHeight,points.length);
 }return {schema:'anny-fitted-collision-proxies/1',height:human.height,visualVertices:N,visualChanged:false,proxies};
}

/** Adapter for the existing workbench actors. group.matrixWorld already
 * includes ring translation, actor placement, floor offset and facing.
 * posedMatrices already contain root motion. Never add either a second time.
 */
export class AnnyProxyAdapter {
 static async create(actors){const adapter=new AnnyProxyAdapter(actors);adapter.shapeFingerprints=await Promise.all(actors.map(a=>shapeFingerprint(a.human)));return adapter;}
 constructor(actors){this.actors=actors;this.fits=actors.map(a=>fitAnnyProxies(a.human));this.shapeFingerprints=null;this.previous=null;}
 capture(){
  const targets=[],attacks=[];
  for(let i=0;i<this.actors.length;i++){
   const a=this.actors[i];if(!a.latest)throw Error('Evaluate the complete actor pose before capture');a.group.updateWorldMatrix(true,false);const matrix=a.group.matrixWorld.elements;
   for(const p of this.fits[i].proxies){const m=a.latest.posedMatrices[p.boneIndex],center=worldPoint(matrix,nativeView(transform(m,p.localCenter))),axisPoint=worldPoint(matrix,nativeView(transform(m,p.localAxisPoint)));
    targets.push({pairId:Math.floor(i/2),actorId:i,presetId:a.preset?.id,shapeFingerprint:this.shapeFingerprints?.[i],bodyRegion:p.bodyRegion,center,radius:p.radius,halfHeight:p.halfHeight,rotation:quaternionFromY(sub(axisPoint,center))});
   }
   for(const glove of a.gloves){const center=worldPoint(matrix,glove.position.toArray());attacks.push({pairId:Math.floor(i/2),actorId:i,hand:glove.side,center,radius:.10125*a.human.height/1.75});}
  }return {targets,attacks};
 }
 sample(){
  const current=this.capture(),previous=this.previous;this.previous=current;if(!previous)return null;
  return {attacks:current.attacks.map((a,i)=>({...a,from:previous.attacks[i].center,to:a.center})),targets:current.targets.map((t,i)=>({...t,from:previous.targets[i].center,to:t.center,rotation:previous.targets[i].rotation}))};
 }
 reset(){this.previous=null;}
}

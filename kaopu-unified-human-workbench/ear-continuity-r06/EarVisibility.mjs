import {PenumbraFilter} from './PenumbraFilter.mjs';
/** Ear-only direct-light visibility against the CURRENT head surface.
 * Backside transport must exit the pinna and then have a clear path to light.
 * No positions, normals or albedo are altered. Units: millimetres. */
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=a=>{const l=Math.hypot(...a);if(l<1e-12)throw Error('Zero light direction');return a.map(x=>x/l)};
export class HeadVisibilityBVH{
 constructor(g,{skullGeometry=null}={}){
  this.tri=[];const append=(mesh,part)=>{
   const P=mesh.attributes.position.array,R=mesh.attributes.fRest.array,I=mesh.index.array,O=mesh.attributes.eOwned.array;
   for(let k=0;k<I.length;k+=3){const ids=[I[k],I[k+1],I[k+2]];if(ids.every(i=>R[i*3+1]<.17))continue;
    const earAny=ids.some(i=>O[i]>.001);if(part==='skull'&&earAny)continue;if(part==='pinna'&&!earAny)continue;
    const v=ids.map(i=>[P[i*3]*1000,P[i*3+1]*1000,P[i*3+2]*1000]),a=v[0],e1=v[1].map((x,j)=>x-a[j]),e2=v[2].map((x,j)=>x-a[j]),normal=cross(e1,e2),len=Math.hypot(...normal);if(len<1e-9)continue;
    this.tri.push({a,e1,e2,n:normal.map(x=>x/len),ear:Math.min(...ids.map(i=>O[i])),min:[0,1,2].map(j=>Math.min(v[0][j],v[1][j],v[2][j])),max:[0,1,2].map(j=>Math.max(v[0][j],v[1][j],v[2][j])),c:[0,1,2].map(j=>(v[0][j]+v[1][j]+v[2][j])/3),face:k/3});
   }
  };if(skullGeometry){append(skullGeometry,'skull');append(g,'pinna')}else append(g,'all');
  const make=rows=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of rows)for(let j=0;j<3;j++){min[j]=Math.min(min[j],t.min[j]);max[j]=Math.max(max[j],t.max[j])}if(rows.length<=12)return{min,max,rows};let axis=0;for(let j=1;j<3;j++)if(max[j]-min[j]>max[axis]-min[axis])axis=j;rows.sort((a,b)=>a.c[axis]-b.c[axis]);const m=rows.length>>1;return{min,max,left:make(rows.slice(0,m)),right:make(rows.slice(m))}};
  if(!this.tri.length)throw Error('No head occluders');this.root=make(this.tri.slice());
 }
 first(origin,dir,{limit=500,minDistance=.045,exitOnly=false,any=false}={}){
  let best=limit,hit=null;
  const visit=node=>{let lo=0,hi=best;for(let j=0;j<3;j++){if(Math.abs(dir[j])<1e-12){if(origin[j]<node.min[j]||origin[j]>node.max[j])return;continue}let a=(node.min[j]-origin[j])/dir[j],b=(node.max[j]-origin[j])/dir[j];if(a>b){const t=a;a=b;b=t}lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return}if(any&&hit)return;
   if(!node.rows){visit(node.left);visit(node.right);return}
   for(const t of node.rows){const facing=dot(t.n,dir);if(exitOnly&&facing<.035)continue;const p=cross(dir,t.e2),det=dot(t.e1,p);if(Math.abs(det)<1e-11)continue;const v=[origin[0]-t.a[0],origin[1]-t.a[1],origin[2]-t.a[2]],u=dot(v,p)/det;if(u<0||u>1)continue;const q=cross(v,t.e1),b=dot(dir,q)/det;if(b<0||u+b>1)continue;const d=dot(t.e2,q)/det;if(d>minDistance&&d<best){best=d;hit={distance:d,ear:t.ear,face:t.face,exit:facing>0};if(any)return;}}
  };visit(this.root);return hit;
 }
 visibility(p,n,l){
  const nl=dot(n,l),o=p.map((x,j)=>x+n[j]*.06),direct=nl>-.04&&!this.first(o,l,{any:true})?1:0;let deep=0,exit=null;
  if(nl<.04){exit=this.first(p.map((x,j)=>x+l[j]*.06),l,{exitOnly:true,limit:35});if(exit&&exit.ear>.85){const beyond=p.map((x,j)=>x+l[j]*(exit.distance+.18));deep=this.first(beyond,l,{any:true})?0:1;}}
  return{direct,deep,exitDistance:exit?.distance??null};
 }
}
export function coneDirections(light,angle=.018){const l=unit(light),axis=Math.abs(l[1])<.9?[0,1,0]:[1,0,0],u=unit(cross(axis,l)),v=cross(l,u);return[l,...[u,v].flatMap(t=>[-1,1].map(s=>unit(l.map((x,j)=>x+t[j]*angle*s))))]}
export class EarVisibilityField{
 constructor(g,{sampleCount=g.attributes.position.count,pairs=[],skullGeometry=null}={}){this.geometry=g;this.sampleCount=sampleCount;this.skullGeometry=skullGeometry;this.pairs=pairs;this.active=[];const W=g.attributes.eWeight.array;for(let i=0;i<sampleCount;i++)if(W[i]>0)this.active.push(i);this.direct=new Float32Array(W.length*3).fill(1);this.deep=new Float32Array(W.length*3);this.penumbra=new PenumbraFilter(g);this.last=null;this.lightKey=null;this.builds=0;this.report={ready:false};}
 update(directions){
  if(directions.length!==3)throw Error('R06 requires the three retained directional lights; explicit rebind required');
  const g=this.geometry,P=g.attributes.position.array,N=g.attributes.normal.array,signature=directions.flat().map(x=>x.toFixed(8)).join('/'),geometrySame=this.last&&P.length===this.last.length&&P.every((x,i)=>x===this.last[i]);
  if(geometrySame&&signature===this.lightKey)return false;
  const t=performance.now();if(!geometrySame){this.bvh=new HeadVisibilityBVH(g,{skullGeometry:this.skullGeometry});this.penumbra.prepare();this.last=P.slice();}this.lightKey=signature;
  let directVisible=[0,0,0],deepVisible=[0,0,0],rays=0;const cones=directions.map(d=>coneDirections(d));
  for(const i of this.active){const p=[P[i*3]*1000,P[i*3+1]*1000,P[i*3+2]*1000],n=unit([N[i*3],N[i*3+1],N[i*3+2]]);for(let lamp=0;lamp<3;lamp++){let d=0,s=0;for(const dir of cones[lamp]){const r=this.bvh.visibility(p,n,dir);d+=r.direct;s+=r.deep;rays++}d/=5;s/=5;this.direct[i*3+lamp]=d;this.deep[i*3+lamp]=s;directVisible[lamp]+=d;deepVisible[lamp]+=s;}}
  // The unchanged R04 midpoint stencils interpolate optical fields only.
  for(let j=0;j<this.pairs.length;j++){const[a,b]=this.pairs[j],id=this.sampleCount+j;for(let k=0;k<3;k++){this.direct[id*3+k]=(this.direct[a*3+k]+this.direct[b*3+k])*.5;this.deep[id*3+k]=(this.deep[a*3+k]+this.deep[b*3+k])*.5;}}
  this.penumbra.apply(this.direct);this.penumbra.apply(this.deep);
  this.builds++;this.report={ready:true,version:'EAR-R06.0',method:'retained native skull + current refined pinna BVH / five angular samples / pinna exit and external visibility',penumbra:this.penumbra.report(),occluderTriangles:this.bvh.tri.length,raySampleVertices:this.active.length,interpolatedVertices:this.pairs.length,directVisible,deepVisible,visibilitySumStage:'before optical prefilter',lightDirections:directions,angularRadiusRadians:.018,biasMM:.06,queryCount:rays,fieldBytes:this.direct.byteLength+this.deep.byteLength,buildMS:performance.now()-t,builds:this.builds,geometryRebuilt:!geometrySame,positionsModified:false,normalsModified:false,unknownExitPolicy:'no raw deep transmission; edge penumbra remains confidence-gated by R05 tissue',fullVolumetricTransport:false};return true;
 }
 dispose(){this.bvh=null;this.last=null;this.penumbra=null;}
}

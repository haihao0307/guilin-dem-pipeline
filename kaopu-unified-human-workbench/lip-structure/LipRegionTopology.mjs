import * as THREE from '../full/source/registration-vendor/three.module.js';
import {clamp,smooth,gauss,point} from './LipMath.mjs';
const lerpZ=(a,x)=>{for(let i=0;i<a.length-1;i++)if(x<=a[i+1][0])return a[i][2]+(a[i+1][2]-a[i][2])*clamp((x-a[i][0])/(a[i+1][0]-a[i][0]));return a.at(-1)[2];};
/** Classifies the EXISTING indexed surface, including its oral return.
 * No alpha shell, decal, duplicated lip surface, or invented mouth insert. */
export class LipRegionTopology{
 constructor(geometry,rails){
  this.geometry=geometry;this.rails=rails;this.count=geometry.attributes.position.count;
  const R=geometry.attributes.fRest.array,T=geometry.attributes.csType.array,F=geometry.index.array,O=geometry.attributes.l19Oral?.array;if(!O)throw Error('原生口腔语义未传入派生表面');
  this.samples=Array(this.count);this.active=[];this.lips=[];this.inside=[];this.neighbors=Array.from({length:this.count},()=>[]);this.pairs=[];
  for(let i=0;i<this.count;i++){
   const p=point(R,i),q=rails.sample(p,T[i]),mid=(q.it+q.ib)*.5,depth=lerpZ(q.upper?rails.innerTop:rails.innerBottom,p[0])-p[2],side=1-smooth(.94,1.20,Math.abs(q.u)),oralY=(p[1]-mid)/Math.max(.0055,(q.top-q.bot)*.7);
   q.depth=depth;q.type=T[i];q.inner=T[i]<.5?clamp(O[i]):0;
   q.skin=T[i]<.5&&(q.roi||q.inner>.005);q.weight=q.skin?Math.max((1-smooth(.98,1.33,Math.abs(q.u)))*gauss(Math.max(0,q.v-.8),1.1)*q.front,q.inner*.65*(1-smooth(.014,.034,depth))*(1-smooth(1.2,1.6,Math.abs(q.u)))):0;
   q.red=q.roi?(1-smooth(.90,1.0,Math.abs(q.u)))*smooth(-.25,0,q.v)*(1-smooth(.78,1.04,q.v))*q.front:0;
   q.rim=q.roi&&Math.abs(q.u)<.98&&q.v>-.28&&q.v<.7&&depth<.0035;
   this.samples[i]=q;if(q.skin&&q.weight>.001)this.active.push(i);if(q.red>.025)this.lips.push(i);if(q.inner>.25)this.inside.push(i);
  }
  for(let k=0;k<F.length;k+=3){const a=F[k],b=F[k+1],c=F[k+2];for(const[i,j]of[[a,b],[b,c],[c,a]]){if(this.samples[i].skin&&this.samples[j].skin){if(!this.neighbors[i].includes(j))this.neighbors[i].push(j);if(!this.neighbors[j].includes(i))this.neighbors[j].push(i);}}}
  for(let b=0;b<49;b++){const u=(b/48*2-1)*.94,best=[Infinity,Infinity],ids=[-1,-1];for(const i of this.active){const q=this.samples[i];if(!q.rim)continue;const score=Math.abs(q.u-u)*rails.half*2+Math.abs(q.v)*.004+Math.abs(q.depth)*1.5,j=q.upper?1:0;if(score<best[j]){best[j]=score;ids[j]=i;}}if(ids[0]>=0&&ids[1]>=0)this.pairs.push({u,lower:ids[0],upper:ids[1]});}
  this.restLength=new Float32Array(this.count);for(const i of this.active){const a=point(R,i);let sum=0;for(const j of this.neighbors[i]){const b=point(R,j);sum+=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}this.restLength[i]=sum/Math.max(1,this.neighbors[i].length);}
  this.fields=new Float32Array(this.count*4);this.detail=new Float32Array(this.count*4);for(let i=0;i<this.count;i++){this.fields[i*4]=this.samples[i].inner;this.fields[i*4+1]=1;this.detail[i*4]=1;}
  geometry.setAttribute('l19State',new THREE.BufferAttribute(this.fields,4));geometry.setAttribute('l19Detail',new THREE.BufferAttribute(this.detail,4));this.audit=this.auditEdges();
 }
 auditEdges(){const F=this.geometry.index.array,map=new Map();let faces=0;for(let k=0;k<F.length;k+=3){const a=F[k],b=F[k+1],c=F[k+2];if([a,b,c].some(i=>this.samples[i].skin))faces++;for(const[i,j]of[[a,b],[b,c],[c,a]]){const key=i<j?i+','+j:j+','+i;map.set(key,(map.get(key)||0)+1);}}
  let mouthBoundary=0,nonManifold=0;for(const[key,n]of map){const[a,b]=key.split(',').map(Number);if(n===1&&this.samples[a].skin&&this.samples[b].skin)mouthBoundary++;if(n>2&&(this.samples[a].skin||this.samples[b].skin))nonManifold++;}
  return{mouthBoundaryEdges:mouthBoundary,mouthNonManifoldEdges:nonManifold,oralReturnVertices:this.inside.length,vermilionVertices:this.lips.length,pairedSections:this.pairs.length,regionalTriangles:faces,existingSurfaceRetained:true,newOverlappingSheets:0,continuity:'indexed native skin and oral return retained; no cut-and-cover patch'};
 }
}

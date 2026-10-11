import * as THREE from '../full/source/registration-vendor/three.module.js';
import {clamp,smooth,gauss,currentLipFrame,point} from './LipMath.mjs';
/** One derived display geometry replaces the previous display geometry. Canonical
 * buffers, binding, rig and all body faces remain untouched. Fixed edge stencils
 * avoid frame-dependent correspondence. Transition triangles prevent T junctions. */
export class LipSurface{
 constructor(source,api){
  this.source=source;this.api=api;this.layers=[];let g=source;
  for(let level=0;level<2;level++){
   const R=g.attributes.fRest.array,T=g.attributes.csType.array,A=g.attributes.fA.array,oldCount=g.attributes.position.count,edges=new Map(),pairs=[];
   const roi=i=>api.rails.sample(point(R,i),T[i]).roi||(level===0&&T[i]<.5&&A[i*4+2]>.65);
   const selected=Uint8Array.from({length:oldCount},(_,i)=>roi(i)?1:0),key=(a,b)=>a<b?a+','+b:b+','+a;
   for(let k=0;k<g.index.count;k+=3){const ids=[g.index.array[k],g.index.array[k+1],g.index.array[k+2]];if(ids.every(i=>selected[i]))for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],s=key(a,b);if(!edges.has(s)){edges.set(s,oldCount+pairs.length);pairs.push([a,b]);}}}
   const out=[];for(let k=0;k<g.index.count;k+=3){const a=g.index.array[k],b=g.index.array[k+1],c=g.index.array[k+2],ab=edges.get(key(a,b))??-1,bc=edges.get(key(b,c))??-1,ca=edges.get(key(c,a))??-1,count=[ab,bc,ca].filter(x=>x>=0).length;
    if(count===3)out.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);else if(count===0)out.push(a,b,c);else if(count===1){if(ab>=0)out.push(a,ab,c,ab,b,c);else if(bc>=0)out.push(a,b,bc,a,bc,c);else out.push(a,b,ca,ca,b,c);}else if(ab<0)out.push(a,b,bc,a,bc,ca,ca,bc,c);else if(bc<0)out.push(a,ab,ca,ab,b,c,ab,c,ca);else out.push(a,ab,c,ab,bc,c,ab,b,bc);
   }
   const next=new THREE.BufferGeometry();for(const [name,attr]of Object.entries(g.attributes)){if(name==='normal')continue;const size=attr.itemSize,data=new Float32Array((oldCount+pairs.length)*size);data.set(attr.array);for(let j=0;j<pairs.length;j++){const[a,b]=pairs[j];for(let k=0;k<size;k++)data[(oldCount+j)*size+k]=(attr.array[a*size+k]+attr.array[b*size+k])*.5;}next.setAttribute(name,new THREE.BufferAttribute(data,size));}next.setIndex(out);this.layers.push({geometry:next,pairs,oldCount});g=next;
  }
  this.geometry=g;const R=g.attributes.fRest.array,T=g.attributes.csType.array;this.samples=Array.from({length:g.attributes.position.count},(_,i)=>api.rails.sample(point(R,i),T[i]));
 }
 update(model){
  let prev=this.source;const s=this.api.settings;
  for(const l of this.layers){const P=prev.attributes.position.array,N=prev.attributes.normal.array,T=prev.attributes.csType.array,R=prev.attributes.fRest.array,Q=l.geometry.attributes.position.array;Q.set(P);
   for(let j=0;j<l.pairs.length;j++){const[a,b]=l.pairs[j],ai=a*3,bi=b*3,qi=(l.oldCount+j)*3;const p=[0,1,2].map(k=>(P[ai+k]+P[bi+k])*.5),agreement=N[ai]*N[bi]+N[ai+1]*N[bi+1]+N[ai+2]*N[bi+2],q=this.api.rails.sample([0,1,2].map(k=>(R[ai+k]+R[bi+k])*.5),T[a]);
    if(Math.abs(T[a]-T[b])<.01&&agreement>.82){let da=0,db=0;for(let k=0;k<3;k++){da+=(p[k]-P[ai+k])*N[ai+k];db+=(p[k]-P[bi+k])*N[bi+k];}const gain=q.roi?.34:.20*s.eyeSmoothing,d=[0,1,2].map(k=>-gain*(da*N[ai+k]+db*N[bi+k])),len=Math.hypot(...d),cap=q.roi?.00015:.000045;for(let k=0;k<3;k++)p[k]+=d[k]*Math.min(1,cap/(len||1));}
    Q.set(p,qi);
   }
   if(prev.attributes.color){const a=prev.attributes.color.array,b=l.geometry.attributes.color.array;b.set(a);for(let j=0;j<l.pairs.length;j++)for(let k=0;k<3;k++)b[(l.oldCount+j)*3+k]=(a[l.pairs[j][0]*3+k]+a[l.pairs[j][1]*3+k])*.5;l.geometry.attributes.color.needsUpdate=true;}
   l.geometry.attributes.position.needsUpdate=true;l.geometry.computeVertexNormals();prev=l.geometry;
  }
  const frame=currentLipFrame(model),scale=clamp(frame.width/(2*this.api.rails.half),.4,1.8),Q=this.geometry.attributes.position.array;let max=0,affected=0;
  for(let i=0;i<this.samples.length;i++){const q=this.samples[i];if(!q.roi)continue;const {u,v,upper}=q,edge=1-smooth(.78,1.06,Math.abs(u)),gate=smooth(-.40,-.02,v)*(1-smooth(1.25,2.6,v))*q.front;if(gate<1e-5)continue;
   const roll=gauss(v-.40,.56),border=gauss(v-1.04,.27),central=gauss(u,.24),lateral=gauss(Math.abs(u)-.46,.30);let depth=0,dy=0,dx=0;
   if(upper){depth=.00080*s.upperVolume*roll*(.42+.58*lateral)+.00052*s.tubercle*central*gauss(v-.19,.52);dy=.00070*s.cupid*(gauss(Math.abs(u)-.34,.18)-.22*central)*gauss(v-.95,.68)-.00056*s.tubercle*central*gauss(v,.60);}
   else{depth=.0010*s.lowerVolume*roll*(.40+.60*gauss(Math.abs(u)-.32,.29));dy=-.00017*s.lowerVolume*roll*edge;}
   depth+=.00013*border*edge;depth-=.00038*s.corners*gauss(Math.abs(u)-.92,.12)*gauss(v-.33,1.2);dx=-Math.sign(u)*.00012*s.corners*gauss(Math.abs(u)-.91,.12);
   depth*=edge*gate;dy*=edge*gate;dx*=gate;const factor=s.structure*scale,delta=[0,1,2].map(k=>(frame.front[k]*depth+frame.up[k]*dy+frame.x[k]*dx)*factor),len=Math.hypot(...delta),cap=.0018*scale;
   for(let k=0;k<3;k++)Q[i*3+k]+=delta[k]*Math.min(1,cap/(len||1));max=Math.max(max,Math.min(len,cap));affected++;
  }
  this.geometry.attributes.position.needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();
  this.stats={mode:'native-landmark vermilion rolls and fixed-stencil local surface',addedDisplayVertices:this.geometry.attributes.position.count-this.source.attributes.position.count,affectedDisplayVertices:affected,maxShapeDeltaMM:max*1000,nativePositionBufferModified:false,nativeIndexBufferModified:false,bodyTrianglesChanged:0,extraHeadMeshes:0,eyeChange:'bounded skin-only midpoint refinement; eyeballs and eyelid aperture retained'};return this.geometry;
 }
 dispose(){for(const l of this.layers)l.geometry.dispose();}
}

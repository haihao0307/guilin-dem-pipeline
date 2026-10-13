import * as THREE from '../full/source/registration-vendor/three.module.js';
import {earROI,earMask,sampleEar,point,earDelta,headFrame} from './EarMath.mjs';
/** Two fixed, local Loop subdivision stencils. Transition triangles share
 * every split edge: no detached ear, no extra head, no per-frame nearest match.
 * All input/canonical buffers are read-only. Only the derived display changes. */
export class EarSurface{
 constructor(source){this.source=source;this.layers=[];let g=source;
  for(let level=0;level<2;level++){
   const R=g.attributes.fRest.array,T=g.attributes.csType.array,count=g.attributes.position.count,key=(a,b)=>a<b?a+','+b:b+','+a,edges=new Map(),adj=new Map();
   const selected=Uint8Array.from({length:count},(_,i)=>earROI(point(R,i),T[i])?1:0);
   for(let k=0;k<g.index.count;k+=3){const ids=[g.index.array[k],g.index.array[k+1],g.index.array[k+2]],take=ids.every(i=>selected[i]);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],c=ids[(j+2)%3],id=key(a,b);if(selected[a]||selected[b]){let e=edges.get(id);if(!e){e={a,b,op:[],take:false};edges.set(id,e);}e.op.push(c);e.take ||=take;if(selected[a]){if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b);}if(selected[b]){if(!adj.has(b))adj.set(b,new Set());adj.get(b).add(a);}}}}
   const pairs=[];for(const e of edges.values())if(e.take){e.index=count+pairs.length;pairs.push(e);}
   const even=[];for(const [i,ns]of adj){if(!selected[i]||ns.size<3||[...ns].some(j=>!selected[j]))continue;const blend=earMask(point(R,i),T[i]);if(blend<1e-8)continue;const n=ns.size,beta=(n===3?3/16:3/(8*n))*.86*blend;even.push({i,ns:[...ns],beta});}
   const index=[];for(let k=0;k<g.index.count;k+=3){const a=g.index.array[k],b=g.index.array[k+1],c=g.index.array[k+2],ab=edges.get(key(a,b))?.index??-1,bc=edges.get(key(b,c))?.index??-1,ca=edges.get(key(c,a))?.index??-1,n=[ab,bc,ca].filter(x=>x>=0).length;if(n===3)index.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);else if(!n)index.push(a,b,c);else if(n===1){if(ab>=0)index.push(a,ab,c,ab,b,c);else if(bc>=0)index.push(a,b,bc,a,bc,c);else index.push(a,b,ca,ca,b,c);}else if(ab<0)index.push(a,b,bc,a,bc,ca,ca,bc,c);else if(bc<0)index.push(a,ab,ca,ab,b,c,ab,c,ca);else index.push(a,ab,c,ab,bc,c,ab,b,bc);}
   const next=new THREE.BufferGeometry(),layer={geometry:next,count,pairs,even};
   for(const[name,attr]of Object.entries(g.attributes)){if(name==='normal')continue;const data=new Float32Array((count+pairs.length)*attr.itemSize);this.apply(layer,attr.array,data,attr.itemSize);next.setAttribute(name,new THREE.BufferAttribute(data,attr.itemSize));}
   next.setIndex(index);this.layers.push(layer);g=next;
  }
  this.geometry=g;
  const ref=g.clone();ref.setAttribute('position',g.attributes.fRest.clone());ref.computeVertexNormals();const N=ref.attributes.normal.array,R=g.attributes.fRest.array,T=g.attributes.csType.array;
  this.samples=Array.from({length:g.attributes.position.count},(_,i)=>sampleEar(point(R,i),T[i],N[i*3]));ref.dispose();
  this.centers={};this.anchorIDs={};for(const side of[-1,1]){let best=Infinity,id=0;for(let i=0;i<source.attributes.position.count;i++){const p=point(source.attributes.fRest.array,i);if(p[0]*side<.06)continue;const d=(p[1]-.274)**2+(p[2]-.022)**2+(Math.abs(p[0])-.085)**2;if(d<best){best=d;id=i;}}this.anchorIDs[side]=id;}
 }
 apply(l,a,b,size){b.set(a);for(const {i,ns,beta}of l.even)for(let k=0;k<size;k++){let sum=0;for(const j of ns)sum+=a[j*size+k];b[i*size+k]=a[i*size+k]*(1-ns.length*beta)+sum*beta;}
  for(let j=0;j<l.pairs.length;j++){const e=l.pairs[j];for(let k=0;k<size;k++){const mid=(a[e.a*size+k]+a[e.b*size+k])*.5;let value=mid;if(e.op.length===2){const loop=.375*(a[e.a*size+k]+a[e.b*size+k])+.125*(a[e.op[0]*size+k]+a[e.op[1]*size+k]);value=loop;}b[(l.count+j)*size+k]=value;}}
 }
 update(model){let prev=this.source;for(const l of this.layers){this.apply(l,prev.attributes.position.array,l.geometry.attributes.position.array,3);if(prev.attributes.color){this.apply(l,prev.attributes.color.array,l.geometry.attributes.color.array,3);l.geometry.attributes.color.needsUpdate=true;}l.geometry.attributes.position.needsUpdate=true;prev=l.geometry;}
  const g=this.geometry,Q=g.attributes.position.array,frame=headFrame(model),sz=(frame.sx+frame.sy)*.5,s=model.earStructure.settings;let affected=0,max=0;
  for(let i=0;i<this.samples.length;i++){const q=this.samples[i];if(!q)continue;const p=q.side>0?s.left:s.right,d=earDelta(q,p);const delta=[0,1,2].map(k=>frame.x[k]*d[0]*frame.sx+frame.up[k]*d[1]*frame.sy+frame.front[k]*d[2]*sz);for(let k=0;k<3;k++)Q[i*3+k]+=delta[k];max=Math.max(max,Math.hypot(...delta));affected++;}
  g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  for(let i=0;i<this.source.attributes.position.count;i++)if(!earROI(point(this.source.attributes.fRest.array,i),this.source.attributes.csType.array[i]))for(let k=0;k<3;k++)g.attributes.normal.array[i*3+k]=this.source.attributes.normal.array[i*3+k];
  g.attributes.normal.needsUpdate=true;for(const side of[-1,1])this.centers[side]=point(Q,this.anchorIDs[side]);this.frame=frame;
  this.stats={version:'ET18-A1',mode:'native continuous ear with two adaptive Loop stencils and anatomical fields',subdivisionLevels:2,addedDisplayVertices:g.attributes.position.count-this.source.attributes.position.count,affectedDisplayVertices:affected,maxAuthoredDeltaMM:max*1000,coordinateFrame:'retained common-person Y-up/Z-forward landmark frame',canonicalBuffersModified:false,extraHeadMeshes:0,scanMeshSpliced:false,scanUse:'inspection and authored structural calibration, not exact reconstruction',externalAuditoryCanal:'visible native entrance refined; full canal and cartilage volume not reconstructed'};
  return g;
 }
 dispose(){for(const l of this.layers)l.geometry.dispose();}
}

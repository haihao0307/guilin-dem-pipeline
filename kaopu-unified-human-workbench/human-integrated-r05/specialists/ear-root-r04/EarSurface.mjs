import * as THREE from '../full/source/registration-vendor/three.module.js';
import {EarGuard} from '../ear-refinement-r03/EarGuard.mjs';
import {EAR_VERSION} from './EarParameters.mjs';
import {point,sampleEar,earDelta,headFrame,resolvePhenotype} from './EarMath.mjs';
/** One conforming midpoint refinement INSIDE the owned pinna. No Loop even
 * vertex smoothing; no positional selection box; no movement of scalp vertices.
 * Rest-space ownership is inherited, never reclassified after posing. */
export class EarSurface{
 constructor(source,domain){
  this.source=source;this.domain=domain;
  if(!source.attributes.eWeight||!source.attributes.eOwned)throw Error('EAR-R04: missing bound ear ownership');
  const W=source.attributes.eWeight.array,count=source.attributes.position.count,edges=new Map(),pairs=[],key=(a,b)=>a<b?a+','+b:b+','+a;
  for(let k=0;k<source.index.count;k+=3){const ids=Array.from(source.index.array.slice(k,k+3));if(ids.every(i=>W[i]>0))for(let e=0;e<3;e++){const a=ids[e],b=ids[(e+1)%3],id=key(a,b);if(!edges.has(id)){edges.set(id,count+pairs.length);pairs.push([a,b]);}}}
  const index=[];
  for(let k=0;k<source.index.count;k+=3){const a=source.index.array[k],b=source.index.array[k+1],c=source.index.array[k+2],ab=edges.get(key(a,b))??-1,bc=edges.get(key(b,c))??-1,ca=edges.get(key(c,a))??-1,n=[ab,bc,ca].filter(i=>i>=0).length;
   if(n===3)index.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);else if(!n)index.push(a,b,c);else if(n===1){if(ab>=0)index.push(a,ab,c,ab,b,c);else if(bc>=0)index.push(a,b,bc,a,bc,c);else index.push(a,b,ca,ca,b,c);}else if(ab<0)index.push(a,b,bc,a,bc,ca,ca,bc,c);else if(bc<0)index.push(a,ab,ca,ab,b,c,ab,c,ca);else index.push(a,ab,c,ab,bc,c,ab,b,bc);
  }
  this.pairs=pairs;this.count=count;const g=new THREE.BufferGeometry();
  for(const[name,a]of Object.entries(source.attributes)){const data=new Float32Array((count+pairs.length)*a.itemSize);this.interpolate(a.array,data,a.itemSize);g.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));}g.setIndex(index);this.geometry=g;
  const ref=g.clone();ref.setAttribute('position',g.attributes.fRest.clone());ref.computeVertexNormals();const R=g.attributes.fRest.array,T=g.attributes.csType.array,N=ref.attributes.normal.array,D=g.attributes.eWeight.array;
  this.samples=Array.from({length:g.attributes.position.count},(_,i)=>sampleEar(point(R,i),T[i],N[i*3],D[i]));ref.dispose();
  this.guard=new EarGuard(g,this.samples);this.baseBuffer=new Float32Array(g.attributes.position.array.length);this.deltaBuffer=new Float32Array(this.baseBuffer.length);this.centers={};this.anchorIDs={};
  for(const side of[-1,1]){let best=Infinity,id=-1;for(let i=0;i<count;i++){if(W[i]<.5||R[i*3]*side<0)continue;const d=(R[i*3+1]-.274)**2+(R[i*3+2]-.022)**2+(Math.abs(R[i*3])-.085)**2;if(d<best){best=d;id=i;}}if(id<0)throw Error('EAR-R04: missing pinna camera anchor');this.anchorIDs[side]=id;}
 }
 interpolate(a,b,size){b.set(a);for(let j=0;j<this.pairs.length;j++){const[x,y]=this.pairs[j];for(let k=0;k<size;k++)b[(this.count+j)*size+k]=(a[x*size+k]+a[y*size+k])*.5;}}
 update(model,frame=headFrame(model)){
  const g=this.geometry,Q=g.attributes.position.array,s=model.earStructure.settings,sz=(frame.sx+frame.sy)*.5;
  this.interpolate(this.source.attributes.position.array,Q,3);if(this.source.attributes.color){this.interpolate(this.source.attributes.color.array,g.attributes.color.array,3);g.attributes.color.needsUpdate=true;}
  this.baseBuffer.set(Q);this.deltaBuffer.fill(0);
  const plans={left:{...resolvePhenotype(s.left),hinge:this.domain.hinges.left},right:{...resolvePhenotype(s.right),hinge:this.domain.hinges.right}};let affected=0,max=0;
  for(let i=0;i<this.samples.length;i++){const q=this.samples[i];if(!q)continue;const which=q.side>0?'left':'right',d=earDelta(q,s[which],plans[which]);for(let k=0;k<3;k++)this.deltaBuffer[i*3+k]=frame.x[k]*d[0]*frame.sx+frame.up[k]*d[1]*frame.sy+frame.front[k]*d[2]*sz;max=Math.max(max,Math.hypot(this.deltaBuffer[i*3],this.deltaBuffer[i*3+1],this.deltaBuffer[i*3+2]));affected++;}
  const guard=this.guard.solve(this.baseBuffer,this.deltaBuffer,Q,this.samples,frame);
  g.attributes.position.needsUpdate=true;g.computeVertexNormals();
  // Zero-weight scalp/root normals retain the upstream surface exactly. The
  // geodesic collar has zero slope at its endpoints, not a cropped normal patch.
  const W=g.attributes.eWeight.array,S=this.source.attributes.normal.array,N=g.attributes.normal.array;let protectedCount=0,positionDrift=0,normalDrift=0;
  for(let i=0;i<this.count;i++)if(W[i]===0){protectedCount++;for(let k=0;k<3;k++){N[i*3+k]=S[i*3+k];positionDrift=Math.max(positionDrift,Math.abs(Q[i*3+k]-this.source.attributes.position.array[i*3+k]));normalDrift=Math.max(normalDrift,Math.abs(N[i*3+k]-S[i*3+k]));}}
  if(positionDrift!==0)throw Error('EAR-R04 invariant failed: protected scalp moved');
  g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();for(const side of[-1,1])this.centers[side]=point(Q,this.anchorIDs[side]);this.frame=frame;
  this.stats={version:EAR_VERSION,mode:'topological pinna ownership / fixed scalp / pinned geodesic root collar',domain:this.domain.report,guard,phenotype:plans,subdivisionLevels:1,subdivision:'conforming midpoint; no Loop displacement',addedDisplayVertices:g.attributes.position.count-this.count,affectedDisplayVertices:affected,maxAuthoredDeltaMM:max*1000,protectedDisplayVertices:protectedCount,protectedMaxDisplacementMM:positionDrift*1000,protectedMaxNormalChange:normalDrift,canonicalBuffersModified:false,extraHeadMeshes:0,scanMeshSpliced:false,growthSimulation:false,globalCollisionDetection:false};return g;
 }
 dispose(){this.geometry.dispose();}
}

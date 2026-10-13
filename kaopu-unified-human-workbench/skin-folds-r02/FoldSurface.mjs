import {SmoothSkinNormals} from './SmoothSkinNormals.mjs';
import {FairSkin} from './FairSkin.mjs';
import * as THREE from '../full/source/registration-vendor/three.module.js';
import {foldAt,protectedSkin,GEOMETRY_KEYS,clamp,smooth,splitFace} from './FoldMath.mjs';
/** Fixed edge stencils, not stacked tissue meshes. Native topology/buffers stay
 * read-only. All deformation precedes the retained idle blendshape bake. */
export class FoldSurface {
 constructor(source,model){
  this.prepared=[];this.cacheEnabled=true;this.cacheHits=0;this.cacheMisses=0;this.source=source;this.model=model;this.layers=[];this.fieldKey='';let g=source,added=0;
  for(let level=0;level<2;level++){
   const P=g.attributes.fRest.array,T=g.attributes.csType.array,A=g.attributes.fA.array,B=g.attributes.fB.array,n=g.attributes.position.count;
   const chosen=new Uint8Array(n);for(let i=0;i<n;i++){const x=P[i*3]*1000,y=P[i*3+1]*1000;chosen[i]=T[i]<.5&&A[i*4]>.18&&A[i*4+1]<.03&&B[i*4+2]<.25&&protectedSkin(x,y)?1:0;}
   const edges=new Map(),pairs=[],key=(a,b)=>a<b?a+','+b:b+','+a,minEdge=level===0?.00135:.00080;
   const idx=g.index.array;for(let k=0;k<idx.length;k+=3){const ids=[idx[k],idx[k+1],idx[k+2]];if(!ids.every(i=>chosen[i]))continue;for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],id=key(a,b);if(edges.has(id))continue;const d=Math.hypot(P[a*3]-P[b*3],P[a*3+1]-P[b*3+1],P[a*3+2]-P[b*3+2]);if(d<minEdge||added+pairs.length>=55000)continue;edges.set(id,n+pairs.length);pairs.push([a,b]);}}
   if(!pairs.length)break;const next=new THREE.BufferGeometry(),out=[];
   for(let k=0;k<idx.length;k+=3){const a=idx[k],b=idx[k+1],c=idx[k+2];splitFace(a,b,c,edges.get(key(a,b))??-1,edges.get(key(b,c))??-1,edges.get(key(c,a))??-1,out);}
   for(const [name,attr]of Object.entries(g.attributes)){if(name==='normal')continue;const size=attr.itemSize,data=new Float32Array((n+pairs.length)*size);data.set(attr.array);for(let j=0;j<pairs.length;j++){const[a,b]=pairs[j];for(let q=0;q<size;q++)data[(n+j)*size+q]=(attr.array[a*size+q]+attr.array[b*size+q])*.5;}next.setAttribute(name,new THREE.BufferAttribute(data,size));}
   next.setIndex(out);this.layers.push({geometry:next,pairs,n});added+=pairs.length;g=next;
  }
  if(!this.layers.length){g=source.clone();this.layers.push({geometry:g,pairs:[],n:source.attributes.position.count});}
  this.geometry=g;
  const masks=new Float32Array(g.attributes.position.count),R=g.attributes.fRest.array,T=g.attributes.csType.array;
  for(let i=0;i<masks.length;i++){const x=R[i*3]*1000,y=R[i*3+1]*1000;if(T[i]>=.5||!protectedSkin(x,y))continue;let gate=this.coverage(i)*smooth(204,219,y)*(1-smooth(368,383,y))*(1-smooth(59,70,Math.abs(x)));
   for(const cx of [-31,31])gate*=smooth(1,1.6,((x-cx)/18.2)**2+((y-301)/8.4)**2);
   gate*=smooth(1,1.6,(x/27.8)**2+((y-232)/15.2)**2);masks[i]=gate>.0001?gate:0;
  }
  this.fair=new FairSkin(g.index.array,masks);this.normalPolish=new SmoothSkinNormals(this.fair);this.delta=new Float32Array(g.attributes.position.count*3);this.base=new Float32Array(this.delta.length);this.stats={addedVertices:added,sourceVertices:source.attributes.position.count,displayVertices:g.attributes.position.count};
 }
 coverage(i){const g=this.geometry,A=g.attributes.fA.array,B=g.attributes.fB.array;return clamp(A[i*4])*(1-clamp(A[i*4+1]*5))*(1-clamp(B[i*4+2]*3))*(1-clamp(A[i*4+3]*.92));}
 restorePrepared(){
  const P=this.source.attributes.position.array,N=this.source.attributes.normal.array;
  const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
  const index=this.cacheEnabled?this.prepared.findIndex(c=>same(c.sourceP,P)&&same(c.sourceN,N)):-1;
  if(index<0){this.cacheMisses++;return false;}
  const c=this.prepared.splice(index,1)[0];this.prepared.unshift(c);this.cacheHits++;
  this.geometry.attributes.position.array.set(c.p);this.geometry.attributes.normal.array.set(c.n);
  this.normalPolish.base.set(c.n);this.normalPolish.smooth.set(c.smooth);
  this.normalPolish.report={...c.polish};this.fairStats={...c.fair};
  let prev=this.source;for(const l of this.layers){const a=prev.attributes.color?.array,b=l.geometry.attributes.color?.array;
   if(a&&b){b.set(a);for(let j=0;j<l.pairs.length;j++)for(let q=0;q<3;q++)b[(l.n+j)*3+q]=(a[l.pairs[j][0]*3+q]+a[l.pairs[j][1]*3+q])*.5;l.geometry.attributes.color.needsUpdate=true;}prev=l.geometry;}
  return true;
 }
 savePrepared(){
  if(!this.cacheEnabled)return;
  this.prepared.unshift({sourceP:this.source.attributes.position.array.slice(),sourceN:this.source.attributes.normal.array.slice(),
   p:this.geometry.attributes.position.array.slice(),n:this.geometry.attributes.normal.array.slice(),smooth:this.normalPolish.smooth.slice(),
   polish:{...this.normalPolish.report},fair:{...this.fairStats}});
  if(this.prepared.length>2)this.prepared.pop();
 }
 cacheReport(){return{hits:this.cacheHits,misses:this.cacheMisses,entries:this.prepared.length,maxEntries:2,
  bytes:this.prepared.reduce((n,c)=>n+c.sourceP.byteLength+c.sourceN.byteLength+c.p.byteLength+c.n.byteLength+c.smooth.byteLength,0),
  match:'exact source position and normal values; not version-counter or hash-only',lastHit:this.lastCacheHit};}
 update(settings){
  const started=performance.now();this.lastCacheHit=this.restorePrepared();
  if(!this.lastCacheHit){let prev=this.source;
  for(const l of this.layers){const P=prev.attributes.position.array,N=prev.attributes.normal.array,Q=l.geometry.attributes.position.array;Q.set(P);for(let j=0;j<l.pairs.length;j++){const[a,b]=l.pairs[j],ai=a*3,bi=b*3,qi=(l.n+j)*3;let da=0,db=0;for(let q=0;q<3;q++){Q[qi+q]=(P[ai+q]+P[bi+q])*.5;da+=(Q[qi+q]-P[ai+q])*N[ai+q];db+=(Q[qi+q]-P[bi+q])*N[bi+q];}const agree=N[ai]*N[bi]+N[ai+1]*N[bi+1]+N[ai+2]*N[bi+2];if(agree>.80)for(let q=0;q<3;q++)Q[qi+q]+=clamp(-.24*(da*N[ai+q]+db*N[bi+q]),-.00008,.00008);}
   if(prev.attributes.color){const C=prev.attributes.color.array,D=l.geometry.attributes.color.array;D.set(C);for(let j=0;j<l.pairs.length;j++)for(let q=0;q<3;q++)D[(l.n+j)*3+q]=(C[l.pairs[j][0]*3+q]+C[l.pairs[j][1]*3+q])*.5;l.geometry.attributes.color.needsUpdate=true;}
   l.geometry.attributes.position.needsUpdate=true;l.geometry.computeVertexNormals();prev=l.geometry;
  }
  const g=this.geometry;this.fairStats=this.fair.apply(g.attributes.position.array,g.attributes.normal.array);g.computeVertexNormals();
  this.normalPolish.capture(g.attributes.normal.array);this.savePrepared();}
  const g=this.geometry;
  const R=g.attributes.fRest.array,T=g.attributes.csType.array,Q=g.attributes.position.array,N=g.attributes.normal.array,key=GEOMETRY_KEYS.map(k=>settings[k]).join('|');
  if(key!==this.fieldKey){for(let i=0;i<T.length;i++){const d=T[i]<.5?foldAt(R[i*3]*1000,R[i*3+1]*1000,settings,this.coverage(i)):[0,0,0];this.delta.set(d,i*3);}this.fieldKey=key;}
  this.base.set(Q);
  const fields=this.model.faceSurface.fields,L=id=>fields.landmark(this.model.positions,id),toView=p=>new THREE.Vector3(p[0],p[2],-p[1]);
  const x=toView(L(45)).sub(toView(L(36))).normalize(),up=toView(L(27)).sub(toView(L(8)));up.addScaledVector(x,-up.dot(x)).normalize();
  let affected=0,max=0,pos=0,neg=0,protectedDelta=0;
  for(let i=0;i<T.length;i++){const k=i*3,depth=this.delta[k]*.001,tx=this.delta[k+1]*.001,ty=this.delta[k+2]*.001;if(!depth&&!tx&&!ty)continue;
   let sq=0;for(let q=0;q<3;q++){const d=N[k+q]*depth+x.getComponent(q)*tx+up.getComponent(q)*ty;Q[k+q]+=d;sq+=d*d;}max=Math.max(max,Math.sqrt(sq)*1000);if(depth>0)pos++;if(depth<0)neg++;affected++;
   if(T[i]>=.5||!protectedSkin(R[k]*1000,R[k+1]*1000))protectedDelta=Math.max(protectedDelta,Math.sqrt(sq));
  }
  g.attributes.position.needsUpdate=true;g.computeVertexNormals();this.normalPolishStats=this.normalPolish.compose(g.attributes.normal.array);g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();
  this.stats={...this.stats,preparedCache:this.cacheReport(),fairing:this.fairStats,baseNormalPolish:this.normalPolishStats,affectedVertices:affected,positiveRollVertices:pos,valleyVertices:neg,maxDeltaMM:max,protectedDeltaMM:protectedDelta*1000,updateMS:performance.now()-started,canonicalModified:false,bodyModified:false,extraHeadMeshes:0,foldSource:'CPU display-vertex positions + recomputed normals; included in native-derived idle GPU bases',physicalSkinSimulation:false};return g;
 }
 dispose(){this.prepared.length=0;for(const l of this.layers)l.geometry.dispose();}
}

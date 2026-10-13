import * as THREE from '../full/source/registration-vendor/three.module.js';
import {SurfaceFairing} from './SurfaceFairing.mjs';
import {clamp,smooth,makeLayout,sampleLayout,foldProfile,GROUPS} from './FoldKernel.mjs';
const point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
/** Adaptive, fixed-rest edge stencils. Only the same head's SKIN is refined. Every
 * split edge is shared by adjacent faces, including transitional triangles. */
export class FoldSurface{
 constructor(source,model){
  const start=performance.now();this.source=source;this.layers=[];this.bodyCount=model.bodyCount;const f=model.faceSurface.fields;
  this.layout=makeLayout(Array.from({length:68},(_,i)=>f.landmark(f.rest,i)));
  this.referenceEyeSpan=Math.max(.03,this.layout.eyeSpan*.001);let g=source,added=0;const budget=42000;
  const sample=(geo,i)=>{const a=geo.attributes,R=a.fRest.array,A=a.fA.array,B=a.fB.array;if(a.csType.array[i]>.01||i<this.bodyCount)return{mask:0,sag:0,folds:[]};return sampleLayout(R[i*3]*1000,R[i*3+1]*1000,R[i*3+2]*1000,A[i*4],A[i*4+1],A[i*4+3],B[i*4+2],this.layout);};
  for(let level=0;level<3&&added<budget;level++){
   const n=g.attributes.position.count,R=g.attributes.fRest.array,selection=new Float32Array(n),edges=new Map(),pairs=[],key=(a,b)=>a<b?a+','+b:b+','+a;
   for(let i=this.bodyCount;i<n;i++){const q=sample(g,i);selection[i]=q.mask*(q.folds[0]?.support||0);}
   const threshold=(level===0?1.35:level===1?1.10:.90)*this.layout.scale;
   for(let k=0;k<g.index.count;k+=3){const a=g.index.array[k],b=g.index.array[k+1],c=g.index.array[k+2];for(const [u,v]of[[a,b],[b,c],[c,a]]){
    if(added+pairs.length>=budget||selection[u]<.015||selection[v]<.015)continue;const id=key(u,v);if(edges.has(id))continue;
    const len=Math.hypot(R[u*3]-R[v*3],R[u*3+1]-R[v*3+1],R[u*3+2]-R[v*3+2])*1000;if(len<=threshold)continue;edges.set(id,n+pairs.length);pairs.push([u,v]);
   }}
   if(!pairs.length)break;
   const indices=[];for(let k=0;k<g.index.count;k+=3){const a=g.index.array[k],b=g.index.array[k+1],c=g.index.array[k+2],ab=edges.get(key(a,b))??-1,bc=edges.get(key(b,c))??-1,ca=edges.get(key(c,a))??-1,count=(ab>=0)+(bc>=0)+(ca>=0);
    if(!count)indices.push(a,b,c);else if(count===3)indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);else if(count===1){if(ab>=0)indices.push(a,ab,c,ab,b,c);else if(bc>=0)indices.push(a,b,bc,a,bc,c);else indices.push(a,b,ca,ca,b,c);}else if(ab<0)indices.push(a,b,bc,a,bc,ca,ca,bc,c);else if(bc<0)indices.push(a,ab,ca,ab,b,c,ab,c,ca);else indices.push(a,ab,c,ab,bc,c,ab,b,bc);
   }
   const next=new THREE.BufferGeometry();for(const[name,a]of Object.entries(g.attributes)){if(name==='normal')continue;const size=a.itemSize,data=new Float32Array((n+pairs.length)*size);data.set(a.array);for(let j=0;j<pairs.length;j++){const[u,v]=pairs[j];for(let c=0;c<size;c++)data[(n+j)*size+c]=(a.array[u*size+c]+a.array[v*size+c])*.5;}next.setAttribute(name,new THREE.BufferAttribute(data,size,a.normalized));}next.setIndex(indices);this.layers.push({geometry:next,pairs,oldCount:n});g=next;added+=pairs.length;
  }
  if(!this.layers.length){g=source.clone();this.layers.push({geometry:g,pairs:[],oldCount:source.attributes.position.count});}
  this.geometry=g;const N=g.attributes.position.count;this.data=new Float32Array(N*16);this.info=new Float32Array(N);g.setAttribute('kFoldMM',new THREE.BufferAttribute(this.info,1));
  this.active=[];for(let i=this.bodyCount;i<N;i++){const q=sample(g,i),o=i*16;this.data[o]=q.mask;this.data[o+1]=q.sag;if(q.mask>.001)this.active.push(i);for(let j=0;j<q.folds.length;j++){const v=q.folds[j],p=o+2+j*7;this.data.set([v.distance,v.gate,v.width,v.group,v.nx,v.ny,v.support],p);}}
  this.buildMS=performance.now()-start;this.added=added;this.stats={};this.up=new THREE.Vector3();this.right=new THREE.Vector3();this.basePositions=new Float32Array(N*3);this.baseNormals=new Float32Array(N*3);this.fairing=new SurfaceFairing(g,this.bodyCount);this.baseReady=false;
 }
 update(model,s,withoutFolds=false,geometryFresh=true){
  const start=performance.now();let prev=this.source;
  if(geometryFresh||!this.baseReady){
  for(const layer of this.layers){const next=layer.geometry,oldP=prev.attributes.position.array,oldN=prev.attributes.normal.array,P=next.attributes.position.array;P.set(oldP);
   for(let j=0;j<layer.pairs.length;j++){const[a,b]=layer.pairs[j],u=a*3,v=b*3,k=(layer.oldCount+j)*3;const mx=(oldP[u]+oldP[v])*.5,my=(oldP[u+1]+oldP[v+1])*.5,mz=(oldP[u+2]+oldP[v+2])*.5;P[k]=mx;P[k+1]=my;P[k+2]=mz;
    const dot=oldN[u]*oldN[v]+oldN[u+1]*oldN[v+1]+oldN[u+2]*oldN[v+2];if(dot>.88){const da=(mx-oldP[u])*oldN[u]+(my-oldP[u+1])*oldN[u+1]+(mz-oldP[u+2])*oldN[u+2],db=(mx-oldP[v])*oldN[v]+(my-oldP[v+1])*oldN[v+1]+(mz-oldP[v+2])*oldN[v+2];let dx=-.22*(da*oldN[u]+db*oldN[v]),dy=-.22*(da*oldN[u+1]+db*oldN[v+1]),dz=-.22*(da*oldN[u+2]+db*oldN[v+2]);const kf=Math.min(1,.000065/(Math.hypot(dx,dy,dz)||1));P[k]+=dx*kf;P[k+1]+=dy*kf;P[k+2]+=dz*kf;}
   }
   if(prev.attributes.color&&next.attributes.color){const A=prev.attributes.color.array,B=next.attributes.color.array;B.set(A);for(let j=0;j<layer.pairs.length;j++)for(let k=0;k<3;k++)B[(layer.oldCount+j)*3+k]=(A[layer.pairs[j][0]*3+k]+A[layer.pairs[j][1]*3+k])*.5;next.attributes.color.needsUpdate=true;}
   next.attributes.position.needsUpdate=true;next.computeVertexNormals();prev=next;
  }
  this.fairingStats=this.fairing.apply(this.geometry);this.basePositions.set(this.geometry.attributes.position.array);this.baseNormals.set(this.geometry.attributes.normal.array);this.baseReady=true;
  }
  const g=this.geometry,P=g.attributes.position.array,N=g.attributes.normal.array,R=g.attributes.fRest.array;P.set(this.basePositions);N.set(this.baseNormals);this.info.fill(0);
  const L=i=>model.faceSurface.fields.landmark(model.positions,i),toDisplay=p=>new THREE.Vector3(p[0],p[2],-p[1]),left=toDisplay(L(36)),right=toDisplay(L(45)),chin=toDisplay(L(8)),bridge=toDisplay(L(27));this.right.copy(right).sub(left).normalize();this.up.copy(bridge).sub(chin).normalize();this.up.addScaledVector(this.right,-this.up.dot(this.right)).normalize();
  const scale=clamp(right.distanceTo(left)/this.referenceEyeSpan,.4,1.9),legacy=model.identityLab?.traits||{},weights=GROUPS.map(k=>Math.max(s[k],legacy[k]||0)),activeFolds=s.folds&&!withoutFolds,delta=new THREE.Vector3();let affected=0,max=0,contracted=0,raised=0,depressed=0;
  const moles=Math.max(s.moles,legacy.moles||0),mX=s.moles? s.moleX:legacy.moleX,mY=s.moles?s.moleY:legacy.moleY,mR=s.moles?s.moleSize:legacy.moleSize;
  for(const i of this.active){const o=i*16,mask=this.data[o],nx=N[i*3],ny=N[i*3+1],nz=N[i*3+2];let height=0,tx=0,ty=0;
   if(activeFolds){for(let j=0;j<2;j++){const k=o+2+j*7,gate=this.data[k+1];if(!gate)continue;const v=foldProfile(this.data[k],this.data[k+2],s,weights[this.data[k+3]]);height+=v.height*gate;tx+=v.tangent*this.data[k+4]*gate;ty+=v.tangent*this.data[k+5]*gate;}
    const sag=s.sag*s.slack*(1-s.tension)*this.data[o+1];ty-=1.35*sag;height+=.24*sag;tx-=Math.sign(R[i*3])*.15*sag;
   }
   if(moles>0&&mR>0){const d=Math.hypot((R[i*3]*1000-mX)/mR,(R[i*3+1]*1000-mY)/(mR*.88));height+=moles*s.moleRelief*Math.exp(-d*d*1.7);}
   height*=mask;tx*=mask;ty*=mask;
   const ax=this.right.x*tx+this.up.x*ty,ay=this.right.y*tx+this.up.y*ty,az=this.right.z*tx+this.up.z*ty,projection=ax*nx+ay*ny+az*nz;
   delta.set(nx*height+ax-nx*projection,ny*height+ay-ny*projection,nz*height+az-nz*projection).multiplyScalar(.001*scale);const len=delta.length(),cap=.0022*scale;if(len>cap)delta.multiplyScalar(cap/len);if(len<1e-10)continue;P[i*3]+=delta.x;P[i*3+1]+=delta.y;P[i*3+2]+=delta.z;const mm=Math.min(len,cap)*1000;this.info[i]=mm;max=Math.max(max,mm);affected++;contracted=Math.max(contracted,Math.hypot(tx,ty)*scale);raised=Math.max(raised,height*scale);depressed=Math.min(depressed,height*scale);
  }
  if(!P.every(Number.isFinite))throw Error('褶皱生成非有限顶点');g.attributes.position.needsUpdate=true;g.attributes.kFoldMM.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  this.stats={method:'same native-derived skin; fixed-rest adaptive stencils + bounded soft buckling rolls / in-plane shortening / cheek sag',displayVertices:P.length/3,addedDisplayVertices:this.added,displayTriangles:g.index.count/3,affectedVertices:affected,maxDeltaMM:max,maxRaisedMM:raised,maxTroughMM:depressed,maxTangentialMM:contracted,baseFairing:this.fairingStats,cachedRestReused:!geometryFresh,buildMS:this.buildMS,updateMS:performance.now()-start,originalBodyMoved:false,extraFaceMesh:false,wrinkleHeightTexture:false,foldsEnabled:activeFolds,constitutiveTissueSimulation:false};return g;
 }
 dispose(){for(const l of this.layers)l.geometry.dispose();this.active=[];}
}

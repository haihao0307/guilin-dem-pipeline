import * as THREE from '../full/source/registration-vendor/three.module.js';
export {THREE};
const texture=(a,width=2048)=>{const h=Math.ceil(a.length/4/width),data=new Float32Array(width*h*4);data.set(a);const t=new THREE.DataTexture(data,width,h,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;};
const native=(a,i)=>[a[i*3],-a[i*3+2],a[i*3+1]];
const rowMatrix=a=>new THREE.Matrix4().fromArray(a).transpose();
const rowArray=m=>m.clone().transpose().toArray();
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
/** Attach to the SAME R04 mesh/material. Preserve every influence, original
 * vertex/index, regional attribute and midpoint refinement ancestor. No mesh import.
 * Canonical data are Z-up; R04 displayed positions have already been converted
 * to Y-up. Shader conversion is explicit in both directions. */
export class NativeBinding {
 constructor(model,viewer){
  this.model=model;this.viewer=viewer;this.mesh=viewer.mesh;this.geometry=viewer.geometry;this.material=this.mesh.material;this.positions=model.positions.slice();this.N=model.vertexCount;this.faces=model.faces;this.rig=structuredClone(model.lastBodyDriver.rig);this.names=this.rig.names;
  if(model.state.owners.rig!=='anny')throw Error('This review requires the retained native Anny rig; no silent skeleton substitution.');
  let lo=Infinity,hi=-Infinity;for(let i=2;i<this.positions.length;i+=3){lo=Math.min(lo,this.positions[i]);hi=Math.max(hi,this.positions[i]);}this.height=hi-lo;this.floorOffset=-lo;
  const packet=model.lastBodyDriver.packet,w=packet.weights,c=model.canonical,rows=[];let influenceCount=0;
  for(let i=0;i<this.N;i++){
   let r=[];if(i<model.bodyCount){let s=[0,0,0],sw=0;for(let k=w.ptr[i];k<w.ptr[i+1];k++){const weight=w.values[k],p=Array.from(packet.restPositionsPerInfluence.slice(k*3,k*3+3));sw+=weight;for(let q=0;q<3;q++)s[q]+=p[q]*weight;r.push({j:w.joints[k],w:weight,p});}for(const a of r)for(let q=0;q<3;q++)a.p[q]+=(this.positions[i*3+q]-s[q])/(sw||1);
   }else{const k=i-model.bodyCount;r=c.headSkinIndices[k].map((j,n)=>({j,w:c.headSkinWeights[k][n],p:Array.from(this.positions.slice(i*3,i*3+3))}));}rows.push(r);influenceCount+=r.length;
  }
  // Keep the original native descriptor for source foot/hand calibration.
  const baseEntries=[],baseRange=new Float32Array(this.N*2);for(let i=0;i<this.N;i++){baseRange.set([baseEntries.length/8,rows[i].length],i*2);for(const a of rows[i])baseEntries.push(...a.p,a.j,a.w,0,0,0);}this.range=baseRange;this.packed=new Float32Array(baseEntries);
  const stages=[];
  // R04 probe: original DenseSurface levels and OcularSurface precede lips.
  const dense=[...(viewer.surfaces?.values()||[])].find(s=>s.geometry===viewer.currentOcular?.source);
  if(!dense)throw Error("Original dense head ancestry unavailable");
  for(const x of dense.levels)stages.push({n:x.oldCount,pairs:x.pairs,count:x.geometry.attributes.position.count});
  const ocular=viewer.currentOcular;stages.push({n:ocular.source.attributes.position.count,pairs:ocular.pairs,count:ocular.geometry.attributes.position.count});
  for(const owner of [viewer.currentLip,viewer.currentFold])for(const x of owner?.layers||[])stages.push({n:x.oldCount??x.n,pairs:x.pairs,count:x.geometry.attributes.position.count});
  const e=viewer.currentEar;if(e&&viewer.geometry===e.geometry)stages.push({n:e.count,pairs:e.pairs,count:e.geometry.attributes.position.count});
  stages.sort((a,b)=>a.n-b.n);const lineage=[];
  for(const stage of stages){if(stage.n<rows.length)continue;if(stage.n!==rows.length)throw Error('Missing refined-surface ancestry: '+rows.length+' -> '+stage.n);for(const [u,v]of stage.pairs){if(u>=stage.n||v>=stage.n)throw Error('Invalid midpoint ancestor');const merged=new Map();for(const id of [u,v])for(const a of rows[id]){let b=merged.get(a.j);if(!b){b={j:a.j,w:0,p:[0,0,0]};merged.set(a.j,b);}const weight=a.w*.5;b.w+=weight;for(let q=0;q<3;q++)b.p[q]+=a.p[q]*weight;}const r=[];for(const b of merged.values()){if(b.w<=0)continue;for(let q=0;q<3;q++)b.p[q]/=b.w;r.push(b);}rows.push(r);}if(rows.length!==stage.count)throw Error('Midpoint count mismatch');lineage.push({from:stage.n,to:stage.count});}
  const P=this.geometry.attributes.position.array,D=this.geometry.attributes.position.count;if(rows.length!==D)throw Error('Unbound R04 display vertices: '+rows.length+' / '+D);
  const ranges=new Float32Array(D*4),entries=[];let max=0,neutralError=0;
  for(let i=0;i<D;i++){const r=rows[i],p=native(P,i),sum=[0,0,0];let sw=0;for(const a of r){sw+=a.w;for(let q=0;q<3;q++)sum[q]+=a.w*a.p[q];}if(Math.abs(sw-1)>1e-4)throw Error('Native influence weight sum '+sw);ranges.set([entries.length/8,r.length,0,0],i*4);max=Math.max(max,r.length);const check=[0,0,0];for(const a of r){for(let q=0;q<3;q++){a.p[q]+=(p[q]-sum[q])/sw;check[q]+=a.w*a.p[q];}entries.push(...a.p,a.j,a.w,0,0,0);}for(let q=0;q<3;q++)neutralError=Math.max(neutralError,Math.abs(check[q]-p[q]));}
  this.displayRange=ranges;this.displayPacked=new Float32Array(entries);this.ranges=texture(ranges);this.influences=texture(this.displayPacked);this.boneData=new Float32Array(this.names.length*16);this.bones=texture(this.boneData,4);this.U={mrRanges:{value:this.ranges},mrEntries:{value:this.influences},mrBones:{value:this.bones},mrActive:{value:0}};
  const prior=this.material.onBeforeCompile.bind(this.material),key=this.material.customProgramCacheKey.bind(this.material);this.material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,this.U);s.vertexShader=`uniform sampler2D mrRanges,mrEntries,mrBones;uniform float mrActive;
vec4 mrRead(sampler2D t,int k){return texelFetch(t,ivec2(k%2048,k/2048),0);}
vec3 mrP=vec3(0.);mat3 mrR=mat3(1.);
void mrEvaluate(){vec4 range=mrRead(mrRanges,gl_VertexID);mrP=vec3(0.);mrR=mat3(0.);for(int k=0;k<${max};k++){if(k>=int(range.y))break;int s=(int(range.x)+k)*2;vec4 p=mrRead(mrEntries,s);float w=mrRead(mrEntries,s+1).x;int j=int(p.w);vec4 a=texelFetch(mrBones,ivec2(0,j),0),b=texelFetch(mrBones,ivec2(1,j),0),c=texelFetch(mrBones,ivec2(2,j),0);mrP+=w*vec3(dot(a,vec4(p.xyz,1.)),dot(b,vec4(p.xyz,1.)),dot(c,vec4(p.xyz,1.)));mrR+=w*transpose(mat3(a.xyz,b.xyz,c.xyz));}}
vec3 mrToNative(vec3 p){return vec3(p.x,-p.z,p.y);}vec3 mrToWorld(vec3 p){return vec3(p.x,p.z,-p.y);}
`+s.vertexShader;
   for(const anchor of ['#include <beginnormal_vertex>','#include <defaultnormal_vertex>','#include <project_vertex>'])if(!s.vertexShader.includes(anchor))throw Error('R04 shader anchor drift '+anchor);
   s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>','if(mrActive>.5)mrEvaluate();\n#include <beginnormal_vertex>').replace('#include <defaultnormal_vertex>','if(mrActive>.5)objectNormal=mrToWorld(mrR*mrToNative(objectNormal));\n#include <defaultnormal_vertex>').replace('#include <project_vertex>','if(mrActive>.5)transformed=mrToWorld(mrP+mrR*mrToNative(transformed-position));\n#include <project_vertex>');this.lastShader=s;
  };this.material.customProgramCacheKey=()=>key()+'/motion-r01-full-lineage';this.material.needsUpdate=true;this.mesh.frustumCulled=false;
  this.animate(this.names.map(identity));this.report={version:'R04-display-native-binding/1',nativeVertices:this.N,displayVertices:D,triangles:this.geometry.index.count/3,nativeBones:this.names.length,maxInfluences:max,weightsTruncated:false,neutralMaxErrorM:neutralError,lineage,sameMesh:true,sameMaterial:true,bindHierarchyChanged:false,originalAttributesRetained:true,addedGPUBytes:this.ranges.image.data.byteLength+this.influences.image.data.byteLength+this.bones.image.data.byteLength,limitations:['neutral R04 appearance is transported; pose-dependent ear visibility is not recomputed','native linear skinning and inherited joint correctives, not muscle/contact physics']};
 }
 animate(matrices){for(let j=0;j<matrices.length;j++)this.bones.image.data.set(matrices[j],j*16);this.boneData.set(this.bones.image.data.subarray(0,this.boneData.length));this.bones.needsUpdate=true;}
 activate(value=true){this.U.mrActive.value=value?1:0;}
 sampleVertex(i,display=false){const range=display?this.displayRange:this.range,stride=display?4:2,entries=display?this.displayPacked:this.packed,out=[0,0,0];for(let n=0;n<range[i*stride+1];n++){const k=(range[i*stride]+n)*8,j=entries[k+3],w=entries[k+4],m=this.boneData.subarray(j*16,j*16+16);for(let q=0;q<3;q++)out[q]+=w*(m[q*4]*entries[k]+m[q*4+1]*entries[k+1]+m[q*4+2]*entries[k+2]+m[q*4+3]);}return out;}
}
/** Normalize and SLERP local rotations, then FK with immutable rest-local
 * translations. Do NOT interpolate skin matrices (that changes bone lengths). */
export class RigidPoseSampler{
 constructor(rig){this.rig=rig;this.count=rig.names.length;this.rest=rig.restMatrices.map(rowMatrix);this.inverse=this.rest.map(m=>m.clone().invert());this.locals=this.rest.map((m,j)=>rig.parents[j]<0?m.clone():this.inverse[rig.parents[j]].clone().multiply(m));this.bindP=this.locals.map(m=>new THREE.Vector3().setFromMatrixPosition(m));this.order=[];const seen=new Set();while(seen.size<this.count){let added=false;for(let j=0;j<this.count;j++)if(!seen.has(j)&&(rig.parents[j]<0||seen.has(rig.parents[j]))){this.order.push(j);seen.add(j);added=true;}if(!added)throw Error('Cyclic skeleton');}this.world=this.rest.map(m=>m.clone());this.skin=this.rest.map(()=>identity());this.q=new THREE.Quaternion();this.p=new THREE.Vector3();this.one=new THREE.Vector3(1,1,1);this.tmp=new THREE.Matrix4();this.liveQ=new Float32Array(this.count*4);this.liveP=new Float32Array(this.count*3);this.localError=0;}
 pack(matrices){const world=matrices.map(rowMatrix),q=new Float32Array(this.count*4),p=new Float32Array(this.count*3);for(let j=0;j<this.count;j++){const parent=this.rig.parents[j],m=parent<0?world[j]:world[parent].clone().invert().multiply(world[j]);this.q.setFromRotationMatrix(m).normalize().toArray(q,j*4);this.p.setFromMatrixPosition(m).toArray(p,j*3);if(parent>=0)this.localError=Math.max(this.localError,this.p.distanceTo(this.bindP[j]));}return{q,p};}
 interpolate(a,b,t){for(let j=0;j<this.count;j++){THREE.Quaternion.slerpFlat(this.liveQ,j*4,a.q,j*4,b.q,j*4,t);for(let k=0;k<3;k++)this.liveP[j*3+k]=a.p[j*3+k]+(b.p[j*3+k]-a.p[j*3+k])*t;}return{q:this.liveQ,p:this.liveP};}
 apply(pose){for(const j of this.order){const parent=this.rig.parents[j];this.q.fromArray(pose.q,j*4).normalize();if(parent<0)this.p.fromArray(pose.p,j*3);else this.p.copy(this.bindP[j]);this.world[j].compose(this.p,this.q,this.one);if(parent>=0)this.world[j].premultiply(this.world[parent]);this.tmp.copy(this.world[j]).multiply(this.inverse[j]);const e=this.tmp.elements,m=this.skin[j];for(let r=0;r<4;r++)for(let c=0;c<4;c++)m[r*4+c]=e[c*4+r];}return this.skin;}
 boneError(){let error=0;const a=new THREE.Vector3(),b=new THREE.Vector3();for(let j=0;j<this.count;j++){const p=this.rig.parents[j];if(p<0)continue;a.setFromMatrixPosition(this.world[j]);b.setFromMatrixPosition(this.world[p]);error=Math.max(error,Math.abs(a.distanceTo(b)-this.bindP[j].length()));}return error;}
}

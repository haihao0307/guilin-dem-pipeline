import * as THREE from '../source/registration-vendor/three.module.js';
import {CommonSkinLayer} from '../ui/skin/CommonSkinLayer.mjs';
const texture=(data,w,h)=>{const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;return t;};
/** Full canonical topology. All CSR influences are retained, including the
 * joint-conditioned native rest contribution needed at childhood anchors.
 * Shape/head/neck are evaluated by CommonPerson once per preset. The final
 * neutral neck fairing is transported with skinning, not recomputed per frame. */
export class AnimatedHuman {
 constructor(model,state,{color=0x3f92d2,tone=.64}={}) {
  this.state=structuredClone(state);this.positions=model.positions.slice();this.faces=model.faces;this.rig=structuredClone(model.lastBodyDriver.rig);this.names=this.rig.names;this.N=model.vertexCount;
  const packet=model.lastBodyDriver.packet,w=packet.weights,c=model.canonical,entries=[],range=new Float32Array(this.N*2),cloth=new Float32Array(this.N),colors=new Float32Array(this.N*3).fill(1);
  let maxInfluences=0,neutralError=0;const minZ=Math.min(...Array.from(this.positions).filter((_,i)=>i%3===2)),maxZ=Math.max(...Array.from(this.positions).filter((_,i)=>i%3===2));this.height=maxZ-minZ;this.floorOffset=-minZ;
  for(let i=0;i<this.N;i++){
   const first=entries.length/8;let rows=[];
   if(i<model.bodyCount){let sum=[0,0,0],sw=0;for(let k=w.ptr[i];k<w.ptr[i+1];k++){const weight=w.values[k],p=Array.from(packet.restPositionsPerInfluence.slice(k*3,k*3+3));sw+=weight;for(let q=0;q<3;q++)sum[q]+=p[q]*weight;rows.push({j:w.joints[k],weight,p});}const delta=sum.map((v,q)=>(this.positions[i*3+q]-v)/(sw||1));for(const r of rows)r.p=r.p.map((v,q)=>v+delta[q]);
   }else{const hi=i-model.bodyCount;rows=c.headSkinIndices[hi].map((j,k)=>({j,weight:c.headSkinWeights[hi][k],p:Array.from(this.positions.slice(i*3,i*3+3))}));}
   const check=[0,0,0];for(const r of rows){entries.push(...r.p,r.j,r.weight,0,0,0);for(let q=0;q<3;q++)check[q]+=r.p[q]*r.weight;}for(let q=0;q<3;q++)neutralError=Math.max(neutralError,Math.abs(check[q]-this.positions[i*3+q]));
   range.set([first,rows.length],i*2);maxInfluences=Math.max(maxInfluences,rows.length);
   if(i<model.bodyCount){const z=(this.positions[i*3+2]-minZ)/this.height;let torso=0;for(const r of rows)if(/spine|pelvis|root|breast|upperleg|hip/.test(this.names[r.j]))torso+=r.weight;cloth[i]=(z>.31&&z<.815&&torso>.12)?1:0;}
  }
  const width=1024,height=Math.ceil(entries.length/4/width),packed=new Float32Array(width*height*4);packed.set(entries);this.influences=texture(packed,width,height);this.boneData=new Float32Array(this.names.length*16);this.bones=texture(this.boneData,4,this.names.length);this.range=range;this.packed=packed;
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));this.geometry.setAttribute('boxRange',new THREE.BufferAttribute(range,2));this.geometry.setAttribute('boxCloth',new THREE.BufferAttribute(cloth,1));this.geometry.setIndex(new THREE.BufferAttribute(this.faces,1));this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();
  this.material=new THREE.MeshStandardMaterial({vertexColors:true});this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.rotation.x=-Math.PI/2;
  const captured=Object.create(model);captured.positions=this.positions;captured.state=this.state;const viewer={model:captured,geometry:this.geometry,mesh:this.mesh,material:this.material,render(){},wire:false,band:false};this.skin=new CommonSkinLayer(viewer,{tone});this.material=viewer.material;
  const prior=this.material.onBeforeCompile.bind(this.material),team=new THREE.Color(color);this.material.customProgramCacheKey=()=>`boxing-full-csr-r1-${maxInfluences}`;
  this.material.onBeforeCompile=shader=>{prior(shader);Object.assign(shader.uniforms,{boxInfluences:{value:this.influences},boxBones:{value:this.bones},boxTeam:{value:team}});
   shader.vertexShader=`uniform sampler2D boxInfluences,boxBones;attribute vec2 boxRange;attribute float boxCloth;varying float vBoxCloth;
vec4 boxRead(int k){return texelFetch(boxInfluences,ivec2(k%1024,k/1024),0);}
vec3 boxPos=vec3(0.);mat3 boxRot=mat3(0.);
void boxEvaluate(){boxPos=vec3(0.);boxRot=mat3(0.);for(int k=0;k<${maxInfluences};k++){if(float(k)>=boxRange.y)break;int s=(int(boxRange.x)+k)*2;vec4 p=boxRead(s);float w=boxRead(s+1).x;int j=int(p.w);vec4 a=texelFetch(boxBones,ivec2(0,j),0),b=texelFetch(boxBones,ivec2(1,j),0),c=texelFetch(boxBones,ivec2(2,j),0);boxPos+=w*vec3(dot(a,vec4(p.xyz,1.)),dot(b,vec4(p.xyz,1.)),dot(c,vec4(p.xyz,1.)));boxRot+=w*transpose(mat3(a.xyz,b.xyz,c.xyz));}}
`+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','boxEvaluate();\n#include <beginnormal_vertex>\nobjectNormal=boxRot*objectNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=boxPos;vBoxCloth=boxCloth;');
   shader.fragmentShader='uniform vec3 boxTeam;varying float vBoxCloth;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','diffuseColor.rgb=mix(diffuseColor.rgb,boxTeam,step(.5,vBoxCloth));\n#include <alphamap_fragment>');
   shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','roughnessFactor=mix(roughnessFactor,.92,step(.5,vBoxCloth));\n#include <metalnessmap_fragment>');
  };
  this.animate(this.names.map(()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
  this.report={vertices:this.N,triangles:this.faces.length/3,maxInfluences,influences:entries.length/8,weightsTruncated:false,neutralMaxErrorM:neutralError,shapeRuntime:'CommonPerson.compute(state)',motionRuntime:'full canonical CSR GPU skinning',neck:'neutral seam corrections skin-transported; dynamic corrective solve not run',bodyStatePreserved:true};
 }
 animate(matrices){for(let i=0;i<matrices.length;i++)this.boneData.set(matrices[i],i*16);this.bones.needsUpdate=true;}
 sampleVertex(i){let out=[0,0,0];for(let n=0;n<this.range[i*2+1];n++){const k=(this.range[i*2]+n)*8,j=this.packed[k+3],w=this.packed[k+4],m=this.boneData.subarray(j*16,j*16+16);for(let q=0;q<3;q++)out[q]+=w*(m[q*4]*this.packed[k]+m[q*4+1]*this.packed[k+1]+m[q*4+2]*this.packed[k+2]+m[q*4+3]);}return out;}
 dispose(){this.skin.dispose();this.geometry.dispose();this.material.dispose();this.influences.dispose();this.bones.dispose();}
}

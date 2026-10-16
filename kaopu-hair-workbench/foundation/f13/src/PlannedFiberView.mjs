import * as THREE from '../vendor/three.module.js';
import {fragment as donorFragment} from './FiberOptics.mjs';
import {HairPassCache} from '../vendor/fiber/HairPassCache.mjs';
import {depthGroup} from '../../f12/src/DepthRelations.mjs';

const vertex=`precision highp float;
#include <common>
#include <shadowmap_pars_vertex>
attribute float hairId,clumpId;attribute vec3 rootIds,rootBary,debugColor;attribute vec2 fiberTrait;
uniform sampler2D pathMap,restVertices,poseMap,deformationMap;uniform float activePose,physicsOn,diameter;
uniform mat4 nativeMeshWorld;uniform vec2 viewport;uniform vec3 headCenter;
varying vec3 vWorld,vTangent,vDebugColor;varying float vSide,vCoverage,vSeed,vProgress,vSampling;
vec3 V(float id){int i=int(id);if(activePose>.5){vec3 p=texelFetch(poseMap,ivec2(i%1024,i/1024),0).xyz;return vec3(p.x,p.z,-p.y);}return texelFetch(restVertices,ivec2(i%256,i/256),0).xyz;}
vec3 offsetPoint(int n){int i=int(hairId)*49+clamp(n,0,48);return texelFetch(pathMap,ivec2(i%2048,i/2048),0).xyz;}
vec3 delta(float t){float u=pow(clamp(t,0.,1.),1./1.3)*24.;int n=min(23,int(u));float f=u-float(n);vec3 a=texelFetch(deformationMap,ivec2(int(clumpId),n),0).xyz,b=texelFetch(deformationMap,ivec2(int(clumpId),n+1),0).xyz;return mix(a,b,f)*physicsOn*smoothstep(0.,.10,t);}
void main(){int node=int(position.y);float t=position.y/48.;vec3 a=V(rootIds.x),b=V(rootIds.y),c=V(rootIds.z),root=a*rootBary.x+b*rootBary.y+c*rootBary.z,X=normalize(b-a),N=normalize(cross(b-a,c-a)),Y=cross(N,X);mat3 frame=mat3(X,Y,N);
 vec3 q=offsetPoint(node),before=offsetPoint(max(0,node-1)),after=offsetPoint(min(48,node+1));vec3 p=(nativeMeshWorld*vec4(root+frame*q,1.)).xyz+delta(t);vec3 T=normalize(mat3(nativeMeshWorld)*frame*(after-before)+delta(min(1.,t+1./48.))-delta(max(0.,t-1./48.)));
 vWorld=p;vTangent=T;vSeed=fiberTrait.x;vProgress=t;vSampling=1.;vDebugColor=debugColor;
 vec4 eye=viewMatrix*vec4(p,1.),clip=projectionMatrix*eye,ahead=projectionMatrix*viewMatrix*vec4(p+T*.002,1.);vec2 d=(ahead.xy/ahead.w-clip.xy/clip.w)*viewport,side=normalize(vec2(-d.y,d.x)+vec2(1e-8));float taper=1.-smoothstep(.80,1.,t),pixelWorld=2.*abs(clip.w)/max(abs(projectionMatrix[1][1])*viewport.y,1e-6),radius=diameter*.5*fiberTrait.y*taper,displayRadius=radius+.75*pixelWorld;
 vCoverage=radius;vSide=position.x*displayRadius;clip.xy+=side*position.x*displayRadius/pixelWorld*2./viewport*clip.w;gl_Position=clip;
 vec4 worldPosition=vec4(p,1.);vec3 transformedNormal=normalize(mat3(viewMatrix)*(p-headCenter));
 #include <shadowmap_vertex>
}`;
const fragment=donorFragment.replace('precision highp float;','precision highp float;uniform float displayMode;varying vec3 vDebugColor;')
 .replace('gl_FragColor=vec4(color,alpha*vSampling);','if(displayMode>.5)color=vDebugColor;gl_FragColor=vec4(color,alpha*vSampling);');
const vec=(array,i)=>[array[i],array[i+1],array[i+2]],sub=(a,b)=>a.map((v,k)=>v-b[k]),unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);
function texture(data,w,h){const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;}

export class PlannedFiberView{
 constructor(api,viewer){
  this.api=api;this.viewer=viewer;const raw=api.raw(),head=raw.nativeHead,old=viewer.scene.getObjectByName('F12-all-root-grown-hairs');this.source=old;this.parts=raw.state.strands.parts;this.count=raw.state.strands.count;
  const count=this.count,height=Math.ceil(count*49/2048),pathData=new Float32Array(2048*height*4),ids=new Float32Array(count*3),bary=ids.slice(),colors=ids.slice(),clumps=new Float32Array(count),hairIds=new Float32Array(count),traits=new Float32Array(count*2),restData=new Float32Array(256*Math.ceil(head.positions.length/3/256)*4);this.samples=[];this.pathRootError=0;this.partRanges=[];
  for(let i=0;i<head.positions.length/3;i++)restData.set(head.positions.slice(i*3,i*3+3),i*4);
  let strand=0;for(let clump=0;clump<this.parts.length;clump++){
   const part=this.parts[clump],line=old.children.find(m=>m.name==='F12-dense-'+part.id),positions=line.geometry.attributes.position.array,color=line.geometry.attributes.color.array,begin=strand;const representative=Math.floor(part.count*.5),guide=[];
   for(let i=0;i<part.count;i++,strand++){
    const face=part.bindings[i*4],tri=Array.from(head.triangles.slice(face*3,face*3+3)),w=Array.from(part.bindings.subarray(i*4+1,i*4+4)),a=vec(head.positions,tri[0]*3),b=vec(head.positions,tri[1]*3),c=vec(head.positions,tri[2]*3),origin=a.map((v,k)=>v*w[0]+b[k]*w[1]+c[k]*w[2]),X=unit(sub(b,a)),N=unit(cross(sub(b,a),sub(c,a))),Y=cross(N,X);
    ids.set(tri,strand*3);bary.set(w,strand*3);clumps[strand]=clump;hairIds[strand]=strand;traits.set([part.appearance[i*4]/(Math.PI*2),.85+.3*part.appearance[i*4+3]],strand*2);
    const tint=new THREE.Color(depthGroup(part.id).color);colors.set([tint.r,tint.g,tint.b],strand*3);
    for(let n=0;n<49;n++){const p=vec(positions,(i*49+n)*3),d=sub(p,origin),o=[dot(d,X),dot(d,Y),dot(d,N)];pathData.set(o,(strand*49+n)*4);if(n===0)this.pathRootError=Math.max(this.pathRootError,Math.hypot(...d));if(i===representative)guide.push(...p);}
    if(i===representative)this.samples.push({id:part.id,clump,face,bary:w,tri,points:guide,root:origin,n:N,sourceChart:Array.from(part.sourceCharts.subarray(i*3,i*3+3))});
   }this.partRanges.push({id:part.id,begin,count:part.count});
  }
  const g=new THREE.InstancedBufferGeometry(),p=[],index=[];for(let n=0;n<49;n++){p.push(-1,n,0,1,n,0);if(n<48){const j=n*2;index.push(j,j+1,j+2,j+1,j+3,j+2);}}g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(index);g.instanceCount=count;
  for(const[n,a,s]of[['hairId',hairIds,1],['clumpId',clumps,1],['rootIds',ids,3],['rootBary',bary,3],['fiberTrait',traits,2],['debugColor',colors,3]])g.setAttribute(n,new THREE.InstancedBufferAttribute(a,s));
  this.pathTexture=texture(pathData,2048,height);this.restTexture=texture(restData,256,restData.length/4/256);this.deformations=new Float32Array(43*25*4);this.deformationTexture=texture(this.deformations,43,25);
  this.u={...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),pathMap:{value:this.pathTexture},restVertices:{value:this.restTexture},poseMap:{value:this.restTexture},deformationMap:{value:this.deformationTexture},activePose:{value:0},physicsOn:{value:0},nativeMeshWorld:{value:viewer.mesh.matrixWorld},viewport:{value:new THREE.Vector2()},diameter:{value:70e-6},displayMode:{value:0},nativeDepth:{value:null},useNativeDepth:{value:0},samplingScale:{value:1},absorption:{value:new THREE.Vector3(2.4,2.8,3.3)},roughness:{value:.38},lightDirs:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},lightColors:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},headCenter:{value:new THREE.Vector3(0,.5,0)}};
  const material=this.material=new THREE.ShaderMaterial({lights:true,uniforms:this.u,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false});material.forceSinglePass=true;
  this.mesh=new THREE.Mesh(g,material);this.mesh.name='F13-planned-complete-hair';this.mesh.frustumCulled=false;this.mesh.receiveShadow=true;this.mesh.renderOrder=5;this.mesh.userData.platformAppearance=true;viewer.scene.add(this.mesh);this.viewport=new THREE.Vector4();this.mesh.onBeforeRender=()=>this.uniforms();api.display({strands:false});document.querySelector('#nativeStrands').checked=false;
  (viewer.hairPassCache||(viewer.hairPassCache=new HairPassCache(viewer))).attach(this);
 }
 uniforms(){const v=this.viewer,vp=v.renderer.getCurrentViewport(this.viewport);this.u.viewport.value.set(vp.z,vp.w);this.u.nativeMeshWorld.value=v.mesh.matrixWorld;const motion=v.hairNativeMotion;this.u.activePose.value=motion?.active?1:0;if(motion?.active)this.u.poseMap.value=motion.skinCache.target.textures[0];for(let i=0;i<3;i++){const l=v.skinDNALights?.[i];if(l){this.u.lightDirs.value[i].copy(l.position).sub(l.target.position).normalize();this.u.lightColors.value[i].set(l.color.r,l.color.g,l.color.b).multiplyScalar(l.intensity);}else{this.u.lightDirs.value[i].set(i?1:-.5,.7,1).normalize();this.u.lightColors.value[i].setScalar(i?.5:2.5);}}}
 color(id){const absorption={black:[2.4,2.8,3.3],brown:[.55,.9,1.45],auburn:[.35,.9,1.7],blonde:[.08,.18,.42]};this.u.absorption.value.fromArray(absorption[id]||absorption.black);}
 mode(value){this.u.displayMode.value=value==='groups'?1:0;this.mesh.visible=value!=='volume';}
 verifyGPU(){
  const viewer=this.viewer;viewer.hairNativeMotion?.prepareRender();this.uniforms();const count=86,samples=49,indices=Array.from({length:count},(_,i)=>Math.floor((this.count-1)*i/(count-1))),g=new THREE.InstancedBufferGeometry(),points=[];
  for(let n=0;n<49;n++)points.push(0,n,0);g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.instanceCount=count;
  for(const [key,attr]of Object.entries(this.mesh.geometry.attributes)){if(key==='position')continue;const array=new Float32Array(count*attr.itemSize);for(let i=0;i<count;i++)for(let k=0;k<attr.itemSize;k++)array[i*attr.itemSize+k]=attr.array[indices[i]*attr.itemSize+k];g.setAttribute(key,new THREE.InstancedBufferAttribute(array,attr.itemSize));}
  const height=Math.ceil(count*samples/1024),vs=vertex.replace('#include <shadowmap_vertex>',`float slot=float(gl_InstanceID*49+gl_VertexID);vec2 pixel=vec2(mod(slot,1024.),floor(slot/1024.));gl_Position=vec4((pixel+.5)/vec2(1024.,${height}.)*2.-1.,0.,1.);gl_PointSize=1.;`),m=new THREE.ShaderMaterial({uniforms:this.u,vertexShader:vs,fragmentShader:'precision highp float;varying vec3 vWorld;void main(){gl_FragColor=vec4(vWorld,1.);}',depthTest:false,depthWrite:false,toneMapped:false}),mesh=new THREE.Points(g,m),scene=new THREE.Scene(),camera=new THREE.Camera(),r=viewer.renderer,target=new THREE.WebGLRenderTarget(1024,height,{type:THREE.FloatType,depthBuffer:false}),old=r.getRenderTarget(),vp=r.getViewport(new THREE.Vector4()),auto=r.autoClear;mesh.frustumCulled=false;scene.add(mesh);const pixels=new Float32Array(1024*height*4);
  try{r.setRenderTarget(target);r.setViewport(0,0,1024,height);r.autoClear=true;r.render(scene,camera);r.readRenderTargetPixels(target,0,0,1024,height,pixels);}finally{r.setRenderTarget(old);r.setViewport(vp);r.autoClear=auto;g.dispose();m.dispose();target.dispose();}
  const head=this.api.raw().nativeHead,motion=viewer.hairNativeMotion,ids=this.mesh.geometry.attributes.rootIds.array,bary=this.mesh.geometry.attributes.rootBary.array,M=viewer.mesh.matrixWorld;let rootError=0,fullPathError=0,finite=true;const p=new THREE.Vector3();
  for(let sample=0;sample<count;sample++){const i=indices[sample],tri=Array.from(ids.subarray(i*3,i*3+3)),w=Array.from(bary.subarray(i*3,i*3+3)),root=[0,0,0];for(let j=0;j<3;j++){const a=head.positions.slice(tri[j]*3,tri[j]*3+3),q=motion?.active?motion.sampleDisplay(tri[j],a):a;for(let k=0;k<3;k++)root[k]+=q[k]*w[j];}p.fromArray(root).applyMatrix4(M);const slot=sample*49*4;rootError=Math.max(rootError,Math.hypot(p.x-pixels[slot],p.y-pixels[slot+1],p.z-pixels[slot+2]));const range=this.partRanges.find(part=>i>=part.begin&&i<part.begin+part.count),source=this.source.children.find(m=>m.name==='F12-dense-'+range.id).geometry.attributes.position.array;
   for(let n=0;n<49;n++){const j=(sample*49+n)*4;finite&&=Number.isFinite(pixels[j])&&Number.isFinite(pixels[j+1])&&Number.isFinite(pixels[j+2]);if(!motion?.active&&this.u.physicsOn.value===0){p.fromArray(source,((i-range.begin)*49+n)*3).applyMatrix4(M);fullPathError=Math.max(fullPathError,Math.hypot(p.x-pixels[j],p.y-pixels[j+1],p.z-pixels[j+2]));}}}
  return{sampledStrands:count,sampledPoints:count*49,rootErrorMM:rootError*1000,staticPathErrorMM:motion?.active||this.u.physicsOn.value!==0?null:fullPathError*1000,finite,activePose:!!motion?.active,physics:this.u.physicsOn.value===1};
 }
 report(){return{count:this.count,clumps:this.samples.length,samples:49,rootErrorMM:this.pathRootError*1000,pathTextureBytes:this.pathTexture.image.data.byteLength,physicalDiameterMicrometres:this.u.diameter.value*1e6,source:'F12 exact native complete paths',optics:'R08 copied R/TT/TRT shader',coverage:'R08 shared transmittance and native skin-pass composition',physicsEnabled:this.u.physicsOn.value===1};}
}

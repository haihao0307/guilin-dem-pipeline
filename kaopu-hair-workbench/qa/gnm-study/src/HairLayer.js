/** Camera-facing strand ribbons following GNMScalpBinding guides.
 * Uses the sweep/lift/frizz and tangent-lighting approach of the existing
 * regional-groom study; every supporting surface point is on the real GNM
 * mesh. No legacy procedural head or ellipsoid scalp is included.
 */
import * as THREE from 'three';
import {ScalpBinding} from './ScalpBinding.js';

const VERTEX=`
attribute vec3 tangent;
attribute vec3 scalpNormal;
attribute float strandSide;
attribute float along;
attribute float strandRandom;
uniform float pixelFactor;
uniform float radius;
varying vec3 vT,vV,vP,vScalpNormal;
varying float vAcross,vRandom,vCover,vAlong;
void main(){
 vec3 T=normalize(tangent),V=normalize(cameraPosition-position);
 vec3 R=normalize(cross(T,V)+vec3(0.000001,0.,0.));
 vec4 mv=modelViewMatrix*vec4(position,1.);
 float rad=radius*(.72+.55*strandRandom)*mix(1.,.13,pow(along,4.));
 float minR=max(.000025,-mv.z*pixelFactor*.52),displayR=max(rad,minR);
 vCover=min(1.,rad/minR);vAcross=strandSide;vRandom=strandRandom;vAlong=along;
 vT=T;vV=V;vP=position;vScalpNormal=scalpNormal;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position+R*strandSide*displayR,1.);
}`;
const FRAGMENT=`
uniform vec3 hairColor;uniform float roughness;uniform float guideMode;
uniform vec3 warmDirection,coolDirection,warmColor,coolColor;
uniform float warmPower,coolPower,ambientPower,legacyLighting;
varying vec3 vT,vV,vP,vScalpNormal;varying float vAcross,vRandom,vCover,vAlong;
vec3 strandLight(vec3 T,vec3 V,vec3 N,vec3 L,vec3 E,vec3 base){
 float lateral=sqrt(max(0.,1.-pow(dot(T,L),2.)));
 float surfaceFacing=smoothstep(-.18,.65,dot(N,L));
 vec3 H=L+V;float ht=dot(T,H/max(length(H),.00001));
 float spec=pow(max(0.,1.-ht*ht),mix(105.,19.,roughness));
 // The shared world-space lamps light both the pigmented fibre and its
 // untinted surface highlight. Scalp orientation is a bounded shading
 // approximation, not a shadow-map or a multiple-scattering solution.
 return E*surfaceFacing*(base*lateral*.32+spec*.095);
}
void main(){
 float edge=1.-smoothstep(.62,1.,abs(vAcross)),alpha=edge*vCover;
 if(alpha<.03)discard;
 vec3 T=normalize(vT),V=normalize(vV),L=normalize(vec3(-.8,1.3,1.7)),B=normalize(vec3(1.1,.8,-1.4));
 float diffuse=sqrt(max(0.,1.-pow(dot(T,L),2.)));
 float ht=dot(T,normalize(L+V)),spec=pow(max(0.,1.-ht*ht),mix(115.,17.,roughness));
 float back=pow(max(0.,1.-pow(dot(T,normalize(B+V)),2.)),35.);
 vec3 base=hairColor*(.72+.43*vRandom);
 vec3 col=base*(.38+.65*diffuse)+vec3(.55,.46,.34)*spec*.11+base*back*.19;
 if(legacyLighting<.5){vec3 N=normalize(vScalpNormal);col=base*ambientPower;
  col+=strandLight(T,V,N,normalize(warmDirection),warmColor*warmPower,base);
  col+=strandLight(T,V,N,normalize(coolDirection),coolColor*coolPower,base);
 }
 if(guideMode>.5)col=mix(vec3(.06,.7,.55),vec3(.8,.48,.1),vRandom);
 gl_FragColor=vec4(col,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export class HairLayer{
 constructor(model,positions,normals,options={}){
  this.model=model;this.options={count:12000,segments:18,seed:724,sweep:.43,length:.085,volume:.012,frizz:.00045,roughness:.42,color:'#21170f',guides:false,...options};this.binding=new ScalpBinding(model,this.options);this.geometry=new THREE.BufferGeometry();this.createBuffers();
  this.material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:{pixelFactor:{value:.00065},radius:{value:.00023},hairColor:{value:new THREE.Color(this.options.color)},roughness:{value:this.options.roughness},guideMode:{value:0},warmDirection:{value:new THREE.Vector3(1,.45,.75).normalize()},coolDirection:{value:new THREE.Vector3(-1,.35,.55).normalize()},warmColor:{value:new THREE.Color('#ffb473')},coolColor:{value:new THREE.Color('#7caaff')},warmPower:{value:3.2},coolPower:{value:3},ambientPower:{value:.18},legacyLighting:{value:0}},side:THREE.DoubleSide,transparent:false,alphaToCoverage:true,depthWrite:true});
  this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.name='GNM scalp-bound strands';this.mesh.frustumCulled=false;this.mesh.renderOrder=1;this.update(positions,normals);
 }
 createBuffers(){const {count,segments}=this.options,per=segments+1,n=count*per*2;this.p=new Float32Array(n*3);this.t=new Float32Array(n*3);this.n=new Float32Array(n*3);const side=new Float32Array(n),along=new Float32Array(n),random=new Float32Array(n),indices=new Uint32Array(count*segments*6);let ix=0;for(let i=0;i<count;i++){for(let j=0;j<per;j++)for(let k=0;k<2;k++){const v=(i*per+j)*2+k;side[v]=k?1:-1;along[v]=j/segments;random[v]=this.binding.random[i*4+2];}for(let j=0;j<segments;j++){const a=(i*per+j)*2;indices[ix++]=a;indices[ix++]=a+1;indices[ix++]=a+2;indices[ix++]=a+1;indices[ix++]=a+3;indices[ix++]=a+2;}}
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.p,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('tangent',new THREE.BufferAttribute(this.t,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('scalpNormal',new THREE.BufferAttribute(this.n,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('strandSide',new THREE.BufferAttribute(side,1));this.geometry.setAttribute('along',new THREE.BufferAttribute(along,1));this.geometry.setAttribute('strandRandom',new THREE.BufferAttribute(random,1));this.fullIndex=new THREE.BufferAttribute(indices,1);const sparse=[];for(let i=0;i<count;i+=18)sparse.push(...indices.subarray(i*segments*6,(i+1)*segments*6));this.guideIndex=new THREE.BufferAttribute(Uint32Array.from(sparse),1);this.geometry.setIndex(this.fullIndex);
 }
 update(positions,normals){const start=performance.now(),{count,segments}=this.options,per=segments+1,points=this.binding.sample(positions,normals,this.options);for(let i=0;i<count;i++)for(let j=0;j<per;j++){const p=(i*per+j)*3,a=(i*per+Math.max(0,j-1))*3,b=(i*per+Math.min(segments,j+1))*3;const q=i*per+j,tri=this.binding.triangleIndices[q],tr=this.model.triangles,w=this.binding.barycentrics;for(let k=0;k<2;k++){const v=q*6+k*3;for(let c=0;c<3;c++){this.p[v+c]=points[p+c];this.t[v+c]=points[b+c]-points[a+c];this.n[v+c]=normals[tr[tri*3]*3+c]*w[q*3]+normals[tr[tri*3+1]*3+c]*w[q*3+1]+normals[tr[tri*3+2]*3+c]*w[q*3+2];}}}let minNormalSquared=Infinity;for(let k=0;k<this.n.length;k+=6)minNormalSquared=Math.min(minNormalSquared,this.n[k]**2+this.n[k+1]**2+this.n[k+2]**2);this.minScalpNormalLength=Math.sqrt(minNormalSquared);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.tangent.needsUpdate=true;this.geometry.attributes.scalpNormal.needsUpdate=true;this.lastUpdateMs=performance.now()-start;this.latestPoints=points;this.surfacePositions=positions;}
 setLighting(value={}){const u=this.material.uniforms;for(const k of ['warmDirection','coolDirection'])if(value[k])u[k].value.fromArray(value[k]).normalize();for(const k of ['warmColor','coolColor'])if(value[k])u[k].value.setRGB(...value[k],THREE.LinearSRGBColorSpace);for(const k of ['warmPower','coolPower'])if(Number.isFinite(value[k]))u[k].value=Math.max(0,value[k]);if(Number.isFinite(value.ambient))u.ambientPower.value=Math.max(0,value.ambient);u.legacyLighting.value=value.legacy?1:0;}
 setViewport(camera,height){this.material.uniforms.pixelFactor.value=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height);}
 setAppearance(patch){Object.assign(this.options,patch);if(patch.color)this.material.uniforms.hairColor.value.set(patch.color);this.material.uniforms.roughness.value=this.options.roughness;this.material.uniforms.guideMode.value=this.options.guides?1:0;this.geometry.setIndex(this.options.guides?this.guideIndex:this.fullIndex);this.material.uniforms.radius.value=this.options.guides?.0003:.00023;}
 diagnostics(){let rootHash=2166136261,maxRootSurfaceDistance=0;const per=this.options.segments+1,bits=new Uint32Array(this.latestPoints.buffer);for(let i=0;i<this.options.count;i++){const q=i*per,p=this.binding.point(this.binding.triangleIndices[q],this.binding.barycentrics.subarray(q*3,q*3+3),this.surfacePositions);let d=0;for(let k=0;k<3;k++){rootHash=Math.imul(rootHash^bits[q*3+k],16777619);d+=(this.latestPoints[q*3+k]-p[k])**2;}maxRootSurfaceDistance=Math.max(maxRootSurfaceDistance,Math.sqrt(d));}return {...this.binding.diagnostics(),vertices:this.p.length/3,triangles:this.geometry.index.count/3,finite:this.p.every(Number.isFinite)&&this.n.every(Number.isFinite),radius:this.material.uniforms.radius.value,minScalpNormalLength:this.minScalpNormalLength,lighting:{legacy:this.material.uniforms.legacyLighting.value>.5,warmPower:this.material.uniforms.warmPower.value,coolPower:this.material.uniforms.coolPower.value,ambient:this.material.uniforms.ambientPower.value,warmDirection:this.material.uniforms.warmDirection.value.toArray(),coolDirection:this.material.uniforms.coolDirection.value.toArray(),warmColor:this.material.uniforms.warmColor.value.toArray(),coolColor:this.material.uniforms.coolColor.value.toArray()},rootHash:rootHash>>>0,maxRootSurfaceDistance,lastUpdateMs:this.lastUpdateMs};}
 dispose(){this.geometry.dispose();this.material.dispose();}
}

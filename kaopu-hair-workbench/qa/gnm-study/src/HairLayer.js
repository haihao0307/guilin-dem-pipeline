/** Camera-facing strand ribbons following GNMScalpBinding guides.
 * Uses the sweep/lift/frizz and tangent-lighting approach of the existing
 * regional-groom study; every supporting surface point is on the real GNM
 * mesh. No legacy procedural head or ellipsoid scalp is included.
 */
import * as THREE from 'three';
import {ScalpBinding} from './ScalpBinding.js';

export const STRAND_VERTEX=`
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
export const STRAND_FRAGMENT=`
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

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** One lighting implementation for scalp, brows, and beard. */
export function createStrandMaterial({color='#21170f',roughness=.42,radius=.00028}={}){
 return new THREE.ShaderMaterial({vertexShader:STRAND_VERTEX,fragmentShader:STRAND_FRAGMENT,uniforms:{pixelFactor:{value:.00065},radius:{value:radius},hairColor:{value:new THREE.Color(color)},roughness:{value:roughness},guideMode:{value:0},warmDirection:{value:new THREE.Vector3(1,.45,.75).normalize()},coolDirection:{value:new THREE.Vector3(-1,.35,.55).normalize()},warmColor:{value:new THREE.Color('#ffb473')},coolColor:{value:new THREE.Color('#7caaff')},warmPower:{value:3.2},coolPower:{value:3},ambientPower:{value:.18},legacyLighting:{value:0}},side:THREE.DoubleSide,transparent:false,alphaToCoverage:true,depthWrite:true});
}
export function setStrandLighting(material,value={}){
 const u=material.uniforms;for(const k of ['warmDirection','coolDirection'])if(value[k])u[k].value.fromArray(value[k]).normalize();for(const k of ['warmColor','coolColor'])if(value[k])u[k].value.setRGB(...value[k],THREE.LinearSRGBColorSpace);for(const k of ['warmPower','coolPower'])if(Number.isFinite(value[k]))u[k].value=Math.max(0,value[k]);if(Number.isFinite(value.ambient))u.ambientPower.value=Math.max(0,value.ambient);u.legacyLighting.value=value.legacy?1:0;
}
export function strandLightingDiagnostics(material){const u=material.uniforms;return {legacy:u.legacyLighting.value>.5,warmPower:u.warmPower.value,coolPower:u.coolPower.value,ambient:u.ambientPower.value,warmDirection:u.warmDirection.value.toArray(),coolDirection:u.coolDirection.value.toArray(),warmColor:u.warmColor.value.toArray(),coolColor:u.coolColor.value.toArray()};}

/** A groom selection, not an anatomical label or replacement scalp.
 * The r4 root domain included the top of the ears. Restrict those low lateral
 * triangles, close the over-wide front part, and bias root coverage toward the
 * frontal/crown area. Strand width is also increased, so fullness does not rely
 * on increasing count alone. The official head and its topology are untouched.
 */
class FullerScalpBinding extends ScalpBinding{
 // Cache neutral triangle frames for the one-time geodesic walk. This avoids
 // rebuilding vertex/edge arrays hundreds of thousands of times at startup.
 bind(){
  const tr=this.model.triangles,p=this.model.template;this.triangleFrames=new Float64Array(tr.length/3*16);
  for(let t=0;t<tr.length/3;t++){const a=tr[t*3]*3,b=tr[t*3+1]*3,c=tr[t*3+2]*3,o=t*16,f=this.triangleFrames;for(let k=0;k<3;k++){f[o+k]=p[a+k];f[o+3+k]=p[b+k]-p[a+k];f[o+6+k]=p[c+k]-p[a+k];}let d00=0,d01=0,d11=0;for(let k=0;k<3;k++){d00+=f[o+3+k]**2;d01+=f[o+3+k]*f[o+6+k];d11+=f[o+6+k]**2;}f[o+9]=d00;f[o+10]=d01;f[o+11]=d11;f[o+12]=d00*d11-d01*d01;let nx=f[o+4]*f[o+8]-f[o+5]*f[o+7],ny=f[o+5]*f[o+6]-f[o+3]*f[o+8],nz=f[o+3]*f[o+7]-f[o+4]*f[o+6],d=Math.hypot(nx,ny,nz)||1;f[o+13]=nx/d;f[o+14]=ny/d;f[o+15]=nz/d;}
  super.bind();
 }
 point(t,b,positions=this.model.template){const tr=this.model.triangles,a=tr[t*3]*3,c=tr[t*3+1]*3,d=tr[t*3+2]*3;return [positions[a]*b[0]+positions[c]*b[1]+positions[d]*b[2],positions[a+1]*b[0]+positions[c+1]*b[1]+positions[d+1]*b[2],positions[a+2]*b[0]+positions[c+2]*b[1]+positions[d+2]*b[2]];}
 faceNormal(t){const f=this.triangleFrames,o=t*16;return [f[o+13],f[o+14],f[o+15]];}
 barycentric(t,p){const f=this.triangleFrames,o=t*16,det=f[o+12];if(Math.abs(det)<1e-18)return [1,0,0];let d20=0,d21=0;for(let k=0;k<3;k++){const v=p[k]-f[o+k];d20+=v*f[o+3+k];d21+=v*f[o+6+k];}const v=(f[o+11]*d20-f[o+10]*d21)/det,w=(f[o+9]*d21-f[o+10]*d20)/det;return [1-v-w,v,w];}
 scalp([x,y,z]){
  const front=clamp((z-.025)/.08,0,1),side=Math.abs(x);
  if(side>.073&&y<.316&&z>-.022)return false;
  return y>.273+front*.074+Math.max(0,side-.05)*.2&&y>.268;
 }
 advance(t,b,distance,direction){const next=super.advance(t,b,distance,direction),p=this.point(next.t,next.b);return Math.abs(p[0])>.073&&p[1]<.316&&p[2]>-.022?{t,b}:next;}
 selectFaces(){
  const source=super.selectFaces();let sum=0;
  let previous=0;for(const item of source.items){const area=item.cumulative-previous;previous=item.cumulative;const f=this.face(item.t),z=(f[0][2]+f[1][2]+f[2][2])/3,y=(f[0][1]+f[1][1]+f[2][1])/3;sum+=area*(1+.6*clamp((z-.025)/.08,0,1)*clamp((y-.31)/.06,0,1));item.cumulative=sum;}
  this.rootSurfaceArea=source.sum;return {items:source.items,sum};
 }
}

export class HairLayer{
 constructor(model,positions,normals,options={}){
  this.model=model;
  this.options={count:18000,segments:18,seed:724,sweep:.34,length:.085,maxLength:.13,density:.9,volume:.012,frizz:.00045,roughness:.42,color:'#21170f',guides:false,...options};
  this.options.count=Math.max(1,Math.round(this.options.count));this.options.density=clamp(this.options.density,0,1);this.options.length=clamp(this.options.length,.012,this.options.maxLength);
  // Bind the longest supported guide once. Length selects a surface prefix;
  // density changes only drawRange and never rebinds or reallocates roots.
  this.binding=new FullerScalpBinding(model,{...this.options,length:this.options.maxLength,segments:26});
  this.geometry=new THREE.BufferGeometry();this.createBuffers();this.material=createStrandMaterial(this.options);
  this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.name='GNM scalp-bound strands';this.mesh.frustumCulled=false;this.mesh.renderOrder=1;this.applyDrawRange();this.update(positions,normals);
 }
 createBuffers(){
  const {count,segments}=this.options,per=segments+1,n=count*per*2;this.p=new Float32Array(n*3);this.t=new Float32Array(n*3);this.n=new Float32Array(n*3);this.latestPoints=new Float32Array(count*per*3);
  const side=new Float32Array(n),along=new Float32Array(n),random=new Float32Array(n),indices=new Uint32Array(count*segments*6);let ix=0;
  for(let i=0;i<count;i++){for(let j=0;j<per;j++)for(let k=0;k<2;k++){const v=(i*per+j)*2+k;side[v]=k?1:-1;along[v]=j/segments;random[v]=this.binding.random[i*4+2];}for(let j=0;j<segments;j++){const a=(i*per+j)*2;indices[ix++]=a;indices[ix++]=a+1;indices[ix++]=a+2;indices[ix++]=a+1;indices[ix++]=a+3;indices[ix++]=a+2;}}
  for(const [name,array]of [['position',this.p],['tangent',this.t],['scalpNormal',this.n]])this.geometry.setAttribute(name,new THREE.BufferAttribute(array,3).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('strandSide',new THREE.BufferAttribute(side,1));this.geometry.setAttribute('along',new THREE.BufferAttribute(along,1));this.geometry.setAttribute('strandRandom',new THREE.BufferAttribute(random,1));this.fullIndex=new THREE.BufferAttribute(indices,1);
  const sparse=[];for(let i=0;i<count;i+=18)sparse.push(...indices.subarray(i*segments*6,(i+1)*segments*6));this.guideIndex=new THREE.BufferAttribute(Uint32Array.from(sparse),1);this.geometry.setIndex(this.fullIndex);
 }
 applyDrawRange(){this.activeCount=Math.round(this.options.count*this.options.density);this.geometry.setIndex(this.options.guides?this.guideIndex:this.fullIndex);this.geometry.setDrawRange(0,(this.options.guides?Math.ceil(this.activeCount/18):this.activeCount)*this.options.segments*6);}
 update(positions,normals){
  const start=performance.now(),{count,segments,length,maxLength,volume,frizz}=this.options,per=segments+1,bper=this.binding.segments+1,tr=this.model.triangles,bary=this.binding.barycentrics,points=this.latestPoints;
  let minNormalSquared=Infinity;
  for(let i=0;i<count;i++)for(let j=0;j<per;j++){
   const s=j/segments,f=s*length/maxLength*this.binding.segments,step=Math.min(this.binding.segments,Math.floor(f)),blend=f-step,q=i*per+j;
   let px=0,py=0,pz=0,nx=0,ny=0,nz=0;
   for(let side=0;side<2;side++){const bq=i*bper+Math.min(this.binding.segments,step+side),triangle=this.binding.triangleIndices[bq],mix=side?blend:1-blend;
    for(let k=0;k<3;k++){const v=tr[triangle*3+k]*3,w=bary[bq*3+k]*mix;px+=positions[v]*w;py+=positions[v+1]*w;pz+=positions[v+2]*w;nx+=normals[v]*w;ny+=normals[v+1]*w;nz+=normals[v+2]*w;}}
   const nd=Math.hypot(nx,ny,nz)||1;nx/=nd;ny/=nd;nz/=nd;minNormalSquared=Math.min(minNormalSquared,nx*nx+ny*ny+nz*nz);
   const lift=.00035+volume*Math.sqrt(length/.085)*Math.sin(Math.PI*s)*(.75+.25*this.binding.random[i*4+2]),noise=frizz*s*s;
   points[q*3]=px+nx*lift+noise*Math.sin(s*19+this.binding.random[i*4]*23);points[q*3+1]=py+ny*lift+noise*Math.sin(s*26+this.binding.random[i*4+1]*23);points[q*3+2]=pz+nz*lift+noise*Math.sin(s*33+this.binding.random[i*4+2]*23);
   for(let k=0;k<2;k++){const v=q*6+k*3;this.n[v]=nx;this.n[v+1]=ny;this.n[v+2]=nz;}
  }
  for(let i=0;i<count;i++)for(let j=0;j<per;j++){const q=i*per+j,a=(i*per+Math.max(0,j-1))*3,b=(i*per+Math.min(segments,j+1))*3;for(let k=0;k<2;k++){const v=q*6+k*3;for(let c=0;c<3;c++){this.p[v+c]=points[q*3+c];this.t[v+c]=points[b+c]-points[a+c];}}}
  this.minScalpNormalLength=Math.sqrt(minNormalSquared);for(const name of ['position','tangent','scalpNormal'])this.geometry.attributes[name].needsUpdate=true;this.lastUpdateMs=performance.now()-start;this.surfacePositions=positions;this.surfaceNormals=normals;
 }
 setLighting(value={}){setStrandLighting(this.material,value);}
 setViewport(camera,height){this.material.uniforms.pixelFactor.value=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height)/Math.max(.01,camera.zoom||1);}
 setAppearance(patch={}){
  const previousLength=this.options.length;for(const k of ['color','roughness','guides','volume','frizz'])if(patch[k]!==undefined)this.options[k]=patch[k];if(Number.isFinite(patch.density))this.options.density=clamp(patch.density,0,1);if(Number.isFinite(patch.length))this.options.length=clamp(patch.length,.012,this.options.maxLength);
  if(patch.color)this.material.uniforms.hairColor.value.set(patch.color);this.material.uniforms.roughness.value=this.options.roughness;this.material.uniforms.guideMode.value=this.options.guides?1:0;this.material.uniforms.radius.value=this.options.guides?.0003:.00028;this.applyDrawRange();
  if(this.surfacePositions&&(this.options.length!==previousLength||patch.volume!==undefined||patch.frizz!==undefined))this.update(this.surfacePositions,this.surfaceNormals);
 }
 diagnostics(){
  let rootHash=2166136261,maxRootSurfaceDistance=0;const per=this.options.segments+1,bper=this.binding.segments+1,bits=new Uint32Array(this.latestPoints.buffer);
  for(let i=0;i<this.options.count;i++){const q=i*per,bq=i*bper,p=this.binding.point(this.binding.triangleIndices[bq],this.binding.barycentrics.subarray(bq*3,bq*3+3),this.surfacePositions);let d=0;for(let k=0;k<3;k++){rootHash=Math.imul(rootHash^bits[q*3+k],16777619);d+=(this.latestPoints[q*3+k]-p[k])**2;}maxRootSurfaceDistance=Math.max(maxRootSurfaceDistance,Math.sqrt(d));}
  return {...this.binding.diagnostics(),segments:this.options.segments,bindingSegments:this.binding.segments,scalpArea:this.binding.rootSurfaceArea,count:this.options.count,activeCount:this.activeCount,density:this.options.density,length:this.options.length,vertices:this.p.length/3,triangles:this.geometry.drawRange.count/3,finite:this.p.every(Number.isFinite)&&this.t.every(Number.isFinite)&&this.n.every(Number.isFinite),radius:this.material.uniforms.radius.value,minScalpNormalLength:this.minScalpNormalLength,lighting:strandLightingDiagnostics(this.material),rootHash:rootHash>>>0,maxRootSurfaceDistance,lastUpdateMs:this.lastUpdateMs};
 }
 dispose(){this.geometry.dispose();this.material.dispose();}
}

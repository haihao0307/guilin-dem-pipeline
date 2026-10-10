import {scalpMargin,scalpZone,scalpDensity} from './RegionFields.js';
/** R02 isolated self-authored refinement over R01 HairLayer.
 * Keep original GNM root union and true triangle support. Changes: smooth
 * boundary length gradient, neutral-space guide bundles, sparse controlled
 * silhouette flyaways. This is not an AI model reproduction or physics.
 */
/** Camera-facing strand ribbons following GNMScalpBinding guides.
 * Uses the sweep/lift/frizz and tangent-lighting approach of the existing
 * regional-groom study; every supporting surface point is on the real GNM
 * mesh. No legacy procedural head or ellipsoid scalp is included.
 */
import * as THREE from 'three';
import {ScalpBinding} from './ScalpBinding.js';
import {createRng} from './SemanticSampler.js';

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
uniform float warmPower,coolPower,ambientPower,legacyLighting,surfaceSpecular;
varying vec3 vT,vV,vP,vScalpNormal;varying float vAcross,vRandom,vCover,vAlong;
vec3 strandLight(vec3 T,vec3 V,vec3 N,vec3 L,vec3 E,vec3 base){
 float lateral=sqrt(max(0.,1.-pow(dot(T,L),2.)));
 float surfaceFacing=smoothstep(-.18,.65,dot(N,L));
 vec3 H=L+V;float ht=dot(T,H/max(length(H),.00001));
 float spec=pow(max(0.,1.-ht*ht),mix(105.,19.,roughness));
 // The shared world-space lamps light both the pigmented fibre and its
 // untinted surface highlight. Scalp orientation is a bounded shading
 // approximation, not a shadow-map or a multiple-scattering solution.
 return E*surfaceFacing*(base*lateral*.32+spec*surfaceSpecular);
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
export function createStrandMaterial({color='#21170f',roughness=.42,radius=.00028,specular=.095}={}){
 return new THREE.ShaderMaterial({vertexShader:STRAND_VERTEX,fragmentShader:STRAND_FRAGMENT,uniforms:{pixelFactor:{value:.00065},radius:{value:radius},hairColor:{value:new THREE.Color(color)},roughness:{value:roughness},guideMode:{value:0},warmDirection:{value:new THREE.Vector3(1,.45,.75).normalize()},coolDirection:{value:new THREE.Vector3(-1,.35,.55).normalize()},warmColor:{value:new THREE.Color('#ffb473')},coolColor:{value:new THREE.Color('#7caaff')},warmPower:{value:3.2},coolPower:{value:3},ambientPower:{value:.18},legacyLighting:{value:0},surfaceSpecular:{value:specular}},side:THREE.DoubleSide,transparent:false,alphaToCoverage:true,depthWrite:true});
}
export function setStrandLighting(material,value={}){
 const u=material.uniforms;for(const k of ['warmDirection','coolDirection'])if(value[k])u[k].value.fromArray(value[k]).normalize();for(const k of ['warmColor','coolColor'])if(value[k])u[k].value.setRGB(...value[k],THREE.LinearSRGBColorSpace);for(const k of ['warmPower','coolPower'])if(Number.isFinite(value[k]))u[k].value=Math.max(0,value[k]);if(Number.isFinite(value.ambient))u.ambientPower.value=Math.max(0,value.ambient);u.legacyLighting.value=value.legacy?1:0;
}
export function strandLightingDiagnostics(material){const u=material.uniforms;return {legacy:u.legacyLighting.value>.5,warmPower:u.warmPower.value,coolPower:u.coolPower.value,ambient:u.ambientPower.value,warmDirection:u.warmDirection.value.toArray(),coolDirection:u.coolDirection.value.toArray(),warmColor:u.warmColor.value.toArray(),coolColor:u.coolColor.value.toArray()};}

/** All three grooms use the same neutral GNM root union. These bounds are a
 * conservative grooming choice in native model units, not anatomical labels.
 * A soft probability ramp controls the hairline; no roots are moved off skin.
 */
export const SCALP_STYLES=Object.freeze(['side-sweep','swept-back','short-crop']);
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const normalized=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
class FullerScalpBinding extends ScalpBinding{
 bind(){
  const tr=this.model.triangles,p=this.model.template;this.triangleFrames=new Float64Array(tr.length/3*16);
  for(let t=0;t<tr.length/3;t++){const a=tr[t*3]*3,b=tr[t*3+1]*3,c=tr[t*3+2]*3,o=t*16,f=this.triangleFrames;for(let k=0;k<3;k++){f[o+k]=p[a+k];f[o+3+k]=p[b+k]-p[a+k];f[o+6+k]=p[c+k]-p[a+k];}let d00=0,d01=0,d11=0;for(let k=0;k<3;k++){d00+=f[o+3+k]**2;d01+=f[o+3+k]*f[o+6+k];d11+=f[o+6+k]**2;}f[o+9]=d00;f[o+10]=d01;f[o+11]=d11;f[o+12]=d00*d11-d01*d01;let nx=f[o+4]*f[o+8]-f[o+5]*f[o+7],ny=f[o+5]*f[o+6]-f[o+3]*f[o+8],nz=f[o+3]*f[o+7]-f[o+4]*f[o+6],d=Math.hypot(nx,ny,nz)||1;f[o+13]=nx/d;f[o+14]=ny/d;f[o+15]=nz/d;}
  const {items,sum}=this.selectFaces(),rng=createRng(this.seed),per=this.segments+1;
  this.scalpTriangleCount=items.length;this.scalpArea=this.rootSurfaceArea=sum;
  this.rootTriangles=new Int32Array(this.count);this.rootBarycentrics=new Float32Array(this.count*3);this.templateRoots=new Float32Array(this.count*3);this.regionWeights=new Float32Array(this.count*3);this.selectionRandom=new Float32Array(this.count);this.guideCache=new Map();this.guideBuilds=0;this.unitIds=new Uint32Array(this.count);this.unitCount=0;let remaining=0,anchor=null;const unitGrid=new Map(),cellSize=.00105*Math.min(1,Math.sqrt(36000/this.count));const key=(x,y,z)=>x+","+y+","+z;const nearUnit=p=>{const c=p.map(v=>Math.floor(v/cellSize));for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const q of unitGrid.get(key(c[0]+x,c[1]+y,c[2]+z))||[])if(Math.hypot(...p.map((v,k)=>v-q[k]))<cellSize)return true;return false;};
  for(let i=0;i<this.count;i++){
   let t,b,root;let attempts=0;
   if(remaining>0){const angle=rng()*Math.PI*2,step=.00018+rng()*.00036,next=this.advance(anchor.t,anchor.b,step,[Math.cos(angle),.25*Math.sin(angle*2),Math.sin(angle)]);t=next.t;b=next.b;root=this.point(t,b);remaining--;if(scalpMargin(root)<=.0002)root=null;}
   if(!root){do{const target=rng()*sum;let lo=0,hi=items.length-1;while(lo<hi){const m=(lo+hi)>>1;if(items[m].cumulative<target)lo=m+1;else hi=m;}t=items[lo].t;const u=Math.sqrt(rng()),v=rng();b=[1-u,u*(1-v),u*v];root=this.point(t,b);if(++attempts>2000)throw Error('Scalp unit rejection exhausted');}while(scalpMargin(root)<=.0002||rng()>scalpDensity(root)/1.3||nearUnit(root));anchor={t,b:[...b]};this.unitCount++;remaining=scalpMargin(root)<.004?0:(rng()<.22?0:rng()<.65?1:2);const c=root.map(v=>Math.floor(v/cellSize)),k=key(...c);if(!unitGrid.has(k))unitGrid.set(k,[]);unitGrid.get(k).push([...root]);}
   this.unitIds[i]=this.unitCount-1;
   const front=smooth(.015,.08,root[2]),back=1-smooth(-.055,.005,root[2]),side=smooth(.04,.075,Math.abs(root[0]))*(1-front*.6)*(1-back*.6),total=Math.max(1,front+back+side);
   this.rootTriangles[i]=t;this.rootBarycentrics.set(b,i*3);this.templateRoots.set(root,i*3);this.regionWeights.set([front/total,back/total,side/total],i*3);this.selectionRandom[i]=rng();
   for(let k=0;k<4;k++)this.random[i*4+k]=rng();this.regions[i]=root[1]>.325?0:1;
  }
  this.setStyle('side-sweep');
 }
 point(t,b,positions=this.model.template){const tr=this.model.triangles,a=tr[t*3]*3,c=tr[t*3+1]*3,d=tr[t*3+2]*3;return [positions[a]*b[0]+positions[c]*b[1]+positions[d]*b[2],positions[a+1]*b[0]+positions[c+1]*b[1]+positions[d+1]*b[2],positions[a+2]*b[0]+positions[c+2]*b[1]+positions[d+2]*b[2]];}
 faceNormal(t){const f=this.triangleFrames,o=t*16;return [f[o+13],f[o+14],f[o+15]];}
 barycentric(t,p){const f=this.triangleFrames,o=t*16,det=f[o+12];if(Math.abs(det)<1e-18)return [1,0,0];let d20=0,d21=0;for(let k=0;k<3;k++){const v=p[k]-f[o+k];d20+=v*f[o+3+k];d21+=v*f[o+6+k];}const v=(f[o+11]*d20-f[o+10]*d21)/det,w=(f[o+9]*d21-f[o+10]*d20)/det;return [1-v-w,v,w];}
 frontWeight([x,y,z]){return smooth(.025,.1,z)*(1-.28*smooth(.035,.075,Math.abs(x)));}
 hairlineMargin(p,height=0){const [x,y,z]=p,ax=Math.abs(x),front=clamp((z-.025)/.08,0,1),temple=.0025*Math.sin(ax*52)*front;return y-(.273+front*.074+Math.max(0,ax-.05)*.2+temple+height*.01*this.frontWeight(p));}
 safetyMargin(p){return scalpMargin(p);}
 selectFaces(){const tr=this.model.triangles,items=[];let sum=0;for(let t=0;t<tr.length/3;t++){if([0,1,2].some(k=>this.model.componentId[tr[t*3+k]]!==0))continue;const f=this.face(t),center=f[0].map((v,k)=>(v+f[1][k]+f[2][k])/3);if(!f.some(p=>scalpMargin(p)>-.002)&&scalpMargin(center)<=-.002)continue;const a=f[1].map((v,k)=>v-f[0][k]),b=f[2].map((v,k)=>v-f[0][k]),area=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;if(area<1e-12)continue;sum+=area;items.push({t,cumulative:sum});}return{items,sum};}

 scalp(p){return this.safetyMargin(p)>.0002;}
 selectionWeight(i,options){const p=this.templateRoots.subarray(i*3,i*3+3),w=this.regionWeights,q=i*3;
  const edge=smooth(.0002,.007,this.safetyMargin(p)-options.hairlineHeight*.006*this.frontWeight(p));
  return edge*clamp(1-w[q]*(1-options.frontCoverage)-w[q+1]*(1-options.backCoverage)-w[q+2]*(1-options.sideCoverage),0,1);
 }
 /** Update direction along the surface, including its side/back orientation.
  * There is no common world-space vector or hard left/right part seam. */
 flow(p,i,style,progress=0){
  const [x,y,z]=p,side=smooth(.045,.085,Math.abs(x)),rear=1-smooth(-.052,-.015,z),front=smooth(.02,.09,z),r=this.random[i*4],near=1-smooth(.002,.015,this.safetyMargin(p));let direction;
  if(style==='swept-back')direction=[x*.7,-.12-side*rear*.72,-1];
  else if(style==='short-crop')direction=[x*1.8,-.2-side*rear*.55,.7*front-.6*(1-front)];
  else{const rootX=this.templateRoots[i*3],rootZ=this.templateRoots[i*3+2],part=-.027+.045*rootZ,partSide=rootX<part?-1:1;direction=[partSide*(.78*(1-side*.75))+x*2,-.12-side*rear*.6,-.65-side*.6];}
  const lower=1-smooth(.311,.350,y),rearFlow=1-smooth(-.035,.014,z),sideFlow=smooth(.045,.073,Math.abs(x));const regional=Math.max(rearFlow,sideFlow)*lower;direction=direction.map((v,k)=>v*(1-regional)+[x*.5,-1,-.18][k]*regional);
  // Group nearby roots into 12 mm guide cells, then converge gently along
  // each supported strand. The grouping controls coherent bundles, not noise.
  const root=this.templateRoots.subarray(i*3,i*3+3),cell=.012;
  const dx=(Math.round(root[0]/cell)*cell-root[0])/cell,dz=(Math.round(root[2]/cell)*cell-root[2])/cell;
  const gather=Math.sin(Math.PI*progress)*.34;
  direction[0]+=dx*gather;direction[2]+=dz*gather;
  const wx=x-.018,wz=z+.028,wd=Math.hypot(wx,wz),whorl=.94*smooth(.343,.367,y)*(1-smooth(.012,.048,wd))*(.45+.55*Math.exp(-progress*8));const spin=normalized([-.32*wz+wx,.02,.32*wx+wz]);direction=direction.map((v,k)=>v*(1-whorl)+spin[k]*whorl);direction[0]+=(r-.5)*.06;direction[1]+=near*.3;return normalized(direction);
 }
 setStyle(style){
  if(this.guideCache.has(style)){const cached=this.guideCache.get(style);this.triangleIndices=cached.triangles;this.barycentrics=cached.barycentrics;this.guideEnds=cached.ends;this.style=style;return;}
  const per=this.segments+1,triangles=new Int32Array(this.count*per),barycentrics=new Float32Array(this.count*per*3),ends=new Uint8Array(this.count).fill(this.segments);let clipped=0;
  for(let i=0;i<this.count;i++){
   let t=this.rootTriangles[i],b=Array.from(this.rootBarycentrics.subarray(i*3,i*3+3)),stopped=false;const p=this.templateRoots.subarray(i*3,i*3+3),top=smooth(.30,.385,p[1]),margin=Math.max(0,this.safetyMargin(p)),transition=.18+.82*smooth(.001,.018,margin),strandLength=this.length*transition*(.32+.68*top)*(.66+.54*this.random[i*4+3])*(style==='short-crop'?.34:style==='swept-back'?.95:1),distance=strandLength/this.segments;
   for(let j=0;j<per;j++){
    const q=i*per+j;triangles[q]=t;barycentrics.set(b,q*3);if(j===this.segments||stopped)continue;
    const direction=this.flow(this.point(t,b),i,style,j/this.segments);let next=this.advance(t,b,distance,direction);
    if(this.safetyMargin(this.point(next.t,next.b))<.0002){let lo=0,hi=distance;next={t,b};for(let k=0;k<7;k++){const mid=(lo+hi)/2,probe=this.advance(t,b,mid,direction);if(this.safetyMargin(this.point(probe.t,probe.b))>=.0002){lo=mid;next=probe;}else hi=mid;}stopped=true;ends[i]=j+1;clipped++;}
    t=next.t;b=next.b;
   }
  }
  this.guideCache.clear();this.guideCache.set(style,{triangles,barycentrics,ends,clipped});this.triangleIndices=triangles;this.barycentrics=barycentrics;this.guideEnds=ends;this.style=style;this.guideBuilds++;
 }
}

export class HairLayer{
 constructor(model,positions,normals,options={}){
  this.model=model;
  this.options={count:36000,segments:9,seed:724,sweep:.34,style:'side-sweep',hairlineHeight:0,frontCoverage:1,backCoverage:1,sideCoverage:1,width:1,length:.065,maxLength:.13,density:.9,volume:.0035,frizz:.00045,roughness:.42,color:'#21170f',guides:false,...options};
  this.options.count=Math.max(1,Math.round(this.options.count));this.clampOptions();
  this.binding=new FullerScalpBinding(model,{...this.options,length:this.options.maxLength,segments:32});this.binding.setStyle(this.options.style);
  this.bundleHeights=new Float32Array(this.options.count);for(let i=0;i<this.options.count;i++){const rx=this.binding.templateRoots[i*3],rz=this.binding.templateRoots[i*3+2],patches=[[-.045,.065,.72],[.025,.065,1.30],[.045,.012,.82],[-.030,-.035,1.20],[.032,-.055,.88]];let hw=0,hv=0;for(const [cx,cz,h]of patches){const w=Math.exp(-((rx-cx)**2+(rz-cz)**2)/.0012);hw+=w;hv+=w*h;}this.bundleHeights[i]=hw>0?hv/hw:1;}this.geometry=new THREE.BufferGeometry();this.createBuffers();this.material=createStrandMaterial({...this.options,radius:.00028*this.options.width});
  this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.name='GNM scalp-bound strands';this.mesh.frustumCulled=false;this.mesh.renderOrder=1;this.applyDrawRange();this.prepareSupports();this.update(positions,normals);
 }
 clampOptions(){const ranges={density:[0,1],length:[.012,this.options.maxLength],volume:[0,.026],frizz:[0,.0014],roughness:[0,1],hairlineHeight:[-1,1],frontCoverage:[0,1],backCoverage:[0,1],sideCoverage:[0,1],width:[.5,2]};for(const [k,[a,b]]of Object.entries(ranges))this.options[k]=clamp(this.options[k],a,b);if(!SCALP_STYLES.includes(this.options.style))this.options.style='side-sweep';}
 createBuffers(){
  const {count,segments}=this.options,per=segments+1,n=count*per*2;this.p=new Float32Array(n*3);this.t=new Float32Array(n*3);this.n=new Float32Array(n*3);this.latestPoints=new Float32Array(count*per*3);this.supportTriangles=new Int32Array(count*per);this.supportBarycentrics=new Float32Array(count*per*3);this.activeRoots=new Uint32Array(count);
  const side=new Float32Array(n),along=new Float32Array(n),random=new Float32Array(n);
  for(let i=0;i<count;i++)for(let j=0;j<per;j++)for(let k=0;k<2;k++){const v=(i*per+j)*2+k;side[v]=k?1:-1;along[v]=j/segments;random[v]=this.binding.random[i*4+2];}
  for(const [name,array]of [['position',this.p],['tangent',this.t],['scalpNormal',this.n]])this.geometry.setAttribute(name,new THREE.BufferAttribute(array,3).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('strandSide',new THREE.BufferAttribute(side,1));this.geometry.setAttribute('along',new THREE.BufferAttribute(along,1));this.geometry.setAttribute('strandRandom',new THREE.BufferAttribute(random,1));this.fullIndex=new THREE.BufferAttribute(new Uint32Array(count*segments*6),1).setUsage(THREE.DynamicDrawUsage);this.geometry.setIndex(this.fullIndex);
 }
 applyDrawRange(){
  const start=performance.now(),{count,segments,density,guides}=this.options,per=segments+1,indices=this.fullIndex.array;let ix=0,active=0,drawn=0;
  for(let i=0;i<count;i++){
   if(this.binding.selectionRandom[i]>=density*this.binding.selectionWeight(i,this.options))continue;
   this.activeRoots[active++]=i;if(guides&&i%18!==0)continue;drawn++;
   for(let j=0;j<segments;j++){const a=(i*per+j)*2;indices[ix++]=a;indices[ix++]=a+1;indices[ix++]=a+2;indices[ix++]=a+1;indices[ix++]=a+3;indices[ix++]=a+2;}
  }
  this.activeCount=active;this.drawnCount=drawn;this.fullIndex.needsUpdate=true;this.geometry.setDrawRange(0,ix);this.lastSelectionMs=performance.now()-start;
 }
 /** A prefix support always resolves to one genuine template triangle. Do not
  * blend two deformed triangle positions: that would cut inside curved skin.
  * On a triangle crossing use the nearer supporting face, project in neutral
  * coordinates, and clamp barycentrics. It remains stable under deformation. */
 prepareSupports(){
  const start=performance.now(),{count,segments,length,maxLength}=this.options,binding=this.binding,bper=binding.segments+1,per=segments+1;
  for(let i=0;i<count;i++)for(let j=0;j<per;j++){
   const q=i*per+j,f=j/segments*length/maxLength*binding.guideEnds[i],step=Math.min(binding.segments,Math.floor(f)),u=f-step,qa=i*bper+step,qb=Math.min(i*bper+binding.segments,qa+1),ta=binding.triangleIndices[qa],tb=binding.triangleIndices[qb],ba=binding.barycentrics.subarray(qa*3,qa*3+3),bb=binding.barycentrics.subarray(qb*3,qb*3+3);let t=ta,b;
   if(j===0){t=binding.rootTriangles[i];b=binding.rootBarycentrics.subarray(i*3,i*3+3);}
   else if(ta===tb)b=[0,1,2].map(k=>ba[k]*(1-u)+bb[k]*u);
   else{const a=binding.point(ta,ba),c=binding.point(tb,bb),p=a.map((v,k)=>v*(1-u)+c[k]*u);t=u<.5?ta:tb;b=binding.barycentric(t,p).map(v=>Math.max(0,v));const sum=b[0]+b[1]+b[2];b=b.map(v=>v/sum);}
   this.supportTriangles[q]=t;this.supportBarycentrics.set(b,q*3);
  }
  this.lastSupportMs=performance.now()-start;
 }
 update(positions,normals){
  const start=performance.now(),{count,segments,length,volume,frizz,style}=this.options,per=segments+1,tr=this.model.triangles,points=this.latestPoints,bary=this.supportBarycentrics;
  let minNormalSquared=Infinity,maxLift=0;
  for(let i=0;i<count;i++)for(let j=0;j<per;j++){
   const s=j/segments,q=i*per+j,triangle=this.supportTriangles[q];let px=0,py=0,pz=0,nx=0,ny=0,nz=0;
   for(let k=0;k<3;k++){const v=tr[triangle*3+k]*3,w=bary[q*3+k];px+=positions[v]*w;py+=positions[v+1]*w;pz+=positions[v+2]*w;nx+=normals[v]*w;ny+=normals[v+1]*w;nz+=normals[v+2]*w;}
   const nd=Math.hypot(nx,ny,nz)||1;nx/=nd;ny/=nd;nz/=nd;minNormalSquared=Math.min(minNormalSquared,nx*nx+ny*ny+nz*nz);
   const r=this.binding.random[i*4],r2=this.binding.random[i*4+2],top=smooth(.305,.38,this.binding.templateRoots[i*3+1]),envelope=Math.pow(s,.72+r*.8)*Math.pow(1-s,.7+r2*.7)*3.1;
   const rootMargin=Math.max(0,this.binding.safetyMargin(this.binding.templateRoots.subarray(i*3,i*3+3))),edgeFade=.2+.8*smooth(.001,.025,rootMargin),flyaway=this.binding.selectionRandom[i]<.018&&rootMargin>.018?(.0015+.0025*r2)*s*s:0;
   const bundleLift=this.bundleHeights[i];const lift=.00002+.00033*smooth(0,.18,s)+flyaway+edgeFade*volume*bundleLift*Math.sqrt(length/.065)*envelope*(.7+.3*r2)*(.35+.65*top)*(style==='short-crop'?.35:1),noise=frizz*s*s*(1-s*.65),phase=r*23;
   // Frizz lies in the local tangent plane, preserving a positive surface gap.
   let fx=Math.sin(s*19+phase),fy=Math.sin(s*26+this.binding.random[i*4+1]*23),fz=Math.sin(s*33+r2*23),fn=fx*nx+fy*ny+fz*nz;fx=(fx-fn*nx)*noise;fy=(fy-fn*ny)*noise;fz=(fz-fn*nz)*noise;
   points[q*3]=px+nx*lift+fx;points[q*3+1]=py+ny*lift+fy;points[q*3+2]=pz+nz*lift+fz;maxLift=Math.max(maxLift,lift);
   for(let k=0;k<2;k++){const v=q*6+k*3;this.n[v]=nx;this.n[v+1]=ny;this.n[v+2]=nz;}
  }
  for(let i=0;i<count;i++)for(let j=0;j<per;j++){const q=i*per+j,a=(i*per+Math.max(0,j-1))*3,b=(i*per+Math.min(segments,j+1))*3;let tx=points[b]-points[a],ty=points[b+1]-points[a+1],tz=points[b+2]-points[a+2];if(tx*tx+ty*ty+tz*tz<1e-18){const nx=this.n[q*6],ny=this.n[q*6+1],nz=this.n[q*6+2];if(Math.abs(ny)<.9){tx=-nz;ty=0;tz=nx;}else{tx=ny;ty=-nx;tz=0;}}for(let k=0;k<2;k++){const v=q*6+k*3;this.p[v]=points[q*3];this.p[v+1]=points[q*3+1];this.p[v+2]=points[q*3+2];this.t[v]=tx;this.t[v+1]=ty;this.t[v+2]=tz;}}
  this.minScalpNormalLength=Math.sqrt(minNormalSquared);this.maxLift=maxLift;for(const name of ['position','tangent','scalpNormal'])this.geometry.attributes[name].needsUpdate=true;this.lastUpdateMs=performance.now()-start;this.surfacePositions=positions;this.surfaceNormals=normals;
 }
 setLighting(value={}){setStrandLighting(this.material,value);}
 setViewport(camera,height){this.material.uniforms.pixelFactor.value=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height)/Math.max(.01,camera.zoom||1);}
 setAppearance(patch={}){
  const previous={...this.options};for(const k of ['style','color','roughness','guides','volume','frizz','density','length','hairlineHeight','frontCoverage','backCoverage','sideCoverage','width'])if(patch[k]!==undefined)this.options[k]=patch[k];this.clampOptions();
  const changed=k=>previous[k]!==this.options[k],styleChanged=changed('style');if(styleChanged)this.binding.setStyle(this.options.style);
  if(patch.color)this.material.uniforms.hairColor.value.set(patch.color);this.material.uniforms.roughness.value=this.options.roughness;this.material.uniforms.guideMode.value=this.options.guides?1:0;this.material.uniforms.radius.value=(this.options.guides?.0003:.00028)*this.options.width;
  if(['density','guides','hairlineHeight','frontCoverage','backCoverage','sideCoverage'].some(changed))this.applyDrawRange();
  if(styleChanged||changed('length'))this.prepareSupports();
  if(this.surfacePositions&&(styleChanged||['length','volume','frizz'].some(changed)))this.update(this.surfacePositions,this.surfaceNormals);
 }
 diagnostics(){
  let rootHash=2166136261,maxRootSurfaceDistance=0;const per=this.options.segments+1,bits=new Uint32Array(this.latestPoints.buffer);
  for(let i=0;i<this.options.count;i++){const q=i*per,p=this.binding.point(this.binding.rootTriangles[i],this.binding.rootBarycentrics.subarray(i*3,i*3+3),this.surfacePositions);let d=0;for(let k=0;k<3;k++){rootHash=Math.imul(rootHash^bits[q*3+k],16777619);d+=(this.latestPoints[q*3+k]-p[k])**2;}maxRootSurfaceDistance=Math.max(maxRootSurfaceDistance,Math.sqrt(d));}
  return {...this.binding.diagnostics(),style:this.options.style,regionField:'R03 lower nape / surface follicular units / crown emergence whorl',follicularUnitCount:this.binding.unitCount,areaInterpretation:'unclipped candidate triangle area; not exact anatomical scalp area',hairlineHeight:this.options.hairlineHeight,frontCoverage:this.options.frontCoverage,backCoverage:this.options.backCoverage,sideCoverage:this.options.sideCoverage,width:this.options.width,volume:this.options.volume,frizz:this.options.frizz,segments:this.options.segments,bindingSegments:this.binding.segments,scalpArea:this.binding.rootSurfaceArea,count:this.options.count,activeCount:this.activeCount,drawnCount:this.drawnCount,density:this.options.density,length:this.options.length,vertices:this.p.length/3,triangles:this.geometry.drawRange.count/3,finite:this.p.every(Number.isFinite)&&this.t.every(Number.isFinite)&&this.n.every(Number.isFinite),radius:this.material.uniforms.radius.value,minScalpNormalLength:this.minScalpNormalLength,maxLift:this.maxLift,lighting:strandLightingDiagnostics(this.material),rootHash:rootHash>>>0,maxRootSurfaceDistance,cachedStyles:[...this.binding.guideCache.keys()],guideBuilds:this.binding.guideBuilds,lastSelectionMs:this.lastSelectionMs,lastSupportMs:this.lastSupportMs,lastUpdateMs:this.lastUpdateMs};
 }
 dispose(){this.binding.guideCache.clear();this.geometry.dispose();this.material.dispose();}
}

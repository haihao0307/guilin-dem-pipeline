/** Facial grooming on the original GNM skin topology.
 * Neutral GNM landmarks define conservative eyebrow / moustache / chin masks.
 * These masks are grooming choices, not a substitute head or GNM anatomy labels.
 * Each deterministic root stores one component-0 triangle and barycentric weights.
 * Each guide support walks real adjacent skin triangles and remains inside its
 * protected domain. Deforming those same barycentrics follows identity, facial
 * expressions, and head/neck pose without screen-space placement.
 */
import * as THREE from 'three';
import {createRng} from './SemanticSampler.js';
import {ScalpBinding} from './ScalpBinding.js';
import {createStrandMaterial,setStrandLighting,strandLightingDiagnostics} from './HairLayer.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const point=(p,v)=>[p[v*3],p[v*3+1],p[v*3+2]];
function polylineDistance(p,line,dimensions=3){let best=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];let d=0,n=0;for(let k=0;k<dimensions;k++){d+=(b[k]-a[k])**2;n+=(p[k]-a[k])*(b[k]-a[k]);}const u=clamp(n/(d||1),0,1);let v=0;for(let k=0;k<dimensions;k++)v+=(p[k]-a[k]-(b[k]-a[k])*u)**2;best=Math.min(best,Math.sqrt(v));}return best;}
function lineHeight(x,line){for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if(x>=a[0]&&x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return line[x<line[0][0]?0:line.length-1][1];}
const DEFAULTS={
 brows:{visible:true,density:.85,length:.006,color:'#21170f',count:1600,segments:12,seed:9341,radius:.00015,roughness:.50},
 beard:{visible:false,density:.6,length:.0035,color:'#21170f',count:3600,segments:9,seed:5837,radius:.00012,roughness:.56},
};

class FacialRegion{
 constructor(model,landmarks,name,options,positions,normals,walker){
  this.model=model;this.walker=walker;this.landmarks=landmarks;this.name=name;this.options={...DEFAULTS[name],...options};this.options.count=Math.max(1,Math.round(this.options.count));this.options.density=clamp(this.options.density,0,1);this.options.length=clamp(this.options.length,.0008,name==='brows'?.012:.008);
  this.bind();this.bindGuides();this.geometry=new THREE.BufferGeometry();this.createBuffers();this.material=createStrandMaterial(this.options);this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.name='GNM surface-bound '+name;this.mesh.frustumCulled=false;this.mesh.renderOrder=2;this.applyDrawRange();this.update(positions,normals);
 }
 /** Bounded neutral-template masks explicitly keep eyelids and lips clear. */
 mask(p){
  const [x,y,z]=p,ax=Math.abs(x),l=this.landmarks;
  if(this.name==='brows'){
   if(ax<.008||ax>.058||z<.093||y<.308)return 0;
   const line=x<0?l.leftBrow:l.rightBrow,u=clamp((ax-.009)/.049,0,1),width=.0038*(1-.58*u),d=polylineDistance(p,line,2);
   if(d>=width||polylineDistance(p,x<0?l.leftEye:l.rightEye,2)<.0055)return 0;
   return clamp((1-d/width)*2.5,0,1);
  }
  if(z<.098||polylineDistance(p,l.upperLip)<.0036||polylineDistance(p,l.lowerLip)<.0036)return 0;
  const upper=lineHeight(x,l.upperLip),lower=lineHeight(x,l.lowerLip);
  if(ax>.003&&ax<.026&&y>upper+.0034&&y<.252-.43*ax){
   const margin=Math.min(y-upper-.0034,.252-.43*ax-y,.026-ax,ax-.003);return clamp(margin/.0014,0,1);
  }
  const ellipse=(x/.033)**2+((y-.2045)/.0135)**2;
  if(ellipse<1&&y<lower-.0045)return clamp((1-ellipse)*4,0,1);
  return 0;
 }
 bind(){
  const m=this.model,tr=m.triangles,template=m.template,items=[];let cumulative=0;
  // Broad candidate bounds include triangles whose interiors cross a thin brow.
  // Acceptance is tested again at every sampled point, so no coarse triangle
  // selection can put roots on the lid, lip, mouth cavity, eyes, or teeth.
  for(let t=0;t<tr.length/3;t++){
   const ids=[tr[t*3],tr[t*3+1],tr[t*3+2]];if(ids.some(v=>m.componentId[v]!==0))continue;
   const f=ids.map(v=>point(template,v)),center=[0,1,2].map(k=>(f[0][k]+f[1][k]+f[2][k])/3),n=cross(sub(f[1],f[0]),sub(f[2],f[0]));
   if(n[2]<=0)continue;
   const [x,y,z]=center;if(z<.088||Math.abs(x)>.065||(this.name==='brows'?(y<.304||y>.333):(y<.188||y>.255)))continue;
   const area=Math.hypot(...n)/2;if(area<1e-12)continue;cumulative+=area;items.push({t,cumulative});
  }
  if(!items.length)throw Error('No GNM skin candidates for '+this.name);
  const count=this.options.count,rng=createRng(this.options.seed);this.triangleIndices=new Int32Array(count);this.barycentrics=new Float32Array(count*3);this.tangentCoordinates=new Float32Array(count*2);this.random=new Float32Array(count);this.directions=new Float32Array(count*3);this.rootKinds=new Uint8Array(count);this.templateRoots=new Float32Array(count*3);this.candidateTriangleCount=items.length;
  let accepted=0,attempts=0;
  while(accepted<count&&attempts++<count*400){
   const target=rng()*cumulative;let lo=0,hi=items.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].cumulative<target)lo=mid+1;else hi=mid;}
   const t=items[lo].t,f=[0,1,2].map(k=>point(template,tr[t*3+k])),u=Math.sqrt(rng()),v=rng(),b=[1-u,u*(1-v),u*v],p=[0,1,2].map(k=>f[0][k]*b[0]+f[1][k]*b[1]+f[2][k]*b[2]);if(rng()>this.mask(p))continue;
   const i=accepted++,sign=p[0]<0?-1:1,isMoustache=this.name==='beard'&&p[1]>.23;
   const desired=this.name==='brows'?[sign*.85,.35-.38*clamp((Math.abs(p[0])-.009)/.049,0,1),0]:isMoustache?[sign*.87,-.25,0]:[p[0]*3,-1,0];
   const e1=sub(f[1],f[0]),e2=sub(f[2],f[0]),a=dot(e1,e1),d=dot(e2,e2),c=dot(e1,e2),det=a*d-c*c;
   this.triangleIndices[i]=t;this.barycentrics.set(b,i*3);this.directions.set(normalize(desired),i*3);this.tangentCoordinates[i*2]=(dot(desired,e1)*d-dot(desired,e2)*c)/det;this.tangentCoordinates[i*2+1]=(dot(desired,e2)*a-dot(desired,e1)*c)/det;this.random[i]=rng();this.rootKinds[i]=isMoustache?1:0;this.templateRoots.set(p,i*3);
  }
  if(accepted!==count)throw Error('Could not fill GNM '+this.name+' root domain');
 }
 /** Every visible guide support is a real skin triangle. Walk only while its
  * neutral-template point remains inside the protected grooming domain.
  * Rebinding is needed only for a length change, never for density/color/pose. */
 bindGuides(){
  const {count,segments,length}=this.options,per=segments+1;
  this.guideTriangles ||=new Int32Array(count*per);this.guideBarycentrics ||=new Float32Array(count*per*3);this.templateGuidePoints ||=new Float32Array(count*per*3);this.clippedGuideCount=0;
  for(let i=0;i<count;i++){
   let t=this.triangleIndices[i],b=Array.from(this.barycentrics.subarray(i*3,i*3+3)),stopped=false;
   const direction=Array.from(this.directions.subarray(i*3,i*3+3)),step=length*(.75+.35*this.random[i])/segments;
   for(let j=0;j<per;j++){
    const q=i*per+j;this.guideTriangles[q]=t;this.guideBarycentrics.set(b,q*3);this.templateGuidePoints.set(this.walker.point(t,b),q*3);
    if(j===segments||stopped)continue;
    let next=this.walker.advance(t,b,step,direction);
    if(this.mask(this.walker.point(next.t,next.b))<.025){
     // Keep a finite safe prefix and never put a shaft endpoint on a lid/lip.
     let lo=0,hi=step;next={t,b};for(let k=0;k<8;k++){const mid=(lo+hi)/2,probe=this.walker.advance(t,b,mid,direction);if(this.mask(this.walker.point(probe.t,probe.b))>=.025){lo=mid;next=probe;}else hi=mid;}stopped=true;this.clippedGuideCount++;
    }
    t=next.t;b=next.b;
   }
  }
 }
 createBuffers(){
  const {count,segments}=this.options,per=segments+1,n=count*per*2;this.p=new Float32Array(n*3);this.t=new Float32Array(n*3);this.n=new Float32Array(n*3);this.latestPoints=new Float32Array(count*per*3);this.currentRoots=new Float32Array(count*3);
  const sides=new Float32Array(n),along=new Float32Array(n),random=new Float32Array(n),indices=new Uint32Array(count*segments*6);let ix=0;
  for(let i=0;i<count;i++){for(let j=0;j<per;j++)for(let k=0;k<2;k++){const q=(i*per+j)*2+k;sides[q]=k?1:-1;along[q]=j/segments;random[q]=this.random[i];}for(let j=0;j<segments;j++){const a=(i*per+j)*2;for(const q of [a,a+1,a+2,a+1,a+3,a+2])indices[ix++]=q;}}
  for(const [name,array]of [['position',this.p],['tangent',this.t],['scalpNormal',this.n]])this.geometry.setAttribute(name,new THREE.BufferAttribute(array,3).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('strandSide',new THREE.BufferAttribute(sides,1));this.geometry.setAttribute('along',new THREE.BufferAttribute(along,1));this.geometry.setAttribute('strandRandom',new THREE.BufferAttribute(random,1));this.geometry.setIndex(new THREE.BufferAttribute(indices,1));
 }
 applyDrawRange(){this.activeCount=Math.round(this.options.count*this.options.density);this.geometry.setDrawRange(0,this.activeCount*this.options.segments*6);if(this.mesh)this.mesh.visible=!!this.options.visible;}
 update(positions,normals){
  const start=performance.now(),{count,segments}=this.options,per=segments+1,tr=this.model.triangles;this.minNormalLength=Infinity;this.minSignedSurfaceOffset=Infinity;
  for(let i=0;i<count;i++)for(let j=0;j<per;j++){
   const q=i*per+j,triangle=this.guideTriangles[q],ids=[0,1,2].map(k=>tr[triangle*3+k]*3);let surface=[0,0,0],normal=[0,0,0];
   for(let k=0;k<3;k++)for(let a=0;a<3;a++){surface[a]+=positions[ids[k]+a]*this.guideBarycentrics[q*3+k];normal[a]+=normals[ids[k]+a]*this.guideBarycentrics[q*3+k];}
   this.minNormalLength=Math.min(this.minNormalLength,Math.hypot(...normal));normal=normalize(normal);if(j===0)this.currentRoots.set(surface,i*3);
   const s=j/segments,lift=.00013+(this.name==='brows'?.00038*Math.sin(Math.PI*s):.00048*s)+.00012*s*s*this.random[i];
   const a=point(positions,tr[triangle*3]),b=point(positions,tr[triangle*3+1]),c=point(positions,tr[triangle*3+2]),faceNormal=normalize(cross(sub(b,a),sub(c,a)));this.minSignedSurfaceOffset=Math.min(this.minSignedSurfaceOffset,lift*dot(normal,faceNormal));
   for(let a=0;a<3;a++)this.latestPoints[q*3+a]=surface[a]+normal[a]*lift;
   for(let k=0;k<2;k++){const v=q*6+k*3;for(let a=0;a<3;a++){this.p[v+a]=this.latestPoints[q*3+a];this.n[v+a]=normal[a];}}
  }
  for(let i=0;i<count;i++)for(let j=0;j<per;j++){
   const q=i*per+j,a=(i*per+Math.max(0,j-1))*3,b=(i*per+Math.min(segments,j+1))*3;let direction=[0,1,2].map(c=>this.latestPoints[b+c]-this.latestPoints[a+c]);
   if(Math.hypot(...direction)<1e-9){const triangle=this.triangleIndices[i],ids=[0,1,2].map(k=>tr[triangle*3+k]*3);direction=[0,1,2].map(c=>(positions[ids[1]+c]-positions[ids[0]+c])*this.tangentCoordinates[i*2]+(positions[ids[2]+c]-positions[ids[0]+c])*this.tangentCoordinates[i*2+1]);}
   for(let k=0;k<2;k++)for(let c=0;c<3;c++)this.t[q*6+k*3+c]=direction[c];
  }
  for(const name of ['position','tangent','scalpNormal'])this.geometry.attributes[name].needsUpdate=true;this.surfacePositions=positions;this.surfaceNormals=normals;this.lastUpdateMs=performance.now()-start;
 }
 setAppearance(patch={}){const oldLength=this.options.length;for(const name of ['visible','color','roughness'])if(patch[name]!==undefined)this.options[name]=patch[name];if(Number.isFinite(patch.density))this.options.density=clamp(patch.density,0,1);if(Number.isFinite(patch.length))this.options.length=clamp(patch.length,.0008,this.name==='brows'?.012:.008);if(patch.color)this.material.uniforms.hairColor.value.set(patch.color);this.material.uniforms.roughness.value=this.options.roughness;this.applyDrawRange();if(oldLength!==this.options.length){this.bindGuides();this.update(this.surfacePositions,this.surfaceNormals);}}
 diagnostics(){
  const {count,segments}=this.options,per=segments+1,m=this.model,bits=new Uint32Array(this.latestPoints.buffer);let invalidTriangles=0,invalidTemplateRoots=0,minWeight=1,maxWeight=0,maxSumError=0,maxRootSurfaceDistance=0,rootHash=2166136261,moustacheCount=0,minEyeGap=Infinity,minLipGap=Infinity,invalidGuideTriangles=0,invalidTemplateGuidePoints=0,minGuideEyeGap=Infinity,minGuideLipGap=Infinity;
  for(let i=0;i<count;i++){const t=this.triangleIndices[i];if(t<0||t>=m.triangles.length/3||[0,1,2].some(k=>m.componentId[m.triangles[t*3+k]]!==0))invalidTriangles++;const b=this.barycentrics.subarray(i*3,i*3+3);maxSumError=Math.max(maxSumError,Math.abs(b[0]+b[1]+b[2]-1));for(const w of b){minWeight=Math.min(minWeight,w);maxWeight=Math.max(maxWeight,w);}const template=Array.from(this.templateRoots.subarray(i*3,i*3+3));if(!this.mask(template))invalidTemplateRoots++;minEyeGap=Math.min(minEyeGap,polylineDistance(template,template[0]<0?this.landmarks.leftEye:this.landmarks.rightEye));minLipGap=Math.min(minLipGap,polylineDistance(template,this.landmarks.upperLip),polylineDistance(template,this.landmarks.lowerLip));
   let distance=0;for(let a=0;a<3;a++){distance+=(this.latestPoints[i*per*3+a]-this.currentRoots[i*3+a])**2;rootHash=Math.imul(rootHash^bits[i*per*3+a],16777619);}maxRootSurfaceDistance=Math.max(maxRootSurfaceDistance,Math.sqrt(distance));moustacheCount+=this.rootKinds[i];}
  for(let q=0;q<this.guideTriangles.length;q++){const triangle=this.guideTriangles[q],p=Array.from(this.templateGuidePoints.subarray(q*3,q*3+3));if([0,1,2].some(k=>m.componentId[m.triangles[triangle*3+k]]!==0))invalidGuideTriangles++;if(!this.mask(p))invalidTemplateGuidePoints++;minGuideEyeGap=Math.min(minGuideEyeGap,polylineDistance(p,p[0]<0?this.landmarks.leftEye:this.landmarks.rightEye));minGuideLipGap=Math.min(minGuideLipGap,polylineDistance(p,this.landmarks.upperLip),polylineDistance(p,this.landmarks.lowerLip));}
  return {region:this.name,visible:this.mesh.visible,count,activeCount:this.activeCount,density:this.options.density,length:this.options.length,color:this.options.color,segments,vertices:this.p.length/3,triangles:this.geometry.drawRange.count/3,candidateTriangleCount:this.candidateTriangleCount,invalidGuideTriangles,invalidTemplateGuidePoints,clippedGuideCount:this.clippedGuideCount,minSignedSurfaceOffset:this.minSignedSurfaceOffset,minTemplateGuideEyeGap:minGuideEyeGap,minTemplateGuideLipGap:minGuideLipGap,invalidTriangles,invalidTemplateRoots,minWeight,maxWeight,maxSumError,maxRootSurfaceDistance,rootHash:rootHash>>>0,finite:this.p.every(Number.isFinite)&&this.t.every(Number.isFinite)&&this.n.every(Number.isFinite),minScalpNormalLength:this.minNormalLength,minTemplateEyeGap:minEyeGap,minTemplateLipGap:minLipGap,moustacheCount,chinCount:this.name==='beard'?count-moustacheCount:0,radius:this.material.uniforms.radius.value,lighting:strandLightingDiagnostics(this.material),lastUpdateMs:this.lastUpdateMs};
 }
 dispose(){this.geometry.dispose();this.material.dispose();}
}

export class FacialHairLayer{
 constructor(model,positions,normals,options={}){
  this.model=model;const raw=new Float32Array(68*3);model.computeLandmarks(model.template,raw);const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>Array.from(raw.subarray((i+a)*3,(i+a)*3+3)));
  this.landmarks={leftBrow:range(17,21),rightBrow:range(22,26),leftEye:[...range(36,41),...range(36,36)],rightEye:[...range(42,47),...range(42,42)],upperLip:range(48,54).sort((a,b)=>a[0]-b[0]),lowerLip:[...range(48,48),...range(54,59)].sort((a,b)=>a[0]-b[0])};
  this.walker=Object.create(ScalpBinding.prototype);this.walker.model=model;this.walker.adjacency=this.walker.buildAdjacency();
  this.mesh=new THREE.Group();this.mesh.name='GNM bound eyebrows and short beard';this.regions={};this.options={};for(const name of ['brows','beard']){const region=new FacialRegion(model,this.landmarks,name,options[name]||{},positions,normals,this.walker);this.regions[name]=region;this.options[name]=region.options;this.mesh.add(region.mesh);}
 }
 update(positions,normals){for(const region of Object.values(this.regions))region.update(positions,normals);}
 setLighting(value={}){for(const region of Object.values(this.regions))setStrandLighting(region.material,value);}
 setViewport(camera,height){for(const region of Object.values(this.regions))region.material.uniforms.pixelFactor.value=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height)/Math.max(.01,camera.zoom||1);}
 setAppearance(name,patch){if(typeof name==='string'){if(!this.regions[name])throw Error('Unknown facial hair region: '+name);this.regions[name].setAppearance(patch);}else for(const key of ['brows','beard'])if(name?.[key])this.regions[key].setAppearance(name[key]);}
 diagnostics(){const brows=this.regions.brows.diagnostics(),beard=this.regions.beard.diagnostics();return {kind:'gnm-facial-hair',finite:brows.finite&&beard.finite,invalidTriangles:brows.invalidTriangles+beard.invalidTriangles,brows,beard};}
 dispose(){for(const region of Object.values(this.regions))region.dispose();this.mesh.clear();}
}

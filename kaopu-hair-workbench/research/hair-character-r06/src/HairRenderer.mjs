import {RestFiberCache} from './RestFiberCache.mjs';
import {HairPassCache} from './HairPassCache.mjs';
import * as THREE from '../references/three.module.js';
import {COUNT,SEGMENTS,GUIDE_COUNT,NODES,NODE_POWER} from './Groom.mjs';
const vertex=`precision highp float;
#include <common>
#include <shadowmap_pars_vertex>
attribute vec4 guideIds,guideWeights,trait;attribute vec3 rootPoint,nativeRootIds,nativeRootBary;attribute float strandIndex,bodySide;
uniform sampler2D nativePositionMap,guideMap,frameMap,detailMap,headRadiusMap,bodyProfileMap;uniform mat4 rootToWorld,worldToHead,worldToBody,bodyToWorld;uniform vec2 viewport,bodyRange;
uniform vec3 headLocalCenter,contactRadii[10];uniform mat4 contactWorld[10],contactInverse[10];uniform sampler2D restGuideMap,restFrameMap,restFiberMap;uniform float useRestMemo,coarseContact;uniform mat4 worldFromSource;uniform float physicsWeight,activeSegments,strandBudget,samplingScale;uniform vec4 coarseModes;uniform float diameter,volume,groomLength,headRadiusMax;
varying vec3 vWorld,vTangent;varying float vSide,vCoverage,vSeed,vProgress,vSampling;
vec3 point(int g,int n){ivec2 uv=ivec2(g,clamp(n,0,24));vec3 r=texelFetch(restGuideMap,uv,0).xyz;float t=pow(float(clamp(n,0,24))/24.,1.3),b=t*t*(3.-t)*.5,c=1.7*t*t*(1.-1.6*t);r.x+=coarseModes.x*b+coarseModes.z*c;r.z+=coarseModes.y*b+coarseModes.w*c;vec3 p=(rootToWorld*vec4(r,1.)).xyz;if(physicsWeight>.0001)p=mix(p,texelFetch(guideMap,uv,0).xyz,physicsWeight);return p;}
// Evaluate position and exact Catmull-Rom derivative from the same controls.
void curve(int g,int n,float f,out vec3 p,out vec3 d){vec3 p0=point(g,n-1),p1=point(g,n),p2=point(g,n+1),p3=point(g,n+2),A=p2-p0,B=2.*p0-5.*p1+4.*p2-p3,C=-p0+3.*p1-3.*p2+p3;p=p1+.5*f*(A+f*(B+f*C));d=.5*(A+f*(2.*B+3.*f*C));}
void field(float t,out vec3 p,out vec3 tangent){float u=pow(clamp(t,0.,1.),1./1.3)*24.;int n=min(23,int(u));float f=u-float(n);vec3 a,b,c,d,da,db,dc,dd;curve(int(guideIds.x),n,f,a,da);curve(int(guideIds.y),n,f,b,db);curve(int(guideIds.z),n,f,c,dc);curve(int(guideIds.w),n,f,d,dd);p=a*guideWeights.x+b*guideWeights.y+c*guideWeights.z+d*guideWeights.w;tangent=normalize(da*guideWeights.x+db*guideWeights.y+dc*guideWeights.z+dd*guideWeights.w);}
vec3 fieldRoot(){return point(int(guideIds.x),0)*guideWeights.x+point(int(guideIds.y),0)*guideWeights.y+point(int(guideIds.z),0)*guideWeights.z+point(int(guideIds.w),0)*guideWeights.w;}
vec3 projectBody(vec3 p,float t,inout vec3 tangent){
 for(int pass=0;pass<2;pass++){
  vec3 q=(worldToHead*vec4(p,1.)).xyz,d=q-headLocalCenter;float len=length(d);
  if(t>.025&&len<headRadiusMax&&len>.00001){float u=atan(d.x,d.z)/(2.*PI)+.5,v=acos(clamp(d.y/len,-1.,1.))/PI,R=texture2D(headRadiusMap,vec2(u,v)).r+.0012+volume*pow(max(0.,d.y/len),2.)*(1.-exp(-t*groomLength/.015));if(len<R){q=headLocalCenter+d*(R+.00002)/len;p=(rootToWorld*vec4(q,1.)).xyz;vec3 normal=normalize(mat3(rootToWorld)*d);tangent=normalize(tangent-normal*min(0.,dot(tangent,normal)));}}
  for(int i=0;i<10;i++){if(i>=2&&i<8&&q.y>-.06)continue;vec3 c=(contactInverse[i]*vec4(p,1.)).xyz,r=contactRadii[i];if(any(greaterThan(abs(c),r)))continue;float scaled=length(c/r);if(scaled<1.&&scaled>.00001){vec3 gradient=c/(r*r);float l=length(gradient),depth=(1.-scaled)*scaled/l;c+=gradient/l*(depth+.00002);p=(contactWorld[i]*vec4(c,1.)).xyz;vec3 normal=normalize(mat3(contactWorld[i])*gradient);tangent=normalize(tangent-normal*min(0.,dot(tangent,normal)));}}
 }
 return p;
}
vec3 nativeV(float id){int i=int(id);return texelFetch(nativePositionMap,ivec2(i%256,i/256),0).xyz;}
vec3 nativeRoot(){vec3 a=nativeV(nativeRootIds.x),b=nativeV(nativeRootIds.y),c=nativeV(nativeRootIds.z),p=a*nativeRootBary.x+b*nativeRootBary.y+c*nativeRootBary.z,n=normalize(cross(b-a,c-a));vec3 center=(rootToWorld*vec4(headLocalCenter,1.)).xyz;if(dot(n,p-center)<0.)n=-n;return p+n*.00035;}
vec3 memoPoint(int n){int i=int(strandIndex)*25+clamp(n,0,24);return texelFetch(restFiberMap,ivec2(i%2048,i/2048),0).xyz;}
void main(){float t=position.y*56./activeSegments,s=t*trait.x;vec3 p,T,N;if(physicsWeight<.0001&&useRestMemo>.5){float u=pow(t,1./1.3)*24.;int n=min(23,int(u));vec3 a=memoPoint(n),b=memoPoint(n+1);p=mix(a,b,u-float(n));T=normalize(mat3(rootToWorld)*(b-a));float c=s*s*(3.-s)*.5,d=1.7*s*s*(1.-1.6*s);p.x+=coarseModes.x*c+coarseModes.z*d;p.z+=coarseModes.y*c+coarseModes.w*d;p=(rootToWorld*vec4(p,1.)).xyz;N=mat3(rootToWorld)*vec3(1.,0.,0.);}else{field(s,p,T);vec3 root=(rootToWorld*vec4(rootPoint,1.)).xyz;if(physicsWeight>.0001)root=mix(root,nativeRoot(),physicsWeight);
 p+=(root-fieldRoot())*(1.-.50*smoothstep(0.,.42,t));int n=int(pow(s,1./1.3)*24.);N=mat3(rootToWorld)*texelFetch(restFrameMap,ivec2(int(guideIds.x),n),0).xyz;if(physicsWeight>.0001)N=mix(N,texelFetch(frameMap,ivec2(int(guideIds.x),n),0).xyz,physicsWeight);}N=normalize(N-T*dot(N,T));vec3 B=normalize(cross(T,N));
 vec4 modal=vec4(0.);if(physicsWeight>.0001)modal=physicsWeight*texelFetch(detailMap,ivec2(int(strandIndex)%256,int(strandIndex)/256),0);float b1=t*t*(3.-t)*.5,b2=1.7*t*t*(1.-1.6*t),free=smoothstep(0.,.12,t),amplitude=.00012*(1.+trait.w*5.);
 p+=N*(modal.x*b1+modal.z*b2+amplitude*sin(11.*s+trait.z)*free)+B*(modal.y*b1+modal.w*b2+amplitude*cos(9.*s+trait.z)*free);
 if(physicsWeight>.0001||coarseContact>.5)p=projectBody(p,t,T);p=(worldFromSource*vec4(p,1.)).xyz;T=mat3(worldFromSource)*T;vWorld=p;vTangent=T;vSampling=clamp((strandBudget+256.-strandIndex)/256.,0.,1.);vSeed=fract(trait.z*1.718);vProgress=t;
 vec4 eye=viewMatrix*vec4(p,1.),clip=projectionMatrix*eye,ahead=projectionMatrix*viewMatrix*vec4(p+T*.002,1.);vec2 d=(ahead.xy/ahead.w-clip.xy/clip.w)*viewport,side=normalize(vec2(-d.y,d.x)+vec2(1e-8));float taper=1.-smoothstep(.65,1.,t),pixelWorld=2.*abs(clip.w)/max(abs(projectionMatrix[1][1])*viewport.y,1e-6),radius=diameter*.5*trait.y*taper,displayRadius=radius+.75*pixelWorld;
 vCoverage=radius;vSide=position.x*displayRadius;clip.xy+=side*position.x*displayRadius/pixelWorld*2./viewport*clip.w;gl_Position=clip;
 vec4 worldPosition=vec4(p,1.);vec3 transformedNormal=normalize(mat3(viewMatrix)*(p-(worldFromSource*rootToWorld*vec4(headLocalCenter,1.)).xyz));
 #include <shadowmap_vertex>
}`;
const fragment=`precision highp float;
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
uniform sampler2D nativeDepth;uniform float useNativeDepth;uniform vec2 viewport;
uniform vec3 absorption,lightDirs[3],lightColors[3],headCenter;uniform float roughness,samplingScale;
varying vec3 vWorld,vTangent;varying float vSide,vCoverage,vSeed,vProgress,vSampling;

float gaussian(float x,float s){return exp(-.5*x*x/(s*s))/(s*2.50662827);}
float wrapped(float x,float s){return gaussian(mod(x+PI,2.*PI)-PI,s);}
float fresnel(float c){float eta=1.55,ct=sqrt(max(0.,1.-(1.-c*c)/(eta*eta))),rs=(c-eta*ct)/(c+eta*ct),rp=(eta*c-ct)/(eta*c+ct);return .5*(rs*rs+rp*rp);}
vec3 fiber(vec3 T,vec3 V,vec3 L,vec3 sigma){float so=clamp(dot(T,V),-.995,.995),si=clamp(dot(T,L),-.995,.995),co=sqrt(1.-so*so),ci=sqrt(1.-si*si);vec3 N=normalize(V-T*so),B=normalize(cross(T,N));float phi=atan(dot(L,B),dot(L,N)),h=(vSeed*1.6-.8),go=asin(h),etaP=sqrt(1.55*1.55-so*so)/co,gt=asin(clamp(h/etaP,-.99,.99)),ct=sqrt(1.-so*so/(1.55*1.55));vec3 Tr=exp(-sigma*(2.*cos(gt)/ct));float f=fresnel(co*sqrt(1.-h*h)),angle=asin(si)+asin(so),s=sqrt(roughness*roughness+.20*.20),r=gaussian(angle+.07,s)*wrapped(phi+2.*go,.70),tt=gaussian(angle-.035,s*.65)*wrapped(phi-(2.*gt-2.*go+PI),.70),trt=gaussian(angle-.14,s*1.8)*wrapped(phi-(4.*gt-2.*go+2.*PI),.85);return (vec3(f)*r+(1.-f)*(1.-f)*Tr*tt+(1.-f)*(1.-f)*Tr*Tr*f*trt)*ci;}
void main(){if(useNativeDepth>.5&&gl_FragCoord.z>texture2D(nativeDepth,gl_FragCoord.xy/viewport).r)discard;float footprint=max(fwidth(vSide),1e-9),coverage=clamp((min(vSide+.5*footprint,vCoverage)-max(vSide-.5*footprint,-vCoverage))/footprint,0.,1.);if(coverage<.002)discard;vec3 T=normalize(vTangent),V=normalize(cameraPosition-vWorld),sigma=absorption*(.90+.20*vSeed),base=exp(-sigma*1.8),normal=normalize(vWorld-headCenter),color=base*.12+vec3(.018);
 for(int i=0;i<3;i++){vec3 L=normalize(lightDirs[i]);float shelter=.32+.68*max(0.,dot(normal,L));float visibility=1.;
 #if NUM_DIR_LIGHT_SHADOWS > 0
 if(i==0){DirectionalLightShadow sh=directionalLightShadows[0];visibility=getShadow(directionalShadowMap[0],sh.shadowMapSize,sh.shadowIntensity,sh.shadowBias,sh.shadowRadius,vDirectionalShadowCoord[0]);}
 #endif
 #if NUM_DIR_LIGHT_SHADOWS > 1
 if(i==2){DirectionalLightShadow sh=directionalLightShadows[1];visibility=getShadow(directionalShadowMap[1],sh.shadowMapSize,sh.shadowIntensity,sh.shadowBias,sh.shadowRadius,vDirectionalShadowCoord[1]);}
 #endif
 color+=lightColors[i]*fiber(T,V,L,sigma)*shelter*1.3*visibility;}
 float alpha=1.-pow(max(0.,1.-coverage*.96),samplingScale);gl_FragColor=vec4(color,alpha*vSampling);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export class HairRenderer{
 constructor(groom,dynamics,viewer){this.groom=groom;this.dynamics=dynamics;this.viewer=viewer;
  const texture=(data,w,h)=>{const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;return t;};this.guideTexture=texture(dynamics.offsets,GUIDE_COUNT,NODES);this.frameTexture=texture(dynamics.frames,GUIDE_COUNT,NODES);this.detailTexture=texture(dynamics.detail.texture,256,Math.ceil(COUNT/256));
  const g=new THREE.InstancedBufferGeometry(),a=[],idx=[];for(let n=0;n<=SEGMENTS;n++){a.push(-1,n/SEGMENTS,0,1,n/SEGMENTS,0);if(n<SEGMENTS){const i=n*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}}g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.setIndex(idx);g.instanceCount=COUNT;
  for(const [name,data,size]of [['guideIds',groom.indices,4],['guideWeights',groom.weights,4],['trait',groom.traits,4],['rootPoint',groom.roots,3],['nativeRootIds',Float32Array.from(groom.hairs.flatMap(r=>[...groom.binding.model.gnm.triangles.subarray(r.t*3,r.t*3+3)])),3],['nativeRootBary',Float32Array.from(groom.hairs.flatMap(r=>[...r.b])),3],['strandIndex',Float32Array.from({length:COUNT},(_,i)=>i),1],['bodySide',Float32Array.from(groom.hairs,r=>r.bodySide),1]])g.setAttribute(name,new THREE.InstancedBufferAttribute(data,size));
  const rest=dynamics.offsets.slice(),rf=dynamics.frames.slice(),iv=groom.binding.inverse.elements;for(let i=0;i<rest.length;i+=4){const x=rest[i],y=rest[i+1],z=rest[i+2],a=rf[i],b=rf[i+1],c=rf[i+2];rest[i]=iv[0]*x+iv[4]*y+iv[8]*z+iv[12];rest[i+1]=iv[1]*x+iv[5]*y+iv[9]*z+iv[13];rest[i+2]=iv[2]*x+iv[6]*y+iv[10]*z+iv[14];rf[i]=iv[0]*a+iv[4]*b+iv[8]*c;rf[i+1]=iv[1]*a+iv[5]*b+iv[9]*c;rf[i+2]=iv[2]*a+iv[6]*b+iv[10]*c;}this.restTexture=texture(rest,GUIDE_COUNT,NODES);this.restFrameTexture=texture(rf,GUIDE_COUNT,NODES);this.offset=new THREE.Vector3();this.restCache=new RestFiberCache(groom,this.restTexture,viewer);
  this.u={coarseContact:{value:0},restFiberMap:{value:this.restCache.target.texture},useRestMemo:{value:1},restGuideMap:{value:this.restTexture},restFrameMap:{value:this.restFrameTexture},worldFromSource:{value:new THREE.Matrix4()},coarseModes:{value:new THREE.Vector4()},physicsWeight:{value:1},activeSegments:{value:56},strandBudget:{value:COUNT},samplingScale:{value:1},nativeDepth:{value:null},useNativeDepth:{value:0},headRadiusMax:{value:groom.binding.radiusMax+.015},nativePositionMap:{value:groom.binding.nativeTexture},bodyProfileMap:{value:groom.binding.bodyTexture},bodyRange:{value:new THREE.Vector2(...groom.binding.bodyRange)},volume:{value:groom.style==='medium'?.003:.002},groomLength:{value:groom.style==='medium'?.20:.43},headRadiusMap:{value:groom.binding.radiusTexture},guideMap:{value:this.guideTexture},frameMap:{value:this.frameTexture},detailMap:{value:this.detailTexture},rootToWorld:{value:groom.binding.frame},worldToHead:{value:groom.binding.inverse},worldToBody:{value:groom.collisions.bodyInverse},bodyToWorld:{value:groom.collisions.bodyFrame},viewport:{value:new THREE.Vector2()},headLocalCenter:{value:new THREE.Vector3(...groom.binding.center)},contactWorld:{value:groom.collisions.matrices},contactInverse:{value:groom.collisions.inverses},contactRadii:{value:groom.collisions.radii},absorption:{value:new THREE.Vector3(2.4,2.8,3.3)},roughness:{value:.38},diameter:{value:70e-6},lightDirs:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},lightColors:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},headCenter:{value:new THREE.Vector3()}};
  this.u={...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),...this.u};
  this.material=new THREE.ShaderMaterial({lights:true,uniforms:this.u,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false});this.material.forceSinglePass=true;this.mesh=new THREE.Mesh(g,this.material);this.mesh.name='R06 native-bound procedural full hairstyle';this.mesh.frustumCulled=false;this.mesh.userData.platformAppearance=true;viewer.scene.add(this.mesh);this.mesh.renderOrder=6;this.mesh.onBeforeRender=()=>this.updateUniforms();
  this.mesh.castShadow=false;this.mesh.receiveShadow=true;this.viewportState=new THREE.Vector4();this.updateUniforms();(viewer.hairPassCache||(viewer.hairPassCache=new HairPassCache(viewer))).attach(this);

 }
 updateUniforms(){if(this.u.physicsWeight.value>.0001)this.groom.binding.refreshNative(true);const v=this.viewer;const vp=v.renderer.getCurrentViewport(this.viewportState);this.u.viewport.value.set(vp.z,vp.w);const lights=v.skinDNALights||[];for(let i=0;i<3;i++){const light=lights[i];if(light){this.u.lightDirs.value[i].copy(light.position).sub(light.target.position).normalize();this.u.lightColors.value[i].set(light.color.r,light.color.g,light.color.b).multiplyScalar(light.intensity);}else{this.u.lightDirs.value[i].set(-.5,.6,1).normalize();this.u.lightColors.value[i].setScalar(i?0.5:2.5);}}this.material.uniformsNeedUpdate=true;this.u.headCenter.value.fromArray(this.groom.binding.center).applyMatrix4(this.u.rootToWorld.value).applyMatrix4(this.u.worldFromSource.value);}
 budget(count,segments=56){count=Math.max(0,Math.min(COUNT,count));this.u.strandBudget.value=count;this.u.samplingScale.value=COUNT/Math.max(1,count+128);this.u.activeSegments.value=segments;this.mesh.geometry.instanceCount=Math.min(COUNT,Math.ceil(count+256));this.mesh.geometry.setDrawRange(0,segments*6);this.mesh.visible=count>0;return count;}
 update(){this.guideTexture.needsUpdate=this.frameTexture.needsUpdate=this.detailTexture.needsUpdate=true;}
 color(id){const colors={black:[2.4,2.8,3.3],chestnut:[.85,1.55,2.3]};this.u.absorption.value.fromArray(colors[id]||colors.black);}
 dispose(){this.viewer.hairPassCache?.detach(this);this.viewer.scene.remove(this.mesh);this.mesh.geometry.dispose();this.material.dispose();this.restCache.dispose();this.groom.binding.nativeTexture.dispose();this.groom.binding.radiusTexture.dispose();this.groom.binding.bodyTexture.dispose();for(const t of [this.guideTexture,this.frameTexture,this.detailTexture,this.restTexture,this.restFrameTexture])t.dispose();}
}


import * as THREE from '../references/three.module.js';
import {COUNT,SEGMENTS,GUIDE_COUNT,NODES,NODE_POWER} from './Groom.mjs';
const vertex=`precision highp float;
#include <common>
#include <shadowmap_pars_vertex>
attribute vec4 guideIds,guideWeights,trait;attribute vec3 rootPoint,nativeRootIds,nativeRootBary;attribute float strandIndex,bodySide;
uniform sampler2D nativePositionMap,guideMap,frameMap,detailMap,headRadiusMap,bodyProfileMap;uniform mat4 rootToWorld,worldToHead,worldToBody,bodyToWorld;uniform vec2 viewport,bodyRange;
uniform vec3 proxyCenters[7],proxyRadii[7];uniform float diameter,volume,groomLength,headRadiusMax;
varying vec3 vWorld,vTangent;varying float vSide,vCoverage,vSeed,vProgress;
vec3 point(int g,int n){return texelFetch(guideMap,ivec2(g,clamp(n,0,24)),0).xyz;}
vec3 curve(int g,float t){float a=pow(clamp(t,0.,1.),1./1.3)*24.;int n=min(23,int(a));float f=a-float(n);vec3 p0=point(g,n-1),p1=point(g,n),p2=point(g,n+1),p3=point(g,n+2);return .5*((2.*p1)+(p2-p0)*f+(2.*p0-5.*p1+4.*p2-p3)*f*f+(-p0+3.*p1-3.*p2+p3)*f*f*f);}
vec3 field(float t){return curve(int(guideIds.x),t)*guideWeights.x+curve(int(guideIds.y),t)*guideWeights.y+curve(int(guideIds.z),t)*guideWeights.z+curve(int(guideIds.w),t)*guideWeights.w;}
vec3 projectBody(vec3 p,float t){for(int pass=0;pass<2;pass++){mat4 I=pass==0?worldToHead:worldToBody,F=pass==0?rootToWorld:bodyToWorld;vec3 q=(I*vec4(p,1.)).xyz;if(pass==1&&q.y<bodyRange.x&&q.y>bodyRange.y){float v=(q.y-bodyRange.x)/(bodyRange.y-bodyRange.x);vec3 profile=texture2D(bodyProfileMap,vec2((v*63.+.5)/64.,.5)).rgb;float r=length(vec2(q.x/profile.x,(q.z-profile.y)/profile.z));if(r<1.&&r>.001){q.z=profile.y+bodySide*profile.z*sqrt(max(0.,1.-pow(q.x/profile.x,2.)));}}for(int i=0;i<7;i++){if((pass==0&&i>=3)||(pass==1)||(pass==0&&t<.035))continue;vec3 d=q-proxyCenters[i];if(i==0){float len=length(d);if(len>=headRadiusMax)continue;float u=atan(d.x,d.z)/(2.*3.14159265359)+.5,v=acos(clamp(d.y/len,-1.,1.))/3.14159265359,R=texture2D(headRadiusMap,vec2(u,v)).r+.0015+volume*pow(max(0.,d.y/len),2.)*(1.-exp(-t*groomLength/.015));if(len<R&&len>.00001)q=proxyCenters[i]+d*R/len;continue;}float radius=length(d/proxyRadii[i]);if(radius<1.&&radius>.001)q=proxyCenters[i]+d/radius;}p=(F*vec4(q,1.)).xyz;}return p;}
vec3 nativeV(float id){int i=int(id);return texelFetch(nativePositionMap,ivec2(i%256,i/256),0).xyz;}
vec3 nativeRoot(){vec3 a=nativeV(nativeRootIds.x),b=nativeV(nativeRootIds.y),c=nativeV(nativeRootIds.z),p=a*nativeRootBary.x+b*nativeRootBary.y+c*nativeRootBary.z,n=normalize(cross(b-a,c-a));vec3 center=(rootToWorld*vec4(proxyCenters[0],1.)).xyz;if(dot(n,p-center)<0.)n=-n;return p+n*.00035;}
void main(){float t=position.y,s=t*trait.x;vec3 p=field(s),T=normalize(field(min(1.,s+.004))-field(max(0.,s-.004))),root=nativeRoot();
 p+=(root-field(0.))*(1.-.50*smoothstep(0.,.42,t));int n=int(pow(s,1./1.3)*24.);vec3 N=texelFetch(frameMap,ivec2(int(guideIds.x),n),0).xyz;N=normalize(N-T*dot(N,T));vec3 B=normalize(cross(T,N));
 vec4 modal=texelFetch(detailMap,ivec2(int(strandIndex)%256,int(strandIndex)/256),0);float b1=t*t*(3.-t)*.5,b2=1.7*t*t*(1.-1.6*t),free=smoothstep(0.,.12,t),amplitude=.00012*(1.+trait.w*5.);
 p+=N*(modal.x*b1+modal.z*b2+amplitude*sin(11.*s+trait.z)*free)+B*(modal.y*b1+modal.w*b2+amplitude*cos(9.*s+trait.z)*free);
 p=projectBody(p,t);vWorld=p;vTangent=T;vSeed=fract(trait.z*1.718);vProgress=t;
 vec4 eye=viewMatrix*vec4(p,1.),clip=projectionMatrix*eye,ahead=projectionMatrix*viewMatrix*vec4(p+T*.002,1.);vec2 d=(ahead.xy/ahead.w-clip.xy/clip.w)*viewport,side=normalize(vec2(-d.y,d.x)+vec2(1e-8));float taper=1.-smoothstep(.65,1.,t),pixelWorld=2.*abs(clip.w)/max(abs(projectionMatrix[1][1])*viewport.y,1e-6),radius=diameter*.5*trait.y*taper,displayRadius=radius+.75*pixelWorld;
 vCoverage=radius;vSide=position.x*displayRadius;clip.xy+=side*position.x*displayRadius/pixelWorld*2./viewport*clip.w;gl_Position=clip;
 vec4 worldPosition=vec4(p,1.);vec3 transformedNormal=normalize(mat3(viewMatrix)*(p-(rootToWorld*vec4(proxyCenters[0],1.)).xyz));
 #include <shadowmap_vertex>
}`;
const fragment=`precision highp float;
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
uniform vec3 absorption,lightDirs[3],lightColors[3],headCenter;uniform float roughness;
varying vec3 vWorld,vTangent;varying float vSide,vCoverage,vSeed,vProgress;

float gaussian(float x,float s){return exp(-.5*x*x/(s*s))/(s*2.50662827);}
float wrapped(float x,float s){return gaussian(mod(x+PI,2.*PI)-PI,s);}
float fresnel(float c){float eta=1.55,ct=sqrt(max(0.,1.-(1.-c*c)/(eta*eta))),rs=(c-eta*ct)/(c+eta*ct),rp=(eta*c-ct)/(eta*c+ct);return .5*(rs*rs+rp*rp);}
vec3 fiber(vec3 T,vec3 V,vec3 L,vec3 sigma){float so=clamp(dot(T,V),-.995,.995),si=clamp(dot(T,L),-.995,.995),co=sqrt(1.-so*so),ci=sqrt(1.-si*si);vec3 N=normalize(V-T*so),B=normalize(cross(T,N));float phi=atan(dot(L,B),dot(L,N)),h=(vSeed*1.6-.8),go=asin(h),etaP=sqrt(1.55*1.55-so*so)/co,gt=asin(clamp(h/etaP,-.99,.99)),ct=sqrt(1.-so*so/(1.55*1.55));vec3 Tr=exp(-sigma*(2.*cos(gt)/ct));float f=fresnel(co*sqrt(1.-h*h)),angle=asin(si)+asin(so),s=sqrt(roughness*roughness+.20*.20),r=gaussian(angle+.07,s)*wrapped(phi+2.*go,.70),tt=gaussian(angle-.035,s*.65)*wrapped(phi-(2.*gt-2.*go+PI),.70),trt=gaussian(angle-.14,s*1.8)*wrapped(phi-(4.*gt-2.*go+2.*PI),.85);return (vec3(f)*r+(1.-f)*(1.-f)*Tr*tt+(1.-f)*(1.-f)*Tr*Tr*f*trt)*ci;}
void main(){float footprint=max(fwidth(vSide),1e-9),coverage=clamp((min(vSide+.5*footprint,vCoverage)-max(vSide-.5*footprint,-vCoverage))/footprint,0.,1.);if(coverage<.002)discard;vec3 T=normalize(vTangent),V=normalize(cameraPosition-vWorld),sigma=absorption*(.90+.20*vSeed),base=exp(-sigma*1.8),normal=normalize(vWorld-headCenter),color=base*.12+vec3(.018);
 for(int i=0;i<3;i++){vec3 L=normalize(lightDirs[i]);float shelter=.32+.68*max(0.,dot(normal,L));float visibility=1.;
 #if NUM_DIR_LIGHT_SHADOWS > 0
 if(i==0){DirectionalLightShadow sh=directionalLightShadows[0];visibility=getShadow(directionalShadowMap[0],sh.shadowMapSize,sh.shadowIntensity,sh.shadowBias,sh.shadowRadius,vDirectionalShadowCoord[0]);}
 #endif
 #if NUM_DIR_LIGHT_SHADOWS > 1
 if(i==2){DirectionalLightShadow sh=directionalLightShadows[1];visibility=getShadow(directionalShadowMap[1],sh.shadowMapSize,sh.shadowIntensity,sh.shadowBias,sh.shadowRadius,vDirectionalShadowCoord[1]);}
 #endif
 color+=lightColors[i]*fiber(T,V,L,sigma)*shelter*1.3*visibility;}
 gl_FragColor=vec4(color,coverage*.96);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export class HairRenderer{
 constructor(groom,dynamics,viewer){this.groom=groom;this.dynamics=dynamics;this.viewer=viewer;
  const texture=(data,w,h)=>{const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;return t;};this.guideTexture=texture(dynamics.offsets,GUIDE_COUNT,NODES);this.frameTexture=texture(dynamics.frames,GUIDE_COUNT,NODES);this.detailTexture=texture(dynamics.detail.texture,256,Math.ceil(COUNT/256));
  const g=new THREE.InstancedBufferGeometry(),a=[],idx=[];for(let n=0;n<=SEGMENTS;n++){a.push(-1,n/SEGMENTS,0,1,n/SEGMENTS,0);if(n<SEGMENTS){const i=n*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}}g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.setIndex(idx);g.instanceCount=COUNT;
  for(const [name,data,size]of [['guideIds',groom.indices,4],['guideWeights',groom.weights,4],['trait',groom.traits,4],['rootPoint',groom.roots,3],['nativeRootIds',Float32Array.from(groom.hairs.flatMap(r=>[...groom.binding.model.gnm.triangles.subarray(r.t*3,r.t*3+3)])),3],['nativeRootBary',Float32Array.from(groom.hairs.flatMap(r=>[...r.b])),3],['strandIndex',Float32Array.from({length:COUNT},(_,i)=>i),1],['bodySide',Float32Array.from(groom.hairs,r=>r.bodySide),1]])g.setAttribute(name,new THREE.InstancedBufferAttribute(data,size));
  this.u={headRadiusMax:{value:groom.binding.radiusMax+.015},nativePositionMap:{value:groom.binding.nativeTexture},bodyProfileMap:{value:groom.binding.bodyTexture},bodyRange:{value:new THREE.Vector2(...groom.binding.bodyRange)},volume:{value:groom.style==='medium'?.012:.006},groomLength:{value:groom.style==='medium'?.20:.43},headRadiusMap:{value:groom.binding.radiusTexture},guideMap:{value:this.guideTexture},frameMap:{value:this.frameTexture},detailMap:{value:this.detailTexture},rootToWorld:{value:groom.binding.frame},worldToHead:{value:groom.binding.inverse},worldToBody:{value:groom.collisions.bodyInverse},bodyToWorld:{value:groom.collisions.bodyFrame},viewport:{value:new THREE.Vector2()},proxyCenters:{value:groom.collisions.shapes.map(s=>new THREE.Vector3(...s.c))},proxyRadii:{value:groom.collisions.shapes.map(s=>new THREE.Vector3(...s.r))},absorption:{value:new THREE.Vector3(2.4,2.8,3.3)},roughness:{value:.38},diameter:{value:70e-6},lightDirs:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},lightColors:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]},headCenter:{value:new THREE.Vector3()}};
  this.u={...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),...this.u};
  this.material=new THREE.ShaderMaterial({lights:true,uniforms:this.u,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false});this.mesh=new THREE.Mesh(g,this.material);this.mesh.name='R04 native-bound procedural full hairstyle';this.mesh.frustumCulled=false;this.mesh.userData.platformAppearance=true;viewer.scene.add(this.mesh);this.mesh.renderOrder=6;this.mesh.onBeforeRender=()=>this.updateUniforms();
  const depthFragment=`precision highp float;
  #include <packing>
  varying float vSide,vCoverage,vSeed;
  void main(){float f=max(fwidth(vSide),1e-9),coverage=clamp((min(vSide+.5*f,vCoverage)-max(vSide-.5*f,-vCoverage))/f,0.,1.);float h=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+vSeed*237.7)*43758.5453);if(h>coverage)discard;gl_FragColor=packDepthToRGBA(gl_FragCoord.z);}`;
  this.depthMaterial=new THREE.ShaderMaterial({uniforms:this.u,vertexShader:vertex.replace('#include <shadowmap_pars_vertex>','').replace('#include <shadowmap_vertex>',''),fragmentShader:depthFragment,side:THREE.DoubleSide});this.mesh.customDepthMaterial=this.depthMaterial;this.mesh.castShadow=false;this.mesh.receiveShadow=true;
  this.mesh.onBeforeShadow=()=>{const vp=viewer.renderer.getContext().getParameter(viewer.renderer.getContext().VIEWPORT);this.u.viewport.value.set(vp[2],vp[3]);this.depthMaterial.uniformsNeedUpdate=true;};this.updateUniforms();viewer.renderer.shadowMap.needsUpdate=true;
 }
 updateUniforms(){const v=this.viewer;const gl=v.renderer.getContext(),vp=gl.getParameter(gl.VIEWPORT);this.u.viewport.value.set(vp[2],vp[3]);const lights=v.skinDNALights||[];for(let i=0;i<3;i++){const light=lights[i];if(light){this.u.lightDirs.value[i].copy(light.position).sub(light.target.position).normalize();this.u.lightColors.value[i].set(light.color.r,light.color.g,light.color.b).multiplyScalar(light.intensity);}else{this.u.lightDirs.value[i].set(-.5,.6,1).normalize();this.u.lightColors.value[i].setScalar(i?0.5:2.5);}}this.material.uniformsNeedUpdate=true;this.u.headCenter.value.fromArray(this.groom.binding.center).applyMatrix4(this.groom.binding.frame);}
 update(){this.viewer.renderer.shadowMap.needsUpdate=true;this.guideTexture.needsUpdate=this.frameTexture.needsUpdate=this.detailTexture.needsUpdate=true;}
 color(id){const colors={black:[2.4,2.8,3.3],chestnut:[.85,1.55,2.3]};this.u.absorption.value.fromArray(colors[id]||colors.black);}
 dispose(){this.viewer.scene.remove(this.mesh);this.mesh.geometry.dispose();this.material.dispose();this.depthMaterial.dispose();this.groom.binding.nativeTexture.dispose();this.groom.binding.radiusTexture.dispose();this.groom.binding.bodyTexture.dispose();for(const t of [this.guideTexture,this.frameTexture,this.detailTexture])t.dispose();}
}


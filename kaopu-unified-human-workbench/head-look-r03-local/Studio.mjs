import * as THREE from '../full/source/registration-vendor/three.module.js';
import {environmentPixels} from '../head-look-r02-native/Studio.mjs';
const effective=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const shadowGLSL=`
vec2 lfDisk(int i,int count){float a=float(i)*2.39996323,r=sqrt((float(i)+.5)/float(count));return vec2(cos(a),sin(a))*r;}
float getShadow(sampler2D shadowMap,vec2 shadowMapSize,float shadowIntensity,float shadowBias,float shadowRadius,vec4 coord){
 if(uLFShadowActive<.5)return lfNativeShadow(shadowMap,shadowMapSize,shadowIntensity,shadowBias,shadowRadius,coord);
 vec3 p=coord.xyz/coord.w;vec3 dx=dFdx(p),dy=dFdy(p);float det=dx.x*dy.y-dx.y*dy.x;
 vec2 slope=abs(det)>1e-12?vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/det:vec2(0.);slope=clamp(slope,vec2(-2.),vec2(2.));
 if(coord.w<=0.||p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z<=0.||p.z>=1.)return 1.;
 float texel=1./shadowMapSize.x,angle=tan(uLFSoftAngle),search=clamp(angle*.18*uLFDepthScale,texel*1.5,.040);
 float separation=0.,blockers=0.;
 for(int j=0;j<12;j++){vec2 off=lfDisk(j,12)*search;vec2 uv=p.xy+off;float d=unpackRGBAToDepth(texture2D(shadowMap,uv));float receiver=p.z+dot(slope,off)+shadowBias;
  if(d<receiver-.000015){separation+=receiver-d;blockers+=1.;}}
 float radius=texel*.85;if(blockers>.5)radius=clamp(separation/blockers*uLFDepthScale*angle,texel*.85,.035);
 float visible=0.;for(int j=0;j<24;j++){vec2 off=lfDisk(j,24)*radius;float d=unpackRGBAToDepth(texture2D(shadowMap,p.xy+off));visible+=step(p.z+dot(slope,off)+shadowBias,d);}
 return mix(1.,visible/24.,shadowIntensity);
}
`;
export function installStudio(v){
 const scene=v.scene,r=v.renderer,prior=v.setFoldLook,material=v.skin.material,priorCompile=material.onBeforeCompile,priorKey=material.customProgramCacheKey.bind(material);
 const U={uLFShadowActive:{value:1},uLFSoftAngle:{value:9*Math.PI/180},uLFDepthScale:{value:3.75/1.24}};
 material.onBeforeCompile=function(s,...args){priorCompile.call(this,s,...args);Object.assign(s.uniforms,U);let chunk=THREE.ShaderChunk.shadowmap_pars_fragment;if(!chunk.includes('float getShadow(')||!chunk.includes('vec2 cubeToUV'))throw Error('Shadow API drift');chunk=chunk.replace('float getShadow(','float lfNativeShadow(').replace('vec2 cubeToUV',shadowGLSL+'\nvec2 cubeToUV');s.fragmentShader='uniform float uLFShadowActive,uLFSoftAngle,uLFDepthScale;\n'+s.fragmentShader.replace('#include <shadowmap_pars_fragment>',()=>chunk);};
 material.customProgramCacheKey=()=>priorKey()+'/local-r03-pcss';material.needsUpdate=true;
 const group=new THREE.Group();group.name='LOCAL-R03 calibrated neutral studio';group.visible=false;scene.add(group);
 const key=new THREE.DirectionalLight(0xffffff,2.5),fill=new THREE.DirectionalLight(0xffffff,.55),rim=new THREE.DirectionalLight(0xffffff,.38);key.name='Neutral main';fill.name='Neutral fill';rim.name='Neutral rim';
 for(const [i,l]of [key,fill,rim].entries()){group.add(l,l.target);l.castShadow=i<2;l.shadow.mapSize.set(i===0?2048:1024,i===0?2048:1024);Object.assign(l.shadow.camera,{left:-.62,right:.62,top:.62,bottom:-.62,near:.05,far:3.8});l.shadow.bias=-.000022;l.shadow.normalBias=.00010;l.shadow.radius=1;l.shadow.camera.updateProjectionMatrix();}
 let active=false,snapshot,env,builds=0,last='',disposed=false;
 function remember(){return{environment:scene.environment,intensity:scene.environmentIntensity,rotation:scene.environmentRotation.clone(),tone:r.toneMapping,exposure:r.toneMappingExposure,clear:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),shadow:{enabled:r.shadowMap.enabled,type:r.shadowMap.type,autoUpdate:r.shadowMap.autoUpdate},cast:v.mesh.castShadow,receive:v.mesh.receiveShadow,lights:scene.children.filter(x=>x.isLight).map(x=>[x,x.visible])};}
 function restore(){if(!snapshot)return;scene.environment=snapshot.environment;scene.environmentIntensity=snapshot.intensity;scene.environmentRotation.copy(snapshot.rotation);r.toneMapping=snapshot.tone;r.toneMappingExposure=snapshot.exposure;r.setClearColor(snapshot.clear,snapshot.alpha);Object.assign(r.shadowMap,snapshot.shadow);r.shadowMap.needsUpdate=true;v.mesh.castShadow=snapshot.cast;v.mesh.receiveShadow=snapshot.receive;for(const[l,visible]of snapshot.lights)l.visible=visible;group.visible=false;active=false;snapshot=null;v.foldLightKey='';v.foldLastMode=null;}
 function environment(){if(env)return;const source=new THREE.DataTexture(environmentPixels(),512,256,THREE.RGBAFormat,THREE.FloatType);source.mapping=THREE.EquirectangularReflectionMapping;source.colorSpace=THREE.LinearSRGBColorSpace;source.minFilter=source.magFilter=THREE.LinearFilter;source.needsUpdate=true;const gen=new THREE.PMREMGenerator(r);try{env=gen.fromEquirectangular(source);builds++;}finally{gen.dispose();source.dispose();}}
 function apply(){if(disposed)return;const s=v.model.localFeatures.settings;U.uLFShadowActive.value=s.lighting?1:0;U.uLFSoftAngle.value=s.softness*Math.PI/180;
  if(!s.lighting){if(active)restore();prior.call(v);return;}
  if(!active){snapshot=remember();active=true;}prior.call(v);environment();group.visible=true;if(v.foldLights)v.foldLights.group.visible=false;if(v.cineRig){v.cineRig.group.visible=false;v.cineRig.U.uCShadowEnable.value=0;}for(const o of scene.children)if(o.isLight)o.visible=false;
  const c=v.cineRig?.center||new THREE.Vector3(0,.715,0),a=s.azimuth*Math.PI/180,e=s.elevation*Math.PI/180;
  const dirs=[new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)),new THREE.Vector3(-.65,.28,.80).normalize(),new THREE.Vector3(-.28,.22,-1).normalize()];
  for(const[i,l]of [key,fill,rim].entries()){l.target.position.copy(c);l.position.copy(c).addScaledVector(dirs[i],1.4);l.intensity=[s.key,s.fill,s.rim][i];}
  scene.environment=env.texture;scene.environmentIntensity=s.environment;scene.environmentRotation.set(0,100*Math.PI/180,0);r.toneMapping=THREE.NeutralToneMapping;r.toneMappingExposure=s.exposure;r.setClearColor(0x242c32);r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFShadowMap;r.shadowMap.autoUpdate=false;v.mesh.castShadow=v.mesh.receiveShadow=true;
  const stamp=[s.azimuth,s.elevation,...c.toArray(),v.geometry.attributes.position.version,...(v.mesh.morphTargetInfluences||[])].join(',');if(stamp!==last){r.shadowMap.needsUpdate=true;last=stamp;}
 }
 v.setFoldLook=apply;
 return{apply,report(){const lights=[];scene.traverse(o=>{if(o.isLight&&effective(o))lights.push({name:o.name,intensity:o.intensity,colour:o.color?.getHexString(),shadow:o.castShadow});});return{active,lights,environmentBuilds:builds,neutralEnvironment:true,shadowMaps:[2048,1024],sourceHalfAngleDegrees:v.model.localFeatures.settings.softness,method:'receiver-plane corrected PCSS approximation: 12 blocker + 24 filter taps; contact hardening from blocker separation',fullAreaLightIntegration:false,consumerGPUFPSCertified:false};},dispose(){if(disposed)return;restore();disposed=true;v.setFoldLook=prior;material.onBeforeCompile=priorCompile;material.customProgramCacheKey=priorKey;material.needsUpdate=true;scene.remove(group);for(const l of[key,fill,rim])l.shadow.dispose();env?.dispose();}};
}

import * as THREE from './three.module.js';
import {environmentPixels} from './Environment.mjs';

const effective=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
export function installStudio(v){
 const scene=v.scene,r=v.renderer,prior=v.setFoldLook;
 const group=new THREE.Group();group.name='LOCAL-R03 calibrated neutral studio';group.visible=false;scene.add(group);
 const key=new THREE.DirectionalLight(0xffffff,2.5),fill=new THREE.DirectionalLight(0xffffff,.55),rim=new THREE.DirectionalLight(0xffffff,.38);key.name='Neutral main';fill.name='Neutral fill';rim.name='Neutral rim';
 rim.color.setHex(15704958);
 for(const [i,l]of [key,fill,rim].entries()){group.add(l,l.target);l.castShadow=i!==1;l.shadow.mapSize.set(i===0?2048:1024,i===0?2048:1024);Object.assign(l.shadow.camera,{left:-.62,right:.62,top:.62,bottom:-.62,near:.05,far:3.8});l.shadow.bias=-.0018;l.shadow.normalBias=0;l.shadow.radius=5;l.shadow.camera.updateProjectionMatrix();}
 let active=false,snapshot,env,builds=0,last='',disposed=false,shadowSpan=.62;
 function remember(){return{environment:scene.environment,intensity:scene.environmentIntensity,rotation:scene.environmentRotation.clone(),tone:r.toneMapping,exposure:r.toneMappingExposure,clear:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),shadow:{enabled:r.shadowMap.enabled,type:r.shadowMap.type,autoUpdate:r.shadowMap.autoUpdate},cast:v.mesh.castShadow,receive:v.mesh.receiveShadow,lights:scene.children.filter(x=>x.isLight).map(x=>[x,x.visible])};}
 function restore(){if(!snapshot)return;scene.environment=snapshot.environment;scene.environmentIntensity=snapshot.intensity;scene.environmentRotation.copy(snapshot.rotation);r.toneMapping=snapshot.tone;r.toneMappingExposure=snapshot.exposure;r.setClearColor(snapshot.clear,snapshot.alpha);Object.assign(r.shadowMap,snapshot.shadow);r.shadowMap.needsUpdate=true;v.mesh.castShadow=snapshot.cast;v.mesh.receiveShadow=snapshot.receive;for(const[l,visible]of snapshot.lights)l.visible=visible;group.visible=false;active=false;snapshot=null;v.foldLightKey='';v.foldLastMode=null;}
 function environment(){if(env)return;const source=new THREE.DataTexture(environmentPixels(),512,256,THREE.RGBAFormat,THREE.FloatType);source.mapping=THREE.EquirectangularReflectionMapping;source.colorSpace=THREE.LinearSRGBColorSpace;source.minFilter=source.magFilter=THREE.LinearFilter;source.needsUpdate=true;const gen=new THREE.PMREMGenerator(r);try{env=gen.fromEquirectangular(source);builds++;}finally{gen.dispose();source.dispose();}}
 function apply(){if(disposed)return;const s=v.model.localFeatures.settings;
  if(!s.lighting){if(active)restore();prior.call(v);return;}
  if(!active){snapshot=remember();active=true;}prior.call(v);environment();group.visible=true;if(v.foldLights)v.foldLights.group.visible=false;if(v.cineRig){v.cineRig.group.visible=false;v.cineRig.U.uCShadowEnable.value=0;}for(const o of scene.children)if(o.isLight)o.visible=false;
  const c=v.cineRig?.center||new THREE.Vector3(0,.715,0),a=s.azimuth*Math.PI/180,e=s.elevation*Math.PI/180;
  const visibleHeight=2*v.camera.position.distanceTo(v.orbit.target)*Math.tan(v.camera.fov*Math.PI/360)/v.camera.zoom;
  const wantedSpan=visibleHeight<.50?.24:visibleHeight>.70?1.75:shadowSpan;
  if(wantedSpan!==shadowSpan){shadowSpan=wantedSpan;for(const l of [key,fill,rim]){Object.assign(l.shadow.camera,{left:-shadowSpan,right:shadowSpan,top:shadowSpan,bottom:-shadowSpan});l.shadow.camera.updateProjectionMatrix();}r.shadowMap.needsUpdate=true;}
  
  v.skinDNALights=[key,fill,rim];
  const dirs=[new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)),new THREE.Vector3(-.65,.28,.80).normalize(),new THREE.Vector3(-.28,.22,-1).normalize()];
  for(const[i,l]of [key,fill,rim].entries()){l.target.position.copy(c);l.position.copy(c).addScaledVector(dirs[i],1.4);l.intensity=[s.key,s.fill,s.rim][i];l.shadow.radius=s.shadowFilter;}
  scene.environment=env.texture;scene.environmentIntensity=s.environment;scene.environmentRotation.set(0,100*Math.PI/180,0);r.toneMapping=THREE.NeutralToneMapping;r.toneMappingExposure=s.exposure;r.setClearColor(0x191713);r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFShadowMap;r.shadowMap.autoUpdate=false;v.mesh.castShadow=v.mesh.receiveShadow=true;
  const stamp=[shadowSpan,s.azimuth,s.elevation,...c.toArray(),v.geometry.attributes.position.version,...(v.mesh.morphTargetInfluences||[])].join(',');if(stamp!==last){r.shadowMap.needsUpdate=true;last=stamp;}
 }
 v.setFoldLook=apply;
 return{apply,report(){const lights=[];scene.traverse(o=>{if(o.isLight&&effective(o))lights.push({name:o.name,intensity:o.intensity,colour:o.color?.getHexString(),shadow:o.castShadow});});return{active,lights,environmentBuilds:builds,neutralEnvironment:true,shadowMaps:[2048,1024,1024],shadowSpanMetres:shadowSpan,coveragePolicy:"head-scale / full-body frustum with camera-scale hysteresis",shadowFilterTexels:v.model.localFeatures.settings.shadowFilter,method:'Three r170 native 17-tap PCF, fixed filter radius and head-scale framing; not contact-hardening',transmission:'Retained R06 ear material, without R03 local shader stacking',fullAreaLightIntegration:false,consumerGPUFPSCertified:false};},dispose(){if(disposed)return;restore();disposed=true;v.setFoldLook=prior;scene.remove(group);for(const l of[key,fill,rim])l.shadow.dispose();env?.dispose();}};
}

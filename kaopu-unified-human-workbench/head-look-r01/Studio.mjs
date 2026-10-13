import * as THREE from '../full/source/registration-vendor/three.module.js';
const effective=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
// Authored linear HDR softbox environment. No external HDR/image/mesh is fetched.
export function environmentPixels(w=512,h=256){
 const a=new Float32Array(w*h*4),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
 const box=(lon,lat,cx,cy,sx,sy)=>Math.exp(-((wrap(lon-cx)/sx)**4+((lat-cy)/sy)**4)*2);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const lon=(x+.5)/w*Math.PI*2-Math.PI,lat=Math.PI*.5-(y+.5)/h*Math.PI;
  const key=box(lon,lat,-.7,.55,.47,.48)*4.8,fill=box(lon,lat,.85,.15,.75,.65)*1.4,top=box(lon,lat,2.5,1.0,1.2,.30)*1.5;
  const room=.085+.095*Math.max(Math.sin(lat),0),i=(y*w+x)*4;
  a[i]=room+key+fill*.88+top;a[i+1]=room+key*.99+fill*.96+top;a[i+2]=room+key*.97+fill*1.06+top;a[i+3]=1;
 }return a;
}
export function installStudio(viewer,material){
 const v=viewer,scene=v.scene,renderer=v.renderer,prior=v.setFoldLook.bind(v);
 const before={environment:scene.environment,environmentIntensity:scene.environmentIntensity,rotation:scene.environmentRotation.clone(),tone:renderer.toneMapping,exposure:renderer.toneMappingExposure};
 const group=new THREE.Group();group.name='HEAD-LOOK-R01 authoritative studio';
 const key=new THREE.DirectionalLight(0xffffff,3),rim=new THREE.DirectionalLight(0xfff1df,3.5);key.name='HL reference-direction key';rim.name='HL warm rear rim';group.add(key,key.target,rim,rim.target);scene.add(group);group.visible=false;
 key.castShadow=true;rim.castShadow=false;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-.62,right:.62,top:.70,bottom:-.70,near:.05,far:3.8});key.shadow.bias=-.000012;key.shadow.normalBias=.00012;key.shadow.radius=2;key.shadow.camera.updateProjectionMatrix();
 let pmrem,env,source,active=false,lastShadow='',builds=0;
 function ensureEnvironment(){if(env)return;source=new THREE.DataTexture(environmentPixels(),512,256,THREE.RGBAFormat,THREE.FloatType);source.mapping=THREE.EquirectangularReflectionMapping;source.colorSpace=THREE.LinearSRGBColorSpace;source.minFilter=THREE.LinearFilter;source.magFilter=THREE.LinearFilter;source.needsUpdate=true;pmrem=new THREE.PMREMGenerator(renderer);env=pmrem.fromEquirectangular(source);pmrem.dispose();pmrem=null;source.dispose();source=null;builds++;}
 function restoreEnvironment(){scene.environment=before.environment;scene.environmentIntensity=before.environmentIntensity;scene.environmentRotation.copy(before.rotation);renderer.toneMapping=before.tone;renderer.toneMappingExposure=before.exposure;}
 function apply(){
  const s=v.model.headLook.settings;material.update(s);
  if(!s.lighting){group.visible=false;if(active){restoreEnvironment();v.foldLightKey='';prior();active=false;}return;}
  ensureEnvironment();active=true;group.visible=true;
  if(v.foldLights)v.foldLights.group.visible=false;if(v.cineRig){v.cineRig.group.visible=false;v.cineRig.U.uCShadowEnable.value=0;}
  for(const o of scene.children)if(o.isLight)o.visible=false;
  const center=v.cineRig?.center||new THREE.Vector3(0,.715,0),a=s.azimuth*Math.PI/180,e=s.elevation*Math.PI/180;
  key.target.position.copy(center);key.position.copy(center).add(new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).multiplyScalar(1.4));
  rim.target.position.copy(center);rim.position.copy(center).add(new THREE.Vector3(0,.2,-1).normalize().multiplyScalar(1.4));key.intensity=s.key;rim.intensity=s.rim;
  scene.environment=env.texture;scene.environmentIntensity=s.environment;scene.environmentRotation.set(0,100*Math.PI/180,0);
  renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=s.exposure;renderer.setClearColor(0x171b20);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;v.mesh.castShadow=true;v.mesh.receiveShadow=true;
  const stamp=[s.azimuth,s.elevation,...center.toArray(),v.geometry.attributes.position.version,...(v.mesh.morphTargetInfluences||[])].join(',');
  if(stamp!==lastShadow){renderer.shadowMap.needsUpdate=true;lastShadow=stamp;}
 }
 v.setFoldLook=function(){prior();apply();};
 const api={apply,report(){const lights=[];scene.traverse(o=>{if(o.isLight&&effective(o))lights.push({name:o.name,type:o.type,intensity:o.intensity,colour:o.color?.getHexString(),position:o.position.toArray(),target:o.target?.position.toArray(),castsShadow:o.castShadow});});return {version:'HEAD-LOOK-STUDIO-R01',active,threeRevision:THREE.REVISION,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,environment:!!scene.environment,environmentIntensity:scene.environmentIntensity,environmentBuilds:builds,generatedEnvironment:true,externalEnvironmentRequests:0,environmentSourceBytes:512*256*4*4,shadowSize:key.shadow.mapSize.toArray(),lights,limitations:'Authored softbox HDR, not the reference photo.hdr. One key shadow, not two; no focus blur. Device pixel ratio is retained, not forced to at least 2.'};},dispose(){group.visible=false;restoreEnvironment();v.setFoldLook=prior;key.shadow.dispose();scene.remove(group);env?.dispose();source?.dispose();pmrem?.dispose();}};
 return api;
}

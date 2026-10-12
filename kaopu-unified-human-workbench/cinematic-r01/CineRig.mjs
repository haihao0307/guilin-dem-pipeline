import * as THREE from '../vendor/three.module.js';
import {RectAreaLightUniformsLib} from './vendor/RectAreaLightUniformsLib.js';
import {kelvinRGB} from './CineState.mjs';
let ltcReady=false;
/** Named rectangular fixtures, power-normalized sizes; one bounded key shadow projection.
 * RectAreaLight itself has no shadows: the explicit depth projection below is an
 * original real-time approximation, not Karma's path-traced area-light visibility.
 */
export class CineRig{
 constructor(viewer){
  this.v=viewer;this.profile=viewer.model.cineProfile;this.solo='all';this.comparing=false;this.frames=0;this.shadowFrames=0;this.dirty=true;
  if(!ltcReady){RectAreaLightUniformsLib.init();ltcReady=true;}
  const r=viewer.renderer;this.original={lights:viewer.scene.children.filter(x=>x.isLight).map(l=>({l,visible:l.visible})),clear:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),tone:r.toneMapping,exposure:r.toneMappingExposure,color:r.outputColorSpace,environment:viewer.scene.environment};
  this.group=new THREE.Group();this.group.name='ET20 cinematic lighting';viewer.scene.add(this.group);
  this.lights={};for(const name of ['key','fill','rim']){const l=new THREE.RectAreaLight(0xffffff,1,1,1);l.name='ET20 '+name;this.lights[name]=l;this.group.add(l);}
  this.ambient=new THREE.HemisphereLight(0xe1ebf5,0x504237,0);this.group.add(this.ambient);
  this.shadowTarget=new THREE.WebGLRenderTarget(1024,1024,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});this.shadowTarget.depthTexture=new THREE.DepthTexture(1024,1024,THREE.UnsignedIntType);this.shadowTarget.depthTexture.minFilter=this.shadowTarget.depthTexture.magFilter=THREE.NearestFilter;
  this.shadowCamera=new THREE.PerspectiveCamera(45,1,.1,5);this.shadowCamera.layers.set(30);viewer.mesh.layers.enable(30);
  this.depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.BasicDepthPacking,side:THREE.DoubleSide});
  this.U={uCShadowMap:{value:this.shadowTarget.depthTexture},uCShadowMatrix:{value:new THREE.Matrix4()},uCShadowEnable:{value:0},uCShadowSoftness:{value:2.5},uCKeyView:{value:new THREE.Vector3()},uCKeyPosition:{value:new THREE.Vector3()}};
  this.center=new THREE.Vector3();this.reframe();this.apply();
 }
 get settings(){return this.profile.settings;}
 reframe(){const v=this.v,box=new THREE.Box3(),p=v.displayPositions;if(!p)return;for(let i=v.model.bodyCount;i<v.model.vertexCount;i++)box.expandByPoint(new THREE.Vector3(p[i*3],p[i*3+1],p[i*3+2]));box.getCenter(this.center);this.headSize=box.getSize(new THREE.Vector3());this.apply();}
 apply(){if(!this.center)return;const s=this.settings,v=this.v,r=v.renderer,on=s.lighting&&!this.comparing&&(!window.fullCommonWorkbench?.motion()?.mode||window.fullCommonWorkbench.motion().mode==='shape');for(const e of this.original.lights)e.l.visible=on?false:e.visible;this.group.visible=on;
  r.toneMapping=this.original.tone;r.outputColorSpace=this.original.color;r.toneMappingExposure=on?this.original.exposure*2**s.exposureEV:this.original.exposure;r.setClearColor(on?0x151d23:this.original.clear,this.original.alpha);
  const az=s.keyAzimuth*Math.PI/180,el=s.keyElevation*Math.PI/180,place=(l,a,e,d)=>{l.position.copy(this.center).add(new THREE.Vector3(Math.sin(a)*Math.cos(e)*d,Math.sin(e)*d,Math.cos(a)*Math.cos(e)*d));l.lookAt(this.center);};
  const{key,fill,rim}=this.lights;key.width=s.width;key.height=s.height;place(key,az,el,s.distance);key.intensity=6*2**s.keyEV/(s.width*s.height);key.color.setRGB(...kelvinRGB(s.keyK),THREE.LinearSRGBColorSpace);
  fill.width=1.25;fill.height=1.4;place(fill,-Math.sign(az||-1)*.55,.12,1.35);fill.intensity=6*2**(s.keyEV-s.fillStops)/(fill.width*fill.height);fill.color.setRGB(...kelvinRGB(s.fillK),THREE.LinearSRGBColorSpace);
  rim.width=.35;rim.height=1.1;place(rim,-Math.sign(az||-1)*2.32,.30,1.10);rim.intensity=6*2**(s.keyEV-s.rimStops)/(rim.width*rim.height);rim.color.setRGB(...kelvinRGB(s.rimK),THREE.LinearSRGBColorSpace);
  // Zero intensities preserve shader program identity while using the light mixer.
  for(const[name,l]of Object.entries(this.lights))if(this.solo!=='all'&&this.solo!==name)l.intensity=0;
  this.ambient.intensity=this.solo==='all'?s.ambient:0;
  this.shadowCamera.position.copy(key.position);this.shadowCamera.lookAt(this.center);const d=key.position.distanceTo(this.center);this.shadowCamera.near=Math.max(.05,d-.60);this.shadowCamera.far=d+.75;this.shadowCamera.fov=2*Math.atan(.48/d)*180/Math.PI;this.shadowCamera.updateProjectionMatrix();this.shadowCamera.updateMatrixWorld(true);
  const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);this.U.uCShadowMatrix.value.copy(bias).multiply(this.shadowCamera.projectionMatrix).multiply(this.shadowCamera.matrixWorldInverse);this.U.uCShadowSoftness.value=s.shadowSoftness;this.U.uCKeyPosition.value.copy(key.position);this.U.uCShadowEnable.value=on&&s.shadow?1:0;this.dirty=true;
 }
 beforeRender(){const v=this.v,r=v.renderer,s=this.settings;if(!v.active||v.lost)return;this.frames++;const mode=window.fullCommonWorkbench?.motion()?.mode;if(mode!==this.lastMode){this.lastMode=mode;this.apply();}if(mode&&mode!=='shape')return;
  v.camera.updateMatrixWorld();this.U.uCKeyView.value.copy(this.lights.key.position).applyMatrix4(v.camera.matrixWorldInverse);
  if(!s.lighting||this.comparing||!s.shadow||this.solo!=='all'&&this.solo!=='key')return;
  const morph=v.mesh.morphTargetInfluences||[],fingerprint=morph.map(x=>x.toFixed(6)).join(',');if(!this.dirty&&fingerprint===this.morphFingerprint)return;this.morphFingerprint=fingerprint;
  const saved={target:r.getRenderTarget(),material:v.scene.overrideMaterial,clear:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),tone:r.toneMapping,color:r.outputColorSpace};
  try{v.scene.overrideMaterial=this.depthMaterial;r.toneMapping=THREE.NoToneMapping;r.outputColorSpace=THREE.LinearSRGBColorSpace;r.setClearColor(0xffffff,1);r.setRenderTarget(this.shadowTarget);r.clear();r.render(v.scene,this.shadowCamera);this.shadowFrames++;this.dirty=false;}finally{v.scene.overrideMaterial=saved.material;r.setRenderTarget(saved.target);r.setClearColor(saved.clear,saved.alpha);r.toneMapping=saved.tone;r.outputColorSpace=saved.color;}
 }
 report(){const s=this.settings;return{version:'ET20-CINE-R01.1',enabled:s.lighting&&!this.comparing,fixtureType:'RectAreaLight / Three r170 LTC',center:this.center.toArray(),lights:Object.fromEntries(Object.entries(this.lights).map(([k,l])=>[k,{position:l.position.toArray(),width:l.width,height:l.height,luminance:l.intensity,normalizedPower:l.intensity*l.width*l.height,colorLinear:l.color.toArray()}])),solo:this.solo,shadow:{method:'single center depth projection + receiver-plane bilinear tent PCF (36 reads); 0.6mm light-direction tolerance plus <= 1.5mm grazing normal offset; not area-light ray tracing',size:1024,normalLookupOffsetMaxMM:1.5,frames:this.shadowFrames,bodyOutsideProjectionUnshadowed:true},toneMapping:'existing Three ACESFilmic approximation, NOT full ACES/OCIO',renderWorkingSpace:'Linear-sRGB',output:'sRGB',exposureMultiplier:this.v.renderer.toneMappingExposure,frames:this.frames};}
 dispose(){const v=this.v;for(const e of this.original.lights)e.l.visible=e.visible;v.renderer.setClearColor(this.original.clear,this.original.alpha);v.renderer.toneMapping=this.original.tone;v.renderer.toneMappingExposure=this.original.exposure;v.scene.remove(this.group);v.mesh?.layers.disable(30);this.shadowTarget.dispose();this.depthMaterial.dispose();}
}

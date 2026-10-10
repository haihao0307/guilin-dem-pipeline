import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {createHairOpacityShadows} from './HairOpacityShadows.js';
export function attachLongHairOptics(a,hair){
 const v=a.motion().viewer,lights=[];v.scene.traverse(o=>{if(o.isDirectionalLight)lights.push(o);});if(lights.length!==2)throw Error('Long-hair optical study requires the verified two lights');
 const f=hair.report().headFrame,center=new THREE.Vector3(...f.currentOrigin).addScaledVector(new THREE.Vector3(...f.currentAxes[1]),-.12*f.scale);
 // Translate each existing light and target together along its original
 // direction. This preserves illumination direction, colour and intensity.
 for(const light of lights){const direction=light.position.clone().sub(light.target.position).normalize();light.target.position.copy(center);light.position.copy(center).addScaledVector(direction,2);v.scene.add(light.target);light.castShadow=true;light.shadow.mapSize.set(1536,1536);Object.assign(light.shadow.camera,{left:-.65,right:.65,top:.65,bottom:-.65,near:.05,far:4.5});light.shadow.camera.updateProjectionMatrix();light.shadow.bias=-.00008;light.shadow.normalBias=.00012;light.shadow.radius=8;}
 v.renderer.shadowMap.enabled=true;v.renderer.shadowMap.type=THREE.PCFShadowMap;v.renderer.shadowMap.autoUpdate=false;v.mesh.castShadow=v.mesh.receiveShadow=true;
 const opacity=createHairOpacityShadows({renderer:v.renderer,scene:v.scene,lights}),capability=opacity.init();if(!capability.supported)throw Error('Optical depth unsupported: '+JSON.stringify(capability));v.scene.traverse(o=>{if(o.isMesh&&o.geometry?.getAttribute('strandRadius'))opacity.attachFiber(o);});opacity.attachHead(v.mesh);opacity.setEnabled(true);v.renderer.shadowMap.needsUpdate=true;
 let builtRevision=-1;const oldRender=v.render;v.render=function(...args){hair.update();const revision=a.motion().controller.model.revision;if(revision!==builtRevision){opacity.update({force:true});builtRevision=revision;}return oldRender.apply(this,args);};v.render();
 return{report:()=>({capability,diagnostics:opacity.diagnostics(),lightDirections:lights.map(l=>l.position.clone().sub(l.target.position).normalize().toArray()),lightIntensities:lights.map(l=>l.intensity)}),setEnabled(value){opacity.setEnabled(value);v.renderer.shadowMap.needsUpdate=true;v.render();},dispose(){v.render=oldRender;opacity.dispose();}};
}

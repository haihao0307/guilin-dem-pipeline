import * as THREE from '../vendor/three.module.js';
import {makeSmokeTexture} from './smoke-texture.mjs';
import {createSteamDynamics} from './steam-dynamics.mjs';
import {SMOKE_COUNT,smokeFrameState,smokeParticle,classicSmokeParticle} from './smoke-profile.mjs';
const COUNT=SMOKE_COUNT,UPPER=new THREE.Color(0x8f9eab),WHITE=new THREE.Color(0xffffff);
const VERTEX=[
'attribute vec3 particleCenter;',
'attribute vec2 particleScale;',
'attribute float particleAngle;',
'attribute float particleOpacity;',
'attribute vec3 particleColor;',
'attribute float particleUpper;',
'varying vec2 vUv;',
'varying float vOpacity;',
'varying vec3 vColor;',
'varying float vUpper;',
'void main(){',
'vUv=uv;vOpacity=particleOpacity;vColor=particleColor;vUpper=particleUpper;',
'vec2 p=position.xy*particleScale;',
'float c=cos(particleAngle),s=sin(particleAngle);',
'vec2 rotated=vec2(c*p.x-s*p.y,s*p.x+c*p.y);',
'vec4 mv=modelViewMatrix*vec4(particleCenter,1.0);',
'mv.xy+=rotated;gl_Position=projectionMatrix*mv;}'
].join('\n');
const FRAGMENT=[
'uniform sampler2D smokeMap;',
'varying vec2 vUv;',
'varying float vOpacity;',
'varying vec3 vColor;',
'varying float vUpper;',
'void main(){',
'vec4 texel=texture2D(smokeMap,vUv);',
'gl_FragColor=vec4(texel.rgb*vColor,texel.a*vOpacity);',
'if(gl_FragColor.a<0.0005)discard;',
'if(vUpper>0.5){',
'#include <tonemapping_fragment>',
'}',
'#include <colorspace_fragment>',
'}'
].join('\n');
export function createGameSmoke({legacy=false,tallExhaust=false,referenceDynamics=false}={}){
  const root=new THREE.Group(),texture=makeSmokeTexture(),dynamics=referenceDynamics?createSteamDynamics({wheelRadius:.61,maxParticles:COUNT}):null;root.name=referenceDynamics?'R13 stateful chimney exhaust and independent cylinder/deck steam':'Classic layered smoke and steam rolling onto the platform, '+(legacy?'sprite reference':'batched billboards');
  let smoke,attributes,sprites;
  if(legacy){sprites=[];for(let i=0;i<COUNT;i++){const material=new THREE.SpriteMaterial({map:texture,color:i<84?WHITE:UPPER,transparent:true,depthWrite:false,opacity:.3});material.toneMapped=i>=84;const sprite=new THREE.Sprite(material);root.add(sprite);sprites.push(sprite);}}
  else{const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=quad.index;geometry.setAttribute('position',quad.attributes.position);geometry.setAttribute('uv',quad.attributes.uv);geometry.instanceCount=COUNT;attributes={particleCenter:3,particleScale:2,particleAngle:1,particleOpacity:1,particleColor:3,particleUpper:1};for(const[name,size]of Object.entries(attributes))geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(COUNT*size),size).setUsage(THREE.DynamicDrawUsage));attributes=geometry.attributes;smoke=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{smokeMap:{value:texture}},vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:true}));smoke.frustumCulled=false;root.add(smoke);}
  const sparkPositions=new Float32Array(90*3),sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));const sparkMaterial=new THREE.PointsMaterial({color:0xffd475,size:.033,transparent:true,opacity:.6,depthWrite:false}),sparks=new THREE.Points(sparkGeometry,sparkMaterial);root.add(sparks);const temp=new THREE.Vector3(),colorTemp=new THREE.Color();
  return{root,mode:referenceDynamics?'stateful-reference-steam-r13':legacy?'legacy-sprites':'batched-classic-layered-platform',particles:COUNT,reset(){dynamics?.reset();},update(t,camera,{speed=7,braking=false,comparison=false,view=null,emitters=null}={}){
    const dynamicFrame=dynamics&&!comparison&&view?dynamics.update(view,{emitters}):null;
    const state=dynamicFrame?.state||(comparison?{}:smokeFrameState(view,{tallExhaust})),particles=dynamicFrame?dynamicFrame.particles.map(p=>({...p})):Array.from({length:COUNT},(_,i)=>{const p=comparison?classicSmokeParticle(i,t):smokeParticle(i,t,state);p.color=p.upper?UPPER:WHITE;return p;}),intensity=1;root.userData.effects={...state,burstParticles:dynamicFrame?.proof.lowerCapacity??84,...(dynamicFrame?{dynamics:dynamicFrame.proof}:{} )};
    const colorFor=p=>Array.isArray(p.color)?colorTemp.setRGB(...p.color).convertSRGBToLinear():p.color;
    if(legacy){for(const p of particles){const sprite=sprites[p.index];sprite.position.set(...p.position);sprite.scale.set(p.size,p.size,1);sprite.material.opacity=p.opacity*intensity;sprite.material.rotation=p.rotation;sprite.material.color.copy(colorFor(p));}}
    else{camera.updateMatrixWorld();for(const p of particles)p.depth=temp.set(...p.position).applyMatrix4(camera.matrixWorldInverse).z;particles.sort((a,b)=>a.depth-b.depth||a.index-b.index);for(let i=0;i<particles.length;i++){const p=particles[i];attributes.particleCenter.setXYZ(i,...p.position);attributes.particleScale.setXY(i,p.size,p.size);attributes.particleAngle.setX(i,p.rotation);attributes.particleOpacity.setX(i,p.opacity*intensity);const color=colorFor(p);attributes.particleColor.setXYZ(i,color.r,color.g,color.b);attributes.particleUpper.setX(i,p.upper?1:0);}for(const a of Object.values(attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;}
    for(let i=0;i<90;i++){const f=(t*2+i*.381966)%1,j=i*3;sparkPositions[j]=3.6-(i%4)*2.9-f*.6;sparkPositions[j+1]=.58+Math.sin(f*Math.PI)*.55;sparkPositions[j+2]=(i%2?1:-1)*(.81+f*.46);}sparkGeometry.attributes.position.needsUpdate=true;sparkMaterial.opacity=0;
  }};
}


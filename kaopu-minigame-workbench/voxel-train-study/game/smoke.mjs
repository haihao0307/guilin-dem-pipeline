import * as THREE from '../vendor/three.module.js';
import {makeSmokeTexture} from './smoke-texture.mjs';
const COUNT=160,UPPER=new THREE.Color(0x8f9eab),WHITE=new THREE.Color(0xffffff);
function particle(index,t,{speed=0,draining=false,working=false}={}){
  const lower=index<84,fog=index>=144,lifetime=fog?22:lower?2.7:4.1,f=((t/lifetime+index*.618033989)%1+1)%1,side=index%2?1:-1;
  let position,size,opacity,color,upper=!lower;
  if(fog){position=[-36+((index*7.73+t*.25)%59),.32+(index%3)*.16,side*(3.3+(index%4)*.5)];size=5.5+(index%4);opacity=.075*Math.sin(Math.PI*f);color=WHITE;}
  else if(lower){position=[2.9-f*(6.4+Math.abs(speed)*.14)+Math.sin(index)*.3,.28+.10*Math.sin(Math.PI*f),side*(1.06+f*6.2)+.12*Math.sin(index*3+t)];size=.72+f*3.0;opacity=Math.sin(Math.PI*f)*(draining?.78:.015);color=WHITE;}
  else{position=[3.03-f*(working?7.4:3.5),3.72+f*3.8+.2*Math.sin(index*3+t),.16*Math.sin(index+t)+f*.3];size=.65+f*(working?3.1:2.3);opacity=Math.sin(Math.PI*f)*(working?.68:.22);color=working?new THREE.Color(0x55544e):UPPER;}
  return{index,position,size,opacity,rotation:lower?.035*Math.sin(index):index+f*.8,upper,color};
}
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
export function createGameSmoke({legacy=false}={}){
  const root=new THREE.Group(),texture=makeSmokeTexture();root.name='Steam exhaust, low cylinder drains and morning mist, '+(legacy?'sprite reference':'batched billboards');
  let smoke,attributes,sprites;
  if(legacy){sprites=[];for(let i=0;i<COUNT;i++){const material=new THREE.SpriteMaterial({map:texture,color:i<84?WHITE:UPPER,transparent:true,depthWrite:false,opacity:.3});material.toneMapped=i>=84;const sprite=new THREE.Sprite(material);root.add(sprite);sprites.push(sprite);}}
  else{const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=quad.index;geometry.setAttribute('position',quad.attributes.position);geometry.setAttribute('uv',quad.attributes.uv);geometry.instanceCount=COUNT;attributes={particleCenter:3,particleScale:2,particleAngle:1,particleOpacity:1,particleColor:3,particleUpper:1};for(const[name,size]of Object.entries(attributes))geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(COUNT*size),size).setUsage(THREE.DynamicDrawUsage));attributes=geometry.attributes;smoke=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{smokeMap:{value:texture}},vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:true}));smoke.frustumCulled=false;root.add(smoke);}
  const sparkPositions=new Float32Array(90*3),sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));const sparkMaterial=new THREE.PointsMaterial({color:0xffd475,size:.033,transparent:true,opacity:.6,depthWrite:false}),sparks=new THREE.Points(sparkGeometry,sparkMaterial);root.add(sparks);const temp=new THREE.Vector3();
  return{root,mode:legacy?'legacy-sprites':'batched-steam-drains-mist',particles:COUNT,update(t,camera,{speed=7,braking=false,comparison=false,view=null}={}){
    const draining=!!view&&(view.station.remaining<65&&view.station.remaining>-8&&(Math.abs(speed)<9||braking)||view.door>0),working=!!view&&view.throttle>0&&Math.abs(speed)>.3;const intensity=1,particles=Array.from({length:COUNT},(_,i)=>particle(i,t,{speed,draining,working}));root.userData.effects={draining,working,mist:true};
    if(legacy){for(const p of particles){const sprite=sprites[p.index];sprite.position.set(...p.position);sprite.scale.set(p.size,p.upper?p.size:p.size*.45,1);sprite.material.opacity=p.opacity*intensity;sprite.material.rotation=p.rotation;}}
    else{camera.updateMatrixWorld();for(const p of particles)p.depth=temp.set(...p.position).applyMatrix4(camera.matrixWorldInverse).z;particles.sort((a,b)=>a.depth-b.depth||a.index-b.index);for(let i=0;i<particles.length;i++){const p=particles[i];attributes.particleCenter.setXYZ(i,...p.position);attributes.particleScale.setXY(i,p.size,p.upper?p.size:p.size*.45);attributes.particleAngle.setX(i,p.rotation);attributes.particleOpacity.setX(i,p.opacity*intensity);attributes.particleColor.setXYZ(i,p.color.r,p.color.g,p.color.b);attributes.particleUpper.setX(i,p.upper?1:0);}for(const a of Object.values(attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;}
    for(let i=0;i<90;i++){const f=(t*2+i*.381966)%1,j=i*3;sparkPositions[j]=3.6-(i%4)*2.9-f*.6;sparkPositions[j+1]=.58+Math.sin(f*Math.PI)*.55;sparkPositions[j+2]=(i%2?1:-1)*(.81+f*.46);}sparkGeometry.attributes.position.needsUpdate=true;sparkMaterial.opacity=0;
  }};
}


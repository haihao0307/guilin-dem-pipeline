import * as THREE from '../vendor/three.module.js';

// Original early-morning lighting. Surface colour stays material-driven: no
// sepia overlay, bloom blur, vignette or screen-space colour filter is used.
export const MORNING_ATMOSPHERE=Object.freeze({
  fogNear:50,fogFar:105,exposure:1.04,
  skyTop:0x647e91,skyHorizon:0x9cafae,fog:0x829a93,
  sun:0xffefd1,skyFill:0xc3dfeb,groundFill:0x526047,
  sunPosition:[-17,19,-9],skyFillPosition:[8,11,16]
});
export function createMorningAtmosphere(scene,renderer){
  const p=MORNING_ATMOSPHERE,root=new THREE.Group();root.name='R10 morning light and clear air';
  scene.background=new THREE.Color(p.skyHorizon);scene.fog=new THREE.Fog(p.fog,p.fogNear,p.fogFar);
  renderer.toneMappingExposure=p.exposure;
  const sky=new THREE.Mesh(new THREE.SphereGeometry(270,32,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new THREE.Color(p.skyTop)},horizon:{value:new THREE.Color(p.skyHorizon)}},
    vertexShader:'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 top; uniform vec3 horizon; varying vec3 vDirection; void main(){float y=normalize(vDirection).y; float t=smoothstep(-.06,.66,y); gl_FragColor=vec4(mix(horizon,top,t),1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }'
  }));sky.name='Original procedural dawn sky';sky.renderOrder=-10;root.add(sky);
  const ambient=new THREE.HemisphereLight(p.skyFill,p.groundFill,1.65);root.add(ambient);
  const sun=new THREE.DirectionalLight(p.sun,2.35);sun.position.fromArray(p.sunPosition);sun.target.position.set(-8,0,0);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-36,right:24,top:25,bottom:-20,near:.5,far:90});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;sun.shadow.radius=3;root.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0xd2e6ee,1.12);fill.position.fromArray(p.skyFillPosition);root.add(fill);
  const rim=new THREE.DirectionalLight(0xffe2b3,.36);rim.position.set(-26,7,-15);root.add(rim);
  scene.add(root);
  return{root,proof:{version:'morning-r10',...p,postFilter:false,shadowMap:2048},dispose(){sky.geometry.dispose();sky.material.dispose();scene.remove(root);}};
}

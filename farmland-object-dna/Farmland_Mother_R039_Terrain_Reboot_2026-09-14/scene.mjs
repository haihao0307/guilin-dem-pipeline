import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const mobile=innerWidth<760;
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){document.getElementById('fail').classList.add('show');throw e;}
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.2:1.55));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#9ec6d7');scene.fog=new THREE.FogExp2('#b4cbd0',.00175);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,900);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=3;controls.maxDistance=390;
scene.add(new THREE.HemisphereLight(0xeaf4ea,0x4a5037,1.45));const sun=new THREE.DirectionalLight(0xffefca,2.7);sun.position.set(-105,155,80);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(sun.shadow.camera,{left:-190,right:190,top:190,bottom:-190,near:1,far:520});sun.shadow.normalBias=.06;scene.add(sun);

const {clamp,mix,sm,hash,noise,ridged,rng,geomDetail,fineDetail,mountains,mountainField,baseNatural,terraceMask,terraceInfoFromNatural,gx,gz,nodes,flatFields,pointInPoly,flatFieldAt,riverZ,sourcePath,mainCanal,branchA,branchB,branchC,plainCanal,dseg,polyProjection,dpoly,terrainNoCuts,channelSpecs,channelSurface,terrainY}=window.W;
const R=rng();
const MAT={terrain:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),soil:new THREE.MeshStandardMaterial({color:'#6d5137',roughness:1}),wet:new THREE.MeshStandardMaterial({color:'#3d3429',roughness:.82}),grass:new THREE.MeshStandardMaterial({color:'#4b7737',roughness:.95}),crop:new THREE.MeshStandardMaterial({color:'#6f9638',roughness:.88,side:THREE.DoubleSide}),water:new THREE.MeshPhysicalMaterial({color:'#659b9d',roughness:.17,transparent:true,opacity:.7,depthWrite:false,clearcoat:.65,clearcoatRoughness:.28}),trunk:new THREE.MeshStandardMaterial({color:'#514632',roughness:1}),leaf:new THREE.MeshStandardMaterial({color:'#285d37',roughness:.93}),skin:new THREE.MeshStandardMaterial({color:'#ad7955',roughness:.86}),cloth:new THREE.MeshStandardMaterial({color:'#55654d',roughness:.96}),dark:new THREE.MeshStandardMaterial({color:'#2d312b',roughness:1}),horn:new THREE.MeshStandardMaterial({color:'#d8ceb5',roughness:.9})};
const mesh=(g,m,parent=scene)=>{const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o};

window.R39S={THREE,OrbitControls,mobile,renderer,scene,camera,controls,sun,R,MAT,mesh};
import('./terrain.mjs');

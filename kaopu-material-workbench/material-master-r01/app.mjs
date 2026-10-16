import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {MOTHER_FIELDS_GLSL} from './mothers/all-fields.mjs';
const state={family:'plaster',pore:.55,damage:.35,wet:0,repair:0,mode:0};
const status=document.querySelector('#status'), errors=[];
window.__materialLab={state,errors,ready:false,frames:0};
try{
const canvas=document.querySelector('#canvas'),host=document.querySelector('#viewport');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xeae8e2,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.debug.onShaderError=(gl,p,vs,fs)=>{const e=gl.getShaderInfoLog(fs);errors.push(e);status.textContent='着色器异常';console.error(e)};
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(32,1,.01,40);camera.position.set(0,1.7,6.6);const controls=new OrbitControls(camera,canvas);controls.target.set(0,.85,0);controls.enableDamping=true;controls.minDistance=1.6;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.54;
scene.add(new THREE.HemisphereLight(0xf8f4e5,0x8c927d,2.2));const sun=new THREE.DirectionalLight(0xfff3dd,3);sun.position.set(-3,5,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.015;scene.add(sun);const fill=new THREE.DirectionalLight(0xd5e4f5,1.1);fill.position.set(4,3,-2);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe5e5da,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.04;scene.add(floor);
const shaders=[];const GLSL=String.raw`
uniform float uPore,uDamage,uWet,uRepair,uMode,uFamily,uVariant;
varying vec3 vLocal; varying vec3 vLocalN;
struct StudySample{KpSurface surface;vec3 masks;};
StudySample labSample(vec3 p,float fp){
 KpSurface base;
 if(uFamily<.5){KpPlasterParams a=KpPlasterParams(vec2(0.),vec2(.55,.75),.025,.002,.0006,.018,.035,.00012,vec3(.32,.30,.255),vec3(.56,.53,.455),.003,.00004,.014);base=kpPlasterOriginalField(p,a,fp).surface;}
 else if(uFamily<1.5){base=kpStoneSurface(p,.12,0.,0.,fp);}
 else{vec2 q=p.xy;float row=floor(q.y/.075);q.x+=mod(row,2.)*.13;vec2 cell=floor(q/vec2(.26,.075));vec2 uv=(fract(q/vec2(.26,.075))-.5)*vec2(.26,.075);float seed=br_h11(dot(cell,vec2(17.3,31.7)))*113.;base=kpBrickOriginalSurface(vec3(uv,.053),seed,0,.65,fp);float edge=min(.13-abs(uv.x),.0375-abs(uv.y));float joint=1.-smoothstep(.003,.006+fp,edge);base=KpSurface(mix(base.height,-.002,joint),mix(base.albedo,vec3(.30,.27,.22),joint),mix(base.roughness,.96,joint));}
 float repair=uRepair*uVariant;
 float pore=smoothstep(.60,.83,br_noise3(p/.006+vec3(17.1,3.2,8.4)))*(1.-smoothstep(.003,.009,fp))*uPore*uVariant*(1.-repair);
 float broad=br_fbm(p/.12+vec3(3.,8.,11.));
 float erosion=smoothstep(.51-.32*uDamage,.61-.32*uDamage,broad)*uDamage*uVariant*(1.-repair);
 float wet=uWet*uVariant;
 base.height-=.0012*pore+.00065*erosion;
 base.height+=.0008*repair;
 base.albedo*= (1.-.20*pore)*(1.-.17*erosion)*(1.-.24*wet);
 base.roughness=mix(clamp(base.roughness+.07*pore+.06*erosion,0.,1.),.22,wet);
 return StudySample(base,vec3(pore,erosion,repair));
}
`;
function material(variant){const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85});m.onBeforeCompile=s=>{for(const [k,v]of Object.entries({Pore:state.pore,Damage:state.damage,Wet:state.wet,Repair:state.repair,Mode:0,Family:0,Variant:variant}))s.uniforms['u'+k]={value:v};s.vertexShader='varying vec3 vLocal;varying vec3 vLocalN;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLocal=position;vLocalN=normal;');s.fragmentShader=MOTHER_FIELDS_GLSL+'\n'+GLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat kpFp=max(length(dFdx(vLocal)),length(dFdy(vLocal)));StudySample sampleLab=labSample(vLocal,kpFp);diffuseColor.rgb=sampleLab.surface.albedo;');s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=sampleLab.surface.roughness;');s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);normal=normalize(abs(det)*normal-sign(det)*(dFdx(sampleLab.surface.height)*r1+dFdy(sampleLab.surface.height)*r2));');s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','if(uMode>.5&&uMode<1.5)outgoingLight=sampleLab.masks;if(uMode>1.5&&uMode<2.5)outgoingLight=vec3(sampleLab.surface.roughness);if(uMode>2.5)outgoingLight=vec3(clamp(.5+sampleLab.surface.height*100.,0.,1.));\n#include <opaque_fragment>');shaders.push(s)};m.customProgramCacheKey=()=>`lab-${variant}`;return m;}
// Chamfered specimen, metre units. Micro-height modifies normals only.
const shape=new THREE.Shape(),w=.55,h=.75,r=.018;shape.moveTo(-w+r,-h);shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(-w+r,h);shape.quadraticCurveTo(-w,h,-w,h-r);shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
const geometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.009,bevelThickness:.009,curveSegments:8});geometry.translate(0,0,-.06);
for(let i=0;i<2;i++){const slab=new THREE.Mesh(geometry,material(i));slab.position.set(i===0?-.7:.7,.83,0);slab.castShadow=true;slab.receiveShadow=true;scene.add(slab);const stand=new THREE.Mesh(new THREE.BoxGeometry(1.23,.07,.37),new THREE.MeshStandardMaterial({color:0xc4cabb,roughness:.85}));stand.position.set(slab.position.x,.005,0);stand.castShadow=true;stand.receiveShadow=true;scene.add(stand)}
function update(){for(const s of shaders){for(const key of ['pore','damage','wet','repair','mode'])s.uniforms['u'+key[0].toUpperCase()+key.slice(1)].value=state[key];s.uniforms.uFamily.value=['plaster','stone','brick'].indexOf(state.family)};window.__materialLab.updates=(window.__materialLab.updates||0)+1;}
for(const key of ['pore','damage','wet','repair'])document.querySelector('#'+key).addEventListener('input',e=>{state[key]=Number(e.target.value);document.querySelector('#'+key+'Out').textContent=state[key].toFixed(2);update()});
const info={plaster:['灰泥 · 因果层研究','相同的孔隙同时改变表面高度、色彩与粗糙度。原灰泥函数保持原样。'],stone:['石材 · 保留母体对照','保留原石材脉络与孔隙函数，独立叠加可关闭的研究层。此母体包含历史研究来源，详见方法说明。'],brick:['砖材 · 保留母体对照','保留原砖材表面，使用米制砖缝拼接。同一研究层与原版在统一光照下比较。']};
for(const b of document.querySelectorAll('[data-family]'))b.onclick=()=>{state.family=b.dataset.family;document.querySelectorAll('[data-family]').forEach(x=>x.classList.toggle('active',x===b));document.querySelector('#familyTitle').textContent=info[state.family][0];document.querySelector('#familyDetail').textContent=info[state.family][1];update()};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{state.mode=+b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));update()};
let activeView='front';
function setView(name){activeView=name;document.querySelector('.compare').style.opacity=name==='close'?'0':'1';const fitZ=Math.max(4.15,5.4/camera.aspect);const map={front:[[0,1.22,fitZ],[0,.84,0]],angle:[[2.7,1.8,5.3],[0,.84,0]],close:[[1.8,1.25,2.6],[.70,.88,0]]};const [p,t]=map[name];camera.position.fromArray(p);controls.target.fromArray(t);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name))}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);document.querySelector('#resetView').onclick=()=>setView('front');document.querySelector('#reset').onclick=()=>{Object.assign(state,{pore:.55,damage:.35,wet:0,repair:0,mode:0});for(const k of ['pore','damage','wet','repair']){document.querySelector('#'+k).value=state[k];document.querySelector('#'+k+'Out').textContent=state[k].toFixed(2)}document.querySelector('[data-mode="0"]').click();update()};
function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();if(activeView==='front')setView('front')}new ResizeObserver(resize).observe(host);resize();setView('front');
Object.assign(window.__materialLab,{renderer,scene,camera,setView,update,shaderCount:()=>shaders.length,rendererInfo:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries})});
function render(){requestAnimationFrame(render);controls.update();renderer.render(scene,camera);window.__materialLab.frames++;if(window.__materialLab.frames===2){update();window.__materialLab.ready=errors.length===0;status.textContent=errors.length?'渲染异常':'实时程序材质';}}
canvas.addEventListener('webglcontextlost',()=>{status.textContent='渲染连接中断';window.__materialLab.ready=false});render();
}catch(e){errors.push(String(e));document.querySelector('#error').hidden=false;document.querySelector('#error').textContent='三维渲染未能启动：'+e.message+'。请使用支持 WebGL 2 的浏览器。';status.textContent='渲染未启动';console.error(e)}

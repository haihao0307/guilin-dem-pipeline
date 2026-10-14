import * as THREE from 'three';
import {makeJacket} from './jacket.mjs';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './eb1-public.js';

// PUBLIC-P01 is a newly authored appearance specimen, not a distribution of
// the private R15/R01.2 engine. It imports no private data, model or texture.
const VERSION='KNIT-PUBLIC-P02';
const $=id=>document.getElementById(id), TAU=Math.PI*2;
const seed=4291, cols=16, rows=20, pitch=.0058, spacing=.00290, radius=.00086;
const settings={fuzz:1,length:.95,detail:1,twist:.55,mottle:.18,pattern:'plain',color:'#d3c4af',shape:'jersey',mode:'fiber'};
const defaults={...settings};
try{const saved=JSON.parse(localStorage.getItem('kaopu:knit:public:p02'));if(saved&&saved.version===VERSION)for(const key of Object.keys(defaults)){if(typeof saved.settings[key]===typeof defaults[key])settings[key]=saved.settings[key];}}catch{}
function hash(n){n=Math.imul(n^seed,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
let dirty=true,ready=false,builds=0,frames=0,building=false,mesh=null,fur=null,buildMs=0,vertices=0,triangles=0,hairCount=0;
let shaders=[],jacket=null;
const stage=$('stage'),scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;stage.appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('status').textContent='显卡上下文丢失；请刷新页面。';ready=false;});
const camera=new THREE.PerspectiveCamera(34,1,.0008,20);camera.position.set(.034,.018,.19);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=.012;controls.maxDistance=.65;controls.target.set(0,0,0);controls.addEventListener('change',()=>dirty=true);
const group=new THREE.Group();scene.add(group);
// Use the exact already-public EB1 core; its profile is never overwritten by
// material presets, specimen rebuilds or camera controls.
const store=KAOPU_EB1.createStore();
const lighting=KAOPU_EB1.attachThree(THREE,{renderer,scene,store,center:[0,0,0],radius:.085,requestRender:()=>{dirty=true},shadows:true,ui:false});
window.__EB1__=lighting;
const uniforms={fuzz:{value:settings.fuzz},len:{value:settings.length},detail:{value:settings.detail},twist:{value:settings.twist},mottle:{value:settings.mottle},pattern:{value:0},dye:{value:new THREE.Color(settings.color)},viewSize:{value:new THREE.Vector2(800,700)}};
function patternAt(c,r){if(settings.pattern==='stripe')return (Math.floor(r/3)%3===0)?.66:1;if(settings.pattern==='diamond')return ((Math.abs((c%8)-3.5)+Math.abs((r%8)-3.5))<2.5)?.60:1;return 1;}
function colorAt(c,r,id){const color=new THREE.Color(settings.color),scale=patternAt(c,r)*(1+settings.mottle*(hash(id*17+3)-.5)*.65);return color.multiplyScalar(scale);}
function point(c,r,t){
 const base=[[-.5,-.39,-.08],[-.36,-.43,.13],[-.14,-.22,.29],[-.29,.20,.06],[-.28,.51,-.13],[0,.63,-.18],[.28,.51,-.13],[.29,.20,.06],[.14,-.22,.29],[.36,-.43,.13],[.5,-.39,-.08]];
 const x=t*(base.length-1),k=Math.min(base.length-2,Math.floor(x)),u=x-k;
 const a=base[Math.max(0,k-1)],b=base[k],d=base[k+1],e=base[Math.min(base.length-1,k+2)];
 const p=[];for(let j=0;j<3;j++)p[j]=.5*((2*b[j])+(-a[j]+d[j])*u+(2*a[j]-5*b[j]+4*d[j]-e[j])*u*u+(-a[j]+3*b[j]-3*d[j]+e[j])*u*u*u);
 const wx=(c-(cols-1)/2+p[0])*pitch,wy=(r-(rows-1)/2)*spacing+p[1]*pitch;
 let wz=p[2]*pitch;
 if(settings.shape==='rib')wz+=(c%4<2?1:-1)*.0009;
 // Specimen bend is a static presentation shape, never labelled cloth physics.
 wz+=.0028*Math.cos(wx*43)+.0014*Math.sin(wy*45+wx*12);
 return new THREE.Vector3(wx,wy,wz);
}
function frame(c,r,t){const p=point(c,r,t),T=point(c,r,Math.min(1,t+.0004)).sub(point(c,r,Math.max(0,t-.0004))).normalize();const B=new THREE.Vector3().crossVectors(T,new THREE.Vector3(0,0,1)).normalize();const N=new THREE.Vector3().crossVectors(B,T).normalize();return {p,T,B,N};}
function build(){
 if(building)return;building=true;const start=performance.now();
 const positions=[],normals=[],uvs=[],colors=[],indices=[];
 const roots=[],dirs=[],bends=[],seeds=[],hcolors=[];
 const steps=64,sides=12;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const id=r*cols+c,col=colorAt(c,r,id),phase=hash(id)*TAU;
  const offset=positions.length/3;
  for(let s=0;s<=steps;s++){
   const t=s/steps,{p,T,B,N}=frame(c,r,t);
   const breathing=1+.038*Math.sin(t*21+phase)+.022*Math.sin(t*49+phase*3);
   for(let j=0;j<=sides;j++){
    const a=j/sides*TAU,tw=a+t*TAU*2.8*settings.twist;
    const irregular=1+.055*Math.cos(3*tw)+.022*Math.sin(5*a+phase+t*11);
    const n=B.clone().multiplyScalar(Math.cos(a)).addScaledVector(N,Math.sin(a));
    const v=p.clone().addScaledVector(n,radius*breathing*irregular);
    positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);uvs.push(t*9+hash(id)*.1,j/sides);colors.push(col.r,col.g,col.b);
    if(s<steps&&j<sides){const a0=offset+s*(sides+1)+j,b0=a0+sides+1;indices.push(a0,b0,a0+1,b0,b0+1,a0+1);}
   }
  }
  // Stable material-root IDs. Each root owns a curved, tapered ribbon.
  // Density control changes optical coverage, not per-frame random identity.
  for(let h=0;h<960;h++){
   const hid=id*997+h,tt=hash(hid*13+4),{p,T,B,N}=frame(c,r,tt),ang=hash(hid*7+1)*TAU;
   const n=B.clone().multiplyScalar(Math.cos(ang)).addScaledVector(N,Math.sin(ang));
   const breathe=1+.038*Math.sin(tt*21+phase)+.022*Math.sin(tt*49+phase*3);
   const twistAngle=ang+tt*TAU*2.8*settings.twist;
   const envelope=1+.055*Math.cos(3*twistAngle)+.022*Math.sin(5*ang+phase+tt*11);
   const root=p.clone().addScaledVector(n,radius*breathe*envelope+.000014);
   const fly=hash(hid*29)> .991;
   const len=(fly?.0014:.00032)+(fly?.0015:.00094)*Math.pow(hash(hid*31),1.45);
   const dir=T.clone().multiplyScalar((hash(hid*41)-.5)*1.35).addScaledVector(n,.30+.50*hash(hid*23)).normalize().multiplyScalar(len);
   const curve=B.clone().multiplyScalar((hash(hid*19)-.5)*len*1.25).addScaledVector(N,(hash(hid*37)-.45)*len*.7);
   roots.push(root.x,root.y,root.z);dirs.push(dir.x,dir.y,dir.z);bends.push(curve.x,curve.y,curve.z);seeds.push(hash(hid*43),fly?1:0);hcolors.push(col.r,col.g,col.b);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
 const material=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.88,metalness:0,sheen:1,sheenColor:new THREE.Color('#eee4d3'),sheenRoughness:.86,side:THREE.DoubleSide});
 shaders=[];
 material.onBeforeCompile=shader=>{
  shader.uniforms.uDetail=uniforms.detail;shader.uniforms.uTwist=uniforms.twist;
  shader.vertexShader='varying vec2 vFiberUV;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvFiberUV=uv;');
  shader.fragmentShader='varying vec2 vFiberUV;uniform float uDetail,uTwist;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float ph=(vFiberUV.y*6.2831853+vFiberUV.x*uTwist*.7);
    float freq=54.;float w=exp(-1.5*pow(fwidth(ph*freq),2.));
    float strands=sin(ph*freq+.7*sin(vFiberUV.x*11.))*w;
    float bundles=sin(ph*13.+.4*sin(vFiberUV.x*4.))*exp(-pow(fwidth(ph*13.),2.));
    vec3 axis=normalize(dFdx(vViewPosition)*dFdy(vFiberUV.x)-dFdy(vViewPosition)*dFdx(vFiberUV.x));
    if(length(axis)>.1)normal=normalize(normal+axis*(.16*strands+.11*bundles)*uDetail);
    roughnessFactor=clamp(roughnessFactor+.035*uDetail,0.,1.);
  `);shaders.push(shader);
 };
 material.customProgramCacheKey=()=>VERSION;
 if(mesh){group.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
 mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 jacket?.dispose();jacket=makeJacket({cols,rows,radius,frame,hash,colorAt,settings,uniforms,store});group.add(jacket.mesh);
 if(fur){group.remove(fur);fur.geometry.dispose();fur.material.dispose();}
 const fg=new THREE.InstancedBufferGeometry(),v=[],ix=[];
 for(let s=0;s<=4;s++){v.push(s/4,-1,0,s/4,1,0);if(s<4){const k=s*2;ix.push(k,k+2,k+1,k+2,k+3,k+1);}}
 fg.setAttribute('position',new THREE.Float32BufferAttribute(v,3));fg.setIndex(ix);
 for(const [name,data,n] of [['root',roots,3],['strand',dirs,3],['curve',bends,3],['identity',seeds,2],['fiberColor',hcolors,3]])fg.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(data),n));
 fg.instanceCount=roots.length/3;hairCount=fg.instanceCount;
 const fmat=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uDensity:uniforms.fuzz,uLength:uniforms.len,uSize:uniforms.viewSize,uKeyDir:{value:new THREE.Vector3()},uRimDir:{value:new THREE.Vector3()},uKey:{value:new THREE.Vector3()},uRim:{value:new THREE.Vector3()},uEnv:{value:.6}},
 vertexShader:`attribute vec3 root,strand,curve,fiberColor;attribute vec2 identity;uniform float uLength,uDensity;uniform vec2 uSize;varying float vEdge,vAlpha;varying vec3 vT,vC;
 void main(){float t=position.x;vec3 p=root+uLength*(strand*t+curve*t*t);vec3 tangent=normalize(strand+2.*curve*t);vec4 mv=modelViewMatrix*vec4(p,1.);vec3 tv=normalize(mat3(modelViewMatrix)*tangent);vec2 across=vec2(-tv.y,tv.x);across/=max(length(across),.00001);vec4 cp=projectionMatrix*mv;
 float actual=projectionMatrix[1][1]*.000035/max(-mv.z,.00001)*uSize.y*.5;float width=max(.7,actual)*(1.-.75*t);cp.xy+=across*position.y*width/uSize*cp.w;gl_Position=cp;
 vAlpha=min(1.,actual/.7)*(1.-t*.35)*smoothstep(identity.x-.12,identity.x+.12,uDensity)*.94;vEdge=position.y;vT=normalize(mat3(modelMatrix)*tangent);vC=fiberColor;}`,
 fragmentShader:`uniform vec3 uKeyDir,uRimDir,uKey,uRim;uniform float uEnv;varying float vEdge,vAlpha;varying vec3 vT,vC;
 void main(){float alpha=vAlpha*(1.-smoothstep(.45,1.,abs(vEdge)));if(alpha<.003)discard;vec3 T=normalize(vT);float a=sqrt(max(0.,1.-pow(dot(T,uKeyDir),2.))),b=sqrt(max(0.,1.-pow(dot(T,uRimDir),2.)));vec3 light=vec3(.30*uEnv)+(uKey*a+uRim*b)/3.14159265;gl_FragColor=vec4(vC*light,alpha);#include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 // GLSL preprocessor directives must begin their own line.
 fmat.fragmentShader=fmat.fragmentShader.replace(';#include',';\n#include');
 fur=new THREE.Mesh(fg,fmat);fur.frustumCulled=false;fur.renderOrder=2;group.add(fur);
 const phot=()=>{const p=KAOPU_EB1.sampleProfile(store.get());fmat.uniforms.uKeyDir.value.fromArray(p.keyDirection);fmat.uniforms.uRimDir.value.fromArray(p.rimDirection);fmat.uniforms.uKey.value.fromArray(p.keyColor);fmat.uniforms.uRim.value.fromArray(p.rimColor);fmat.uniforms.uEnv.value=store.get().environment;};phot();
 if(window.__furUnsub)window.__furUnsub();window.__furUnsub=store.subscribe(phot);
 vertices=positions.length/3;triangles=indices.length/3+hairCount*8;builds++;buildMs=performance.now()-start;building=false;
 renderer.shadowMap.needsUpdate=true;applyMode();dirty=true;
 $('counts').textContent=`${cols*rows} 针目 · 30,720 贴伏长纤维 + ${hairCount.toLocaleString()} 短绒`;
}
function applyMode(){const on=settings.mode==='fiber';uniforms.fuzz.value=on?settings.fuzz:0;uniforms.detail.value=on?settings.detail:0;if(fur)fur.visible=on;if(jacket)jacket.mesh.visible=on;if(mesh){mesh.material.sheen=on?1:0;mesh.material.roughness=on?.88:.50;}dirty=true;}
function set(patch,{save=true}={}){
 if(!patch||typeof patch!=='object')throw new TypeError('参数必须为对象');
 const enums={pattern:['plain','stripe','diamond'],shape:['jersey','rib'],mode:['fiber','carrier']};
 for(const [k,v]of Object.entries(patch)){
  if(!(k in defaults))throw new RangeError('未知参数 '+k);
  if(typeof defaults[k]==='number'&&(!Number.isFinite(v)||v<0||v>1.6))throw new RangeError('参数越界 '+k);
  if(enums[k]&&!enums[k].includes(v))throw new RangeError('无效选项 '+k);
  if(k==='color'&&!/^#[0-9a-f]{6}$/i.test(v))throw new RangeError('颜色格式无效');
 }
 const rebuild=['pattern','shape','color','mottle','twist'].some(k=>k in patch&&patch[k]!==settings[k]);Object.assign(settings,patch);
 uniforms.len.value=settings.length;uniforms.twist.value=settings.twist;applyMode();if(rebuild)build();sync();
 if(save)try{localStorage.setItem('kaopu:knit:public:p02',JSON.stringify({version:VERSION,settings}));}catch{}
 return {...settings};
}
function sync(){for(const el of document.querySelectorAll('[data-param]')){const k=el.dataset.param;el.value=settings[k];const o=document.querySelector(`[data-output="${k}"]`);if(o)o.textContent=Number(settings[k]).toFixed(2);}document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('selected',el.dataset.mode===settings.mode);el.setAttribute('aria-pressed',el.dataset.mode===settings.mode?'true':'false');});$('mode-note').textContent=settings.mode==='fiber'?'贴伏纤维层 + 短绒（P02）':'关闭细节的载纱对照（不是原生 R15）';}
function view(name){const views={whole:[[.027,.012,.19],[0,0,0]],close:[[.005,.004,.058],[0,0,.003]],edge:[[.11,.015,.056],[.012,0,.002]],back:[[.02,.012,-.16],[0,0,0]]};if(!views[name])throw new Error('未知视角');camera.position.fromArray(views[name][0]);controls.target.fromArray(views[name][1]);controls.update();dirty=true;return name;}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();uniforms.viewSize.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());dirty=true;}
new ResizeObserver(resize).observe(stage);
for(const el of document.querySelectorAll('[data-param]')){el.addEventListener(el.type==='range'?'input':'change',()=>set({[el.dataset.param]:el.type==='range'?Number(el.value):el.value}));}
document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>set({mode:el.dataset.mode}));
document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>view(el.dataset.view));
$('reset').onclick=()=>set(defaults);
$('eb1').onclick=()=>{KAOPU_EB1.mountUI(store);$('eb1-panel').open=true;};
$('export').onclick=()=>{const box=$('json');box.hidden=!box.hidden;box.value=JSON.stringify({schema:'kaopu.public-yarn/1',version:VERSION,settings,lighting:store.get(),physics:'not included',provenance:'independent public specimen; not private R15 export'},null,2);};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
window.KnitPublic={version:VERSION,set,view,render(){dirty=true;render()},report:()=>({version:VERSION,ready,settings:{...settings},builds,buildMs,frames,vertices,triangles,hairCount,jacket:jacket?.report(),lighting:lighting.audit(),camera:{position:camera.position.toArray(),target:controls.target.toArray(),distance:camera.position.distanceTo(controls.target)},geometryBytes:mesh?Object.values(mesh.geometry.attributes).reduce((a,x)=>a+x.array.byteLength,mesh.geometry.index.array.byteLength):0,glError:renderer.getContext().getError(),errors:[...errors],privateRuntimeImported:false,nativeR15:false,clothPhysics:false,phoneHardwareTested:false,visualReferenceMatched:false})};
function render(){if(!dirty||document.hidden)return;lighting.ensure();renderer.render(scene,camera);frames++;dirty=false;}
function loop(){requestAnimationFrame(loop);render();}resize();build();sync();controls.update();render();ready=true;$('loading').hidden=true;$('status').textContent='交互已就绪 · 公共独立样片';loop();

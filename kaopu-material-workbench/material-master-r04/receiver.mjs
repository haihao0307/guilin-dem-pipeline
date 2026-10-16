import * as T from '../material-master-r02/vendor/three.module.js';
import {OrbitControls} from '../material-master-r02/vendor/OrbitControls.js';
import {TILE_CASES,buildTileCase} from './ceramic.mjs';
const initialCase=new URLSearchParams(location.search).get('case'),finish=TILE_CASES[initialCase]?initialCase:'glazed';
const state={finish,width:TILE_CASES[finish].width,height:TILE_CASES[finish].height,joint:TILE_CASES[finish].joint,wear:.52,stain:.52,wetness:0,mode:0},errors=[],groups=[],shaders=[];
const lab=window.__tileLab={ready:false,state,errors,groups,shaders,frames:0,revision:'r04-ceramic-research-1'};
const $=id=>document.getElementById(id);
window.addEventListener('error',e=>{errors.push(e.message);lab.ready=false;});
try{
 const host=$('viewport'),canvas=$('canvas'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0xeae8e2,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.debug.onShaderError=(gl,p,vs,fs)=>{const error=[gl.getProgramInfoLog(p),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].filter(Boolean).join('\n');errors.push(error);lab.ready=false;$('status').textContent='着色异常';console.error(error);};
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.02,60),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.54;
 scene.add(new T.HemisphereLight(0xfff5e3,0x7c856d,.95));
 const key=new T.DirectionalLight(0xfff1da,2.35);key.position.set(-3.5,6.5,5.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-6,right:6,top:5,bottom:-4,near:.1,far:22});key.shadow.normalBias=.002;key.shadow.bias=-.0002;scene.add(key);
 const fill=new T.DirectionalLight(0xddefff,.8);fill.position.set(5,4,-3);scene.add(fill);
 const env=new T.Scene();env.background=new T.Color(0xb7c0b7);
 for(const[pos,size,intensity]of [[[-3,3,3],[.12,5,3],4],[[3,3.5,2],[.12,3,1.2],2],[[0,6,0],[7,.12,5],2.5]]){const light=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial({color:new T.Color(1,1,.98).multiplyScalar(intensity)}));light.position.fromArray(pos);env.add(light);}
 const pmrem=new T.PMREMGenerator(renderer),envTarget=pmrem.fromScene(env,.03);scene.environment=envTarget.texture;scene.environmentIntensity=.72;pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 const ground=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({color:0x52604b,opacity:.17}));ground.rotation.x=-Math.PI/2;ground.position.y=-.006;ground.receiveShadow=true;scene.add(ground);
 let view='front',separation=1.48,pendingBuild=0;
 function build(){lab.ready=false;for(const g of groups){scene.remove(g);g.userData.dispose();}groups.length=0;shaders.length=0;
  for(let i=0;i<2;i++){const group=buildTileCase(T,{...state,variant:i,wear:i?state.wear:0,stain:i?state.stain:0,wetness:i?state.wetness:0,shaders});groups.push(group);}
  const width=new T.Box3().setFromObject(groups[0]).getSize(new T.Vector3()).x;separation=width*.5+.22;groups.forEach((g,i)=>{g.position.x=(i?1:-1)*separation;scene.add(g);});
  lab.receivers=groups.map(g=>g.userData.receiver);lab.rebuilds=(lab.rebuilds||0)+1;lab.lastBuildFrame=lab.frames;
  $('dimensions').textContent=`${Math.round(state.width*1000)} × ${Math.round(state.height*1000)} mm · 缝 ${(state.joint*1000).toFixed(1)} mm`;
  $('status').textContent='构建中';setView(view);
 }
 function update(){groups[1]?.userData.update(state);groups[0]?.userData.update({mode:state.mode});lab.updates=(lab.updates||0)+1;}
 function setView(value){view=value;lab.view=value;const narrow=host.clientWidth<550,h=groups[1]?.userData.receiver.wallHeight||1.5;
  const p=value==='close'?[separation+.12,h*.57,.57]:value==='joint'?[separation+.08,h*.53,.30]:value==='angle'?[3.5,2.7,4.7]:[.30,1.90,narrow?7.8:5.6];
  const target=value==='close'?[separation+.05,h*.52,0]:value==='joint'?[separation+.02,h*.50,0]:[0,h*.48,-.06];
  camera.position.fromArray(p);controls.target.fromArray(target);controls.update();document.querySelector('.compare').hidden=['close','joint'].includes(value);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===value));
 }
 function syncUI(){for(const k of ['width','height','joint']){$(k).value=state[k]*1000;$(k+'Out').textContent=(state[k]*1000).toFixed(k==='joint'?1:0);}for(const k of ['wear','stain','wetness']){$(k).value=state[k];$(k+'Out').textContent=state[k].toFixed(2);}document.querySelectorAll('[data-case]').forEach(b=>{const active=b.dataset.case===state.finish;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});document.querySelectorAll('[data-mode]').forEach(b=>{const active=+b.dataset.mode===state.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});$('familyTitle').textContent=TILE_CASES[state.finish].name;$('familyDetail').textContent=TILE_CASES[state.finish].description;}
 function setCase(id){if(!TILE_CASES[id])throw Error('Unknown case');state.finish=id;reset();}
 function reset(){Object.assign(state,{width:TILE_CASES[state.finish].width,height:TILE_CASES[state.finish].height,joint:TILE_CASES[state.finish].joint,wear:.52,stain:.52,wetness:0,mode:0});syncUI();build();}
 for(const k of ['wear','stain','wetness'])$(k).oninput=e=>{state[k]=+e.target.value;$(k+'Out').textContent=state[k].toFixed(2);update();};
 for(const k of ['width','height','joint'])$(k).oninput=e=>{state[k]=+e.target.value*.001;$(k+'Out').textContent=(state[k]*1000).toFixed(k==='joint'?1:0);cancelAnimationFrame(pendingBuild);pendingBuild=requestAnimationFrame(build);};
 document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>setCase(b.dataset.case));document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=+b.dataset.mode;syncUI();update();});$('reset').onclick=reset;$('resetView').onclick=()=>setView('front');
 let lastNarrow=host.clientWidth<550;function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const narrow=w<550;if(lastNarrow!==narrow){lastNarrow=narrow;setView(view);}}
 new ResizeObserver(resize).observe(host);Object.assign(lab,{renderer,scene,camera,controls,build,update,setView,setCase,reset});syncUI();build();resize();
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lab.ready=false;errors.push('WebGL context lost');$('status').textContent='图形上下文中断';$('error').hidden=false;$('error').textContent='图形上下文中断，请重新加载页面。';});
 function render(){requestAnimationFrame(render);controls.update();renderer.render(scene,camera);lab.frames++;if(lab.frames-lab.lastBuildFrame>=3&&!errors.length){lab.ready=true;$('status').textContent='实时材质';$('loading').hidden=true;}}render();
}catch(error){errors.push(String(error));lab.ready=false;$('error').hidden=false;$('error').textContent='无法启动材质预览：'+error.message;$('loading').hidden=true;$('status').textContent='启动失败';console.error(error);}

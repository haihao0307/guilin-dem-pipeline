(function(){
'use strict';
const A=globalThis.KAOPUAnimal,T=A.THREE,$=s=>document.querySelector(s),data=globalThis.KAOPU_EXAMPLES||{},portable=Object.keys(data).length===0;
const viewport=$('#viewport'),input=$('#score'),status=$('#status'),canvas=document.createElement('canvas');
const scene=new T.Scene();scene.background=new T.Color('#e9edef');
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){status.textContent='当前浏览器不能建立 WebGL2 渲染器。';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(600,600);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;viewport.append(canvas);
const camera=new T.PerspectiveCamera(34,1,.01,100),target=new T.Vector3(0,.7,0);let radius=5,azimuth=.38,elevation=.18,frames=0,current=null,key='B',busy=false;
scene.add(new T.HemisphereLight('#ebf3ff','#a8a18e',2.05));
const keyLight=new T.DirectionalLight('#fff4df',3.8);keyLight.position.set(-3,5,4);keyLight.castShadow=true;keyLight.shadow.mapSize.set(2048,2048);keyLight.shadow.bias=-.00012;keyLight.shadow.normalBias=.016;keyLight.shadow.camera.left=-3.5;keyLight.shadow.camera.right=3.5;keyLight.shadow.camera.top=3.5;keyLight.shadow.camera.bottom=-3.5;scene.add(keyLight);
const fill=new T.DirectionalLight('#d6e6ff',.9);fill.position.set(3,2,-4);scene.add(fill);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#e2e6e6',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
const ruler=new T.GridHelper(20,40,'#b9c6ca','#d3dce0');ruler.position.y=-.02;ruler.material.transparent=true;ruler.material.opacity=.45;scene.add(ruler);
function updateCam(){camera.position.set(target.x+radius*Math.sin(azimuth)*Math.cos(elevation),target.y+radius*Math.sin(elevation),target.z+radius*Math.cos(azimuth)*Math.cos(elevation));camera.lookAt(target);}
function fit(view='reference'){
 if(!current)return;const box=new T.Box3().setFromObject(current.root),sphere=box.getBoundingSphere(new T.Sphere());target.copy(sphere.center);
 const a=camera.aspect,vert=T.MathUtils.degToRad(camera.fov/2),angle=Math.min(vert,Math.atan(Math.tan(vert)*a));radius=Math.max(.7,sphere.radius/Math.sin(angle)*1.13);
 const angles={reference:[key==='E'?0:.38,key==='E'?.13:.14],front:[0,.06],side:[Math.PI/2,.1],back:[Math.PI,.15],top:[0,1.43]};[azimuth,elevation]=angles[view]||angles.reference;updateCam();}
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function metrics(){if(!current)return;const m=A.measure(current.root,current.score);$('#bytes').textContent=m.scoreBytes+' B';$('#triangles').textContent=Math.round(m.triangles).toLocaleString();$('#hash').textContent=A.fingerprint(current.root);$('#time').textContent=Math.round(current.buildMs)+' ms';$('#species').textContent=A.SCHEMA[current.kind].name;return m;}
async function play(text=input.value){if(busy)return;busy=true;message('正在由谱生成连续曲面与表面细节…');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 try{const candidate=A.buildScore(text);if(current)A.dispose(current.root);current=candidate;key=candidate.kind;scene.add(candidate.root);input.value=text;metrics();fit();message('演奏完成 · 照片引导的程序化近似，非实测扫描');$('#empty').hidden=true;for(const b of document.querySelectorAll('[data-kind]'))b.setAttribute('aria-pressed',String(b.dataset.kind===key));if(data[key]&&$('#observation'))$('#observation').textContent=data[key].observed;}
 catch(e){message(e.message,true);}finally{busy=false;}
}
function download(name,text,mime='text/plain'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:mime}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
for(const b of document.querySelectorAll('[data-kind]'))b.onclick=()=>play(data[b.dataset.kind].score);
$('#play').onclick=()=>play();$('#reset').onclick=()=>fit();
$('#verify').onclick=async()=>{if(!current||busy)return;busy=true;message('正在独立重建并比较实际几何、材质与世界变换…');await new Promise(r=>setTimeout(r,40));try{const ok=A.verifyReplay(current);message(ok?'重演校验通过 · 实际输出逐字节一致':'重演校验不一致',!ok);}catch(e){message(e.message,true);}busy=false;};
$('#export').onclick=()=>{if(current)download('KAOPU_'+current.kind+'_K3.score',current.score+'\n');};
$('#import').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>1024){message('谱文件过大；应为不超过 512 字符的文本',true);return;}input.value=(await f.text()).trim();play();};
input.oninput=()=>message('尚未演奏修改后的谱；当前画面仍为上一份已生成结果');
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>fit(b.dataset.view);
$('#wire').onchange=e=>{if(!current)return;current.root.traverse(o=>{if(o.material){o.material.wireframe=e.target.checked;o.material.needsUpdate=true;}});};
let pointer=null;canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!pointer)return;azimuth-=(e.clientX-pointer.x)*.007;elevation= Math.max(-.2,Math.min(1.5,elevation+(e.clientY-pointer.y)*.006));pointer.x=e.clientX;pointer.y=e.clientY;updateCam();});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,()=>pointer=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();radius=Math.max(.2,Math.min(30,radius*Math.exp(e.deltaY*.001)));updateCam();},{passive:false});
$('#zoom-in').onclick=()=>{radius*=.85;updateCam();};$('#zoom-out').onclick=()=>{radius*=1.18;updateCam();};
new ResizeObserver(()=>{let w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();fit();}).observe(viewport);
renderer.setAnimationLoop(()=>{frames++;renderer.render(scene,camera);});
globalThis.__ANIMAL_QA__={play,info:()=>({version:A.VERSION,kind:current?.kind,frames,score:current?.score,metrics:current?A.measure(current.root,current.score):null,hash:current?A.fingerprint(current.root):null,camera:camera.position.toArray(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),verify:()=>A.verifyReplay(current)};
if(!portable)play(data.B.score);else message('乐器已就绪 · 粘贴或导入独立 K3 动物谱再演奏');
})();

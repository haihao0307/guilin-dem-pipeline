import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createSceneModel,SPEC,LENGTH} from './scene.mjs';
const $=id=>document.getElementById(id),canvas=$('scene');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){$('loading').textContent='三维渲染未能启动，请使用支持 WebGL 的浏览器';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b2425);
const camera=new THREE.OrthographicCamera(-15,15,15,-15,.1,120);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.1;controls.enablePan=false;controls.minZoom=.6;controls.maxZoom=2.5;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI*.74;controls.enabled=false;
const hemi=new THREE.HemisphereLight(0xd5e6ec,0x273d30,1.4);scene.add(hemi);
const key=new THREE.DirectionalLight(0xffebc4,2.3);key.position.set(1,18,12);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-18;key.shadow.camera.right=18;key.shadow.camera.top=17;key.shadow.camera.bottom=-17;key.shadow.camera.far=60;key.shadow.normalBias=.05;key.shadow.bias=-.00025;key.shadow.radius=3;scene.add(key);
const rim=new THREE.DirectionalLight(0xc3dce4,.7);rim.position.set(-14,8,-14);scene.add(rim);
const model=createSceneModel();scene.add(model.root);
const lamp=new THREE.SpotLight(0xffe7a2,38,14,Math.PI*.18,.7,1.3);lamp.position.set(4.7,2.7,0);lamp.target.position.set(10.7,.12,0);scene.add(lamp,lamp.target);
function makeSmokeTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,5,64,64,64);g.addColorStop(0,'rgba(237,242,228,.52)');g.addColorStop(.35,'rgba(227,235,230,.36)');g.addColorStop(.65,'rgba(220,232,228,.16)');g.addColorStop(1,'rgba(213,225,225,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const smokeTexture=makeSmokeTexture(),smokeGroup=new THREE.Group();scene.add(smokeGroup);const smokeParticles=[];
for(let i=0;i<125;i++){const material=new THREE.SpriteMaterial({map:smokeTexture,color:i%4===0?0xb7cbcf:0xf1f2da,transparent:true,depthWrite:false,opacity:.3});const sprite=new THREE.Sprite(material);smokeGroup.add(sprite);smokeParticles.push(sprite);}
const sparkN=90,sparkPositions=new Float32Array(sparkN*3),sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));const sparks=new THREE.Points(sparkGeometry,new THREE.PointsMaterial({color:0xffd475,size:.033,transparent:true,opacity:.85,depthWrite:false}));scene.add(sparks);
let elapsed=0,playing=!new URLSearchParams(location.search).has('paused')&&!matchMedia('(prefers-reduced-motion: reduce)').matches,speed=1,last=performance.now(),frame=0,raf=0,contextLost=false,needsRender=true;
function resetCamera(){controls.enableDamping=false;controls.update();camera.position.set(24.1,21.15,28);camera.zoom=1;controls.target.set(1.4,.1,0);camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();controls.enableDamping=true;needsRender=true;}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);const aspect=w/h,span=Math.max(16.5,16.5*aspect);camera.left=-span/2;camera.right=span/2;camera.top=span/aspect/2;camera.bottom=-span/aspect/2;camera.updateProjectionMatrix();needsRender=true;}
function smokeAt(t){for(let i=0;i<smokeParticles.length;i++){const f=((t/2+i*.618033989)%1+1)%1,side=i%2?1:-1,emit=4.0-(i%13)*.76;const p=smokeParticles[i];p.position.set(emit-f*2.8,.7+f*2.3+.2*Math.sin(i*3+t*Math.PI*2/3),side*(1.03+f*.62)+.15*Math.sin(i+t*Math.PI/3));const s=(.68+f*1.75)*(1+(i%5)*.08);p.scale.set(s,s,1);p.material.opacity=Math.sin(Math.PI*f)*.82;p.material.rotation=i+f*.8;}for(let i=0;i<sparkN;i++){const f=(t*2+i*.381966)%1,j=i*3; sparkPositions[j]=3.6-(i%4)*2.9-f*.6;sparkPositions[j+1]=.58+Math.sin(f*Math.PI)*.55;sparkPositions[j+2]=(i%2?1:-1)*(.81+f*.46);}sparkGeometry.attributes.position.needsUpdate=true;}
function updateUI(){ $('playPause').innerHTML=playing?'Ⅱ <span>暂停</span>':'▶ <span>播放</span>';$('playPause').setAttribute('aria-label',playing?'暂停循环':'播放循环');}
function renderAt(t){model.setTime(t);smokeAt(t);controls.update();renderer.render(scene,camera);$('time').value=(t%SPEC.period).toFixed(2);$('timeValue').value=`${(t%SPEC.period).toFixed(2)} / 6 s`;frame++;}
function animate(now){raf=requestAnimationFrame(animate);const dt=(now-last)/1000;last=now;if(contextLost||document.hidden)return;controls.update();if(playing){elapsed=(elapsed+dt*speed)%SPEC.period;renderAt(elapsed);}else if(needsRender){renderAt(elapsed);}needsRender=false;}
controls.addEventListener('change',()=>{needsRender=true;});
$('playPause').addEventListener('click',()=>{playing=!playing;updateUI();});
$('resetView').addEventListener('click',()=>{resetCamera();controls.enabled=false;$('rotate').setAttribute('aria-pressed','false');canvas.style.touchAction='pan-y';});
$('rotate').addEventListener('click',()=>{controls.enabled=!controls.enabled;$('rotate').setAttribute('aria-pressed',String(controls.enabled));canvas.style.touchAction=controls.enabled?'none':'pan-y';});
$('smoke').addEventListener('click',()=>{smokeGroup.visible=!smokeGroup.visible;sparks.visible=smokeGroup.visible;$('smoke').setAttribute('aria-pressed',String(smokeGroup.visible));needsRender=true;});
$('speed').addEventListener('change',()=>{speed=Number($('speed').value);});
$('time').addEventListener('input',()=>{playing=false;elapsed=Number($('time').value)%6;renderAt(elapsed);updateUI();});
function closeAbout(){ $('about').hidden=true;$('aboutOpen').setAttribute('aria-expanded','false');$('aboutOpen').focus();}
$('aboutOpen').addEventListener('click',()=>{const open=$('about').hidden;$('about').hidden=!open;$('aboutOpen').setAttribute('aria-expanded',String(open));if(open)$('aboutClose').focus();});$('aboutClose').addEventListener('click',closeAbout);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('about').hidden){closeAbout();return;}if(/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();playing=!playing;updateUI();}if(e.key.toLowerCase()==='r')resetCamera();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;$('loading').hidden=false;$('loading').textContent='三维画面已暂停，正在等待图形环境恢复…';});canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;$('loading').hidden=true;resize();renderAt(elapsed);});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{last=performance.now();});
resetCamera();resize();updateUI();renderAt(0);$('loading').hidden=true;requestAnimationFrame(animate);
window.__voxelTrain={version:'r01-local',ready:true,stats:model.stats,getState:()=>({elapsed,playing,speed,frame,phase:model.phase.value,freeView:controls.enabled,smoke:smokeGroup.visible,camera:camera.position.toArray(),zoom:camera.zoom,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),setTime(t){playing=false;elapsed=((Number(t)%6)+6)%6;renderAt(elapsed);updateUI();},resetCamera,render:()=>renderAt(elapsed),scene,model,camera,renderer};

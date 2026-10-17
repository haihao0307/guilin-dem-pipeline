import * as T from 'three';
import {registerWheelEnvelopeDisplay} from './source-display-datums.mjs';
import {applyAcceptanceCamera,projectedExtents} from './orthographic-acceptance.mjs';
import {RoomEnvironment} from '../vendor/RoomEnvironment.mjs';
import {restoreOriginal} from './original-chassis-recovery.mjs?v=loading-r02';
import {createA6Design} from '../design/a6-design.mjs';
import {createCoachDesign} from '../design/coach/coach-design.mjs';
const stage=document.querySelector('#stage'),status=document.querySelector('#status');
window.COMPARISON={view:'side',ready:false,errors:[],loading:{},sourceUnits:'unchanged; not calibrated metres'};
const reportProgress=e=>{COMPARISON.loading[e.key]=e;window.trainLoadProgress?.(e);};
window.trainBootStarted=true;
addEventListener('error',e=>COMPARISON.errors.push(e.message));addEventListener('unhandledrejection',e=>COMPARISON.errors.push(String(e.reason)));
try{
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setClearColor('#a4aca5');renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.debug.onShaderError=(gl,p,v,f)=>COMPARISON.errors.push('SHADER '+gl.getProgramInfoLog(p)+' '+gl.getShaderInfoLog(v)+' '+gl.getShaderInfoLog(f));stage.append(renderer.domElement);
 const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.04).texture;studio.dispose();pmrem.dispose();
 const sources=new Array(4),panels=[],ids=['a4','a6','mark3','coach'];let design,coachDesign;
 const glazingRoom=new T.Scene();glazingRoom.background=new T.Color(.12,.16,.14);const glazingPMREM=new T.PMREMGenerator(renderer),glazingEnvironment=glazingPMREM.fromScene(glazingRoom,0).texture;glazingPMREM.dispose();
 let view='side',zoom=1,playing=false,phase=0,last=0,designVisible=true;
 const groupFrames=new Map();
 function fit(){const union=new T.Box3();for(const key of ['a4','mark3']){const pair=panels.filter(p=>p.source.key===key);if(!pair.length)continue;const box=new T.Box3();pair.forEach(p=>box.union(new T.Box3().setFromObject(p.scene,true)));union.union(box);groupFrames.set(key,{box,center:box.getCenter(new T.Vector3()),size:box.getSize(new T.Vector3())});}const commonY=union.getCenter(new T.Vector3()).y;for(const frame of groupFrames.values()){frame.center.y=commonY;frame.size.y=2*Math.max(frame.box.max.y-commonY,commonY-frame.box.min.y);}}
 function render(){const sw=stage.clientWidth,sh=stage.clientHeight;renderer.setScissorTest(false);renderer.setSize(sw,sh,false);renderer.clear();renderer.setScissorTest(true);const base=stage.getBoundingClientRect();const scales={};
 for(const[key,frame]of groupFrames){const pair=panels.filter(p=>p.source.key===key),extent=projectedExtents(frame.size,view);scales[key]=Math.max(...pair.flatMap(p=>{const r=p.element.getBoundingClientRect();return[extent.width/r.width,extent.height/r.height]}))*1.12/zoom;}
 const sharedSourceUnitScale=Math.max(...Object.values(scales));for(const key of Object.keys(scales))scales[key]=sharedSourceUnitScale;
 for(const p of panels){const r=p.element.getBoundingClientRect(),w=r.width,h=r.height,frame=groupFrames.get(p.source.key);applyAcceptanceCamera(T,p.camera,{view,center:frame.center,worldUnitsPerPixel:scales[p.source.key],width:w,height:h});renderer.setViewport(r.left-base.left,sh-(r.bottom-base.top),w,h);renderer.setScissor(r.left-base.left,sh-(r.bottom-base.top),w,h);renderer.render(p.scene,p.camera);let scaleLabel=p.element.querySelector('.pixel-scale');if(!scaleLabel){scaleLabel=document.createElement('span');scaleLabel.className='pixel-scale';p.element.append(scaleLabel);}scaleLabel.textContent=scales[p.source.key].toFixed(5)+' 源单位/像素';}
 COMPARISON.view=view;COMPARISON.worldUnitsPerPixel=scales;document.querySelector('#projection-status').textContent=({side:'正侧',front:'正面',top:'顶面'}[view])+'正交 · '+Object.entries(scales).map(([k,v])=>k.toUpperCase()+' '+v.toFixed(5)+' 源单位/像素').join(' · ')+'；全窗同数值源单位比例，跨来源米制未标定';}
 function reset(){playing=false;document.querySelector('#play').textContent='播放原A4动画';sources.forEach(s=>{s.mixer.stopAllAction();s.nodes.forEach((n,i)=>{n.position.copy(s.rest[i].position);n.quaternion.copy(s.rest[i].quaternion);n.scale.copy(s.rest[i].scale);n.matrix.copy(s.rest[i].matrix)});s.root.updateMatrixWorld(true)});phase=0;render()}
 // A verified complete pair is rendered immediately; a slower other source cannot block it.
 async function loadPair(key,offset){
  const pair=await Promise.all([restoreOriginal(key,{onProgress:reportProgress}),restoreOriginal(key,{onProgress:reportProgress})]);
  pair.forEach((source,j)=>{const i=offset+j;sources[i]=source;source.showAll();const scene=new T.Scene();scene.background=new T.Color(i%2?'#e3e8e1':'#e9e6dd');scene.environment=env;scene.add(source.root);scene.add(new T.HemisphereLight(0xffffff,0x656b62,1.2));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(10,20,15);scene.add(sun);
   if(i===1){design=createA6Design(T,source);design.designGlass.envMap=glazingEnvironment;design.designGlass.envMapIntensity=.18;design.designGlass.clearcoat=0;design.designGlass.clearcoatRoughness=.1;design.designGlass.needsUpdate=true;scene.add(design.root);design.setVisible(true);}
   if(i===3){coachDesign=createCoachDesign(T,source);scene.add(coachDesign.root);coachDesign.setVisible(true);}
   const displayRegistration=registerWheelEnvelopeDisplay(T,source,i===1?design.root:i===3?coachDesign.root:null);scene.add(displayRegistration);
   panels.push({id:ids[i],source,scene,displayRegistration,camera:new T.OrthographicCamera(),element:document.getElementById(ids[i])});
  });panels.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));fit();render();COMPARISON.visiblePanels=panels.map(p=>p.id);reportProgress({key,phase:'visible'});
 }
 await Promise.all([loadPair('a4',0),loadPair('mark3',2)]);
 for(const name of ['side','front','top'])document.getElementById(name).onclick=()=>{view=name;zoom=1;render()};document.querySelector('#rest').onclick=reset;document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'暂停原A4动画':'播放原A4动画'};document.querySelector('#shell').onclick=()=>{designVisible=!designVisible;design.root.visible=designVisible;design.setVisible?.(designVisible);coachDesign.root.visible=designVisible;coachDesign.setVisible(designVisible);render()};
 // Rotation/orbit is deliberately unavailable in a dimensional acceptance view.
 for(const p of panels)p.element.onwheel=e=>{e.preventDefault();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.5,4);render()};
 addEventListener('resize',render);renderer.setAnimationLoop(now=>{if(playing){phase+=Math.min(.1,(now-last)/1000);const duration=sources[0].model.animations[0]?.duration||1;sources[0].setTime(phase%duration);sources[1].setTime(phase%duration);render()}last=now});
 window.trainLoadComplete=true;Object.assign(COMPARISON,{ready:true,renderer,panels,sources,design,coachDesign,render,reset});status.textContent='A4 331节点/200网格 ×2 · Mark3 145节点/89网格 ×2 · 原材质与贴图完整 · 仅轴向正交验收；机车与车厢统一外壳候选；前视/原机构分别验收';render();
}catch(e){COMPARISON.errors.push(e.stack||e.message);window.trainLoadFailed?.(e);status.textContent='加载失败：'+e.message+'。已校验画面保留；请点重新加载重试。';}

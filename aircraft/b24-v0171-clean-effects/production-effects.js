import * as T from 'three';
import {SAMPLES,blurWeight,shutterOffsets,rollAngle,impactShot,surfaceKind} from './effect-state.js';

const NOISE=`
float b24hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float b24noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(b24hash(i),b24hash(i+vec3(1,0,0)),f.x),mix(b24hash(i+vec3(0,1,0)),b24hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(b24hash(i+vec3(0,0,1)),b24hash(i+vec3(1,0,1)),f.x),mix(b24hash(i+vec3(0,1,1)),b24hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
function replaceOnce(text,needle,value){if(text.split(needle).length!==2)throw Error('Shader anchor changed: '+needle);return text.replace(needle,value);}
function surfaceMaterial(mesh,kind){
 const original=mesh.material,mat=original.clone(),box=mesh.geometry.boundingBox;
 const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
 // Dimensionless bind-local coordinates: not a calibrated physical weathering scale.
 const inv=1/Math.max(size.x,size.y,size.z,1e-6);
 mat.name='B24_R2_'+kind;
 mat.onBeforeCompile=(shader,renderer)=>{
  original.onBeforeCompile.call(mat,shader,renderer);
  shader.uniforms.b24center={value:center};shader.uniforms.b24inv={value:inv};
  shader.vertexShader='varying vec3 vB24p;uniform vec3 b24center;uniform float b24inv;\n'+shader.vertexShader;
  shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvB24p=(position-b24center)*b24inv;');
  shader.fragmentShader='varying vec3 vB24p;\n'+NOISE+shader.fragmentShader;
  const grain=kind==='tire'?`
float b24broad=b24noise(vB24p*9.+vec3(4.));
float b24detail=b24noise(vB24p*38.);
float b24dust=smoothstep(.30,.74,b24broad)*(.24+.20*b24detail);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.125,.085,.045),b24dust);
diffuseColor.rgb*=.94+.12*b24detail;`:`
float b24broad=b24noise(vB24p*11.);
float b24detail=b24noise(vB24p*65.);
diffuseColor.rgb*=.985+.025*b24broad;`;
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <color_fragment>','#include <color_fragment>\n'+grain);
  const rough=kind==='tire'?'roughnessFactor=clamp(.86+.11*b24broad,0.,1.);':
   'float b24aa=1.-smoothstep(.02,.09,length(fwidth(vB24p)));roughnessFactor=clamp(roughnessFactor+.045*(b24broad-.5)+.02*(b24detail-.5)*b24aa,.18,.60);';
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+rough);
 };
 mat.customProgramCacheKey=()=> 'b24-r2-local-surface-'+kind;
 return mat;
}

export function install(api){
 if(!api.ready||api.productionEffects)throw Error('B24 must be ready and installed only once');
 const plane=api.plane,rows=[],blur=[],warnings=[];
 plane.group.updateMatrixWorld(true);
 for(const mesh of plane.meshes){
  const id=mesh.userData.sourceNode,kind=surfaceKind(id,plane.skinMaterials.includes(mesh.material),mesh.material.metalness,plane.paths[id]);
  if(kind)rows.push({mesh,kind,original:mesh.material,candidate:surfaceMaterial(mesh,kind)});
 }
 for(const spindle of plane.spindles){
  const source=[];spindle.node.traverse(o=>{if(o.isMesh && plane.meshes.includes(o) && o.geometry.index?.count===1119*3)source.push(o);});
  if(!source.length){warnings.push('No verified source blade below spindle '+spindle.id);continue;}
  const inverse=new T.Matrix4().copy(spindle.node.matrixWorld).invert();
  for(const mesh of source){
   const relative=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
   const original=mesh.material,blade=original.clone();
   blade.onBeforeCompile=original.onBeforeCompile;blade.customProgramCacheKey=original.customProgramCacheKey;
   blade.transparent=true;blade.depthWrite=false;blade.forceSinglePass=true;
   rows.push({mesh,kind:'blade',original,candidate:blade,spindle});
   const ghostMat=original.clone();ghostMat.onBeforeCompile=original.onBeforeCompile;ghostMat.customProgramCacheKey=original.customProgramCacheKey;
   ghostMat.transparent=true;ghostMat.depthWrite=false;ghostMat.forceSinglePass=true;ghostMat.opacity=.1;
   const ghost=new T.InstancedMesh(mesh.geometry,ghostMat,SAMPLES);ghost.name='B24_SOURCE_BLADE_EXPOSURE';ghost.frustumCulled=false;ghost.visible=false;ghost.castShadow=false;
   ghost.instanceMatrix.setUsage(T.DynamicDrawUsage);spindle.node.parent.add(ghost);
   blur.push({spindle,ghost,relative});
  }
 }
 const state={enabled:true,ready:true,weather:false,fog:false,visualAcceptance:false,
  acceptedBaseline:'V017',candidate:'V017.1',warnings,bladeInstances:blur.length*SAMPLES,
  surfaceCounts:{tire:rows.filter(r=>r.kind==='tire').length,skin:rows.filter(r=>r.kind==='skin').length},
  rotorChannels:[...new Set(blur.map(b=>b.spindle.id))],lastRoll:0,impactFramed:false,frameCount:0};
 const originalRender=api.renderer.render.bind(api.renderer),q=new T.Quaternion(),offset=new T.Quaternion(),matrix=new T.Matrix4(),z=new T.Vector3(0,0,1);
 const target=new T.Vector3(),eye=new T.Vector3();
 function applyMaterials(){for(const r of rows)r.mesh.material=state.enabled?r.candidate:r.original;}
 function update(){
  const time=api.mission.time;state.frameCount++;
  // Weather Mother and fog have no connection or runtime dependency here.
  if(api.scene.fog!==null)throw Error('Fog is outside the active B24 contract');
  for(const r of rows)if(r.kind==='blade')r.candidate.opacity=1-.76*blurWeight(plane.speeds[r.spindle.engine]);
  for(const b of blur){
   const rpm=plane.speeds[b.spindle.engine],weight=blurWeight(rpm),node=b.spindle.node;
   b.ghost.visible=state.enabled&&weight>.001;b.ghost.material.opacity=weight*.105;
   if(!b.ghost.visible)continue;
   shutterOffsets(rpm).forEach((angle,i)=>{
    offset.setFromAxisAngle(b.spindle.axis,angle);q.copy(node.quaternion).multiply(offset);
    matrix.compose(node.position,q,node.scale).multiply(b.relative);b.ghost.setMatrixAt(i,matrix);
   });b.ghost.instanceMatrix.needsUpdate=true;
  }
  state.lastRoll=0;
  if(state.enabled)for(const bomb of api.effects.bombs){if(bomb.hit)continue;
   const angle=rollAngle(time,bomb.time),velocity=bomb.v.clone();velocity.y-=9.81*Math.max(0,time-bomb.time);offset.setFromAxisAngle(z,angle);bomb.o.quaternion.setFromUnitVectors(z,velocity.normalize()).multiply(offset);state.lastRoll=angle;
  }
  const cinema=document.querySelector('[data-camera="cinema"]')?.classList.contains('active');
  state.impactFramed=state.enabled&&Boolean(api.effects.target)&&impactShot(time,api.effects.lastImpact,!cinema);
  if(state.impactFramed){target.copy(api.effects.target).add(new T.Vector3(0,5,0));eye.copy(target).add(new T.Vector3(48,23,60));api.camera.position.copy(eye);api.camera.lookAt(target);document.getElementById('shotLabel').textContent='落点与爆炸近景';}
  // Preserve horizontal coverage on portrait screens; keep the impact close-up.
  const zoom=innerWidth<650&&!state.impactFramed?Math.min(1,api.camera.aspect/1.22):1;
  if(Math.abs(api.camera.zoom-zoom)>1e-5){api.camera.zoom=zoom;api.camera.updateProjectionMatrix();}
 }
 state.setEnabled=value=>{state.enabled=Boolean(value);applyMaterials();document.getElementById('r2Enabled').checked=state.enabled;};
 state.audit=()=>({enabled:state.enabled,weather:state.weather,fog:state.fog,surfaceCounts:state.surfaceCounts,rotorChannels:state.rotorChannels,bladeInstances:state.bladeInstances,warnings:[...warnings],lastRoll:state.lastRoll,impactFramed:state.impactFramed,frameCount:state.frameCount,sourceGeometryPreserved:rows.every(r=>plane.geometries.includes(r.mesh.geometry))});
 api.productionEffects=state;api.build='B24_V0171_CLEAN_EFFECTS';api.visualAcceptance=false;api.acceptedBaseline={version:'V017',visualAcceptance:true,sourceCommit:'ceed8183dc5fb8399349e73ebeef5b997d7d7389'};
 const box=document.createElement('section');box.id='r2Controls';box.innerHTML='<div class="sectionTitle"><h3>本轮效果对照</h3><span>V017.1 待确认</span></div><label class="toggle"><span>轮胎旧化、金属细节与残影</span><input id="r2Enabled" type="checkbox" checked></label><p class="hint">关闭可比较原材质与显示效果。天气和雾暂不接入。滚转与残影属于展示近似。</p>';
 document.getElementById('panel').insertBefore(box,document.querySelector('#panel section'));
 document.getElementById('r2Enabled').onchange=e=>state.setEnabled(e.target.checked);
 const footer=document.querySelector('#panel footer');if(footer)footer.textContent='V017 已确认保留 · V017.1 效果候选 · 天气与雾未接入';
 const responsive=document.createElement('style');responsive.textContent='@media(max-width:650px){.wordmark small{display:none}.wordmark h1{font-size:14px;line-height:1.25;margin:0}.top{align-items:center}#panelToggle{white-space:nowrap;min-width:70px}}';document.head.append(responsive);
 applyMaterials();
 api.renderer.render=(scene,camera)=>{if(scene===api.scene&&camera===api.camera)update();return originalRender(scene,camera);};
 return state;
}
if(typeof window!=='undefined'&&!window.__B24_BOOTSTRAP_MANAGED__){
 const deadline=performance.now()+120000;
 const timer=setInterval(()=>{const api=window.__B24_WORKBENCH__;if(api?.ready){clearInterval(timer);try{install(api);}catch(error){api.errors.push(String(error));document.getElementById('fatal').hidden=false;document.getElementById('fatal').textContent='效果候选未通过载入检查：'+error.message;}}
 else if(performance.now()>deadline||api?.errors.length){clearInterval(timer);}},50);
}

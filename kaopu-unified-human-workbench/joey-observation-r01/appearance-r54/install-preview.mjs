import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {sha256 as digest,verifyR52Archive,verifyR52Geometry,R52_REFERENCE_SHA} from './FrozenR52Lock.mjs';
import {attachAppearanceR52} from './base/brow-face-r52/AppearanceR52.mjs';
import {attachObservationLighting} from './ObservationLighting.mjs';
import {attachGuideStructureR30} from './legacy-r30/GuideStructureR30.js';
import {buildPackedGroomR30} from './legacy-r30/PackedGroomR30.js';
import {attachPackedGroomR30} from './legacy-r30/InstancedGroomR30.js';
import {attachR14Coverage} from './hair/R14CoverageLayer.js';
import {attachNativeEyeSurfaceR54} from './eye/NativeEyeSurfaceR54.mjs';
const send=(type,p={})=>parent.postMessage({type,...p},location.origin),progress=message=>send('r54-progress',{message});
export async function mountPreview(){
 const started=performance.now();while(!window.fullCommonWorkbench){if(performance.now()-started>30000)throw Error('原生人物入口未就绪');await new Promise(r=>setTimeout(r,100));}
 const [archive,config]=await Promise.all(['archive-r52.json','views.json'].map(async n=>{const r=await fetch(new URL(n,import.meta.url));if(!r.ok)throw Error('候选配置载入失败');return n==='archive-r52.json'?verifyR52Archive(await r.arrayBuffer()):r.json();}));
 const api=window.fullCommonWorkbench,loadStatus=document.getElementById('load-status'),loadProgress=document.getElementById('load-progress');
 progress('2/5 载入原生人体');const watch=new MutationObserver(()=>{const text=loadStatus?.textContent?.trim();if(text)progress('2/5 '+text);});if(loadStatus)watch.observe(loadStatus,{childList:true,characterData:true,subtree:true});
 try{await api.load();}finally{watch.disconnect();}
 if(!api.diagnostics().ready||api.diagnostics().busy)throw Error(loadStatus?.textContent?.trim()||'原生模型载入未完成');progress('3/5 恢复并校验固定脸型');await api.motion().setMode('shape');api.restore(archive);
 const v=api.motion().viewer,expected=config.rows.find(x=>x.id==='E04');if(expected.expectedPositionSHA256!==R52_REFERENCE_SHA)throw Error('视图配置中的 R52 基线不同');
 const frozenGeometry=await verifyR52Geometry(api.positions(),api.state(),archive.state);window.r54StartupDiagnostics={faceLock:frozenGeometry};
 const appearance=await attachAppearanceR52(api,{pigmentScale:.55,candidateBrows:true,taper:true});
 function view(id){const row=config.rows.find(x=>x.id===id)||expected,c=v.camera;if(id==='back'){const top=coverage.report().rootFrame.current.origin;c.clearViewOffset();c.fov=30;c.zoom=1;c.position.set(top[0],top[1]+.04,top[2]-.65);c.up.set(0,1,0);c.lookAt(top[0],top[1]-.03,top[2]);c.updateProjectionMatrix();}else{const s=row.camera,p=s.projection;new THREE.Matrix4().fromArray(s.cameraWorld).decompose(c.position,c.quaternion,c.scale);c.near=s.near;c.far=s.far;c.fov=2*Math.atan(1/p[5])*180/Math.PI;c.zoom=1;c.setViewOffset(797,590,p[8]*797/2,-p[9]*590/2,797,590);c.updateProjectionMatrix();}c.updateMatrixWorld(true);v.orbit.target.set(0,.70,.06);v.orbit.enabled=true;v.render();}
 // Select the same E04 perspective before generating any display-only layer.
 {const s=expected.camera;new THREE.Matrix4().fromArray(s.cameraWorld).decompose(v.camera.position,v.camera.quaternion,v.camera.scale);v.camera.near=s.near;v.camera.far=s.far;v.camera.fov=2*Math.atan(1/s.projection[5])*180/Math.PI;v.camera.setViewOffset(797,590,s.projection[8]*797/2,-s.projection[9]*590/2,797,590);v.camera.updateProjectionMatrix();v.camera.updateMatrixWorld(true);}
 progress('4/5 生成原长发段');const guides=attachGuideStructureR30(api),packed=buildPackedGroomR30(api,guides,{count:8000,matchingRootSupport:false,repairPrefixRoutes:true,meridianStrength:.8,holdLateralThroughNeck:true});const hairPointSHA=await digest(packed.pointData),hairNormalSHA=await digest(packed.normalData);Object.assign(window.r54StartupDiagnostics,{hairPointSHA,hairNormalSHA});if(hairPointSHA!==expected.expectedHairPointSHA256||hairNormalSHA!==expected.expectedHairNormalSHA256)throw Error('原长发绑定与冻结记录不同：'+hairPointSHA+' / '+hairNormalSHA);const longHair=attachPackedGroomR30(api,packed);v.scene.traverse(o=>{if(o.name==='18 colour-coded structural guides (diagnostic thickness)')o.visible=false;});
 const light=await attachObservationLighting(v,{options:expected.light});v.scene.traverse(o=>{if(o.isDirectionalLight&&o.name==='Reference comparison authored key'){o.shadow.mapSize.set(4096,4096);o.shadow.map?.dispose();o.shadow.map=null;o.shadow.needsUpdate=true;}});
 progress('4/5 在当前头皮生成覆盖发束');const coverage=await attachR14Coverage(api,{count:36000,segments:24,recipe:{style:'side-flow'},onProgress:(_stage,fraction)=>progress('4/5 正在生成头发'+(Number.isFinite(fraction)?' '+Math.round(Math.max(0,Math.min(1,fraction))*100)+'%':''))});progress('5/5 编译眼表并检查画面');const eye=attachNativeEyeSurfaceR54(v.skin);view('E04');
 const finalGeometry=await verifyR52Geometry(api.positions(),api.state(),archive.state);if(finalGeometry.actualSHA!==frozenGeometry.actualSHA)throw Error('外观适配改变了脸型，已停止显示');if(eye.report().compiles<1)throw Error('眼表尚未编译');
 const report=()=>({version:'R54-appearance-preview/1',face:'R52 frozen',facePositionSHA:frozenGeometry.actualSHA,faceLock:frozenGeometry,eye:eye.report(),coverage:coverage.report(),geometryChanged:false,likenessAccepted:false,hairMature:false,physics:false,elapsedMs:performance.now()-started});
 window.r54Preview={view,hair:on=>coverage.setVisible(on),eye:on=>eye.enabled(on),report,dispose(){eye.dispose();coverage.dispose();light.dispose();longHair.dispose();guides.dispose();appearance.dispose();}};
 send('r54-ready',{report:report()});
}

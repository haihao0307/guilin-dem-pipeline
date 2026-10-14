import {NativeBinding,RigidPoseSampler,canonicalSource,ArmContinuity,ThumbContact,BasicActions,buildCapturedClip,SOURCES} from './platform-motion/bridge.mjs';
import {sha,modelIdentity,materialHash,stable} from './source-contract.mjs';
import {loadPerson as loadFrozenPerson} from './person/load-person.mjs';
import * as THREE from 'three';
let runtime;
export async function loadPlatformPerson(progress=()=>{}){
 const iframe=document.createElement('iframe');iframe.title='人物总工作台原生运行时';
 Object.assign(iframe.style,{position:'fixed',left:'-20000px',top:'0',width:'1440px',height:'1000px',border:'0'});
 iframe.src=new URL('./platform-runtime/preview.html',import.meta.url);document.body.append(iframe);
 const start=performance.now();
 await new Promise((resolve,reject)=>{const timer=setInterval(()=>{try{if(iframe.contentWindow.platformReview?.ready()){clearInterval(timer);resolve();}else if(performance.now()-start>150000){clearInterval(timer);reject(Error('最新人物运行时载入超时'));}else progress({fraction:Math.min(.75,(performance.now()-start)/60000)});}catch(e){clearInterval(timer);reject(e);}},100);});
 const win=iframe.contentWindow,q=win.__IDENTITY_QA__,model=q.model(),viewer=q.viewer();
 win.lifelikeIdle?.runtime()?.pause(true);
 await Promise.all([viewer.skin.faceReady,viewer.skin.naturalEyesReady]);
 const binding=new NativeBinding(model,viewer),sampler=new RigidPoseSampler(binding.rig),clips={};
 for(const [id,source]of Object.entries(SOURCES)){
  progress({fraction:.78,phase:'接入原生'+({walk:'走路',run:'跑步',jump:'跳跃'}[id])});
  const row={id,kind:'capture2',continuous:id!=='jump'},arms=new ArmContinuity(binding),thumb=new ThumbContact(binding);const clip=await buildCapturedClip(binding,row,canonicalSource(source),sampler,{decorate:frame=>thumb.repair(arms.apply(frame,{gesture:!row.continuous}),row,0)});
  clips[id]={frames:clip.frames,fps:clip.fps||source.fps,duration:clip.duration,continuous:id!=='jump',displacement:clip.displacement};
 }
 const idleFrame=new BasicActions(binding).pose('idle',0,4),idlePose=sampler.pack(idleFrame.posedMatrices);clips.idle={frames:[idlePose,idlePose],fps:60,duration:1,continuous:true};binding.activate(true);binding.animate(binding.names.map(()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
 const rig=structuredClone(model.lastBodyDriver.rig),order=sampler.order;
 const actor={bindingRange:binding.range,bindingPacked:binding.packed,rig,positions:model.positions.slice(),faces:model.faces,bodyCount:model.bodyCount,boneOrder:order,headSkinIndices:model.canonical.headSkinIndices,headSkinWeights:model.canonical.headSkinWeights,clips,sourceRevision:'d413d108704af47cf531ee8c25d93f682c3176e3'};
 const identity=await modelIdentity(model),frozen=await loadFrozenPerson();
 if(identity.topologySHA256!==frozen.manifest.topologySHA256)throw Error('新旧人物拓扑不同，不能复用原裁片的身体对应关系');
 const oldPositions=new Float32Array(frozen.model.positions.length),newPositions=new Float32Array(model.positions.length);
 for(let i=0;i<oldPositions.length;i+=3){oldPositions.set([frozen.model.positions[i],frozen.model.positions[i+2],-frozen.model.positions[i+1]],i);newPositions.set([model.positions[i],model.positions[i+2],-model.positions[i+1]],i);}
 actor.fittingOrigin=oldPositions;actor.restSourceIdentity=frozen.manifest;
 const measures=names=>{const w=rig.weights,ratios=[];for(const name of names){const j=rig.names.indexOf(name);if(j<0)continue;const ids=[];for(let i=0;i<model.bodyCount;i++){let weight=0;for(let k=w.ptr[i];k<w.ptr[i+1];k++)if(w.joints[k]===j)weight+=w.values[k];if(weight>.35)ids.push(i);}if(ids.length<12)continue;const span=(p,axis)=>{let lo=Infinity,hi=-Infinity;for(const i of ids){lo=Math.min(lo,p[i*3+axis]);hi=Math.max(hi,p[i*3+axis]);}return hi-lo;};ratios.push({joint:name,depthRatio:span(newPositions,2)/span(oldPositions,2),widthRatio:span(newPositions,0)/span(oldPositions,0)});}return ratios;};
 const top=measures(['spine02','spine03','upperarm01.L','upperarm01.R']),bottom=measures(['spine01','upperleg01.L','upperleg01.R']);
 const factor=rows=>Math.min(1.4,Math.max(1,...rows.map(r=>(r.depthRatio+r.widthRatio)*.5))*1.02);
 const height=p=>{let lo=Infinity,hi=-Infinity;for(let i=1;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i]);}return hi-lo;};
 runtime={iframe,win,model,viewer,binding,identity,newPositions,grading:{top:{width:factor(top),length:height(newPositions)/height(oldPositions),measurements:top},bottom:{width:factor(bottom),length:height(newPositions)/height(oldPositions),measurements:bottom}}};progress({fraction:1});
 return{model,actor,manifest:{source:'latest-unified-human-runtime',...identity},runtime};
}
export async function gradeGarmentToPlatform(source,role){const packet=structuredClone(source),grade=runtime.grading[role];packet.sourceTemplate={binding:source.binding,staticGate:source.record.staticGate,panelsUV:source.spec.panels.map(p=>p.uvMm)};for(const panel of packet.spec.panels)panel.uvMm=panel.uvMm.map(([u,v])=>[u*grade.width,v*grade.length]);packet.binding={...packet.binding,person:runtime.identity,sourcePaperSHA256:source.binding.paperSHA256,paperSHA256:await sha(stable(packet.spec.panels)),materialSHA256:await materialHash(packet.spec),recipeHash:await sha(stable({source:source.binding.recipeHash,grade,target:runtime.identity})),sizeGrade:grade};packet.record.staticGate={passed:false,sourcePassed:!!source.record.staticGate.passed,reason:'New-person size grade requires new live fit and visual acceptance'};return packet;}
export class PlatformViewer{
 constructor({canvas,container,model,onStatus}){
  if(!runtime||runtime.model!==model)throw Error('最新人物运行时没有建立');
  const v=runtime.viewer;v.observer.disconnect();canvas.replaceWith(v.canvas);v.canvas.id='canvas';v.container=container;v.onStatus=onStatus;
  v.observer=new ResizeObserver(()=>v.resize());v.observer.observe(container);
  // Studio ownership moves to this workbench. Keep the original skin and mesh.
  v.setFoldLook=()=>{};if(v.cineRig){v.cineRig.group.visible=false;v.cineRig.U.uCShadowEnable.value=0;}if(v.foldLights)v.foldLights.group.visible=false;
  v.platformBinding=runtime.binding;v.platformRuntime=runtime;
  const nativeAnimate=runtime.binding.animate.bind(runtime.binding),head=runtime.binding.rig.names.indexOf('head'),C=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),Ci=C.clone().invert(),headPose=new THREE.Matrix4();
  runtime.binding.animate=matrices=>{nativeAnimate(matrices);if(head>=0)headPose.set(...matrices[head]).premultiply(C).multiply(Ci);};
  const render=v.renderer.render.bind(v.renderer);v.renderer.render=(scene,camera)=>{if(scene===v.scene)for(const mesh of scene.children)if(mesh.userData?.platformAppearance){mesh.matrix.premultiply(headPose);mesh.matrixWorldNeedsUpdate=true;}return render(scene,camera);};
  v.resize();v.view('three');return v;
 }
}

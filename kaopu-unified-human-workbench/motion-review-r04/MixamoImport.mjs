import {FBXLoader} from '../../tooling/node_modules/three/examples/jsm/loaders/FBXLoader.js';
import * as THREE from '../vendor/three.module.js';

const normalize=n=>n.replace(/^.*:/,'').replace(/^mixamorig/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])*.5);
const extend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const REQUIRED_BONES=['Hips','Spine','Neck','Head',...['Left','Right'].flatMap(s=>['UpLeg','Leg','Foot','ToeBase','Arm','ForeArm','Hand'].map(n=>s+n))];

/** Decode only animation landmarks from a user-selected local skeleton. The FBX
 * character is never attached to our scene. Rest-pose axis differences are
 * handled by target segment directions, not by copying local Euler channels.
 */
export function packetFromAnimation(root,clip,{filename='local.fbx',fps=120}={}){
 if(!Number.isFinite(clip.duration)||clip.duration<=0||clip.duration>60)throw Error('请选择 0–60 秒的单个基础动作。');
 const bones=new Map();root.traverse(o=>{if(o.isBone)bones.set(normalize(o.name),o);});
 const missing=REQUIRED_BONES.filter(n=>!bones.has(normalize(n)));if(missing.length)throw Error('缺少骨骼：'+missing.join(', '));
 const get=n=>{const b=bones.get(normalize(n));return b?b.getWorldPosition(new THREE.Vector3()).toArray():null;};
 root.updateMatrixWorld(true);
 const legLength=s=>distance(get(s+'UpLeg'),get(s+'Leg'))+distance(get(s+'Leg'),get(s+'Foot'));
 const sourceLegLength=(legLength('Left')+legLength('Right'))*.5;
 if(!Number.isFinite(sourceLegLength)||sourceLegLength<1e-6)throw Error('骨架尺寸无效。');
 // Normalize arbitrary FBX units to an anatomical reference before applying
 // the target's own fixed leg lengths. This also normalizes contact thresholds.
 const unitScale=.9/sourceLegLength;
 const names=['root','lhipjoint','lfemur','ltibia','lfoot','ltoes','rhipjoint','rfemur','rtibia','rfoot','rtoes','lowerback','upperback','thorax','lowerneck','upperneck','head','lclavicle','lhumerus','lradius','lwrist','lhand','lfingers','lthumb','rclavicle','rhumerus','rradius','rwrist','rhand','rfingers','rthumb'];
 const mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();const points=[],count=Math.ceil(clip.duration*fps);
 for(let i=0;i<=count;i++){
  mixer.setTime(Math.min(clip.duration,i/fps));root.updateMatrixWorld(true);
  const spine=get('Spine'),chest=get('Spine2')||get('Spine1')||spine,neck=get('Neck'),head=get('Head'),record={root:get('Hips'),lowerback:spine,upperback:get('Spine1')||midpoint(spine,chest),thorax:chest,lowerneck:neck,upperneck:midpoint(neck,head),head};
  for(const [s,side] of [['l','Left'],['r','Right']]){
   const shoulder=get(side+'Arm'),elbow=get(side+'ForeArm'),wrist=get(side+'Hand'),ankle=get(side+'Foot'),toe=get(side+'ToeBase');
   record[s+'hipjoint']=get(side+'UpLeg');record[s+'femur']=get(side+'Leg');record[s+'tibia']=ankle;record[s+'foot']=toe;record[s+'toes']=extend(ankle,toe,1.23);
   record[s+'clavicle']=shoulder;record[s+'humerus']=elbow;record[s+'radius']=wrist;record[s+'wrist']=wrist;record[s+'hand']=get(side+'HandMiddle1')||extend(elbow,wrist,1.18);record[s+'fingers']=get(side+'HandMiddle3')||extend(wrist,record[s+'hand'],1.5);record[s+'thumb']=get(side+'HandThumb1')||wrist;
  }
  const frame=names.map(n=>record[n].map(v=>v*unitScale));if(!frame.flat().every(Number.isFinite))throw Error('动作包含非有限坐标。');points.push(frame);
 }
 mixer.stopAllAction();mixer.uncacheRoot(root);
 const floorValues=points.flatMap(f=>[f[names.indexOf('lfoot')][1],f[names.indexOf('ltoes')][1],f[names.indexOf('rfoot')][1],f[names.indexOf('rtoes')][1]]).sort((a,b)=>a-b),floorY=floorValues[Math.floor(floorValues.length*.015)],contacts={};
 for(const s of ['l','r']){
  const foot=names.indexOf(s+'foot'),toe=names.indexOf(s+'toes');
  const active=points.map((f,i)=>{const y=Math.min(f[foot][1],f[toe][1]),a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],vy=Math.abs((b[foot][1]-a[foot][1])*fps*.5);return y-floorY<.045&&vy<.65;});
  for(let i=1;i<active.length-1;i++)if(!active[i]&&active[i-1]&&active[i+1])active[i]=true;
  const runs=[];let i=0;while(i<active.length){if(!active[i]){i++;continue;}const start=i;while(i<active.length&&active[i])i++;if(i-start>=3)runs.push({startFrame:start,endFrame:i-1});}contacts[s]=runs;
 }
 return{schema:'humanoid-source-positions/1',provider:'local-fbx',label:clip.name||filename,clip:filename+':'+(clip.name||'Animation'),fps,names,points,floorY,contacts,referenceFrame:0,provenance:{filename,animation:clip.name,sourceLegLength,unitScale,method:'local FBX skeleton landmarks -> target-proportion FK/IK',fingers:'authored target relaxation; individual captured finger rotations are not transferred',contacts:'estimated height and vertical velocity; not measured force contacts',sourceModelRendered:false,networkUpload:false}};
}

export async function readLocalFBX(file){
 if(!/\.fbx$/i.test(file.name)||file.size>64*1024*1024)throw Error('请选择小于 64 MB 的 FBX 动作文件。');
 const bytes=await file.arrayBuffer(),manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('data:'))return url;throw Error('请从 Mixamo 导出 Without Skin 动作，避免外部材质和贴图。');});
 const root=new FBXLoader(manager).parse(bytes,'');
 if(!root.animations?.length)throw Error('FBX 中没有动画片段。');
 const clips=root.animations.map(clip=>({clip,label:clip.name||file.name,duration:clip.duration}));
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return{root,clips,sha256,filename:file.name,dispose(){root.traverse(o=>{o.geometry?.dispose();const m=Array.isArray(o.material)?o.material:[o.material];for(const a of m)a?.dispose();});}};
}

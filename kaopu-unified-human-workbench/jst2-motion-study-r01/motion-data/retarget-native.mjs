/**
 * Explicit skeletal retargeting into the existing NativeRig.
 * Keeps the user's 104-bone hierarchy, lengths, meshes and binding intact.
 * No motion is synthesised when a source is absent: unsupported maps fail.
 */
import {vAdd,vSub,vScale,vDot,vCross,vLength,vUnit,qNormalize,qInverse,qMultiply,qRotate,qSlerp,qFromTo,qToMatrix,multiply4,matrixQuaternion,identity4,clamp} from './glb-motion.mjs';

const sideOf=name=>{
  const n=name.toLowerCase().replace(/^.*:/,'').replace(/^mixamorig\d*/, '');
  if(/(?:^|[_.:\s-])left(?:[_.:\s-]|$)|^left|(?:[_.:\s-])l$|^l[_.:\s-]/.test(n))return 'L';
  if(/(?:^|[_.:\s-])right(?:[_.:\s-]|$)|^right|(?:[_.:\s-])r$|^r[_.:\s-]/.test(n))return 'R';
  return null;
};
function baseName(name){return name.toLowerCase().replace(/^.*:/,'').replace(/^mixamorig\d*/,'').replace(/^bip\d*[_.\s-]*/,'').replace(/^(?:left|right)/,'').replace(/(?:left|right)$/,'').replace(/^[lr][_.\s-]/,'').replace(/[_.\s-][lr]$/,'').replace(/^(?:def|org)[_.-]/,'').replace(/[_.\s-]/g,'');}
function fingerKey(name){
  const clean=baseName(name),native=clean.match(/^finger([1-5])([1-4])$/);
  if(native)return ['thumb','index','middle','ring','pinky'][+native[1]-1]+':'+native[2];
  const match=clean.match(/(?:hand)?(thumb|index|middle|ring|pinky|little)(?:finger)?0?([1-4])$/);
  if(match)return (match[1]==='little'?'pinky':match[1])+':'+match[2];
  return null;
}
function classify(name){
  const s=sideOf(name),base=baseName(name),finger=fingerKey(name);if(finger&&s)return finger+':'+s;
  if(!s&&/^(hips?|pelvis)$/.test(base))return 'hips';
  if(!s&&/^(root|rootjoint|rootbone)$/.test(base))return 'root';
  if(!s&&/^(spine|chest|upperchest|abdomen)\d*$/.test(base))return 'spine';
  if(!s&&/^neck\d*$/.test(base))return 'neck';
  if(!s&&/^(head|headjoint)$/.test(base))return 'head';
  if(!s)return null;
  if(/^(clavicle|collar|shoulder)\d*$/.test(base))return 'shoulder:'+s;
  if(/^(upperarm|arm|uparm)(?:01|1)?$/.test(base))return 'upperarm:'+s;
  if(/^(lowerarm|forearm|loarm)(?:01|1)?$/.test(base))return 'lowerarm:'+s;
  if(/^(hand|wrist)(?:01|1)?$/.test(base))return 'hand:'+s;
  if(/^(thigh|upleg|upperleg)(?:01|1)?$/.test(base))return 'upperleg:'+s;
  if(/^(calf|leg|lowerleg|shin)(?:01|1)?$/.test(base))return 'lowerleg:'+s;
  if(/^(foot|ankle)(?:01|1)?$/.test(base))return 'foot:'+s;
  if(/^(ball|toebase|toe|toes)(?:01|1)?$/.test(base))return 'toe:'+s;
  return null;
}
function semantics(names,order){const map=new Map();for(const i of order){const key=classify(names[i]);if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(i);}return map;}
const first=(map,key)=>map.get(key)?.[0];
function pos(m){return [m[3],m[7],m[11]];}
function rigidInverse(m){const r=identity4();for(let i=0;i<3;i++){for(let j=0;j<3;j++)r[i*4+j]=m[j*4+i];r[i*4+3]=-(m[i]*m[3]+m[4+i]*m[7]+m[8+i]*m[11]);}return r;}
function frameQuaternion(left,up){
  const u=vUnit(up),l=vUnit(vSub(left,vScale(u,vDot(left,u)))),f=vUnit(vCross(l,u));
  return matrixQuaternion(new Float64Array([l[0],u[0],f[0],0,l[1],u[1],f[1],0,l[2],u[2],f[2],0,0,0,0,1]));
}
function anatomyFrame(map,positions){
  const hips=first(map,'hips')??first(map,'root'),head=first(map,'head'),l=first(map,'upperleg:L'),r=first(map,'upperleg:R');
  if([hips,head,l,r].some(x=>x===undefined))return null;
  return frameQuaternion(vSub(positions[l],positions[r]),vSub(positions[head],positions[hips]));
}
function legLength(map,p){let total=0,n=0;for(const s of ['L','R']){const ids=['upperleg:','lowerleg:','foot:'].map(k=>first(map,k+s));if(ids.every(x=>x!==undefined)){total+=vLength(vSub(p[ids[1]],p[ids[0]]))+vLength(vSub(p[ids[2]],p[ids[1]]));n++;}}return n?total/n:null;}
function sourceTail(key,index,sem,nodes,positions){
  const next={hips:'spine',root:'hips',head:null};
  if(key==='spine'||key==='neck'){const list=sem.get(key)||[],offset=list.indexOf(index);if(offset>=0&&offset+1<list.length)return list[offset+1];return first(sem,key==='spine'?'neck':'head');}
  if(key in next)return next[key]?first(sem,next[key]):undefined;
  const [part,side]=key.split(':');
  if(['shoulder','upperarm','lowerarm','hand','upperleg','lowerleg','foot'].includes(part)){
    const p={shoulder:'upperarm',upperarm:'lowerarm',lowerarm:'hand',hand:'middle:1',upperleg:'lowerleg',lowerleg:'foot',foot:'toe'}[part];return first(sem,p+':'+side);
  }
  const fm=key.match(/^(thumb|index|middle|ring|pinky):(\d):([LR])$/);if(fm)return first(sem,fm[1]+':'+(+fm[2]+1)+':'+fm[3]);
  return undefined;
}

/** Build a reviewed mapping before any playback. Override names via mapping. */
export function createNativeRetargeter(motion,rig,options={}){
  if(!motion?.animations?.length)throw Error('This official asset contains no skeletal animation');
  if(!rig?.applySkinMatrices||!rig.rest||!rig.order)throw Error('Expected the existing NativeRig instance');
  const srcNames=motion.nodes.map(n=>n.name),srcSem=semantics(srcNames,motion.order),dstSem=semantics(rig.names,rig.order),restP=rig.rest.map(pos),restQ=rig.rest.map(matrixQuaternion),inverseRest=rig.rest.map(rigidInverse);
  if(!dstSem.has('hips')&&dstSem.has('root'))dstSem.set('hips',dstSem.get('root'));
  const srcFrame=anatomyFrame(srcSem,motion.rest.worldPositions),dstFrame=anatomyFrame(dstSem,restP);
  let alignment=options.alignmentQuaternion? qNormalize(options.alignmentQuaternion):srcFrame&&dstFrame?qNormalize(qMultiply(dstFrame,qInverse(srcFrame))):null;
  if(!alignment)throw Error('Cannot infer anatomical axes: source/target needs hips, head and both thighs, or an explicit alignmentQuaternion');
  const inverseAlignment=qInverse(alignment),descriptors=Array(rig.count).fill(null),mapped=[];
  const srcByName=new Map(srcNames.map((n,i)=>[n,i]));
  for(const [key,targets] of dstSem){
    if(key==='root'&&dstSem.has('hips'))continue;
    const sources=srcSem.get(key);if(!sources?.length)continue;
    if(key==='spine'||key==='neck'){
      targets.forEach((target,k)=>{const x=targets.length===1?sources.length-1:k*(sources.length-1)/(targets.length-1),a=Math.floor(x),b=Math.ceil(x);descriptors[target]={source:sources[a],sourceB:sources[b],blend:x-a,key};});
    }else for(const target of targets)descriptors[target]={source:sources[0],sourceB:sources[0],blend:0,key};
  }
  // User-reviewed name overrides can explicitly replace or disable any mapping.
  for(const [targetName,sourceName] of Object.entries(options.mapping||{})){const target=rig.index.get(targetName);if(target===undefined)throw Error('Unknown target bone '+targetName);if(sourceName===null){descriptors[target]=null;continue;}const source=typeof sourceName==='number'?sourceName:srcByName.get(sourceName);if(source===undefined||!motion.nodes[source])throw Error('Unknown source bone '+sourceName);descriptors[target]={source,sourceB:source,blend:0,key:classify(targetName)||'override'};}
  const required=['hips','upperleg:L','upperleg:R','lowerleg:L','lowerleg:R','foot:L','foot:R','upperarm:L','upperarm:R','lowerarm:L','lowerarm:R','hand:L','hand:R','head'];
  const missing=required.filter(k=>{const t=first(dstSem,k);return t===undefined||!descriptors[t];});
  if(missing.length&&!options.allowPartial)throw Error('Unverified retarget mapping; missing '+missing.join(', '));
  const correction=Array.from({length:rig.count},()=>[0,0,0,1]);
  for(let j=0;j<rig.count;j++){
    const d=descriptors[j];if(!d)continue;
    const sourceChild=sourceTail(d.key,d.source,srcSem,motion.nodes,motion.rest.worldPositions),targetChild=sourceTail(d.key,j,dstSem,null,restP);
    if(options.alignBindDirections!==false&&sourceChild!==undefined&&targetChild!==undefined){const a=vSub(restP[targetChild],restP[j]),b=qRotate(alignment,vSub(motion.rest.worldPositions[sourceChild],motion.rest.worldPositions[d.source]));if(vLength(a)>1e-5&&vLength(b)>1e-5)correction[j]=qFromTo(a,b);}
    mapped.push({target:rig.names[j],targetIndex:j,source:srcNames[d.source],sourceIndex:d.source,sourceB:d.sourceB===d.source?null:srcNames[d.sourceB],blend:d.blend,semantic:d.key,bindCorrectionDegrees:2*Math.acos(clamp(Math.abs(correction[j][3]),-1,1))*180/Math.PI});
  }
  const srcLeg=legLength(srcSem,motion.rest.worldPositions),dstLeg=legLength(dstSem,restP),scale=options.translationScale??(srcLeg&&dstLeg?dstLeg/srcLeg:1),sourceHips=first(srcSem,'hips')??first(srcSem,'root'),targetHips=first(dstSem,'hips')??first(dstSem,'root');
  // NativeRig uses world Z as vertical. Anatomical hip-to-head tilt must not
  // leak horizontal displacement into the in-place preview.
  const pose=motion.createPoseBuffer(),skin=Array.from({length:rig.count},identity4),world=Array.from({length:rig.count},identity4),deltas=Array.from({length:rig.count},()=>[0,0,0,1]),positions=restP.map(x=>x.slice()),up=[0,0,1];
  const srcRestQ=motion.rest.worldRotations;
  const alignedDelta=(source,current)=>qNormalize(qMultiply(qMultiply(alignment,qMultiply(current[source],qInverse(srcRestQ[source]))),inverseAlignment));
  const diagnostics={sourceUrl:motion.sourceUrl,sourceBoneCount:motion.jointIndices.length,sourceNodeCount:motion.nodes.length,targetBoneCount:rig.count,mappedBones:mapped.length,mapping:mapped,missingRequired:missing,unmappedTargetBones:rig.names.filter((_,i)=>!descriptors[i]),alignmentQuaternion:alignment,translationScale:scale,bindDirectionsAligned:options.alignBindDirections!==false,rootMode:options.rootMode||'inPlace',limitations:['Rotation retargeting only; no collision or contact solver is claimed.','Unmapped helper/twist/face bones inherit parent rigid motion.','No external character mesh is instantiated.','Foot sliding present in the source is not automatically repaired.']};
  function apply(time,playOptions={}){
    motion.sampleInto(time,pose,{clip:playOptions.clip??options.clip??0,loop:playOptions.loop??options.loop??true});
    const strength=clamp(playOptions.strength??options.strength??1,0,1);
    let translation=sourceHips===undefined?[0,0,0]:vScale(qRotate(alignment,vSub(pose.worldPositions[sourceHips],motion.rest.worldPositions[sourceHips])),scale);
    const rootMode=playOptions.rootMode??(playOptions.rootMotion===undefined?undefined:playOptions.rootMotion?'full':'inPlace')??options.rootMode??'inPlace';if(rootMode==='inPlace')translation=vScale(up,vDot(translation,up));else if(rootMode==='locked')translation=[0,0,0];
    translation=vScale(translation,strength);
    if(playOptions.translation)translation=vAdd(translation,playOptions.translation);
    for(const j of rig.order){const d=descriptors[j],parent=rig.parents[j];if(d){let delta=alignedDelta(d.source,pose.worldRotations);if(d.sourceB!==d.source)delta=qSlerp(delta,alignedDelta(d.sourceB,pose.worldRotations),d.blend);deltas[j]=qSlerp([0,0,0,1],qNormalize(qMultiply(delta,correction[j])),strength);}else deltas[j]=parent>=0?deltas[parent].slice():[0,0,0,1];
      positions[j]=parent<0?vAdd(restP[j],translation):vAdd(positions[parent],qRotate(deltas[parent],vSub(restP[j],restP[parent])));
      world[j]=qToMatrix(qNormalize(qMultiply(deltas[j],restQ[j])),positions[j]);multiply4(world[j],inverseRest[j],skin[j]);
    }
    rig.applySkinMatrices(skin);rig.metrics={...rig.metrics,retargetSource:motion.sourceUrl,retargetTime:pose.time,mappedBones:mapped.length,rootMode};
    return {skinMatrices:rig.skinMatrices,posedMatrices:rig.posedMatrices,sourcePose:pose,time:pose.time,source:motion.sourceUrl,mapping:mapped};
  }
  return {apply,mapping:mapped,diagnostics,sourceSemantics:srcSem,targetSemantics:dstSem,alignmentQuaternion:alignment,scale,sourcePose:pose};
}

export function describeBoneSemantics(names,parents){const order=[];const seen=new Set();while(order.length<names.length){let added=0;for(let i=0;i<names.length;i++)if(!seen.has(i)&&(parents[i]<0||seen.has(parents[i]))){order.push(i);seen.add(i);added++;}if(!added)throw Error('Invalid skeleton hierarchy');}return [...semantics(names,order)].map(([semantic,indices])=>({semantic,bones:indices.map(i=>({index:i,name:names[i]}))}));}

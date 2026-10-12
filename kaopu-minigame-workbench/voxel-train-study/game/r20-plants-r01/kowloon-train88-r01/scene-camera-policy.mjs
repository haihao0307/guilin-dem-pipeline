// Same-world observation only. No simulation distance, actor, or model mutation.
export function sceneCameraLimits(bounds,base){
 if(!bounds||!['min','max'].every(k=>Array.isArray(bounds[k])&&bounds[k].length===3&&bounds[k].every(Number.isFinite))||bounds.min.some((v,i)=>v>=bounds.max[i]))throw Error('Finite scene bounds required');
 const radius=Math.hypot(...bounds.max.map((v,i)=>v-bounds.min[i]));
 return {...base,minRadius:.8,maxRadius:Math.max(base.maxRadius,radius*1.5),minHeight:.25,minTargetHeight:.25,maxTargetHeight:bounds.max[1]+12,minTargetX:bounds.min[0]-30,maxTargetX:bounds.max[0]+30,minTargetZ:bounds.min[2]-30,maxTargetZ:bounds.max[2]+30,maxPhi:Math.PI-.12};
}
export function sceneCameraFrame({eye,target,cut=false,name,bounds},base){
 if(![eye,target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))throw Error('Finite perspective frame required');
 return {position:eye.slice(),target:target.slice(),zoom:1,manual:true,locked:false,focus:'scene',presetId:'scene:'+name,projection:{kind:'horizontal',referenceAspect:16/9},sceneName:name,cut:!!cut,focusBounds:structuredClone(bounds),limits:sceneCameraLimits(bounds,base)};
}

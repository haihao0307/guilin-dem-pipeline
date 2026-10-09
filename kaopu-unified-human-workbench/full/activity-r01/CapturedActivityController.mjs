import{NativeWalkRetarget}from'./NativeWalkRetarget.mjs';
import{NativeCapturedRetarget}from'./NativeCapturedRetarget.mjs';
/** Reuse the currently displayed full AnimatedHuman. No DOM, scene, camera,
 * model recomputation or additional mesh. Coordinates remain native Z-up. */
export function createCapturedActivityController(human,source){
 const solePoints={L:[],R:[]},soleIndices={L:[],R:[]};
 for(let v=0;v<human.N;v++){
  if(human.positions[v*3+2]+human.floorOffset>human.height*.14)continue;
  for(const S of['L','R']){let weight=0;for(let n=0;n<human.range[v*2+1];n++){const k=(human.range[v*2]+n)*8,name=human.names[human.packed[k+3]];if(/^(foot|toe)/.test(name)&&name.endsWith('.'+S))weight+=human.packed[k+4];}if(weight>.5){solePoints[S].push(Array.from(human.positions.slice(v*3,v*3+3)));soleIndices[S].push(v);}}
 }
 if(solePoints.L.length<8||solePoints.R.length<8)throw Error('Actual full-character sole calibration missing');
 const Retarget=source.schema==='cmu16-33-source-positions/1'?NativeWalkRetarget:NativeCapturedRetarget;
 const motion=new Retarget({names:human.names,parents:human.rig.parents,restMatrices:human.rig.restMatrices,stature:human.height,floorOffset:human.floorOffset,solePoints},source);let latest=null;
 return{human,motion,source,soleIndices,duration:motion.duration,get latest(){return latest;},evaluate(seconds){latest=motion.evaluate(seconds);return latest;},update(seconds){latest=motion.evaluate(seconds);human.animate(latest.skinMatrices);return latest;},reset(){motion.reset();latest=null;},report(){return{source:source.clip||'16_33',label:source.label||'slow walk, stop',frames:source.points.length,fps:source.fps,nativeBones:human.names.length,vertices:human.N,loop:false,quality:'numerical candidate; integrated visual review required',teacherWeightsRun:false};}};
}

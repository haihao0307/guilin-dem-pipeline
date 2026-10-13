import assert from 'node:assert/strict';
import * as old from '../../kaopu-unified-human-workbench/skin-folds-r01/FoldMath.mjs';
import * as next from '../../kaopu-unified-human-workbench/skin-folds-r02/FoldMath.mjs';
import {installFoldProfile} from '../../kaopu-unified-human-workbench/skin-folds-r02/FoldProfile.mjs';
const max={...next.DEFAULTS,strength:1.5,slack:1,compression:1,eyes:1,nasolabial:1,cheeks:1,sag:1};
const records=[];function test(name,fn){const data=fn();records.push({name,pass:true,data});console.log('PASS',name,JSON.stringify(data));}
test('finite protected-boundary step removed in all 3 displacement components',()=>{
 const samples=[];
 for(const [cx,cy,rx,ry] of [[0,232,27.8,15.2],[-31,301,18.2,8.4],[31,301,18.2,8.4]]){
  let oldMax=0,newMax=0;
  for(let i=0;i<360;i++){
   const a=i*Math.PI/180,d=.00001,at=(r,fn)=>fn(cx+rx*r*Math.cos(a),cy+ry*r*Math.sin(a),max);
   const jump=fn=>Math.hypot(...at(1+d,fn).map((x,k)=>x-at(1-d,fn)[k]));
   oldMax=Math.max(oldMax,jump(old.foldAt));newMax=Math.max(newMax,jump(next.foldAt));
  }
  assert(newMax<.0000001);samples.push({center:[cx,cy],oldMaxStepMM:oldMax,newMaxStepMM:newMax});
 }
 assert(samples[0].oldMaxStepMM>.1);return samples;
});
test('C2 protection exactly zero inside, with zero slope at support edge',()=>{
 assert.equal(next.boundaryWeight(0,232),0);assert.equal(next.boundaryWeight(27.8,232),0);
 const d=.001,v=next.boundaryWeight(27.8+d,232);assert(v/d<.00001);
 assert(next.boundaryWeight(40,245)>.8);return{oneMicronOutsideWeight:v};
});
test('single cheek shoulder has retained relief, shallower valley, lower slope and broader half height',()=>{
 const stats=fn=>{const values=[];let lo=0,hi=0,slope=0,integral=0,last=fn(-100);
  for(let x=-99.995;x<=100;x+=.005){let v=fn(x);lo=Math.min(lo,v);hi=Math.max(hi,v);slope=Math.max(slope,Math.abs(v-last)/.005);integral+=v*.005;values.push([x,v]);last=v;}
  const band=values.filter(([x,v])=>x>0&&v>hi*.5);return{lo,hi,slope,integral,outerHalfHeightWidth:band.at(-1)[0]-band[0][0]};};
 const a=stats(x=>old.roll(x,2.65,1)*.94),b=stats(x=>next.cheekRoll(x,3.8,1)*.76);
 assert(b.hi>a.hi*.70);assert(b.lo>a.lo);assert(b.slope<a.slope*.60);assert(b.outerHalfHeightWidth>a.outerHalfHeightWidth*1.4);assert(Math.abs(b.integral)<1e-6);return{old:a,next:b};
});
test('safe geometric limits for all scalar extremes; zero amount is exact',()=>{
 let maximum=0;
 for(let y=180;y<400;y+=1.25)for(let x=-90;x<90;x+=1.25){const a=next.foldAt(x,y,max);assert(a.every(Number.isFinite));assert(a[0]>=-.48&&a[0]<=1.35);assert(a[1]>=-.7&&a[1]<=.7);assert(a[2]>=-1.8&&a[2]<=.7);maximum=Math.max(maximum,Math.hypot(...a));assert.deepEqual(next.foldAt(x,y,{...max,strength:0}),[0,0,0]);}
 return{maximumDeltaMM:maximum};
});
test('v1 archive imports values, exports explicit v2 and rejects bad state atomically',()=>{
 const model={archive:()=>({tag:'test'}),restore:x=>x};const api=installFoldProfile(model);
 model.restore({geometricSkinFolds:{schema:'kaopu/geometric-skin-folds@1',settings:{...next.DEFAULTS,strength:.9}}});
 assert.equal(api.settings.strength,.9);assert.equal(model.archive().geometricSkinFolds.schema,'kaopu/geometric-skin-folds@2');
 const prior=JSON.stringify(model.archive());assert.throws(()=>model.restore({geometricSkinFolds:{schema:'kaopu/geometric-skin-folds@2',settings:{strength:NaN}}}));assert.equal(JSON.stringify(model.archive()),prior);
 return{legacyScalarValuesMigrated:true,exactLegacyAppearanceClaimed:false};
});
console.log(JSON.stringify({checks:records.length,records,completed:true},null,2));

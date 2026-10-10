import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// Exercise the candidate's actual lifecycle methods with controllable build
// promises. Do not import or retrieve PerimeterStudio or any model assets.
// The DOM and viewer are boundary doubles; this is not browser/rendering QA.
const originalSource=await readFile(new URL('../full/motion-studio/MotionStudio.mjs',import.meta.url),'utf8');
const lifecycleSource=originalSource.split('\n').filter(line=>!line.startsWith('import ')).join('\n')
 .replace('export class MotionStudio','class MotionStudio')
 .replaceAll('import.meta.url',JSON.stringify('https://example.test/MotionStudio.mjs'));

function fixture(){
 const nodes=new Map(),classes=new Set(),builds=[];
 const $=id=>{
  if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,inert:false,value:id==='motion-focus'?'perimeter':'',attributes:{},setAttribute(key,value){this.attributes[key]=value;}});
  return nodes.get(id);
 };
 const viewer={mesh:{visible:true},camera:{far:50,updateProjectionMatrix(){}},scene:{remove(){},updateMatrixWorld(){}},resize(){},view(){},update(){},render(){}};
 const context=vm.createContext({
  performance,AbortController,cancelAnimationFrame(){},
  document:{getElementById:$,body:{classList:{remove:name=>classes.delete(name),toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);}}}},
  createPerimeterStudio:options=>new Promise((resolve,reject)=>builds.push({...options,resolve,reject}))
 });
 vm.runInContext(lifecycleSource+'\nthis.TestMotionStudio=MotionStudio;',context);
 const studio=Object.create(context.TestMotionStudio.prototype);
 Object.assign(studio,{viewer,controller:{state:()=>({anny:{},owners:{rig:'anny'}}),model:{},defaults:{}},host:{remove(){}},$,
  mode:'shape',time:0,speed:1,playing:false,modeBusy:false,angle:'three',actors:[],errors:[],samples:[],revision:0,destroyed:false,
  activitySources:{},activityClip:'walk',root:{children:[],remove(){}},backlog:0,previous:performance.now()});
 return {studio,builds,$};
}

function crowd(name){
 return {name,actors:[],duration:10,disposeCount:0,resetCount:0,viewCount:0,
  dispose(){this.disposeCount++;},reset(){this.resetCount++;},view(){this.viewCount++;}};
}

function assertBuilding({studio,$}){
 assert.equal(studio.mode,'perimeter');
 assert.equal(studio.modeBusy,true,'a pending current build must remain busy');
 assert.equal($('control-shell').inert,true,'old completion must not unlock current controls');
 assert.equal($('motion-mode').disabled,true);
 for(const id of ['play','reset','step'])assert.equal($('motion-'+id).disabled,true);
}

async function cancelledThenNew(){
 const f=fixture();
 // Install a rejection handler before deliberately rejecting the old build.
 const old=f.studio.setMode('perimeter').then(()=>({resolved:true}),error=>({error}));
 await f.studio.setMode('shape');
 assert.equal(f.builds[0].signal.aborted,true);
 const next=f.studio.setMode('perimeter');
 assert.equal(f.builds.length,2);
 assertBuilding(f);
 return {...f,old,next};
}

test('current perimeter build still reports progress, becomes ready and disposes on exit',async()=>{
 const f=fixture(),pending=f.studio.setMode('perimeter'),current=crowd('current');
 assertBuilding(f);
 f.builds[0].onProgress('current build 1/39');
 assert.equal(f.$('motion-status').textContent,'current build 1/39');
 f.builds[0].resolve(current);await pending;
 assert.equal(f.studio.crowd,current);
 assert.equal(f.studio.modeBusy,false);
 assert.equal(f.$('control-shell').inert,false);
 assert.equal(f.$('motion-play').disabled,false);
 assert.equal(current.resetCount,1);
 assert.equal(current.viewCount,1);
 await f.studio.setMode('shape');
 assert.equal(current.disposeCount,1);
 assert.equal(f.studio.crowd,null);
 assert.equal(f.studio.viewer.mesh.visible,true);
});

test('cancelled old rejection cannot unlock a newer pending perimeter build',async()=>{
 const f=await cancelledThenNew();
 f.builds[0].reject(Error('old build aborted late'));
 assert.match((await f.old).error.message,/aborted late/);
 assertBuilding(f);
 const current=crowd('current');f.builds[1].resolve(current);await f.next;
 assert.equal(f.studio.crowd,current);
 assert.equal(f.studio.modeBusy,false);
});

test('cancelled old resolution is disposed without unlocking a newer pending build',async()=>{
 const f=await cancelledThenNew(),stale=crowd('stale');
 f.builds[0].resolve(stale);await f.old;
 assert.equal(stale.disposeCount,1);
 assert.equal(f.studio.crowd,null,'a stale result must not be assigned as current');
 assertBuilding(f);
 const current=crowd('current');f.builds[1].resolve(current);await f.next;
 assert.equal(f.studio.crowd,current);
 assert.equal(current.disposeCount,0);
});

test('cancelled old resolution cannot overwrite or dispose a newer ready crowd',async()=>{
 const f=await cancelledThenNew(),current=crowd('current'),stale=crowd('stale');
 f.builds[1].resolve(current);await f.next;
 assert.equal(f.studio.crowd,current);
 f.builds[0].resolve(stale);await f.old;
 assert.equal(stale.disposeCount,1);
 assert.equal(current.disposeCount,0);
 assert.equal(f.studio.crowd,current,'late assignment must not lose the live crowd');
 assert.equal(f.studio.modeBusy,false);
 assert.equal(f.$('motion-play').disabled,false);
});

test('cancelled old progress cannot replace current build or ready status',async()=>{
 const f=await cancelledThenNew();
 f.builds[1].onProgress('current build 20/39');
 f.builds[0].onProgress('stale build 1/39');
 assert.equal(f.$('motion-status').textContent,'current build 20/39');
 f.builds[1].resolve(crowd('current'));await f.next;
 const readyMessage=f.$('motion-status').textContent;
 f.builds[0].onProgress('stale build 39/39');
 assert.equal(f.$('motion-status').textContent,readyMessage);
 f.builds[0].resolve(crowd('stale'));await f.old;
});

test('cancelled build cannot write progress after returning to shape',async()=>{
 const f=fixture(),pending=f.studio.setMode('perimeter');
 await f.studio.setMode('shape');
 const shapeMessage=f.$('motion-status').textContent;
 f.builds[0].onProgress('stale after cancel');
 assert.equal(f.$('motion-status').textContent,shapeMessage);
 f.builds[0].resolve(crowd('stale'));await pending;
 assert.equal(f.studio.mode,'shape');
 assert.equal(f.studio.modeBusy,false);
 assert.equal(f.$('motion-play').disabled,true);
});

test('disposed studio ignores late build progress and disposes the late result',async()=>{
 const f=fixture(),pending=f.studio.setMode('perimeter'),late=crowd('late');
 f.studio.dispose();
 const previousMessage=f.$('motion-status').textContent;
 f.builds[0].onProgress('late after dispose');
 assert.equal(f.$('motion-status').textContent,previousMessage);
 f.builds[0].resolve(late);await pending;
 assert.equal(late.disposeCount,1);
 assert.equal(f.studio.crowd,null);
 assert.equal(f.studio.viewer.mesh.visible,true);
});

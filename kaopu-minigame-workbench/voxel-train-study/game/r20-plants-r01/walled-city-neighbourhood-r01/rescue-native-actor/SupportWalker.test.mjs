import test from 'node:test';import assert from 'node:assert/strict';
import {createSupportWalker,nativeToWorld,worldToNative} from './SupportWalker.mjs';
import {makeBuildingRecipe} from '../building-plan.mjs';
import {makeRescueContract} from '../rescue-contract.mjs';
import {createCityRescueGame,makeRescueSupportSampler} from '../rescue-gameplay.mjs';
const matrix=p=>Float64Array.from([1,0,0,p[0],0,1,0,p[1],0,0,1,p[2],0,0,0,1]);
function syntheticFixture(){
  const names=[],parents=[],rest=[];function bone(name,parent,p){names.push(name);parents.push(parent==null?-1:names.indexOf(parent));rest.push(matrix(p));}
  bone('root',null,[0,0,1]);bone('head','root',[0,0,1.7]);
  for(const S of ['L','R']){const sign=S==='L'?1:-1;bone('upperleg01.'+S,'root',[sign*.1,0,.94]);bone('lowerleg01.'+S,'upperleg01.'+S,[sign*.1,-.04,.52]);bone('foot.'+S,'lowerleg01.'+S,[sign*.1,0,.10]);bone('upperarm01.'+S,'root',[sign*.2,0,1.4]);bone('lowerarm01.'+S,'upperarm01.'+S,[sign*.4,0,1.15]);bone('wrist.'+S,'lowerarm01.'+S,[sign*.5,0,1]);for(let f=1;f<=5;f++)bone(`finger${f}-1.${S}`,'wrist.'+S,[sign*(.51+(f-3)*.015),-.075,1]);}
  while(names.length<104)bone('test-helper-'+names.length,'root',[0,0,1]);
  const sole=[[-.1,-.04,0],[-.1,.04,0],[.1,-.04,0],[.1,.04,0]],human={height:1.8,floorOffset:0,names,rig:{parents,restMatrices:rest},animate(){},sampleVertex:i=>sole[i]};
  const standingFrame={posedMatrices:rest,skinMatrices:rest.map(()=>matrix([0,0,0])),rootTranslation:[0,0,0]};return{human,standingFrame,soleIndices:{L:[2,3],R:[0,1]}};
}
const actor=(position,moving=true)=>({id:'crew',position,direction:[0,0,1],moving,pose:moving?'walk':'stand'});
const flat=({x,z})=>({y:0,normal:[0,1,0],supportId:'flat',sampledAt:[x,z]});
test('native/game basis is exactly invertible with one axis conversion',()=>{const p=[.3,-.6,.7],r=[4,3,2];const q=worldToNative(nativeToWorld(p,r,.8,.5),r,.8,.5);q.forEach((x,i)=>assert(Math.abs(x-p[i])<1e-12));});
test('synthetic 104-bone unit fixture: continuous distance gait, held stance and finite bones',()=>{const w=createSupportWalker({...syntheticFixture(),sampleSupport:flat});let swings=0,stance=0,previous={};for(let i=0;i<=600;i++){const f=w.evaluate({elapsed:i/120,actor:actor([0,0,i/120*.45])});assert(f.metrics.maxBoneLengthError<1e-8);assert(f.metrics.maxReachError<.025);for(const S of ['L','R']){const foot=f.footContacts[S];if(!foot.planted)swings++;else{stance++;if(previous[S]?.planted)assert.deepEqual(foot.worldSole,previous[S].worldSole);}previous[S]=structuredClone(foot);}}assert(swings>100&&stance>100);assert(w.report().distanceM>2);});
test('synthetic fixture: an interrupted step settles using only host time',()=>{const w=createSupportWalker({...syntheticFixture(),sampleSupport:flat});let f;for(let i=0;i<=150;i++)f=w.evaluate({elapsed:i/120,actor:actor([0,0,i/120*.45])});for(let i=151;i<=220;i++)f=w.evaluate({elapsed:i/120,actor:actor([0,0,150/120*.45],false)});assert(Object.values(f.footContacts).every(x=>x.planted));});
test('missing support and oversized path jumps fail instead of faking floor',()=>{const w=createSupportWalker({...syntheticFixture(),sampleSupport:()=>null});assert.throws(()=>w.evaluate({elapsed:0,actor:actor([0,0,0])}),/no real support/);const x=createSupportWalker({...syntheticFixture(),sampleSupport:flat});x.evaluate({elapsed:0,actor:actor([0,0,0])});assert.throws(()=>x.evaluate({elapsed:1,actor:actor([0,0,5])}),/skipped too far/);});

test('synthetic skeleton traverses actual complete rescue paths and floor/tread sampler',()=>{
 const contract=makeRescueContract(makeBuildingRecipe()),game=createCityRescueGame({contract}),sampleSupport=makeRescueSupportSampler(contract),walkers=Object.fromEntries(game.snapshot().actors.map(a=>[a.id,createSupportWalker({...syntheticFixture(),sampleSupport})]));
 let host=0,frames=0;const update=()=>{const snapshot=game.update(host);for(const a of snapshot.actors){try{walkers[a.id].evaluate({elapsed:host,actor:a});}catch(error){throw Error(a.id+' @ '+host.toFixed(3)+' '+JSON.stringify(a)+': '+error.message);}frames++;}return snapshot;};update();game.command({type:'start'});
 for(const action of game.initialSolution){if(game.snapshot().rope.state==='deployed'){game.command({type:'recover'});const end=game.snapshot().operation.end;while(host<end){host=Math.min(end,host+1/120);update();}}const result=game.command({type:'rescue',...action});assert(result.accepted,JSON.stringify(result));const end=game.snapshot().operation.end;while(host<end){host=Math.min(end,host+1/120);update();}}
 assert.equal(game.snapshot().status,'succeeded');assert(frames>1000);
});

test('explicit locomotion reset accepts declared retry/rewind and forgets old supports',()=>{const w=createSupportWalker({...syntheticFixture(),sampleSupport:flat});w.evaluate({elapsed:4,actor:actor([0,0,0])});w.evaluate({elapsed:4.05,actor:actor([0,0,.06])});assert.throws(()=>w.evaluate({elapsed:0,actor:actor([5,0,0],false)}),/rewind/);w.reset();const f=w.evaluate({elapsed:0,actor:actor([5,0,0],false)});assert.equal(w.report().distanceM,0);assert(Object.values(f.footContacts).every(x=>x.planted&&Math.abs(x.worldSole[0]-5)<.2));});
test('synthetic skeleton completes upper-first borrowed-gate route at maximum 50ms host substeps',()=>{
 const contract=makeRescueContract(makeBuildingRecipe()),game=createCityRescueGame({contract}),sampleSupport=makeRescueSupportSampler(contract),walkers=Object.fromEntries(game.snapshot().actors.map(a=>[a.id,createSupportWalker({...syntheticFixture(),sampleSupport})]));
 let host=0,frames=0;const update=()=>{const snapshot=game.update(host);for(const a of snapshot.actors){try{const frame=walkers[a.id].evaluate({elapsed:host,actor:a});assert(frame.metrics.maxBoneLengthError<1e-8);}catch(error){throw Error(a.id+' @ '+host.toFixed(3)+': '+error.message);}frames++;}return snapshot;};update();game.command({type:'start'});
 for(const action of [{personId:'west-neighbour',anchorId:'landing-8',mode:'stairs'},{personId:'east-neighbour',anchorId:'W7-home',mode:'borrowed'}]){if(game.snapshot().rope.state==='deployed'){game.command({type:'recover'});const end=game.snapshot().operation.end;while(host<end){host=Math.min(end,host+.05);update();}}assert(game.command({type:'rescue',...action}).accepted);const end=game.snapshot().operation.end;while(host<end){host=Math.min(end,host+.05);update();}}
 assert.equal(game.snapshot().status,'succeeded');assert(frames>3000);
});

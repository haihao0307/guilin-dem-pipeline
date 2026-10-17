import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {IDENTITY,BASIS,legacyVector,assemblyVector,legacyPoint,renderedPoint,sessionFrame,
  multiply,renderMatrix,wheelKinematics,jointReport,buildingRule,facadeAttachment,
  sweptStraightBox,TickCrossing,validateSensors} from '../adapter.mjs';
const I=[...IDENTITY],move=(x,y,z)=>{const m=[...I];m[12]=x;m[13]=y;m[14]=z;return m;};
const near=(a,b,e=1e-9)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const vectorNear=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
const sensor={powered:true,roadClear:true,request:true,occupied:false,reset:false};
const rule={kind:'axle-revolute',anchorA:[0,0,0],anchorB:[0,0,0],axisA:[1,0,0],axisB:[1,0,0],toleranceMetres:.001,toleranceRadians:.001};
test('R01 source remains byte-identical to the uploaded Git blob',()=>{
  const b=readFileSync(new URL('../source/assembly_rules.mjs',import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),'a005814165bd80895cf57ca9e3623bb6f87abd68');
});
test('proper rotation; no X/Z reflection and inverse is exact',()=>{
  vectorNear(legacyVector([1,0,0]),[0,0,1]);vectorNear(legacyVector([0,0,1]),[-1,0,0]);
  vectorNear(assemblyVector(legacyVector([3,4,5])),[3,4,5]);
  const m=BASIS;near(m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]),1);
});
test('world, train-local and floating render origins are distinct',()=>{
  const v={distance:105,frontX:5};vectorNear(legacyPoint([2,3,4],{...v,frame:'train'}),[-4,3,102]);
  vectorNear(legacyPoint([102,3,4],{...v,frame:'world'}),[-4,3,102]);
  vectorNear(renderedPoint([-4,3,102],v),[2,3,4]);
  const m=renderMatrix(move(2,3,4),v);vectorNear(m.slice(12,15),[-4,3,102]);
  assert.throws(()=>legacyPoint([1,2,3],{...v}),/explicit/);
});
test('tick-derived world time rejects clock drift and never uses timetable',()=>{
  const view={version:1,tick:90,elapsed:3,distance:20,velocity:2,actors:[],timetable:{minutes:9999}};
  near(sessionFrame(view,{tickHz:30,frontX:5}).worldTime,3);
  assert.throws(()=>sessionFrame({...view,elapsed:100},{tickHz:30,frontX:5}),/clock/);
});
test('invalid numeric transforms cannot pass as valid attachments',()=>{
  const bad=[...I];bad[0]=NaN;assert.throws(()=>multiply(bad,I),/finite/);
  const singular=[...I];singular[0]=0;assert.throws(()=>renderMatrix(singular,{distance:0,frontX:5}),/singular/);
  assert.throws(()=>jointReport(I,I,{...rule,anchorA:[NaN,0,0]}),/finite/);
});
test('crank parameter vs actual +X rotation sign and constant rod length',()=>{
  for(let i=0;i<100;i++){
    const k=wheelKinematics({distance:i/7,radius:.61,phase:Math.PI/2,rotationSign:-1,crankRadius:.25,rodLength:2.6});
    near(k.rotationAboutX,-(k.crankParameterAngle+k.phase));near(Math.hypot(k.slider-k.pin[2],k.pin[1]),2.6);
  }
  assert.throws(()=>wheelKinematics({distance:1,radius:.61,phase:0}),/direction/);
  assert.throws(()=>wheelKinematics({distance:1,radius:.61,phase:0,rotationSign:-1,crankRadius:.5,rodLength:.3}),/Rod length/);
});
test('coincident points alone do not establish an axle joint',()=>{
  assert(jointReport(I,I,rule).anchorAndAxisValid);
  assert(!jointReport(I,I,{...rule,axisB:[0,1,0]}).anchorAndAxisValid);
  assert(!jointReport(I,move(0,.1,0),rule).anchorAndAxisValid);
  const r=jointReport(I,I,rule);assert.equal(r.physicsSolved,false);assert.equal(r.fullOrientationVerified,false);
});
test('prismatic guide allows only declared axis translation and travel',()=>{
  const r={...rule,kind:'axlebox-prismatic',limits:[-.2,.2]};
  assert(jointReport(I,move(.1,0,0),r).anchorAndAxisValid);
  assert(!jointReport(I,move(.3,0,0),r).anchorAndAxisValid);
  assert(!jointReport(I,move(.1,.01,0),r).anchorAndAxisValid);
  assert.throws(()=>jointReport(I,I,{...r,limits:null}),/limits/);
});
test('contact normals use inverse-transpose; spring remains unresolved',()=>{
  const scaled=[...I];scaled[0]=2;
  const r=jointReport(scaled,I,{...rule,normalA:[1,1,0],normalB:[-.5,-1,0]});near(r.contactNormalError,0,1e-7);
  assert.equal(r.contactAreaVerified,false);
  assert(jointReport(I,I,{...rule,kind:'spring-hanger'}).springModelRequired);
  assert(!jointReport(I,I,{...rule,kind:'spring-hanger'}).anchorAndAxisValid);
});
test('opposing facades, stable floor/bay anchors and finite inputs',()=>{
  for(const side of [-1,1]){
    const h={id:'building-'+side,floors:4,bays:3,floorHeight:3,bayWidth:2,side,frontX:side*3};
    const a=facadeAttachment(h,{floor:2,bay:1,localOffset:[.2,.1,.3]});
    vectorNear(a.normal,[-side,0,0]);vectorNear(a.point,[side*2.7,7.6,.2]);assert.equal(a.hostFacade,h.id);
    assert.throws(()=>facadeAttachment(h,{floor:4,bay:0,localOffset:[0,0,0]}),/outside/);
  }
  assert.throws(()=>facadeAttachment({id:'bad',frontX:NaN},{floor:0,bay:0,localOffset:[0,0,0]}),/finite/);
});
test('straight swept clearance checks rail and camera boxes independently',()=>{
  const sweep=sweptStraightBox({min:[-1,0,-5],max:[1,4,5]},[0,0,10]);assert.deepEqual(sweep.max,[1,4,15]);
  const p={side:1,z:4,width:8,depth:5,height:15,railHalfWidth:1,clearance:1,railVolumes:[sweep]};
  assert(buildingRule(p).clear);
  const bad=buildingRule({...p,cameraVolumes:[{min:[2,0,0],max:[4,5,8]}]});assert(!bad.clear);assert.deepEqual(bad.cameraConflicts,[0]);
  assert(!buildingRule({...p,railVolumes:[{min:[-3,0,-5],max:[3,4,15]}]}).clear);
  assert.throws(()=>buildingRule({...p,width:NaN}),/finite/);
});
test('crossing refuses missing detectors, strings and missing tick history',()=>{
  const c=new TickCrossing({tickHz:30});assert.equal(c.outputs().roadProceed,false);
  assert.throws(()=>validateSensors({...sensor,powered:'true'}),/boolean/);
  assert.throws(()=>new TickCrossing({tickHz:30,warningSeconds:Infinity}),/finite/);
  c.consume(0,sensor);assert.throws(()=>c.consume(2,sensor),/history/);
  const s=c.save();c.consume(0,sensor);assert.deepEqual(c.save(),s);
  assert.throws(()=>c.consume(0,{...sensor,request:false}),/without/);
});
test('crossing entry, release, power failure, save and tamper rejection',()=>{
  const c=new TickCrossing({tickHz:30});for(let i=0;i<=180;i++)c.consume(i,sensor);
  assert.equal(c.state.phase,'CLOSED');assert(c.outputs().railProceed);assert(!c.outputs().roadProceed);
  const copy=TickCrossing.restore(JSON.parse(JSON.stringify(c.save())));assert.deepEqual(copy.outputs(),c.outputs());
  c.consume(181,{...sensor,occupied:true});assert.equal(c.state.phase,'TRAIN_IN');
  for(let i=182;i<=302;i++)c.consume(i,{...sensor,request:false});assert.equal(c.state.phase,'OPEN');
  c.consume(303,{...sensor,powered:false});assert(c.outputs().fault);assert(!c.outputs().railProceed&&!c.outputs().roadProceed);
  assert(!c.outputs().redLampLeft&&!c.outputs().redLampRight);
  const tampered=copy.save();tampered.state.gate=.5;assert.throws(()=>TickCrossing.restore(tampered),/inconsistent/);
});
test('all tick outputs forbid simultaneous road and rail permission',()=>{
  const c=new TickCrossing({tickHz:30});
  for(let tick=0;tick<1200;tick++){
    const input={...sensor,occupied:tick>=200&&tick<400,request:tick<400,roadClear:tick!==600,reset:tick===650};
    const o=c.consume(tick,input);assert(!(o.roadProceed&&o.railProceed));near(c.state.worldTime,tick/30);
  }
});

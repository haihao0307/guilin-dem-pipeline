/**
 * TEST_FIXTURE_ONLY: tests semantic decisions, navigation and transactions.
 * Fake executor acknowledgements below do NOT establish rendered skin contact,
 * animation quality, body collision, browser performance or public delivery.
 */
import assert from 'node:assert/strict';
import {LifeSimulation,LIFE_LOCATIONS} from './LifeSimulation.mjs';

const results=[];
let navigationRegression=null;
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
function one(seed=711){const initial=new LifeSimulation({seed});return new LifeSimulation({seed,actors:[initial.actorTemplate[0]]});}
function advance(sim,seconds,{ack=true,onStep=null}={}){
  const count=Math.ceil(seconds/.05);
  for(let i=0;i<count;i++){
    sim.update(.05);
    if(ack)for(const a of sim.actors)if(a.task?.waitForAcknowledgement&&a.task.progress>=.999){
      const result=sim.acknowledgeInteraction(a.id,true,{token:a.task.token,evidence:{TEST_FIXTURE_ONLY:true,rendererContactVerified:false}});
      assert.equal(result.accepted,true,'Fixture ack rejected');
    }
    assert.deepEqual(sim.checkInvariants(),{ok:true,errors:[]});
    if(onStep)onStep(sim);
  }
}
function until(sim,predicate,limit=100,{ack=true}={}){
  for(let i=0;i<limit*20;i++){
    if(predicate(sim))return;
    advance(sim,.05,{ack});
  }
  assert.ok(predicate(sim),'Condition did not occur within '+limit+' simulated seconds');
}

test('same seed and inputs reproduce choices, trajectories and ownership',()=>{
  const first=new LifeSimulation({seed:1234}),second=new LifeSimulation({seed:1234});
  advance(first,150);advance(second,150);
  assert.deepEqual(first.snapshot(),second.snapshot());
  assert.ok(first.events.some(e=>e.type==='decision'));
});

test('hunger and fatigue produce different eligible priorities',()=>{
  const sim=one(),a=sim.actors[0];a.money=4;a.needs.hunger=.92;a.needs.fatigue=.05;
  assert.equal(sim.getCandidates(a.id)[0].kind,'buy');
  a.needs.hunger=.05;a.needs.fatigue=.95;
  assert.equal(sim.getCandidates(a.id)[0].kind,'rest');
  sim.setShopOpen(false);a.needs.hunger=.95;
  assert.ok(sim.getCandidates(a.id).every(c=>c.kind!=='buy'));
});

test('elapsed animation time cannot commit a pickup without executor acknowledgement',()=>{
  const sim=one(),a=sim.actors[0];a.money=0;a.needs.hunger=.9;a.needs.fatigue=.02;
  until(sim,()=>a.task?.kind==='collect'&&a.task.phase==='interact',40,{ack:false});
  const id=a.task.targetId,token=a.task.token;
  advance(sim,8,{ack:false});
  assert.equal(a.task.progress,1);assert.equal(sim.bottle(id).state,'ground');assert.equal(a.inventory.bottles.length,0);
  assert.equal(sim.acknowledgeInteraction(a.id,true,{token:'wrong-token'}).accepted,false);
  const result=sim.acknowledgeInteraction(a.id,true,{token,evidence:{TEST_FIXTURE_ONLY:true}});
  assert.equal(result.committed,true);assert.equal(sim.bottle(id).owner,a.id);assert.equal(a.inventory.bottles.length,1);
  assert.equal(sim.acknowledgeInteraction(a.id,true,{token}).accepted,false);
  assert.equal(a.inventory.bottles.length,1);
});

test('two people cannot reserve or acquire the same bottle',()=>{
  const sim=new LifeSimulation({seed:8});
  for(const b of sim.bottles.slice(1))sim.removeBottle(b.id);
  sim.actors[0].x=-1.8;sim.actors[0].z=1;
  sim.actors[1].x=-.2;sim.actors[1].z=1;
  for(const a of sim.actors){a.money=0;a.needs.hunger=.88;a.needs.fatigue=.02;}
  sim.update(.05);
  const b=sim.bottles[0];assert.ok(b.reservedBy);
  const other=sim.actors.find(a=>a.id!==b.reservedBy);
  assert.ok(sim.getCandidates(other.id).every(c=>c.targetId!==b.id));
  advance(sim,70);
  assert.equal(sim.actors.reduce((sum,a)=>sum+a.counters.collected,0),1);
  assert.ok(sim.events.filter(e=>e.type==='collected'&&e.bottleId===b.id).length===1);
});

test('interrupting approach releases resource reservation without creating inventory',()=>{
  const sim=one(),a=sim.actors[0];a.money=0;a.needs.hunger=.9;a.needs.fatigue=.02;sim.update(.05);
  assert.equal(a.task.kind,'collect');const id=a.task.targetId;
  assert.equal(sim.bottle(id).reservedBy,a.id);sim.interrupt(a.id);
  assert.equal(sim.bottle(id).reservedBy,null);assert.equal(sim.bottle(id).state,'ground');
  assert.equal(a.inventory.bottles.length,0);assert.equal(a.task,null);
});

test('closing a shop during an attempt prevents any transaction',()=>{
  const sim=one(),a=sim.actors[0];a.money=4;a.needs.hunger=.95;a.needs.fatigue=.01;
  until(sim,()=>a.task?.kind==='buy'&&a.task.phase==='interact',60,{ack:false});
  const token=a.task.token,before={money:a.money,stock:sim.shop.stock};
  sim.setShopOpen(false);
  assert.equal(sim.acknowledgeInteraction(a.id,true,{token}).accepted,false);
  assert.equal(a.money,before.money);assert.equal(sim.shop.stock,before.stock);assert.equal(a.inventory.bread,0);
  assert.equal(sim.resources.bakery,null);assert.ok(a.memory.failedTargets.bakery>sim.time);
});

test('one causal collect / recycle / buy / eat chain conserves world state',()=>{
  const sim=one(441),a=sim.actors[0],initialMoney=a.money,initialStock=sim.shop.stock;
  a.needs.hunger=.92;a.needs.fatigue=.01;
  until(sim,()=>a.counters.eaten===1,180);
  assert.ok(a.counters.collected>=1);assert.ok(a.counters.recycled>=1);assert.equal(a.counters.bought,1);
  assert.equal(a.inventory.bread,0);assert.ok(a.needs.hunger<.6);
  assert.equal(a.money+sim.shop.revenue-sim.recycling.paid,initialMoney);
  assert.equal(sim.shop.stock,initialStock-sim.shop.sales);
  assert.equal(sim.bottles.filter(b=>b.state==='recycled').length,sim.recycling.count);
  const types=sim.events.map(e=>e.type);
  const indices=['collected','recycled','bought','ate'].map(type=>types.indexOf(type));
  assert.ok(indices.every(i=>i>=0));assert.deepEqual(indices,indices.slice().sort((a,b)=>a-b));
});

test('seat remains reserved through stand-up and each phase has a fresh token',()=>{
  const sim=one(),a=sim.actors[0];a.x=-3.65;a.z=2.30;a.needs.hunger=.05;a.needs.fatigue=.95;
  until(sim,()=>a.task?.kind==='rest'&&a.task.phase==='interact',20,{ack:false});
  const seat=a.task.targetId,sitToken=a.task.token;advance(sim,2,{ack:false});
  assert.equal(sim.acknowledgeInteraction(a.id,true,{token:sitToken}).accepted,true);
  assert.equal(a.task.phase,'rest');assert.equal(sim.resources[seat],a.id);
  sim.interrupt(a.id);assert.equal(a.task.phase,'depart');assert.notEqual(a.task.token,sitToken);
  assert.equal(sim.resources[seat],a.id);
  assert.equal(sim.acknowledgeInteraction(a.id,true,{token:sitToken}).accepted,false);
  advance(sim,2);
  assert.equal(sim.resources[seat],null);assert.equal(a.pose,'standing');
});

test('rain changes a seated plan only after visible stand-up confirmation',()=>{
  const sim=one(),a=sim.actors[0];a.x=-3.65;a.z=2.30;a.needs.hunger=.1;a.needs.fatigue=.85;
  until(sim,()=>a.task?.kind==='rest'&&a.task.phase==='rest',15);
  sim.toggleRain(true);assert.equal(a.task.phase,'depart');
  until(sim,()=>a.task?.kind==='shelter'&&a.task.phase==='rest',60);
  assert.ok(Math.hypot(a.x-LIFE_LOCATIONS.shelterA.x,a.z-LIFE_LOCATIONS.shelterA.z)<.01);
  assert.equal(a.pose,'standing');assert.equal(sim.resources.bakery,null);
});

test('removed targets invalidate the plan without a phantom pickup',()=>{
  const sim=one(),a=sim.actors[0];a.money=0;a.needs.hunger=.92;a.needs.fatigue=.01;sim.update(.05);
  assert.equal(a.task.kind,'collect');const id=a.task.targetId;
  sim.removeBottle(id);assert.equal(a.task,null);assert.equal(a.inventory.bottles.length,0);
  assert.equal(sim.bottle(id).state,'removed');assert.equal(sim.bottle(id).reservedBy,null);
  assert.ok(a.memory.failedTargets[id]>sim.time);
});

test('failed external execution records failure and does not credit currency or items',()=>{
  const sim=one(),a=sim.actors[0];a.money=0;a.needs.hunger=.92;a.needs.fatigue=.01;
  until(sim,()=>a.task?.kind==='collect'&&a.task.phase==='interact',40,{ack:false});
  const id=a.task.targetId;advance(sim,3,{ack:false});
  const result=sim.acknowledgeInteraction(a.id,false,{token:a.task.token,reason:'test: contact not reached'});
  assert.equal(result.committed,false);assert.equal(sim.bottle(id).state,'ground');assert.equal(a.money,0);
  assert.equal(a.inventory.bottles.length,0);assert.ok(a.memory.failedTargets[id]>sim.time);
});

test('long execution retains finite state, ownership consistency and nonnegative stock',()=>{
  const sim=new LifeSimulation({seed:520});
  advance(sim,480,{onStep:s=>{
    for(const a of s.actors){
      assert.ok(a.x>=-6&&a.x<=6&&a.z>=-2&&a.z<=4);
      if(a.task?.phase==='approach')assert.ok(!s.obstacles.some(r=>a.x>r.minX&&a.x<r.maxX&&a.z>r.minZ&&a.z<r.maxZ),'Walker entered a solid fixture');
    }
  }});
  assert.ok(sim.events.length<=100);assert.ok(sim.acknowledged.size<=200);
});

test('actual scene counter / bench / planter footprints support yielding without overlap',()=>{
  // These are measured numeric collider exports from the authored Courtyard.mjs.
  // Passing this test validates 2D navigation discs, not the rendered bodies.
  const colliders=[
    {id:'bakery-counter',min:[2.29,0,-1.10],max:[4.51,.95,-.40]},
    {id:'recycling-counter',min:[-5.41,0,-1.05],max:[-4.19,.85,-.35]},
    {id:'bench',min:[-4.35,0,1.20],max:[-1.75,1.05,1.92]},
    {id:'pot-left',center:[-4.6,.2,1.57],radius:.252},
    {id:'pot-right',center:[-1.5,.2,1.54],radius:.2835}
  ];
  const sim=new LifeSimulation({colliders});let minimum=Infinity;
  advance(sim,180,{onStep:s=>{
    const [a,b]=s.actors;minimum=Math.min(minimum,Math.hypot(a.x-b.x,a.z-b.z));
    assert.ok(minimum>=a.radius+b.radius,'Navigation discs overlapped');
    for(const actor of s.actors)if(actor.task?.phase==='approach')assert.ok(s._canStand(actor,actor.radius),'Navigation disc overlaps authored fixture');
  }});
  assert.ok(sim.events.some(e=>e.type==='yielded'));
  assert.ok(sim.actors.every(a=>a.counters.eaten>=1));
  assert.ok(sim.events.every(e=>e.type!=='failed'));
});

test('observed rain-shelter stall escapes a stationary person and the real counter without overlap',()=>{
  // TEST_FIXTURE_ONLY: replay the numeric failure from suite-cb0e5e99,
  // timeout-B-rain-shelter-arrival.json. No animation/contact acknowledgement.
  // Hold A at its observed shelter while B retains the failed task and detour.
  const colliders=[
    {id:'building--3.62',min:[-6.145,0,-4.44],max:[-1.0950000000000002,2.82,-3.28]},
    {id:'building-2.62',min:[-.9049999999999998,0,-4.44],max:[6.145,2.82,-3.28]},
    {id:'bakery-counter',min:[2.29,0,-1.1],max:[4.51,.95,-.4]},
    {id:'recycling-counter',min:[-5.41,0,-1.05],max:[-4.19,.85,-.35]},
    {id:'bench',min:[-4.35,0,1.2],max:[-1.75,1.05,1.92]},
    {id:'pot--4.6-1.57',center:[-4.6,.195,1.57],radius:.252},
    {id:'pot--1.5-1.54',center:[-1.5,.215,1.54],radius:.28350000000000003},
    {id:'pot--0.63--2.67',center:[-.63,.215,-2.67],radius:.252},
    {id:'pot-5.72--2.61',center:[5.72,.245,-2.61],radius:.3045},
    {id:'pot-6.1-3.72',center:[6.1,.265,3.72],radius:.336},
    {id:'olive-tree-planter',min:[-6.455,0,-.265],max:[-5.6850000000000005,.3,.585]}
  ];
  const sim=new LifeSimulation({colliders}),a=sim.actor('A'),b=sim.actor('B');
  sim.time=160.56769999999102;sim.raining=true;
  Object.assign(a,{x:1.9,z:-1.8,task:null,waitUntil:sim.time+60});
  Object.assign(b,{x:1.326533252168927,z:-1.9152232597681313,yaw:1.054014498795139});
  b.needs.fatigue=1;
  b.task={id:'run-2-activity-16',token:'run-2-activity-16:0',epoch:0,kind:'shelter',targetId:'shelterB',
    phase:'approach',elapsed:35.80560000000128,duration:16.28742244473516,progress:.7838562444051035,
    from:{x:-3.65,z:2.3},to:{x:4.9,z:-1.8},reason:'下雨了，先到熟悉的屋檐下',score:91.035559591699,
    route:[{x:4.9,z:-1.8}],routeIndex:0,travelled:8.170878584684475,totalDistance:10.423950364630503,
    motion:'walk',waitForAcknowledgement:false,blockedFor:1.4666000000000938,startedAt:124.76209999999197,
    detour:{x:1.2925822155630535,z:-1.136498050864792},lastDetourAt:140.0618333333254};
  const token=b.task.token,started=sim.time,gap=a.radius+b.radius+.015;
  const initialSeparation=Math.hypot(a.x-b.x,a.z-b.z);
  let minimumSeparation=initialSeparation,minimumAfterEscape=Infinity,escaped=false;
  const routeChanges=[];let oldRoute='';
  for(let i=0;sim.time-started<30;i++){
    const previous={x:b.x,z:b.z},before=Math.hypot(a.x-b.x,a.z-b.z);
    // Include the small remainder substeps seen in the real RAF-driven loop.
    sim.update(i%4===3?.0000666666667:1/30);
    const dx=b.x-previous.x,dz=b.z-previous.z,length=Math.hypot(dx,dz);
    const along=length?(a.x-previous.x)*dx/length+(a.z-previous.z)*dz/length:0;
    const after=Math.hypot(a.x-b.x,a.z-b.z);
    const swept=length&&along>0&&along<length
      ?Math.abs(dx*(a.z-previous.z)-dz*(a.x-previous.x))/length:Math.min(before,after);
    minimumSeparation=Math.min(minimumSeparation,swept);
    assert.ok(swept>=Math.min(before,gap)-1e-9,'A move reduces the saved near-contact separation or crosses the original safety gap');
    if(escaped)minimumAfterEscape=Math.min(minimumAfterEscape,swept);
    if(after>=gap)escaped=true;
    assert.ok(sim._canStand(b,b.radius),'Navigation disc enters an actual scene collider');
    assert.ok(sim._clear(previous,b,b.radius),'Swept step crosses an actual scene collider');
    assert.ok(length<=b.walkSpeed*(1-b.needs.fatigue*.13)*(i%4===3?.0000666666667:1/30)+.035+1e-9,'Movement exceeds the existing speed/snap bound');
    assert.deepEqual(sim.checkInvariants(),{ok:true,errors:[]});
    const route=JSON.stringify(b.task?.route);
    if(route!==oldRoute){routeChanges.push({at:sim.time,route:b.task?.route});oldRoute=route;}
    if(b.task?.kind==='shelter'&&b.task.phase==='rest')break;
    assert.equal(b.task?.token,token,'The observed shelter attempt was abandoned rather than reaching its target');
  }
  assert.equal(b.task?.kind,'shelter');assert.equal(b.task.phase,'rest');
  assert.ok(Math.hypot(b.x-4.9,b.z+1.8)<.01,'B did not reach the unchanged shelterB');
  assert.equal(a.x,1.9);assert.equal(a.z,-1.8);assert.equal(sim.resources.bakery,null);
  assert.ok(escaped&&minimumAfterEscape>=gap-1e-9);
  assert.ok(sim.events.every(e=>e.type!=='failed'));
  navigationRegression={scope:'TEST_FIXTURE_ONLY; 2D swept navigation discs, not a browser/3D-contact pass',
    source:'suite-cb0e5e99/timeout-B-rain-shelter-arrival.json',initialSeparation,requiredSeparation:gap,
    minimumSeparation,minimumAfterEscape,simulatedSeconds:sim.time-started,arrived:{x:b.x,z:b.z},routeChanges};
});

test('callbacks from a previous reset cannot confirm a new task',()=>{
  const sim=one(),a=sim.actors[0];a.money=0;a.needs.hunger=.9;a.needs.fatigue=.02;
  until(sim,()=>a.task?.kind==='collect'&&a.task.phase==='interact',40,{ack:false});
  const stale=a.task.token;sim.reset();const current=sim.actors[0];
  current.money=0;current.needs.hunger=.9;current.needs.fatigue=.02;
  until(sim,()=>current.task?.kind==='collect'&&current.task.phase==='interact',40,{ack:false});
  advance(sim,3,{ack:false});
  assert.notEqual(current.task.token,stale);
  assert.equal(sim.acknowledgeInteraction(current.id,true,{token:stale}).accepted,false);
  assert.equal(current.inventory.bottles.length,0);
});

const report={suite:'KAOPU autonomous life semantic checks',scope:'TEST_FIXTURE_ONLY; external acknowledgements are simulated, not a 3D-contact or browser pass',
  passed:results.filter(r=>r.passed).length,total:results.length,results,navigationRegression};
console.log(JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;

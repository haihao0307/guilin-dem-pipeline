/**
 * TEST_FIXTURE_ONLY: tests semantic decisions, navigation and transactions.
 * Fake executor acknowledgements below do NOT establish rendered skin contact,
 * animation quality, body collision, browser performance or public delivery.
 */
import assert from 'node:assert/strict';
import {LifeSimulation,LIFE_LOCATIONS} from './LifeSimulation.mjs';

const results=[];
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
  passed:results.filter(r=>r.passed).length,total:results.length,results};
console.log(JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;

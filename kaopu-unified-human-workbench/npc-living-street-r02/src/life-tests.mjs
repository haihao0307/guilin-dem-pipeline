/** TEST_FIXTURE_ONLY. Observable six-person decision/transaction contracts.
 * Acknowledgements in this file are explicit mocked executor receipts. These
 * tests do not establish rendered contact, outfit quality, FPS or delivery.
 */
import assert from 'node:assert/strict';
import {LifeSimulation,LIFE_LOCATIONS} from './LifeSimulation.mjs';
import {STREET_LAYOUT} from './WorldLayout.mjs';
import {ACTOR_PROFILES} from './ActorProfiles.mjs';
import {EnvironmentWorld} from './EnvironmentWorld.mjs';
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
function make({one=false,bottles=true,seed=711}={}){
  const base=new LifeSimulation({seed}),s=new LifeSimulation({seed,actors:one?[base.actorTemplate[0]]:base.actorTemplate,initialBottles:bottles?base.initialBottles:[]});
  s.environment.plantMoisture=1;
  for(const a of s.actors)a.capabilities={window:a.id!=='D',water:true};
  return s;
}
const ack=(s,a,success=true,extra={})=>s.acknowledgeInteraction(a.id,success,{token:a.task?.token,evidence:{TEST_FIXTURE_ONLY:true,nativeContactVerified:false},...extra});
function advance(s,seconds,{acknowledge=true,onStep=null}={}){
  for(let left=seconds;left>1e-8;){const dt=Math.min(.05,left);s.update(dt);left-=dt;
    if(acknowledge)for(const a of s.actors)if(a.task?.waitForAcknowledgement&&!a.task.executionBlocked&&a.task.progress>=.999)assert.equal(ack(s,a).accepted,true);
    assert.deepEqual(s.checkInvariants(),{ok:true,errors:[]});if(onStep)onStep(s);
  }
}
function until(s,predicate,limit=100,options={}){for(let i=0;i<limit*20;i++){if(predicate(s))return;advance(s,.05,options);}assert.ok(predicate(s),'Condition absent after '+limit+' simulated seconds');}
function seatedSix(){
  const s=make({bottles:false});
  for(const a of s.actors){const id=a.preferredSeat,loc=s.locations[id];Object.assign(a,loc.stand);a.needs.hunger=.01;a.needs.fatigue=1;
    assert.equal(s._start(a,{kind:'rest',targetId:id,target:loc.stand,score:100,reason:'TEST_FIXTURE_ONLY: begin six seat approaches'}),true);}
  until(s,()=>s.actors.every(a=>a.pose==='seated'),6);return s;
}

test('six original catalogue profiles preserve three men and three women with requested hair',()=>{
  const s=make();assert.equal(s.actors.length,6);assert.equal(new Set(s.actors.map(a=>a.presetId)).size,6);
  assert.deepEqual(s.actors.map(a=>a.presetId),ACTOR_PROFILES.map(a=>a.presetId));
  for(const sex of ['male','female'])assert.equal(s.actors.filter(a=>a.sex===sex).length,3);
  for(const a of s.actors)assert.ok((a.sex==='male'?['short','buzz']:['long','medium']).includes(a.hair));
});
test('identical seed and user events reproduce six-person decisions and ownership',()=>{
  const a=make({seed:1234}),b=make({seed:1234});
  for(const s of [a,b]){advance(s,25);s.spawnBottleNear('D');advance(s,50);s.toggleRain(true);advance(s,35);s.toggleRain(false);advance(s,20);}
  assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(a.events.some(e=>e.type==='decision'));
});
test('a reachable fresh bottle is claimed within one scan despite full needs and ample money',()=>{
  const s=make({bottles:false});for(const a of s.actors){a.needs.hunger=.01;a.needs.fatigue=.99;a.money=100;}
  const b=s.spawnBottleNear('A');assert.ok(b);advance(s,.35,{acknowledge:false});
  assert.ok(b.reservedBy);const a=s.actor(b.reservedBy);assert.ok(a.task?.targetId===b.id||a.pendingBottle===b.id);
  const notice=s.events.find(e=>e.type==='bottle-noticed'&&e.bottleId===b.id);assert.ok(notice);assert.ok(notice.responseSeconds<=.35+1e-8);
});
test('six seated people notice a bottle, retain their seat and stand before walking',()=>{
  const s=seatedSix(),b=s.spawnBottleNear('B');advance(s,.35,{acknowledge:false});
  assert.ok(b.reservedBy);const a=s.actor(b.reservedBy),seat=a.task.targetId;
  assert.equal(a.task.kind,'rest');assert.equal(a.task.phase,'depart');assert.equal(a.pendingBottle,b.id);assert.equal(s.resources[seat],a.id);
  advance(s,1.6,{acknowledge:false});assert.equal(a.task.phase,'depart');assert.equal(a.inventory.bottles.length,0);assert.equal(s.resources[seat],a.id);
  assert.equal(ack(s,a).committed,true);assert.equal(s.resources[seat],null);assert.equal(a.task.kind,'collect');assert.equal(a.pose,'standing');
});
test('failed stand retains the seat, releases the bottle and rejects stale or blocked receipts',()=>{
  const s=seatedSix(),b=s.spawnBottleNear('B');advance(s,.35,{acknowledge:false});const a=s.actor(b.reservedBy),seat=a.task.targetId,old=a.task.token;
  advance(s,.4,{acknowledge:false});assert.equal(ack(s,a,false).committed,false);assert.equal(a.task.executionBlocked,true);assert.equal(s.resources[seat],a.id);assert.equal(a.pendingBottle,null);
  const blocked=a.task.token;advance(s,.4,{acknowledge:false});assert.ok(b.reservedBy&&b.reservedBy!==a.id);
  assert.equal(s.acknowledgeInteraction(a.id,true,{token:old}).accepted,false);assert.equal(s.acknowledgeInteraction(a.id,true,{token:blocked}).accepted,false);
  s.interrupt(a.id);assert.equal(a.task.executionBlocked,false);assert.notEqual(a.task.token,blocked);advance(s,1.7,{acknowledge:false});
  assert.equal(ack(s,a).committed,true);assert.equal(s.resources[seat],null);
});
test('elapsed time alone cannot acquire a bottle; one current receipt commits once',()=>{
  const s=make({one:true}),a=s.actors[0];until(s,()=>a.task?.kind==='collect'&&a.task.phase==='interact',50,{acknowledge:false});
  const id=a.task.targetId,token=a.task.token;advance(s,8,{acknowledge:false});
  assert.equal(a.task.progress,1);assert.equal(s.bottle(id).state,'ground');assert.equal(a.inventory.bottles.length,0);
  assert.equal(s.acknowledgeInteraction(a.id,true,{token:'stale'}).accepted,false);assert.equal(ack(s,a).committed,true);
  assert.equal(s.bottle(id).owner,a.id);assert.equal(s.acknowledgeInteraction(a.id,true,{token}).accepted,false);assert.equal(a.counters.collected,1);
});
test('six bottles have exclusive claims and each collectible has at most one owner',()=>{
  const s=make({bottles:false});const ids=s.actors.map(a=>s.spawnBottleNear(a.id).id);advance(s,.4,{acknowledge:false});
  const owners=ids.map(id=>s.bottle(id).reservedBy);assert.ok(owners.every(Boolean));assert.equal(new Set(owners).size,6);
  advance(s,65);for(const id of ids){const b=s.bottle(id);assert.ok(['inventory','recycled'].includes(b.state));assert.equal(s.events.filter(e=>e.type==='collected'&&e.bottleId===id).length,1);}
  assert.equal(s.actors.reduce((n,a)=>n+a.counters.collected,0),6);
});
test('interrupting a pickup approach releases its claim without producing an item',()=>{
  const s=make({one:true}),a=s.actors[0];s.update(.05);assert.equal(a.task.kind,'collect');const b=s.bottle(a.task.targetId);
  s.interrupt(a.id);assert.equal(b.reservedBy,null);assert.equal(b.state,'ground');assert.equal(a.inventory.bottles.length,0);
});
test('removing a claimed target cancels the attempt and leaves no phantom inventory',()=>{
  const s=make({one:true}),a=s.actors[0];s.update(.05);const id=a.task.targetId;s.removeBottle(id);
  assert.equal(a.task,null);assert.equal(s.bottle(id).state,'removed');assert.equal(s.bottle(id).reservedBy,null);assert.equal(a.inventory.bottles.length,0);
});
test('shop closing before contact prevents money, stock and bread changes',()=>{
  const s=make({one:true,bottles:false}),a=s.actors[0];a.money=4;a.needs.hunger=.95;a.needs.fatigue=.01;
  until(s,()=>a.task?.kind==='buy'&&a.task.phase==='interact',50,{acknowledge:false});const token=a.task.token,before=[a.money,s.shop.stock];
  s.setShopOpen(false);assert.equal(s.acknowledgeInteraction(a.id,true,{token}).accepted,false);assert.deepEqual([a.money,s.shop.stock],before);assert.equal(a.inventory.bread,0);
});
test('collect, recycle, buy and eat conserve owned bottles, currency and shop stock',()=>{
  const s=make({one:true,seed:441}),a=s.actors[0],money=a.money,stock=s.shop.stock;a.needs.hunger=.92;a.needs.fatigue=.01;
  until(s,()=>a.counters.eaten===1,180);assert.ok(a.counters.collected>0&&a.counters.recycled>0);assert.equal(a.counters.bought,1);assert.equal(a.inventory.bread,0);
  assert.equal(a.money+s.shop.revenue-s.recycling.paid,money);assert.equal(s.shop.stock,stock-s.shop.sales);assert.equal(s.bottles.filter(b=>b.state==='recycled').length,s.recycling.count);
  const types=s.events.map(e=>e.type),order=['collected','recycled','bought','ate'].map(t=>types.indexOf(t));assert.ok(order.every(i=>i>=0));assert.deepEqual(order,[...order].sort((a,b)=>a-b));
});
test('rain preserves a live bottle claim and provides six distinct covered destinations',()=>{
  const s=make();s.update(.05);const a=s.actors.find(a=>a.task?.kind==='collect'),token=a.task.token;s.toggleRain(true);
  assert.equal(a.task.token,token);for(const a of s.actors)assert.ok(s.locations['shelter'+a.id]);
  until(s,()=>s.actors.every(a=>a.task?.kind==='shelter'&&a.task.phase==='rest'),180);
  assert.equal(new Set(s.actors.map(a=>a.task.targetId)).size,6);assert.equal(s.environment.windowOpen,false);
  for(const a of s.actors){const p=s.locations[a.task.targetId];assert.ok(Math.hypot(a.x-p.x,a.z-p.z)<.01);}
});
test('unreachable window capability is excluded and weather-window change requires a receipt',()=>{
  const s=make({bottles:false});s.toggleWind();assert.ok(s.getCandidates('D').every(c=>c.kind!=='window'));
  until(s,()=>s.actors.some(a=>a.task?.kind==='window'&&a.task.phase==='interact'),80,{acknowledge:false});const a=s.actors.find(a=>a.task?.kind==='window'&&a.task.phase==='interact');
  advance(s,3.4,{acknowledge:false});assert.equal(s.environment.windowOpen,true);assert.equal(ack(s,a).committed,true);assert.equal(s.environment.windowOpen,false);
  s.toggleWind();until(s,()=>s.environment.windowOpen,150);assert.ok(s.actors.reduce((n,a)=>n+a.counters.windows,0)>=2);
});
test('a cancelled partial window can be completed to the current weather target',()=>{
  const s=make({one:true,bottles:false}),a=s.actors[0];s.environment.windowOpen=true;s.environment.windowProgress=.44;
  const c=s.getCandidates(a.id).find(c=>c.kind==='window');assert.ok(c&&c.targetOpen);assert.equal(s._start(a,c),true);
  until(s,()=>a.task?.phase==='interact',80,{acknowledge:false});advance(s,3.3,{acknowledge:false});assert.equal(ack(s,a).committed,true);assert.equal(s.environment.windowProgress,1);
});
test('dry soil causes watering only after acknowledgement and rain excludes new watering',()=>{
  const s=make({bottles:false});s.dryPlanter();until(s,()=>s.actors.some(a=>a.task?.kind==='water'&&a.task.phase==='interact'),80,{acknowledge:false});
  const a=s.actors.find(a=>a.task?.kind==='water'&&a.task.phase==='interact');advance(s,5.6,{acknowledge:false});assert.ok(s.environment.plantMoisture<.1);assert.equal(a.counters.watered,0);
  assert.equal(ack(s,a).committed,true);assert.ok(s.environment.plantMoisture>.9);s.toggleRain(true);s.dryPlanter();for(const a of s.actors)assert.ok(s.getCandidates(a.id).every(c=>c.kind!=='water'));
});
test('dusk and wind toggles alter independent environment state without creating inventory',()=>{
  const s=make({bottles:false});assert.equal(s.toggleDusk(),true);s.toggleWind();assert.equal(s.environment.weather,'breezy');assert.equal(s.environment.windStrength,.7);assert.equal(s.environment.dusk,true);
  assert.equal(s.toggleDusk(),false);s.toggleWind();assert.equal(s.environment.weather,'sunny');assert.equal(s.actors.reduce((n,a)=>n+a.inventory.bread+a.inventory.bottles.length,0),0);
});
test('six-person long run retains safe pair separation, valid paths, finite state and bounded records',()=>{
  const s=make({seed:520});let smallest=Infinity;
  const nativeTick=s._tickActor.bind(s);s._tickActor=(a,dt)=>{nativeTick(a,dt);for(let i=0;i<s.actors.length;i++)for(let j=i+1;j<s.actors.length;j++){const x=s.actors[i],y=s.actors[j];assert.ok(Math.hypot(x.x-y.x,x.z-y.z)>=x.radius+y.radius-1e-8,'An individual actor tick crosses another person');}};
  advance(s,360,{onStep:w=>{for(let i=0;i<w.actors.length;i++){const a=w.actors[i],b=STREET_LAYOUT.bounds;assert.ok(a.x>=b.minX&&a.x<=b.maxX&&a.z>=b.minZ&&a.z<=b.maxZ);
    if(a.task?.phase==='approach')assert.ok(w._canStand(a,a.radius),'Walking disc crossed authored street fixture');
    for(let j=i+1;j<w.actors.length;j++){const q=w.actors[j],gap=Math.hypot(a.x-q.x,a.z-q.z)-a.radius-q.radius;smallest=Math.min(smallest,gap);assert.ok(gap>=-1e-8,'Two navigation discs overlap');}}
  }});assert.ok(s.events.length<=100);assert.ok(s.acknowledged.size<=200);assert.ok(smallest>=0);
});
test('callbacks from a prior reset cannot confirm a fresh interaction',()=>{
  const s=make({one:true}),a=s.actors[0];until(s,()=>a.task?.kind==='collect'&&a.task.phase==='interact',50,{acknowledge:false});const old=a.task.token;
  s.reset();const b=s.actors[0];until(s,()=>b.task?.kind==='collect'&&b.task.phase==='interact',50,{acknowledge:false});advance(s,3.4,{acknowledge:false});
  assert.notEqual(b.task.token,old);assert.equal(s.acknowledgeInteraction(b.id,true,{token:old}).accepted,false);assert.equal(b.inventory.bottles.length,0);
});

test('interrupted half-sit and a failed stand retry retain the current root position',()=>{
  const s=make({one:true,bottles:false}),a=s.actors[0],loc=s.locations[a.preferredSeat];Object.assign(a,loc.stand);
  s._start(a,{kind:'rest',targetId:a.preferredSeat,target:loc.stand,score:100,reason:'TEST_FIXTURE_ONLY seat entry'});advance(s,.47,{acknowledge:false});
  const before={x:a.x,z:a.z};s.interrupt(a.id);assert.ok(Math.hypot(a.x-before.x,a.z-before.z)<1e-9);
  advance(s,.05,{acknowledge:false});assert.ok(Math.hypot(a.x-before.x,a.z-before.z)<.05);
  ack(s,a,false);const failed={x:a.x,z:a.z};advance(s,.5,{acknowledge:false});assert.deepEqual({x:a.x,z:a.z},failed);
  s.interrupt(a.id);assert.deepEqual({x:a.x,z:a.z},failed);advance(s,.05,{acknowledge:false});assert.ok(Math.hypot(a.x-failed.x,a.z-failed.z)<.05);
});
test('cancelled valve operation retains its actual angle and cannot move again without palm contact',()=>{
  // TEST_FIXTURE_ONLY: authored mechanism facade, not rendered geometry.
  const s=make({one:true,bottles:false}),a=s.actors[0];let valve=.63,window=1;
  const c={setWindowProgress:v=>{window=v;},setWatering:v=>{valve=v;},getInteractionTarget:id=>id==='windowA'?[window,1,0]:[valve,1,0],environmentReport:()=>({valve,window})};
  const env=new EnvironmentWorld({sim:s,courtyard:c});a.task={token:'fixture:water',kind:'water',targetId:'planterA',phase:'interact',progress:1};env.motionInput(a);
  s.environment.watering=.63;c.setWatering(.63);a.task=null;env.update(.05,{});assert.equal(valve,.63);assert.equal(s.environment.watering,.63);
  a.task={token:'fixture:close',kind:'water',targetId:'planterA',phase:'interact',closeOnly:true,progress:1};env.motionInput(a);
  for(let i=0;i<20;i++)env.update(.05,{A:{finite:true,poseValid:true,contactReady:false,palm:[50,50,50]}});
  assert.equal(valve,.63);assert.equal(env.snapshot().actions[0].progress,.3);
  for(let i=0;i<100;i++){const input=env.motionInput(a);env.update(.05,{A:{finite:true,poseValid:true,contactReady:true,completed:true,palm:[input.target.x,input.target.y,input.target.z]}});}
  assert.ok(valve<1e-9);assert.equal(env.snapshot().actions[0].finalEvidence.closeOnly,true);
});
test('an abandoned open valve is assigned a closing action even during rain, without invented watering credit',()=>{
  const s=make({bottles:false});s.environment.watering=.7;s.toggleRain(true);
  const c=s.getCandidates('E').find(c=>c.kind==='water');assert.ok(c?.closeOnly);assert.equal(s._start(s.actor('E'),c),true);
  until(s,()=>s.actor('E').task?.kind==='water'&&s.actor('E').task.phase==='interact',100,{acknowledge:false});advance(s,5.6,{acknowledge:false});
  assert.equal(ack(s,s.actor('E')).committed,true);assert.equal(s.environment.watering,0);assert.equal(s.actor('E').counters.watered,0);assert.equal(s.actor('E').counters.valvesClosed,1);
});


test('an open valve wakes one eligible sheltered resident instead of waiting forever in rain',()=>{
  const s=make({bottles:false});s.toggleRain(true);s.environment.windowOpen=false;s.environment.windowProgress=0;
  for(const a of s.actors){const id='shelter'+a.id,p=s.locations[id];Object.assign(a,p);s._start(a,{kind:'shelter',targetId:id,target:p,score:100,reason:'TEST_FIXTURE_ONLY sheltered scene'});assert.equal(a.task.phase,'rest');}
  s.actor('E').cooldowns.water=s.time+12;s.environment.watering=.65;advance(s,.4,{acknowledge:false});
  const a=s.actor(s.resources.planterA);assert.ok(a);assert.ok(a.task.closeOnly);assert.equal(a.task.kind,'water');assert.notEqual(a.id,'E');
  assert.equal(s.actors.filter(a=>a.task?.kind==='water').length,1);until(s,()=>a.task?.phase==='interact',100,{acknowledge:false});advance(s,5.6,{acknowledge:false});assert.equal(ack(s,a).committed,true);assert.equal(s.environment.watering,0);
});

const report={suite:'KAOPU-LIVING-STREET-R02 semantic regression',scope:'TEST_FIXTURE_ONLY; mocked receipts, no native contact / visual / browser acceptance',passed:results.filter(r=>r.passed).length,total:results.length,results};
console.log(JSON.stringify(report,null,2));if(report.passed!==report.total)process.exitCode=1;

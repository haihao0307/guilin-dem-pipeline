/**
 * KAOPU Living Street R02 — deterministic, renderer-independent life rules.
 *
 * This module chooses and navigates; it never claims that an animation made
 * contact. The renderer must acknowledge each `interact` / `depart` phase with
 * its current task.token after showing/checking that interaction. Until then
 * elapsed/progress may reach 1, but inventory, money and world ownership do not
 * change. That separation is intentional and is exercised by life-tests.mjs.
 *
 * Public interface:
 *   const sim = new LifeSimulation({seed:20261020});
 *   sim.update(dtSeconds);
 *   const a = sim.actors[0]; // id A–F; x,z,yaw,needs,inventory,task
 *   sim.acknowledgeInteraction(a.id, true, {token:a.task.token, evidence:{...}});
 *   sim.setShopOpen(false); sim.toggleRain(); sim.spawnBottle();
 *   sim.interrupt('A'); sim.reset(); sim.snapshot();
 *
 * Coordinates are metres, Y-up in the renderer, x/z here. Facing yaw=0 is +Z.
 * Needs are 0..1, money is an integer unit, inventory lists exact bottle IDs.
 * A `rest` task sits during interact, stays seated during rest, then stands
 * during depart. A `shelter` task remains standing during its rest phase.
 */

import {STREET_LAYOUT} from './WorldLayout.mjs';
import {ACTOR_PROFILES} from './ActorProfiles.mjs';
import {seatRootOffset,taskSeatFactor} from './SeatMotionPath.mjs';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const point=(x,z)=>({x,z});
const copy=v=>JSON.parse(JSON.stringify(v));
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const finite=(n,label)=>{if(!Number.isFinite(n))throw Error(`Non-finite ${label}`);return n;};

export const LIFE_VERSION='KAOPU-LIVING-STREET-R02';
const toPoint=v=>Array.isArray(v)?point(v[0],v[2]):point(v.x,v.z);
function locationsFrom(spots){
  const locations={};
  for(const [id,src]of Object.entries(spots)){
    if(!src?.stand)continue;
    if(id.startsWith('shelter')){locations[id]=toPoint(src.stand);continue;}
    const value={stand:toPoint(src.stand),yaw:src.yaw||0};
    if(src.seat){value.seat=toPoint(src.seat);value.height=Array.isArray(src.seat)?src.seat[1]:src.seat.y;}
    if(src.contact)value.contact=Array.isArray(src.contact)?{x:src.contact[0],y:src.contact[1],z:src.contact[2]}:copy(src.contact);
    locations[id]=value;
  }
  return locations;
}
export const LIFE_LOCATIONS=Object.freeze(locationsFrom(STREET_LAYOUT.spots));
const DEFAULT_OBSTACLES=STREET_LAYOUT.colliders;
// Two opportunities leave room for other lives at startup; every later bottle
// uses the same event dispatcher, independent of hunger or random choice.
const INITIAL_BOTTLES=[STREET_LAYOUT.spots.bottleStarts[0],STREET_LAYOUT.spots.bottleStarts[4]].map(v=>[v[0],v[2]]);
const dispositions=[
  [.82,.35,.65,.60,.24,1,.76], [.46,.85,.28,.30,.73,1,.64],
  [.72,.40,.70,.26,.21,2,.78], [.62,.58,.48,.45,.36,2,.72],
  [.80,.30,.82,.30,.20,3,.80], [.52,.68,.57,.34,.52,1,.68]
];
const INITIAL_ACTORS=ACTOR_PROFILES.map((profile,index)=>{
  const [industry,restfulness,curiosity,hunger,fatigue,money,walkSpeed]=dispositions[index];
  return {...copy(profile),...copy(STREET_LAYOUT.actorStarts[index]),identity:profile.description,
    walkSpeed,radius:profile.id==='B'||profile.id==='C'?.32:.27,
    needs:{hunger,fatigue},money,traits:{industry,restfulness,curiosity},preferredSeat:STREET_LAYOUT.seatIds[index]};
});
export const ACTION_LABELS={rest:'坐下休息',collect:'捡起瓶子',recycle:'出售瓶子',buy:'购买面包',eat:'吃面包',wander:'沿街散步',shelter:'到屋檐避雨',window:'照看窗户',water:'给花坛浇水'};
const LABELS=ACTION_LABELS;

class SeededRandom {
  constructor(seed){this.state=(Number(seed)>>>0)||1;}
  next(){let t=this.state+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  range(a,b){return a+(b-a)*this.next();}
}

/** Segment-vs-expanded rectangle, used by a small visibility graph navigator. */
function crosses(a,b,r,pad=.26){
  const minX=r.minX-pad,maxX=r.maxX+pad,minZ=r.minZ-pad,maxZ=r.maxZ+pad;
  let lo=0,hi=1;
  for(const [origin,delta,min,max] of [[a.x,b.x-a.x,minX,maxX],[a.z,b.z-a.z,minZ,maxZ]]){
    if(Math.abs(delta)<1e-10){if(origin<min||origin>max)return false;}
    else {const t1=(min-origin)/delta,t2=(max-origin)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
  }
  return hi>1e-5&&lo<1-1e-5;
}
function inside(p,r,pad=.26){return p.x>r.minX-pad&&p.x<r.maxX+pad&&p.z>r.minZ-pad&&p.z<r.maxZ+pad;}

export class LifeSimulation {
  constructor({seed=20261020,actors=null,obstacles=DEFAULT_OBSTACLES,colliders=null,spots=null,bounds=STREET_LAYOUT.bounds,initialBottles=INITIAL_BOTTLES}={}){
    this.initialSeed=seed;this.actorTemplate=copy(actors||INITIAL_ACTORS);
    this.bounds=copy(bounds);this.initialBottles=copy(initialBottles);
    this.locations=copy(LIFE_LOCATIONS);this.setObstacles(colliders||obstacles);if(spots)this.setLocations(spots);this.reset(seed);
  }
  reset(seed=this.initialSeed){
    this.runSequence=(this.runSequence||0)+1;
    this.seed=Number(seed)>>>0;this.rng=new SeededRandom(this.seed);
    this.time=0;this.paused=false;this.raining=false;this.events=[];this.eventSequence=0;
    this.taskSequence=0;this.bottleSequence=0;this.acknowledged=new Set();this.nextOpportunityScan=0;this.nextMaintenanceScan=0;
    this.shop={open:true,stock:6,price:2,sales:0,revenue:0};
    this.recycling={unitValue:1,count:0,paid:0};
    this.environment={weather:'sunny',windStrength:0,dusk:false,wetness:0,windowOpen:true,windowProgress:1,plantMoisture:.38,watering:0};
    this.resources=Object.fromEntries([...STREET_LAYOUT.seatIds,...STREET_LAYOUT.shelterIds,'recycle','bakery','windowA','planterA'].map(id=>[id,null]));
    this.bottles=[];
    this.actors=this.actorTemplate.map((template,index)=>({
      ...copy(template),index,radius:template.radius??(template.id==='B'?.32:.25),speed:0,velocity:point(0,0),moving:false,
      distanceTravelled:0,inventory:{bottles:[],bread:0},task:null,
      pose:'standing',reason:'观察附近的生活机会',goal:'安稳地过一会儿',plan:[],
      waitUntil:0,pendingBottle:null,cooldowns:{},memory:{failedTargets:{},lastActions:[],visited:[]},
      counters:{collected:0,recycled:0,bought:0,eaten:0,rests:0,windows:0,watered:0,valvesClosed:0},
      candidates:[],lastInteraction:null,interruption:null
    }));
    for(const [x,z]of this.initialBottles)this.spawnBottle(x,z,{silent:true});
    this._event('reset',null,'新的街角日常开始了',{seed:this.seed});
    return this;
  }
  actor(id){return this.actors.find(a=>a.id===id)||null;}
  bottle(id){return this.bottles.find(b=>b.id===id)||null;}
  /** Consume actual authored scene AABBs/cylinders; circles are conservative boxes. */
  setObstacles(colliders){
    this.obstacles=colliders.map((r,index)=>{
      if(Array.isArray(r.min)&&Array.isArray(r.max))return {id:r.id||'fixture-'+index,minX:r.min[0],maxX:r.max[0],minZ:r.min[2],maxZ:r.max[2]};
      if(Array.isArray(r.center)&&r.radius>0)return {id:r.id||'fixture-'+index,minX:r.center[0]-r.radius,maxX:r.center[0]+r.radius,minZ:r.center[2]-r.radius,maxZ:r.center[2]+r.radius};
      if(['minX','maxX','minZ','maxZ'].every(key=>Number.isFinite(r[key])))return copy(r);
      throw Error('Unsupported navigation collider '+(r.id||index));
    });
    for(const a of this.actors||[])if(a.task?.phase==='approach'){
      const route=this._route(a,a.task.to,a.radius);if(route){a.task.route=route;a.task.routeIndex=0;}else this._fail(a,'场景布局改变后，原目标暂时不可达');
    }
    return this;
  }
  /** Accept Courtyard.mjs `spots` directly; render contact heights remain exact. */
  setLocations(spots){
    Object.assign(this.locations,locationsFrom(spots));
    return this;
  }
  _event(type,actorId,message,extra={}){
    const event={sequence:++this.eventSequence,time:this.time,type,actorId,message,...extra};
    this.events.push(event);if(this.events.length>100)this.events.shift();return event;
  }
  _canStand(p,radius=.27){const b=this.bounds;return p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ&&!this.obstacles.some(r=>inside(p,r,radius+.02));}
  _clear(a,b,radius=.25){return !this.obstacles.some(r=>crosses(a,b,r,radius+.02));}
  /** Whole swept segment versus navigation discs, using the existing 15 mm gap. */
  _clearActors(start,end,radius,others){
    const dx=end.x-start.x,dz=end.z-start.z,length2=dx*dx+dz*dz;
    return others.every(other=>{
      const sx=start.x-other.x,sz=start.z-other.z,required=radius+other.radius+.015;
      // Older states can already be just inside the gap. Permit only an outward
      // escape, never a further reduction in separation or a smaller radius.
      if(Math.hypot(sx,sz)<required)return sx*dx+sz*dz>=-1e-12;
      const u=length2?clamp(-(sx*dx+sz*dz)/length2):0;
      return Math.hypot(sx+dx*u,sz+dz*u)>=required-1e-10;
    });
  }
  _route(start,end,radius=start.radius??.25,others=[]){
    const free=p=>this._canStand(p,radius)&&others.every(other=>distance(p,other)>=radius+other.radius+.015);
    const clear=(a,b)=>this._clear(a,b,radius)&&this._clearActors(a,b,radius,others);
    if(!free(end))return null;
    if(clear(start,end))return [copy(end)];
    const nodes=[copy(start),copy(end)];
    for(const r of this.obstacles)for(const x of [r.minX-radius-.06,r.maxX+radius+.06])for(const z of [r.minZ-radius-.06,r.maxZ+radius+.06]){
      const p=point(x,z);if(free(p))nodes.push(p);
    }
    // Temporary actor nodes join the same graph as counter/bench corners, so a
    // blocked rear passage can lead around the real counter's front instead.
    for(const other of others){
      const ring=(radius+other.radius+.015+.04)/Math.cos(Math.PI/12);
      for(let i=0;i<12;i++){
        const angle=i*Math.PI/6,p=point(other.x+Math.cos(angle)*ring,other.z+Math.sin(angle)*ring);
        if(free(p))nodes.push(p);
      }
    }
    const d=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),closed=new Set();d[0]=0;
    while(closed.size<nodes.length){
      let index=-1;for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&(index<0||d[i]<d[index]))index=i;
      if(index<0||!Number.isFinite(d[index]))break;
      if(index===1){const path=[];for(let i=1;i!==0;i=previous[i]){if(i<0)return null;path.unshift(nodes[i]);}return path;}
      closed.add(index);
      for(let j=0;j<nodes.length;j++)if(!closed.has(j)&&clear(nodes[index],nodes[j])){
        const candidate=d[index]+distance(nodes[index],nodes[j]);
        if(candidate<d[j]){d[j]=candidate;previous[j]=index;}
      }
    }
    return null;
  }
  _reservedByOther(id,actorId){return this.resources[id]&&this.resources[id]!==actorId;}
  _availableBottle(b,a){return b.state==='ground'&&!b.owner&&(!b.reservedBy||b.reservedBy===a.id);}
  _blocked(a,kind,id){return (a.cooldowns[kind]||0)>this.time||(a.memory.failedTargets[id]||0)>this.time;}
  _recent(a,kind){return a.memory.lastActions.filter(x=>x.kind===kind&&this.time-x.time<40).length;}
  _foodPlan(a){
    if(a.capabilities?.bread===false)return [];
    if(a.inventory.bread>0)return ['eat'];
    if(a.money>=this.shop.price)return ['buy','eat'];
    if(a.inventory.bottles.length>0)return ['recycle','buy','eat'];
    return ['collect','recycle','buy','eat'];
  }
  _bottleCandidate(a,b){
    const placement=this._pickupPlacement(a,b);
    return {kind:'collect',targetId:b.id,target:placement.target,interactionYaw:placement.yaw,score:200,
      reason:'看见可回收的瓶子，先把它捡起来',contact:{x:b.x,y:b.y??.072,z:b.z}};
  }
  _pickupPlacement(a,b){
    const stance=a.capabilities?.pickupStance;
    if(stance){
      if(!stance.passed||!Array.isArray(stance.rootOffsetXZ)||stance.rootOffsetXZ.length!==2||
        !stance.rootOffsetXZ.every(Number.isFinite)||!Number.isFinite(stance.yaw))
        throw Error(a.id+' has no validated native pickup stance');
      return {target:point(b.x+stance.rootOffsetXZ[0],b.z+stance.rootOffsetXZ[1]),yaw:stance.yaw};
    }
    // Renderer-independent rule fixtures have no native human geometry.
    return {target:point(b.x,b.z+.43),yaw:Math.PI};
  }
  _bottleHasStandingSpace(b){
    return this.actors.some(a=>a.capabilities?.pickup!==false&&this._canStand(this._pickupPlacement(a,b).target,a.radius));
  }
  _beginPendingBottle(a){
    if(!a.pendingBottle||a.task)return false;
    const b=this.bottle(a.pendingBottle);
    if(!b||!this._availableBottle(b,a)||b.reservedBy!==a.id){a.pendingBottle=null;return false;}
    if((a.memory.failedTargets[b.id]||0)>this.time){b.reservedBy=null;a.pendingBottle=null;return false;}
    a.pendingBottle=null;
    if(this._start(a,this._bottleCandidate(a,b)))return true;
    b.reservedBy=null;return false;
  }
  /** World-event allocation, before utility choice. An interaction in flight
   * finishes at its real contact gate; a seated claimant keeps its seat while
   * standing. The pending claim prevents a second person getting up for it. */
  _dispatchBottles(){
    if(this.time<this.nextOpportunityScan)return;
    this.nextOpportunityScan=this.time+.35;
    const opportunities=this.bottles.filter(b=>b.state==='ground'&&!b.owner&&!b.reservedBy).sort((a,b)=>a.spawnedAt-b.spawnedAt);
    for(const b of opportunities){
      const candidates=[];
      for(const a of this.actors){
        if(a.capabilities?.pickup===false||a.task?.executionBlocked||a.pendingBottle||a.task?.kind==='collect'||a.inventory.bottles.length>=3||(a.memory.failedTargets[b.id]||0)>this.time)continue;
        const t=a.task,seated=t?.kind==='rest'&&t.phase!=='approach';
        // A seated pelvis is intentionally inside the bench footprint. Plan
        // from the future safe standing endpoint, never weaken the bench sweep.
        const start=seated?this.locations[t.targetId].stand:a;
        const target=this._pickupPlacement(a,b).target,route=this._route(start,target,a.radius);if(!route)continue;
        let length=0,last=start;for(const p of route){length+=distance(last,p);last=p;}
        const wait=t?.waitForAcknowledgement?Math.max(1,t.duration-t.elapsed)+5:seated?2:0;
        candidates.push({actor:a,cost:length/a.walkSpeed+wait+a.needs.fatigue*.8-a.traits.industry*.2});
      }
      candidates.sort((a,b)=>a.cost-b.cost||a.actor.id.localeCompare(b.actor.id));
      const a=candidates[0]?.actor;if(!a)continue;
      b.reservedBy=a.id;b.assignedAt=this.time;a.pendingBottle=b.id;
      this._event('bottle-noticed',a.id,`${a.name}看到了瓶子，准备去捡`,{bottleId:b.id,responseSeconds:this.time-b.spawnedAt});
      const t=a.task;
      if(!t){a.waitUntil=this.time;this._beginPendingBottle(a);}
      else if(t.kind==='rest'&&t.phase==='rest')this._departSeat(a,'看到瓶子了，先站起来再去捡');
      else if(t.phase==='approach'||t.kind==='shelter')this._finish(a,false,'先去收起刚发现的瓶子');
    }
  }
  /** Eligible candidates only; invalid actions never enter weighted choice. */
  _dispatchOpenValve(){
    if(this.time<this.nextMaintenanceScan||this.environment.watering<=.02||this.resources.planterA)return;
    this.nextMaintenanceScan=this.time+.35;
    const candidates=[];
    for(const a of this.actors){
      if(a.pendingBottle||a.task?.executionBlocked||a.task&&!(a.task.kind==='shelter'&&a.task.phase==='rest'))continue;
      const action=this.getCandidates(a.id).find(c=>c.kind==='water'&&c.closeOnly);
      if(action)candidates.push({a,action,distance:distance(a,action.target)});
    }
    candidates.sort((a,b)=>a.distance-b.distance||a.a.id.localeCompare(b.a.id));
    const selected=candidates[0];if(!selected)return;
    const {a,action}=selected;
    if(a.task)this._finish(a,true,'水阀还开着，暂时离开屋檐去关好');
    if(this._start(a,action))this._event('valve-noticed',a.id,`${a.name}注意到水还在流，过去关好水阀`);
  }
  /** Eligible candidates only; invalid actions never enter weighted choice. */
  getCandidates(actorId){
    const a=this.actor(actorId);if(!a)return [];
    const candidates=[],h=a.needs.hunger,f=a.needs.fatigue;
    const add=(kind,targetId,target,score,reason,extra={})=>{
      if(this._blocked(a,kind,targetId)||!Number.isFinite(score))return;
      if(target&&!this._route(a,target))return;
      candidates.push({kind,targetId,target:target&&copy(target),score:Math.max(.1,score),reason,...extra});
    };
    const hungry=h>.38,foodBudget=a.money<this.shop.price;
    if(a.capabilities?.bread!==false&&a.inventory.bread>0&&h>.04)add('eat',`meal-${a.id}`,point(a.x,a.z),40+h*100,'手里有面包，先填饱肚子');
    if(this.raining){
      const shelter=this.locations['shelter'+a.id]||this.locations.shelterA;
      if(!this._reservedByOther('shelter'+a.id,a.id))add('shelter','shelter'+a.id,shelter,110-distance(a,shelter)*2,'下雨了，先到熟悉的屋檐下');
    }
    if(a.capabilities?.bread!==false&&a.inventory.bread===0&&hungry&&a.money>=this.shop.price&&this.shop.open&&this.shop.stock>0&&!this._reservedByOther('bakery',a.id)){
      add('buy','bakery',this.locations.bakery.stand,35+h*85-distance(a,this.locations.bakery.stand)*2.2,'饿了，钱也够，去买一份面包');
    }
    if(a.inventory.bottles.length>0&&!this._reservedByOther('recycle',a.id)){
      const enough=a.money+a.inventory.bottles.length*this.recycling.unitValue>=this.shop.price;
      add('recycle','recycle',this.locations.recycle.stand,20+a.inventory.bottles.length*12+(a.inventory.bottles.length>=3?100:0)+(hungry&&foodBudget?(enough?65:30):0)-distance(a,this.locations.recycle.stand)*2,'袋里已有瓶子，可以换成买食物的钱');
    }
    if(a.capabilities?.pickup!==false&&a.inventory.bottles.length<3){
      for(const b of this.bottles)if(this._availableBottle(b,a)){
        const c=this._bottleCandidate(a,b);
        add(c.kind,c.targetId,c.target,c.score-distance(a,c.target),c.reason,{contact:c.contact,interactionYaw:c.interactionYaw});
      }
    }
    const desiredWindowOpen=!this.raining&&this.environment.windStrength<.45;
    if(a.capabilities?.window!==false&&(this.environment.windowOpen!==desiredWindowOpen||Math.abs(this.environment.windowProgress-(desiredWindowOpen?1:0))>.02)&&!this._reservedByOther('windowA',a.id)){
      add('window','windowA',this.locations.windowA.stand,(desiredWindowOpen?62:145)-distance(a,this.locations.windowA.stand)*2,
        desiredWindowOpen?'天气放晴，开窗透透气':'风雨来了，把窗户关好',{targetOpen:desiredWindowOpen});
    }
    if(a.capabilities?.water!==false&&this.environment.watering>.02&&!this._reservedByOther('planterA',a.id)){
      add('water','planterA',this.locations.planterA.stand,165-distance(a,this.locations.planterA.stand)*2,
        '水阀还开着，过去把它关好',{closeOnly:true});
    }else if(a.capabilities?.water!==false&&!this.raining&&this.environment.plantMoisture<.4&&!this._reservedByOther('planterA',a.id)){
      add('water','planterA',this.locations.planterA.stand,52+(1-this.environment.plantMoisture)*38+a.traits.industry*9-distance(a,this.locations.planterA.stand)*2.6,
        '花坛的土有些干，转开水阀浇一浇');
    }
    if(!this.raining){
      for(const id of STREET_LAYOUT.seatIds)if(!this._reservedByOther(id,a.id)){
        const loc=this.locations[id];
        const score=15+f*88+a.traits.restfulness*17-distance(a,loc.stand)*2+(id===a.preferredSeat?8:0)-(hungry?18:0);
        add('rest',id,loc.stand,score,f>.5?'有些累了，回熟悉的长椅坐一会儿':'暂时没有急事，坐下看看街角');
      }
      for(const [i,p]of STREET_LAYOUT.wanderPoints.map(toPoint).entries()){
        if(distance(a,p)<1)continue;
        add('wander','walk-'+i,p,9+a.traits.curiosity*14-f*13-(hungry?14:0)-this._recent(a,'wander')*9,'附近走走，看看有没有新的事情');
      }
    }
    return candidates.sort((a,b)=>b.score-a.score);
  }
  _choose(a){
    if(this._beginPendingBottle(a))return;
    const candidates=this.getCandidates(a.id);a.candidates=candidates.map(c=>({kind:c.kind,targetId:c.targetId,score:c.score,reason:c.reason}));
    if(!candidates.length){a.reason=this.raining?'屋檐下暂时等一等':'暂时没有可完成的事情，稍候再看';a.waitUntil=this.time+this.rng.range(1.8,3);return;}
    const best=candidates[0].score;
    // Restrict randomness to near-worthwhile choices; urgent needs remain legible.
    const shortlist=candidates.filter(c=>c.score>=best-12);
    const weights=shortlist.map(c=>Math.exp((c.score-best)/5));
    let draw=this.rng.next()*weights.reduce((sum,v)=>sum+v,0),chosen=shortlist[shortlist.length-1];
    for(let i=0;i<shortlist.length;i++){draw-=weights[i];if(draw<=0){chosen=shortlist[i];break;}}
    this._start(a,chosen);
  }
  _reserve(a,c){
    if(c.kind==='collect'){
      const b=this.bottle(c.targetId);if(!b||!this._availableBottle(b,a))return false;b.reservedBy=a.id;
    }else if(c.targetId in this.resources){
      if(this._reservedByOther(c.targetId,a.id))return false;this.resources[c.targetId]=a.id;
    }
    return true;
  }
  _start(a,c){
    const route=this._route(a,c.target||a);
    if(!route){a.memory.failedTargets[c.targetId]=this.time+12;return false;}
    if(!this._reserve(a,c))return false;
    const id=`run-${this.runSequence}-activity-${++this.taskSequence}`;
    a.goal=a.capabilities?.bread!==false&&['collect','recycle','buy','eat'].includes(c.kind)&&a.needs.hunger>.38?'吃到一份面包':c.kind==='rest'?'恢复体力':c.kind==='shelter'?'找一个干燥的地方':'照顾眼前的小事';
    a.plan=a.goal==='吃到一份面包'?this._foodPlan(a):[c.kind];
    a.task={id,token:id+':0',epoch:0,kind:c.kind,label:LABELS[c.kind],targetId:c.targetId,
      phase:'approach',elapsed:0,duration:0,progress:0,from:point(a.x,a.z),to:copy(c.target||a),
      reason:c.reason,score:c.score,route,routeIndex:0,travelled:0,totalDistance:0,targetOpen:c.targetOpen,
      motion:'walk',contact:c.contact||this.locations[c.targetId]?.contact||null,closeOnly:!!c.closeOnly,
      interactionYaw:c.interactionYaw,
      waitForAcknowledgement:false,blockedFor:0,startedAt:this.time};
    let prev=a;for(const p of route){a.task.totalDistance+=distance(prev,p);prev=p;}
    a.task.duration=a.task.totalDistance/a.walkSpeed;
    if(c.kind==='window')a.task.label=c.targetOpen?'打开窗户':'关上窗户';
    if(c.kind==='water'&&c.closeOnly)a.task.label='关好水阀';
    a.reason=c.reason;a.pose='standing';a.interruption=null;
    this._event('decision',a.id,`${a.name}：${c.reason}`,{kind:c.kind,targetId:c.targetId,score:c.score,plan:a.plan.slice()});
    if(a.task.totalDistance<.035)this._arrive(a);
    return true;
  }
  _release(a){
    for(const key of Object.keys(this.resources))if(this.resources[key]===a.id)this.resources[key]=null;
    for(const b of this.bottles)if(b.reservedBy===a.id&&b.id!==a.pendingBottle)b.reservedBy=null;
  }
  _newPhase(a,phase,duration,motion,from=point(a.x,a.z),to=from){
    const t=a.task;t.phase=phase;t.epoch++;t.token=`${t.id}:${t.epoch}`;
    t.elapsed=0;t.duration=duration;t.progress=0;t.motion=motion;t.from=copy(from);t.to=copy(to);
    t.waitForAcknowledgement=phase==='interact'||phase==='depart';a.moving=false;a.speed=0;a.velocity=point(0,0);
  }
  _arrive(a){
    const t=a.task;if(!t)return;
    a.x=t.to.x;a.z=t.to.z;a.moving=false;a.speed=0;a.velocity=point(0,0);
    if(t.kind==='wander'){this._finish(a,true,'走到这里，看看周围');return;}
    if(t.kind==='shelter'){
      a.yaw=0;a.pose='standing';this._newPhase(a,'rest',this.rng.range(9,17),'shelter');
      this._event('sheltered',a.id,`${a.name}到了屋檐下`);return;
    }
    if(t.kind==='rest'){
      const loc=this.locations[t.targetId];a.yaw=loc.yaw;a.pose='sitting-down';
      this._newPhase(a,'interact',1.55,'sit',loc.stand,loc.seat);return;
    }
    if(t.kind==='collect'){
      const b=this.bottle(t.targetId);if(!b||!this._availableBottle(b,a)){this._fail(a,'目标瓶子已不在原处');return;}
      a.yaw=Number.isFinite(t.interactionYaw)?t.interactionYaw:Math.atan2(b.x-a.x,b.z-a.z);
    }else if(t.kind!=='eat')a.yaw=this.locations[t.targetId]?.yaw??a.yaw;
    const durations={collect:3.2,recycle:2.4,buy:2.4,eat:4.2,window:3.2,water:5.5};
    this._newPhase(a,'interact',durations[t.kind]||2,t.kind);
  }
  _move(a,dt){
    const t=a.task;if(!t)return;
    t.elapsed+=dt;
    // This limit also applies while every step is rejected.
    if(t.elapsed>Math.max(20,t.duration*3+8)){this._fail(a,'没有及时到达，重新考虑路线');return;}
    t.navigationAnchor??=point(a.x,a.z);t.blockedFor+=dt;
    const others=this.actors.filter(other=>other!==a);
    let waypoint=t.detour||t.route[t.routeIndex];if(!waypoint){this._arrive(a);return;}
    const blocker=others.find(other=>distance(a,other)<1.05&&!this._clearActors(a,waypoint,a.radius,[other]));
    if(blocker&&(t.lastDetourAt??-10)<this.time-.25&&
      (a.id>blocker.id||!blocker.task||blocker.task.phase!=='approach')){
      const route=this._route(a,t.to,a.radius,others);t.lastDetourAt=this.time;
      if(route){
        t.detour=null;t.route=route;t.routeIndex=0;waypoint=route[0];
        let previous=a;t.totalDistance=t.travelled;
        for(const p of route){t.totalDistance+=distance(previous,p);previous=p;}
        this._event('yielded',a.id,`${a.name}稍微让开，让对方先过`);
      }
    }
    const dx=waypoint.x-a.x,dz=waypoint.z-a.z,d=Math.hypot(dx,dz),vx=d?dx/d:0,vz=d?dz/d:0;
    const speed=a.walkSpeed*(1-a.needs.fatigue*.13),arriving=d<.035,step=arriving?d:Math.min(speed*dt,d);
    // Follow the checked line directly. Side steering would invalidate its sweep.
    const next=point(a.x+vx*step,a.z+vz*step);
    const collision=!this._clearActors(a,next,a.radius,others);
    if(collision||!this._canStand(next,a.radius)||!this._clear(a,next,a.radius)){
      a.moving=false;a.speed=0;a.velocity=point(0,0);
      if(t.blockedFor>5)this._fail(a,'道路暂时被占，先做别的事情');return;
    }
    a.x=next.x;a.z=next.z;a.moving=step>0;a.speed=a.moving?speed:0;
    a.velocity=point(vx*speed,vz*speed);a.distanceTravelled+=step;t.travelled+=step;
    a.yaw+=angleDelta(a.yaw,Math.atan2(vx,vz))*Math.min(1,dt*8);
    t.progress=clamp(t.travelled/Math.max(t.totalDistance,.01));
    // Micrometre-scale substeps cannot keep a stalled route alive indefinitely.
    if(distance(a,t.navigationAnchor)>=.03){t.navigationAnchor=point(a.x,a.z);t.blockedFor=0;}
    if(arriving){
      if(t.detour){t.detour=null;const route=this._route(a,t.to,a.radius,others);if(!route){this._fail(a,'让路后重新寻找可达的目标');return;}t.route=route;t.routeIndex=0;}
      else {t.routeIndex++;if(t.routeIndex>=t.route.length)this._arrive(a);}
    }else if(t.blockedFor>5)this._fail(a,'道路暂时被占，先做别的事情');
  }
  _validatePending(a){
    const t=a.task;if(!t)return false;
    if(t.kind==='collect'){
      const b=this.bottle(t.targetId);return a.capabilities?.pickup!==false&&!!b&&this._availableBottle(b,a)&&b.reservedBy===a.id;
    }
    if(t.kind==='buy')return a.capabilities?.bread!==false&&this.shop.open&&this.shop.stock>0&&a.money>=this.shop.price&&this.resources.bakery===a.id;
    if(t.kind==='recycle')return a.inventory.bottles.length>0&&this.resources.recycle===a.id;
    if(t.kind==='eat')return a.capabilities?.bread!==false&&a.inventory.bread>0;
    if(t.kind==='rest')return this.resources[t.targetId]===a.id;
    if(t.kind==='window')return this.resources.windowA===a.id&&t.targetOpen===(!this.raining&&this.environment.windStrength<.45);
    if(t.kind==='water')return this.resources.planterA===a.id&&(t.closeOnly||!this.raining&&this.environment.plantMoisture<.8);
    return true;
  }
  _tickActor(a,dt){
    const t=a.task,resting=t?.kind==='rest'&&t.phase==='rest';
    a.needs.hunger=clamp(a.needs.hunger+dt*.0013);
    a.needs.fatigue=clamp(a.needs.fatigue+dt*(resting?-.011:a.moving?.002:.00045));
    for(const [id,until]of Object.entries(a.memory.failedTargets))if(until<=this.time)delete a.memory.failedTargets[id];
    if(!t){a.moving=false;a.speed=0;a.velocity=point(0,0);if(this.time>=a.waitUntil)this._choose(a);return;}
    if(t.executionBlocked){a.moving=false;a.speed=0;a.velocity=point(0,0);return;}
    if(t.phase==='approach'){
      if(!this._validatePending(a)){this._fail(a,t.kind==='buy'?'面包店现在无法交易':'原来的目标已经不能使用');return;}
      this._move(a,dt);return;
    }
    if(t.kind==='rest'&&(t.phase==='interact'||t.phase==='depart')){
      // Seat transitions move a real body too. Check their complete swept
      // step before advancing the pose clock, exactly as for walking.
      const progress=clamp((t.elapsed+dt)/Math.max(t.duration,.001)),loc=this.locations[t.targetId];
      const offset=seatRootOffset(taskSeatFactor(t,progress),distance(loc.seat,loc.stand));
      const next=point(loc.seat.x+Math.sin(loc.yaw)*offset,loc.seat.z+Math.cos(loc.yaw)*offset);
      if(!this._clearActors(a,next,a.radius,this.actors.filter(other=>other!==a))){
        a.moving=false;a.speed=0;a.velocity=point(0,0);t.seatBlockedFor=(t.seatBlockedFor||0)+dt;
        a.reason='等身边的人经过，再继续站稳或坐下';
        if(t.seatBlockedFor>12&&t.phase==='depart')this._fail(a,'起身通道持续被占，保持当前姿态');
        return;
      }
      t.seatBlockedFor=0;a.x=next.x;a.z=next.z;
    }
    t.elapsed+=dt;t.progress=clamp(t.elapsed/Math.max(t.duration,.001));
    if(t.phase==='rest'){
      if(t.kind==='rest'&&(t.elapsed>=t.duration||(a.needs.hunger>.82&&t.elapsed>4)||this.raining))this._departSeat(a,this.raining?'雨落下来了，准备去屋檐下':a.needs.hunger>.82?'肚子饿了，准备去找食物':'休息得差不多了');
      else if(t.kind==='shelter'&&!this.raining)this._finish(a,true,'雨停了，可以重新活动');
      return;
    }
    if(t.waitForAcknowledgement&&t.elapsed>t.duration+30)this._fail(a,'动作执行尚未确认，已安全取消');
  }
  update(dt){
    finite(dt,'dt');if(dt<0)throw Error('Negative dt');if(this.paused||dt===0)return this;
    if(dt>60)throw Error('A single update must be at most 60 seconds');
    let remaining=dt;while(remaining>1e-8){const step=Math.min(.05,remaining);this.time+=step;
      this.environment.plantMoisture=clamp(this.environment.plantMoisture+step*((this.raining?.004:-.00045)+this.environment.watering*.018));
      this.environment.wetness=clamp(this.environment.wetness+step*(this.raining?.10:-.008));
      this._dispatchBottles();this._dispatchOpenValve();for(const a of this.actors)this._tickActor(a,step);remaining-=step;}
    return this;
  }
  /** Returns {accepted,committed,reason}; stale or duplicate tokens are rejected. */
  acknowledgeInteraction(actorId,success,details={}){
    const a=this.actor(actorId),t=a?.task;
    if(!a||!t)return {accepted:false,committed:false,reason:'no-active-task'};
    if(t.executionBlocked)return {accepted:false,committed:false,reason:'execution-blocked'};
    if(!details.token||details.token!==t.token||this.acknowledged.has(details.token))return {accepted:false,committed:false,reason:'stale-or-missing-token'};
    if(!t.waitForAcknowledgement||!['interact','depart'].includes(t.phase))return {accepted:false,committed:false,reason:'not-awaiting-interaction'};
    if(success&&t.progress<.98)return {accepted:false,committed:false,reason:'animation-not-ready'};
    this.acknowledged.add(details.token);if(this.acknowledged.size>200)this.acknowledged.delete(this.acknowledged.values().next().value);
    a.lastInteraction={time:this.time,token:t.token,kind:t.kind,success:!!success,evidence:copy(details.evidence||{}),scope:'external-executor-confirmation'};
    if(!success){this._fail(a,details.reason||'这次动作没有完成，换一个选择');return {accepted:true,committed:false,reason:'execution-failed'};}
    if(t.phase==='depart'){
      a.pose='standing';this._finish(a,true,a.interruption||'休息结束');return {accepted:true,committed:true,reason:'stood-up'};
    }
    if(!this._validatePending(a)){this._fail(a,'执行前条件已经变化，这次不提交结果');return {accepted:true,committed:false,reason:'precondition-changed'};}
    switch(t.kind){
      case 'rest':{
        a.pose='seated';a.counters.rests++;
        this._newPhase(a,'rest',this.rng.range(12,22)+a.traits.restfulness*15,'rest');
        this._event('seated',a.id,`${a.name}坐稳了，暂时休息`);
        if(a.pendingBottle)this._departSeat(a,'看到瓶子了，站起来去捡');
        return {accepted:true,committed:true,reason:'seated'};
      }
      case 'collect':{
        const b=this.bottle(t.targetId);b.state='inventory';b.owner=a.id;b.reservedBy=null;b.collectedAt=this.time;
        a.inventory.bottles.push(b.id);a.counters.collected++;
        this._event('collected',a.id,`${a.name}收起一只瓶子`,{bottleId:b.id});break;
      }
      case 'recycle':{
        const ids=a.inventory.bottles.slice(),value=ids.length*this.recycling.unitValue;
        // Validate exact ownership before the indivisible inventory/currency transaction.
        if(ids.some(id=>{const b=this.bottle(id);return !b||b.owner!==a.id||b.state!=='inventory';})){
          this._fail(a,'瓶子归属不一致，交易没有发生');return {accepted:true,committed:false,reason:'ownership-mismatch'};
        }
        for(const id of ids){const b=this.bottle(id);b.state='recycled';b.owner='recycling';b.recycledAt=this.time;}
        a.inventory.bottles=[];a.money+=value;this.recycling.count+=ids.length;this.recycling.paid+=value;a.counters.recycled+=ids.length;
        this._event('recycled',a.id,`${a.name}用 ${ids.length} 只瓶子换到 ${value} 元`,{bottleIds:ids,value});break;
      }
      case 'buy':
        a.money-=this.shop.price;a.inventory.bread++;this.shop.stock--;this.shop.sales++;this.shop.revenue+=this.shop.price;a.counters.bought++;
        this._event('bought',a.id,`${a.name}买了一份面包`,{price:this.shop.price});break;
      case 'eat':
        a.inventory.bread--;a.needs.hunger=clamp(a.needs.hunger-.58);a.counters.eaten++;
        this._event('ate',a.id,`${a.name}吃完面包，饥饿缓解了`);break;
      case 'window':
        this.environment.windowOpen=t.targetOpen;this.environment.windowProgress=t.targetOpen?1:0;a.counters.windows++;
        this._event('window',a.id,`${a.name}${t.targetOpen?'打开':'关上'}了窗户`,{open:t.targetOpen});break;
      case 'water':
        this.environment.watering=0;
        if(t.closeOnly){a.counters.valvesClosed++;this._event('valve-closed',a.id,`${a.name}把留下的水阀关好了`);}
        else {this.environment.plantMoisture=.95;a.counters.watered++;this._event('watered',a.id,`${a.name}浇好了花坛，土壤变湿了`);}break;
      default:return {accepted:false,committed:false,reason:'unsupported-interaction'};
    }
    this._finish(a,true,'完成了眼前这件事');return {accepted:true,committed:true,reason:'world-state-committed'};
  }
  _departSeat(a,reason){
    if(!a.task||a.task.kind!=='rest'||a.task.phase==='depart')return;
    const loc=this.locations[a.task.targetId],factor=taskSeatFactor(a.task);a.reason=reason;a.pose='standing-up';
    this._newPhase(a,'depart',1.45,'stand',point(a.x,a.z),loc.stand);
    a.task.standStartFactor=factor;
  }
  _finish(a,success,reason){
    const t=a.task;if(!t)return;
    this._release(a);a.memory.lastActions.push({kind:t.kind,time:this.time,success});if(a.memory.lastActions.length>12)a.memory.lastActions.shift();
    a.cooldowns[t.kind]=this.time+({rest:5,collect:.2,recycle:2,buy:5,eat:4,wander:3,shelter:.6,water:12,window:2}[t.kind]||1);
    a.task=null;a.moving=false;a.speed=0;a.velocity=point(0,0);a.pose='standing';a.reason=reason;
    a.waitUntil=this.time+this.rng.range(.45,1.3);
    this.nextOpportunityScan=Math.min(this.nextOpportunityScan,this.time);
    this._beginPendingBottle(a);
  }
  _fail(a,reason){
    const t=a.task;if(!t)return;
    a.memory.failedTargets[t.targetId]=this.time+12;
    this._event('failed',a.id,`${a.name}：${reason}`,{kind:t.kind,targetId:t.targetId});
    if(t.kind==='rest'&&t.phase==='depart'){
      // Failed standing is NOT standing. Retain the seat but let another
      // available person collect the pending ground object.
      if(a.pendingBottle){const b=this.bottle(a.pendingBottle);if(b)b.reservedBy=null;a.pendingBottle=null;}
      t.executionBlocked=true;t.epoch++;t.token=`${t.id}:${t.epoch}`;
      this.nextOpportunityScan=this.time;
      a.pose='standing-up';a.reason=reason+'，保持座位，等待重新执行';a.moving=false;a.speed=0;return;
    }
    // A seated person must stand visibly before losing its reserved seat.
    if(t.kind==='rest'&&(t.phase==='rest'||t.phase==='interact')&&t.progress>.5){
      a.interruption=reason;this._departSeat(a,reason);return;
    }
    this._finish(a,false,reason);
  }
  interrupt(actorId,reason='受到打扰，重新看看眼前的情况'){
    const a=this.actor(actorId);if(!a)return false;
    a.interruption=reason;this._event('interrupted',a.id,`${a.name}被打断了`);
    if(a.task?.executionBlocked&&a.task.kind==='rest'){
      const loc=this.locations[a.task.targetId],factor=taskSeatFactor(a.task);a.task.executionBlocked=false;
      this._newPhase(a,'depart',1.65,'stand',point(a.x,a.z),loc.stand);
      a.task.standStartFactor=factor;
      a.reason='重新尝试站稳，再继续活动';return true;
    }
    if(a.pendingBottle){const b=this.bottle(a.pendingBottle);if(b)b.reservedBy=null;a.pendingBottle=null;}
    if(a.task?.kind==='rest'&&a.task.phase!=='approach')this._departSeat(a,reason);
    else if(a.task)this._finish(a,false,reason);
    a.waitUntil=this.time+.6;return true;
  }
  setShopOpen(open){
    this.shop.open=!!open;this._event('shop',null,this.shop.open?'面包店开门了':'面包店暂时打烊了',{open:this.shop.open});
    if(!this.shop.open)for(const a of this.actors)if(a.task?.kind==='buy')this._fail(a,'面包店打烊了，先改变计划');
    return this.shop.open;
  }
  toggleRain(value=!this.raining){
    this.raining=!!value;this.environment.weather=this.raining?'rain':'sunny';this.environment.windStrength=this.raining?.18:0;
    if(this.raining)this.environment.wetness=Math.max(.12,this.environment.wetness);
    this._event('weather',null,this.raining?'街上开始落雨，窗户和屋檐成了新的需要':'雨停了，地面还留着水光',{raining:this.raining});
    for(const a of this.actors){
      if(this.raining&&a.task?.kind==='rest'&&a.task.phase==='rest')this._departSeat(a,'下雨了，起身去屋檐下');
      else if(this.raining&&a.task?.phase==='approach'&&['rest','wander','water'].includes(a.task.kind))this.interrupt(a.id,'开始下雨，先去避雨');
      else if(!a.task)a.waitUntil=this.time;
    }
    return this.raining;
  }
  toggleWind(){
    const active=this.environment.weather!=='breezy';this.raining=false;
    this.environment.weather=active?'breezy':'sunny';this.environment.windStrength=active?.7:0;
    this._event('weather',null,active?'风吹过街道，檐下挂饰轻摆，需要把窗户关好':'风小了，街道又安静下来');
    for(const a of this.actors)if(!a.task||a.task.kind==='shelter'){if(a.task)this._finish(a,true,'风雨改变了，重新看看');a.waitUntil=this.time;}
    return active;
  }
  toggleDusk(){this.environment.dusk=!this.environment.dusk;this._event('light',null,this.environment.dusk?'夕光落下来，街灯亮起':'天色恢复明亮');return this.environment.dusk;}
  dryPlanter(){this.environment.plantMoisture=.08;for(const a of this.actors)if(!a.task)a.waitUntil=this.time;this._event('plant-dry',null,'花坛缺水了，看看谁会来照料');}
  spawnBottleNear(actorId){
    const a=this.actor(actorId);if(!a)return this.spawnBottle();
    for(const r of [1.1,1.6,2.1])for(const offset of [0,.8,-.8,1.6,-1.6,Math.PI]){
      const angle=a.yaw+offset,x=a.x+Math.sin(angle)*r,z=a.z+Math.cos(angle)*r;
      if(this._bottleHasStandingSpace(point(x,z))&&this.actors.every(other=>distance(other,point(x,z))>.70)&&this.bottles.every(b=>b.state!=='ground'||distance(b,point(x,z))>.25))return this.spawnBottle(x,z);
    }
    return this.spawnBottle();
  }
  spawnBottle(x,z,{silent=false}={}){
    if(x===undefined||z===undefined){
      const box=STREET_LAYOUT.bottleDropBounds;
      let p=null;for(let i=0;i<60;i++){const q=point(this.rng.range(box.minX,box.maxX),this.rng.range(box.minZ,box.maxZ));if(this._bottleHasStandingSpace(q)&&this.actors.every(a=>distance(a,q)>.70)){p=q;break;}}
      if(!p)return null;x=p.x;z=p.z;
    }
    finite(x,'bottle.x');finite(z,'bottle.z');
    if(!this._bottleHasStandingSpace(point(x,z)))return null;
    const b={id:`bottle-${++this.bottleSequence}`,x,z,y:.072,state:'ground',owner:null,reservedBy:null,spawnedAt:this.time};
    this.bottles.push(b);this.nextOpportunityScan=this.time;
    if(!silent)this._event('bottle-spawned',null,'街上多了一只可回收的瓶子',{bottleId:b.id,x,z});return b;
  }
  removeBottle(id){
    const b=this.bottle(id);if(!b||b.state!=='ground')return false;
    const holder=b.reservedBy;b.state='removed';b.owner=null;b.reservedBy=null;
    this._event('bottle-removed',null,'这只瓶子已被拿走',{bottleId:id});
    const a=holder&&this.actor(holder);if(a?.pendingBottle===id)a.pendingBottle=null;if(a?.task?.targetId===id)this._fail(a,'瓶子被别人先拿走了');return true;
  }
  setActorNeed(id,need,value){
    const a=this.actor(id);if(!a||!['hunger','fatigue'].includes(need))return false;
    a.needs[need]=clamp(finite(value,need));if(!a.task)a.waitUntil=this.time;return true;
  }
  checkInvariants(){
    const errors=[],owned=new Map();
    for(const a of this.actors){
      for(const [k,v]of Object.entries(a.needs))if(!Number.isFinite(v)||v<0||v>1)errors.push(`${a.id}:invalid-${k}`);
      if(!Number.isFinite(a.x)||!Number.isFinite(a.z)||!Number.isFinite(a.yaw))errors.push(`${a.id}:invalid-position`);
      if(!Number.isInteger(a.money)||a.money<0||!Number.isInteger(a.inventory.bread)||a.inventory.bread<0)errors.push(`${a.id}:invalid-currency-or-bread`);
      for(const id of a.inventory.bottles){if(owned.has(id))errors.push(`${id}:duplicate-owner`);owned.set(id,a.id);const b=this.bottle(id);if(b?.state!=='inventory'||b.owner!==a.id)errors.push(`${id}:inventory-mismatch`);}
    }
    for(const b of this.bottles){
      if(b.state==='inventory'&&owned.get(b.id)!==b.owner)errors.push(`${b.id}:missing-inventory`);
      if(b.reservedBy&&this.actor(b.reservedBy)?.task?.targetId!==b.id&&this.actor(b.reservedBy)?.pendingBottle!==b.id)errors.push(`${b.id}:stale-reservation`);
    }
    for(const [id,owner]of Object.entries(this.resources))if(owner&&this.actor(owner)?.task?.targetId!==id)errors.push(`${id}:stale-resource-reservation`);
    if(this.shop.stock<0||!Number.isInteger(this.shop.stock))errors.push('negative-shop-stock');
    return {ok:errors.length===0,errors};
  }
  snapshot(){return copy({version:LIFE_VERSION,seed:this.seed,time:this.time,paused:this.paused,raining:this.raining,
    actors:this.actors,bottles:this.bottles,shop:this.shop,recycling:this.recycling,resources:this.resources,environment:this.environment,events:this.events,
    invariants:this.checkInvariants(),scope:'six independent needs; event-first exclusive bottle claims; safe completion before preemption; source-based native motion; real contact executor commits; no whole-body physics claim'});}
}

export default LifeSimulation;

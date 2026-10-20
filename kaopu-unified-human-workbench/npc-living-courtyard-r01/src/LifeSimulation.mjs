/**
 * KAOPU Living Courtyard R01 — deterministic, renderer-independent life rules.
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
 *   const a = sim.actors[0]; // id A / B; x,z,yaw,needs,inventory,task
 *   sim.acknowledgeInteraction(a.id, true, {token:a.task.token, evidence:{...}});
 *   sim.setShopOpen(false); sim.toggleRain(); sim.spawnBottle();
 *   sim.interrupt('A'); sim.reset(); sim.snapshot();
 *
 * Coordinates are metres, Y-up in the renderer, x/z here. Facing yaw=0 is +Z.
 * Needs are 0..1, money is an integer unit, inventory lists exact bottle IDs.
 * A `rest` task sits during interact, stays seated during rest, then stands
 * during depart. A `shelter` task remains standing during its rest phase.
 */

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const point=(x,z)=>({x,z});
const copy=v=>JSON.parse(JSON.stringify(v));
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const finite=(n,label)=>{if(!Number.isFinite(n))throw Error(`Non-finite ${label}`);return n;};

export const LIFE_VERSION='KAOPU-LIVING-COURTYARD-R01';
export const LIFE_LOCATIONS=Object.freeze({
  benchA:{stand:point(-3.65,2.30),seat:point(-3.65,1.65),height:.46,yaw:0},
  benchB:{stand:point(-2.45,2.30),seat:point(-2.45,1.65),height:.46,yaw:0},
  recycle:{stand:point(-4.8,0),contact:{x:-4.8,y:.85,z:-.7},yaw:Math.PI},
  bakery:{stand:point(3.4,0),contact:{x:3.4,y:.95,z:-.75},yaw:Math.PI},
  shelterA:point(1.90,-1.80),shelterB:point(4.90,-1.80)
});
const DEFAULT_OBSTACLES=[
  {id:'bench',minX:-4.24,maxX:-1.84,minZ:1.36,maxZ:1.94},
  {id:'bakery-counter',minX:2.7,maxX:4.1,minZ:-1.35,maxZ:-.55},
  {id:'recycle-counter',minX:-5.28,maxX:-4.32,minZ:-1.4,maxZ:-.50}
];
const INITIAL_BOTTLES=[[-1.2,.4],[1,1.9],[3.2,2.5],[-4.5,3.1]];
const INITIAL_ACTORS=[
  {id:'A',name:'林川',identity:'高瘦 · P01',x:-.65,z:1.25,yaw:-.4,
    walkSpeed:.74,needs:{hunger:.60,fatigue:.24},money:1,
    traits:{restfulness:.35,industry:.82,curiosity:.65},preferredSeat:'benchA'},
  {id:'B',name:'周叔',identity:'矮壮 · P02',x:-2.45,z:2.32,yaw:0,
    walkSpeed:.64,needs:{hunger:.30,fatigue:.73},money:1,
    traits:{restfulness:.85,industry:.46,curiosity:.28},preferredSeat:'benchB'}
];
const LABELS={rest:'坐下休息',collect:'收集瓶子',recycle:'出售瓶子',buy:'购买面包',eat:'吃面包',wander:'散步看看',shelter:'到屋檐避雨'};

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
  constructor({seed=20261020,actors=null,obstacles=DEFAULT_OBSTACLES,colliders=null,spots=null}={}){
    this.initialSeed=seed;this.actorTemplate=copy(actors||INITIAL_ACTORS);
    this.locations=copy(LIFE_LOCATIONS);this.setObstacles(colliders||obstacles);if(spots)this.setLocations(spots);this.reset(seed);
  }
  reset(seed=this.initialSeed){
    this.runSequence=(this.runSequence||0)+1;
    this.seed=Number(seed)>>>0;this.rng=new SeededRandom(this.seed);
    this.time=0;this.paused=false;this.raining=false;this.events=[];this.eventSequence=0;
    this.taskSequence=0;this.bottleSequence=0;this.acknowledged=new Set();
    this.shop={open:true,stock:8,price:2,sales:0,revenue:0};
    this.recycling={unitValue:1,count:0,paid:0};
    this.resources={benchA:null,benchB:null,recycle:null,bakery:null};
    this.bottles=[];
    this.actors=this.actorTemplate.map((template,index)=>({
      ...copy(template),index,radius:template.radius??(template.id==='B'?.32:.25),speed:0,velocity:point(0,0),moving:false,
      distanceTravelled:0,inventory:{bottles:[],bread:0},task:null,
      pose:'standing',reason:'观察附近的生活机会',goal:'安稳地过一会儿',plan:[],
      waitUntil:0,cooldowns:{},memory:{failedTargets:{},lastActions:[],visited:[]},
      counters:{collected:0,recycled:0,bought:0,eaten:0,rests:0},
      candidates:[],lastInteraction:null,interruption:null
    }));
    for(const [x,z]of INITIAL_BOTTLES)this.spawnBottle(x,z,{silent:true});
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
    const p=value=>Array.isArray(value)?point(value[0],value[2]):point(value.x,value.z);
    for(const id of ['benchA','benchB','recycle','bakery'])if(spots[id]){
      const src=spots[id],dest=this.locations[id];if(src.stand)dest.stand=p(src.stand);if(src.seat){dest.seat=p(src.seat);dest.height=Array.isArray(src.seat)?src.seat[1]:src.seat.y;}
      if(src.contact)dest.contact=Array.isArray(src.contact)?{x:src.contact[0],y:src.contact[1],z:src.contact[2]}:copy(src.contact);
      if(Number.isFinite(src.yaw))dest.yaw=src.yaw;
    }
    for(const id of ['shelterA','shelterB'])if(spots[id])this.locations[id]=p(spots[id].stand||spots[id]);
    return this;
  }
  _event(type,actorId,message,extra={}){
    const event={sequence:++this.eventSequence,time:this.time,type,actorId,message,...extra};
    this.events.push(event);if(this.events.length>100)this.events.shift();return event;
  }
  _canStand(p,radius=.25){return p.x>=-5.8&&p.x<=5.8&&p.z>=-2&&p.z<=3.8&&!this.obstacles.some(r=>inside(p,r,radius+.02));}
  _clear(a,b,radius=.25){return !this.obstacles.some(r=>crosses(a,b,r,radius+.02));}
  _route(start,end,radius=start.radius??.25){
    if(!this._canStand(end,radius))return null;
    if(this._clear(start,end,radius))return [copy(end)];
    const nodes=[copy(start),copy(end)];
    for(const r of this.obstacles)for(const x of [r.minX-radius-.06,r.maxX+radius+.06])for(const z of [r.minZ-radius-.06,r.maxZ+radius+.06]){
      const p=point(x,z);if(this._canStand(p,radius))nodes.push(p);
    }
    const d=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),closed=new Set();d[0]=0;
    while(closed.size<nodes.length){
      let index=-1;for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&(index<0||d[i]<d[index]))index=i;
      if(index<0||!Number.isFinite(d[index]))break;
      if(index===1){const path=[];for(let i=1;i!==0;i=previous[i]){if(i<0)return null;path.unshift(nodes[i]);}return path;}
      closed.add(index);
      for(let j=0;j<nodes.length;j++)if(!closed.has(j)&&this._clear(nodes[index],nodes[j],radius)){
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
    if(a.inventory.bread>0)return ['eat'];
    if(a.money>=this.shop.price)return ['buy','eat'];
    if(a.inventory.bottles.length>0)return ['recycle','buy','eat'];
    return ['collect','recycle','buy','eat'];
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
    if(a.inventory.bread>0&&h>.04)add('eat',`meal-${a.id}`,point(a.x,a.z),40+h*100,'手里有面包，先填饱肚子');
    if(this.raining){
      const shelter=this.locations['shelter'+a.id]||this.locations.shelterA;
      add('shelter','shelter'+a.id,shelter,110-distance(a,shelter)*2,'下雨了，先到熟悉的屋檐下');
    }
    if(a.inventory.bread===0&&hungry&&a.money>=this.shop.price&&this.shop.open&&this.shop.stock>0&&!this._reservedByOther('bakery',a.id)){
      add('buy','bakery',this.locations.bakery.stand,35+h*85-distance(a,this.locations.bakery.stand)*2.2,'饿了，钱也够，去买一份面包');
    }
    if(a.inventory.bottles.length>0&&!this._reservedByOther('recycle',a.id)){
      const enough=a.money+a.inventory.bottles.length*this.recycling.unitValue>=this.shop.price;
      add('recycle','recycle',this.locations.recycle.stand,20+a.inventory.bottles.length*12+(hungry&&foodBudget?(enough?65:30):0)-distance(a,this.locations.recycle.stand)*2,'袋里已有瓶子，可以换成买食物的钱');
    }
    if(!this.raining&&a.inventory.bottles.length<3&&a.inventory.bread===0){
      for(const b of this.bottles)if(this._availableBottle(b,a)){
        const target=point(b.x,b.z+.43);
        const score=12+a.traits.industry*20+(hungry&&foodBudget?53:0)-distance(a,target)*4-f*18-(a.money>=this.shop.price?23:0)-this._recent(a,'collect')*2;
        add('collect',b.id,target,score, hungry&&foodBudget?'还差一点买面包的钱，附近的瓶子值得收集':'附近有可以收集的瓶子，顺路带走',{contact:{x:b.x,y:.16,z:b.z}});
      }
    }
    if(!this.raining){
      for(const id of ['benchA','benchB'])if(!this._reservedByOther(id,a.id)){
        const loc=this.locations[id];
        const score=15+f*88+a.traits.restfulness*17-distance(a,loc.stand)*2+(id===a.preferredSeat?8:0)-(hungry?18:0);
        add('rest',id,loc.stand,score,f>.5?'有些累了，回熟悉的长椅坐一会儿':'暂时没有急事，坐下看看街角');
      }
      for(const [i,p]of [point(-.2,2.8),point(1.3,.3),point(4.8,2.4)].entries()){
        if(distance(a,p)<1)continue;
        add('wander','walk-'+i,p,9+a.traits.curiosity*14-f*13-(hungry?14:0)-this._recent(a,'wander')*9,'附近走走，看看有没有新的事情');
      }
    }
    return candidates.sort((a,b)=>b.score-a.score);
  }
  _choose(a){
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
    if(!this._reserve(a,c))return false;
    const route=this._route(a,c.target||a);
    if(!route){this._release(a);a.memory.failedTargets[c.targetId]=this.time+12;return false;}
    const id=`run-${this.runSequence}-activity-${++this.taskSequence}`;
    a.goal=['collect','recycle','buy','eat'].includes(c.kind)&&a.needs.hunger>.38?'吃到一份面包':c.kind==='rest'?'恢复体力':c.kind==='shelter'?'找一个干燥的地方':'照顾眼前的小事';
    a.plan=a.goal==='吃到一份面包'?this._foodPlan(a):[c.kind];
    a.task={id,token:id+':0',epoch:0,kind:c.kind,label:LABELS[c.kind],targetId:c.targetId,
      phase:'approach',elapsed:0,duration:0,progress:0,from:point(a.x,a.z),to:copy(c.target||a),
      reason:c.reason,score:c.score,route,routeIndex:0,travelled:0,totalDistance:0,
      motion:'walk',contact:c.contact||this.locations[c.targetId]?.contact||null,
      waitForAcknowledgement:false,blockedFor:0,startedAt:this.time};
    let prev=a;for(const p of route){a.task.totalDistance+=distance(prev,p);prev=p;}
    a.task.duration=a.task.totalDistance/a.walkSpeed;
    a.reason=c.reason;a.pose='standing';a.interruption=null;
    this._event('decision',a.id,`${a.name}：${c.reason}`,{kind:c.kind,targetId:c.targetId,score:c.score,plan:a.plan.slice()});
    if(a.task.totalDistance<.035)this._arrive(a);
    return true;
  }
  _release(a){
    for(const key of Object.keys(this.resources))if(this.resources[key]===a.id)this.resources[key]=null;
    for(const b of this.bottles)if(b.reservedBy===a.id)b.reservedBy=null;
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
      a.yaw=Math.atan2(b.x-a.x,b.z-a.z);
    }else if(t.kind!=='eat')a.yaw=this.locations[t.targetId]?.yaw??a.yaw;
    const durations={collect:2.8,recycle:2.1,buy:2.2,eat:4.2};
    this._newPhase(a,'interact',durations[t.kind]||2,t.kind);
  }
  _move(a,dt){
    const t=a.task;if(!t)return;
    t.elapsed+=dt;
    const waypoint=t.detour||t.route[t.routeIndex];if(!waypoint){this._arrive(a);return;}
    const dx=waypoint.x-a.x,dz=waypoint.z-a.z,d=Math.hypot(dx,dz);
    if(d<.035){
      a.x=waypoint.x;a.z=waypoint.z;
      if(t.detour){t.detour=null;const route=this._route(a,t.to,a.radius);if(!route){this._fail(a,'让路后重新寻找可达的目标');return;}t.route=route;t.routeIndex=0;}
      else {t.routeIndex++;if(t.routeIndex>=t.route.length)this._arrive(a);}
      return;
    }
    let vx=dx/d,vz=dz/d;
    for(const other of this.actors)if(other!==a){
      const ox=other.x-a.x,oz=other.z-a.z,od=Math.hypot(ox,oz),ahead=(vx*ox+vz*oz)/Math.max(od,1e-6);
      if(od<.88&&od>.001&&ahead>.25){
        const strength=(.88-od)/.40;const sideX=vz,sideZ=-vx;
        vx+=sideX*strength;vz+=sideZ*strength;
      }
    }
    const length=Math.hypot(vx,vz);vx/=length;vz/=length;
    const speed=a.walkSpeed*(1-a.needs.fatigue*.13),step=Math.min(speed*dt,d);
    let next=point(a.x+vx*step,a.z+vz*step);
    const collision=this.actors.some(other=>other!==a&&distance(next,other)<a.radius+other.radius+.015&&distance(next,other)<distance(a,other)-1e-5);
    if(collision||!this._canStand(next,a.radius)||!this._clear(a,next,a.radius)){
      a.moving=false;a.speed=0;a.velocity=point(0,0);t.blockedFor+=dt;
      const blocker=this.actors.find(other=>other!==a&&distance(a,other)<1.05);
      if(blocker&&t.blockedFor>.25&&!t.detour&&(t.lastDetourAt||-10)<this.time-2&&
        (a.id>blocker.id||!blocker.task||blocker.task.phase!=='approach')){
        const ux=dx/d,uz=dz/d;
        // One agent yields into genuine free ground; the other keeps its route.
        // Test both sides because a fixed steering side can point into a planter.
        const offsets=[[uz,-ux],[-uz,ux],[-ux+uz,-uz-ux],[-ux-uz,-uz+ux]];
        for(const [sx,sz]of offsets){
          const sn=Math.hypot(sx,sz),target=point(a.x+sx/sn*.82,a.z+sz/sn*.82);
          if(this._canStand(target,a.radius)&&this._clear(a,target,a.radius)&&distance(target,blocker)>a.radius+blocker.radius+.12){
            const first=point(a.x+sx/sn*.035,a.z+sz/sn*.035);
            if(distance(first,blocker)<a.radius+blocker.radius+.015)continue;
            t.detour=target;t.lastDetourAt=this.time;t.blockedFor=0;
            this._event('yielded',a.id,`${a.name}稍微让开，让对方先过`);break;
          }
        }
      }
      if(t.blockedFor>5)this._fail(a,'道路暂时被占，先做别的事情');return;
    }
    t.blockedFor=0;a.x=next.x;a.z=next.z;a.moving=true;a.speed=speed;
    a.velocity=point(vx*speed,vz*speed);a.distanceTravelled+=step;t.travelled+=step;
    a.yaw+=angleDelta(a.yaw,Math.atan2(vx,vz))*Math.min(1,dt*8);
    t.progress=clamp(t.travelled/Math.max(t.totalDistance,.01));
    if(t.elapsed>Math.max(20,t.duration*3+8))this._fail(a,'没有及时到达，重新考虑路线');
  }
  _validatePending(a){
    const t=a.task;if(!t)return false;
    if(t.kind==='collect'){
      const b=this.bottle(t.targetId);return !!b&&this._availableBottle(b,a)&&b.reservedBy===a.id;
    }
    if(t.kind==='buy')return this.shop.open&&this.shop.stock>0&&a.money>=this.shop.price&&this.resources.bakery===a.id;
    if(t.kind==='recycle')return a.inventory.bottles.length>0&&this.resources.recycle===a.id;
    if(t.kind==='eat')return a.inventory.bread>0;
    if(t.kind==='rest')return this.resources[t.targetId]===a.id;
    return true;
  }
  _tickActor(a,dt){
    const t=a.task,resting=t?.kind==='rest'&&t.phase==='rest';
    a.needs.hunger=clamp(a.needs.hunger+dt*.0013);
    a.needs.fatigue=clamp(a.needs.fatigue+dt*(resting?-.011:a.moving?.002:.00045));
    for(const [id,until]of Object.entries(a.memory.failedTargets))if(until<=this.time)delete a.memory.failedTargets[id];
    if(!t){a.moving=false;a.speed=0;a.velocity=point(0,0);if(this.time>=a.waitUntil)this._choose(a);return;}
    if(t.phase==='approach'){
      if(!this._validatePending(a)){this._fail(a,t.kind==='buy'?'面包店现在无法交易':'原来的目标已经不能使用');return;}
      this._move(a,dt);return;
    }
    t.elapsed+=dt;t.progress=clamp(t.elapsed/Math.max(t.duration,.001));
    if(t.kind==='rest'&&(t.phase==='interact'||t.phase==='depart')){
      const u=smooth(t.progress);a.x=t.from.x+(t.to.x-t.from.x)*u;a.z=t.from.z+(t.to.z-t.from.z)*u;
    }
    if(t.phase==='rest'){
      if(t.kind==='rest'&&(t.elapsed>=t.duration||(a.needs.hunger>.82&&t.elapsed>4)||this.raining))this._departSeat(a,this.raining?'雨落下来了，准备去屋檐下':a.needs.hunger>.82?'肚子饿了，准备去找食物':'休息得差不多了');
      else if(t.kind==='shelter'&&(!this.raining||t.elapsed>=t.duration))this._finish(a,true,this.raining?'仍在下雨，继续留意屋檐附近':'雨停了，可以重新活动');
      return;
    }
    if(t.waitForAcknowledgement&&t.elapsed>t.duration+30)this._fail(a,'动作执行尚未确认，已安全取消');
  }
  update(dt){
    finite(dt,'dt');if(dt<0)throw Error('Negative dt');if(this.paused||dt===0)return this;
    if(dt>60)throw Error('A single update must be at most 60 seconds');
    let remaining=dt;while(remaining>1e-8){const step=Math.min(.05,remaining);this.time+=step;for(const a of this.actors)this._tickActor(a,step);remaining-=step;}
    return this;
  }
  /** Returns {accepted,committed,reason}; stale or duplicate tokens are rejected. */
  acknowledgeInteraction(actorId,success,details={}){
    const a=this.actor(actorId),t=a?.task;
    if(!a||!t)return {accepted:false,committed:false,reason:'no-active-task'};
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
        this._event('seated',a.id,`${a.name}坐稳了，暂时休息`);return {accepted:true,committed:true,reason:'seated'};
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
      default:return {accepted:false,committed:false,reason:'unsupported-interaction'};
    }
    this._finish(a,true,'完成了眼前这件事');return {accepted:true,committed:true,reason:'world-state-committed'};
  }
  _departSeat(a,reason){
    if(!a.task||a.task.kind!=='rest'||a.task.phase==='depart')return;
    const loc=this.locations[a.task.targetId];a.reason=reason;a.pose='standing-up';
    this._newPhase(a,'depart',1.45,'stand',point(a.x,a.z),loc.stand);
  }
  _finish(a,success,reason){
    const t=a.task;if(!t)return;
    this._release(a);a.memory.lastActions.push({kind:t.kind,time:this.time,success});if(a.memory.lastActions.length>12)a.memory.lastActions.shift();
    a.cooldowns[t.kind]=this.time+({rest:5,collect:1,recycle:2,buy:5,eat:4,wander:3,shelter:.6}[t.kind]||1);
    a.task=null;a.moving=false;a.speed=0;a.velocity=point(0,0);a.pose='standing';a.reason=reason;
    a.waitUntil=this.time+this.rng.range(.45,1.3);
  }
  _fail(a,reason){
    const t=a.task;if(!t)return;
    a.memory.failedTargets[t.targetId]=this.time+12;
    this._event('failed',a.id,`${a.name}：${reason}`,{kind:t.kind,targetId:t.targetId});
    // A seated person must stand visibly before losing its reserved seat.
    if(t.kind==='rest'&&(t.phase==='rest'||t.phase==='interact')&&t.progress>.5){
      a.interruption=reason;this._departSeat(a,reason);return;
    }
    this._finish(a,false,reason);
  }
  interrupt(actorId,reason='受到打扰，重新看看眼前的情况'){
    const a=this.actor(actorId);if(!a)return false;
    a.interruption=reason;this._event('interrupted',a.id,`${a.name}被打断了`);
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
    this.raining=!!value;this._event('weather',null,this.raining?'院子里开始落雨':'雨停了，地面还留着水光',{raining:this.raining});
    for(const a of this.actors){
      if(this.raining&&a.task?.kind==='rest'&&a.task.phase==='rest')this._departSeat(a,'下雨了，起身去屋檐下');
      else if(this.raining&&a.task?.phase==='approach'&&['collect','rest','wander'].includes(a.task.kind))this.interrupt(a.id,'开始下雨，先去避雨');
      else if(!a.task)a.waitUntil=this.time;
    }
    return this.raining;
  }
  spawnBottle(x,z,{silent=false}={}){
    if(x===undefined||z===undefined){
      let p=null;for(let i=0;i<30;i++){const q=point(this.rng.range(-5.25,5.25),this.rng.range(.2,3.25));if(this._canStand(point(q.x,q.z+.43))&&this.actors.every(a=>distance(a,q)>.65)){p=q;break;}}
      if(!p)return null;x=p.x;z=p.z;
    }
    finite(x,'bottle.x');finite(z,'bottle.z');
    if(!this._canStand(point(x,z+.43)))return null;
    const b={id:`bottle-${++this.bottleSequence}`,x,z,y:.16,state:'ground',owner:null,reservedBy:null,spawnedAt:this.time};
    this.bottles.push(b);if(!silent)this._event('bottle-spawned',null,'院子里多了一只可回收的瓶子',{bottleId:b.id,x,z});return b;
  }
  removeBottle(id){
    const b=this.bottle(id);if(!b||b.state!=='ground')return false;
    const holder=b.reservedBy;b.state='removed';b.owner=null;b.reservedBy=null;
    this._event('bottle-removed',null,'这只瓶子已被拿走',{bottleId:id});
    const a=holder&&this.actor(holder);if(a?.task?.targetId===id)this._fail(a,'瓶子被别人先拿走了');return true;
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
      if(b.reservedBy&&this.actor(b.reservedBy)?.task?.targetId!==b.id)errors.push(`${b.id}:stale-reservation`);
    }
    for(const [id,owner]of Object.entries(this.resources))if(owner&&this.actor(owner)?.task?.targetId!==id)errors.push(`${id}:stale-resource-reservation`);
    if(this.shop.stock<0||!Number.isInteger(this.shop.stock))errors.push('negative-shop-stock');
    return {ok:errors.length===0,errors};
  }
  snapshot(){return copy({version:LIFE_VERSION,seed:this.seed,time:this.time,paused:this.paused,raining:this.raining,
    actors:this.actors,bottles:this.bottles,shop:this.shop,recycling:this.recycling,resources:this.resources,events:this.events,
    invariants:this.checkInvariants(),scope:'need-driven decisions; bounded food prerequisites; spatial reservations; externally acknowledged interaction commits; no whole-body physics claim'});}
}

export default LifeSimulation;

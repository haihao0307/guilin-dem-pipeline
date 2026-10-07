// Deterministic, renderer-independent authority for the local single-player game.
export const TICK_HZ=30, DT=1/TICK_HZ, FRONT_X=5;
export const COACHES=Object.freeze([{id:'coach-1',x:-11.1,length:6.2,frontDoor:-8.7,rearDoor:-13.5},{id:'coach-2',x:-18,length:6.2,frontDoor:-15.6,rearDoor:-20.4}]);
export const SEATS=Object.freeze(COACHES.flatMap((car,ci)=>[-1.5,-.5,.5,1.5].flatMap((x,row)=>[-.62,.62].map((z,side)=>({id:ci*8+row*2+side,coach:ci,position:[car.x+x,1.04,z]})))));
export const ROLE_COMMANDS=Object.freeze({driver:['start','throttle-up','throttle-down','brake','station-action','recover','pause'],passenger:['request-stop','wave']});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function seedNumber(value){let s=2166136261;for(const c of String(value)){s^=c.charCodeAt(0);s=Math.imul(s,16777619);}return s>>>0;}
class Random{constructor(seed){this.s=seed>>>0;}next(){let t=this.s=(this.s+0x6d2b79f5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}}
const NAMES=['杉林','石桥','河湾','松溪','麦田','白鹭','青丘','榆树','落霞','山口'];
function route(seed){const r=new Random(seedNumber(seed)),list=[];let at=72;for(let i=0;i<180;i++){const level=Math.min(4,Math.floor(i/4));if(i)at+=170+r.next()*95-level*8;list.push({index:i,name:NAMES[i%NAMES.length]+'站',target:at,level,limit:[54,50,45,42,38][level],wet:i>2&&r.next()<.30,waiting:Math.min(7,2+Math.floor(r.next()*4)+Math.floor(level/2)),radius:Math.max(2.2,2.8-level*.12),peopleSeed:Math.floor(r.next()*0xffffffff)});}return list;}
function makePath(points,kind,delay=0){return{points:points.map(p=>p.slice()),segment:0,progress:0,kind,delay};}
export class Session{
  constructor({seed='LAOSIJi-2026',durationMinutes=10}={}){
    this.config={seed:String(seed),durationMinutes:[10,15,20].includes(Number(durationMinutes))?Number(durationMinutes):10};
    this.route=route(this.config.seed);this.tick=0;this.elapsed=0;this.accumulator=0;this.distance=0;this.velocity=0;this.throttle=0;this.brake=false;this.paused=false;this.started=false;this.finishing=false;
    this.phase='ready';this.phaseTime=0;this.door=0;this.stopStable=0;this.reverse=false;this.stationIndex=0;this.actors=[];this.rocks=[];this.events=[];this.eventId=0;this.sequence=0;this.inputLog=[];this.nextRockId=0;
    this.stats={score:0,pickedUp:0,delivered:0,lateDropOff:0,stops:0,missed:0,recovered:0,stoneHits:0,combo:0,bestCombo:0,satisfaction:85,accuracyTotal:0};
    this.station=null;this.stationStates=new Map();this.activateStation(0);
    for(const [i,seatId] of [0,3,9,12].entries())this.actors.push({id:'start-'+i,appearance:i,kind:'seated',frame:'train',position:SEATS[seatId].position.slice(),seatId,destination:i<2?0:1,walk:0,pose:'seated',age:0});
  }
  emit(type,data={}){this.events.push({id:++this.eventId,tick:this.tick,type,...data});if(this.events.length>240)this.events.shift();}
  activateStation(index){
    this.stationIndex=index;const plan=this.route[index];if(!plan){this.finish();return;}
    this.station={...plan,missed:false,recovered:false,completed:false,opened:false,walkStop:false,boarded:0,alighted:0,stonePenalty:0,angerAge:0};
    this.stationStates.set(index,this.station);const r=new Random(plan.peopleSeed);
    for(let i=0;i<plan.waiting;i++){const coach=i%2,door=COACHES[coach].frontDoor;this.actors.push({id:'s'+index+'p'+i,appearance:Math.floor(r.next()*12),kind:'waiting',frame:'world',position:[plan.target+door-FRONT_X+(r.next()-.5)*1.3,.82,3.0+Math.floor(i/2)*.55],station:index,destination:index+1+Math.floor(r.next()*3),seatId:null,walk:0,pose:'idle',age:0,throws:0,lastThrow:-10});}
    this.emit('next-station',{station:index,name:plan.name,wet:plan.wet});
  }
  command(type,value,meta={}){
    const role=meta.role||'driver',actorId=meta.actorId||'local-driver';
    if(role!=='driver'||!ROLE_COMMANDS.driver.includes(type))return{accepted:false,reason:'role-not-enabled'};
    const input={version:1,tick:this.tick,sequence:++this.sequence,actorId,role,type,value:value??null};this.inputLog.push(input);return this.apply(input);
  }
  apply(input){
    const {type,value}=input;
    if(type==='pause'){if(this.started&&this.phase!=='summary')this.paused=value===null?!this.paused:!!value;return{accepted:true};}
    if(type==='start'){if(!this.started){this.started=true;this.phase='running';this.emit('start');}return{accepted:true};}
    if(!this.started||this.paused||this.phase==='summary')return{accepted:false,reason:'inactive'};
    if(type==='brake'){this.brake=!!value;if(this.brake){this.throttle=0;this.reverse=false;}return{accepted:true};}
    if(type==='station-action'){return this.stationAction();}
    if(type==='recover'){if(this.canRecover()){this.reverse=true;this.throttle=0;this.brake=false;this.emit('recovering');return{accepted:true};}return{accepted:false,reason:'stop-before-reverse'};}
    if(this.serviceLocked())return{accepted:false,reason:'doors-interlock'};
    if(type==='throttle-up'){this.reverse=false;this.brake=false;this.throttle=clamp(this.throttle+1,-2,3);}
    if(type==='throttle-down'){this.reverse=false;this.throttle=clamp(this.throttle-1,-2,3);}
    return{accepted:true};
  }
  serviceLocked(){return['doors-opening','unloading','boarding','ready-depart','doors-closing'].includes(this.phase);}
  canRecover(){return!!this.station&&!this.station.completed&&this.distance>this.station.target+this.station.radius&&this.distance-this.station.target<=40&&Math.abs(this.velocity)<.35&&!this.serviceLocked();}
  platformCoversDoors(){const min=this.station.target-31,max=this.station.target-7;return COACHES.every(c=>[c.frontDoor,c.rearDoor].every(x=>{const world=this.distance+x-FRONT_X;return world>=min+.22&&world<=max-.22;}));}
  canOpen(){return!!this.station&&!this.station.completed&&Math.abs(this.velocity)<.35&&this.stopStable>=.8&&Math.abs(this.station.target-this.distance)<=7&&this.platformCoversDoors();}
  stationAction(){
    if(this.phase==='ready-depart'){this.phase='doors-closing';this.phaseTime=0;this.emit('doors-closing');return{accepted:true};}
    if(this.serviceLocked())return{accepted:false,reason:'passengers-moving'};
    if(!this.canOpen())return{accepted:false,reason:'not-stopped-at-platform'};
    const s=this.station;s.opened=true;s.walkStop=Math.abs(s.target-this.distance)>s.radius;if(s.missed){s.recovered=true;this.stats.recovered++;this.stats.satisfaction=clamp(this.stats.satisfaction+3,0,100);}if(s.walkStop)this.stats.satisfaction=clamp(this.stats.satisfaction-2,0,100);
    this.velocity=0;this.throttle=0;this.brake=false;this.reverse=false;this.phase='doors-opening';this.phaseTime=0;
    for(const a of this.actors)if(a.station===s.index&&a.kind==='angry'){a.kind='waiting';a.pose='idle';}
    this.emit('doors-opening',{offset:s.target-this.distance,walkStop:s.walkStop,recovered:s.recovered});return{accepted:true};
  }
  advance(seconds){if(!this.started||this.paused||this.phase==='summary')return;this.accumulator+=clamp(seconds,0,.25);while(this.accumulator>=DT){this.accumulator-=DT;this.step();}}
  stepTicks(count){for(let i=0;i<count;i++){if(!this.started||this.paused||this.phase==='summary')break;this.step();}}
  step(){
    this.tick++;this.elapsed+=DT;this.phaseTime+=DT;
    if(this.elapsed>=this.config.durationMinutes*60)this.finishing=true;
    const s=this.station;
    if(!this.serviceLocked()){
      const old=this.velocity,braking=this.finishing||this.brake;
      let acceleration=this.reverse?clamp((-1.6-this.velocity)*1.5,-.9,.9):this.throttle>0?this.throttle*.48:this.throttle<0?this.throttle*.60:-.11*Math.sign(this.velocity);
      if(braking)acceleration=-Math.sign(old)*(s.wet?2.40:3.10);
      let next=old+acceleration*DT;if(braking&&old*next<=0)next=0;if(!this.reverse&&next<0)next=0;
      this.velocity=clamp(next,-1.8,18);this.distance=Math.max(0,this.distance+this.velocity*DT);
      if(this.velocity*3.6>s.limit+3)this.stats.satisfaction=clamp(this.stats.satisfaction-DT*.16,0,100);
      if(Math.abs(this.velocity)<.35&&Math.abs(s.target-this.distance)<=7)this.stopStable+=DT;else this.stopStable=0;
      if(!s.missed&&!s.completed&&!s.opened&&this.distance>s.target+8){s.missed=true;this.stats.missed++;this.stats.combo=0;this.stats.satisfaction=clamp(this.stats.satisfaction-8,0,100);this.emit('missed-station',{station:s.index,name:s.name});for(const a of this.actors)if(a.station===s.index&&a.kind==='waiting'){a.kind='angry';a.pose='running';}}
      if(s.missed&&!s.opened&&this.distance>s.target+40){this.emit('station-left-behind',{station:s.index});this.activateStation(s.index+1);}
      if(this.finishing&&Math.abs(this.velocity)<.05)this.finish();
    }else this.velocity=0;
    this.updateDoors();this.updateActors();this.updateAnger();this.updateRocks();
    this.actors=this.actors.filter(a=>!(a.kind==='gone'&&a.age>5)&&!(a.frame==='world'&&a.position[0]<this.distance-95&&!a.path));
  }
  updateDoors(){
    if(this.phase==='doors-opening'){this.door=clamp(this.phaseTime/1.1,0,1);if(this.door===1)this.startUnloading();}
    else if(this.phase==='unloading'&&!this.actors.some(a=>a.kind==='alighting'))this.startBoarding();
    else if(this.phase==='boarding'&&!this.actors.some(a=>a.kind==='boarding'))this.completeStop();
    else if(this.phase==='ready-depart'&&this.finishing){this.phase='doors-closing';this.phaseTime=0;}
    else if(this.phase==='doors-closing'){this.door=clamp(1-this.phaseTime/1.1,0,1);if(this.door===0){this.emit('departed',{station:this.station.index});if(this.finishing)this.finish();else{this.activateStation(this.station.index+1);this.phase='running';this.phaseTime=0;this.stopStable=0;this.throttle=1;}}}
  }
  toWorld(point){return[point[0]+this.distance-FRONT_X,point[1],point[2]];}
  startUnloading(){
    this.phase='unloading';this.phaseTime=0;let delay=0;
    for(const a of this.actors)if(a.kind==='seated'&&a.destination<=this.station.index){const seat=SEATS[a.seatId],car=COACHES[seat.coach],p=this.toWorld(a.position),door=this.distance+car.rearDoor-FRONT_X;a.kind='alighting';a.frame='world';a.position=p;a.pose='walking';a.path=makePath([p,[p[0],1.04,0],[door,1.04,0],[door,1.04,1.18],[door,.96,1.68],[door,.82,2.25],[door,.82,4.7],[door+1.1,.82,5.0]],'alight',delay);a.seatId=null;delay+=.22;}
    this.emit('unloading');
  }
  startBoarding(){
    this.phase='boarding';this.phaseTime=0;const used=new Set(this.actors.filter(a=>a.seatId!==null&&a.seatId!==undefined).map(a=>a.seatId)),free=SEATS.filter(s=>!used.has(s.id));let delay=0;
    const queue=this.actors.filter(a=>a.station===this.station.index&&a.kind==='waiting');
    for(const a of queue){const preferred=free.findIndex(s=>s.coach===Number(a.id.match(/p(\d+)/)?.[1]||0)%2),seat=free.splice(preferred<0?0:preferred,1)[0];if(!seat){a.pose='waving';continue;}const car=COACHES[seat.coach],door=this.distance+car.frontDoor-FRONT_X,target=this.toWorld(seat.position),p=a.position.slice();a.seatId=seat.id;a.kind='boarding';a.pose='walking';a.path=makePath([p,[door,.82,p[2]],[door,.82,2.25],[door,.96,1.68],[door,1.04,1.18],[door,1.04,0],[target[0],1.04,0],target],'board',delay);delay+=.27;}
    this.emit('boarding',{count:queue.length,space:16-used.size});
  }
  updateActors(){
    for(const a of this.actors){a.age+=DT;if(!a.path)continue;const p=a.path;if(p.delay>0){p.delay-=DT;continue;}let budget=1.65*DT;
      while(budget>0&&p.segment<p.points.length-1){const from=p.points[p.segment],to=p.points[p.segment+1],length=dist(from,to),remain=length-p.progress;if(remain<=budget+.000001){a.position=to.slice();budget-=remain;p.segment++;p.progress=0;}else{p.progress+=budget;const u=length?p.progress/length:1;a.position=from.map((v,i)=>v+(to[i]-v)*u);budget=0;}a.walk+=DT*8;a.heading=Math.atan2(-(to[2]-from[2]),to[0]-from[0]);}
      if(p.segment>=p.points.length-1){a.path=null;if(p.kind==='board'){a.kind='seated';a.frame='train';a.position=SEATS[a.seatId].position.slice();a.pose='seated';this.stats.pickedUp++;this.station.boarded++;this.stats.score+=Math.round(10*(1+Math.min(this.stats.combo,5)*.15));this.emit('passenger-seated',{actor:a.id,seat:a.seatId});}else if(p.kind==='alight'){const end=a.position.slice(),late=a.destination<this.station.index;a.kind='leaving';a.pose='walking';a.path=makePath([end,[end[0]+1.2,.82,5.35],[end[0]+1.2,.45,5.8],[end[0]+2,.14,6.2],[end[0]+4.5,.14,6.4]],'leave');this.stats.delivered++;this.station.alighted++;this.stats.score+=late?10:25;if(late){this.stats.lateDropOff++;this.stats.satisfaction=clamp(this.stats.satisfaction-2,0,100);}this.emit('passenger-delivered',{actor:a.id,late});}else{a.kind='gone';a.pose='idle';a.age=0;}}
    }
  }
  completeStop(){
    const s=this.station;if(s.completed)return;s.completed=true;this.phase='ready-depart';this.phaseTime=0;
    const error=Math.abs(s.target-this.distance),accuracy=Math.max(0,1-error/7);this.stats.accuracyTotal+=accuracy;this.stats.stops++;if(!s.missed)this.stats.combo++;this.stats.bestCombo=Math.max(this.stats.bestCombo,this.stats.combo);
    this.stats.score+=Math.round((35+accuracy*35)*(1+Math.min(this.stats.combo,5)*.12));this.stats.satisfaction=clamp(this.stats.satisfaction+4+accuracy*3,0,100);
    const left=this.actors.filter(a=>a.station===s.index&&a.kind==='waiting').length;if(left)this.stats.satisfaction=clamp(this.stats.satisfaction-left,0,100);
    this.emit('stop-complete',{accuracy,boarded:s.boarded,alighted:s.alighted,left});
  }
  updateAnger(){
    const s=this.station;if(!s.missed||s.opened||s.completed)return;s.angerAge+=DT;
    const angry=this.actors.filter(a=>a.station===s.index&&a.kind==='angry');
    for(let i=0;i<angry.length;i++){const a=angry[i],previous=a.position[0];a.position[0]=Math.min(s.target-7.5,a.position[0]+1.8*DT);a.walk+=DT*10;a.heading=0;a.pose=a.position[0]>previous?'running':'angry';
      if(a.throws<2&&s.angerAge>.65+i*.22+a.throws*1.5&&this.distance-s.target<25){this.throwStone(a,i);a.throws++;a.lastThrow=this.elapsed;}
    }
  }
  throwStone(actor,index){
    const t=.85+(index%3)*.08,start=[actor.position[0]+.15,actor.position[1]+.9,actor.position[2]-.1],localX=clamp(start[0]-this.distance+FRONT_X,-20,-9),target=[this.distance+this.velocity*t+localX-FRONT_X,1.75,1.0],g=8;
    this.rocks.push({id:++this.nextRockId,stationIndex:this.stationIndex,position:start,velocity:[(target[0]-start[0])/t,(target[1]-start[1]+g*t*t/2)/t,(target[2]-start[2])/t],age:0,hit:false,landed:false});this.emit('stone-thrown',{actor:actor.id});
  }
  updateRocks(){
    const boxes=[[-1.85,4.8,1.05,3.35],[-7.9,-1.9,1.05,3.5],[-14.2,-8,1.02,3.45],[-21.1,-14.9,1.02,3.45]];
    for(const rock of this.rocks){rock.age+=DT;if(rock.hit||rock.landed)continue;rock.velocity[1]-=8*DT;for(let i=0;i<3;i++)rock.position[i]+=rock.velocity[i]*DT;const x=rock.position[0]-this.distance+FRONT_X;
      const car=boxes.findIndex(b=>x>=b[0]-.08&&x<=b[1]+.08&&rock.position[1]>=b[2]&&rock.position[1]<=b[3]&&Math.abs(rock.position[2])<1.15);
      if(car>=0){rock.hit=true;rock.age=0;this.stats.stoneHits++;const source=this.stationStates.get(rock.stationIndex);if(source&&source.stonePenalty<9){source.stonePenalty++;this.stats.satisfaction=clamp(this.stats.satisfaction-1,0,100);}this.emit('stone-hit',{car,point:[x,rock.position[1],rock.position[2]]});}
      else if(rock.position[1]<.16){rock.position[1]=.16;rock.landed=true;rock.age=0;}
    }
    this.rocks=this.rocks.filter(r=>(r.hit||r.landed)?r.age<.55:r.age<3);
  }
  finish(){if(this.phase==='summary')return;this.phase='summary';this.velocity=0;this.throttle=0;this.brake=false;this.reverse=false;this.emit('session-finished',{score:this.stats.score});}
  view(){const s=this.station,remaining=s.target-this.distance,standard=this.canOpen()&&Math.abs(remaining)<=s.radius;return{version:1,tick:this.tick,seed:this.config.seed,elapsed:this.elapsed,duration:this.config.durationMinutes*60,remainingTime:Math.max(0,this.config.durationMinutes*60-this.elapsed),phase:this.phase,paused:this.paused,started:this.started,finishing:this.finishing,distance:this.distance,velocity:this.velocity,speedKmh:Math.abs(this.velocity)*3.6,throttle:this.throttle,brake:this.brake,reverse:this.reverse,door:this.door,station:{...s,remaining,canOpen:this.canOpen(),standard,canRecover:this.canRecover(),platformCoverage:this.platformCoversDoors()},brakingDistance:this.velocity*this.velocity/(2*(s.wet?2.40:3.10))+Math.abs(this.velocity)*.4,onboard:this.actors.filter(a=>a.kind==='seated').length,actors:this.actors,rocks:this.rocks,nearbyStations:this.route.filter(p=>p.target-this.distance>-65&&p.target-this.distance<65).map(p=>({...p,...this.stationStates.get(p.index)})),stats:{...this.stats},events:this.events};}
  replayPacket(){return{version:1,config:{...this.config},ticks:this.tick,inputs:this.inputLog.map(x=>({...x}))};}
  signature(){return JSON.stringify({tick:this.tick,distance:+this.distance.toFixed(6),velocity:+this.velocity.toFixed(6),phase:this.phase,station:this.stationIndex,stats:this.stats,actors:this.actors.map(a=>({id:a.id,kind:a.kind,seat:a.seatId,position:a.position.map(v=>+v.toFixed(6))}))});}
}
export function replay(packet){const game=new Session(packet.config),inputs=packet.inputs.slice().sort((a,b)=>a.tick-b.tick||a.sequence-b.sequence);let i=0;while(game.tick<packet.ticks){while(i<inputs.length&&inputs[i].tick===game.tick)game.apply(inputs[i++]);if(!game.started||game.paused)throw new Error('Replay is paused before its final tick');game.step();}while(i<inputs.length&&inputs[i].tick===game.tick)game.apply(inputs[i++]);game.inputLog=inputs.map(x=>({...x}));game.sequence=inputs.reduce((n,x)=>Math.max(n,x.sequence),0);return game;}

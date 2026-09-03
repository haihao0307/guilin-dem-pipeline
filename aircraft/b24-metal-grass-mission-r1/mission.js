import * as T from 'three';
const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
export const DUR=330;
export const PHASES=[
 ['ready','地面待命',0,4],['engine-start','四发顺序启动',4,18],['warmup','暖机检查',18,26],['taxi','进入草地跑道',26,36],['takeoff','加速滑跑',36,56],['rotate','抬轮离地',56,62],['climb','爬升与收轮',62,90],['cruise','平稳巡航',90,112],['bay-open','打开弹舱',112,118],['release','依次投放',118,126],['bay-close','关闭弹舱',126,132],['return','转弯返航',132,170],['gear-down','放轮与检查',170,181],['approach','对正跑道进近',181,202],['flare','拉平着陆',202,210],['rollout','接地与减速',210,225],['taxi-back','滑回起点',225,321],['shutdown','顺序关车',321,330]
].map(([id,label,start,end],i)=>({id,label,start,end,index:i}));
export function smooth(a,b,t){t=clamp((t-a)/(b-a),0,1);return t*t*(3-2*t);}
function h(a,b,v0,v1,u,d){const u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*a+(u3-2*u2+u)*d*v0+(-2*u3+3*u2)*b+(u3-u2)*d*v1;}
export class Mission {
 constructor(plane,audio,effects){this.plane=plane;this.audio=audio;this.effects=effects;this.time=0;this.rate=1;this.running=false;this.loop=true;this.loops=0;this.dropped=0;this.events=[];this.velocity=new T.Vector3();this.rpm=[0,0,0,0];this.releaseTimes=[119,120.4,121.8,123.2];this.flight=new T.CatmullRomCurve3([[0,10,340],[0,65,1120],[0,265,2430],[1370,550,3380],[3040,580,1900],[3050,600,420],[2460,530,-890],[1150,330,-2470],[0,160,-2300],[0,72,-1400],[0,15,-600]].map(p=>new T.Vector3(...p)),false,'centripetal');this.flight.arcLengthDivisions=1600;this.flight.updateArcLengths();this.flightLength=this.flight.getLength();this.taxiCurve=new T.CatmullRomCurve3([[0,0,60],[0,0,180],[35,0,230],[73,0,185],[73,0,60],[73,0,-555],[73,0,-677],[38,0,-714],[0,0,-684],[0,0,-620]].map(p=>new T.Vector3(...p)),false,'centripetal');this.taxiCurve.arcLengthDivisions=1000;this.taxiCurve.updateArcLengths();this.position=new T.Vector3();this.forward=new T.Vector3(0,0,1);this.bank=0;this.phase=PHASES[0];this.sample(0,0);}
 path(t){let p=new T.Vector3(0,0,-620),u;
  if(t>=26&&t<36){u=(t-26)/10;p.z=h(-620,-555,0,6.5,u,10);}
  else if(t>=36&&t<56){u=t-36;p.z=-555+6.5*u+1.125*u*u;}
  else if(t>=56&&t<62){u=(t-56)/6;p.z=h(25,340,51.5,55,u,6);p.y=h(0,10,0,55*(55/780),u,6);}
  else if(t>=62&&t<202){u=(t-62)/140;const arc=h(0,1,55/this.flightLength,50/this.flightLength,u,140);p=this.flight.getPointAt(clamp(arc,0,1));}
  else if(t>=202&&t<210){u=(t-202)/8;p.z=h(-600,-240,50,40,u,8);p.y=h(15,0,-50*(57/800),0,u,8);}
  else if(t>=210&&t<225){u=(t-210)/15;p.z=h(-240,60,40,0,u,15);}
  else if(t>=225&&t<321){u=smooth(225,321,t);p=this.taxiCurve.getPointAt(u);}
  p.y+=this.plane.groundY;return p;
 }
 sample(t,dt){this.phase=PHASES.find(p=>t>=p.start&&t<p.end)||PHASES.at(-1);this.position.copy(this.path(t));const prev=this.path(Math.max(0,t-.02)),next=this.path(Math.min(DUR,t+.02));this.velocity.copy(next).sub(prev).multiplyScalar(1/(Math.min(DUR,t+.02)-Math.max(0,t-.02)||.04));let f=this.velocity.clone();if(f.lengthSq()<.02){if(t>318||t<27)f.set(0,0,1);else f.copy(this.forward);}f.normalize();this.forward.copy(f);
  const yaw=Math.atan2(f.x,f.z),grounded=t<56||t>=210;
  let pitch=grounded?this.plane.groundPitch:-Math.asin(clamp(f.y,-.3,.3))-.025;
  if(t>=56&&t<62)pitch=lerp(this.plane.groundPitch,-Math.asin(clamp(f.y,-.3,.3))-.025,smooth(56,60,t));
  if(t>=202&&t<210)pitch=lerp(-.065,this.plane.groundPitch,smooth(204,210,t));
  let targetBank=0;
  if(t>66&&t<192){const v2=this.path(t+.5).sub(this.path(t+.45)).normalize(),yaw2=Math.atan2(v2.x,v2.z);const dyaw=Math.atan2(Math.sin(yaw2-yaw),Math.cos(yaw2-yaw))/.48;targetBank=clamp(-Math.atan(this.velocity.length()*dyaw/9.81),-.38,.38);}
  this.bank=dt>0?lerp(this.bank,targetBank,1-Math.exp(-dt*2.5)):targetBank;
  this.plane.group.position.copy(this.position);this.plane.group.rotation.set(pitch,yaw,this.bank,'YXZ');
  this.gear=t<66?1:t<78?1-smooth(66,78,t):t<170?0:t<181?smooth(170,181,t):1;
  this.bay=t<112?0:t<118?smooth(112,118,t):t<126?1:t<132?1-smooth(126,132,t):0;
  this.plane.setMechanics(this.gear,this.bay);
  const order=[1,2,0,3];for(let i=0;i<4;i++){const start=4+order.indexOf(i)*3;let r=950*smooth(start,start+3,t);if(t>=36)r=lerp(1000,2200,smooth(36,47,t));if(t>=70)r=1900;if(t>=176)r=1550;if(t>=210)r=lerp(1450,850,smooth(210,225,t));if(t>=321)r=850*(1-smooth(321+order.indexOf(i)*1.5,325.5+order.indexOf(i)*1.5,t));this.rpm[i]=Math.max(0,r);}
  this.plane.spin(dt,this.rpm);this.plane.group.updateMatrixWorld(true);this.grounded=grounded;
 }
 tick(dt){if(!this.running)return;const step=dt*this.rate,old=this.time;this.time=Math.min(DUR,old+step);this.sample(this.time,step);
  for(const rt of this.releaseTimes)if(old<rt&&this.time>=rt){const p=this.path(rt);p.y-=1.0;const v=this.path(rt+.02).sub(this.path(rt-.02)).multiplyScalar(25);this.effects.release(p,v,rt,this.dropped%2===0?-.55:.55);this.dropped++;this.audio.oneShot('release');this.events.push({event:'release',at:rt});}
  if(old<210&&this.time>=210){this.audio.oneShot('touchdown');this.events.push({event:'touchdown',at:210});}
  if(this.time>=DUR){this.loops++;this.events.push({event:'complete',at:DUR});if(this.loop){this.time=0;this.dropped=0;this.effects.reset();this.plane.reset();this.sample(0,0);}else this.running=false;}
 }
 reset(){this.running=false;this.time=0;this.dropped=0;this.loops=0;this.events=[];this.effects.reset();this.plane.reset();this.sample(0,0);}
 seek(t){this.time=clamp(t,0,DUR);this.effects.reset();this.dropped=this.releaseTimes.filter(x=>x<=this.time).length;for(let i=0;i<this.dropped;i++){const rt=this.releaseTimes[i],p=this.path(rt);p.y-=1;const v=this.path(rt+.02).sub(this.path(rt-.02)).multiplyScalar(25);this.effects.release(p,v,rt,i%2===0?-.55:.55,true);}this.sample(this.time,0);this.effects.update(this.time,true);}
 state(){return {time:this.time,duration:DUR,phase:this.phase.id,phaseIndex:this.phase.index,position:this.position.toArray(),forward:this.forward.toArray(),velocity:this.velocity.toArray(),speed:this.velocity.length(),altitude:Math.max(0,this.position.y-this.plane.groundY),gear:this.gear,bay:this.bay,rpm:[...this.rpm],spinAngles:[...this.plane.angles],released:this.dropped,impacts:this.effects.impactCount,running:this.running,loops:this.loops,events:[...this.events]};}
}

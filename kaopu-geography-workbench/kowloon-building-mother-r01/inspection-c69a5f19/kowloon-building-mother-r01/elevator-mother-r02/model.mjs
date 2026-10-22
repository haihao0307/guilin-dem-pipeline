/** KAOPU original learning model. Not a real elevator safety controller. */
export const DESIGN=Object.freeze({speed:1.5,acceleration:.75,doorSeconds:1.8,dwellSeconds:3,lockSeconds:.25,levelTolerance:.01});
export function floorTable({height=3.4,ground='G',basements=2,top=1}={}){
 if(!Number.isFinite(height)||height<3||height>5||![0,1,2].includes(basements)||!Number.isInteger(top)||top<1||top>4||!['G','F'].includes(ground))throw Error('楼层参数超出设计范围');
 return Array.from({length:basements+top+1},(_,j)=>{const i=j-basements;return {id:i<0?'B'+(-i):i===0?'ground':'L'+i,label:i<0?'B'+(-i):i===0?ground:String(i),elevation:i*height,served:true};});
}
export function validateFloors(floors){if(!Array.isArray(floors)||floors.length<2||floors.length>7)throw Error('需要 2–7 层');const ids=new Set();let y=-Infinity;for(const f of floors){if(typeof f.id!=='string'||!f.id||ids.has(f.id)||typeof f.label!=='string'||!Number.isFinite(f.elevation)||f.elevation-y<3||typeof f.served!=='boolean')throw Error('楼层表无效');ids.add(f.id);y=f.elevation;}if(floors.filter(f=>f.served).length<2)throw Error('至少两个服务层');return structuredClone(floors);}
export function validateInstance(input={}){const v={speed:1.5,width:2.56,depth:1.7,ageYears:0,interior:0,...input};for(const [k,a,b] of [["speed",.5,3],["width",2.2,3],["depth",1.5,2.1],["ageYears",0,40],["interior",0,1]])if(!Number.isFinite(v[k])||v[k]<a||v[k]>b)throw Error("实例参数超出设计范围："+k);if(![0,1].includes(v.interior))throw Error("内饰无效");return v;}
export function createLift(floors=floorTable(),instance={}) {const design=validateInstance(instance);const fs=validateFloors(floors),f=fs.find(f=>f.id==='ground'&&f.served)??fs.find(f=>f.served);return {design,floors:fs,time:0,state:'IDLE',y:f.elevation,v:0,current:f.id,target:null,queue:[],carDoor:0,landingDoors:Object.fromEntries(fs.map(f=>[f.id,0])),locks:Object.fromEntries(fs.map(f=>[f.id,true])),carLock:true,obstruction:false,timer:0,motion:null,events:[],lastMessage:'选择层站呼梯，或在轿内选层'};}
const record=(s,reason)=>{s.lastMessage=reason;s.events.push({time:+s.time.toFixed(2),state:s.state,reason,y:+s.y.toFixed(4),target:s.target});if(s.events.length>80)s.events.shift();};
const transition=(s,state,reason)=>{s.state=state;s.timer=0;record(s,reason);};
export function guards(s){const f=s.floors.find(f=>f.id===s.current);return {leveled:!!f&&Math.abs(s.y-f.elevation)<=DESIGN.levelTolerance&&s.v===0,closed:s.carDoor===0&&Object.values(s.landingDoors).every(x=>x===0),locked:s.carLock&&Object.values(s.locks).every(Boolean),stationary:s.v===0};}
export function request(s,id,source='car',direction=null){const f=s.floors.find(f=>f.id===id),served=s.floors.filter(f=>f.served);if(!f?.served){record(s,'拒绝：非服务层或楼层不存在');return false;}if(source==='hall'&&(![-1,1].includes(direction)||(direction===-1&&id===served[0].id)||(direction===1&&id===served.at(-1).id))){record(s,'拒绝：该层无此呼梯方向');return false;}if(!s.queue.some(q=>q.id===id)&&s.target!==id)s.queue.push({id,source,direction});record(s,(source==='hall'?'层站呼梯 ':'轿内选层 ')+f.label);if(s.current===id&&guards(s).leveled&&['DWELL','IDLE','CLOSING','LOCK_CONFIRM'].includes(s.state)){s.queue=s.queue.filter(q=>q.id!==id);s.target=id;open(s);}return true;}
function open(s){if(s.state==='FAULT'||s.motion||!guards(s).leveled){record(s,'开门被阻止：未静止平层');return false;}s.carLock=false;s.locks[s.current]=false;transition(s,'OPENING','静止平层，解锁当前层两套门');return true;}
export function doorCommand(s,command){if(command==='open')return open(s);if(command==='close'&&['DWELL','OPENING','OBSTRUCTION_HOLD'].includes(s.state)){if(s.obstruction){record(s,'光幕占用，保持开门');return false;}transition(s,'CLOSING','请求关闭轿门与当前层门');return true;}return false;}
export function setObstruction(s,value){s.obstruction=!!value;record(s,value?'演示光幕：障碍进入':'演示光幕：障碍清除');if(value&&s.state==='CLOSING')open(s);if(!value&&s.state==='OBSTRUCTION_HOLD')transition(s,'DWELL','障碍已清除，重新计时');}
const syncDoor=(s,value)=>{s.carDoor=value;s.landingDoors[s.current]=value;};
export function step(s,dt){if(!Number.isFinite(dt)||dt<0||dt>.1)throw Error('仿真步长必须在 0–0.1 秒');s.time+=dt;s.timer+=dt;
 if(s.state==='IDLE'&&s.queue.length){s.target=s.queue[0].id;if(s.target===s.current){s.queue.shift();open(s);}else transition(s,'CLOSING','准备关门');}
 else if(s.state==='OPENING'){syncDoor(s,Math.min(1,s.carDoor+dt/DESIGN.doorSeconds));if(s.carDoor>=1)transition(s,s.obstruction?'OBSTRUCTION_HOLD':'DWELL',s.obstruction?'障碍保持，禁止关门':'两套门已全开');}
 else if(s.state==='DWELL'&&s.timer>=DESIGN.dwellSeconds)transition(s,s.obstruction?'OBSTRUCTION_HOLD':'CLOSING','开门停留结束');
 else if(s.state==='CLOSING'){if(s.obstruction){open(s);}else{syncDoor(s,Math.max(0,s.carDoor-dt/DESIGN.doorSeconds));if(s.carDoor===0)transition(s,'LOCK_CONFIRM','门已关闭，等待独立锁闭确认');}}
 else if(s.state==='LOCK_CONFIRM'&&s.timer>=DESIGN.lockSeconds){s.carLock=true;s.locks[s.current]=true;const g=guards(s);if(!g.closed||!g.locked){transition(s,'FAULT','联锁失败，禁止牵引');}else {s.target=s.queue[0]?.id??null;if(!s.target){transition(s,'IDLE','门锁闭，等待请求');}else if(s.target===s.current){s.queue.shift();open(s);}else{const end=s.floors.find(f=>f.id===s.target).elevation,d=Math.abs(end-s.y);s.motion={start:s.y,end,t:0,T:Math.max(1.875*d/s.design.speed,Math.sqrt(5.774*d/DESIGN.acceleration),2)};transition(s,'ACCELERATING','全部门锁闭确认，开始运行');}}}
 else if(s.motion&&['ACCELERATING','CRUISING','DECELERATING','LEVELING'].includes(s.state)){
  if(!guards(s).closed||!guards(s).locked){s.v=0;s.motion=null;transition(s,'FAULT','仿真联锁不变量破坏；停机，不开门');return s;}
  const m=s.motion;m.t=Math.min(m.T,m.t+dt);const u=m.t/m.T,d=m.end-m.start;s.y=m.start+d*(10*u**3-15*u**4+6*u**5);s.v=d*(30*u*u-60*u**3+30*u**4)/m.T;
  const state=u<.25?'ACCELERATING':u<.55?'CRUISING':Math.abs(m.end-s.y)>.04?'DECELERATING':'LEVELING';if(s.state!==state){s.state=state;record(s,state==='LEVELING'?'低速平层':'运行阶段 '+state);}
  if(m.t>=m.T){s.y=m.end;s.v=0;s.current=s.target;s.queue=s.queue.filter(q=>q.id!==s.current);s.motion=null;open(s);}
 }
 return s;
}
export function advance(s,seconds){for(let left=seconds;left>1e-8;left-=.02)step(s,Math.min(.02,left));return s;}

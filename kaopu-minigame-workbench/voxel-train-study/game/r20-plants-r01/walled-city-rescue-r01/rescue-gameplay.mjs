/* City rescue, one deterministic scene-bound game. This is an authored game rule,
   not a rope-physics solver, fire model, or real-world rescue instruction. */
import {wallRegions} from './plan.mjs';
const EPS=1e-7;
export const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export const pathLength=points=>points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0);
const copy=x=>structuredClone(x);
const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
export function samplePolyline(points,metres){
 if(!points.length)throw Error('Empty route');
 let remaining=Math.max(0,metres);
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=distance(a,b);if(remaining<=d&&d>EPS)return {position:a.map((v,k)=>v+(b[k]-v)*remaining/d),direction:b.map((v,k)=>(v-a[k])/d)};remaining-=d;}
 const a=points.at(-2)||points[0],b=points.at(-1),d=distance(a,b)||1;return {position:[...b],direction:b.map((v,k)=>(v-a[k])/d)};
}

export function slicePolyline(points,startMetres=0,endMetres=pathLength(points)){
 const start=Math.max(0,startMetres),end=Math.max(start,Math.min(pathLength(points),endMetres)),out=[samplePolyline(points,start).position];let travelled=0;
 for(let i=1;i<points.length;i++){travelled+=distance(points[i-1],points[i]);if(travelled>start+EPS&&travelled<end-EPS)out.push([...points[i]]);}
 const last=samplePolyline(points,end).position;if(distance(out.at(-1),last)>EPS)out.push(last);return out;
}

export function findSceneRoute(contract,from,to,{closedDoors=[],excludedDoors=[],via=[]}={}){
 const nodes=new Map(contract.nodes.map(n=>[n.id,n.position]));if(!nodes.has(from)||!nodes.has(to))return null;
 const blocked=new Set([...closedDoors,...excludedDoors]),legs=[],targets=[...via,to];let origin=from;
 for(const target of targets){const pending=[{node:origin,length:0,steps:[]}],best=new Map();let found=null;
  while(pending.length){pending.sort((a,b)=>a.length-b.length||a.node.localeCompare(b.node));const at=pending.shift();if(best.has(at.node)&&best.get(at.node)<=at.length)continue;best.set(at.node,at.length);if(at.node===target){found=at;break;}
   for(const edge of contract.edges){if(blocked.has(edge.requiredOpenDoor))continue;let next,points;if(edge.from===at.node){next=edge.to;points=edge.points;}else if(edge.to===at.node){next=edge.from;points=[...edge.points].reverse();}else continue;if(edge.minimumClearWidth<.48||edge.minimumClearHeight<1.82)continue;pending.push({node:next,length:at.length+pathLength(points),steps:[...at.steps,{id:edge.id,from:at.node,to:next,door:edge.requiredOpenDoor,points:copy(points)}]});}}
  if(!found)return null;legs.push(...found.steps);origin=target;
 }
 const points=legs.length?legs.flatMap((l,i)=>i?l.points.slice(1):l.points):[[...nodes.get(from)]];
 return {from,to,edges:legs.map(e=>e.id),doors:[...new Set(legs.map(e=>e.door).filter(Boolean))],points,length:pathLength(points),legs};
}
function insideOpeningWall(point,w,radius,height){const[x,y,z]=point,u=w.alongX?x:z,v=w.alongX?z:x;if(Math.abs(v-w.fixed)>radius+.08)return false;return wallRegions(w).some(r=>u+radius>r.u0&&u-radius<r.u1&&y+height>r.y0+.01&&y+.03<r.y1);}
export function validateWalkRoute(contract,route){
 if(!route?.points?.length)return {valid:false,reason:'没有真实连通路线'};
 const {walls,supports}=contract.geometryBindings,envelope=contract.actorEnvelope;
 for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];if(!finitePoint(a)||!finitePoint(b))return {valid:false,reason:'路线坐标无效'};
  if(Math.abs(a[1]-b[1])>envelope.maximumStep+EPS)return {valid:false,reason:'路线越过未建成的高差',segment:i-1};
  const count=Math.max(1,Math.ceil(distance(a,b)/.06));for(let j=0;j<=count;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/count),[x,y,z]=p;
   const wall=walls.find(w=>insideOpeningWall(p,w,envelope.radius,envelope.height));if(wall)return {valid:false,reason:'人物通路与实体墙相交',wall:wall.id,position:p};
   if(!supports.some(f=>x>=f.x0-.04&&x<=f.x1+.04&&z>=f.z0-.14&&z<=f.z1+.14&&Math.abs(y-f.y)<=envelope.maximumStep+.01))return {valid:false,reason:'人物路线缺少真实平台或踏步支撑',position:p};
   const low=supports.find(f=>f.material!=='existing-wood-step'&&x+envelope.radius>f.x0&&x-envelope.radius<f.x1&&z+envelope.radius>f.z0&&z-envelope.radius<f.z1&&f.y-f.thickness>y+.30&&f.y-f.thickness<y+envelope.height);if(low)return {valid:false,reason:'人物头顶净空不足',floor:low.id,position:p};
  }
 }
 return {valid:true,method:'60 mm route samples against original wall openings, low floor slabs and tread support; not continuous capsule physics'};
}
export function measureGuideLine(route,{endReserve=1.8,bendReserve=.12,height=.85}={}){
 let bends=0;for(let i=1;i<route.points.length-1;i++){const a=route.points[i-1],b=route.points[i],c=route.points[i+1],u=b.map((v,j)=>v-a[j]),v=c.map((x,j)=>x-b[j]),den=Math.hypot(...u)*Math.hypot(...v);if(den>EPS&&u.reduce((n,x,j)=>n+x*v[j],0)/den<.94)bends++;}
 return {pathMetres:route.length,endReserve,bends,bendReserve:bends*bendReserve,requiredMetres:route.length+endReserve+bends*bendReserve,points:route.points.map(p=>[p[0],p[1]+height,p[2]]),meaning:'Measured route-following game equipment with explicit end and corner reserve; not taut rope physics or certified safety lengths'};
}
export function makeCityRescueScenario(contract){
 const required=['roof','landing-9','half-8','landing-8','half-7','W7-home','E7-home','W8-home'];for(const id of required)if(!contract.nodes.some(n=>n.id===id))throw Error('First rescue requires existing upper-building node '+id);
 if(!contract.doors.some(d=>d.id==='upper-borrowed-gate'))throw Error('First rescue requires the real upper borrowed bridge and gate');
 const at=id=>contract.nodes.find(n=>n.id===id).position,roofY=at('roof')[1],safeApproaches={'east-neighbour':[[...at('roof')],[-1.0,roofY,-1.3],[-1.8,roofY,-1.35]],'west-neighbour':[[...at('roof')],[-2.1,roofY,-.3],[-3.6,roofY,-.3]]},crewParks={};for(const [id,offset]of Object.entries({'roof':[-.62,0,-.8],'landing-9':[.93,0,-.4],'half-8':[-1.16,0,.2],'landing-8':[.93,0,-.4],'half-7':[-1.16,0,.2],'W7-home':[-.95,0,-.1]}))crewParks[id]=at(id).map((v,i)=>v+offset[i]);
 return {safeApproaches,crewParks,escortSeparation:.9,schema:'city-rescue-first-question/1',id:'upper-city-two-neighbours',title:'先把两个人带回天台',safeNode:'roof',ropeMetres:18.2,people:[{id:'east-neighbour',label:'东侧住户',node:'E7-home',deadline:145,warning:108,reason:'前侧近路受火势威胁，烟中难辨方向',routeModes:['front','borrowed']},{id:'west-neighbour',label:'西侧住户',node:'W8-home',deadline:175,warning:140,reason:'楼上烟气正在逼近，需先建立清楚的返回路线',routeModes:['stairs']}],anchors:[{id:'roof',node:'roof',label:'天台'},{id:'landing-9',node:'landing-9',label:'9层转角'},{id:'half-8',node:'half-8',label:'8层半平台'},{id:'landing-8',node:'landing-8',label:'8层转角'},{id:'half-7',node:'half-7',label:'7层半平台'},{id:'W7-home',node:'W7-home',label:'7层借道户'}],gate:'upper-borrowed-gate',frontDoor:'E7-entry',closure:{warnAt:30,closeAt:55,minimumNotice:15},speeds:{crew:1.35,lay:1.05,escort:.78,clearWalk:1.05},setupSeconds:3,attachSeconds:2,recoverSeconds:4,story:'天台队伍只有一根联络绳。两名住户在烟中难以辨认回路。前侧近路将封，后侧要穿借道户和错层平台。先找够得到的锚点，建立路线，再引导人回到天台。',disclaimer:'原创救援关卡。火势、绳长余量和人物状态是游戏规则，不是现实消防训练。'};
}
export function createCityRescueGame({contract,scenario=makeCityRescueScenario(contract),onEvent=()=>{},onDoorChange=()=>{}}={}){
 if(!contract?.geometryBindings||typeof onEvent!=='function'||typeof onDoorChange!=='function')throw Error('Existing scene contract and callbacks required');
 const nodeAt=id=>contract.nodes.find(n=>n.id===id)?.position;
 let state,lastHost=0,startedHost=0,sequence=0;const events=[],routeCache=new Map(),validationCache=new Map();
 function emit(type,data={}){const event={id:++sequence,type,at:state.elapsed,...copy(data)};events.push(event);if(events.length>160)events.shift();onEvent(copy(event));return event;}
 function reset(host=lastHost){if(!Number.isFinite(host))throw Error('Finite shared world time required');lastHost=host;startedHost=host;sequence=0;events.length=0;state={status:'briefing',elapsed:0,crewNode:scenario.safeNode,crewPosition:[...nodeAt(scenario.safeNode)],operation:null,rope:{state:'available',anchor:null,person:null,measurement:null},people:scenario.people.map(p=>({...copy(p),status:'waiting',rescuedAt:null,warned:false})),closedDoors:contract.doors.filter(d=>!d.initialOpen).map(d=>d.id),warned:false,closureResolved:false,nextClosureCheck:scenario.closure.closeAt,failure:null,feedback:'先看清人、路和危险，再开始。'};for(const d of contract.doors)onDoorChange(d.id,d.initialOpen);emit('reset');return snapshot();}
 function closed(s=state){return [...s.closedDoors];}
 function route(from,to,opts={},s=state){const options={closedDoors:closed(s),...opts},key=JSON.stringify([from,to,options]);if(!routeCache.has(key))routeCache.set(key,findSceneRoute(contract,from,to,options));return routeCache.get(key);}
 function validate(r){const key=JSON.stringify([r.from,r.to,r.edges,r.points]);if(!validationCache.has(key))validationCache.set(key,validateWalkRoute(contract,r));return validationCache.get(key);}
 function reject(code,message,details={}){state.feedback=message;emit('action-rejected',{code,message,...details});return {accepted:false,code,message,...details};}
 function preview(personId,anchorId,mode,s=state){
  const person=s.people.find(p=>p.id===personId),anchor=scenario.anchors.find(a=>a.id===anchorId);if(!person||!anchor)return {valid:false,code:'unknown-target',reason:'请选择场景里的人和锚点'};
  if(!person.routeModes.includes(mode))return {valid:false,code:'unknown-route',reason:'这位住户没有这条路线'};
  const options=mode==='borrowed'?{excludedDoors:[scenario.frontDoor],via:['W7-home']}:mode==='front'?{excludedDoors:[scenario.gate]}:{};
  const guide=route(anchor.node,person.node,options,s),baseApproach=route(s.crewNode,anchor.node,{},s),baseEvacuation=route(anchor.node,scenario.safeNode,{},s);let approach=baseApproach&&copy(baseApproach),evacuation=baseEvacuation&&copy(baseEvacuation);if(approach&&distance(s.crewPosition,approach.points[0])>EPS){approach.points.unshift([...s.crewPosition]);approach.length=pathLength(approach.points);}if(evacuation){evacuation.points.push(...scenario.safeApproaches[personId].slice(1).map(p=>[...p]));evacuation.length=pathLength(evacuation.points);}
  if(!guide||!approach||!evacuation)return {valid:false,code:'route-closed',reason:mode==='borrowed'?'借道门关闭，后侧通路断开':'前侧近路已封，请查看后侧借道',personId,anchorId,mode};
  const crewPark=[...scenario.crewParks[anchorId]],crewLay={from:guide.from,to:guide.to,edges:guide.edges,points:slicePolyline(guide.points,0,Math.max(0,guide.length-scenario.escortSeparation))},crewGuide={from:guide.to,to:guide.from,edges:[...guide.edges].reverse(),points:[...slicePolyline([...guide.points].reverse(),scenario.escortSeparation),crewPark]};crewLay.length=pathLength(crewLay.points);crewGuide.length=pathLength(crewGuide.points);
  for(const r of [guide,approach,evacuation,crewLay,crewGuide]){const collision=validate(r);if(!collision.valid)return {valid:false,code:'world-collision',reason:collision.reason,collision};}
  const line=measureGuideLine(guide),duration=approach.length/scenario.speeds.crew+scenario.setupSeconds+guide.length/scenario.speeds.lay+scenario.attachSeconds+guide.length/scenario.speeds.escort+evacuation.length/scenario.speeds.clearWalk;
  const frontClearAt=s.elapsed+duration-evacuation.length/scenario.speeds.clearWalk,usesFront=guide.doors.includes(scenario.frontDoor),withinWindow=!usesFront||s.closureResolved||frontClearAt<=scenario.closure.closeAt+EPS,ropeFits=line.requiredMetres<=scenario.ropeMetres+EPS;
  const result={valid:ropeFits&&withinWindow,code:!ropeFits?'rope-short':!withinWindow?'fire-window':'ready',frontClearAt:usesFront?frontClearAt:null,personId,anchorId,mode,anchorNode:anchor.node,crewPark,crewLay,crewGuide,guide,approach,evacuation,line,duration,finishAt:s.elapsed+duration,timeMargin:person.deadline-s.elapsed-duration,routeClosesAt:guide.doors.includes(scenario.frontDoor)&&!s.closureResolved?scenario.closure.closeAt:null};
  result.reason=result.valid?'路线可用':result.code==='fire-window'?`这条路线要到 ${frontClearAt.toFixed(1)} 秒才完全通过前门，赶不上 ${scenario.closure.closeAt} 秒封锁；请改后侧借道`:`需要 ${line.requiredMetres.toFixed(1)} 米，只有 ${scenario.ropeMetres.toFixed(1)} 米；请把锚点移近或换路`;
  return result;
 }
 function operationFor(p,start=state.elapsed){const phases=[];let at=start;const add=(kind,duration,points=null,actors=[],actorPaths={})=>{phases.push({kind,start:at,end:at+duration,points,actors,actorPaths});at+=duration;};add('crew-approach',p.approach.length/scenario.speeds.crew,p.approach.points,['crew']);add('anchor',scenario.setupSeconds);add('lay-guide',p.guide.length/scenario.speeds.lay,p.crewLay.points,['crew']);add('attach',scenario.attachSeconds);add('guide-neighbour',p.guide.length/scenario.speeds.escort,[...p.guide.points].reverse(),['crew',p.personId],{crew:p.crewGuide.points});add('clear-to-roof',p.evacuation.length/scenario.speeds.clearWalk,p.evacuation.points,[p.personId]);return {kind:'rescue',personId:p.personId,anchorId:p.anchorId,anchorNode:p.anchorNode,crewPark:p.crewPark,mode:p.mode,start,end:at,phases,phaseIndex:0,plan:copy(p)};}
 function projectedAfterOperation(s){const t=copy(s);if(t.operation?.kind==='rescue'){const o=t.operation;t.elapsed=o.end;t.people.find(p=>p.id===o.personId).status='rescued';t.crewNode=o.anchorNode;t.crewPosition=[...o.crewPark];t.rope.state='deployed';t.operation=null;}else if(t.operation?.kind==='recover'){t.elapsed=t.operation.end;t.rope={state:'available',anchor:null,person:null,measurement:null};t.operation=null;}return t;}
 function recoverDuration(s){return scenario.recoverSeconds+(s.rope.measurement?.pathMetres||0)/3;}
 function findCompletion(s,depth=0){
  if(depth>3)return null;const t=projectedAfterOperation(s);if(t.people.some(p=>p.status!=='rescued'&&p.deadline<t.elapsed-EPS))return null;
  if(t.people.every(p=>p.status==='rescued'))return [];
  if(t.rope.state!=='available'){t.elapsed+=recoverDuration(t);t.rope.state='available';}
  const candidates=[];for(const person of t.people.filter(p=>p.status!=='rescued'))for(const anchor of scenario.anchors)for(const mode of person.routeModes){const p=preview(person.id,anchor.id,mode,t);if(p.valid&&p.finishAt<=person.deadline+EPS)candidates.push(p);}
  candidates.sort((a,b)=>t.people.find(p=>p.id===a.personId).deadline-t.people.find(p=>p.id===b.personId).deadline||a.finishAt-b.finishAt);
  for(const p of candidates){const next=copy(t);next.elapsed=p.finishAt;next.people.find(x=>x.id===p.personId).status='rescued';next.crewNode=p.anchorNode;next.crewPosition=[...p.crewPark];next.rope={state:'deployed',anchor:p.anchorId,person:p.personId,measurement:p.line};const rest=findCompletion(next,depth+1);if(rest)return [{personId:p.personId,anchorId:p.anchorId,mode:p.mode,finishAt:p.finishAt},...rest];}return null;
 }
 function tryFireClosure(){
  if(state.closureResolved||state.elapsed+EPS<state.nextClosureCheck)return;
  const op=state.operation,occupying=op?.kind==='rescue'&&op.plan.guide.doors.includes(scenario.frontDoor)&&state.elapsed<(op.phases.find(p=>p.kind==='clear-to-roof')?.start??op.end)-EPS;
  if(occupying){state.nextClosureCheck=op.phases.find(p=>p.kind==='clear-to-roof')?.start??op.end;emit('closure-held',{reason:'有人正在通过前侧路线，封锁推迟到这次引导结束',until:state.nextClosureCheck});return;}
  const candidate=copy(state);candidate.closedDoors=[...new Set([...candidate.closedDoors,scenario.frontDoor])];const solution=findCompletion(candidate);
  const priorSolution=solution||findCompletion(state);
  if(!solution&&priorSolution){state.nextClosureCheck=state.elapsed+5;emit('closure-held',{reason:'保留最后一条可完成的退路；时间仍在流逝',until:state.nextClosureCheck});return;}
  state.closedDoors=candidate.closedDoors;state.closureResolved=true;onDoorChange(scenario.frontDoor,false);emit('front-route-closed',{door:scenario.frontDoor,remainingSolutionExists:!!solution,closureCreatedUnwinnableState:false,alreadyOutOfTime:!priorSolution});state.feedback=solution?'前侧近路已封，后侧借道仍可使用。':'前侧近路已封。按当前时间，已无法把两人都带回天台，可以重新开始。';
 }
 function endOperation(){const op=state.operation;if(!op)return;if(op.kind==='recover'){state.rope={state:'available',anchor:null,person:null,measurement:null};state.feedback='绳已收回，可以换锚点救下一人。';emit('rope-recovered');}else{const person=state.people.find(p=>p.id===op.personId);person.status='rescued';person.rescuedAt=state.elapsed;state.crewNode=op.anchorNode;state.crewPosition=[...op.crewPark];state.rope.state='deployed';state.feedback=person.label+'已到天台。先收绳，再安排下一位。';emit('person-safe',{personId:person.id,atNode:scenario.safeNode});}state.operation=null;if(state.people.every(p=>p.status==='rescued')){state.status='succeeded';state.feedback='两位住户都已到达天台。';emit('success',{elapsed:state.elapsed});}}
 function advanceTo(target){
  while(state.status==='playing'&&state.elapsed<target-EPS){const deadlines=state.people.filter(p=>p.status!=='rescued').map(p=>p.deadline),warnings=state.people.filter(p=>p.status!=='rescued'&&!p.warned).map(p=>p.warning),opEnd=state.operation?.end??Infinity,phaseEnd=state.operation?.phases?.[state.operation.phaseIndex]?.end??Infinity;let next=Math.min(target,...deadlines,...warnings,opEnd,phaseEnd,state.warned?Infinity:scenario.closure.warnAt,state.closureResolved?Infinity:state.nextClosureCheck);if(next<state.elapsed-EPS)next=state.elapsed;state.elapsed=next;
   if(!state.warned&&next+EPS>=scenario.closure.warnAt){state.warned=true;emit('route-warning',{door:scenario.frontDoor,closesAt:scenario.closure.closeAt,noticeSeconds:scenario.closure.closeAt-scenario.closure.warnAt});state.feedback='前侧近路即将封锁。后侧借道需要开门，并重新核对绳长。';}
   if(state.operation&&next+EPS>=state.operation.end)endOperation();else if(state.operation?.phases&&next+EPS>=phaseEnd){state.operation.phaseIndex++;emit('phase-changed',{kind:state.operation.phases[state.operation.phaseIndex]?.kind,personId:state.operation.personId});}
   if(state.status!=='playing')break;
   for(const person of state.people.filter(p=>p.status!=='rescued'&&!p.warned&&next+EPS>=p.warning)){person.warned=true;emit('person-danger-warning',{personId:person.id,remainingSeconds:person.deadline-next});}
   const missed=state.people.find(p=>p.status!=='rescued'&&next+EPS>=p.deadline);if(missed){state.status='failed';state.failure={personId:missed.id,reason:'救援窗口已耗尽',at:next};state.feedback=missed.label+'的救援窗口已耗尽。重试时可缩短布线或更换救援顺序。';emit('failure',state.failure);break;}
   tryFireClosure();
  }
 }
 function update(worldSeconds){if(!Number.isFinite(worldSeconds))throw Error('Finite shared world seconds required');if(worldSeconds<lastHost-EPS)throw Error('Shared clock rewound: use reset(worldSeconds) for retry');lastHost=worldSeconds;if(state.status==='playing')advanceTo(Math.max(state.elapsed,worldSeconds-startedHost));return snapshot();}
 function command(action){
  if(action?.type==='retry')return {accepted:true,snapshot:reset(action.worldSeconds??lastHost)};
  if(action?.type==='start'){if(state.status!=='briefing')return reject('already-started','这一轮已经开始。');startedHost=lastHost;state.status='playing';state.feedback='先选场景中的人，再选锚点和前侧或后侧路线。';emit('start',{openingShot:scenario.people.map(p=>p.id)});return {accepted:true};}
  if(state.status!=='playing')return reject('not-playing','请先开始，或重试这一题。');
  if(action?.type==='set-gate'){
   if(typeof action.open!=='boolean')return reject('invalid-door','门状态必须明确。');if(!action.open&&state.operation?.kind==='rescue'&&state.operation.plan.guide.doors.includes(scenario.gate))return reject('door-in-use','人和绳还在借道，不能把门关在他们身上。');
   const future=copy(state);future.closedDoors=action.open?future.closedDoors.filter(d=>d!==scenario.gate):[...new Set([...future.closedDoors,scenario.gate])];if(!action.open&&!findCompletion(future))return reject('last-route','这会切断剩余救援路线，先让住户通过。');state.closedDoors=future.closedDoors;onDoorChange(scenario.gate,action.open);emit('gate-changed',{door:scenario.gate,open:action.open});state.feedback=action.open?'后侧借道门已打开。':'后侧借道门已关闭，可再次打开。';return {accepted:true};
  }
  if(state.operation)return reject('crew-busy','当前引导尚未完成，先留出这条路线。');
  if(action?.type==='recover'){if(state.rope.state!=='deployed')return reject('no-rope','目前没有需要回收的绳。');state.operation={kind:'recover',start:state.elapsed,end:state.elapsed+recoverDuration(state),phases:[]};state.feedback='正在回收同一根绳。';emit('recover-started');return {accepted:true};}
  if(action?.type==='rescue'){
   if(state.rope.state!=='available')return reject('rope-busy','同一根绳还留在上一条路线，先回收。');const person=state.people.find(p=>p.id===action.personId);if(person?.status!=='waiting')return reject('person-unavailable','这位住户已经在返回或已安全。');const p=preview(action.personId,action.anchorId,action.mode);if(!p.valid)return reject(p.code,p.reason,{preview:p});if(p.finishAt>person.deadline+EPS)return reject('too-late','这条路线已赶不上当前救援窗口，请选更近的锚点。',{preview:p});state.operation=operationFor(p);person.status='rescuing';state.rope={state:'in-use',anchor:p.anchorId,person:p.personId,measurement:copy(p.line)};state.feedback='沿已核对的真实路线出发。';emit('rescue-started',{personId:p.personId,anchorId:p.anchorId,mode:p.mode,requiredMetres:p.line.requiredMetres,availableMetres:scenario.ropeMetres,finishAt:p.finishAt});return {accepted:true,plan:copy(p)};
  }
  return reject('unknown-action','没有这个操作。');
 }
 function actorSnapshot(id){const person=state.people.find(p=>p.id===id),op=state.operation;let position=[...(id==='crew'?state.crewPosition:person?.status==='rescued'?scenario.safeApproaches[id].at(-1):nodeAt(person?.node))],moving=false,direction=[0,0,1],trajectory=null;if(op?.kind==='rescue'){
   for(const phase of op.phases){if(state.elapsed<phase.start-EPS)break;if(!phase.actors.includes(id)||!phase.points)continue;const points=phase.actorPaths?.[id]||phase.points,progress=Math.min(1,Math.max(0,(state.elapsed-phase.start)/(phase.end-phase.start||1))),sample=samplePolyline(points,pathLength(points)*progress);position=sample.position;direction=sample.direction;moving=state.elapsed<phase.end-EPS;const totalLength=pathLength(points);trajectory={points:copy(points),distanceAlong:totalLength*progress,totalLength,speed:totalLength/(phase.end-phase.start||1),phaseStart:startedHost+phase.start,phaseEnd:startedHost+phase.end};}
  }moving=state.status==='playing'&&moving;return {id,position,direction,moving,trajectory:moving?trajectory:null,pose:moving?'walk':'stand',isSafe:person?.status==='rescued',noSuspendedTransport:true};}
 function snapshot(){return {...copy(state),worldSeconds:lastHost,ropeCapacity:scenario.ropeMetres,actors:['crew',...scenario.people.map(p=>p.id)].map(actorSnapshot),phase:state.operation?.phases?.[state.operation.phaseIndex]?.kind||state.operation?.kind||null,events:copy(events),limits:{realWorldInstruction:false,firePhysics:false,ropePhysics:false,continuousCapsulePhysics:false,nativeActorsRequired:true}};}
 reset(0);const initialSolution=findCompletion(state);if(!initialSolution)throw Error('Initial city rescue has no complete solution');
 return {scenario:copy(scenario),contract,command,update,reset,preview,snapshot,findCompletion:()=>copy(findCompletion(state)),drainEvents(){return events.splice(0).map(copy);},initialSolution:copy(initialSolution)};
}

// Foot placement query for the original rig. Multiple storeys share X/Z, so an
// explicit reference Y is mandatory. Never choose the topmost floor globally.
export function makeRescueSupportSampler(contract){
 const supports=contract.geometryBindings.supports;
 return function sampleSupport({x,z,referenceY,maxRise=.23,maxDrop=.43}={}){
  if(![x,z,referenceY,maxRise,maxDrop].every(Number.isFinite)||maxRise<0||maxDrop<0)throw Error('A finite local foot X/Z and reference Y are required');
  const candidates=supports.filter(f=>x>=f.x0-EPS&&x<=f.x1+EPS&&z>=f.z0-EPS&&z<=f.z1+EPS&&f.y-referenceY<=maxRise+EPS&&referenceY-f.y<=maxDrop+EPS);
  candidates.sort((a,b)=>Math.abs(a.y-referenceY)-Math.abs(b.y-referenceY)||b.y-a.y||a.id.localeCompare(b.id));
  const floor=candidates[0];return floor?{y:floor.y,normal:[0,1,0],supportId:floor.id,material:floor.material,bounds:{x0:floor.x0,x1:floor.x1,z0:floor.z0,z1:floor.z1},coordinateFrame:'building-local metres, Y up',sampledAt:[x,floor.y,z]}:null;
 };
}

import {localToWorld,floorY,floorH,updateSnapshot} from './compile.mjs';
import {querySettlement} from './kernel.mjs';
/** One authored chain only. All other 775 source graph paths retain untested status. */
export function makeValidationChain(recipe){
 const a=recipe.buildings.find(b=>b.id==='B01'),b=recipe.buildings.find(b=>b.id==='B02'),bridge=recipe.bridges.find(b=>b.id==='borrow-B01-B02');if(!a||!b||!bridge)return null;
 const keyframes=[],routeIds=[];
 const add=(p,label,support=true)=>keyframes.push({p,label,support});
 const local=(b,u,y,v,label)=>add(localToWorld(b,[u,y,v]),label);
 const ownStairs=(b,start,end)=>{for(let f=start;f<end;f++){
  const y=floorY(b,f),h=floorH(b,f),n=Math.ceil(h/.18),na=Math.floor((n+1)/2),nb=n-na,r=h/n,run=Math.max(na,nb)*b.tread,xa=b.wall+b.flightWidth/2,xb=b.coreWidth-b.wall-b.flightWidth/2;
  local(b,xa,y,.72,`${b.id} F${f} lower landing`);
  for(let k=0;k<na;k++)local(b,xa,y+(k+1)*r,b.landing+(k+.5)*b.tread,`${b.id} F${f} first flight tread ${k+1}`);
  local(b,xa,y+na*r,b.landing+run+b.turnLanding/2,`${b.id} F${f} turn landing A`);local(b,xb,y+na*r,b.landing+run+b.turnLanding/2,`${b.id} F${f} turn landing B`);
  for(let k=0;k<nb;k++)local(b,xb,y+(na+k+1)*r,b.landing+run-(k+.5)*b.tread,`${b.id} F${f} return flight tread ${k+1}`);
  local(b,xb,y+h,.72,`${b.id} F${f+1} upper landing`);routeIds.push(f+1<b.floors?`${b.id}-stair-${f+1}`:`${b.id}-roof-stair`);
 }};
 const entry=localToWorld(a,[1.52,0,-.65]);add([entry[0],0,a.street[2]],'street approach');add(entry,'street door outside');local(a,1.52,0,.72,'street door inside');routeIds.push('B01-entry');ownStairs(a,0,2);
 local(a,1.52,floorY(a,2),.72,'B01 bridge approach');add(bridge.pa,'B01 bridge threshold');routeIds.push('borrow-B01-B02-A-entry');
 const low=bridge.low,high=bridge.high,dx=(high[0]-low[0])/bridge.length,dz=(high[2]-low[2])/bridge.length,tread=bridge.length/(bridge.steps+1),rise=(high[1]-low[1])/Math.max(1,bridge.steps);
 for(let k=0;k<=bridge.steps;k++){const t=(k+.5)*tread;add([low[0]+dx*t,low[1]+k*rise,low[2]+dz*t],`borrow deck tread ${k}`);}
 add(bridge.pb,'B02 bridge threshold');local(b,1.52,floorY(b,2),.72,'B02 bridge arrival');routeIds.push('borrow-B01-B02','borrow-B01-B02-B-entry');ownStairs(b,2,b.floors);local(b,1.7,b.top,.72,'B02 roof working landing');
 return {name:'street → B01 door → B01 own stair → negotiated B01/B02 bridge → B02 own stair → roof',keyframes,routeIds,hostSeconds:12*3600,doorState:'street leaf −π/2 outward; other route leaves +π/2; negotiated bridge gate +π/2',body:{heightM:1.8,torsoRadiusM:.22,headRadiusM:.16,footRadiusM:.055,maxStepM:.18,maxProbeSpacingM:.06},limitations:['Authored sampled standing/walking envelope, not a dynamics controller or accessibility standard.','Uses frozen noon snapshot with opened route leaves and gate. Closed-gate negative control is tested separately.','No crowds, carried loads, foot placement animation, emergency egress capacity or load certification.']};
}
const body=[{y:.055,r:.055,kind:'foot'},{y:.20,r:.07,kind:'ankle'},{y:.44,r:.18,kind:'lower-body'},{y:.68,r:.22,kind:'body'},{y:.96,r:.22,kind:'body'},{y:1.23,r:.22,kind:'body'},{y:1.48,r:.19,kind:'shoulder'},{y:1.64,r:.16,kind:'head'}];
export function bodyProbe(recipe,p,{obstacleMarginM=0}={}){let minimum=Infinity,nonContactMinimum=Infinity,limiting=null;for(const b of body){const h=querySettlement(recipe,[p[0],p[1]+b.y,p[2]],.7),margin=h.d-b.r-(b.kind==='foot'?0:obstacleMarginM);if(b.kind!=='foot')nonContactMinimum=Math.min(nonContactMinimum,margin);if(margin<minimum){minimum=margin;limiting={...b,hit:h};}}return {clear:minimum>=-.003,margin:minimum,nonContactMargin:nonContactMinimum,limiting};}
export function supportProbe(recipe,p){const h=querySettlement(recipe,[p[0],p[1]+.012,p[2]],.12);return {supported:h.materialId!==0&&h.d>=-.003&&h.d<=.025,distance:h.d,componentId:h.componentId};}
/** Conservative shape-distance sphere tests along the body and <=6cm path segments. */
export function validateChain(recipe,chain=makeValidationChain(recipe),{obstacleMarginM=0}={}){
 if(!chain)return {status:'unavailable-at-this-growth-stage'};
 updateSnapshot(recipe,{hostSeconds:chain.hostSeconds});let probeCount=0,supports=0,minBody=Infinity,minNonContact=Infinity,maxStep=0;const failures=[],segments=[];
 const check=(p,label)=>{const q=bodyProbe(recipe,p,{obstacleMarginM});probeCount++;minBody=Math.min(minBody,q.margin);minNonContact=Math.min(minNonContact,q.nonContactMargin);if(!q.clear&&failures.length<30)failures.push({label,p,margin:q.margin,kind:q.limiting.kind,componentId:q.limiting.hit.componentId,buildingId:q.limiting.hit.buildingId});};
 const sweep=(a,b,label)=>{const len=Math.hypot(...a.map((x,i)=>b[i]-x)),n=Math.max(1,Math.ceil(len/.06));for(let j=1;j<=n;j++)check(a.map((x,i)=>x+(b[i]-x)*j/n),label);};
 for(let i=0;i<chain.keyframes.length;i++){
  const k=chain.keyframes[i],s=supportProbe(recipe,k.p);supports++;if(!s.supported&&failures.length<30)failures.push({label:k.label,p:k.p,kind:'unsupported',...s});check(k.p,k.label);
  if(i){const prev=chain.keyframes[i-1],dy=k.p[1]-prev.p[1];maxStep=Math.max(maxStep,Math.abs(dy));if(Math.abs(dy)>.18001&&failures.length<30)failures.push({kind:'step-too-high',dy,label:k.label});
   // Character step clearance lifts feet before forward motion. Support is required at every tread/landing keyframe, not while lifting.
   if(dy>1e-5){const up=[prev.p[0],k.p[1],prev.p[2]];sweep(prev.p,up,k.label+' step lift');sweep(up,k.p,k.label+' horizontal step');}
   else if(dy< -1e-5){const above=[k.p[0],prev.p[1],k.p[2]];sweep(prev.p,above,k.label+' descent');sweep(above,k.p,k.label+' lower');}
   else sweep(prev.p,k.p,k.label);
  }
 }
 const tested=new Set(chain.routeIds),routes=recipe.sourceRouteIds.map(id=>({id,status:tested.has(id)?(failures.length?'chain-tested-failed':'sampled-chain-clear'):'untested'}));
 return {status:failures.length?'FAILED':'SAMPLED_CHAIN_CLEAR',chain:chain.name,hostSeconds:chain.hostSeconds,doorState:chain.doorState,body:{...chain.body,obstacleMarginM,footContactMarginM:0},keyframes:chain.keyframes.length,bodyProbePositions:probeCount,sphereQueries:probeCount*body.length,supportProbes:supports,minBodyClearanceM:minBody,minNonContactClearanceM:minNonContact,maxStepM:maxStep,failures,routeStatusCounts:{tested:tested.size,untested:routes.filter(r=>r.status==='untested').length},routes,limitations:chain.limitations};
}

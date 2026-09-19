/* Ocean Life R02: synthetic metre/Y-up habitat and observable ecological rules.
   All numeric ecology/tide settings are authored test parameters, NOT Palau measurements.
   The original Fish/Bird/Coral generators remain separate. No source GLB is imported. */
const HabitatLife=(()=>{
'use strict';
const C=(v,a,b)=>Math.max(a,Math.min(b,v)),T=2*Math.PI;
const bounds={minX:-40,maxX:40,minZ:-32,maxZ:64},nx=80,nz=96,dx=1,dz=1;
const height=new Float32Array((nx+1)*(nz+1));
const smooth=(a,b,x)=>{const q=C((x-a)/(b-a),0,1);return q*q*(3-2*q)};
function terrain(x,z){
 const r=Math.hypot(x/14,(z+9)/11),angle=Math.atan2((z+9)/11,x/14),coast=1+.06*Math.sin(3*angle)+.03*Math.cos(7*angle);
 const island=7.5*(1-smooth(.10,coast,r))-24*smooth(coast,coast+.55,r);
 const lagoon=-1.6-.030*Math.max(0,z-4)+.10*Math.sin(x*.32)*Math.cos(z*.3);
 const channel=smooth(3,6,6-Math.abs(x-9));
 const crest=1.65*Math.exp(-(((z-30)/4.5)**2))*(1-channel);
 const slope=13*smooth(35,55,z);
 return Math.max(island,-30,lagoon+crest-slope);
}
for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)height[j*(nx+1)+i]=terrain(-40+i,-32+j);
function bed(x,z){x=C(x,-40,40-1e-8);z=C(z,-32,64-1e-8);const xx=x+40,zz=z+32,i=Math.floor(xx),j=Math.floor(zz),u=xx-i,v=zz-j,k=j*(nx+1)+i,A=height[k],B=height[k+1],D=height[k+nx+2],E=height[k+nx+1];return v>=u?A+(E-A)*v+(D-E)*u:A+(B-A)*u+(D-B)*v}
const clock={hour:9,tideOffset:0,season:'unassigned'};
function tide(t){return .30*Math.sin(t*T/180+clock.tideOffset)}
function exposure(x,z){return .22+.78*smooth(25,36,z)}
function surface(x,z,t=0,w=.055){return tide(t)+OceanField.waterSurfaceY(x,z,t,C(w,0,.12))*exposure(x,z)}
function zoneAt(x,z){const b=bed(x,z);return b>.2?'island':b>-.25?'strand':z>38?'outer':Math.abs(x-9)<4&&z>17?'channel':z>26?'reef-crest':z>16?'reef-slope':'lagoon'}
const zones=[{id:'shallows',zh:'内礁定居区',x:-4,z:9,rx:3,rz:2},{id:'reef',zh:'通道饵鱼区',x:8,z:21,rx:6,rz:5},{id:'outer',zh:'外礁巡游区',x:10,z:37,rx:8,rz:6}];
const colonies=[{id:'cover-1',x:-4,z:9,r:.62,h:.9,form:'branching'},{id:'cover-2',x:2,z:11,r:.82,h:.55,form:'table'},{id:'cover-3',x:-9,z:14,r:.58,h:.55,form:'massive'},{id:'cover-4',x:15,z:24,r:1.15,h:1.1,form:'branching'},{id:'cover-5',x:-2,z:24,r:1.1,h:.7,form:'table'},{id:'cover-6',x:20,z:31,r:.9,h:.85,form:'massive'}];
for(const q of colonies)q.y=bed(q.x,q.z);
const observer={active:false,x:0,y:0,z:0};
const qa={steps:0,attemptsRejected:0,invalidPlacements:0,minBedClearanceM:Infinity,minSurfaceClearanceM:Infinity,captures:0,immigrations:0,flees:0,returns:0,foodTypeViolations:0};
const events=[];let serial=0;
function event(type,t,data={}){const e={id:++serial,type,timeS:t,...data};events.push(e);if(events.length>180)events.shift();return e}
function setObserver(p){if(p===null){observer.active=false;return}if(!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x)))throw Error('Observer requires finite metre coordinates');Object.assign(observer,{active:true,x:p[0],y:p[1],z:p[2]})}
// Bounds every grid vertex in an expanded footprint: conservative for the piecewise planar bed.
function envelope(x,z,L,t=0,w=.055){const r=L*.64,ry=L*.27;let b=bed(x,z);for(let j=Math.max(0,Math.floor(z-r+32));j<=Math.min(nz,Math.ceil(z+r+32));j++)for(let i=Math.max(0,Math.floor(x-r+40));i<=Math.min(nx,Math.ceil(x+r+40));i++)b=Math.max(b,height[j*(nx+1)+i]);return{lo:b+ry+.06,hi:-.30-.12*1.77-ry-.06,valid:x-r>-39.5&&x+r<39.5&&z-r>-31.5&&z+r<63.5}}
function solid(x,y,z,L){const r=L*.64;return colonies.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+r&&y-L*.27<c.y+c.h+.05&&y+L*.27>c.y-.05)}
function safe(x,y,z,L,t,w){const e=envelope(x,z,L,t,w);return e.valid&&e.lo<=y&&y<=e.hi&&!solid(x,y,z,L)}
function los(a,b){for(let k=0;k<=16;k++){const f=k/16,x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f,z=a.z+(b.z-a.z)*f;if(y<bed(x,z)+.02||colonies.some(c=>Math.hypot(x-c.x,z-c.z)<c.r&&y<c.y+c.h))return false}return true}
const roles={resident:{zh:'定居礁鱼实验体',length:.20,cruise:.18,burst:.65,turn:2.9,prey:[]},bait:{zh:'群游饵鱼实验体',length:.26,cruise:.55,burst:1.50,turn:3.5,prey:[]},predator:{zh:'捕食鱼实验体',length:1.05,cruise:.9,burst:2.25,turn:1.2,prey:['bait']}};
function createSchool(count=32){const out=[];for(let i=0;i<count;i++){
 const role=i%16<5?'resident':i%16<15?'bait':'predator',p=roles[role],zone=role==='resident'?0:role==='bait'?1:2,L=p.length*(.90+(i%4)*.06),a=i*2.399963,c=colonies[i%3];
 let x,z;if(role==='resident'){x=c.x+Math.cos(a)*(c.r+L+.6);z=c.z+Math.sin(a)*(c.r+L+.6)}else if(role==='bait'){x=8+3.5*Math.cos(a);z=22+2.3*Math.sin(a)}else{x=8+(i%3);z=28+(i%2)*3}
 let e=envelope(x,z,L),y=(e.lo+e.hi)*.5;for(let k=0;(!safe(x,y,z,L,0,.055))&&k<80;k++){z+=.5;e=envelope(x,z,L);y=(e.lo+e.hi)*.5}if(!safe(x,y,z,L,0,.055))throw Error('No safe spawn');
 out.push({id:i,role,zone,x,y,z,vx:Math.sin(a)*p.cruise,vz:Math.cos(a)*p.cruise,yaw:a,length:L,scale:L/.48,phase:i*1.753,turn:0,speed:p.cruise,home:[x,y,z],lastSafe:[x,y,z],alive:true,state:'cruise',calm:0,target:null,hunger:.8,cooldown:0,arriveAt:null});
 }return out}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)}
function segmentDistance(p,a,b){const u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[p.x-a.x,p.y-a.y,p.z-a.z],d=u.reduce((s,x)=>s+x*x,0),f=C(v.reduce((s,x,i)=>s+x*u[i],0)/(d||1),0,1);return Math.hypot(v[0]-f*u[0],v[1]-f*u[1],v[2]-f*u[2])}
function biteEligible(q,n){return q.alive&&n.alive&&roles[q.role].prey.includes(n.role)&&n.length/q.length<.36&&q.cooldown<=0&&los(q,n)}
function step(fish,dt,time,settings={}){
 dt=C(dt,0,1/30);const wave=C(settings.waveHeight??.055,0,.12),next=[];
 for(const q of fish){if(!q.alive)continue;const p=roles[q.role];q.cooldown=Math.max(0,q.cooldown-dt);q.hunger=C(q.hunger+dt*.002,0,1);let tx=q.home[0],tz=q.home[2],speed=p.cruise,ty=q.y;
 const threat=observer.active&&distance(q,observer)<(q.role==='resident'?2.5:4)?observer:fish.find(n=>n.alive&&n.role==='predator'&&q.role==='bait'&&distance(q,n)<(q.state==='flee'?7:5));
 if(threat&&q.role!=='predator'){
  if(q.state!=='flee'){qa.flees++;event('flee',time,{actor:q.id,from:threat===observer?'player':threat.id})}q.state='flee';q.calm=0;speed=p.burst;
  const d=Math.hypot(q.x-threat.x,q.z-threat.z)||1;tx=q.x+(q.x-threat.x)/d*5;tz=q.z+(q.z-threat.z)/d*5;
 }else if(q.role==='resident'){
  if(q.state==='flee'||q.state==='shelter'){q.calm+=dt;q.state=q.calm<3?'shelter':'return';}
  if(q.state==='return'){tx=q.home[0];tz=q.home[2];speed=p.cruise*1.5;if(Math.hypot(q.x-tx,q.z-tz)<.35){q.state='home';qa.returns++;event('return-home',time,{actor:q.id})}}
  if(q.state==='shelter'){tx=q.x;tz=q.z;speed=.025}
  if(q.state==='home'||q.state==='cruise'){tx=q.home[0]+.35*Math.cos(time*.22+q.id*1.753);tz=q.home[2]+.35*Math.sin(time*.22+q.id*1.753);q.state='home';speed=.10}
 }else if(q.role==='bait'){
  q.state='school';tx=8+5*Math.sin(time*.045);tz=23+3*Math.sin(time*.055+clock.tideOffset);let cx=0,cz=0,n=0;
  for(const f of fish)if(f.alive&&f.role===q.role&&f!==q&&distance(f,q)<4){cx+=f.x;cz+=f.z;n++}if(n){tx=tx*.65+cx/n*.35;tz=tz*.65+cz/n*.35}
 }else{
  q.state='patrol';tx=10+7*Math.sin(time*.08+q.id*1.753);tz=29+9*Math.cos(time*.055+q.id*1.753);
  const prey=fish.filter(n=>biteEligible(q,n)&&distance(q,n)<12).sort((a,b)=>distance(q,a)-distance(q,b))[0];
  if(prey&&q.hunger>.45){q.state='pursue';q.target=prey.id;tx=prey.x;tz=prey.z;ty=prey.y;speed=p.burst}else q.target=null;
 }
 if(q.role==='resident'&&!threat&&(clock.hour<6||clock.hour>=19)){tx=q.home[0];tz=q.home[2];speed=.025;q.state='night-shelter'}else if(q.state==='night-shelter')q.state='home';
 // Shelter, shallow crest, domain and neighbours influence steering before position acceptance.
 let ax=tx-q.x,az=tz-q.z;
 for(const c of colonies){const xx=q.x-c.x,zz=q.z-c.z,d=Math.hypot(xx,zz),s=c.r+q.length*.64+1;if(d<s&&q.y<c.y+c.h+q.length*.27){ax+=xx/Math.max(.01,d)*(s-d)*7;az+=zz/Math.max(.01,d)*(s-d)*7}}
 for(const n of fish){if(n===q||!n.alive||n.role!==q.role)continue;const xx=q.x-n.x,zz=q.z-n.z,d=Math.hypot(xx,zz),s=(q.length+n.length)*.65;if(d<s){ax+=xx/Math.max(d,.01)*(s-d)*4;az+=zz/Math.max(d,.01)*(s-d)*4}}
 if(q.role==='resident'&&q.state!=='flee'&&q.state!=='shelter'&&Math.hypot(q.x-q.home[0],q.z-q.home[2])>3){ax=q.home[0]-q.x;az=q.home[2]-q.z;q.state='return'}
 let angle=Math.atan2(ax,az);
 const lookahead=Math.max(.6,q.length*.85+q.speed*.35),angDiff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
 function routeSafe(a){
  const xx=q.x+Math.sin(a)*lookahead,zz=q.z+Math.cos(a)*lookahead,r=q.length*.64,ry=q.length*.27;
  if(xx-r<=-39.5||xx+r>=39.5||zz-r<=-31.5||zz+r>=63.5)return false;
  let high=-Infinity;for(let j=Math.max(0,Math.floor(Math.min(q.z,zz)-r+32));j<=Math.min(nz,Math.ceil(Math.max(q.z,zz)+r+32));j++)for(let i=Math.max(0,Math.floor(Math.min(q.x,xx)-r+40));i<=Math.min(nx,Math.ceil(Math.max(q.x,xx)+r+40));i++)high=Math.max(high,height[j*(nx+1)+i]);
  const lo=high+ry+.06,hi=-.30-.12*1.77-ry-.06;if(lo>hi)return false;
  for(let k=1;k<=6;k++)if(solid(q.x+(xx-q.x)*k/6,C(q.y,lo,hi),q.z+(zz-q.z)*k/6,q.length))return false;return true;
 }
 if(!routeSafe(angle)){let best=Infinity,pick=angle;for(let k=0;k<24;k++){const a=k*T/24;if(!routeSafe(a))continue;const score=angDiff(a,angle)*.65+angDiff(a,q.yaw)*.35;if(score<best){best=score;pick=a}}angle=pick}
 const delta=Math.atan2(Math.sin(angle-q.yaw),Math.cos(angle-q.yaw)),yaw=q.yaw+C(delta,-p.turn*dt,p.turn*dt),v=q.speed+C(speed-q.speed,-1.5*dt,1.5*dt),vx=Math.sin(yaw)*v,vz=Math.cos(yaw)*v;
 let x=q.x+vx*dt,z=q.z+vz*dt,e=envelope(x,z,q.length,time,wave),y=C(q.y+C(ty-q.y,-.45*dt,.45*dt),e.lo,e.hi);
 if(q.role!=='predator'&&q.state!=='flee'){const target=e.lo+(e.hi-e.lo)*.48;y=C(q.y+(target-q.y)*dt*.5,e.lo,e.hi)}
 let blocked=!e.valid||e.lo>e.hi||!safe(x,y,z,q.length,time,wave);
 if(blocked){qa.attemptsRejected++;x=q.x;y=q.y;z=q.z;}
 if(!safe(x,y,z,q.length,time,wave)){qa.invalidPlacements++;q.alive=false;event('habitat-invalid-hidden',time,{actor:q.id});continue}
 next.push([q,{x,y,z,vx:blocked?0:vx,vz:blocked?0:vz,yaw,turn:C(delta,-1,1),speed:blocked?0:v,phase:q.phase+dt*(.3+v/q.length*.55)*T,lastSafe:[x,y,z],blocked}, {x:q.x,y:q.y,z:q.z}]);
 }
 for(const[q,n,old]of next){if(!q.alive)continue;Object.assign(q,n);if(q.role!=='predator'||q.state!=='pursue')continue;const prey=fish.find(n=>n.id===q.target);if(!prey||!biteEligible(q,prey))continue;
 const reach=q.length*.44,front={x:q.x+Math.sin(q.yaw)*reach,y:q.y,z:q.z+Math.cos(q.yaw)*reach},before={x:old.x+Math.sin(q.yaw)*reach,y:old.y,z:old.z+Math.cos(q.yaw)*reach};
 if(segmentDistance(prey,before,front)<q.length*.12+prey.length*.18){prey.alive=false;prey.state='consumed';q.cooldown=18;q.hunger=.15;q.state='recover';qa.captures++;event('predation-contact',time,{predator:q.id,prey:prey.id,model:'authored mouth-sweep capture; not calibrated feeding success'});}
 }
 qa.steps++;
}
function inspectBody(q,mesh,time,w=.055){if(!q.alive)return{pass:true,skipped:true,minBedClearanceM:Infinity,minSurfaceClearanceM:Infinity};let minB=Infinity,minS=Infinity,colliderHits=0;const co=Math.cos(q.yaw),si=Math.sin(q.yaw),p=mesh.positions;for(let i=0;i<p.length;i+=3){const x=q.x+(co*p[i]+si*p[i+2])*q.scale,z=q.z+(-si*p[i]+co*p[i+2])*q.scale,y=q.y+p[i+1]*q.scale;minB=Math.min(minB,y-bed(x,z));minS=Math.min(minS,surface(x,z,time,w)-y);if(colonies.some(c=>Math.hypot(x-c.x,z-c.z)<c.r&&y<c.y+c.h&&y>c.y))colliderHits++}qa.minBedClearanceM=Math.min(qa.minBedClearanceM,minB);qa.minSurfaceClearanceM=Math.min(qa.minSurfaceClearanceM,minS);return{minBedClearanceM:minB,minSurfaceClearanceM:minS,colliderHits,pass:minB>=0&&minS>=0&&colliderHits===0}}
function grid(kind='seabed',t=0,w=.055){const p=[],co=[],idx=[];for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=-40+i,z=-32+j,y=kind==='water'?surface(x,z,t,w):height[j*(nx+1)+i];p.push(x,y,z);const b=height[j*(nx+1)+i],deep=smooth(-1,-14,b),rock=smooth(.6,3,b),speck=.025*Math.sin(i*2.8+j*.94);if(kind==='water')co.push(.10+deep*.01,.62-deep*.34,.67-deep*.18);else co.push(.76-.29*rock+speck,.68-.16*rock+speck,.51-.08*rock+speck)}for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;idx.push(a,a+nx+1,a+nx+2,a,a+nx+2,a+1)}const positions=new Float32Array(p),indices=new Uint16Array(idx);return{positions,indices,colors:new Float32Array(co),normals:FishMother.computeNormals(positions,indices),metrics:{kind,vertexCount:p.length/3,triangleCount:idx.length/3,siteCalibrated:false}}}
function sample(p,t=0,s={}){const old=OceanField.sample(p,t,s),water=surface(p[0],p[2],t,s.waveHeight??.055),seabed=bed(p[0],p[2]);return{...old,seabedY:seabed,waterSurfaceY:water,depthM:Math.max(0,water-seabed),habitat:zoneAt(p[0],p[2]),substrate:seabed>.5?'limestone-candidate':seabed>-.5?'sand':'reef-sand-mosaic',hour:clock.hour,tide:tide(t),season:clock.season,siteCalibrated:false}}
function journalSnapshot(fish,origin,time,radius=10){return fish.filter(q=>q.alive&&distance(q,origin)<radius&&los(q,origin)).map(q=>({actorId:q.id,identity:'unidentified-native-study',role:q.role,behavior:q.state,positionM:[q.x,q.y,q.z],depthM:surface(q.x,q.z,time)-q.y,habitat:zoneAt(q.x,q.z),timeS:time,hour:clock.hour,tideM:tide(time),evidence:'observed simulation; not field observation'}))}
const narrative={emitted:false};
function pollNarrative(s){if(!s||!Number.isFinite(s.elapsedDays)||s.elapsedDays<90||!s.stormAftermath||!s.hasSafeShelter||s.companionOwned||s.completedEvents?.includes('cat-drift-once')||narrative.emitted)return null;narrative.emitted=true;return{type:'companion-rescue-opportunity',id:'cat-drift-once',fiction:true,alreadySpawned:false,requiresGameMother:true,elapsedDays:s.elapsedDays,description:'A sheltered drifting wreck offers a rare rescue opportunity, not a natural migration claim.'}}
return{bounds,zones,colonies,roles,clock,observer,bed,surface,tide,exposure,zoneAt,grid,envelope,safe,solid,los,createSchool,step,inspectBody,sample,qa,events,setObserver,journalSnapshot,pollNarrative,biteEligible};
})();

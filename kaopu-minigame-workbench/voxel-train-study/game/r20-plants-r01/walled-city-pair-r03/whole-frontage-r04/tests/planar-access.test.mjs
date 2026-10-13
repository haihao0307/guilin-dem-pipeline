import test from 'node:test';
import assert from 'node:assert/strict';
import {FLOORS} from '../runtime/world-data.mjs';
import {GEOMETRY_WGSL} from '../runtime/geometry.mjs';

// Nominal, upright 1.75 m body, diameter .44 m plus .012 m radial clearance.
// A successful search certifies only this explicit horizontal obstacle model.
// It is not the material SDF, stair/headroom, structural or whole-world proof.
// Windows are impassable; no crouching, climbing, moving furniture or leaving
// supported floor is permitted. Tables/shelves block at their actual heights.
// Repeated furniture is represented as complete nominal pieces, never made
// passable by a shader's nearest-cell/point-selection clipping.
// A front-door goal is its threshold, not proof that an entire infill is walk-in.
// Scope excludes vertical gait, canopy/service pipes, displaced material detail,
// moving-door sweeps and structural support. Separate tests cover nominal
// stairs/headroom. A grid failure needs geometric diagnosis: it is not alone a
// mathematical proof that no arbitrarily narrow continuous route exists.
// Run: node --test whole-frontage-r04/tests/planar-access.test.mjs
// Optional diagnostics: PLANAR_REPORT=1; focus: PLANAR_FLOOR=B-F11.
export const BODY_RADIUS=.22, MATERIAL_MARGIN=.012, R=BODY_RADIUS+MATERIAL_MARGIN;
export const GRID=.02, BODY_HEIGHT=1.75;
const outOf=f=>f.buildingId==='A'?1:-1;
const sleepCodes=new Set([4,5,8,9,11,12,13]);
const dividerCodes=new Set([4,5,8,9,11]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function rectangleDistance(x,z,o){
 const dx=x-o.x,dz=z-o.z,u=dx*o.c+dz*o.s,v=-dx*o.s+dz*o.c;
 const ax=Math.abs(u)-o.hx,az=Math.abs(v)-o.hz;
 return Math.hypot(Math.max(0,ax),Math.max(0,az))+Math.min(Math.max(ax,az),0);
}
function segmentDistance(ax,az,bx,bz,cx,cz,dx,dz){
 const point=(x,z,u,v,w,t)=>{const vx=w-u,vz=t-v,k=clamp(((x-u)*vx+(z-v)*vz)/(vx*vx+vz*vz||1),0,1);return Math.hypot(x-u-vx*k,z-v-vz*k);};
 const orient=(x,z,u,v,w,t)=>(u-x)*(t-z)-(v-z)*(w-x);
 const p=orient(ax,az,bx,bz,cx,cz),q=orient(ax,az,bx,bz,dx,dz),r=orient(cx,cz,dx,dz,ax,az),s=orient(cx,cz,dx,dz,bx,bz);
 if(p*q<=0&&r*s<=0&&Math.max(Math.min(ax,bx),Math.min(cx,dx))<=Math.min(Math.max(ax,bx),Math.max(cx,dx))&&Math.max(Math.min(az,bz),Math.min(cz,dz))<=Math.min(Math.max(az,bz),Math.max(cz,dz)))return 0;
 return Math.min(point(ax,az,cx,cz,dx,dz),point(bx,bz,cx,cz,dx,dz),point(cx,cz,ax,az,bx,bz),point(dx,dz,ax,az,bx,bz));
}
export function segmentRectangleDistance(ax,az,bx,bz,o){
 if(rectangleDistance(ax,az,o)<=0||rectangleDistance(bx,bz,o)<=0)return 0;
 const corners=[[-o.hx,-o.hz],[o.hx,-o.hz],[o.hx,o.hz],[-o.hx,o.hz]].map(([u,v])=>[o.x+u*o.c-v*o.s,o.z+u*o.s+v*o.c]);
 let d=Infinity;for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];d=Math.min(d,segmentDistance(ax,az,bx,bz,...a,...b));}return d;
}
export function buildPlan(f){
 const obs=[],goals=[],out=outOf(f),lo=f.cx-f.width/2,hi=f.cx+f.width/2;
 const inner=f.cx+out*(f.width/2-1.90),partition=inner-out*1.12,entry=2.4-out*1.44;
 const living=f.cx-out*1.51,sep=[0,6].includes(f.programmeCode)?3.55:2.9,wetX=partition-out*.60;
 const left=out===1?lo:partition,right=out===1?partition:hi;
 function rect(label,x,z,hx,hz,angle=0,minY=0,maxY=BODY_HEIGHT){
  if(hx<=0||hz<=0||maxY<.02||minY>.02+BODY_HEIGHT)return;
  const c=Math.cos(angle),s=Math.sin(angle),ex=Math.abs(c)*hx+Math.abs(s)*hz,ez=Math.abs(s)*hx+Math.abs(c)*hz;
  obs.push({label,x,z,hx,hz,c,s,minX:x-ex,maxX:x+ex,minZ:z-ez,maxZ:z+ez});
 }
 function horizontal(label,z,x0,x1,t=.11){if(x1>x0)rect(label,(x0+x1)/2,z,(x1-x0)/2,t);}
 function vertical(label,x,z0,z1,t=.11){if(z1>z0)rect(label,x,(z0+z1)/2,t,(z1-z0)/2);}
 function wallWithHole(label,axis,c,from,to,hole,h){
  if(axis==='x'){horizontal(label+' left',c,from,hole-h);horizontal(label+' right',c,hole+h,to);}
  else{vertical(label+' front',c,from,hole-h);vertical(label+' rear',c,hole+h,to);}
 }
 function leaf(label,x,z,half,{side=false,mirror=false}={}){
  if(side)rect(label,x+half*.65,z-half+.035,half*.98,.025,Math.PI/6,.035,2.025);
  else rect(label,x+(mirror?1:-1)*(half-.035),z+half*.65,half*.98,.025,mirror?2*Math.PI/3:Math.PI/3,.035,2.025);
 }
 function table(label,x,z,hx,hz,height){rect(label,x,z,hx,hz,0,height-.035,height+.035);}
 function bed(label,x,z,bunk){
  // Actual union of footprint pieces; do not fill the outer AABB corners.
  for(const sx of [-1,1]){rect(label+' side '+sx,x+sx*.53,z,.032,1.04,0,.355,.525);for(const sz of [-1,1])rect(label+' post '+sx+','+sz,x+sx*.53,z+sz*.99,.042,.042,0,0,bunk?2.22:1.22);}
  for(const sz of [-1,1])rect(label+' end '+sz,x,z+sz*.99,.55,.033,0,.355,.525);
  rect(label+' mattress',x,z,.515,.96,0,.49,.67);
  rect(label+' bedding',x,z-.66,.525,.255,0,.58,.82);
 }
 // Actual exterior walls. Side openings exist only at supported borrowed links
 // and ground-level entrances; the floor-domain check prevents escape into air.
 const sideDoor=f.level===0||['A-F03','A-F07','A-F10','B-F03','B-F07','B-F10'].includes(f.id);
 for(const side of [-1,1]){
  const x=f.cx+side*f.width/2;
  if(side===out&&sideDoor){wallWithHole('gap-side wall','z',x,f.front,f.rear,.25,.48);vertical('gap door jamb front',x,-.285,-.215,.085);vertical('gap door jamb rear',x,.715,.785,.085);leaf('gap door leaf',x,.25,.48,{side:true});}
  else vertical(side===out?'gap-side wall':'outer side wall',x,f.front,f.rear);
 }
 horizontal('rear wall',f.rear,lo,hi);
 const openings=[];
 for(let i=0;i<3;i++){
  const b=f.frontage.bounds,pitch=(b[i+1]-b[i])*f.width,x=lo+(b[i]+b[i+1])*f.width/2,type=f.frontage.types[i];
  if(type<3)continue;
  const half=type===4?pitch*.40:Math.min(.51,pitch*.29);
  openings.push({i,x,half});
  vertical('front door '+i+' left jamb',x-half-.02,f.front-.09,f.front+.08,.035);
  vertical('front door '+i+' right jamb',x+half+.02,f.front-.09,f.front+.08,.035);
  // Actual open sliding panels park outside the original wall on B-F11.
  if(f.id==='B-F11'&&i>=1){for(const sign of [-1,1])rect('front door '+i+' parked panel '+sign,x+sign*1.5*half,f.front-.005-.15,half*.5,.025,0,.035,2.025);}
  else leaf('front door '+i+' leaf',x,f.front-.005,half);
  goals.push({name:'front door '+i,box:[x-half+.015,f.front-.025,x+half-.015,f.front+.025],preferred:[x,f.front]});
 }
 let xx=lo;for(const ap of openings.sort((a,b)=>a.x-b.x)){horizontal('front wall',f.front,xx,ap.x-ap.half);xx=ap.x+ap.half;}horizontal('front wall',f.front,xx,hi);
 // Internal core partition has .075 m half-thickness, not exterior .11 m.
 vertical('core partition front',partition,f.front+.12,entry-.48,.075);
 vertical('core partition rear',partition,entry+.48,f.rear-.12,.075);
 horizontal('wet divider left',sep,left,wetX-.43,.065);
 horizontal('wet divider right',sep,wetX+.43,right,.065);
 goals.push({name:'wet area',box:[wetX-.15,sep+.30,wetX+.15,sep+.50],preferred:[wetX,sep+.40]});
 const passage=Math.max(-.25,f.front+.70);
 if(dividerCodes.has(f.programmeCode)){
  const start=Math.max(f.front+.12,-2.0),end=sep-.07;
  vertical('room divider front',living,start,Math.min(end,passage-.42),.065);
  vertical('room divider rear',living,Math.max(start,passage+.42),end,.065);
  goals.push({name:'room divider crossing',box:[living-.03,passage-.18,living+.03,passage+.18],preferred:[living,passage]});
 }
 // Main-level void is unavailable except for the actual arrival platform.
 rect('stair void before platform',inner,(.25+entry-.43)/2,1.10,(entry-.43-.25)/2);
 rect('stair void after platform',inner,(entry+.43+4.55)/2,1.10,(4.55-entry-.43)/2);
 horizontal('entry landing guard',entry-out*.40,inner-1.06,inner+1.06,.027);
 // Every nominal furniture piece is present, including formerly clipped backs.
 for(const bay of [-1,1]){
  const cx=living+bay*(f.width-3.1)*.245,cz=Math.max(1.30,f.front+2.20),label='room '+(bay<0?'left':'right');
  if(sleepCodes.has(f.programmeCode)){
   const compact=f.front>-1,ix=cx-bay*(compact?.95:.82);
   bed(label+' bed',cx+bay*.15,Math.min(cz+.25,1.55),f.programmeCode===5);
   const cupboardZ=compact?f.rear-.75:Math.min(cz+1.7,2.3);
   rect(label+' cupboard',ix,cupboardZ,.35,.30,0,0,1.26);
   if(compact){const operation=[ix,cupboardZ-.30-R];goals.push({name:label+' cupboard front operation',point:operation,preferred:operation});}
   table(label+' desk',compact?ix:cx-.1,compact?1.6:cz-1.35,.48,.26,.72);
   table(label+' stool',compact?ix:cx+.15,compact?.9:cz-1.9,.19,.19,.43);
  }else if(f.programmeCode===2){
   for(const ix of [-1,0,1])for(const iz of [-1,0,1]){table(label+` school table ${ix},${iz}`,cx+ix*.83,cz+iz*1.05,.33,.22,.62);table(label+` school stool ${ix},${iz}`,cx+ix*.83,cz+iz*1.05-.43,.19,.19,.43);}
   rect('teaching rear board',f.cx,f.rear-.25,1.2,.045,0,.7,1.66);
  }else if(f.programmeCode===3){
   table(label+' barber stool',cx,cz,.19,.19,.43);rect(label+' chair back',cx,cz+.13,.24,.03,0,.48,1.04);rect(label+' mirror',cx,cz+1,.36,.015,0,.68,1.8);table(label+' barber counter',cx,cz+.82,.52,.20,.85);
  }else{table(label+' work table',cx,cz,.85,.6,f.programmeCode===0?.93:.78);table(label+' work stool',cx,cz-.9,.19,.19,.43);}
  rect(label+' rear shelf',cx-bay*.85,f.rear-.30,.6,.22,0,1.335,1.405);
  rect(label+' stored cloth',cx-bay*.85+.15,f.rear-.29,.20,.14,0,1.41,1.69);
  // Witness in the usable front part of each room, not under its furniture.
  goals.push({name:label+' front area',box:[bay<0?left+.12:living+.08,f.front+.14,bay<0?living-.08:right-.12,Math.min(sep-.20,Math.max(f.front+1.2,-.55))],preferred:[cx,Math.max(f.front+.45,-.8)]});
 }
 const basinX=f.cx-out*(f.width/2-.75),basinZ=f.rear-1.05;
 rect('wash basin',basinX,basinZ,.54,.38,0,.56,1.);
 rect('wash shelf',basinX+.84,basinZ+.03,.26,.35,0,.685,.755);
 if(f.balcony){
  // Match balconyBounds: only the contiguous span granted by actual entrances
  // or drying rights is supported. Deleted side slabs cannot be route detours.
  const active=[0,1,2].filter(i=>f.frontage.types[i]>=3||(f.frontage.dryingMask&(1<<i)));
  assert.ok(active.length,f.id+' balcony has no active right');
  const bx0=lo+f.frontage.bounds[Math.min(...active)]*f.width,bx1=lo+f.frontage.bounds[Math.max(...active)+1]*f.width;
  horizontal('balcony front rail',f.front-.91,bx0,bx1,.027);
  vertical('balcony left rail',bx0,f.front-.91,f.front,.027);
  vertical('balcony right rail',bx1,f.front-.91,f.front,.027);
  if(bx0>lo)rect('unsupported balcony left', (lo+bx0)/2,f.front-.475,(bx0-lo)/2,.475);
  if(bx1<hi)rect('unsupported balcony right',(bx1+hi)/2,f.front-.475,(hi-bx1)/2,.475);
 }
 if(f.growth){
  const e=f.growth,z=f.front-e.depthM;
  horizontal('infill front wall',z,e.centerX-e.halfWidth,e.centerX+e.halfWidth,.065);
  vertical('infill left wall',e.centerX-e.halfWidth,z,f.front,.055);vertical('infill right wall',e.centerX+e.halfWidth,z,f.front,.055);
  if(e.use.includes('storage')){rect('infill storage shelf',e.centerX,z+.20,e.halfWidth*.70,.11,0,.52,1.56);rect('infill stored textile',e.centerX,z+.20,e.halfWidth*.46,.105,0,.60,1.84);}
  else{table('infill work table',e.centerX+.35,z+.26,.48,.17,.74);rect('infill shelf',e.centerX-.55,z+.18,.30,.14,0,.875,.945);}
 }
 return {floor:f,obs,goals,start:[inner,entry],bounds:[lo,f.front-(f.balcony?.95:f.level===0?.65:0),hi,f.rear],model:'nominal-planar-upright-v1'};
}

export function searchPlan(plan){
 const [x0,z0,x1,z1]=plan.bounds,nx=Math.floor((x1-x0)/GRID)+1,nz=Math.floor((z1-z0)/GRID)+1,N=nx*nz;
 const occupied=new Uint8Array(N),owner=new Int16Array(N).fill(-1),bucketSize=.25,buckets=new Map();
 const key=(x,z)=>Math.floor(x/bucketSize)+','+Math.floor(z/bucketSize);
 for(let k=0;k<plan.obs.length;k++){
  const o=plan.obs[k],ia=clamp(Math.floor((o.minX-R-x0)/GRID),0,nx-1),ib=clamp(Math.ceil((o.maxX+R-x0)/GRID),0,nx-1),ja=clamp(Math.floor((o.minZ-R-z0)/GRID),0,nz-1),jb=clamp(Math.ceil((o.maxZ+R-z0)/GRID),0,nz-1);
  for(let j=ja;j<=jb;j++)for(let i=ia;i<=ib;i++){const id=j*nx+i;if(rectangleDistance(x0+i*GRID,z0+j*GRID,o)<R){occupied[id]=1;owner[id]=k;}}
  for(let j=Math.floor((o.minZ-R-GRID)/bucketSize);j<=Math.floor((o.maxZ+R+GRID)/bucketSize);j++)for(let i=Math.floor((o.minX-R-GRID)/bucketSize);i<=Math.floor((o.maxX+R+GRID)/bucketSize);i++){const id=i+','+j;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(k);}
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)if(x0+i*GRID<x0+R||x0+i*GRID>x1-R||z0+j*GRID<z0+R||z0+j*GRID>z1-R)occupied[j*nx+i]=1;
 const point=id=>[x0+(id%nx)*GRID,z0+Math.floor(id/nx)*GRID];
 const nearest=(p,condition,max=.08)=>{let best=-1,d=Infinity;const ci=Math.round((p[0]-x0)/GRID),cj=Math.round((p[1]-z0)/GRID),n=Math.ceil(max/GRID);for(let j=Math.max(0,cj-n);j<=Math.min(nz-1,cj+n);j++)for(let i=Math.max(0,ci-n);i<=Math.min(nx-1,ci+n);i++){const id=j*nx+i,pp=point(id),dd=Math.hypot(pp[0]-p[0],pp[1]-p[1]);if(dd<d&&dd<=max&&condition(id)){best=id;d=dd;}}return best;};
 const root=nearest(plan.start,id=>!occupied[id]),seen=new Uint8Array(N),parent=new Int32Array(N).fill(-1),queue=new Int32Array(N);let head=0,tail=0;
 function edgeFree(a,b){const p=point(a),q=point(b);for(const k of buckets.get(key((p[0]+q[0])/2,(p[1]+q[1])/2))??[])if(segmentRectangleDistance(...p,...q,plan.obs[k])<R)return false;return true;}
 if(root>=0){queue[tail++]=root;seen[root]=1;while(head<tail){const id=queue[head++],i=id%nx,j=Math.floor(id/nx);for(const next of [i>0?id-1:-1,i+1<nx?id+1:-1,j>0?id-nx:-1,j+1<nz?id+nx:-1]){if(next<0||seen[next]||occupied[next]||!edgeFree(id,next))continue;seen[next]=1;parent[next]=id;queue[tail++]=next;}}}
 function blockers(p){return plan.obs.map(o=>({label:o.label,distance:Number(rectangleDistance(...p,o).toFixed(4))})).filter(o=>o.distance<R+.12).sort((a,b)=>a.distance-b.distance).slice(0,8);}
 function path(id){const nodes=[];while(id>=0){nodes.push(point(id).map(x=>Number(x.toFixed(3))));id=parent[id];}nodes.reverse();return nodes.filter((_,i)=>i===0||i===nodes.length-1||i%20===0);}
 const results=plan.goals.map(goal=>{
  // Operation-point targets retain their exact requested point. A nearby grid
  // node counts only if the final continuous swept-disk segment is collision-free.
  const pointClear=goal.point?plan.obs.every(o=>rectangleDistance(...goal.point,o)>=R-1e-9):true;
  const [a,b,c,d]=goal.box??[goal.point[0]-GRID*2,goal.point[1]-GRID*2,goal.point[0]+GRID*2,goal.point[1]+GRID*2];let reached=-1,free=0,near=-1,dnear=Infinity,blockedNear=-1,blockedD=Infinity;
  for(let j=Math.max(0,Math.ceil((b-z0)/GRID));j<=Math.min(nz-1,Math.floor((d-z0)/GRID));j++)for(let i=Math.max(0,Math.ceil((a-x0)/GRID));i<=Math.min(nx-1,Math.floor((c-x0)/GRID));i++){const id=j*nx+i,p=point(id),dd=Math.hypot(p[0]-goal.preferred[0],p[1]-goal.preferred[1]);if(occupied[id]){if(dd<blockedD){blockedD=dd;blockedNear=id;}}else if(pointClear&&(!goal.point||plan.obs.every(o=>segmentRectangleDistance(...p,...goal.point,o)>=R-1e-9))){free++;if(seen[id])reached=id;}}
  if(reached<0)for(let k=0;k<tail;k++){const id=queue[k],p=point(id),dd=Math.hypot(p[0]-goal.preferred[0],p[1]-goal.preferred[1]);if(dd<dnear){dnear=dd;near=id;}}
  const endpoint=reached>=0?reached:near,probe=free===0&&blockedNear>=0?point(blockedNear):goal.preferred;
  const route=endpoint<0?[]:path(endpoint);if(reached>=0&&goal.point)route.push(goal.point);
  return {goal:goal.name,reachable:reached>=0,freeGoalSamples:free,preferred:goal.preferred,closestReachable:endpoint<0?null:point(endpoint),blockers:blockers(probe),path:route};
 });
 return {floor:plan.floor.id,model:plan.model,radius:R,grid:GRID,start:plan.start,startFree:root>=0,reachableSamples:tail,obstacles:plan.obs.length,results,failures:results.filter(x=>!x.reachable)};
}

test('planar distance primitives include rotated leaves and continuous swept-disk edges',()=>{
 const o={x:0,z:0,hx:1,hz:.025,c:Math.cos(Math.PI/3),s:Math.sin(Math.PI/3)};
 assert.ok(rectangleDistance(.5,.8660254,o)<0);assert.ok(rectangleDistance(-.5,.8,o)>.2);
 assert.equal(segmentRectangleDistance(-2,0,2,0,o),0);
 assert.ok(segmentRectangleDistance(2,2,3,2,o)>R);
 assert.equal(R,.232);
});
test('nominal furniture and wall adapter is tied to the actual shader rules',()=>{
 for(const pattern of [/min\(center.z\+\.25,1.55\)/,/min\(center.z\+1.7,2.3\)/,/center.x-bay\*select\(\.82,\.95,compact\)/,/select\(center.z-1.35,1.6,compact\)/,/select\(center.z-1.9,\.9,compact\)/,/partitionX\+select\(-\.60,\.60,bid==2u\)/,/max\(-\.25,b.x\+\.70\)/])assert.ok(pattern.test(GEOMETRY_WGSL),'Plan adapter needs review after shader rule changed: '+pattern);
 assert.doesNotMatch(GEOMETRY_WGSL,/if\(abs\(p.x-inner\)>1.0&&p.z>/,'Do not certify clipped-away furniture as a clear route');
 // Source binding for the actual two B-F11 exterior sliding doors.
 assert.ok(/s==25u[^;\n]{0,160}cell>=1u|s==25u[^;\n]{0,160}cell>0u/.test(GEOMETRY_WGSL),'B-F11 sliding-door selector must exist in source');
 assert.ok(/select\(-1.5,1.5,q.x>0.\)\*half.x,0.,-.15/.test(GEOMETRY_WGSL),'Sliding panel placement changed; review adapter');
 assert.ok(/select\(min\(center.z\+1.7,2.3\),b.y-.75,compact\)/.test(GEOMETRY_WGSL),'Compact cupboard must really be moved behind the wet wall');
 assert.ok(/let sh=vec3<f32>\(center.x-bay\*\.85,a.y\+1.37,b.y-.30\)/.test(GEOMETRY_WGSL),'Rear shelf must match the raised 1.37 m source height');
 const storage=GEOMETRY_WGSL.slice(GEOMETRY_WGSL.indexOf('fn householdFrontageStorage('),GEOMETRY_WGSL.indexOf('fn householdFrontageExterior('));
 assert.ok(/vec3<f32>\(hw\*\.70,\.03,\.11\)/.test(storage),'Storage shelf depth changed; review adapter');
 assert.ok(/vec3<f32>\(hw\*\.46,\.13,\.105\)/.test(storage),'Storage textile depth changed; review adapter');
});
test('all eight compact-room cupboards have exact unchanged-radius front-operation targets and shelf clearance',()=>{
 const compact=FLOORS.filter(f=>f.front>-1&&sleepCodes.has(f.programmeCode));assert.equal(compact.length,4);
 let count=0;for(const f of compact){const p=buildPlan(f),targets=p.goals.filter(g=>g.name.endsWith('cupboard front operation'));assert.equal(targets.length,2);for(const target of targets){count++;assert.ok(target.point);assert.ok(Math.abs(target.point[1]-(f.rear-.75-.30-R))<1e-10);}
  assert.ok(1.37-.035-1.26>2*MATERIAL_MARGIN,f.id+' rear shelf intersects cupboard top');
 }
 assert.equal(count,8);
});
test('all four three-tier storage infills retain threshold clearance and do not protrude through the new shell',()=>{
 const storage=FLOORS.filter(f=>f.growth?.use.includes('storage'));assert.equal(storage.length,4);
 for(const f of storage){const e=f.growth;
  for(const [label,halfZ,halfX] of [['shelf',.11,e.halfWidth*.70],['textile',.105,e.halfWidth*.46]]){
   assert.ok(.20-halfZ-.065>2*MATERIAL_MARGIN,f.id+' '+label+' intersects outer shell after displacement allowance');
   assert.ok(e.depthM-.20-halfZ>R,f.id+' '+label+' blocks the unchanged full-radius threshold');
   assert.ok(e.halfWidth-.055-halfX>2*MATERIAL_MARGIN,f.id+' '+label+' intersects side shell');
  }
  assert.ok(1.84+MATERIAL_MARGIN<e.clearHeightM,f.id+' top tier exceeds the original clear height');
 }
});
for(const f of FLOORS.filter(f=>!process.env.PLANAR_FLOOR||f.id===process.env.PLANAR_FLOOR))test(`${f.id}: nominal fixed-body core, wet-area, front-door and room routes`,()=>{
 const report=searchPlan(buildPlan(f));
 if(process.env.PLANAR_REPORT)console.log('PLANAR_ACCESS '+JSON.stringify(report));
 assert.ok(report.startFree,JSON.stringify({floor:f.id,start:report.start,error:'core entry point is obstructed'}));
 assert.deepEqual(report.failures.map(({path,...r})=>({...r,pathEnd:path.slice(-5)})),[],JSON.stringify({floor:f.id,failures:report.failures.map(({path,...r})=>({...r,pathEnd:path.slice(-5)}))}));
});

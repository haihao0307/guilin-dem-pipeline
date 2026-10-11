/** Whole-settlement rule prototype. Metres, authored relative years and shared host seconds.
 * No surfaces, vertices, brick lists, renderer or implicit-geometry claims are produced.
 * Dimensions, households, programmes and historical causes below are authored examples.
 */
import {validatePlan,reachable,sectionContract} from '../architecture/data-contract.mjs';
export const VERSION='whole-settlement-rules-r01';
export const RAIL=Object.freeze({axis:'X',gaugeM:1.435,railTopM:.3485,
  reserve:{min:[-31,-.25,-3],max:[31,5.6,3]},
  sourceSnapshot:{file:'kowloon-station-r03/restored/.../game/r20-plants-r01/metre-scale.mjs',consistHalfWidthM:1.75,consistTopWorldM:4.65},
  status:'3.0 m half-width and 5.6 m top are conservative design reservations, not a measured dynamic rolling-stock envelope or railway compliance pass'});
const NEEDS=[
 ['family-growth','An older child needs a separate sleeping place'],
 ['care','A relative moves in so care can be shared'],
 ['livelihood','Home production needs a dry work area'],
 ['shared-life','Two related households negotiate additional living space'],
 ['light','An upper room seeks more open sky after a neighbour grows'],
 ['learning','A household adds a quiet learning corner away from machines']
];
// Authored parcels, not a reconstructed cadastral map or random height field.
// Each row: x,z,width,depth,storeyRise,upperNeedEvents,groundProgramme,foundingYear.
const RAW=[
 [-22.5,-8.7,6.5,6.4,2.75,10,'noodle',0],[-14.5,-8.8,6.8,6.7,2.90,13,'shop',2],[-6.3,-8.9,7.2,6.8,2.65,8,'barber',1],[2.2,-8.5,7.1,6.0,2.80,11,'textile-workshop',4],[10.4,-8.8,6.8,6.5,2.70,6,'dentist',5],[18.4,-8.6,6.5,6.3,2.95,9,'repair-workshop',3],
 [-22.9,8.8,6.7,6.5,2.85,12,'steamed-food-learning',1],[-14.7,8.6,6.7,6.2,2.70,9,'shop',3],[-6.5,8.9,7.0,6.8,2.80,14,'learning',0],[1.8,8.7,6.9,6.5,2.65,7,'metal-workshop',6],[10.0,8.9,7.0,6.7,2.90,11,'home-kitchen',2],[18.2,8.6,6.5,6.1,2.75,5,'laundry-service',5],
 [-23.0,-16.8,6.6,6.2,2.65,6,'home-workshop',4],[-14.8,-17.2,6.6,6.5,2.85,8,'shop',5],[-6.7,-17.0,6.7,6.0,2.75,11,'home-workshop',3],[1.5,-16.9,7.0,6.0,2.95,4,'shared-kitchen',7],[10.0,-17.1,7.0,6.2,2.70,9,'home-workshop',6],[18.5,-16.8,6.5,6.2,2.80,7,'repair-workshop',4],
 [-22.7,17.0,6.5,6.1,2.80,8,'home-workshop',2],[-14.5,17.1,6.5,6.3,2.65,10,'shop',5],[-6.3,17.3,7.0,6.2,2.90,6,'shared-kitchen',4],[2.1,17.1,7.2,6.0,2.75,12,'home-workshop',3],[10.5,17.0,6.8,6.0,2.85,5,'laundry-service',7],[18.7,16.9,6.5,6.3,2.70,9,'home-workshop',6]
];
export const PARCELS=Object.freeze(RAW.map((v,i)=>Object.freeze({id:`B${String(i+1).padStart(2,'0')}`,ownerId:`owner-${i+1}`,x:v[0],z:v[1],width:v[2],depth:v[3],rise:v[4],needEvents:v[5],programme:v[6],foundYear:v[7],entrySide:i<6?-1:i<12?1:i<18?-1:1,outer:i>=12,coreSide:i%2?-1:1,coreEnd:i%4<2?-1:1,planGrammar:['side-core/cross-depth-partitions','opposite-side-core/open-work-front','corner-core/care-common-space','corner-core/learning-nook'][i%4],groundRise:3.25+(i%3)*.15,provenance:'authored'})));
const aabb=(min,max)=>({min,max});
export const overlaps=(a,b)=>a.min.every((x,i)=>x<b.max[i]-1e-7&&a.max[i]>b.min[i]+1e-7);
const near=(a,b)=>Math.abs(a-b)<1e-6;
const uid=(p,s)=>`${p.id}-${s}`;
const sourceFor=(kind)=>kind==='door-leaf'?'wood-v3':kind==='door-frame'?'wood-v3':kind==='rail'?'FH88-metal':'R3.12-brick-plaster-V26';
const point=(x,y,z)=>[x,y,z];
const addRoute=(w,id,from,to,kind,more={})=>w.routes.push({id,from,to,kind,widthM:1.05,headroomM:2.15,clearanceStatus:'pending',...more});
function component(w,p,id,kind,event,supportIds,more={}){
 const fabricStateId=id+'-fabric';w.components.push({id,kind,bornEventId:event.id,motherSourceId:sourceFor(kind),fabricStateId,supportIds,...more});
 w.fabricStates.push({id:fabricStateId,constructionEventId:event.id,constructionYear:event.tick,maintenance:[],exposureLinks:[uid(p,'drain')],useLinks:[uid(p,'household')],status:'same state ID reserved for future shape and PBR; no GPU evaluation yet'});
 return id;
}
function eventFor(p,f){
 const tick=p.foundYear+f*2+(f>4?Math.floor((f-4)/3):0),need=NEEDS[(f+PARCELS.indexOf(p))%NEEDS.length];
 return {id:uid(p,`event-${f}`),tick,buildingId:p.id,ownerId:p.ownerId,kind:f?'add-storey':'found',reason:f?need[1]:'A household establishes a home and livelihood on its own authored parcel',causeIds:f?[uid(p,`life-${f}`)]:[],dependsOn:f?[uid(p,`event-${f-1}`)]:[],provenance:{kind:'authored'},needKind:need[0],floor:f};
}
export function history(){return PARCELS.flatMap(p=>Array.from({length:p.needEvents+1},(_,f)=>eventFor(p,f))).sort((a,b)=>a.tick-b.tick||a.buildingId.localeCompare(b.buildingId));}
function addFloor(w,p,e){
 const f=e.floor,y=f? p.groundRise+(f-1)*p.rise:0,h=f?p.rise:p.groundRise;
 const streetZ=p.outer?(p.z>0?22:-22):(p.z>0?4.15:-4.15);
 const faceZ=p.z+(streetZ>p.z?1:-1)*p.depth/2;
 const building=w.buildings.find(b=>b.id===p.id);
 if(!building){
  w.buildings.push({id:p.id,ownerId:p.ownerId,originM:[p.x,0,p.z],floorElevationsM:[],entrySpaceId:uid(p,'landing-0'),ownStairRouteIds:[],footprintM:[p.width,p.depth],planGrammar:p.planGrammar,coreSide:p.coreSide,programme:p.programme,stoppedGrowthReason:'No further funded household proposal in the authored event log; not random truncation'});
  const found=uid(p,'foundation');component(w,p,found,'foundation',e,[],{foundation:true});
  w.spaces.push({id:uid(p,'street'),buildingId:null,use:'street',positionM:[p.x,0,streetZ],bornEventId:e.id});
  addRoute(w,uid(p,'entry'),uid(p,'street'),uid(p,'landing-0'),'door');
 }
 const b=w.buildings.find(b=>b.id===p.id);b.floorElevationsM.push(y);b.topM=y+h;
 const slab=component(w,p,uid(p,`slab-${f}`),'floor-domain',e,[uid(p,f?`slab-${f-1}`:'foundation')],{domain:aabb([p.x-p.width/2,y-.18,p.z-p.depth/2],[p.x+p.width/2,y,p.z+p.depth/2])});
 if(!f){const ef=component(w,p,uid(p,'entry-frame'),'door-frame',e,[slab]);const el=component(w,p,uid(p,'entry-leaf'),'door-leaf',e,[ef]);w.openings.push({id:uid(p,'street-door'),kind:'door',fromSpaceId:uid(p,'street'),toSpaceId:uid(p,'landing-0'),frameComponentId:ef,leafComponentId:el,clearM:[.90,2.10],swingDomainPending:true});}
 const sid=uid(p,`landing-${f}`),room=uid(p,`room-${f}`),air=uid(p,`air-${f}`),entrySign=Math.sign(faceZ-p.z);
 const landingPos=[p.x+p.coreSide*(p.width/2-1.3),y,p.z+entrySign*p.coreEnd*(p.depth/2-1.8)];
 const roomMinX=p.coreSide<0?p.x-p.width/2+2.5:p.x-p.width/2+.18,roomMaxX=p.coreSide<0?p.x+p.width/2-.18:p.x+p.width/2-2.5;
 const zoneUses=!f?(p.programme==='steamed-food-learning'?['production','learning-corner']:['primary-programme']):e.needKind==='learning'?['living','study','storage']:e.needKind==='care'?['shared-living','rest-near-care']:e.needKind==='livelihood'?['home-work','rest']:e.needKind==='family-growth'?['common','separate-sleep']:e.needKind==='light'?['outer-living','quiet-rest']:['shared-living','private-rest'];
 const zoneDepth=(p.depth-.36)/zoneUses.length,zoneBounds=i=>aabb([roomMinX,y,p.z-p.depth/2+.18+i*zoneDepth],[roomMaxX,y+h-.18,p.z-p.depth/2+.18+(i+1)*zoneDepth]);
 const centerOf=b=>b.min.map((v,i)=>(v+b.max[i])/2);const primaryPosition=centerOf(zoneBounds(0));primaryPosition[1]=y;
 w.spaces.push({id:sid,buildingId:p.id,use:'landing',positionM:landingPos,bornEventId:e.id},
  {id:room,buildingId:p.id,use:f?'dwelling':p.programme.includes('workshop')||p.programme==='steamed-food-learning'?'workshop':'shop',positionM:primaryPosition,bornEventId:e.id,programme:f?'living':p.programme,zoneUse:zoneUses[0],partitionCauseId:e.causeIds[0]??e.id,domain:zoneBounds(0)},
  {id:air,buildingId:null,use:'air',positionM:[p.x,y+1.6,faceZ+entrySign*.35],bornEventId:e.id,airConnected:true,domain:aabb([p.x-.7,y+.7,Math.min(faceZ,faceZ+entrySign*.7)],[p.x+.7,y+2.1,Math.max(faceZ,faceZ+entrySign*.7)])});
 const frame=component(w,p,uid(p,`frame-${f}`),'door-frame',e,[slab]);const leaf=component(w,p,uid(p,`leaf-${f}`),'door-leaf',e,[frame]);const win=component(w,p,uid(p,`window-${f}`),'window-frame',e,[slab]);
 w.openings.push({id:uid(p,`door-${f}`),kind:'door',fromSpaceId:sid,toSpaceId:room,frameComponentId:frame,leafComponentId:leaf,clearM:[.85,2.05],hingeSide:'left',swingDomainPending:true},
 {id:uid(p,`window-opening-${f}`),kind:'window',fromSpaceId:entrySign>0&&zoneUses.length>1?uid(p,`room-${f}-zone-${zoneUses.length-1}`):room,toSpaceId:air,frameComponentId:win});
 addRoute(w,uid(p,`room-route-${f}`),sid,room,'door');
 for(let i=1;i<zoneUses.length;i++){
  const id=uid(p,`room-${f}-zone-${i}`),pos=centerOf(zoneBounds(i));pos[1]=y;
  w.spaces.push({id,buildingId:p.id,use:'dwelling',positionM:pos,bornEventId:e.id,zoneUse:zoneUses[i],partitionCauseId:e.causeIds[0]??e.id,domain:zoneBounds(i)});
  const adjacent=i===1?room:uid(p,`room-${f}-zone-${i-1}`);
  const zf=component(w,p,id+'-frame','door-frame',e,[slab]),zl=component(w,p,id+'-leaf','door-leaf',e,[zf]);
  w.openings.push({id:id+'-door',kind:'door',fromSpaceId:adjacent,toSpaceId:id,frameComponentId:zf,leafComponentId:zl,clearM:[.8,2.0],swingDomainPending:true});addRoute(w,id+'-route',adjacent,id,'door');
 }
 w.domains.push({id:uid(p,`storey-${f}`),buildingId:p.id,eventId:e.id,kind:'storey-envelope',bounds:aabb([p.x-p.width/2,y,p.z-p.depth/2],[p.x+p.width/2,y+h,p.z+p.depth/2]),motherState:slab+'-fabric',notSolidBox:true});
 if(f){
  const previous=uid(p,`landing-${f-1}`),dy=y-b.floorElevationsM[f-1],risers=Math.ceil(dy/.18),flights=[Math.ceil(risers/2),Math.floor(risers/2)],tread=.245;
  const route=uid(p,`stair-${f}`);addRoute(w,route,previous,sid,'stair',{riserCount:risers,riserM:dy/risers,flights,treadM:tread,landingDepthM:1.05,availableRunM:3.55,availableWidthM:2.4,stairWidthM:1.05,analyticFlightRule:'two opposing flights with intermediate landing; no step mesh generated'});b.ownStairRouteIds.push(route);
 }
 // Drain records are replaced as roofs rise. Piped supply is a separate graph, never a walk route.
 const drain={id:uid(p,'drain'),pointsM:[[p.x+p.width/2-.15,y+h,faceZ],[p.x+p.width/2-.15,y+h-.05,faceZ+.08*entrySign],[p.x+p.width/2-.15,0,faceZ+.08*entrySign]],outletId:uid(p,'sewer'),pumped:false};
 const ix=w.drainRoutes.findIndex(x=>x.id===drain.id);if(ix<0)w.drainRoutes.push(drain);else w.drainRoutes[ix]=drain;
 w.serviceDomains=w.serviceDomains.filter(d=>d.buildingId!==p.id);w.serviceDomains.push({id:uid(p,'external-pipe'),buildingId:p.id,kind:'pipe-envelope',bounds:aabb([p.x+p.width/2-.22,0,faceZ+.08*entrySign-.07],[p.x+p.width/2-.08,y+h+.05,faceZ+.08*entrySign+.07])});
 w.services=w.services.filter(x=>x.buildingId!==p.id);w.services.push({id:uid(p,'supply'),buildingId:p.id,kind:'water-supply',sourceId:'shared-water-main',tankY:y+h+1,pumpRequired:true,pumpDeclared:true,consumerSpaceIds:b.floorElevationsM.map((_,i)=>uid(p,`room-${i}`)),separateFromWastewater:true});
}
function addRoofs(w){
 for(const b of w.buildings){const p=PARCELS.find(p=>p.id===b.id),f=b.floorElevationsM.length-1,e=w.events.find(e=>e.id===uid(p,`event-${f}`)),dy=b.topM-b.floorElevationsM[f],risers=Math.ceil(dy/.18),id=uid(p,'roof-work'),last=w.spaces.find(s=>s.id===uid(p,`landing-${f}`));
  w.spaces.push({id,buildingId:b.id,use:'roof',positionM:[last.positionM[0],b.topM,last.positionM[2]],bornEventId:e.id});
  const r=uid(p,'roof-stair');addRoute(w,r,last.id,id,'stair',{riserCount:risers,riserM:dy/risers,flights:[Math.ceil(risers/2),Math.floor(risers/2)],treadM:.245,landingDepthM:1.05,availableRunM:3.55,availableWidthM:2.4,stairWidthM:1.05});b.ownStairRouteIds.push(r);
  component(w,p,uid(p,'roof-rail'),'rail',e,[uid(p,`slab-${f}`)],{edgeClass:'drop',omitsAccessOpenings:true,edgeDomain:'roof perimeter excluding own stair landing'});
 }
}
function connectStreets(w){
 const rows=[PARCELS.slice(0,6),PARCELS.slice(6,12),PARCELS.slice(12,18),PARCELS.slice(18)];
 for(const row of rows){const ps=row.filter(p=>w.buildings.some(b=>b.id===p.id));for(let i=1;i<ps.length;i++)addRoute(w,`street-${ps[i-1].id}-${ps[i].id}`,uid(ps[i-1],'street'),uid(ps[i],'street'),'walk');}
 // Around the west site edge, never across the railway at grade.
 const p=PARCELS[0];if(!w.buildings.some(b=>b.id===p.id))return;
 const e=uid(p,'event-0');for(const [id,pos]of [['west-south',[-34,0,-22]],['west-north',[-34,0,22]]])w.spaces.push({id,buildingId:null,use:'street',positionM:pos,bornEventId:e});
 addRoute(w,'outside-west','west-south','west-north','walk',{pathM:[[-34,0,-22],[-34,0,22]]});
 for(const row of rows){const q=row.find(p=>w.buildings.some(b=>b.id===p.id));if(!q)continue;const t=q.z<0?'west-south':'west-north',s=w.spaces.find(x=>x.id===uid(q,'street'));addRoute(w,`outside-${q.id}`,t,s.id,'walk',{pathM:[w.spaces.find(x=>x.id===t).positionM,[-34,0,s.positionM[2]],s.positionM]});}
}
function connectBorrowing(w,atYear){
 if(atYear<24)return;
 for(const [ia,ib]of [[0,1],[7,8],[14,15],[20,21],[3,9]]){
  const a=PARCELS[ia],b=PARCELS[ib],A=w.buildings.find(x=>x.id===a.id),B=w.buildings.find(x=>x.id===b.id),crossRail=a.z*b.z<0,f=crossRail?3:2;if(!A||!B||Math.min(A.floorElevationsM.length,B.floorElevationsM.length)<=f)continue;
  const from=uid(a,`landing-${f}`),to=uid(b,`landing-${f}`),dy=Math.abs(A.floorElevationsM[f]-B.floorElevationsM[f]),id=`borrow-${a.id}-${b.id}`,gate=id+'-gate';
  const cause=id+'-life',e={id:id+'-event',tick:24,buildingId:a.id,ownerId:a.ownerId,kind:'borrow-access',reason:crossRail?'Neighbours agree to a raised route across the reserved railway':'Neighbours agree to carry water and share upper access',causeIds:[cause],dependsOn:[uid(a,`event-${f}`),uid(b,`event-${f}`)],provenance:{kind:'authored'}};
  w.events.push(e);w.causes.push({id:cause,kind:'neighbour-agreement',reason:e.reason,ownerIds:[a.ownerId,b.ownerId],provenance:{kind:'authored'}});
  const pa=crossRail?[a.x,A.floorElevationsM[f],a.z+a.depth/2]:[a.x+a.width/2,A.floorElevationsM[f],a.z],pb=crossRail?[b.x,B.floorElevationsM[f],b.z-b.depth/2]:[b.x-b.width/2,B.floorElevationsM[f],b.z];
  const aEnd=id+'-A',bEnd=id+'-B';w.spaces.push({id:aEnd,buildingId:a.id,use:'landing',positionM:pa,bornEventId:e.id},{id:bEnd,buildingId:b.id,use:'landing',positionM:pb,bornEventId:e.id});
  const deck=component(w,a,id+'-deck','bridge-domain',e,[uid(a,`slab-${f}`),uid(b,`slab-${f}`)],{supportEngineeringVerified:false});
  const bounds=aabb(pa.map((v,k)=>Math.min(v,pb[k])-(k===1?.2:.53)),pa.map((v,k)=>Math.max(v,pb[k])+(k===1?.02:.53)));
  w.domains.push({id:id+'-deck-domain',kind:'bridge-envelope',bounds,eventId:e.id,motherState:deck+'-fabric'});
  component(w,a,id+'-edge-rails','rail',e,[deck],{edgeClass:'drop',omitsAccessOpenings:true});
  for(const [p,landing,end]of [[a,from,aEnd],[b,to,bEnd]]){const frame=component(w,p,end+'-frame','door-frame',e,[deck]),leaf=component(w,p,end+'-leaf','door-leaf',e,[frame]);w.openings.push({id:end+'-opening',kind:'door',fromSpaceId:landing,toSpaceId:end,frameComponentId:frame,leafComponentId:leaf,clearM:[.9,2.05],swingDomainPending:true});addRoute(w,end+'-entry',landing,end,'door');}
  w.gates.push({id:gate,state:'locked',allowedRoles:['resident','water-carrier'],allowedActorIds:[],openHours:[6,22],agreement:'Both owners permit daytime use; locked gate still permits named residents'});
  addRoute(w,id,aEnd,bEnd,'borrow',{gateId:gate,consentOwnerIds:[a.ownerId,b.ownerId],heightResolution:dy<.005?'level':'steps',...(dy<.005?{}:{riserCount:Math.ceil(dy/.16),riserM:dy/Math.ceil(dy/.16)}),pathM:[pa,pb],crossesRail:crossRail,deckUndersideMinM:Math.min(pa[1],pb[1])-.2,status:'negotiated route topology and coarse deck reservation only; structural span and door/bridge solid clearance pending'});
  if(!crossRail)w.laundry.push({id:id+'-laundry',kind:'laundry-line',fromBuilding:a.id,toBuilding:b.id,heightM:Math.max(A.floorElevationsM[f],B.floorElevationsM[f])+2.0,navigable:false,relationship:'neighbours agree to shared drying space'});
 }
 w.events.sort((a,b)=>a.tick-b.tick||(a.kind==='borrow-access'?1:0)-(b.kind==='borrow-access'?1:0)||a.id.localeCompare(b.id));
}
export function buildSettlement(atYear=50){
 const w={version:VERSION,id:'whole-settlement-authored-r01',coordinateUnits:'metres',dimensionsSource:'design parameters, not illustration measurements',year:atYear,buildings:[],spaces:[],routes:[],gates:[],openings:[],components:[],fabricStates:[],drainRoutes:[],events:[],causes:[],domains:[],services:[],serviceDomains:[],laundry:[],rail:structuredClone(RAIL)};
 for(const e of history().filter(x=>x.tick<=atYear)){
  const p=PARCELS.find(x=>x.id===e.buildingId);w.events.push(e);if(e.floor)w.causes.push({id:e.causeIds[0],kind:e.needKind,householdId:uid(p,'household'),reason:e.reason,provenance:{kind:'authored'}});addFloor(w,p,e);
 }
 addRoofs(w);connectStreets(w);connectBorrowing(w,atYear);
 if(atYear>=36){const b=w.buildings.find(x=>x.id==='B09');if(b)w.constructionActivity={id:'roof-four-authored',buildingId:b.id,spaceAnchor:[...b.originM.slice(0,1),b.topM,b.originM[2]],workerRoles:['pass-bricks','lay-blocks','move-materials','assist-opening'],count:4,state:'active roof-room addition proposal; no occupied completed room fabricated'};}
 return w;
}
export function auditSettlement(w){
 const base=validatePlan(w),errors=[...base.errors],warnings=[...base.warnings];
 const entries=new Set(w.buildings.map(x=>x.entrySpaceId)),spaces=new Map(w.spaces.map(x=>[x.id,x]));
 for(const b of w.buildings){
  const own=structuredClone(w);own.routes=own.routes.filter(r=>r.kind!=='borrow');const got=new Set(reachable(own,b.entrySpaceId,{id:'resident',roles:['resident']}));
  for(let f=0;f<b.floorElevationsM.length;f++)if(!got.has(`${b.id}-room-${f}`))errors.push(`own stair cannot reach ${b.id} floor ${f}`);
  for(const s of w.spaces.filter(x=>x.buildingId===b.id))if(!got.has(s.id))errors.push(`own circulation cannot reach ${s.id}`);
 }
 for(const r of w.routes){
  if(r.kind==='door'&&!w.openings.some(o=>o.kind==='door'&&((o.fromSpaceId===r.from&&o.toSpaceId===r.to)||(o.fromSpaceId===r.to&&o.toSpaceId===r.from))))errors.push(`door route lacks physical opening: ${r.id}`);
  if(r.kind==='stair'&&((Math.max(...r.flights)-1)*r.treadM+r.landingDepthM>r.availableRunM||r.stairWidthM*2+.15>r.availableWidthM))errors.push(`stair cannot fit declared core: ${r.id}`);
  const points=r.pathM??[spaces.get(r.from).positionM,spaces.get(r.to).positionM];
  for(let i=1;i<points.length;i++)if(segmentEntersRail(points[i-1],points[i],r.widthM/2,w.rail.reserve))errors.push(`route enters reserved railway: ${r.id}`);
 }
 for(const d of [...w.domains,...(w.serviceDomains??[])])if(overlaps(d.bounds,w.rail.reserve))errors.push(`domain enters reserved railway: ${d.id}`);
 for(const s of w.spaces.filter(x=>x.use==='air'))for(const d of w.domains)if(overlaps(s.domain,d.bounds))errors.push(`window air obstructed by ${d.id}: ${s.id}`);
 for(const l of w.laundry)if(w.routes.some(r=>r.id===l.id)||l.navigable)errors.push(`laundry is navigation: ${l.id}`);
 const relocated=w.spaces.find(x=>x.programme==='steamed-food-learning');if(w.year>=1&&!relocated)errors.push('relocated production-and-learning space absent');
 return {valid:!errors.length,errors,warnings,scope:'semantic + coarse numeric route/core/reservation checks; no solid collision, structural, vehicle-dynamic or GPU pass',counts:{buildings:w.buildings.length,floors:w.buildings.reduce((a,b)=>a+b.floorElevationsM.length,0),primaryProgrammeSpaces:w.spaces.filter(s=>s.programme).length,internalAuxiliaryZones:w.spaces.filter(s=>s.zoneUse&&!s.programme).length,lifeEvents:w.causes.length,openings:w.openings.length,borrowRoutes:w.routes.filter(x=>x.kind==='borrow').length,laundryRelations:w.laundry.length},relocatedProgramme:relocated?.id};
}
/** Segment/AABB slab interval. X rail ends are finite; walking around -34m is intentional. */
export function segmentEntersRail(a,b,pad,box){let lo=0,hi=1;for(let k=0;k<3;k++){const mn=box.min[k]-(k===1?2.0:pad),mx=box.max[k]+(k===1?.20:pad),v=b[k]-a[k];if(Math.abs(v)<1e-9){if(a[k]<=mn||a[k]>=mx)return false;}else{let u=(mn-a[k])/v,t=(mx-a[k])/v;if(u>t)[u,t]=[t,u];lo=Math.max(lo,u);hi=Math.min(hi,t);if(lo>=hi)return false;}}return hi>0&&lo<1;}
export function proposeAtomic(current,proposal){
 const copy=structuredClone(current);try{
  if(!proposal.ownerConsent||!proposal.lifeCause)throw Error('owner consent and a life cause required');
  if(proposal.cost>proposal.availableResources)throw Error('insufficient resources');
  if(proposal.reservedSkyConflict)throw Error('protected light/service void would be occupied');
  if(!proposal.supportComponentIds?.length||!proposal.supportComponentIds?.every(id=>copy.components.some(c=>c.id===id)))throw Error('support path absent');
  const required=proposal.kind==='repair'?['fabric','history']:['domain','access','service','fabric','history'];
  if(required.some(x=>!proposal.effects?.includes(x))||proposal.effects.length!==required.length)throw Error('growth effects must update domain/access/service/fabric/history together; repairs require fabric/history');
  const tables={domain:'domains',access:'routes',service:'services',fabric:'fabricStates',history:'events'};
  const before=Object.fromEntries(required.map(k=>[k,JSON.stringify(copy[tables[k]])]));
  proposal.mutate(copy);
  for(const k of required)if(before[k]===JSON.stringify(copy[tables[k]]))throw Error(`declared effect not applied: ${k}`);
  const a=auditSettlement(copy);return a.valid?{accepted:true,state:copy,audit:a}:{accepted:false,state:current,errors:a.errors};
 }catch(e){return {accepted:false,state:current,errors:[e.message]};}
}
export function sectionWorld(w,normal,offsetM){return {contract:sectionContract(w.id,normal,offsetM),world:w,stableDomainIds:w.domains.map(x=>x.id)};}
/** Local trace recipe, not a new material kernel. Mapping weights below remain authored. */
export function fabricInputs(w,componentId,hostSeconds){
 const c=w.components.find(x=>x.id===componentId),f=w.fabricStates.find(x=>x.id===c?.fabricStateId);if(!f)throw Error('unknown component');
 const hour=((hostSeconds/3600)%24+24)%24;
 return {stateId:f.id,motherSourceId:c.motherSourceId,birthYear:f.constructionYear,structuralAgeYears:Math.max(0,w.year-f.constructionYear),maintenance:structuredClone(f.maintenance),rainSourceIds:[...f.exposureLinks],useRelationIds:[...f.useLinks],cleaningActive:hour>=6&&hour<7,coatingAgeResetIsLocal:true,geometryAndPBRMustUseThisSameState:true};
}

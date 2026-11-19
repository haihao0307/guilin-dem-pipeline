/** One plan-local lift adapter. Analytic boxes only; the published R02 controller is unchanged.
 * All dimensions are authored fit studies, NOT surveyed equipment or safety certification.
 */
import {createLift, guards, validateFloors, validateInstance} from '../elevator-mother-r02/model.mjs';
export {step, guards} from '../elevator-mother-r02/model.mjs';
export {command} from '../elevator-mother-r02/controls.mjs';
const copy=x=>structuredClone(x),EPS=1e-8;
const close=(a,b)=>Math.abs(a-b)<EPS;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const vec=(a,b)=>a.map((v,k)=>v-b[k]);
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const boxBounds=f=>({min:f.center.map((v,k)=>v-f.half[k]),max:f.center.map((v,k)=>v+f.half[k])});
export const LIFT_HOST_SCHEMA='kaopu.kcc-evidence-lift-binding/0.1';
export const LIFT_HOST_MAX_FIELDS=96;
/** Read existing owners and aperture dimensions; never resize, translate or mutate the host. */
export function deriveLiftBinding(study){
 const root='KCC:evidence-plan-r01',shaftId=root+':lift:0',m=study?.evidenceModel,rel=m?.upperFloorRelation;
 assert(study?.evidenceEnabled&&rel&&study.stairConnection,'Existing evidence floors and physical stair required');
 const expected=['evidence-plan','evidence-upper-reference'];
 assert(rel.currentFloorId===expected[0]&&rel.upperFloorId===expected[1],'Only the two existing evidence floor nodes may be served');
 const levels=expected.map(id=>m.levels.find(f=>f.id===id));
 assert(levels.every(Boolean),'Existing served floor owners required');
 const floors=validateFloors(levels.map((f,i)=>({id:f.id,label:i?'上层设计参考':'下层资料平面',elevation:f.elevation,served:true})));
 assert(close(floors[0].elevation,0)&&close(floors[1].elevation,rel.height),'Host floor relation and design elevations disagree');
 const opening=rel.openings.find(o=>o.purpose==='lift'&&o.relatedCoreId===shaftId),a=study.apertures.find(a=>a.host?.nodeId===shaftId),c=a?.config;
 assert(opening&&c&&c.kind==='door'&&!c.leafEnabled,'Exact existing fixed shaft aperture required');
 assert(JSON.stringify(c.host.u)==='[1,0,0]'&&JSON.stringify(c.host.v)==='[0,1,0]'&&JSON.stringify(c.host.w)==='[0,0,1]','Binding accepts only the existing +Z axis-aligned host');
 assert(c.roundRadius===0&&c.thresholdHeight===0,'Unsupported rounded or raised host threshold');
 const min=[Math.min(...opening.polygon.map(p=>p[0])),Math.min(...opening.polygon.map(p=>p[1]))],max=[Math.max(...opening.polygon.map(p=>p[0])),Math.max(...opening.polygon.map(p=>p[1]))];
 assert(opening.polygon.length===4&&opening.polygon.every(p=>(close(p[0],min[0])||close(p[0],max[0]))&&(close(p[1],min[1])||close(p[1],max[1]))),'Rectangular existing shaft required');
 const cx=c.host.origin[0],portalZ=c.host.origin[2],clearWidth=c.width-2*c.frameWidth,clearHeight=c.height-c.frameWidth-c.thresholdHeight;
 assert(close(cx,(min[0]+max[0])/2)&&close(portalZ-c.wallThickness/2,max[1]),'Host front and selected shaft must remain coincident');
 const design=validateInstance({width:2.2,depth:1.5,speed:1.5}),carFront=max[1]-.14,carBack=carFront-design.depth;
 const car={width:design.width,depth:design.depth,center:[cx,0,(carBack+carFront)/2],origin:[cx,0,(carBack+carFront)/2],back:carBack,front:carFront,minX:cx-design.width/2,maxX:cx+design.width/2,wallThickness:.035,floorThickness:.06,clearHeight:2.15,ceilingThickness:.05,doorPlane:carFront-.025};
 const portal={center:[cx,0,portalZ],frame:copy(c.host),roughWidth:c.width,roughHeight:c.height,clearWidth,clearHeight,frameWidth:c.frameWidth,frameDepth:c.frameDepth,wallThickness:c.wallThickness,existingApertureId:a.instanceId,landingDoorPlane:max[1]-.0325};
 const door={edgeGap:.006,meetingGap:.004,bottomGap:.008,topGap:.008,thickness:.025,travel:clearWidth/2+.006};
 door.leafWidth=(clearWidth-2*door.edgeGap-door.meetingGap)/2;
 door.closedCenter=(door.leafWidth+door.meetingGap)/2;
 door.height=clearHeight-door.bottomGap-door.topGap;
 const sill={gap:.012,thickness:.028,back:carFront+.012,front:portalZ+c.wallThickness/2+.02,width:clearWidth-.004,topOffset:0,evidence:'editable_authored_mechanical_gap_not_measured'};
 assert(clearWidth>.4&&clearHeight>1.85&&door.leafWidth>0,'Host portal does not fit the design walking envelope');
 const shaft={id:shaftId,openingId:opening.id,polygon:copy(opening.polygon),min,max,width:max[0]-min[0],depth:max[1]-min[1],wallThickness:c.wallThickness};
 const lobby=study.graph.nodes.find(n=>n.id===root+':lobby'),upperLobby=study.graph.nodes.find(n=>n.id===root+':upper-lobby');
 assert(lobby?.position&&upperLobby?.position,'Existing lower/upper lobby receiving nodes required');
 const landingId=id=>shaftId+':landing:'+id,carId=shaftId+':car';
 const floorBindings=floors.map((f,i)=>({ ...f,owner:levels[i].nodeId,landingId:landingId(f.id),lobbyId:i?upperLobby.id:lobby.id,landingPoint:[cx,f.elevation,portalZ+c.wallThickness/2+.32],lobbyPoint:copy(i?upperLobby.position:lobby.position),carPoint:[cx,f.elevation,car.center[2]] }));
 const toCar=f=>[copy(f.lobbyPoint),[cx,f.elevation,f.lobbyPoint[2]],copy(f.landingPoint),[cx,f.elevation,sill.front],[cx,f.elevation,sill.back],[cx,f.elevation,carFront],copy(f.carPoint)];
 const stairUpper=copy(study.stairConnection.path.at(-1)),upLobby=copy(upperLobby.position);
 const upperToStair=[upLobby,[stairUpper[0],upLobby[1],upLobby[2]],stairUpper].filter((p,i,a)=>i===0||Math.hypot(...vec(p,a[i-1]))>EPS);
 const routes={lowerLobbyToCar:toCar(floorBindings[0]),carToUpperLobby:toCar(floorBindings[1]).reverse(),upperLobbyToStair:upperToStair,stairBackToLower:copy(study.stairConnection.path).reverse(),sourceStairId:study.stairConnection.id,bodyRadius:.2,bodyHeight:1.85,sillGapM:sill.gap};
 const binding={schema:LIFT_HOST_SCHEMA,id:shaftId+':r02-binding',shaftId,carId,floors:floorBindings,servedFloorIds:copy(expected),design,shaft,portal,car,door,sill,routes,upperWallHeight:Math.max(car.clearHeight+car.ceilingThickness+.15,c.height+.35),guide:{offsetX:design.width/2+.04,half:.012,z:carBack+.12},renderBounds:{min:[min[0]-.14,-.07,min[1]-.14],max:[max[0]+.14,floors[1].elevation+2.55,portalZ+.15]},disclosure:{coordinates:'existing_independent_evidence_plan_local_metres',ffl:'FFL_design local 0 and upperFloorRelation.height; not surveyed FFL or mPD',actualFloorLabelsKnown:false,actualEquipmentKnown:false,machineryGenerated:false,pitOrOverrunVerified:false,certified:false,otherShaftsUnchanged:true,hostPortalUnchanged:true}};
 binding.fit=validateLiftFit(binding);
 return binding;
}
export function createBoundLift(binding){assert(binding?.schema===LIFT_HOST_SCHEMA,'Lift binding required');return createLift(binding.floors.map(({id,label,elevation})=>({id,label,elevation,served:true})),binding.design);}
function assertState(b,s){assert(s&&s.floors.length===2&&s.floors.every((f,i)=>f.id===b.servedFloorIds[i]&&close(f.elevation,b.floors[i].elevation)),'State must belong to the same two-floor binding');assert(close(s.design.width,b.design.width)&&close(s.design.depth,b.design.depth),'Controller instance dimensions must retain the validated outer car fit');assert(Number.isFinite(s.y)&&Number.isFinite(s.carDoor)&&s.carDoor>=0&&s.carDoor<=1,'Invalid bound lift state');}
/** Doors and y are read only. Call the original R02 command/step to change them. */
export function liftFields(b,s){
 assertState(b,s);const out=[],cx=b.car.center[0],carOwner=b.carId;
 const add=(key,center,half,kind,owner,tone=2,extra={})=>{assert(center.every(Number.isFinite)&&half.every(v=>Number.isFinite(v)&&v>0),'Invalid lift box '+key);out.push({id:b.shaftId+':'+key,objectId:3500+out.length,center,half,role:kind==='shaft-extension'?12:13,tone,owner,kind,...extra});};
 const slab=(key,x0,x1,y0,y1,z0,z1,kind,owner,tone=2,extra={})=>add(key,[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],[(x1-x0)/2,(y1-y0)/2,(z1-z0)/2],kind,owner,tone,extra);
 const lo=b.floors[0].elevation,hi=b.floors.at(-1).elevation+b.car.clearHeight+b.car.ceilingThickness+.10;
 for(const side of[-1,1])add('guide:'+side,[cx+side*b.guide.offsetX,(lo-.07+hi)/2,b.guide.z],[b.guide.half,(hi-lo+.07)/2,b.guide.half],'guide',b.shaftId,0);
 // Only the selected upper shaft's local enclosure is extended, never another floor plan.
 const f=b.floors[1],y=f.elevation,wall=b.shaft.wallThickness,upperTop=y+b.upperWallHeight,x0=b.shaft.min[0],x1=b.shaft.max[0],z0=b.shaft.min[1],z1=b.shaft.max[1],ph=b.portal.roughWidth/2;
 slab('upper:back',x0-wall,x1+wall,y,upperTop,z0-wall,z0,'shaft-extension',b.shaftId,3);
 slab('upper:left',x0-wall,x0,y,upperTop,z0,z1+wall,'shaft-extension',b.shaftId,3);
 slab('upper:right',x1,x1+wall,y,upperTop,z0,z1+wall,'shaft-extension',b.shaftId,3);
 slab('upper:front-left',x0,cx-ph,y,upperTop,z1,z1+wall,'shaft-extension',f.owner,3);
 slab('upper:front-right',cx+ph,x1,y,upperTop,z1,z1+wall,'shaft-extension',f.owner,3);
 slab('upper:header',cx-ph,cx+ph,y+b.portal.roughHeight,upperTop,z1,z1+wall,'shaft-extension',f.owner,3);
 const fw=b.portal.frameWidth,pz=b.portal.center[2],fd=b.portal.frameDepth/2;
 slab('upper:frame-left',cx-ph,cx-ph+fw,y,y+b.portal.roughHeight,pz-fd,pz+fd,'landing-frame',f.owner,0);
 slab('upper:frame-right',cx+ph-fw,cx+ph,y,y+b.portal.roughHeight,pz-fd,pz+fd,'landing-frame',f.owner,0);
 slab('upper:frame-header',cx-ph+fw,cx+ph-fw,y+b.portal.clearHeight,y+b.portal.roughHeight,pz-fd,pz+fd,'landing-frame',f.owner,0);
 for(const floor of b.floors){const y=floor.elevation,o=s.landingDoors[floor.id];assert(Number.isFinite(o)&&o>=0&&o<=1,'Invalid landing door state');
  slab(floor.id+':sill',cx-b.sill.width/2,cx+b.sill.width/2,y-b.sill.thickness,y,b.sill.back,b.sill.front,'landing-sill',floor.owner,0,{floorId:floor.id});
  for(const side of[-1,1])add(floor.id+':landing-door:'+side,[cx+side*(b.door.closedCenter+o*b.door.travel),y+b.door.bottomGap+b.door.height/2,b.portal.landingDoorPlane],[b.door.leafWidth/2,b.door.height/2,b.door.thickness/2],'landing-door',floor.owner,1,{floorId:floor.id});
  const px=cx+ph+.14,panelZ=pz+wall/2+.014;
  add(floor.id+':hall-panel',[px,y+1.22,panelZ],[.07,.18,.014],'hall-panel',floor.owner,0,{floorId:floor.id});
  const direction=floor.id===b.floors[0].id?1:-1,active=s.queue.some(q=>q.id===floor.id&&q.source==='hall')||(s.target===floor.id&&!!s.motion);
  add(floor.id+':hall-button',[px,y+1.19,panelZ+.019],[.035,.035,.006],'button',floor.owner,active?7:6,{floorId:floor.id,action:{kind:'hall',floor:floor.id,direction},label:direction>0?'↑':'↓',active});
  add(floor.id+':hall-display',[px,y+1.32,panelZ+.018],[.052,.025,.005],'display',floor.owner,6,{floorId:floor.id,label:s.current===floor.id?'●':'·'});
 }
 const cy=s.y,c=b.car,t=c.wallThickness;
 slab('car:floor',c.minX,c.maxX,cy-c.floorThickness,cy,c.back,c.front,'car-floor',carOwner,2);
 slab('car:back',c.minX,c.maxX,cy,cy+c.clearHeight,c.back,c.back+t,'car-wall',carOwner,2);
 slab('car:left',c.minX,c.minX+t,cy,cy+c.clearHeight,c.back+t,c.front,'car-wall',carOwner,2);
 slab('car:right',c.maxX-t,c.maxX,cy,cy+c.clearHeight,c.back+t,c.front,'car-wall',carOwner,2);
 slab('car:ceiling',c.minX,c.maxX,cy+c.clearHeight,cy+c.clearHeight+c.ceilingThickness,c.back,c.front,'car-ceiling',carOwner,2);
 const ih=b.portal.clearWidth/2;
 slab('car:front-left',c.minX+t,cx-ih,cy,cy+c.clearHeight,c.front-.100,c.front-.050,'car-wall',carOwner,2);
 slab('car:front-right',cx+ih,c.maxX-t,cy,cy+c.clearHeight,c.front-.100,c.front-.050,'car-wall',carOwner,2);
 slab('car:header',cx-ih,cx+ih,cy+b.portal.clearHeight,cy+c.clearHeight,c.front-.100,c.front-.050,'car-wall',carOwner,2);
 for(const side of[-1,1])add('car:door:'+side,[cx+side*(b.door.closedCenter+s.carDoor*b.door.travel),cy+b.door.bottomGap+b.door.height/2,c.doorPlane],[b.door.leafWidth/2,b.door.height/2,b.door.thickness/2],'car-door',carOwner,2);
 add('car:light',[cx,cy+c.clearHeight-.008,c.center[2]],[.34,.008,.18],'car-light',carOwner,4);
 const panelX=cx+.70,panelZ=c.back+t+.014;
 add('car:panel',[panelX,cy+1.16,panelZ],[.14,.45,.014],'car-panel',carOwner,0);
 add('car:display',[panelX,cy+1.49,panelZ+.02],[.10,.04,.006],'display',carOwner,6,{label:s.v>0?'↑':s.v<0?'↓':s.current===b.floors[0].id?'0':'3'});
 for(const [i,floor]of b.floors.entries()){const active=s.target===floor.id||s.queue.some(q=>q.id===floor.id);add('car:select:'+floor.id,[panelX,cy+1.30-i*.14,panelZ+.022],[.045,.045,.008],'button',carOwner,active?7:6,{label:i?'上':'下',action:{kind:'car',floor:floor.id},active});}
 for(const [side,value]of[[-1,'open'],[1,'close']])add('car:command:'+value,[panelX+side*.065,cy+.91,panelZ+.022],[.04,.035,.008],'button',carOwner,6,{label:value==='open'?'◀▶':'▶◀',action:{kind:'door',value}});
 assert(out.length<=LIFT_HOST_MAX_FIELDS,'Bound lift field capacity exceeded');return out;
}
export function canBoard(b,s,floorId){assertState(b,s);const floor=b.floors.find(f=>f.id===floorId);return !!floor&&s.current===floorId&&s.v===0&&!s.motion&&s.state!=='FAULT'&&Math.abs(s.y-floor.elevation)<=.01&&guards(s).leveled&&s.carDoor===1&&s.landingDoors[floorId]===1;}
export function liftRouteEdges(b,s){assertState(b,s);const edges=[];for(const [i,f]of b.floors.entries()){
 const whole=i?copy(b.routes.carToUpperLobby).reverse():copy(b.routes.lowerLobbyToCar),split=whole.findIndex(p=>Math.hypot(...vec(p,f.landingPoint))<EPS),enabled=canBoard(b,s,f.id);
 edges.push({type:'walksTo',from:f.lobbyId,to:f.landingId,floorId:f.id,enabled:true,geometryBacked:true,points:whole.slice(0,split+1),direction:'both',dynamic:false});
 edges.push({type:'boardsLift',from:f.landingId,to:b.carId,floorId:f.id,enabled,geometryBacked:enabled,points:whole.slice(split),direction:'both',dynamic:true,gate:'same_floor_stationary_leveled_both_doors_fully_open',sillGapM:b.sill.gap});
 }return edges;}
/** Pure fit certificate: analytic extrema cover the full continuous door sweep. */
export function validateLiftFit(b){
 const c=b.car,p=b.portal,d=b.door,sh=b.shaft;
 const lateral=(sh.width-c.width)/2,rear=c.back-sh.min[1],front=sh.max[1]-c.front,guideWall=(sh.width/2-b.guide.offsetX-b.guide.half),guideCar=b.guide.offsetX-b.guide.half-c.width/2,doorExtent=d.closedCenter+d.travel+d.leafWidth/2;
 assert(lateral>0&&rear>0&&front>0,'2.2 × 1.5 m car outer envelope does not fit selected shaft');
 assert(guideWall>0&&guideCar>0,'Guide rails collide with selected shaft or outer car');
 assert(doorExtent<c.width/2-c.wallThickness,'Continuous door sweep crosses car side wall');
 assert(b.portal.landingDoorPlane+d.thickness/2<sh.max[1]&&b.portal.landingDoorPlane-d.thickness/2>b.sill.back,'Landing leaf must remain inside the shaft and over the sill');
 assert(c.doorPlane+d.thickness/2<c.front&&c.doorPlane-d.thickness/2>c.front-.05,'Car leaf must occupy its separate front pocket');
 assert(d.bottomGap>0&&d.bottomGap+d.height<p.clearHeight&&d.closedCenter+d.leafWidth/2<p.clearWidth/2,'Closed leaves exceed the unchanged clear portal');
 assert(b.sill.gap>0&&b.sill.gap<=.012+EPS&&close(b.sill.back-c.front,b.sill.gap),'Explicit sill design gap mismatch');
 const s=createLift(b.floors.map(({id,label,elevation})=>({id,label,elevation,served:true})),b.design),fields=liftFields(b,s);
 for(const f of fields.filter(f=>['car-wall','car-floor','car-ceiling','car-door','guide'].includes(f.kind))){const q=boxBounds(f);assert(q.min[0]>=sh.min[0]-EPS&&q.max[0]<=sh.max[0]+EPS&&q.min[2]>=sh.min[1]-EPS&&q.max[2]<=sh.max[1]+EPS,'Inner shaft fit failed: '+f.id);}
 return{passed:true,carOuter:[c.width,c.depth],shaftClear:[sh.width,sh.depth],portalRough:[p.roughWidth,p.roughHeight],portalClear:[p.clearWidth,p.clearHeight],lateralClearanceM:lateral,rearClearanceM:rear,frontClearanceM:front,guideToWallM:guideWall,guideToCarM:guideCar,maximumDoorHalfSweepM:doorExtent,doorPocketSideClearanceM:c.width/2-c.wallThickness-doorExtent,carLandingDoorPlaneSeparationM:p.landingDoorPlane-c.doorPlane,sillGapM:b.sill.gap,maximumFieldCount:fields.length,continuousDoorSweep:'linear centres; endpoint extrema bound all open fractions',pitAndOverrunVerified:false,structuralOrFireSafetyCertification:false};
}
export function liftPointInside(fields,point,{ignoreKinds=[]}={}){return fields.some(f=>!ignoreKinds.includes(f.kind)&&point.every((v,k)=>Math.abs(v-f.center[k])<f.half[k]-1e-8));}
export function sampleLiftRoute(points,spacing=.025){const out=[];for(let k=1;k<points.length;k++){const n=Math.max(1,Math.ceil(Math.hypot(...vec(points[k],points[k-1]))/spacing));for(let i=0;i<n;i++)out.push(mix(points[k-1],points[k],i/n));}if(points.length)out.push(copy(points.at(-1)));return out;}

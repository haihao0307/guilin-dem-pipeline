/** Independent life/circulation candidate. Authored changes, never a measured reconstruction. */
import {compileSpatialCandidate,localToWorld} from '../spatial-candidate/compile.mjs';
export const VERSION='whole-life-pair-B08-B09-r01';
export function compileWholeLife(){
 const r=compileSpatialCandidate(),a=r.buildings.find(b=>b.id==='B08'),b=r.observedBuilding,p0=r.packed;
 const floor=2,af=p0[(r.layout.floorOffset+(a.floorStart+floor)*2)*4],bf=r.segment.floors[floor].baseM;
 const az=.72,z=localToWorld(a,[a.width,af,az])[2],bz=z-(b.z-b.depth/2);
 const first=r.rooms.find(q=>q.floorIndex===floor),oldArea=first.areaM2;
 first.bounds.min[0]=1.33;first.areaM2=(first.bounds.max[0]-first.bounds.min[0])*(first.bounds.max[2]-first.bounds.min[2]);first.publicAreaSurrenderedM2=oldArea-first.areaM2;
 for(const port of [first.door,first.window])port.along=(first.bounds.min[0]+first.bounds.max[0])/2;
 const sidePort={id:'S05-R:F02:borrow-side-door',floorIndex:floor,stateId:b.floorStart+floor+1,fromSpaceId:'borrow-B08-B09:deck',toSpaceId:'S05-R:F02:borrow-side-passage',axis:0,plane:0,along:bz,bottom:0,clearWidthM:1.05,clearHeightM:2.1,type:'door',angle:-Math.PI/2,apertureWidthM:1.16,frameM:.055,roomIndex:-1,normalWorld:[-1,0,0],geometryStatus:'pending-entity-query'};
 const oldPorts=r.ports;r.ports=[];for(const f of r.segment.floors){f.portStart=r.ports.length;const ports=oldPorts.filter(q=>q.floorIndex===f.index);if(f.index===floor)ports.push(sidePort,{...sidePort,id:'S05-R:F02:side-to-rear-corridor',fromSpaceId:sidePort.toSpaceId,toSpaceId:f.corridor.id,axis:1,plane:3.43,along:.665,type:'open',angle:0,frameM:0,apertureWidthM:1.05,normalWorld:[0,0,1]});for(const q of ports){q.index=r.ports.length;q.partCode=40+(q.index-f.portStart)*2;r.ports.push(q);}f.portCount=ports.length;}
 r.layout.portCount=r.ports.length;r.layout.vec4Count=r.layout.portOffset+r.ports.length*3;
 const p=new Float32Array(r.layout.vec4Count*4);p.set(p0.subarray(0,r.layout.portOffset*4));r.packed=p;const set=(i,v)=>p.set(v,i*4);
 for(const f of r.segment.floors)set(r.layout.observedFloorOffset+f.index,[f.roomStart,f.roomCount,f.portStart,f.portCount]);
 set(r.layout.segmentOffset,[r.layout.roomOffset,r.rooms.length,r.layout.portOffset,r.ports.length]);
 // The single segment extension row is authoritative for the surrendered side strip.
 set(r.layout.segmentOffset+5,[floor,1.26,.14,bz]);
 for(const q of r.rooms){if(q.use==='wash-storage'){q.recipe=7;for(const ob of r.objects.filter(o=>o.roomId===q.id)){ob.recipe=7;ob.kind='shared-water-point';ob.state='tap closed; physical supply/waste end at floor interface; building network pending';}}const o=r.layout.roomOffset+q.index*3;set(o,[q.bounds.min[0],q.bounds.max[0],q.bounds.min[2],q.bounds.max[2]]);set(o+1,[q.floorIndex,p0[o*4+5],q.recipe,q.objectIdStart]);set(o+2,[q.door.index,q.window.index,q.localRoomIndex,0]);}
 for(const q of r.ports){const o=r.layout.portOffset+q.index*3;set(o,[q.axis,q.plane,q.along,q.bottom]);set(o+1,[q.apertureWidthM,q.clearHeightM,q.type==='window'?0:q.type==='door'?1:2,q.angle]);set(o+2,[q.floorIndex,q.partCode,q.roomIndex,q.frameM]);}
 const br=r.bridges.find(q=>q.id==='borrow-B08-B09');const pa=localToWorld(a,[a.width-a.wall/2,af,az]),pb=localToWorld(b,[0,bf,bz]);Object.assign(br,{pa,pb,low:pa,high:pb,length:pb[0]-pa[0],steps:1,enabled:true,status:'new-authored-connection-pending-entity-query',endpointCorrection:'B08 shared front passage → actual 0.118667m bridge step → B09 surrendered side passage → rear corridor; no private through-route'});
 const bo=r.layout.bridgeOffset+br.index*4;set(bo,[pa[0],pa[2],pb[0],pb[2]]);set(bo+1,[af,bf,br.width,br.depth]);set(bo+2,[br.aId,br.bId,br.stateId,0]);set(bo+3,[Math.PI/2,br.length,br.steps,0]);
 set(r.layout.buildingOffset+a.index*8+3,[br.index,floor,1,az]);a.bridge={index:br.index,floor,side:1,along:az};
 // Extra per-building row field denotes the front public corridor width; zero on all other buildings.
 p[(r.layout.buildingOffset+a.index*8+7)*4+3]=2;
 r.spaces.push({id:'B08:F02:public-front-passage',kind:'public-corridor',boundsLocalM:[[a.coreWidth,af,.18],[a.width-.18,af+2.1,1.35]],access:'authored negotiated public borrowing'},{id:sidePort.toSpaceId,kind:'public-corridor',boundsLocalM:[[.14,bf,.14],[1.19,bf+2.1,4.55]],access:'authored negotiated public borrowing'},{id:'borrow-B08-B09:deck',kind:'shared-bridge',access:'gate-controlled negotiated borrowing'});
 r.designRevisions.push({id:'life-borrow-agreement-B08-B09',kind:'authored-space-reallocation',floorIndex:floor,publicConnections:['B08 own stair','B08 front passage','bridge','B09 side passage','B09 rear corridor','B09 own stair'],B09FormerLearningAreaM2:oldArea,B09RetainedLearningAreaM2:first.areaM2,B09PublicStripAreaM2:first.publicAreaSurrenderedM2,B08PublicStripAreaM2:(a.width-.18-a.coreWidth)*(1.35-.18),historicalEvidence:'not a measured passage; authored negotiation responding to source circulation logic',residentsAllocated:0,capacityStatus:'unassigned, not population'});
 r.stairAuthority={schema:'floor row+1: stateId, floorSlot, totalRisers, firstFlightRisers',designUnitM:.000001,maxRiserM:.18,reason:'one integer decision before GPU; no f32/double ceil split'};
 for(const bb of r.buildings)for(let f=0;f<bb.floors;f++){const off=r.layout.floorOffset+(bb.floorStart+f)*2,h=p[off*4+1],nr=Math.ceil(Math.round(h*1000000)/180000),na=Math.ceil(nr/2);p[(off+1)*4+2]=nr;p[(off+1)*4+3]=na;}
 r.version=VERSION;r.worldId=VERSION;r.counts.activeBridges=5;r.counts.bridges=5;r.counts.pendingBridges=0;r.verification.newBorrow='generated-pending-entity-query';r.lifePair={floor,a:a.id,b:b.id,bridgeId:br.id,sidePortId:sidePort.id,heightDifferenceM:bf-af,requiredOpenGateId:br.gateId,unbound:['resident identities','occupancy schedules','bed/service allocation','water hydraulics','construction activity']};
 return r;
}

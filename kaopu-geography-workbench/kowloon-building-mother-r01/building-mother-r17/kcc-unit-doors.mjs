import {deriveAperture,updateAperture,queryApertures} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {queryAssemblyInside} from './kowloon-building-mother-r01/r07/assemblies.mjs';
const avg=p=>p[0].map((_,k)=>p.reduce((s,q)=>s+q[k],0)/p.length),len=v=>Math.hypot(...v),add=(a,b)=>a.map((v,k)=>v+b[k]);
/** Retained six-wing DESIGN partitions only. This does not claim the actual A-F plan has been installed. */
export function attachKccUnitDoors(input,{openT=0,reservedInstanceIds=[]}={}){
 const m=structuredClone(input);if(m.caseId!=='kcc')return m;
 const a=m.archetypes.find(a=>a.id==='tower-floor');if(!a)throw Error('Retained tower floor required');
 const rooms=[];for(const key of 'ABCDEF'){
  const pieces=a.primitives.filter(p=>p.nodeId.endsWith(`source-unit-${key}-partition`));
  const header=pieces.find(p=>p.bounds.min[1]>1.5);if(!header)throw Error('Physical existing door header required');
  const q=header.loops[0],center=avg(q),d=[q[1][0]-q[0][0],q[1][1]-q[0][1]],width=len(d),u=[d[0]/width,0,d[1]/width];let w=[-u[2],0,u[0]];
  if(center[0]*w[0]+center[1]*w[2]<0)w=w.map(v=>-v);
  // Orthonormal basis orientation need not impose guessed real-world handing.
  const inRoom=[center[0]+w[0]*1.25,0,center[1]+w[2]*1.25],approach=[center[0]-w[0]*.7,0,center[1]-w[2]*.7];
  rooms.push({key,center,origin:[center[0],1.05,center[1]],u,w,width,height:2.1,approach,inRoom,hostPrototypeId:header.nodeId,role:'retained_design_wing_not_surveyed_dwelling'});
 }
 const h=m.hostedComponents??={apertures:[],sourceMasks:[],records:[]};h.records??=[];const levels=[];let serial=0,nextId=100;const used=new Set([...reservedInstanceIds,...h.apertures.map(a=>a.instanceId)]);
 for(const l of m.levels.filter(l=>l.componentId==='tower')){
  const generated=[];for(const r of rooms){while(used.has(nextId))nextId++;if(nextId>511)throw Error('No stable shared aperture ID available');const instanceId=nextId++;used.add(instanceId);serial++;const id=l.nodeId+':unit:'+r.key+':door',host=l.nodeId+':unit:'+r.key+':walls';if(h.apertures.some(a=>a.instanceId===instanceId))throw Error('Door ID collision');
   const aperture=deriveAperture({instanceId,kind:'door',width:r.width,height:r.height,wallThickness:.14,frameDepth:.12,frameWidth:.035,leafThickness:.04,hingeOrSlider:'hinge-left',openT,host:{nodeId:id,origin:add(r.origin,[0,l.elevation,0]),u:r.u,v:[0,1,0],w:r.w,emitWall:false}});
   for(const [k,p]of aperture.primitives.entries())p.objectId=800000+instanceId*16+k;
   Object.assign(aperture,{floorId:l.id,bindingKey:'unit-door-'+r.key,roomKey:r.key,designUnitDoor:true,focusNormal:r.w,actualDimensions:null});h.apertures.push(aperture);
   m.graph.nodes.push({id,type:'door',openT,walkLinkOpen:openT===1,evidence:'retained_design_partition_shared_aperture_not_as_built'});m.graph.edges.push({from:id,to:host,type:'ownedBy'},{from:id,to:l.nodeId+':unit:'+r.key,type:'walksTo',enabled:openT===1});
   generated.push({...r,doorId:id,floorId:l.id,elevation:l.elevation,apertureId:instanceId});
  }levels.push({id:l.id,elevation:l.elevation,rooms:generated});
 }
 m.kccUnitAccess={status:'retained_design_partitions_equipped',actualLayoutInstalled:false,levels,templateRooms:rooms,doorCount:serial,unknown:'Real A-F unit placement and internal room subdivisions remain unverified'};return m;
}
/** Conservative sampled body envelope, not fire/structural certification.
 * startPoint is FLOOR-LOCAL [x, 0, z], not comparison-world coordinates.
 * Convert an actual lift pose by subtracting the building translation and
 * this floor's elevation (and eye height). Both endpoints are kept exactly;
 * connecting them to the search lattice is checked, never snapped silently.
 * Only the requested wing door is opened in the planning copy. Other doors
 * stay shut even when a previous inspection left their runtime copies open.
 */
export function deriveKccUnitRoute(model,key,{step=.2,radius=.23,startPoint=[0,0,0],floorId=null}={}){
 if(!Number.isFinite(step)||step<.05||step>.4||!Number.isFinite(radius)||radius<.1||radius>.4)throw Error('Bounded finite route sampling parameters required');
 if(!Array.isArray(startPoint)||startPoint.length!==3||!startPoint.every(Number.isFinite)||Math.abs(startPoint[1])>1e-8)throw Error('startPoint must be floor-local [x, 0, z]');
 const a=model.archetypes.find(a=>a.id==='tower-floor'),system=model.kccUnitAccess,room=system?.templateRooms.find(r=>r.key===key);if(!a||!room)throw Error('Unknown generated unit');
 const floor=system.levels.find(f=>f.id===(floorId??system.levels[0]?.id));if(!floor)return{passed:false,reason:'No generated design units on requested floor',key,floorId};
 const doors=model.hostedComponents.apertures.filter(a=>a.designUnitDoor&&a.floorId===floor.id);
 if(doors.length!==system.templateRooms.length||new Set(doors.map(a=>a.roomKey)).size!==doors.length||!doors.some(a=>a.roomKey===key))throw Error('Complete owned design door set required');
 const planningDoors=doors.map(a=>({...a,...updateAperture(a,{openT:a.roomKey===key?1:0}),roomKey:a.roomKey,floorId:a.floorId})),baseY=floor.elevation;
 const slab=a.primitives.find(p=>p.nodeId==='floor:slab'),wallPrimitives=a.primitives.filter(p=>p!==slab),isInside=(ps,p)=>queryAssemblyInside({...a,primitives:ps},p);
 const offsets=[[0,0],...Array.from({length:8},(_,k)=>[radius*Math.cos(k*Math.PI/4),radius*Math.sin(k*Math.PI/4)])];
 const safe=p=>{for(const [dx,dz]of offsets){const x=p[0]+dx,z=p[1]+dz;if(!isInside([slab],[x,-.012,z]))return false;for(const y of [.1,.95,1.85])if(isInside(wallPrimitives,[x,y,z])||planningDoors.some(d=>x>=d.bounds.min[0]&&x<=d.bounds.max[0]&&z>=d.bounds.min[2]&&z<=d.bounds.max[2]&&queryApertures(d,[x,y+baseY,z]).inside))return false;}return true;};
 const sampleSpacing=.02,clearSegment=(A,B)=>{const count=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/sampleSpacing));for(let k=0;k<=count;k++)if(!safe(A.map((v,j)=>v+(B[j]-v)*k/count)))return false;return true;};
 const start=[startPoint[0],startPoint[2]],end=[room.inRoom[0],room.inRoom[2]],meta={key,floorId:floor.id,startPoint:[...startPoint],endPoint:[room.inRoom[0],0,room.inRoom[2]],pathSpace:'floor-local',floorElevation:baseY,doorStates:Object.fromEntries(planningDoors.map(a=>[a.roomKey,a.config.openT]))};
 if(!safe(start)||!safe(end))return{...meta,passed:false,reason:'Exact endpoint unsupported/obstructed'};
 const min=a.bounds.min,max=a.bounds.max,nx=Math.ceil((max[0]-min[0])/step)+1,nz=Math.ceil((max[2]-min[2])/step)+1,point=i=>[min[0]+i%nx*step,min[2]+Math.floor(i/nx)*step],cache=new Map();
 const valid=i=>{if(i<0||i>=nx*nz)return false;if(!cache.has(i))cache.set(i,safe(point(i)));return cache.get(i);};
 // Several nearby lattice anchors avoid rejecting a valid exact endpoint just
 // because its nearest rounded cell lies behind a wall. Every link is checked.
 const anchors=p=>{const ix=Math.round((p[0]-min[0])/step),iz=Math.round((p[1]-min[2])/step),out=[];for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const x=ix+dx,z=iz+dz;if(x<0||x>=nx||z<0||z>=nz)continue;const i=x+nx*z;if(valid(i)&&clearSegment(p,point(i)))out.push(i);}return out.sort((a,b)=>Math.hypot(...point(a).map((v,k)=>v-p[k]))-Math.hypot(...point(b).map((v,k)=>v-p[k])));};
 const starts=anchors(start),ends=new Set(anchors(end));if(!starts.length||!ends.size)return{...meta,passed:false,reason:'No supported exact-endpoint lattice connector'};
 const queue=[...starts],prev=new Map(starts.map(i=>[i,null]));let found=starts.find(i=>ends.has(i));
 for(let c=0;c<queue.length&&found===undefined;c++){const i=queue[c];for(const d of[-1,1,-nx,nx]){const j=i+d;if(Math.abs(j%nx-i%nx)>1||prev.has(j)||!valid(j)||!clearSegment(point(i),point(j)))continue;prev.set(j,i);queue.push(j);if(ends.has(j)){found=j;break;}}}
 if(found===undefined)return{...meta,passed:false,reason:'No clear sampled path with other unit doors closed',checks:cache.size};
 const path=[];for(let i=found;i!==null;i=prev.get(i))path.push(point(i));path.reverse();path.unshift(start);path.push(end);
 const dense=[start];for(let i=1;i<path.length;i++){const A=path[i-1],B=path[i],distance=Math.hypot(B[0]-A[0],B[1]-A[1]);if(distance<1e-12)continue;const count=Math.max(1,Math.ceil(distance/sampleSpacing));for(let k=1;k<=count;k++)dense.push(A.map((v,j)=>v+(B[j]-v)*k/count));}
 // Preserve caller and target coordinates verbatim after interpolation.
 dense[0]=start;dense[dense.length-1]=end;
 return{...meta,passed:true,path:dense.map(p=>[p[0],0,p[1]]),step,radius,height:1.85,checks:cache.size,sampleSpacing,endpointConnectorsChecked:true,evidence:'sampled_retained_design_geometry_not_actual_household_route',requiresDoorOpen:room.key,otherDoorsMustRemainClosed:true};
}

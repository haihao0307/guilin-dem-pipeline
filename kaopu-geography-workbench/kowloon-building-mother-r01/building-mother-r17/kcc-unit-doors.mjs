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
/** Conservative sampled body envelope, not fire/structural certification. */
export function deriveKccUnitRoute(model,key,{step=.2,radius=.23}={}){
 const a=model.archetypes.find(a=>a.id==='tower-floor'),room=model.kccUnitAccess.templateRooms.find(r=>r.key===key);if(!room)throw Error('Unknown generated unit');
 const openDoors=model.hostedComponents.apertures.filter(a=>a.designUnitDoor&&a.floorId===model.kccUnitAccess.levels[0].id).map(a=>updateAperture(a,{openT:1})),baseY=model.kccUnitAccess.levels[0].elevation;
 const slab=a.primitives.find(p=>p.nodeId==='floor:slab'),wallPrimitives=a.primitives.filter(p=>p!==slab),isInside=(ps,p)=>queryAssemblyInside({...a,primitives:ps},p);
 const safe=(p)=>{if(!isInside([slab],[p[0],-.012,p[1]]))return false;for(let k=0;k<8;k++){const x=p[0]+radius*Math.cos(k*Math.PI/4),z=p[1]+radius*Math.sin(k*Math.PI/4);if(!isInside([slab],[x,-.012,z]))return false;for(const y of [.1,.95,1.85])if(isInside(wallPrimitives,[x,y,z])||openDoors.some(d=>x>=d.bounds.min[0]&&x<=d.bounds.max[0]&&z>=d.bounds.min[2]&&z<=d.bounds.max[2]&&queryApertures(d,[x,y+baseY,z]).inside))return false;}return true;};
 const min=a.bounds.min,max=a.bounds.max,nx=Math.ceil((max[0]-min[0])/step)+1,nz=Math.ceil((max[2]-min[2])/step)+1,point=i=>[min[0]+i%nx*step,min[2]+Math.floor(i/nx)*step],index=p=>Math.round((p[0]-min[0])/step)+nx*Math.round((p[1]-min[2])/step),cache=new Map();
 const valid=i=>{if(i<0||i>=nx*nz)return false;if(!cache.has(i))cache.set(i,safe(point(i)));return cache.get(i);};
 const start=index([0,0]),end=index([room.inRoom[0],room.inRoom[2]]);if(!valid(start)||!valid(end))return{passed:false,reason:'Endpoint unsupported/obstructed',key};
 const queue=[start],prev=new Map([[start,null]]);for(let c=0;c<queue.length&&!prev.has(end);c++){const i=queue[c];for(const d of[-1,1,-nx,nx]){const j=i+d;if(Math.abs(j%nx-i%nx)>1||prev.has(j)||!valid(j))continue;const A=point(i),B=point(j);if([.25,.5,.75].some(t=>!safe(A.map((v,k)=>v+(B[k]-v)*t))))continue;prev.set(j,i);queue.push(j);}}
 if(!prev.has(end))return{passed:false,reason:'No clear sampled path',key};const path=[];for(let i=end;i!==null;i=prev.get(i))path.push(point(i));path.reverse();const dense=[path[0]];for(let i=1;i<path.length;i++)for(let k=1;k<=10;k++)dense.push(path[i-1].map((v,j)=>v+(path[i][j]-v)*k/10));
 return{passed:true,key,path:dense.map(p=>[p[0],0,p[1]]),step,radius,height:1.85,checks:cache.size,evidence:'sampled_retained_design_geometry_not_actual_household_route',requiresDoorOpen:room.key};
}

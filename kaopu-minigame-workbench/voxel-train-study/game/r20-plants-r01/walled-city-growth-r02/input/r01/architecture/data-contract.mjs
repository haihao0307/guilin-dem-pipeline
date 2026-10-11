/** Review-stage semantic checks only. No renderer, building generator or CPU surface mesh.
 * Explicit dimensions and clearances are design assertions, not measured/solved geometry.
 */
export const VERSION='growth-contract-review-r01';
export const EVENT_KINDS=Object.freeze(['found','add-storey','roof-room','subdivide','merge','cantilever','borrow-access','gate-change','service-extend','repair','seal-opening']);
export const PROVENANCE_KINDS=Object.freeze(['observed','inferred','authored']);
export const ROUTE_KINDS=Object.freeze(['walk','door','stair','borrow']);
const need=(ok,message,errors)=>{if(!ok)errors.push(message);};

export function validateEventLog(events){
  const errors=[],seen=new Set();let tick=-Infinity;
  for(const e of events){
    need(typeof e.id==='string'&&!seen.has(e.id),`event id duplicate/missing: ${e.id}`,errors);
    need(Number.isFinite(e.tick)&&e.tick>=tick,`chronology: ${e.id}`,errors);
    need(EVENT_KINDS.includes(e.kind),`event kind: ${e.id}`,errors);
    need(!!e.ownerId&&!!e.buildingId,`independent owner/building: ${e.id}`,errors);
    need(typeof e.reason==='string'&&e.reason.length>0,`causal reason: ${e.id}`,errors);
    if(e.kind!=='found')need(e.causeIds?.length>0,`change has no life/environment cause: ${e.id}`,errors);
    need(PROVENANCE_KINDS.includes(e.provenance?.kind),`provenance: ${e.id}`,errors);
    if(e.provenance?.kind==='observed')need(e.provenance.evidenceIds?.length>0,`observed without evidence: ${e.id}`,errors);
    for(const p of e.dependsOn??[])need(seen.has(p),`missing earlier event ${p}: ${e.id}`,errors);
    seen.add(e.id);tick=e.tick;
  }
  return errors;
}

export function reachable(plan,start,actor={id:'visitor',roles:['visitor']}){
  const nodes=new Set(plan.spaces.map(x=>x.id)),gates=new Map(plan.gates.map(x=>[x.id,x]));
  if(!nodes.has(start))return [];
  const seen=new Set([start]),queue=[start];
  for(let i=0;i<queue.length;i++)for(const e of plan.routes){
    if(e.enabled===false||!ROUTE_KINDS.includes(e.kind))continue;
    let next=e.from===queue[i]?e.to:!e.oneWay&&e.to===queue[i]?e.from:null;
    if(!next||!nodes.has(next))continue;
    const gate=e.gateId?gates.get(e.gateId):null;
    if(e.gateId&&!gate)continue;
    if(gate?.state==='blocked')continue;
    if(gate&&gate.state!=='open'&&!gate.allowedActorIds?.includes(actor.id)&&!gate.allowedRoles?.some(x=>actor.roles.includes(x)))continue;
    if(!seen.has(next)){seen.add(next);queue.push(next);}
  }
  return [...seen].sort();
}

export function validatePlan(plan){
  const errors=validateEventLog(plan.events),warnings=[];
  const buildings=new Map(plan.buildings.map(x=>[x.id,x]));
  const spaces=new Map(plan.spaces.map(x=>[x.id,x]));
  const events=new Set(plan.events.map(x=>x.id));
  const components=new Map(plan.components.map(x=>[x.id,x]));
  const gates=new Map(plan.gates.map(x=>[x.id,x]));
  const causes=new Set((plan.causes??[]).map(x=>x.id));
  for(const e of plan.events)for(const id of e.causeIds??[])need(causes.has(id),`unknown life/environment cause ${id}: ${e.id}`,errors);
  need(buildings.size===plan.buildings.length,'duplicate building',errors);
  need(spaces.size===plan.spaces.length,'duplicate space',errors);
  need(components.size===plan.components.length,'duplicate component',errors);
  // A genuine planar settlement may be irregular. Do not prescribe a grid or a unitary masterplan.
  const centers=plan.buildings.map(x=>x.originM);
  if(centers.length>=3){
    const a=centers[0];let area=false;
    for(const b of centers)for(const c of centers)if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))>1e-6)area=true;
    need(area,'building origins only form an extruded section line',errors);
  }
  for(const b of buildings.values()){
    need(!!b.ownerId&&Array.isArray(b.floorElevationsM)&&b.floorElevationsM.length>=1,`building identity/floors: ${b.id}`,errors);
    need(spaces.has(b.entrySpaceId),`building entry absent: ${b.id}`,errors);
    for(let i=1;i<b.floorElevationsM.length;i++)need(b.floorElevationsM[i]>b.floorElevationsM[i-1],`floor order: ${b.id}`,errors);
    need(Array.isArray(b.ownStairRouteIds),`own stair declarations: ${b.id}`,errors);
    for(const id of b.ownStairRouteIds??[]){
      const r=plan.routes.find(x=>x.id===id);
      need(r?.kind==='stair'&&spaces.get(r.from)?.buildingId===b.id&&spaces.get(r.to)?.buildingId===b.id,`independent stair ${id}: ${b.id}`,errors);
    }
  }
  for(const s of spaces.values()){
    need(s.buildingId===null||buildings.has(s.buildingId),`space building: ${s.id}`,errors);
    need(['street','landing','dwelling','shop','workshop','roof','service','air'].includes(s.use),`space purpose: ${s.id}`,errors);
    need(Array.isArray(s.positionM)&&s.positionM.length===3&&s.positionM.every(Number.isFinite),`space 3D point: ${s.id}`,errors);
    need(events.has(s.bornEventId),`space construction event: ${s.id}`,errors);
  }
  for(const e of plan.routes){
    need(spaces.has(e.from)&&spaces.has(e.to),`route endpoints: ${e.id}`,errors);
    need(ROUTE_KINDS.includes(e.kind),`non-walkable feature inserted in navigation: ${e.id}`,errors);
    need(spaces.get(e.from)?.use!=='air'&&spaces.get(e.to)?.use!=='air',`route through air: ${e.id}`,errors);
    need(e.widthM>0&&e.headroomM>0,`route scale: ${e.id}`,errors);
    need(e.clearanceStatus==='pending'||e.clearanceStatus==='geometry-tested',`clearance status: ${e.id}`,errors);
    if(e.clearanceStatus!=='geometry-tested')warnings.push(`geometry clearance untested: ${e.id}`);
    const dy=Math.abs((spaces.get(e.from)?.positionM[1]??0)-(spaces.get(e.to)?.positionM[1]??0));
    if(e.kind==='stair'||e.heightResolution==='steps'){
      need(Number.isInteger(e.riserCount)&&e.riserCount>0&&e.riserM>0,`step definition: ${e.id}`,errors);
      need(Math.abs(e.riserCount*e.riserM-dy)<.00001,`steps do not meet actual elevation: ${e.id}`,errors);
    } else need(dy<.005,`non-step route has unhandled height difference: ${e.id}`,errors);
    if(e.kind==='borrow'){
      const a=spaces.get(e.from),b=spaces.get(e.to);
      need(a?.buildingId!==b?.buildingId&&!!a?.buildingId&&!!b?.buildingId,`borrow must connect different buildings: ${e.id}`,errors);
      need(e.consentOwnerIds?.includes(buildings.get(a?.buildingId)?.ownerId)&&e.consentOwnerIds?.includes(buildings.get(b?.buildingId)?.ownerId),`borrow consent: ${e.id}`,errors);
      need(e.gateId&&gates.has(e.gateId),`borrow gate: ${e.id}`,errors);
      need(e.heightResolution==='level'||e.heightResolution==='steps',`borrow height solution: ${e.id}`,errors);
      if(e.heightResolution==='level'&&a&&b)need(Math.abs(a.positionM[1]-b.positionM[1])<.005,`level route has floor mismatch: ${e.id}`,errors);
    }
  }
  for(const o of plan.openings){
    need(spaces.has(o.fromSpaceId)&&spaces.has(o.toSpaceId),`opening has no real spaces: ${o.id}`,errors);
    need(o.fromSpaceId!==o.toSpaceId,`opening same space twice: ${o.id}`,errors);
    need(components.has(o.frameComponentId),`missing frame: ${o.id}`,errors);
    if(o.kind==='door')need(components.has(o.leafComponentId),`missing door leaf: ${o.id}`,errors);
    if(o.kind==='window'&&!o.sealed)need(spaces.get(o.toSpaceId)?.use==='air'&&spaces.get(o.toSpaceId)?.airConnected===true,`window faces no actual air domain: ${o.id}`,errors);
  }
  for(const c of components.values()){
    need(events.has(c.bornEventId),`component construction event: ${c.id}`,errors);
    need(!!c.motherSourceId&&!!c.fabricStateId,`joint form/material state: ${c.id}`,errors);
    if(c.kind==='rail')need(c.edgeClass==='drop'&&c.omitsAccessOpenings===true,`rail placement: ${c.id}`,errors);
    if(!c.foundation)need(c.supportIds?.length>0,`no support relation: ${c.id}`,errors);
    const visit=(id,trail)=>{
      if(trail.has(id))return false;
      const x=components.get(id);if(!x)return false;if(x.foundation)return true;
      const next=new Set(trail);next.add(id);
      return !!x.supportIds?.length&&x.supportIds.every(p=>visit(p,next));
    };
    need(visit(c.id,new Set()),`support not rooted or cyclic: ${c.id}`,errors);
  }
  for(const d of plan.drainRoutes){
    need(d.pointsM?.length>=2&&d.outletId,`drain endpoints: ${d.id}`,errors);
    if(!d.pumped)for(let i=1;i<(d.pointsM?.length??0);i++)need(d.pointsM[i][1]<=d.pointsM[i-1][1],`unexplained uphill drain: ${d.id}`,errors);
  }
  const states=new Map((plan.fabricStates??[]).map(x=>[x.id,x]));
  for(const c of components.values())need(states.has(c.fabricStateId),`fabric state absent: ${c.id}`,errors);
  for(const f of states.values()){
    need(events.has(f.constructionEventId),`fabric construction origin: ${f.id}`,errors);
    for(const m of f.maintenance??[]){
      need(events.has(m.eventId)&&m.regionId&&m.layerId,`maintenance must be local and layer-specific: ${f.id}`,errors);
      need(m.resetsWholeSettlementAge!==true,`maintenance globally resets age: ${f.id}`,errors);
    }
  }
  return {valid:errors.length===0,errors,warnings,scope:'semantic contract only; no geometry, GPU or compliance pass'};
}

/** Atomic DATA transaction. This does not create geometry or approve a construction proposal. */
export function applyTransaction(current,{event,patches}){
  const next=structuredClone(current);
  const allowed=['buildings','spaces','routes','gates','openings','components','drainRoutes','fabricStates'];
  try{
    const required={
      'add-storey':['buildings','spaces','routes','components','fabricStates'],
      'roof-room':['buildings','spaces','routes','components','fabricStates'],
      'borrow-access':['routes','gates','components','fabricStates'],
      'repair':['components','fabricStates']
    }[event.kind]??[];
    for(const name of required)if(!patches.some(x=>x.collection===name))throw new Error(`incomplete event effects: ${name}`);
    next.events.push(structuredClone(event));
    for(const p of patches){
      if(!allowed.includes(p.collection)||p.op!=='upsert'||!p.value?.id)throw new Error('unsupported patch');
      const list=next[p.collection],i=list.findIndex(x=>x.id===p.value.id);
      if(i<0)list.push(structuredClone(p.value));else list[i]=structuredClone(p.value);
    }
    const check=validatePlan(next);
    return check.valid?{accepted:true,state:next,...check}:{accepted:false,state:current,...check};
  }catch(e){return {accepted:false,state:current,valid:false,errors:[e.message]};}
}

/** Every view references the SAME world IDs. The plane does not create new rooms. */
export function sectionContract(worldId,normal,offsetM){
  if(normal.length!==3||!normal.every(Number.isFinite)||!Number.isFinite(offsetM))throw new Error('section coordinates');
  const length=Math.hypot(...normal);if(length<1e-8)throw new Error('zero section normal');
  return Object.freeze({worldId,normal:normal.map(x=>x/length),offsetM:offsetM/length,mutatesWorld:false,addsFacadeWeather:false,capSource:'cut-component-mother'});
}

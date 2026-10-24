/** R13 opening heads are dependencies of existing geometry, not extra lintels.
 * Head-zone height is available geometric space, NEVER a designed RC section.
 * No dimensions here certify capacity, fire compliance or actual construction.
 */
export const DOOR_SYSTEM_DEFERRED = Object.freeze({
 status:'deferred', ordinaryLeavesRendered:false,
 apertureAndInstallInterfacesRetained:true, elevatorDoorPairsRetained:true,
 actualDoorSpecification:null,
});
const EPS=1e-7,clone=x=>structuredClone(x);
const key=e=>JSON.stringify([e.from,e.to,e.type]);

/** Keep the rough hole, fixed installation frame and any host/reveal; remove
 * only the unapproved ordinary moving door. Recipe snapshots cannot respawn it. */
export function deferOrdinaryDoorAperture(aperture){
 if(aperture.kind!=='door')return aperture;
 for(const recipe of[aperture.config,aperture.parameters,aperture.initialParameters])if(recipe)recipe.leafEnabled=false;
 aperture.primitives=aperture.primitives.filter(p=>p.part!=='leaf'&&p.part!=='glass');
 aperture.counts={...aperture.counts,primitives:aperture.primitives.length};
 if(aperture.primitives.length)aperture.bounds={min:[0,1,2].map(k=>Math.min(...aperture.primitives.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...aperture.primitives.map(p=>p.bounds.max[k])))};
 aperture.doorSystemDeferred=true;
 aperture.installInterface={status:'reserved_for_future_door_system',roughWidthM:aperture.config.width,roughHeightM:aperture.config.height,host:clone(aperture.host),actualLeafSpecification:null};
 return aperture;
}

/** storeys use EXISTING retained/design datum values. An unrendered upper-floor
 * interface is allowed for a detached candidate; it is not a newly found slab.
 * Each support is keyed by its existing wall, shared by all that wall's holes.
 * geometryRefs identify real emitted headwall fields or regions of a notched
 * wall. Unknown source-wall construction deliberately has no such reference. */
export function attachOpeningHeadRelations(model,{storeys,openings}={}){
 if(!model?.graph||!Array.isArray(storeys)||!Array.isArray(openings))throw Error('Explicit opening-head graph, storeys and openings required');
 if(model.openingHeadRelations)throw Error('Opening heads must be regenerated from the seed, not appended twice');
 const {nodes,edges}=model.graph,map=new Map(nodes.map(n=>[n.id,n]));
 if(map.size!==nodes.length)throw Error('Duplicate graph identities before head attachment');
 const put=(id,type,props)=>{let n=map.get(id);if(!n){n={id,type,...props};nodes.push(n);map.set(id,n);}return n;};
 const link=(from,to,type,extra={})=>{if(!edges.some(e=>e.from===from&&e.to===to&&e.type===type))edges.push({from,to,type,...extra});};
 const floors=new Map();
 for(const s of storeys){
  const values=[s.elevation,s.clearTop,s.upperDatum,s.slabThickness];
  if(!s.floorId||!map.has(s.floorNodeId)||!s.upperBoundaryId||values.some(v=>!Number.isFinite(v))||s.clearTop<=s.elevation||s.slabThickness<=0||Math.abs(s.upperDatum-s.clearTop-s.slabThickness)>EPS)throw Error('Explicit consistent storey/head datum required');
  if(floors.has(s.floorId))throw Error('Duplicate storey relation');
  const datumId=s.floorNodeId+':opening-height-datum';
  const floor={...clone(s),datumId,designClearHeightM:s.clearTop-s.elevation,designStoreyHeightM:s.upperDatum-s.elevation,actualStoreyHeightM:null};floors.set(s.floorId,floor);
  put(datumId,'storey-height-datum',{...floor,evidence:s.evidence,structuralCertification:false,sourceValuesChanged:false});
  const boundary=put(s.upperBoundaryId,'upper-floor-interface',{rendered:false,actualDimensions:null,evidence:'explicit_candidate_upper_boundary_not_actual_slab'});
  // Existing slab/roof evidence is retained; these edges only constrain geometry.
  link(datumId,s.floorNodeId,'derivedFrom',{evidence:s.evidence});
  link(s.upperBoundaryId,datumId,'positionedBy',{evidence:'geometric_height_dependency_not_load_path'});
  link(s.upperBoundaryId,datumId,'dependsOn',{scope:'opening_head_geometry'});
  if(!boundary.openingHeadHeightDatumIds)boundary.openingHeadHeightDatumIds=[];
  if(!boundary.openingHeadHeightDatumIds.includes(datumId))boundary.openingHeadHeightDatumIds.push(datumId);
 }
 const relations=[],supportIds=new Set();
 for(const o of openings){
  const f=floors.get(o.floorId);
  if(!f||!map.has(o.openingId)||!map.has(o.infillId)||!Array.isArray(o.supports)||!o.supports.length||![o.width,o.bottom,o.top].every(Number.isFinite)||o.width<=0||o.top<=o.bottom||o.bottom<f.elevation-EPS||o.top>f.clearTop+EPS)throw Error('Opening head must fit its explicit retained/design storey: '+o.openingId);
  const id=o.openingId+':head',supportRefs=[];
  if(map.has(id)||relations.some(r=>r.openingId===o.openingId))throw Error('Duplicate opening head '+o.openingId);
  put(id,'opening-head',{openingId:o.openingId,infillId:o.infillId,headElevationM:o.top,evidence:o.evidence,rendered:false,actualDimensions:null});
  link(id,o.openingId,'headOf');
  for(const s of o.supports){
   if(!map.has(s.wallId))throw Error('Missing existing header host '+s.wallId);
   const refs=clone(s.geometryRefs??[]),known=refs.length>0,supportId=s.wallId+':opening-head-support';
   const node=put(supportId,'header-support-role',{hostWallId:s.wallId,supportingRole:'opening_head_support_required',physicalMemberKind:known?'existing_headwall_region':'unknown_source_wall_construction',actualHeaderDimensions:null,designLintelSection:null,structuralCapacityVerified:false,rendered:false,geometryRefs:[],openingIds:[],evidence:known?'authored_headwall_geometry_not_engineered_header':'support_required_actual_member_unverified'});
   if(node.hostWallId!==s.wallId)throw Error('Header role cannot switch wall hosts');
   for(const ref of refs)if(!node.geometryRefs.some(r=>JSON.stringify(r)===JSON.stringify(ref)))node.geometryRefs.push(ref);
   if(!node.openingIds.includes(o.openingId))node.openingIds.push(o.openingId);
   link(supportId,s.wallId,'reusesHost');
   link(id,supportId,'dependsOn',{scope:'opening_head_geometry',structuralCapacityVerified:false});
   link(supportId,f.upperBoundaryId,'boundedAboveBy',{evidence:'geometric_height_dependency_not_load_path'});
   link(supportId,f.upperBoundaryId,'dependsOn',{scope:'opening_head_geometry'});
   for(const beamId of s.beamIds??[]){if(!map.has(beamId))throw Error('Missing existing referenced beam');link(supportId,beamId,'referencesExistingBeam',{structuralCapacityVerified:false});}
   supportIds.add(supportId);supportRefs.push({id:supportId,wallId:s.wallId,status:known?'existing_headwall_geometry':'unknown',geometryRefs:refs});
  }
  const r={id,openingId:o.openingId,infillId:o.infillId,kind:o.kind,observationId:o.observationId??null,floorId:o.floorId,hostWallIds:supportRefs.map(s=>s.wallId),supportRefs,upperBoundaryId:f.upperBoundaryId,storeyDatumId:f.datumId,
   dimensions:{roughWidthM:o.width,roughHeightM:o.top-o.bottom,sillAboveDesignFloorM:o.bottom-f.elevation,headAboveDesignFloorM:o.top-f.elevation,headElevationM:o.top,designClearHeightM:f.designClearHeightM,designStoreyHeightM:f.designStoreyHeightM,upperSlabThicknessM:f.slabThickness,availableHeadZoneM:f.clearTop-o.top,actualOpeningDimensions:null,actualHeaderDimensions:null,designLintelSection:null,actualStoreyHeightM:null},
   evidence:o.evidence,actualFloorAssignmentVerified:false,structuralCapacityVerified:false,independentLintelGenerated:false};
  relations.push(r);
  Object.assign(map.get(o.openingId),{headRelationId:id,headElevationM:o.top,roughHeightM:o.top-o.bottom,actualHeaderDimensions:null});
  Object.assign(map.get(o.infillId),{openingHeadRelationId:id,...(o.doorSystemDeferred?{doorSystemDeferred:true,actualDoorSpecification:null}:{})});
 }
 const result={schema:'kaopu.opening-head-relations/1',relations,storeys:[...floors.values()],headerSupportRoleIds:[...supportIds],generatedIndependentLintels:0,structuralCertification:false,fireComplianceVerified:false,sourceValuesChanged:false};
 model.openingHeadRelations=result;
 result.validation=validateOpeningHeadRelations(model);if(!result.validation.passed)throw Error('Opening head relations: '+JSON.stringify(result.validation.errors));
 return result;
}

export function validateOpeningHeadRelations(model){
 const errors=[],r=model?.openingHeadRelations,graph=model?.graph;
 if(!r||!graph)return{passed:false,errors:['Missing opening-head relation system']};
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),edges=new Set(graph.edges.map(key)),has=(a,b,t)=>edges.has(key({from:a,to:b,type:t})),seen=new Set();
 if(nodes.size!==graph.nodes.length)errors.push('Duplicate graph identity');
 const primitives=model.archetypes?.flatMap(a=>a.primitives)??[];
 for(const x of r.relations){
  const d=x.dimensions;
  if(seen.has(x.openingId))errors.push('Duplicate head '+x.openingId);seen.add(x.openingId);
  if(![x.id,x.openingId,x.infillId,x.upperBoundaryId,x.storeyDatumId,...x.hostWallIds].every(id=>nodes.has(id)))errors.push('Missing head endpoint '+x.id);
  if(!has(x.id,x.openingId,'headOf')||!has(x.upperBoundaryId,x.storeyDatumId,'dependsOn'))errors.push('Broken head/storey dependency '+x.id);
  if(Math.abs(d.sillAboveDesignFloorM+d.roughHeightM-d.headAboveDesignFloorM)>EPS||Math.abs(d.headAboveDesignFloorM+d.availableHeadZoneM-d.designClearHeightM)>EPS||Math.abs(d.designClearHeightM+d.upperSlabThicknessM-d.designStoreyHeightM)>EPS||d.availableHeadZoneM<-EPS)errors.push('Inconsistent height budget '+x.id);
  if(d.actualHeaderDimensions!==null||d.designLintelSection!==null||x.structuralCapacityVerified!==false||x.independentLintelGenerated!==false)errors.push('Unsupported structural claim '+x.id);
  for(const s of x.supportRefs){
   const n=nodes.get(s.id);
   if(!n||n.hostWallId!==s.wallId||!has(x.id,s.id,'dependsOn')||!has(s.id,x.upperBoundaryId,'dependsOn')||!has(s.id,s.wallId,'reusesHost'))errors.push('Broken header reuse '+x.id);
   for(const ref of s.geometryRefs){
    const instance=(model.instances??[]).find(i=>i.id===ref.instanceId),archetype=instance&&(model.archetypes??[]).find(a=>a.id===instance.archetypeId);
    const primitive=(archetype?.primitives??[]).find(p=>p.nodeId===ref.primitiveNodeId);
    if(!primitive)errors.push('Missing existing header field '+ref.primitiveNodeId);
    if(ref.bottomM!==undefined&&Math.abs(ref.bottomM-x.dimensions.headElevationM)>EPS)errors.push('Header field does not start at opening head '+x.id);
    const floor=r.storeys.find(f=>f.floorId===x.floorId);
    if(ref.topM!==undefined&&Math.abs(ref.topM-floor.clearTop)>EPS)errors.push('Header field does not meet its upper boundary '+x.id);
    if(primitive&&ref.kind==='existing_headwall_field'&&(Math.abs(primitive.bounds.min[1]+instance.translation[1]-ref.bottomM)>EPS||Math.abs(primitive.bounds.max[1]+instance.translation[1]-ref.topM)>EPS))errors.push('Headwall reference has stale physical heights '+x.id);
    if(primitive&&['head_region_of_existing_notched_wall','head_region_of_existing_window_host'].includes(ref.kind)){
     const region=ref.region,base=primitive.origin[1]+instance.translation[1];
     if(!region||Math.abs(region.verticalRange[0]+base-ref.bottomM)>EPS||Math.abs(region.verticalRange[1]+base-ref.topM)>EPS||!region.axisRange.every(a=>primitive.loops.some(loop=>loop.some(q=>Math.abs(q[0]-a)<EPS&&Math.abs(q[1]-region.verticalRange[0])<EPS))))errors.push('Notched wall head region is stale '+x.id);
    }
   }
  }
 }
 const supporting=graph.nodes.filter(n=>n.type==='header-support-role');
 if(new Set(supporting.map(n=>n.hostWallId)).size!==supporting.length)errors.push('Duplicated independent header role for one existing host');
 if(r.generatedIndependentLintels!==0||primitives.some(p=>p.generatedIndependentLintel===true))errors.push('Unexpected independent lintel geometry');
 return{passed:errors.length===0,errors,openingCount:r.relations.length,reusedHeaderRoles:supporting.length,independentLintelCount:0};
}

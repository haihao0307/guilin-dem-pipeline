import {auditRetainedRelations} from './retained-relations.mjs';
import {compileSupportProgram,mergeBays} from './frame-growth.mjs';
import {deriveFloorMother,integrateCompleteFloorSystem} from './complete-floor-system.mjs';
import {observedFloor,attachObservedLayouts,KCC_ID} from './kcc-observed-layout.mjs';
import {buildCandidateStructure,INSPECTION_ASSUMPTIONS} from './kcc-candidate-structure.mjs';
/** One growth entry. Evidence chooses the actual building; parameters only select
 * explicit inspection/design assumptions. No triangle/part importing, no mutable
 * global scene. Every call creates a fresh dependency tree from the retained seed. */
export const GROWTH_ORDER=['datum','belowGround','horizontal','vertical','circulation','envelope','roof'];
const clone=x=>structuredClone(x), fact=(value,evidence,source=null)=>({value,evidence,source});
const unknown=reason=>({value:null,evidence:'unknown',reason});
export function frameCell({corners,columnWidth,beamWidth,beamDepth,height}){
 if(corners?.length!==4||corners.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v)))||[columnWidth,beamWidth,beamDepth,height].some(v=>!Number.isFinite(v)||v<=0))throw Error('Explicit frame-cell dimensions required');
 return {kind:'frame-cell-prototype-not-universal-structure',columns:corners.map((p,i)=>({key:'column-'+i,point:[...p],width:columnWidth,height})),beams:corners.map((p,i)=>({key:'beam-'+i,from:i,to:(i+1)%4,width:beamWidth,depth:beamDepth,span:Math.hypot(...p.map((v,k)=>v-corners[(i+1)%4][k]))})),structuralCertification:false};
}
function stage(name,dependsOn,value){return{name,dependsOn,value};}
function graph(){const nodes=[],edges=[];return{nodes,edges,node(id,type,props={}){if(nodes.some(n=>n.id===id))throw Error('Duplicate Mother identity '+id);nodes.push({id,type,...props});return id;},edge(from,to,type,props={}){edges.push({from,to,type,...props});}};}
export function routeInMother(recipe,from,to,{allowInferred=false}={}){
 const allowed=new Set(['walksThrough','stairConnects','opensTo']);const queue=[[from]],seen=new Set([from]);
 while(queue.length){const p=queue.shift(),id=p.at(-1);if(id===to)return{found:true,path:p,verification:'topological_only_not_clearance_or_fire_certification'};
 for(const e of recipe.graph.edges){if(!allowed.has(e.type)||(!allowInferred&&e.evidence==='inferred')||e.enabled===false)continue;const next=e.from===id?e.to:e.to===id?e.from:null;if(next&&!seen.has(next)){seen.add(next);queue.push([...p,next]);}}}
 return{found:false,path:[],reason:'No evidenced or explicitly admitted inspection route'};
}
function lowriseTopology(mother,levels,buildingId){
 const g=graph(),root=g.node(buildingId,'building'),outside=g.node(buildingId+':outside','outside'),entrance=g.node(buildingId+':entrance','building_entry',{evidence:'retained_entry_reference'}),core=g.node(buildingId+':stair-core','vertical_core',{evidence:'authored_inspection_not_surveyed'});g.edge(outside,entrance,'walksThrough');
 const floors=[],hosts=[],openings=[];
 levels.forEach((l,index)=>{const prefix=buildingId+':'+l.id,level=g.node(prefix,'floor',{elevation:l.elevation,evidence:'retained_level_not_new_measurement'}),corridor=g.node(prefix+':circulation','corridor',{polygons:mother.rooms.find(r=>r.key==='circulation').polygons}),landing=g.node(prefix+':landing','stair_landing');g.edge(level,root,'belongsTo');g.edge(landing,core,'belongsTo');g.edge(landing,corridor,'walksThrough');if(index===0)g.edge(entrance,corridor,'walksThrough');if(index)g.edge(floors[index-1].landing,landing,'stairConnects',{evidence:'authored_inspection_not_surveyed'});
 const rooms=mother.rooms.filter(r=>r.key!=='circulation').map(r=>g.node(prefix+':room:'+r.key,'room',{use:r.use,evidence:'authored_inspection_not_surveyed'}));
 for(const w of mother.walls){const id=g.node(prefix+':wall:'+w.key,'wall',{thickness:mother.config.wallThickness,sourceBoundaryKey:w.key,exterior:w.exterior});hosts.push({id,floorId:l.id,boundary:w});}
 for(const d of mother.doors.filter(d=>!d.firstFloorOnly||index===0)){const wall=prefix+':wall:'+d.boundaryKey,opening=g.node(prefix+':opening:'+d.key,'opening',{width:d.width,height:d.height,sill:0}),door=g.node(prefix+':door:'+d.key,'door');g.edge(opening,wall,'voids');g.edge(door,opening,'fills');const from=d.from==='outside'?outside:corridor,to=d.to==='circulation'?corridor:prefix+':room:'+d.roomKey;g.edge(opening,from,'walksThrough');g.edge(opening,to,'walksThrough');openings.push({id:opening,wallId:wall,doorId:door,floorId:l.id});}
 floors.push({id:level,label:l.id,elevation:l.elevation,corridor,landing,rooms});});
 return{graph:{nodes:g.nodes,edges:g.edges},floors,hosts,openings,entry:outside,core,evidence:'authored_inspection_not_surveyed'};
}
function kccTopology(layouts){const g=graph(),root=g.node(KCC_ID,'building'),core=g.node(KCC_ID+':plan-core','vertical_core',{registration:'unresolved_R0_R180'}),entry=g.node(KCC_ID+':entry-unknown','building_entry',{evidence:'unknown_ground_to_residential_route'}),floors=[],hosts=[],openings=[];
 for(const layout of layouts){for(const n of layout.nodes)g.node(n.id,n.type,{...n});for(const e of layout.edges)g.edges.push({...e});const floor=layout.nodes.find(n=>n.type==='floor'),lobby=layout.nodes.find(n=>n.type==='lobby'),rooms=layout.nodes.filter(n=>n.type==='dwelling');g.edge(floor.id,root,'belongsTo');for(const n of layout.nodes.filter(n=>n.type==='stair_route_entry'||n.type==='lift_interface')){g.edge(n.id,core,'correspondsToCore',{evidence:'inferred',provesServedStop:false});}
 for(const o of layout.nodes.filter(n=>n.type==='opening')){const host=layout.edges.find(e=>e.from===o.id&&e.type==='voids'),fill=layout.edges.find(e=>e.to===o.id&&e.type==='fills');hosts.push({id:host.to,floorId:layout.floorLabel});openings.push({id:o.id,wallId:host.to,doorId:fill.from,floorId:layout.floorLabel});for(const e of layout.edges.filter(e=>e.from===o.id&&e.type==='opensBetween'))g.edge(o.id,e.to,'walksThrough',{evidence:'observed_plan'});}
 floors.push({id:floor.id,label:layout.floorLabel,elevation:null,corridor:lobby.id,rooms:rooms.map(n=>n.id),stairEntries:layout.nodes.filter(n=>n.type==='stair_route_entry').map(n=>n.id),lifts:layout.nodes.filter(n=>n.type==='lift_interface').map(n=>n.id)});
 }
 return{graph:{nodes:g.nodes,edges:g.edges},floors,hosts,openings,entry,core,evidence:'observed_plan; vertical_registration_unknown'};
}
export function validateBuildingMother(recipe){
 const ids=new Set(recipe.graph.nodes.map(n=>n.id)),failures=[];if(ids.size!==recipe.graph.nodes.length)failures.push('duplicate identities');for(const e of recipe.graph.edges)if(!ids.has(e.from)||!ids.has(e.to))failures.push('dangling edge '+e.from+' -> '+e.to);
 for(const o of recipe.envelope.openings){if(!recipe.graph.edges.some(e=>e.from===o.id&&e.to===o.wallId&&e.type==='voids'))failures.push('unhosted opening '+o.id);if(!recipe.graph.edges.some(e=>e.from===(o.fillId??o.doorId)&&e.to===o.id&&e.type==='fills'))failures.push('unfilled door opening '+o.id);}
 let localRoutes=0;for(const f of recipe.circulation.floors)for(const room of f.rooms){if(!routeInMother(recipe,f.corridor,room).found)failures.push('room disconnected '+room);localRoutes++;for(const stair of f.stairEntries??[f.landing])if(stair&&!routeInMother(recipe,room,stair).found)failures.push('stair disconnected '+room);}
 const wholeEntry=recipe.caseId==='lowrise'?recipe.circulation.floors.flatMap(f=>f.rooms).every(id=>routeInMother(recipe,recipe.circulation.entry,id).found):null;
 if(wholeEntry===false)failures.push('building entry disconnected');return{passed:failures.length===0,failures,localRoomRoutes:localRoutes,wholeBuildingEntryVerified:wholeEntry,geometryClearanceVerified:false,structuralCertification:false,fireComplianceVerified:false};
}
/** Horizontal and vertical are a shared dependency recipe, not floor-count guesses.
 * Case evidence may supply a structural grid; unknown structure is not fabricated. */
export function growBuilding(seed,parameters={}){
 if(!seed||!['lowrise','kcc','warehouse'].includes(seed.caseId))throw Error('Known source building required');
 if(seed.model?.buildingMother)throw Error('Regenerate from retained seed, not prior generated output');
 if(parameters.floorCount!==undefined||parameters.floorHeights!==undefined||parameters.buildingHeight!==undefined)throw Error('Actual storeys/heights cannot be overridden by inspection parameters');
 const {caseId,source}=seed,inspection=parameters.inspectionFloor!==undefined;if(inspection&&caseId!=='kcc')throw Error('Observed floor inspection currently KCC only');
 if(!inspection&&!seed.model)throw Error('Retained building seed required');
 const id=seed.model?.sourceModelId??source?.sourceModelId??KCC_ID,levels=clone(seed.model?.levels??[]),timeline=[];
 const datum={localZero:fact(0,'coordinate_reference_not_confirmed_site_datum'),actualSiteDatum:unknown('Survey datum relation not independently established'),sourceBounds:clone(source?.bounds??null)};timeline.push(stage('datum',[],datum));
 const belowGround={foundation:unknown('Foundation type/depth not observed; not the same as absent'),basement:unknown('Basement existence/depth requires separate evidence'),generated:false};timeline.push(stage('belowGround',['datum'],belowGround));
 let prepared=null,layouts=[];
 if(caseId==='lowrise')prepared=deriveFloorMother(seed.model,parameters.dimensions??{});
 if(caseId==='kcc')layouts=Array.from({length:22},(_,i)=>observedFloor(i+5));
 const horizontal=prepared?{system:'authored_frame_and_room_boundary_recipe',evidence:'authored_not_surveyed',columnPoints:clone(prepared.columnPoints),beamPairs:clone(prepared.beamPairs),outline:clone(prepared.outline)}:{system:'unknown_structural_system',evidence:'unknown',planFamilies:caseId==='kcc'?['5–17/F','18–26/F']:[],columnPoints:null,beamPairs:null};
 if(parameters.bays){if(parameters.frameGrid)throw Error('Choose bays or explicit grid, not both');parameters={...parameters,frameGrid:mergeBays(parameters.bays)};}
 if(parameters.frameGrid){if(!prepared)throw Error('No authorized structural grid evidence for this case');const grid=parameters.frameGrid;if(!Array.isArray(grid.points)||!grid.points.length||grid.points.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v)))||grid.spans.some(pair=>pair.length!==2||pair.some(i=>!Number.isInteger(i)||i<0||i>=grid.points.length)))throw Error('Invalid explicit design grid');horizontal.columnPoints=clone(grid.points);horizontal.beamPairs=clone(grid.spans);prepared.columnPoints=clone(grid.points);prepared.beamPairs=clone(grid.spans);}
 timeline.push(stage('horizontal',['datum','belowGround'],horizontal));
 const vertical={retainedLevels:levels,actualAboveGroundStoreys:caseId==='kcc'?fact(28,'owner_building_information'):caseId==='lowrise'?fact(2,'official_source_attribute'):unknown('Retained warehouse levels are not asserted as all actual levels'),observedPlanFloors:layouts.map(l=>l.floorLabel),unknownPlanFloors:caseId==='kcc'?[0,1,2,3,4,27]:[],actualIndoorFFLVerified:false};timeline.push(stage('vertical',['horizontal'],vertical));
 const supportProgram=prepared?compileSupportProgram({root:seed.model.graph.nodes[0].id,levels,grid:{points:horizontal.columnPoints,spans:horizontal.beamPairs},foundation:{status:'unknown'}}):null;if(prepared)prepared.growthProgram=supportProgram;
 const topology=prepared?lowriseTopology(prepared,levels,id):caseId==='kcc'?kccTopology(layouts):{graph:{nodes:[{id,type:'building'}],edges:[]},floors:[],hosts:[],openings:[],entry:null,core:null};
 const circulation={floors:topology.floors,entry:topology.entry,core:topology.core,globalEntryRouteStatus:caseId==='kcc'?'unknown_ground_and_vertical_connection':'authored_inspection_route',liftSafetyOperationVerified:false};timeline.push(stage('circulation',['vertical'],circulation));
 // Source-supported glazing observations remain floor-unregistered; the same
 // source object owns the opening candidate and its generated infill relationship.
 for(const f of seed.openingEvidence?.fields??[]){if(f.sourceModelId!==id)continue;const host=id+':source-host:'+f.sourcePatchId,opening=id+':observed-opening:'+f.id,infill=opening+':glazing';if(!topology.graph.nodes.some(n=>n.id===host)){topology.graph.nodes.push({id:host,type:'source_wall_surface',sourcePatchId:f.sourcePatchId,evidence:'observed_source_surface_not_thick_wall'});topology.hosts.push({id:host,floorId:null});}topology.graph.nodes.push({id:opening,type:'opening_candidate',floorId:null,evidence:'observed_polygon_plus_authored_infill'},{id:infill,type:'glazing_candidate',actualType:null});topology.graph.edges.push({from:opening,to:host,type:'voids',evidence:'authored_host_cut_not_surveyed'},{from:infill,to:opening,type:'fills'});topology.openings.push({id:opening,wallId:host,fillId:infill,floorId:null,sill:unknown('Not a universal0.6m threshold'),observationId:f.id});}
 const envelope={hosts:topology.hosts,openings:topology.openings,windowPolicy:'source-supported host openings only; sill is per-opening variable, no universal0.6m',observedWindowFields:clone(seed.openingEvidence?.fields??[])};timeline.push(stage('envelope',['circulation'],envelope));
 const roof={sourcePatchIds:(source?.patches??[]).filter(p=>p.sourceKind==='roofPlane').map(p=>p.sourcePatchId),sourceGeometryPreserved:true,parapet:unknown('No universal parapet; generate only from source evidence or named inspection exception'),equipment:unknown('Tank/plant not inferred from generic building type')};timeline.push(stage('roof',['vertical','envelope'],roof));
 const recipe={schema:'kaopu.building-mother/1',caseId,buildingId:id,datum,belowGround,horizontal,vertical,circulation,envelope,roof,graph:topology.graph,supportProgram,stages:timeline.map(s=>({name:s.name,dependsOn:s.dependsOn})),parameters:clone(parameters),exceptions:caseId==='kcc'?{floor6Platforms:true,upperPlanStarts:18,registration:'unresolved_R0_R180'}:{groundEntry:true,roofClosure:'retained_source_roof'},claims:{completeActualBuilding:false,structuralCertification:false,fireComplianceVerified:false}};
 recipe.validation=validateBuildingMother(recipe);if(!recipe.validation.passed)throw Error(recipe.validation.failures.join('; '));
 let model,candidate=null;
 if(inspection){const layout=layouts.find(l=>l.floorLabel===parameters.inspectionFloor);if(!layout)throw Error('No reviewed plan for this actual floor');candidate=buildCandidateStructure({actualFloor:parameters.inspectionFloor,assumptions:{...INSPECTION_ASSUMPTIONS,...parameters.assumptions,...parameters.dimensions},doorOpen:parameters.doorOpen??0,liftOpen:parameters.liftOpen??[0,0,0],rotationCandidate:parameters.rotationCandidate??'plan-local',preparedLayout:layout});model=candidate.model;}
 else if(prepared)model=integrateCompleteFloorSystem(seed.model,source,{openingEvidence:seed.openingEvidence,preparedMother:prepared});
 else model=attachObservedLayouts(clone(seed.model));
 if(supportProgram){const present=new Set(model.graph.nodes.map(n=>n.id));for(const n of supportProgram.nodes)if(!present.has(n.id)){model.graph.nodes.push({...n,evidence:n.evidence??'authored_growth_dependency_not_surveyed'});present.add(n.id);}for(const e of supportProgram.edges)if(!model.graph.edges.some(x=>x.from===e.from&&x.to===e.to&&x.type===e.type))model.graph.edges.push({...e,evidence:'generative_support_relation_not_engineered'});}
 if(!inspection){recipe.retainedRelations=auditRetainedRelations(model);if(!recipe.retainedRelations.passed)throw Error('Retained interface relations: '+JSON.stringify(recipe.retainedRelations.failures));}
 model.buildingMother=recipe;if(candidate)candidate.model=model;return{model,recipe,candidate,validation:recipe.validation};
}

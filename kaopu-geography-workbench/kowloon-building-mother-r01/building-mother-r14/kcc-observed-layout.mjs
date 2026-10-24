/** Evidence-space observations, not metric/as-built geometry. Coordinates refer
 * to a 1414 x 1000 viewing reduction of the linked source; no source image ships.
 * Polygon boundaries are manual observations with ~3 px uncertainty. */
export const KCC_ID='B359971994401063C0';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const families={
 lower:{floors:[5,17],url:'https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152441SSHJHSQR.jpg',
 units:{A:[[194,401],[500,401],[500,600],[194,600],[183,574],[183,447]],B:[[460,600],[658,600],[658,833],[628,833],[607,850],[513,850],[495,833],[460,833]],C:[[712,600],[910,600],[910,833],[879,833],[860,850],[764,850],[744,833],[712,833]],D:[[870,401],[1176,401],[1190,446],[1190,557],[1176,575],[1176,600],[870,600]],E:[[712,183],[887,183],[920,210],[920,249],[910,266],[910,401],[712,401]],F:[[460,183],[658,183],[658,401],[460,401],[460,265],[449,249],[449,211]]},
 lifts:[rect(555,419,66,47),rect(632,419,65,47),rect(715,419,64,47)],meter:rect(786,408,39,63),stair:rect(542,511,287,88),lobby:rect(502,473,369,36),
 entries:{A:[500,502],B:[520,588],C:[851,588],D:[871,499],E:[850,415],F:[520,415]},stairEntries:[[597,511],[829,548]],platforms:[rect(659,183,52,217),rect(659,600,52,232)]},
 upper:{floors:[18,26],url:'https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152442GYWTOAVC.jpg',
 units:{A:[[179,423],[489,423],[489,621],[179,621],[169,573],[169,468]],B:[[447,621],[646,621],[646,854],[619,854],[602,870],[509,870],[484,854],[447,854]],C:[[698,621],[897,621],[897,854],[868,854],[846,870],[750,870],[727,854],[698,854]],D:[[859,423],[1165,423],[1176,458],[1176,572],[1165,585],[1165,622],[859,622]],E:[[698,206],[897,206],[909,230],[909,264],[897,286],[897,422],[698,422]],F:[[447,206],[646,206],[646,422],[447,422],[447,286],[436,265],[436,230]]},
 lifts:[rect(541,442,66,46),rect(619,442,64,46),rect(701,442,65,46)],meter:rect(775,430,38,63),stair:rect(528,535,287,86),lobby:rect(490,495,368,36),
 entries:{A:[489,522],B:[507,607],C:[837,607],D:[858,521],E:[838,438],F:[507,438]},stairEntries:[[584,535],[815,571]],platforms:[]}
};
export function observedFloor(floor){
 if(!Number.isInteger(floor))throw Error('Integer actual floor label required');
 const key=floor>=5&&floor<=17?'lower':floor>=18&&floor<=26?'upper':null;
 if(!key)return {buildingId:KCC_ID,floorLabel:floor,supported:false,reason:'No reviewed plan for this actual floor; no substitute generated'};
 const data=structuredClone(families[key]),prefix=`${KCC_ID}:observed:${floor}F`,nodes=[],edges=[];
 const node=(suffix,type,props={})=>{const id=prefix+':'+suffix;nodes.push({id,type,buildingId:KCC_ID,floorLabel:floor,evidence:'observed_plan',...props});return id;};
 const root=node('floor','floor',{actualElevation:null}),lobby=node('lobby','lobby',{polygon:data.lobby}),core=node('core','vertical_core',{registration:null});
 for(let i=0;i<3;i++){const id=node('lift-'+(i+1),'lift_interface',{polygon:data.lifts[i],equipmentIdentity:null,brand:null,servedFloors:null});edges.push({from:id,to:core,type:'belongsTo'},{from:id,to:lobby,type:'opensTo'});}
 node('meter','meter_room',{polygon:data.meter});
 for(let i=0;i<2;i++){const id=node('stair-route-'+(i+1),'stair_route_entry',{point:data.stairEntries[i],fireRating:null,threeDimensionalInterlock:null});edges.push({from:id,to:core,type:'belongsTo'},{from:id,to:lobby,type:'opensTo'});}
 for(const [label,polygon]of Object.entries(data.units)){const unit=node('unit-'+label,'dwelling',{label,polygon}),wall=node('entry-host-'+label,'entry_boundary',{wallThickness:null}),opening=node('opening-'+label,'opening',{point:data.entries[label],clearWidth:null}),door=node('door-'+label,'entry_door',{point:data.entries[label],swingVerified:false});edges.push({from:opening,to:wall,type:'voids'},{from:door,to:opening,type:'fills'},{from:opening,to:lobby,type:'opensBetween'},{from:opening,to:unit,type:'opensBetween'},{from:unit,to:root,type:'belongsTo'});}
 if(floor===6)for(let i=0;i<2;i++)node('platform-'+i,'sixth_floor_platform',{polygon:data.platforms[i]});
 for(const n of nodes.filter(n=>n.id!==root&&!edges.some(e=>e.from===n.id&&e.type==='belongsTo')))edges.push({from:n.id,to:root,type:'belongsTo'});
 return{buildingId:KCC_ID,floorLabel:floor,supported:true,family:key,sourceUrl:data.url,coordinateSpace:'source_view_pixels_1414x1000_NOT_METRES',metricScale:null,registration:{status:'unresolved_R0_R180',matrix:null},worldGeometryEnabled:false,sourceViewSize:[1414,1000],manualUncertaintyPx:3,nodes,edges,stairEnvelope:data.stair,interiorPartitionsComplete:false};
}
export function attachObservedLayouts(model){
 if(model.sourceModelId!==KCC_ID)return model;
 const result={...model,observedLayouts:{schema:'kaopu.observed-floor-layout/1',buildingId:KCC_ID,actualFloorLabels:Array.from({length:22},(_,i)=>i+5),floors:Array.from({length:22},(_,i)=>observedFloor(i+5)),missingPlanFloors:[0,1,2,3,4,27],actualAboveGroundStoreys:28,geometryPlacementComplete:false}};
 const coreId=KCC_ID+':observed:vertical-core';
 result.observedLayouts.core={id:coreId,type:'building_vertical_core',ownerBuildingId:KCC_ID,registration:null,equipmentIdentityVerified:false};
 result.observedLayouts.coreSlots=[1,2,3].map(i=>({id:coreId+':lift-slot-'+i,type:'plan_lift_slot',ownerCoreId:coreId,equipmentId:null,positionAcrossFloorFamilies:'inferred_same_row_order_not_equipment_identity'}));
 result.observedLayouts.verticalRelations=result.observedLayouts.floors.flatMap(f=>f.nodes.filter(n=>n.type==='lift_interface').map((n,i)=>({from:n.id,to:result.observedLayouts.coreSlots[i].id,type:'correspondsToPlanSlot',evidence:'inferred_repeated_plan_position',provesServedStop:false})));
 return result;
}
export function selectObserved(building,actualFloor){if(building?.buildingId!==KCC_ID)return null;return building.localModel.observedLayouts?.floors.find(f=>f.floorLabel===actualFloor)??observedFloor(actualFloor);}

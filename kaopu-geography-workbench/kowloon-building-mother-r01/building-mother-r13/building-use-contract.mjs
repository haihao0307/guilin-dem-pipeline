/** R12 usage / entrance evidence only. This module does not generate geometry,
 * change room functions, register plans, or certify any traversable route.
 * A documented building use never proves a particular door's purpose or size. */
export const BUILDING_USE_SCHEMA='kaopu.building-use-and-entrance-evidence/1';
const copy=value=>structuredClone(value);
export const BUILDING_USE_SOURCES=Object.freeze({
 lowrise:{url:'https://hk.centanet.com/estate/en/33-La-Salle-Road/2-UJFDFRSSRO',publisher:'中原地产',kind:'property_service_record',scope:'No.33 private residential building and two units; no verified interior room plan'},
 lowriseGate:{url:'https://www.oneday.com.hk/en_US/buildings/31-33-la-salle-road/',publisher:'OneDay',kind:'external_photo_reference_previously_reviewed',scope:'Shared 31–33 street boundary; not identification of the No.33 indoor entrance'},
 kccSchool:{url:'https://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/quality-assurance-framework/qr/qr-report/HKVNS_KCC.pdf',publisher:'香港教育局',kind:'official_published_school_review',scope:'Documented kindergarten address: part of G/F and 1/F; not an entrance survey or current tenancy inspection'},
 kccChamber:{url:'https://hkkcc.org.hk/about-kcc/introduction?lang=zh',publisher:'香港九龍總商會',kind:'occupant_primary_source',scope:'Chamber address on 3/F; does not identify a street door or its vertical service route'},
 kccLowerPlan:{url:'https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152441SSHJHSQR.jpg',publisher:'中原地产',kind:'previously_reviewed_plan_reference',scope:'5–17/F plan family; no metric/source-shell registration'},
 kccUpperPlan:{url:'https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152442GYWTOAVC.jpg',publisher:'中原地产',kind:'previously_reviewed_plan_reference',scope:'18–26/F plan family; no metric/source-shell registration'},
 warehouse:{url:'https://sourcing.hktdc.com/en/Supplier-Store-Directory/China-Travel-Hip-Kee-Godown-Hong-Kong-Ltd/1X02QI7B',publisher:'香港貿易發展局',kind:'business_directory_record',scope:'Godown No.2, G/F, 1 Cheong Hang Road and logistics/warehousing category; not every floor, door or vehicle route'},
});
const ids={lowrise:'B367642137201063C0',kcc:'B359971994401063C0',warehouse:'B369121858401063C0'};
const record=(statement,sourceKeys,extra={})=>({statement,status:'documented_use_not_as_built_room_or_door_survey',sourceKeys,...extra});
const specs={
 lowrise:{
  label:'喇沙利道33號',useLabel:'私人住宅（资料用途）',buildingUse:'private_residential',
  facts:[record('33号为私人住宅，资料列一幢、两户。',['lowrise'],{documentedBuildingCount:1,documentedUnitCount:2})],
  floorUseEvidence:[],
  roomPolicy:{actualRoomLayoutVerified:false,roomNamesAreDesignAssumptions:true,appliesTo:['卧室 A','卧室 B','书房','卫浴 / 洗衣','起居室','厨房','餐厅','入口厅 / 连续走廊'],labelPrefix:'设计假设 · ',unknown:['actual_unit_boundaries','room_uses_and_partition_positions','shared_vs_private_internal_circulation']},
  entranceRoles:[
   {key:'house',role:'personnel',label:'住宅人员入口（设计假设）',existingModelSlot:'entry',actualRoleEvidence:'unknown',sourceKeys:[]},
   {key:'shared-site-gate',role:'shared_site_boundary',label:'31–33共用街门（角色有照片，位置和尺寸为假设）',existingModelSlot:'sharedGate',actualRoleEvidence:'shared_boundary_gate_observed_not_No33_indoor_door',inferredRole:'vehicular_appearance_not_sole_pedestrian_access_verified',sourceKeys:['lowriseGate']},
   {key:'service-unknown',role:'service',label:'后门 / 服务门（是否存在及门位待核）',existingModelSlot:null,actualRoleEvidence:'unknown',sourceKeys:[]}
  ],
  keyCaution:'私人住宅用途不证明当前七房间布局；共用街门不等于33号室内门。',
 },
 kcc:{
  label:'龍總大廈',useLabel:'混合用途：住宅平面、幼稚园、商会',buildingUse:'mixed_use',
  facts:[record('资料分别支持住宅平面、幼稚园与商会用途，不能将整幢一律称为住宅。',['kccSchool','kccChamber','kccLowerPlan','kccUpperPlan'])],
  floorUseEvidence:[
   record('地下部分及一楼：幼稚园资料地址。',['kccSchool'],{actualFloorLabels:['G/F (part)','1/F'],use:'kindergarten',sourceDocumentPage:1}),
   record('三楼：香港九龍總商會地址。',['kccChamber'],{actualFloorLabels:['3/F'],use:'chamber_office'}),
   record('已核对的住宅平面资料为5–17/F及18–26/F；未配准到外壳。',['kccLowerPlan','kccUpperPlan'],{actualFloorLabels:Array.from({length:22},(_,i)=>(i+5)+'/F'),use:'residential_plan_evidence',worldRegistrationVerified:false}),
  ],
  roomPolicy:{actualWholeBuildingRoomLayoutVerified:false,authoredPAndTFloorIdsAreNotActualFloorLabels:true,unreviewedPlanFloors:['G/F','1/F','2/F','3/F','4/F','27/F'],actualFloorElevationsVerified:false},
  entranceRoles:[
   {key:'podium-design',role:'personnel',label:'裙房人员入口（设计假设，实际服务对象待核）',existingModelSlot:'entry',actualRoleEvidence:'unknown',sourceKeys:[]},
   {key:'school-unknown',role:'personnel',label:'幼稚园出入口（门位及是否独立待核）',existingModelSlot:null,actualRoleEvidence:'unknown',sourceKeys:['kccSchool']},
   {key:'residential-unknown',role:'personnel',label:'住宅大堂入口（门位及接驳待核）',existingModelSlot:null,actualRoleEvidence:'unknown',sourceKeys:['kccLowerPlan','kccUpperPlan']},
   {key:'service-unknown',role:'service',label:'服务出入口（是否存在及门位待核）',existingModelSlot:null,actualRoleEvidence:'unknown',sourceKeys:[]}
  ],
  keyCaution:'用途按已证层段呈现；不得把P/T设计层号等同实际楼层，也不得把设计入口视为幼稚园或住宅实门。',
 },
 warehouse:{
  label:'香港中旅協記貨倉第二倉',useLabel:'物流 / 仓储（资料用途）',buildingUse:'warehousing_logistics',
  facts:[record('商贸目录将第二仓地址列为暢行道1號地下，业务为物流 / 仓储。',['warehouse'],{address:'1 Cheong Hang Road',documentedAddressFloor:'G/F',doesNotProveAllFloorUses:true})],
  floorUseEvidence:[],
  roomPolicy:{residentialRoomTemplateApplicable:false,actualStoragePartitionsVerified:false,actualLoadingAndLiftLayoutVerified:false},
  entranceRoles:[
   {key:'personnel',role:'personnel',label:'人员门（设计接口，实门待核）',existingModelSlot:'entry',actualRoleEvidence:'unknown',sourceKeys:[]},
   {key:'vehicle',role:'vehicle',label:'车辆至装卸区（设计接口，车型和实路待核）',existingModelSlot:'loading',actualRoleEvidence:'unknown',sourceKeys:[]},
   {key:'freight',role:'goods',label:'货物转运 / 货梯口（设计接口，非车辆通行证明）',existingModelSlot:'freight',actualRoleEvidence:'unknown',sourceKeys:[]},
   {key:'service-unknown',role:'service',label:'服务门（是否存在及门位待核）',existingModelSlot:null,actualRoleEvidence:'unknown',sourceKeys:[]}
  ],
  keyCaution:'仓库不等于每扇门均供货车通行；人员、车辆、装卸及货物转运应分开，真实门位、净空及车型仍待核。',
 },
};
export function getBuildingUseContract(caseId){
 if(!Object.hasOwn(specs,caseId))throw Error('Known building case required');
 const spec=copy(specs[caseId]);
 const sourceKeys=[...new Set([...spec.facts,...spec.floorUseEvidence,...spec.entranceRoles].flatMap(x=>x.sourceKeys))];
 return{schema:BUILDING_USE_SCHEMA,caseId,buildingId:ids[caseId],...spec,sources:Object.fromEntries(sourceKeys.map(key=>[key,copy(BUILDING_USE_SOURCES[key])])),
  evidenceBoundary:'Building use does not establish a room plan, door function, current operational access, equipment identity, or traversable route.',
  actualEntranceSurveyComplete:false,actualRoomSurveyComplete:false,currentOccupancyInspected:false,geometryChanged:false,entranceRoleLabelsAreNotActualDoorInventory:true,
  serviceAccess:{existence:null,location:null,notGenerated:true},
  clearancePolicy:{actualClearWidthM:null,actualClearHeightM:null,actualDoorThresholdM:null,actualVehicleEnvelope:null,actualTurningOrSweptPath:null,actualLoadingFloorHeights:null,actualFreightStopSchedule:null,truckAccessVerified:false,inferFromBuildingUse:false},
 };
}
function designReference(model,role){
 const source=role.existingModelSlot==='freight'?model.interfaces?.lifts?.find(l=>l.evidence?.includes('freight')||l.label?.includes('货运')):role.existingModelSlot?model[role.existingModelSlot]:null;
 if(!source)return null;
 const isFreight=role.existingModelSlot==='freight';
 const id=role.existingModelSlot==='loading'?(source.entryId??source.id):source.id;
 return{modelNodeId:id??null,sourceSlot:role.existingModelSlot,evidence:'existing_authored_design_not_as_built',
  designRoughOpeningWidthM:isFreight?model.config?.freightDoorWidth??null:source.width??null,
  designRoughOpeningHeightM:isFreight?model.config?.freightDoorHeight??null:source.height??null,
  dimensionsAreActualClearance:false,actualPositionVerified:false,actualRouteVerified:false,
  designFloorIds:isFreight?[...(source.servedFloorIds??source.stops?.map(s=>s.floorId)??[])]:source.floorId?[source.floorId]:[],
  actualServedFloors:null,
 };
}
/** Returns a shallow model wrapper. All existing geometry and graph references
 * are retained byte-for-byte; evidence/role metadata lives in usageRelations. */
export function attachUsageRelations(model){
 if(!model||!Object.hasOwn(ids,model.caseId)||model.sourceModelId!==ids[model.caseId])throw Error('Matching known source building required');
 const contract=getBuildingUseContract(model.caseId);
 contract.entranceRoles=contract.entranceRoles.map(role=>({...role,
  designReference:designReference(model,role),
  actual:{exists:role.key==='shared-site-gate'?true:null,position:null,clearWidthM:null,clearHeightM:null,thresholdM:null,operatingMechanism:null,trafficPermission:null,photoRegistered:false},
 }));
 contract.relationships=contract.entranceRoles.filter(role=>role.designReference).map(role=>({from:role.designReference.modelNodeId,to:contract.buildingId,relation:'authoredRoleForBuilding',role:role.role,evidence:'design_not_as_built',actualRouteVerified:false}));
 if(model.caseId==='warehouse'){
  contract.designFlow={personnel:'personnel door → personnel circulation',vehicle:'vehicle interface → loading area only',goods:'loading area → goods transfer → DESIGN freight interface',vehicleStopsBeforeFreightDoor:true,vehicleRouteThroughPersonnelStairs:false,actualRouteVerified:false};
 }
 return{...model,usageRelations:contract};
}

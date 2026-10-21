/** Source-backed case identity and use rules, separate from shape and rendering. */
const ROOT='../../hk-three-buildings-r01/geometry/';
export const CASE_PROFILES=[
 {id:'lowrise',modelId:'B367642137201063C0',name:'喇沙利道33號',subtitle:'低层住宅 · 原有复杂屋面',use:'residential',scoreUrl:ROOT+'B367642137201063C0.score.json',ledger:'./sources/33-lasalle-evidence.json',
  storeys:{record:2,labels:['G/F','1/F'],status:'official_record_and_property_grid',appliesTo:'single_source_building_not_combined_31_33_site'},
  known:['官方记录2层；G/F与1/F有资料佐证','现有模型完整复杂屋面保留，不压平成盒子','照片上的31–33为共用街门，不等于独立室内入口'],
  unknown:['室内平面、楼梯位置与电梯有无','后门/服务门是否存在','窗扇开启方式及窗框实测进深'],
  rules:{floorOwnership:'two_stable_storeys',publicEntrance:'shared_site_gate_observed_not_internal_entrance',corePolicy:'unknown_no_invented_lift',roofPolicy:'all_observed_surface_patches',doorPolicy:'separate_site_and_house_entrances'},
  sourceUrls:['https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0/query?where=GeoRefNo%3D%273676421372%27&outFields=%2A&returnGeometry=false&f=json','https://hk.centanet.com/estate/en/33-La-Salle-Road/2-UJFDFRSSRO']},
 {id:'kcc',modelId:'B359971994401063C0',name:'龍總大廈',subtitle:'上部塔楼 · 裙房为另一对象',use:'mixed_residential_chamber_podium',scoreUrl:ROOT+'B359971994401063C0.score.json',ledger:'./sources/kcc-evidence.json',
  storeys:{towerRecord:24,podiumRecord:4,podiumBasementRecord:1,ownerWholeBuildingStatement:28,status:'different_component_and_owner_scopes_do_not_add_blindly'},
  known:['官方上部24层；业主描述全楼28层，裙房与塔楼分属','5–17/F、18–26/F公开平面：A–F六户、3部电梯、中央楼梯关系','电梯归属核心筒，并通过停靠关系关联楼层，不归某一层独占'],
  unknown:['公开图未提供可校准尺度或绘制日期','精确层高、窗框深度、五金开启方式','住宅主入口、后门与服务门的完整对应'],
  rules:{floorOwnership:'tower_and_podium_kept_separate',planFamilies:[{labels:'5–17/F',units:['A','B','C','D','E','F'],liftCount:3},{labels:'18–26/F',units:['A','B','C','D','E','F'],liftCount:3}],corePolicy:'three_plan_observed_lifts_owned_by_core',doorPolicy:'chamber_signed_entrance_not_assumed_residential_lobby',interiorCoordinates:'unknown_not_inferred_from_reference_plan_pixels'},
  sourceUrls:['https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0/query?where=GeoRefNo%3D%273599719944%27&outFields=%2A&returnGeometry=false&f=json','https://hkkcc.org.hk/about-kcc/introduction?lang=zh','https://hk.centanet.com/estate/en/Kowloon-Chamber-Of-Commerce-Building/2-MDZSTHZAHN']},
 {id:'warehouse',modelId:'B369121858401063C0',name:'香港中旅協記貨倉第二倉',subtitle:'上部仓库 · 原数据屋面为平面',use:'warehouse',scoreUrl:ROOT+'B369121858401063C0.score.json',ledger:'./sources/warehouse-evidence.json',
  storeys:{towerRecord:12,podiumRecord:2,podiumBasementRecord:2,status:'raw_component_counts_not_a_verified_total',historicalDescription:'G/F + 1–12/F + two basements + local cocklofts; source/date scope separate'},
  known:['官方上部12层，底部另列2层及2层地下，不直接相加','原模型主要屋面是水平面；旧“斜屋面”分类不再沿用','历史资料区分较宽车辆入口与较窄人员入口'],
  unknown:['完整内部平面、楼梯与货梯核心筒位置','每层精确高度及局部夹层范围','外墙窗洞/卷闸的实测尺寸与构造深度'],
  rules:{floorOwnership:'tower_podium_basements_and_cocklofts_separate',entrancePolicy:'vehicle_and_personnel_routes_distinct',corePolicy:'freight_lift_count_not_mapped_broker_number_not_verified_layout',roofPolicy:'all_measured_flat_planes_and_high_strip_preserved',interiorPolicy:'open_storage_use_does_not_prove_column_grid'},
  sourceUrls:['https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0/query?where=GeoRefNo%3D%273691218584%27&outFields=%2A&returnGeometry=false&f=json']}
];
export function profileFor(id){const p=CASE_PROFILES.find(p=>p.id===id);if(!p)throw Error('Unknown source case '+id);return structuredClone(p);}
export function deriveCaseRelations(id){const p=profileFor(id),building={id:p.modelId,type:'building-part',use:p.use,evidence:'source_identified',geometryEvidence:'observed_derived_surface',interiorMetricEvidence:'unknown'};const nodes=[building],edges=[];
 if(id==='lowrise')for(const [i,label]of p.storeys.labels.entries()){const node={id:p.modelId+':storey:'+label,type:'storey',label,elevationM:null,evidence:'recorded_label_unknown_metric_elevation'};nodes.push(node);edges.push({type:'ownedBy',from:node.id,to:building.id});}
 if(id==='kcc'){const core={id:p.modelId+':core:plan-family',type:'core',metricPlacement:null,evidence:'public_plan_relationship_not_measured_geometry'};nodes.push(core);edges.push({type:'ownedBy',from:core.id,to:building.id});for(let i=1;i<=3;i++){const lift={id:core.id+':lift:'+i,type:'lift-interface',servedFloorIds:null,stopElevations:null,physicsEnabled:false,evidence:'public_plan_symbol_count'};nodes.push(lift);edges.push({type:'ownedBy',from:lift.id,to:core.id});}for(const family of p.rules.planFamilies){const node={id:building.id+':plan:'+family.labels,type:'plan-family',labels:family.labels,unitLabels:family.units,evidence:'drawing_observed',metricScaleKnown:false};nodes.push(node);edges.push({type:'referencesCore',from:node.id,to:core.id});}}
 if(id==='warehouse')for(const purpose of ['vehicle-entry','personnel-entry','freight-interface']){const node={id:building.id+':'+purpose,type:purpose,metricPlacement:null,connectedTo:null,evidence:purpose==='freight-interface'?'function_requires_research':'historical_description',enabledGeometry:false};nodes.push(node);edges.push({type:'ownedBy',from:node.id,to:building.id});}
 return {caseId:id,nodes,edges,sourceVersion:'2026-10-21 research / CSDI feature DateStamp 2020-09-09, not survey date',actualInteriorComplete:false,generatedCoordinatesForUnknowns:false};}

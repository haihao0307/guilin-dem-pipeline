// Source semantics only. Do not infer a lamp, port or road from an unlabeled mesh.
const FACILITIES=Object.freeze({'Elevated road/Flyover':['elevated_road','高架道路 / 天桥'],'Bridge':['bridge','桥（源未进一步细分）'],'Footbridge':['footbridge','人行桥'],'Tunnel/Subway':['tunnel_subway','隧道 / 地下通道'],'Railway':['railway','铁路设施'],'Tunnel portal':['tunnel_portal','隧道口'],'Highway':['highway','Highway（源分类）']});
export const SOURCE_FACILITY_COUNTS=Object.freeze({'Elevated road/Flyover':201,'Bridge':156,'Footbridge':151,'Tunnel/Subway':89,'Railway':17,'Tunnel portal':2,'Highway':1});
export function classifySourceModel(score){
 const type=score.modelType,subtype=score.subtype||'unknown';if(type==='B')return {category:'building',label:'建筑',sourceSubtype:subtype,placement:'official_observed_geometry',historicStatus:'separate_age_evidence_required'};
 const known=FACILITIES[subtype];return {category:known?.[0]||'unclassified_facility',label:known?.[1]||'设施（语义未分类）',sourceSubtype:subtype,placement:'official_observed_geometry',historicStatus:'年代另核；现代数据更新不代表1997前存在'};
}
export const CLASSIFICATION_GAPS=Object.freeze({streetlights:'应纳入独立可编辑对象；本批没有独立路灯语义，位置/年代待来源提取，未布点也未烘进照片',portsPiers:'码头/港口独立语义及年代待补，不从楼壳猜测',groundRoads:'当前道路设施类型不等于完整地面道路网络；1997前道路来源待补',authoredStoryObjects:'用户已定架空线路、站、桥属于作品设定，保持独立，不按政府建筑/设施的年代证据自动删除'});

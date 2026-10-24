/** Independently read perimeter glazing/opening symbols in the two linked plans.
 * This module contains authored coordinate observations, NOT the source images.
 * No cardinal orientation, metre scale, elevation, sash type or as-built status
 * is established. Never register these directly onto the photographed tower.
 */
export const KCC_WINDOW_EVIDENCE_BUILDING_ID='B359971994401063C0';
const w=(id,unit,edgeIndex,a,b,room,visualSignature)=>({
 id,unit,hostWallId:`unit:${unit}:edge-${edgeIndex}`,hostEdgeIndex:edgeIndex,
 sourceSegment:[a,b],hostProjectedSegment:[a,b],room,
 evidence:'observed_perimeter_window_symbol_in_named_floorplan',
 visualSignature,manualUncertaintyPx:3,
 windowType:null,sashCount:null,operation:null,sillHeightM:null,heightM:null,widthM:null,
 frameMaterial:null,airConditionerEvidence:false,worldFace:null
});
const slit='A light thin-line gap interrupts a heavy exterior wall beside a labelled bedroom; retain the two bedroom gaps separately and do not bridge their solid dividing wall.';
const band='Thin parallel lines replace the heavy exterior-wall band beside a labelled living/dining room; endpoints stop at solid crosswalls.';
export const KCC_OBSERVED_WINDOW_FAMILIES={
 lower:{floorRange:[5,17],sourceUrl:'https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152441SSHJHSQR.jpg',originalPixelSize:[3308,2339],sourceViewSize:[1414,1000],windows:[
  w('lower-F-living-side','F',3,[460,323],[460,398],'客飯廳',band),
  w('lower-E-living-side','E',4,[910,323],[910,398],'客飯廳',band),
  w('lower-B-living-side','B',7,[460,603],[460,714],'客飯廳',band),
  w('lower-C-living-side','C',1,[910,603],[910,714],'客飯廳',band),
  w('lower-A-bedroom-upper','A',4,[183,456],[183,477],'睡房',slit),
  w('lower-A-bedroom-lower','A',4,[183,506],[183,541],'睡房',slit),
  w('lower-D-bedroom-upper','D',2,[1190,468],[1190,498],'睡房',slit),
  w('lower-D-bedroom-lower','D',2,[1190,523],[1190,543],'睡房',slit)
 ]},
 upper:{floorRange:[18,26],sourceUrl:'https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152442GYWTOAVC.jpg',originalPixelSize:[3308,2340],sourceViewSize:[1414,1000],windows:[
  w('upper-F-living-side','F',3,[447,345],[447,420],'客飯廳',band),
  w('upper-E-living-side','E',4,[897,345],[897,420],'客飯廳',band),
  w('upper-B-living-side','B',7,[447,624],[447,737],'客飯廳',band),
  w('upper-C-living-side','C',1,[897,624],[897,737],'客飯廳',band),
  w('upper-A-bedroom-upper','A',4,[169,488],[169,504],'睡房',slit),
  w('upper-A-bedroom-lower','A',4,[169,528],[169,557],'睡房',slit),
  w('upper-D-bedroom-upper','D',2,[1176,479],[1176,521],'睡房',slit),
  w('upper-D-bedroom-lower','D',2,[1176,545],[1176,562],'睡房',slit)
 ]}
};
export function observedWindowsForFloor(actualFloor){
 if(!Number.isInteger(actualFloor))throw Error('Integer actual floor label required');
 const family=actualFloor>=5&&actualFloor<=17?'lower':actualFloor>=18&&actualFloor<=26?'upper':null;
 if(!family)return{supported:false,actualFloor,windows:[],reason:'No reviewed source plan for this floor'};
 return{supported:true,actualFloor,family,buildingId:KCC_WINDOW_EVIDENCE_BUILDING_ID,
  coordinateSpace:'source_view_pixels_1414x1000_NOT_METRES',
  ...structuredClone(KCC_OBSERVED_WINDOW_FAMILIES[family]),
  countCompleteness:'partial_observation_not_total_window_count',
  registration:{status:'unresolved_R0_R180',matrix:null},
  geometryEvidence:'plan_symbols_only_candidate_heights_and_scale_must_be_explicit_assumptions'};
}
export const KCC_WINDOW_FAMILY_DIFFERENCE={
 evidence:'independently_viewed_both_source_plans',
 lower:'B/C plan-bottom bedroom boundary contains separated thin-line glazing/opening symbols.',
 upper:'The corresponding B/C plan-bottom boundary is drawn heavy and solid; visible thin-line openings occur on outer side boundaries instead.',
 rule:'Do not copy all lower-family windows to upper floors. Each recorded interval was traced independently; the list remains incomplete.'
};

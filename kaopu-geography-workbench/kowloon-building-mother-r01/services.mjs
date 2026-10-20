/** Project-specific planning interface, NOT installed lift/stair equipment. */
export function deriveServiceInterfaces(floorState){
 if(floorState?.schema!=='kaopu.assumed-floor-slab-stack/0.1')throw Error('Validated floor state required');
 const core=floorState.serviceCoreVolume,active=floorState.floors.filter(f=>f.effectiveEnabled);
 const shaftId=`${floorState.objectId}:proposed-service-reserve`;
 if(!core.enabled||!core.footprintLoop)return {schema:'kaopu.service-interface-proposal/0.1',enabled:false,servedFloorIds:[],stops:[],circulationComplete:false,reason:'No reserved vertical volume; no lift or stair is inferred.'};
 const loop=core.footprintLoop,east=Math.max(...loop.map(p=>p[0])),north=(Math.min(...loop.map(p=>p[1]))+Math.max(...loop.map(p=>p[1])))/2;
 const stops=active.map(f=>({id:`${shaftId}:stop:${f.floorId}`,floorId:f.floorId,slabId:f.slabId,fflM:f.fflM,positionLocalEastUpSouth:[east,f.fflM,-north],doorInterfaceId:`${shaftId}:landing-interface:${f.floorId}`,doorSide:'east-authored-proposal',actualLandingDoorModeled:false,doorSafetyVerified:null,doorState:'unmodeled',navigationConnectionEnabled:false,evidence:'authored_stop_proposal_not_observed_or_derived_from_crossing_alone'}));
 return {schema:'kaopu.service-interface-proposal/0.1',enabled:floorState.enabled,shaftId,shaftReserve:structuredClone(core),servedFloorIds:stops.map(s=>s.floorId),stops,car:{modeled:false,position:null,currentStopId:null},stairs:{modeled:false,walkPath:null},fireFightingVerified:null,accessibleVerified:null,evacuationPermitted:false,circulationComplete:false,warning:'Reserved openings and aligned stop interfaces are not a functioning lift or stair. No navigation or evacuation connection is enabled.'};
}

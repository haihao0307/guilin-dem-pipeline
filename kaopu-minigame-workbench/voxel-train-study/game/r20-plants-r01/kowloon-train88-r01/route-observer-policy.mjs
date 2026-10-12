// Presentation-only coordinates. None of these values is a Session distance.
// The host applies its same first-station presentation filter to both domains,
// retaining the original attendant and stopping marker under native Kowloon.
export const ROUTE_OBSERVER_POLICY=Object.freeze({maxDomains:1,maxStations:2,stationIndices:Object.freeze([0,1])});

export function observerSamplingFrame(realDistance,centerX,spec){
  if(!Number.isFinite(realDistance)||!Number.isFinite(centerX)||!Number.isFinite(spec?.centerX)||!(spec.terrainRadius>0))throw Error('Finite observer and authoritative distance required');
  const shiftX=centerX-spec.centerX;
  return Object.freeze({realDistance,centerX,shiftX,samplingChainage:realDistance+shiftX,
    minX:centerX-spec.terrainRadius,maxX:centerX+spec.terrainRadius,
    hostMinX:spec.centerX-spec.terrainRadius,hostMaxX:spec.centerX+spec.terrainRadius});
}

export function observerNeeded(enabled,frame){
  return !!enabled&&(frame.centerX<frame.hostMinX||frame.centerX>frame.hostMaxX);
}

export function observerLocalExclusions(boxes,shiftX){
  if(!Number.isFinite(shiftX))throw Error('Finite observer translation required');
  return boxes.map(box=>{
    if(!['minX','maxX','minZ','maxZ'].every(key=>Number.isFinite(box[key]))||box.minX>box.maxX||box.minZ>box.maxZ)throw Error('Finite scenery exclusion required');
    return {...box,minX:box.minX-shiftX,maxX:box.maxX-shiftX};
  });
}

export function observerStationPlans(view,route,frame,platform,hostIndices=new Set()){
  const nearby=new Map((view.nearbyStations||[]).map(plan=>[plan.index,plan]));
  return route.filter(plan=>ROUTE_OBSERVER_POLICY.stationIndices.includes(plan.index)&&!hostIndices.has(plan.index)
    &&plan.target-view.distance+5>=frame.minX&&plan.target-view.distance+platform.minX<=frame.maxX)
    .map(plan=>nearby.get(plan.index)||plan).slice(0,ROUTE_OBSERVER_POLICY.maxStations);
}

// Same global source tile, regardless of which presentation window samples it:
// sourceX + centerX + tile*period - (distance+shiftX) + shiftX
// === sourceX + centerX + tile*period - distance.
export function observerSourceWorldX(sourceX,tile,frame,spec){
  return sourceX+spec.centerX+tile*spec.period-frame.samplingChainage+frame.shiftX;
}

const FLAG=Symbol.for('wenzhou.map-mother.1940s-coast-installed');
const SHEETS=['NH51-13','NG51-1','NH51-14'];

function removeLegacyVisualUi(){
  document.getElementById('history-1953-toggle')?.remove();
  document.getElementById('history-1953-layer-card')?.remove();
  document.getElementById('history-1953-style')?.remove();
}

export function installHistorical1953ControlLayer(){
  if(window[FLAG])return;
  window[FLAG]=true;
  removeLegacyVisualUi();
  document.documentElement.dataset.wenzhouHistory1953ControlIndex='true';
  document.documentElement.dataset.wenzhouHistory1953Visual='false';
  document.documentElement.dataset.wenzhouMapMotherEpoch='1940s';

  window.addEventListener('wenzhou:terrain-added',event=>{
    const {scene,terrain,patchId}=event.detail||{};
    if(!scene?.isScene||!terrain?.isMesh||!patchId)return;
    if(!terrain.userData.wenzhouMapMotherBaseAlphaMap&&terrain.material?.alphaMap){
      terrain.userData.wenzhouMapMotherBaseAlphaMap=terrain.material.alphaMap;
    }
    const state={
      schema:'wenzhou-map-mother/1940s-base-v2',
      patchId,
      crs:'EPSG:32651',
      sourceSheets:SHEETS,
      targetYear:1942,
      nearbyEraControlYear:1953,
      visualizedAsRawGuides:false,
      rawGuideLinesVisible:false,
      storage:'shared-modern-basis-plus-runtime-derived-historical-deltas',
      truthBoundary:'1953 coarse sheets are nearby-era controls, not silently promoted to exact 1942 truth. V5 performs the active land-water reconstruction.'
    };
    window.__wenzhouHistoricalControl1953={
      schema:'wenzhou-historical-control-coordinator/1953-v1',
      patchId,
      crs:'EPSG:32651',
      visualized:false,
      sourceSheets:SHEETS
    };
    window.__wenzhouMapMother1940s=state;
    const canvas=document.getElementById('terrain');
    if(canvas){
      canvas.dataset.history1953CommittedPatch=patchId;
      canvas.dataset.history1953Visualized='false';
      canvas.dataset.history1940sRawGuideLinesVisible='false';
      canvas.dataset.history1940sCoordinator='v1';
    }
    window.dispatchEvent(new CustomEvent('wenzhou:map-mother-1940s-ready',{detail:state}));
    // Compatibility signal only: no V4 module is installed. V5 still consumes
    // this historic event name until its listener is renamed in a later cleanup.
    window.dispatchEvent(new CustomEvent('wenzhou:map-mother-1940s-refined-v4',{detail:{...state,compatibilitySignalOnly:true}}));
  });
}

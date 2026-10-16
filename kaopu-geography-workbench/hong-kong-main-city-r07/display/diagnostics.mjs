// All source measurements/plans remain available; inspection overlays are opt-in.
export function installDiagnosticsUI(host,{city,toolbar}){
 const {mapState,requestFrame,qa}=host;
 const state={enabled:false};
 const label=document.createElement('label');label.className='mapDiagnosticsToggle';
 label.innerHTML='<input id="mapDiagnostics" type="checkbox">工程诊断';toolbar.append(label);
 const input=label.querySelector('input');
 function setEnabled(value){
  state.enabled=!!value;input.checked=state.enabled;document.body.classList.toggle('engineering-diagnostics',state.enabled);
  mapState.coverage=state.enabled;city.setCoverage(state.enabled);
  window.HKRouteSketchDisplay.set({newPlanning:state.enabled,showLegacy:false});
  const planning=document.getElementById('r04Planning');if(planning)planning.checked=state.enabled;
  const legacy=document.getElementById('r04Legacy');if(legacy)legacy.checked=false;
  if(state.enabled)mapState.story=true;
  qa.diagnostics={enabled:state.enabled,dataDeleted:false,physicalTrackAffected:false};
  requestFrame();return {...state};
 }
 input.onchange=()=>setEnabled(input.checked);
 const api={get enabled(){return state.enabled;},setEnabled,stats:()=>({...state,dataDeleted:false,physicalTrackAffected:false})};
 window.HKMapDiagnostics=api;setEnabled(false);return api;
}

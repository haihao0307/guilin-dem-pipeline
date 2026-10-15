// R04 planning overlays are explicitly separate from physical rail heights.
// Legacy HK data stays intact; comparisons are opt-in and do not switch trains.
export function createRouteDisplay(plan, {requestFrame=()=>{}}={}) {
 if(!Array.isArray(plan?.displayRoutes)||!plan.displayRoutes.length||!Array.isArray(plan.labels))throw Error('R04 route display requires a registered route plan');
 const clonePoint=p=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw Error('Invalid local metre X/Z planning point');return [...p];};
 const routes=plan.displayRoutes.map((r,i)=>({...r,id:r.id||'r04-plan-'+i,kind:'story',routeDisplayClass:'new_plan',points:r.points.map(clonePoint)}));
 if(routes.some(r=>r.points.length<2))throw Error('Planning route has fewer than two points');
 const labels=plan.labels.map(p=>({...p,point:clonePoint(p.point),routeDisplayClass:'new_plan'}));
 const state={newPlanning:true,showLegacy:false};
 return {
  get showLegacy(){return state.showLegacy;},
  sources(original){return [...original.map(r=>({...r,routeDisplayClass:'legacy'})),...routes];},
  labelSources(original){return [...original.map(p=>({...p,routeDisplayClass:p.kind==='story'?'legacy':'reference'})),...labels];},
  visible(r){return r.routeDisplayClass==='new_plan'?state.newPlanning:state.showLegacy;},
  labelsVisible(all){return all.filter(p=>{const yes=p.routeDisplayClass==='reference'||(p.routeDisplayClass==='new_plan'?state.newPlanning:state.showLegacy);if(!yes&&p.el)p.el.style.display='none';return yes;});},
  set({newPlanning=state.newPlanning,showLegacy=state.showLegacy}={}){state.newPlanning=!!newPlanning;state.showLegacy=!!showLegacy;requestFrame();return {...state};},
  stats(){return {...state,planningHeight:'ground-projected overlay at +10m for visibility; not rail elevation',newRouteCount:routes.length,newLabelCount:labels.length,legacySourceUnchanged:true,trainRouteUnaffectedByOverlayToggle:true};}
 };
}
export function patchRouteDisplayHost(html) {
 const pairs=[
  ['const hkRoutes=HK.routes.map(r=>({...r,mesh:routeMesh(r.points,r.kind===\'story\'?22:13,r.kind===\'story\')}));',"const hkRoutes=window.HKRouteSketchDisplay.sources(HK.routes).map(r=>({...r,mesh:routeMesh(r.points,r.routeDisplayClass==='new_plan'?6:(r.kind==='story'?22:13),r.kind==='story')}));"],
  ['const hkLabels=HK.labels.map((p,k)=>', 'const hkLabels=window.HKRouteSketchDisplay.labelSources(HK.labels).map((p,k)=>'],
  ["for(const r of hkRoutes){if(!(r.kind==='story'?mapState.story:mapState.rail))continue;", "for(const r of hkRoutes){if(!window.HKRouteSketchDisplay.visible(r)||!(r.kind==='story'?mapState.story:mapState.rail))continue;"],
  ["v3(routeProgram,'color',r.kind==='story'?[1,.48,.70]:[.3,.75,1]);", "v3(routeProgram,'color',r.routeDisplayClass==='new_plan'?[1,.82,.18]:(r.kind==='story'?[1,.48,.70]:[.3,.75,1]));"],
  ['window.HKGeographicLabels.draw(hkLabels,c,canvas,mapState,hkHeight,qa);', 'window.HKGeographicLabels.draw(window.HKRouteSketchDisplay.labelsVisible(hkLabels),c,canvas,mapState,hkHeight,qa);'],
  ['for(const m of stationMeshes){common(stationProgram,now,s,e,c);','for(const m of stationMeshes){if(!window.HKRouteSketchDisplay.showLegacy)continue;common(stationProgram,now,s,e,c);']
 ];
 for(const [a,b]of pairs){if(html.split(a).length!==2)throw Error('R04 planning host anchor not unique: '+a.slice(0,80));html=html.replace(a,b);}
 return html;
}

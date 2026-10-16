export function patchConsistRuntime(text){const patches=[
 ['w=window.HKRailVertical.create(Q8(n,s),s),A=ev({...w,points:w.renderPoints})','w=window.HKConsistSetup.routeStops(window.HKRailVertical.create(Q8(n,s),s)),A=ev({...w,points:w.renderPoints})'],
 ['y=Ap(E,{initial:{positionM:205},paused:!0})','y=Ap(window.HKConsistSetup.physicsParameters(E),{initial:{positionM:window.HKConsistSetup.startPosition(w)},paused:!0})'],
 ['I=y.reset({positionM:Math.max(25,C.d-(G==="kowloon"?0:200))})','I=y.reset({positionM:window.HKConsistSetup.reviewPosition(w,C,G)})'],
 ['I=window.HKRailVertical.stepDrive(y,w,Math.min(G,1)*W)','I=window.HKConsistSetup.stepDrive(y,w,Math.min(G,1)*W)'],
 ['I.positionM<0||I.positionM>w.length','I.boundaryGuardActive||I.positionM+window.HKConsistSetup.config.rearOffsetM<.5||I.positionM+window.HKConsistSetup.config.frontOffsetM>w.length-.5'],
 ['I.positionM>w.length-250','I.positionM+window.HKConsistSetup.config.frontOffsetM>w.length-250'],
 ['build:"HK-TRAIN88-R04",state:I','build:"HK-TRAIN88-R05",state:I'],
 ['makeTrack:ev,requestFrame:a})};async function te()', 'makeTrack:ev,requestFrame:a}),attachTrainScene:factory=>factory({THREE:fs,scene:d,renderer:h,route:w,train:m,axis:x,placement:_,requestFrame:a}),reviewChainage:G=>{if(!Number.isFinite(G)||G+window.HKConsistSetup.config.rearOffsetM<.5||G+window.HKConsistSetup.config.frontOffsetM>w.length-.5)throw Error("COMPLETE_CONSIST_OUTSIDE_ROUTE");I=y.reset({positionM:G});B=!0;k="map";H++;V();Y();a();}};async function te()']
 ];for(const[a,b]of patches){if(text.split(a).length!==2)throw Error('R05 train anchor not unique: '+a.slice(0,80));text=text.replace(a,b);}return{text,applied:['complete_consist_stop_origins','aggregate_authored_mass','r05_identity','shared_scene_train_attachment','whole_consist_dynamic_track_end_guard']};}

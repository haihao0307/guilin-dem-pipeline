import{CAMERA_MODES,NATIVE_VIEWS,computeTrainCamera}from './core.mjs';
export{CAMERA_MODES};
/** Install after the R07 tunnel/complete-consist/control bridge. Host already
 * calls trainIntegration.camera() every frame; no secondary renderer or timer.
 * The only shared adapter is a coordinated near plane for interior cameras.
 */
export function installCameraViews(host,game,{target=globalThis,config=target.HKConsistSetup?.config,tunnel=target.HKLionRockTunnelScene?.tunnel,initialMode=null,coachIndex=0}={}){
 if(!host?.requestFrame||!game?.camera||!game?.getState||!game?.setMode||!game?.route||!game?.attachTrainScene)throw Error('R08_CAMERA_HOST_API_MISSING');
 if(!config?.offsets?.length||!Number.isInteger(coachIndex)||coachIndex<0||coachIndex>=config.offsets.length)throw Error('R08_CAMERA_INVALID_CONSIST_OR_COACH');
 if(game.cameraViews?.ready)throw Error('R08_CAMERA_ALREADY_INSTALLED');
 const shared=target.HKSharedProjection;if(shared?.schema!=='hk-shared-projection/1'||!shared.frame)throw Error('R08_CAMERA_SHARED_PROJECTION_MISSING');
 const oldCamera=game.camera,oldSetMode=game.setMode,oldShared=shared;
 const captured=game.attachTrainScene(value=>value);
 if(!captured?.train?.cab?.root?.userData?.crewClearance?.eyePointCandidateM)throw Error('R08_CAMERA_ORIGINAL_CAB_DATUM_MISSING');
 const cabEye=captured.train.cab.root.userData.crewClearance.eyePointCandidateM.slice();
 const nativeViews={...NATIVE_VIEWS,cab:{eye:cabEye,target:NATIVE_VIEWS.cab.target}};
 const tunnelStats=tunnel?.stats?.(),coveredIntervals=(tunnelStats?.portals?.coveredIntervals||[]).map(v=>v.slice());
 // Roofless cuttings also have intact walls; constrain the eye inside those.
 const clearanceIntervals=tunnelStats?.renderInterval?[tunnelStats.renderInterval.slice()]:coveredIntervals;
 if(tunnel&&!tunnelStats?.portals?.resolved)throw Error('R08_CAMERA_TUNNEL_NOT_RESOLVED');
 let active=true,customActive=false,selectedCoach=coachIndex,selectedMode=null,frames=0,last=null;
 const ownCameras=new WeakSet(),modes=new Set(CAMERA_MODES.map(v=>v.id));
 const projectionFrame=(camera,context)=>{
  const result=oldShared.frame(camera,context);if(!ownCameras.has(camera))return result;
  const near=camera.r08Camera.projectionNearM;
  return Object.freeze({...result,clipNear:near,near,clipMode:camera.r08Camera.mode});
 };
 const sharedAdapter=Object.freeze({...shared,frame:projectionFrame});target.HKSharedProjection=sharedAdapter;
 const camera=()=>{
  const state=game.getState();if(!active||!customActive||!modes.has(state.mode)){last=null;return oldCamera.call(game);}
  const next=computeTrainCamera({route:game.route,positionM:state.state.positionM,mode:state.mode,config,coachIndex:selectedCoach,coveredIntervals:clearanceIntervals,nativeViews});
  ownCameras.add(next);last=next;frames++;if(host.qa)host.qa.trainCameraR08={...next.r08Camera,cam:next.cam.slice(),fw:next.fw.slice(),frames,physicsTick:state.state.tick,physicsTimeS:state.state.timeS};return next;
 };
 game.camera=camera;
 const api={ready:true,modes:CAMERA_MODES,sameRoute:game.route,sameDrive:game.drive,
  setMode(mode,{coachIndex:selected=selectedCoach}={}){
   if(!active)throw Error('R08_CAMERA_DISPOSED');if(!modes.has(mode))throw Error('CAMERA_UNKNOWN_MODE:'+mode);
   if(!Number.isInteger(selected)||selected<0||selected>=config.offsets.length)throw Error('CAMERA_INVALID_COACH_INDEX');
   customActive=true;selectedCoach=selected;selectedMode=mode;oldSetMode.call(game,mode);camera();host.requestFrame();return api.stats();
  },
  preserveSelectedView(){if(!active)throw Error('R08_CAMERA_DISPOSED');if(selectedMode!==null){oldSetMode.call(game,selectedMode);camera();host.requestFrame();}return api.stats();},
  release(mode='map'){if(!active)throw Error('R08_CAMERA_DISPOSED');customActive=false;selectedMode=mode;oldSetMode.call(game,mode);last=null;host.requestFrame();},
  stats(){return{ready:active,customActive,mode:game.getState().mode,frames,selectedMode,selectedCoachIndex:selectedCoach,coachCount:config.offsets.length,last:last?{...last.r08Camera,cam:last.cam.slice(),target:last.target.slice(),fw:last.fw.slice()}:null,coveredIntervals:coveredIntervals.map(v=>v.slice()),clearanceIntervals:clearanceIntervals.map(v=>v.slice()),fovDegrees:55,sceneMutations:0,source:'retained FH88 original cab and GrandCoach interiors',engineInteriorRoom:'same existing cab/backhead compartment; different real eye point',browserVisualAcceptance:'pending',cutaway:false};},
  dispose(){if(!active)return;active=false;if(game.camera===camera)game.camera=oldCamera;if(target.HKSharedProjection===sharedAdapter)target.HKSharedProjection=oldShared;if(game.cameraViews===api)delete game.cameraViews;host.requestFrame();}
 };
 game.cameraViews=api;if(initialMode!==null)api.setMode(initialMode);return api;
}

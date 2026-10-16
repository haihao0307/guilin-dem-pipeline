/** Camera-only R08 increment. Metres; retained native train axes X forward,
 * Y left, Z up. No geometry, materials, visibility or drive state is modified.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>{const n=Math.hypot(...a);if(!(n>1e-10))throw Error('CAMERA_SINGULAR_BASIS');return a.map(v=>v/n);};
const vec=(a,label)=>{if(!Array.isArray(a)||a.length!==3||!a.every(Number.isFinite))throw Error('CAMERA_INVALID_'+label);return a;};
const freezePose=(eye,target)=>Object.freeze({eye:Object.freeze(eye),target:Object.freeze(target)});
export const NATIVE_VIEWS=Object.freeze({
 // Cab mother's original crewClearance.eyePointCandidateM, not a fake cab.
 cab:freezePose([-7.33,.20,3.49],[-6.55,.20,3.05]),
 // The existing authored eye-view button in train-source/app.mjs, unchanged.
 'engine-interior':freezePose([-8.22,0,3.30],[-6.48,0,3.00]),
 // The existing authored passenger eye view, unchanged, in selected real coach.
 'coach-interior':freezePose([6.1,0,2.72],[-1.4,0,2.27]),
 // Fixed camera at actual last coach's rear end, facing backward along its axes.
 tail:freezePose([-11.25,0,2.40],[-35,0,2.40])
});
export const CAMERA_MODES=Object.freeze([
 Object.freeze({id:'follow',label:'低位跟车',kind:'exterior',description:'低位前侧跟车；保持原站棚，入洞沿真实线路收近'}),
 Object.freeze({id:'side',label:'车侧',kind:'exterior',description:'车侧连续跟随；入洞收至原隧道内壁以内'}),
 Object.freeze({id:'front',label:'机头正面',kind:'exterior',description:'在同线路前方回望现有机头'}),
 Object.freeze({id:'cab',label:'司机驾驶舱',kind:'interior',description:'原驾驶员眼位，看真实炉后仪表与操作件'}),
 Object.freeze({id:'engine-interior',label:'机头内部',kind:'interior',description:'同一真实驾驶/炉后操作舱的后部眼位；没有新增房间'}),
 Object.freeze({id:'coach-interior',label:'客厢内部',kind:'interior',description:'原完整客车的真实过道眼位，保留屋顶、墙与座席'}),
 Object.freeze({id:'tail',label:'车尾向后',kind:'rear-facing',description:'附着在实际末节客车的尾端，持续向后看'})
]);
export function nativeFrame(route,chainageM){
 if(!route?.sample||!Number.isFinite(chainageM))throw Error('CAMERA_INVALID_ROUTE_POSITION');
 const q=route.sample(chainageM),p=vec(q.p,'ROUTE_POINT').slice(),forward=norm(vec(q.f,'ROUTE_FORWARD'));
 // Matches R_y(-atan2(f.z,f.x)) * R_z(atan(grade)) * R_x(-PI/2).
 // route.right is the negative of native +Y. Do not mirror the cab/coach eye.
 const left=norm([forward[2],0,-forward[0]]),up=norm(cross(forward,left));
 return{p,forward,left,up,chainageM,role:q.role,actualTunnelLining:!!q.actualTunnelLining};
}
export function nativeToWorld(frame,point){vec(point,'NATIVE_POINT');return frame.p.map((v,i)=>v+point[0]*frame.forward[i]+point[1]*frame.left[i]+point[2]*frame.up[i]);}
export function cameraPose(eye,target,preferredUp=[0,1,0]){
 vec(eye,'EYE');vec(target,'TARGET');const fw=norm(sub(target,eye)),right=norm(cross(fw,preferredUp)),up=norm(cross(right,fw));
 return{cam:eye.slice(),target:target.slice(),fw,right,up,flat:norm([fw[0],0,fw[2]])};
}
export function tunnelProximity(chainages,coveredIntervals,transitionM=45){
 if(!(transitionM>0))throw Error('CAMERA_INVALID_TRANSITION');let distance=Infinity;
 for(const s of chainages)for(const[a,b]of coveredIntervals){if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)throw Error('CAMERA_INVALID_TUNNEL_INTERVAL');distance=Math.min(distance,s<a?a-s:s>b?s-b:0);}
 const t=clamp(1-distance/transitionM,0,1);return t*t*(3-2*t);
}
export function computeTrainCamera({route,positionM,mode,config,coachIndex=0,coveredIntervals=[],transitionM=45,nativeViews=NATIVE_VIEWS}){
 if(!CAMERA_MODES.some(v=>v.id===mode))throw Error('CAMERA_UNKNOWN_MODE:'+mode);
 if(!Number.isFinite(positionM)||!Number.isFinite(route?.length)||positionM<0||positionM>route.length)throw Error('CAMERA_INVALID_ENGINE_POSITION');
 if(!config||!Array.isArray(config.offsets)||!config.offsets.length)throw Error('CAMERA_MISSING_REAL_CONSIST');
 if(!Number.isInteger(coachIndex)||coachIndex<0||coachIndex>=config.offsets.length)throw Error('CAMERA_INVALID_COACH_INDEX');
 const engine=nativeFrame(route,positionM);let eye,target,vehicleChainageM=positionM,eyeChainageM=positionM,selectedCoachIndex=null,nativeEye=null,nativeTarget=null,tunnelBlend=0;
 if(nativeViews[mode]){
  if(mode==='coach-interior'||mode==='tail'){selectedCoachIndex=mode==='tail'?config.offsets.length-1:coachIndex;vehicleChainageM=positionM+config.offsets[selectedCoachIndex];}
  if(vehicleChainageM<0||vehicleChainageM>route.length)throw Error('CAMERA_VEHICLE_OUTSIDE_ROUTE');
  const vehicle=nativeFrame(route,vehicleChainageM),view=nativeViews[mode];nativeEye=view.eye.slice();nativeTarget=view.target.slice();eye=nativeToWorld(vehicle,nativeEye);target=nativeToWorld(vehicle,nativeTarget);eyeChainageM=vehicleChainageM+nativeEye[0];
 }else if(mode==='side'){
  eyeChainageM=clamp(positionM+1.1,0,route.length);tunnelBlend=tunnelProximity([positionM,eyeChainageM],coveredIntervals,transitionM);
  // At 3.1m above rail both endpoints are below the retained station canopy.
  // Only camera offset changes; the complete vehicle and lining stay visible.
  eye=nativeToWorld(nativeFrame(route,eyeChainageM),[0,-(14*(1-tunnelBlend)+3.15*tunnelBlend),3.10]);
  target=nativeToWorld(engine,[-2.9,0,2.45]);
 }else{
  const ahead=mode==='front'?config.frontOffsetM+12:config.frontOffsetM+16;
  eyeChainageM=clamp(positionM+ahead,0,route.length);tunnelBlend=tunnelProximity([positionM,eyeChainageM],coveredIntervals,transitionM);
  const lateral=mode==='front'?0:-(5.2*(1-tunnelBlend)+3.0*tunnelBlend);
  eye=nativeToWorld(nativeFrame(route,eyeChainageM),[0,lateral,mode==='front'?2.60:3.10]);
  target=nativeToWorld(engine,[mode==='front'?4.3:1.5,0,mode==='front'?2.05:2.40]);
 }
 const pose=cameraPose(eye,target);
 return{...pose,r08Camera:{schema:'hk.train-camera/1',mode,positionM,vehicleChainageM,eyeChainageM,coachIndex:selectedCoachIndex,nativeEye,nativeTarget,tunnelBlend,projectionNearM:mode==='cab'||mode==='engine-interior'||mode==='coach-interior'?.03:.15,projectionFovDegrees:55,sameRoute:true,vehicleGeometryModified:false,terrainModified:false,teleport:false}};
}

/** Authored GAME vertical alignment. No engineering safety certification.
 * Horizontal alignment, source chainage and station sequence are immutable.
 * Grade = dy / horizontal chainage, never dy / 3D distance.
 */
export const SCHEMA='kaopu.game.rail-vertical-profile/1';
export class ProfileConstraintError extends Error{constructor(code,message,details={}){super(message);this.name='ProfileConstraintError';this.code=code;this.details=details;}}
const fail=(code,message,details)=>{throw new ProfileConstraintError(code,message,details);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=(v,name)=>{if(!Number.isFinite(v))fail('NON_FINITE',`Non-finite ${name}`);return v;};
const smooth=u=>u*u*u*(10+u*(-15+6*u));
const smoothD=u=>30*u*u*(1-u)*(1-u);
const smoothDD=u=>60*u*(1-u)*(1-2*u);
const integral=u=>u*u*u*u*(2.5+u*(-3+u));
function evaluate(seg,d){
 const x=clamp(d-seg.start,0,seg.length),u=seg.length?x/seg.length:0,g=seg.grade||0;
 if(seg.kind==='flat'||seg.kind==='constantGrade')return {height:seg.height+g*x,grade:g,gradeRate:0,gradeSecond:0};
 const S=smooth(u),F=integral(u),sign=seg.kind==='gradeRampIn'?1:-1;
 return {height:seg.height+g*seg.length*(sign>0?F:u-F),grade:g*(sign>0?S:1-S),gradeRate:sign*g/seg.length*smoothD(u),gradeSecond:sign*g/(seg.length*seg.length)*smoothDD(u)};
}
export function buildVerticalProfile(length,constraints){
 finite(length,'route length');if(length<=0)fail('INVALID_LENGTH','Route length must be positive');
 const {maxGradePermille,stationMaxGradePermille,minVerticalRadiusM,preferredTransitionLengthM,minTransitionLengthM,anchors}=constraints;
 for(const [k,v]of Object.entries({maxGradePermille,stationMaxGradePermille,minVerticalRadiusM,preferredTransitionLengthM,minTransitionLengthM}))finite(v,k);
 if(maxGradePermille<=0||stationMaxGradePermille<0||stationMaxGradePermille>maxGradePermille||minVerticalRadiusM<=0||preferredTransitionLengthM<=0||minTransitionLengthM<=0)fail('INVALID_DESIGN_LIMITS','Invalid editable GAME design limits');
 if(!Array.isArray(anchors)||anchors.length<2)fail('ANCHORS_REQUIRED','Explicit vertical anchors are required');
 const anchorIds=new Set(),zones=anchors.map(a=>{
  if(anchorIds.has(a.id))fail('DUPLICATE_ANCHOR','Duplicate vertical anchor',{id:a.id});anchorIds.add(a.id);
  for(const k of['d','height','flatBeforeM','flatAfterM'])finite(a[k],`${a.id}.${k}`);
  if(a.d<0||a.d>length||a.flatBeforeM<0||a.flatAfterM<0)fail('INVALID_ANCHOR','Anchor lies outside route or has negative level zone',{anchor:a});
  return {start:Math.max(0,a.d-a.flatBeforeM),end:Math.min(length,a.d+a.flatAfterM),height:a.height,anchorIds:[a.id],types:[a.type||'fixed']};
 }).sort((a,b)=>a.start-b.start||a.end-b.end);
 if(zones[0].start!==0||zones.at(-1).end!==length)fail('ENDPOINT_ANCHORS_REQUIRED','Explicit level zones must cover both route endpoints');
 const merged=[];
 for(const z of zones){const p=merged.at(-1);if(p&&z.start<=p.end+1e-9){if(Math.abs(p.height-z.height)>1e-9)fail('OVERLAPPING_LEVEL_ZONE_HEIGHT_CONFLICT','Overlapping station/turnout/endpoint zones demand different heights',{left:p,right:z});p.end=Math.max(p.end,z.end);p.anchorIds.push(...z.anchorIds);p.types.push(...z.types);}else merged.push({...z});}
 const segments=[],transitions=[],gMax=maxGradePermille/1000,kMax=1/minVerticalRadiusM;
 const add=(kind,start,len,height,grade=0,metadata={})=>{if(len>1e-10)segments.push({kind,start,end:start+len,length:len,height,grade,...metadata});};
 for(let i=0;i<merged.length;i++){
  const zone=merged[i];add('flat',zone.start,zone.end-zone.start,zone.height,0,{anchorIds:zone.anchorIds});
  if(i===merged.length-1)continue;
  const next=merged[i+1],start=zone.end,L=next.start-start,delta=next.height-zone.height;
  if(L<=0)fail('NO_INTERSTATION_LENGTH','There is no free length between incompatible anchor zones',{left:zone,right:next});
  if(Math.abs(delta)<1e-12){add('flat',start,L,zone.height);continue;}
  // The peak of smootherstep' is exactly 1.875. k <= |d(grade)/ds|
  // is a conservative curvature gate, not a speed/vehicle safety model.
  const A=1.875*Math.abs(delta)/kMax,discriminant=L*L-4*A;
  if(discriminant<0)fail('VERTICAL_CURVATURE_INFEASIBLE','Insufficient distance for the requested height change and vertical-curve bound',{left:zone,right:next,availableM:L,heightChangeM:delta,minimumFeasibleLengthM:2*Math.sqrt(A)});
  const lower=Math.max(minTransitionLengthM,2*A/(L+Math.sqrt(discriminant))),upper=Math.min(L/2,L-Math.abs(delta)/gMax);
  if(lower>upper+1e-9)fail('GRADE_CURVATURE_CONFLICT','Fixed heights and level zones cannot satisfy the selected grade and vertical-curve limits',{left:zone,right:next,availableM:L,heightChangeM:delta,minimumTransitionM:lower,maximumTransitionM:upper,maxGradePermille});
  const R=clamp(preferredTransitionLengthM,lower,upper),peak=delta/(L-R),middle=L-2*R;
  add('gradeRampIn',start,R,zone.height,peak);
  add('constantGrade',start+R,middle,zone.height+peak*R*.5,peak);
  add('gradeRampOut',start+R+middle,R,zone.height+peak*(R*.5+middle),peak);
  transitions.push({from:zone.anchorIds,to:next.anchorIds,start,end:next.start,availableM:L,heightChangeM:delta,rampLengthM:R,constantGradeLengthM:middle,peakGradePermille:peak*1000,maxGradeRatePerM:1.875*Math.abs(peak)/R});
 }
 if(!segments.length)fail('EMPTY_PROFILE','No positive-length profile segments');
 for(let i=1;i<segments.length;i++)if(Math.abs(segments[i-1].end-segments[i].start)>1e-8)fail('PROFILE_GAP','Profile has a coverage gap',{index:i});
 const find=d=>{let lo=0,hi=segments.length-1;while(hi-lo>0){const mid=(lo+hi)>>1;if(d>segments[mid].end)lo=mid+1;else hi=mid;}return segments[lo];};
 const sample=d=>{d=clamp(finite(d,'chainage'),0,length);return {...evaluate(find(d),d),distanceM:d};};
 return {schema:SCHEMA,length,constraints:structuredClone(constraints),levelZones:merged,segments,transitions,sample,analytic:{maxAbsoluteGradePermille:Math.max(...segments.map(s=>Math.abs(s.grade)*1000)),maxGradeRatePerM:Math.max(0,...transitions.map(t=>t.maxGradeRatePerM)),boundProof:'Grade ramps use monotone S(u)=10u^3-15u^4+6u^5 on [0,1]; grade extrema are endpoints. S-prime reaches 1.875 at u=0.5. Exact join height and first three height derivatives are checked.'}};
}
export function validateProfile(profile,{sampleStepM=1,heightToleranceM=1e-8,derivativeTolerance=1e-10}={}){
 const failures=[],joins=[];let sampledMaxGrade=0,sampledMaxRate=0,count=0;
 for(let d=0;d<profile.length;d+=sampleStepM){const v=profile.sample(d);count++;if(Object.values(v).some(x=>!Number.isFinite(x)))failures.push({code:'NON_FINITE_SAMPLE',d});sampledMaxGrade=Math.max(sampledMaxGrade,Math.abs(v.grade)*1000);sampledMaxRate=Math.max(sampledMaxRate,Math.abs(v.gradeRate));}
 for(const s of profile.segments){for(const d of[s.start,s.end,(s.start+s.end)/2]){const v=evaluate(s,d);sampledMaxGrade=Math.max(sampledMaxGrade,Math.abs(v.grade)*1000);sampledMaxRate=Math.max(sampledMaxRate,Math.abs(v.gradeRate));count++;}}
 for(let i=1;i<profile.segments.length;i++){const a=profile.segments[i-1],b=profile.segments[i],L=evaluate(a,a.end),R=evaluate(b,b.start),delta=Object.fromEntries(['height','grade','gradeRate','gradeSecond'].map(k=>[k,Math.abs(L[k]-R[k])]));joins.push({d:b.start,delta});if(delta.height>heightToleranceM||delta.grade>derivativeTolerance||delta.gradeRate>derivativeTolerance||delta.gradeSecond>derivativeTolerance)failures.push({code:'VERTICAL_JOIN_DISCONTINUITY',d:b.start,delta});}
 const anchorChecks=profile.constraints.anchors.map(a=>{const v=profile.sample(a.d),error=Math.abs(v.height-a.height);if(error>heightToleranceM)failures.push({code:'ANCHOR_DRIFT',id:a.id,error});return {id:a.id,d:a.d,height:a.height,error,gradePermille:v.grade*1000};});
 for(const z of profile.levelZones)for(const d of[z.start,(z.start+z.end)/2,z.end])if(Math.abs(profile.sample(d).grade)*1000>profile.constraints.stationMaxGradePermille+1e-9)failures.push({code:'LEVEL_ZONE_GRADE',anchorIds:z.anchorIds,d});
 if(profile.analytic.maxAbsoluteGradePermille>profile.constraints.maxGradePermille+1e-9||sampledMaxGrade>profile.constraints.maxGradePermille+1e-9)failures.push({code:'MAX_GRADE_EXCEEDED'});
 if(profile.analytic.maxGradeRatePerM>1/profile.constraints.minVerticalRadiusM+1e-12)failures.push({code:'CURVATURE_BOUND_EXCEEDED'});
 return {passed:!failures.length,failures,sampleCount:count,sampleStepM,sampledMaxGradePermille:sampledMaxGrade,sampledMaxGradeRatePerM:sampledMaxRate,analytic:profile.analytic,anchorChecks,joins,maxJoinHeightErrorM:Math.max(0,...joins.map(x=>x.delta.height)),maxJoinGradeError:Math.max(0,...joins.map(x=>x.delta.grade)),maxJoinGradeRateError:Math.max(0,...joins.map(x=>x.delta.gradeRate)),maxJoinGradeSecondError:Math.max(0,...joins.map(x=>x.delta.gradeSecond)),scope:'Vertical derivatives only. Existing horizontal polyline corners are intentionally unchanged.'};
}
export function createConstrainedRoute(original,constraints,{terrainHeight=null,renderStepM=5}={}){
 if(!Array.isArray(original.points)||original.points.length<2||typeof original.sample!=='function')fail('INVALID_SOURCE_ROUTE','Expected existing route points, length and sample');
 for(let i=0;i<original.points.length;i++){const p=original.points[i];for(const k of['x','y','z','d'])finite(p[k],`point ${i}.${k}`);if(i){const q=original.points[i-1],ds=p.d-q.d,plan=Math.hypot(p.x-q.x,p.z-q.z);if(ds<=0||Math.abs(ds-plan)>1e-6)fail('CHAINAGE_MISMATCH','Source distance is not its unchanged horizontal polyline length',{index:i,ds,plan});}}
 if(Math.abs(original.points[0].d)>1e-9||Math.abs(original.points.at(-1).d-original.length)>1e-8)fail('CHAINAGE_ENDPOINTS','Source chainage endpoints disagree');
 const lock=constraints.lockedHorizontal;if(lock&&(lock.length!==original.length||lock.points.length!==original.points.length||lock.points.some((v,i)=>v[0]!==original.points[i].x||v[1]!==original.points[i].z||v[2]!==original.points[i].d)||JSON.stringify(lock.stops)!==JSON.stringify(original.stops.map(s=>[s.id,s.d]))))fail('HORIZONTAL_PLAN_CHANGED','The plan or station chainages changed; explicitly regenerate vertical anchors before enabling this profile');
 const profile=buildVerticalProfile(original.length,constraints),validation=validateProfile(profile);if(!validation.passed)fail('PROFILE_VALIDATION_FAILED','Generated vertical profile did not pass gates',validation);
 const sample=d=>{d=clamp(finite(d,'chainage'),0,original.length);const b=original.sample(d),v=profile.sample(d),h=Math.hypot(b.f[0],b.f[2]);if(h<1e-12)fail('HORIZONTAL_TANGENT_UNDEFINED','Source has a zero horizontal tangent',{d});const tx=b.f[0]/h,tz=b.f[2]/h,len=Math.hypot(1,v.grade),p=[b.p[0],v.height,b.p[2]];return {...b,p,f:[tx/len,v.grade/len,tz/len],right:[-tz,0,tx],grade:v.grade,gradeRate:v.gradeRate,gradeSecond:v.gradeSecond,distanceM:d,originalTerrainFollowingHeight:b.p[1],verticalDesignStatus:'authored_game_profile_not_engineering_certification'};};
 const points=original.points.map(p=>({...p,y:profile.sample(p.d).height}));
 const ds=new Set(original.points.map(p=>p.d));for(let d=0;d<original.length;d+=renderStepM)ds.add(d);for(const s of profile.segments){ds.add(s.start);ds.add(s.end);}ds.add(original.length);
 const renderPoints=[...ds].sort((a,b)=>a-b).map(d=>{const p=sample(d);return{x:p.p[0],y:p.p[1],z:p.p[2],d,role:p.role};});
 const result={...original,points,renderPoints,stops:original.stops.map(s=>({...s})),sample,verticalProfile:profile,verticalValidation:validation,originalRoute:original,rollback:()=>original};
 if(terrainHeight)result.terrainCandidateAt=d=>{const p=sample(d),ground=terrainHeight(p.p[0],p.p[2]);return {d:p.distanceM,terrainHeight:ground,railHeight:p.p[1],gapM:Number.isFinite(ground)?p.p[1]-ground:null,kind:!Number.isFinite(ground)?'terrain-unknown':p.p[1]-ground>constraints.bridgeCandidateGapM?'bridge-candidate':ground-p.p[1]>constraints.tunnelCandidateCoverM?'tunnel-candidate':'surface-cut-fill-candidate',status:'geometric_candidate_only_not_engineered_structure',originalRole:p.role};};
 return result;
}
/** Feed the same profile grade to the existing immutable 120 Hz GAME drive.
 * Existing positionM remains horizontal route chainage; no claim of a full
 * train/rail contact or multi-vehicle longitudinal dynamics model is made.
 */
export function stepDriveOnProfile(drive,route,elapsedS){
 finite(elapsedS,'elapsed seconds');const h=drive.parameters?.clock?.fixedDtS,cap=drive.parameters?.clock?.maxStepsPerAdvance;
 if(!Number.isFinite(h)||h<=0||!Number.isInteger(cap)||typeof drive.setGrade!=='function')fail('DRIVE_INTERFACE','Existing drive fixed-step and setGrade API required');
 if(elapsedS<0||elapsedS>h*cap+1e-12)fail('DRIVE_BATCH_BUDGET','Time batch exceeds fixed-step budget; caller must split without dropping time',{elapsedS,maxElapsedS:h*cap});
 const max=route.verticalProfile?.analytic?.maxAbsoluteGradePermille;
 if(!Number.isFinite(max)||max/1000>drive.parameters.rail.maxAbsGrade)fail('DYNAMICS_GRADE_CAP','Profile exceeds the existing drive grade-input range',{maxProfilePermille:max,maxDrivePermille:drive.parameters.rail.maxAbsGrade*1000});
 const before=drive.snapshot(),steps=Math.floor(elapsedS/h),remaining=elapsedS-steps*h;let state=before;
 const tick=dt=>{drive.setGrade(route.sample(drive.snapshot().positionM).grade);state=drive.tick(dt);};
 for(let i=0;i<steps;i++)tick(h);if(remaining>0)tick(remaining);
 state=drive.setGrade(route.sample(state.positionM).grade);
 return {...state,deltaDistanceM:state.positionM-before.positionM,routeGradeSource:'same_constrained_vertical_profile_each_fixed_step',routeDistanceInterpretation:'horizontal_chainage_game_approximation'};
}
export function railPoseEuler(sample){return{x:0,y:-Math.atan2(sample.f[2],sample.f[0]),z:Math.atan(sample.grade),order:'YZX'};}

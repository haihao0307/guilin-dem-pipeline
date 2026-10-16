import {buildVerticalProfile,validateProfile,stepDriveOnProfile,railPoseEuler,ProfileConstraintError} from './vertical-profile-core.mjs';
export {stepDriveOnProfile,railPoseEuler};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const assert=(ok,code,message,details={})=>{if(!ok)throw new ProfileConstraintError(code,message,details);};
const finite=(v,name)=>{assert(Number.isFinite(v),'NON_FINITE',`Non-finite ${name}`);return v;};
const value=(c,t)=>{let x=0;for(let i=c.length-1;i>=0;i--)x=x*t+c[i];return x;};
const derivative=c=>c.slice(1).map((v,i)=>v*(i+1));
const GN=[-.906179845938664,-.5384693101056831,0,.5384693101056831,.906179845938664],GW=[.2369268850561891,.4786286704993665,.5688888888888889,.4786286704993665,.2369268850561891];
function upper(arr,x,get){let lo=0,hi=arr.length-1;while(lo<hi){const m=(lo+hi)>>1;if(get(arr[m])<x)lo=m+1;else hi=m;}return lo;}
export function preparePlan(plan){
 assert(plan.schema==='kaopu.authored.rail-route-polynomial/1','PLAN_SCHEMA','Unsupported authored route spectrum');
 assert(plan.lengthM>0&&plan.segments.length>0,'EMPTY_PLAN','Positive route length and polynomial segments required');
 const pieces=plan.segments.map((s,i)=>{assert(s.endS>s.startS&&s.arcTable.length>=2,'INVALID_PIECE','Invalid polynomial span',{i});assert(i===0?Math.abs(s.startS)<1e-8:Math.abs(s.startS-plan.segments[i-1].endS)<1e-8,'PLAN_GAP','Polynomial chainage gap',{i});for(const c of[s.coeffX,s.coeffZ])assert(c.length===6&&c.every(Number.isFinite),'INVALID_COEFFICIENT','Finite quintic coefficients required',{i});const dx=derivative(s.coeffX),dz=derivative(s.coeffZ);return{...s,dx,dz,ddx:derivative(dx),ddz:derivative(dz)};});
 assert(Math.abs(pieces.at(-1).endS-plan.lengthM)<1e-7,'PLAN_LENGTH','Plan extent differs from declared integrated length');
 const arc=(p,a,b)=>{const h=(b-a)*.5,m=(b+a)*.5;return h*GN.reduce((sum,x,i)=>sum+GW[i]*Math.hypot(value(p.dx,m+h*x),value(p.dz,m+h*x)),0);};
 function sample(d){d=clamp(finite(d,'chainage'),0,plan.lengthM);const index=upper(pieces,d,p=>p.endS),p=pieces[index],s=d-p.startS,tab=p.arcTable,k=Math.max(0,upper(tab,s,q=>q[1])-1),a=tab[k],b=tab[Math.min(k+1,tab.length-1)];let t=a[0]+(b[0]-a[0])*(s-a[1])/(b[1]-a[1]||1);
  for(let n=0;n<4;n++){const error=a[1]+arc(p,a[0],t)-s,speed=Math.hypot(value(p.dx,t),value(p.dz,t));assert(speed>1e-10,'ZERO_PLAN_TANGENT','Undefined planar tangent',{d,index});if(Math.abs(error)<1e-9)break;t=clamp(t-error/speed,a[0],b[0]);}
  const dx=value(p.dx,t),dz=value(p.dz,t),speed=Math.hypot(dx,dz),curvature=(dx*value(p.ddz,t)-dz*value(p.ddx,t))/speed**3;
  return{x:value(p.coeffX,t),z:value(p.coeffZ,t),tx:dx/speed,tz:dz/speed,curvature,segmentIndex:index,t,distanceM:d};
 }
 return{sample,pieces,arc};
}
export function createSketchRoute(plan,originalRoute,terrainHeight=null,{renderStepM=5}={}){
 assert(Number.isFinite(renderStepM)&&renderStepM>0,'INVALID_SAMPLE_STEP','Render step must be finite and positive');
 const prepared=preparePlan(plan),verticalProfile=buildVerticalProfile(plan.lengthM,plan.verticalConstraints),verticalValidation=validateProfile(verticalProfile);
 assert(verticalValidation.passed,'VERTICAL_VALIDATION','Vertical profile failed its whole-line and analytic gates',verticalValidation);
 const sectionAt=d=>plan.sections.find(s=>d>=s.startS-1e-8&&d<s.endS-1e-8)||plan.sections.at(-1);
 const sample=d=>{d=clamp(finite(d,'chainage'),0,plan.lengthM);const p=prepared.sample(d),v=verticalProfile.sample(d),norm=Math.hypot(1,v.grade),section=sectionAt(d),radius=Math.abs(p.curvature)>1e-12?1/Math.abs(p.curvature):Infinity;
  const yard=Math.abs(d-plan.yardAnchor.centerS)<=310,advisory=yard?20:Math.min(80,Math.sqrt(radius*.5)*3.6);
  return{p:[p.x,v.height,p.z],f:[p.tx/norm,v.grade/norm,p.tz/norm],right:[-p.tz,0,p.tx],grade:v.grade,gradeRate:v.gradeRate,gradeSecond:v.gradeSecond,distanceM:d,role:section.role,sectionId:section.id,planCurvaturePerM:p.curvature,planRadiusM:radius,gameAdvisorySpeedKph:advisory,speedStatus:'editable_game_advisory_not_enforced_or_engineering_limit',verticalDesignStatus:'authored_game_profile_not_engineering_certification'};};
 const ds=new Set([0,plan.lengthM,...plan.segments.map(s=>s.startS),...plan.sections.flatMap(s=>[s.startS,s.endS]),...verticalProfile.segments.flatMap(s=>[s.start,s.end]),...plan.stops.map(s=>s.d),plan.yardAnchor.centerS]);for(let d=0;d<plan.lengthM;d+=renderStepM)ds.add(d);
 const points=[...ds].sort((a,b)=>a-b).map(d=>{const v=sample(d);return{x:v.p[0],y:v.p[1],z:v.p[2],d,role:v.role};});
 function nearest(q){assert(q.length===2&&q.every(Number.isFinite),'INVALID_QUERY','Nearest expects finite scene [x,z]');let best={d:0,error:Infinity};for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],vx=b.x-a.x,vz=b.z-a.z,u=clamp(((q[0]-a.x)*vx+(q[1]-a.z)*vz)/(vx*vx+vz*vz||1),0,1),err=Math.hypot(q[0]-a.x-u*vx,q[1]-a.z-u*vz);if(err<best.error)best={d:a.d+u*(b.d-a.d),error:err};}return best.d;}
 const route={points,renderPoints:points,length:plan.lengthM,sample,nearest,stops:structuredClone(plan.stops),sections:structuredClone(plan.sections),sourceRouteTitles:plan.sections.map(s=>s.title),metadata:{...plan.metadata,scope:'Old Kowloon to Lo Wu; provisional user-sketch alignment; explicit tunnel and bridge candidates only'},planSpectrum:plan,preparedPlan:prepared,verticalProfile,verticalValidation,originalRoute,rollback:()=>originalRoute,yardAnchor:structuredClone(plan.yardAnchor)};
 if(terrainHeight)route.terrainCandidateAt=d=>{const s=sample(d),ground=terrainHeight(s.p[0],s.p[2]),gap=Number.isFinite(ground)?s.p[1]-ground:null;return{d:s.distanceM,terrainHeight:ground,railHeight:s.p[1],gapM:gap,kind:gap===null?'terrain-unknown':gap>3?'bridge-candidate':gap< -3?'tunnel-candidate':'surface-cut-fill-candidate',declaredRole:s.role,status:'geometric_candidate_not_built_or_engineered'};};
 return route;
}
export function displayPlan(plan){const p=preparePlan(plan);return{displayRoutes:plan.sections.map(s=>{const ds=[s.startS];for(let d=s.startS+20;d<s.endS;d+=20)ds.push(d);ds.push(s.endS);return{id:s.id,kind:'story',role:s.role,title:s.title,points:ds.map(d=>{const a=p.sample(d);return[a.x,a.z];}),surfaceProjectionOnly:true};}),labels:[...(plan.conflictClusters||[]).map(c=>({text:c.title,point:[c.sceneXYZ[0],c.sceneXYZ[2]],kind:'story',detail:false,conflictId:c.id})),...plan.stops.map(s=>{const a=p.sample(s.d);return{text:s.name,point:[a.x,a.z],kind:'story',detail:false};}),...plan.sections.filter(s=>s.role==='tunnel'||s.role==='bridge').flatMap(s=>[s.startS,s.endS].map((d,i)=>{const a=p.sample(d);return{text:s.title+(i?' · 北端/出口候选':' · 南端/入口候选'),point:[a.x,a.z],kind:'story',detail:false};}))]};}

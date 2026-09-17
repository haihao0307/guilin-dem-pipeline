import fs from 'node:fs';
import * as K from './r045_round09_kernel.mjs';
import * as R8 from '../round-08/r045_round08_kernel.mjs';

const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};

function commonProfile(Ker,z){const a=[];for(let x=-180;x<=180;x+=20)a.push(Ker.height(x,z));return mean(a)}
function commonDerivativeStats(Ker){
  const samples=[];for(let z=50;z<=124;z+=2)samples.push({z,y:commonProfile(Ker,z)});
  let maxJump=0,maxCurv=0,atJump=null,atCurv=null;
  for(let i=1;i<samples.length-1;i++){
    const m0=(samples[i].y-samples[i-1].y)/2,m1=(samples[i+1].y-samples[i].y)/2;
    const jump=Math.abs(m1-m0),curv=Math.abs(samples[i+1].y-2*samples[i].y+samples[i-1].y)/4;
    if(jump>maxJump){maxJump=jump;atJump=samples[i].z}if(curv>maxCurv){maxCurv=curv;atCurv=samples[i].z}
  }
  return{maxJump,atJump,maxCurv,atCurv,samples};
}
function maxForwardRise(Ker){let m=-Infinity,at=null;for(let x=-200;x<=200;x+=10)for(let z=42;z<=132;z+=4){const v=Ker.height(x,z+4)-Ker.height(x,z);if(v>m){m=v;at=[x,z]}}return{max:m,at}}
function repairStats(){let maxAbs=0,sum=0,n=0,changed=0;const rows=[];for(let x=-200;x<=200;x+=10)for(let z=40;z<=132;z+=2){const d=K.inheritedBendRepairDelta(x,z);maxAbs=Math.max(maxAbs,Math.abs(d));sum+=Math.abs(d);n++;if(Math.abs(d)>.005)changed++;if(z===86)rows.push(d)}return{maxAbs,meanAbs:sum/n,changedFraction:changed/n,midStd:std(rows),midRange:Math.max(...rows)-Math.min(...rows)}}
function maxDiffAtZones(){let rear=0,river=0,upslope=0;for(let x=-210;x<=210;x+=30){for(const z of [-270,-240,-205,-160,-120,-60,0,20])upslope=Math.max(upslope,Math.abs(K.height(x,z)-R8.height(x,z)));for(const z of [-270,-240,-205])rear=Math.max(rear,Math.abs(K.height(x,z)-R8.height(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])river=Math.max(river,Math.abs(K.height(x,rz+dz)-R8.height(x,rz+dz)));}return{rear,river,upslope}}
function lineIdentity(){if(K.terracePilot.lines.length!==R8.terracePilot.lines.length)return false;for(let i=0;i<K.terracePilot.lines.length;i++){const a=K.terracePilot.lines[i],b=R8.terracePilot.lines[i];if(a.id!==b.id||a.target!==b.target||a.halfWidth!==b.halfWidth||a.points.length!==b.points.length)return false;for(let j=0;j<a.points.length;j++)if(a.points[j][0]!==b.points[j][0]||a.points[j][1]!==b.points[j][1])return false;}return true}

add('version_is_R045_09',K.VERSION==='R045.09',K.VERSION,'R045.09');
add('water_graph_identity_preserved',K.nodes.length===R8.nodes.length&&K.edges.length===R8.edges.length,{nodes:[R8.nodes.length,K.nodes.length],edges:[R8.edges.length,K.edges.length]},'unchanged');
add('terrace_pilot_geometry_frozen_this_round',lineIdentity(),K.terracePilot.lines.map(l=>({id:l.id,n:l.points.length,width:l.fullWidth,length:l.length})),'exact R08 pilot centreline/spec identity');

const repair=repairStats();
add('repair_is_nonzero_but_local',repair.changedFraction>.10&&repair.changedFraction<.60,repair,'10%..60% changed in z40..132 probe');
add('repair_vertical_magnitude_bounded',repair.maxAbs<2.5,repair.maxAbs,'<2.5m');
add('repair_is_laterally_nonuniform',repair.midStd>.01&&repair.midRange>.05,{std:repair.midStd,range:repair.midRange},'not a horizontal constant belt');

const baseCommon=commonDerivativeStats(R8),newCommon=commonDerivativeStats(K);
add('inherited_common_bend_derivative_jump_reduced',newCommon.maxJump<baseCommon.maxJump*.97,{r08:{maxJump:baseCommon.maxJump,at:baseCommon.atJump},r09:{maxJump:newCommon.maxJump,at:newCommon.atJump}},'<97% of R08 common-profile max derivative jump');
add('inherited_common_bend_curvature_reduced',newCommon.maxCurv<baseCommon.maxCurv*.97,{r08:{maxCurv:baseCommon.maxCurv,at:baseCommon.atCurv},r09:{maxCurv:newCommon.maxCurv,at:newCommon.atCurv}},'<97% of R08 common-profile max curvature');

const r8Rise=maxForwardRise(R8),r9Rise=maxForwardRise(K);
add('repair_does_not_create_new_forward_barrier',r9Rise.max<Math.max(.22,r8Rise.max+.035),{r08:r8Rise,r09:r9Rise},'<max(0.22m, R08+0.035m) per 4m');
const zones=maxDiffAtZones();
add('rear_mountain_controls_unchanged',zones.rear<1e-9,zones.rear,'0');
add('front_receiver_controls_unchanged',zones.river<1e-9,zones.river,'0');
add('upslope_and_upper_foothill_controls_unchanged',zones.upslope<1e-9,zones.upslope,'0 at sampled protected zones');

// Ensure terrace eligibility still obeys the drainage exclusion and remains available elsewhere.
const near=[],far=[];let candidate=0,good=0;for(let x=-195;x<=195;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestTerrainDrainageDistance(x,z),p=K.terracePermission(x,z);candidate++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p)}
add('terrace_permission_excludes_near_drainage',mean(near)<.01,mean(near),'<0.01');
add('terrace_permission_remains_available',mean(far)>.25,mean(far),'>0.25 away from drainage');
add('terrace_candidate_not_global',good/candidate<.65,{good,candidate,fraction:good/candidate},'<65%');

// The round is macro-only: keep production and parcel/terrace generation hard locked.
add('visual_acceptance_remains_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('parcel_generation_remains_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('terrace_generator_remains_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('water_state_remains_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{repair,commonProfileR08:{maxJump:baseCommon.maxJump,atJump:baseCommon.atJump,maxCurv:baseCommon.maxCurv,atCurv:baseCommon.atCurv},commonProfileR09:{maxJump:newCommon.maxJump,atJump:newCommon.atJump,maxCurv:newCommon.maxCurv,atCurv:newCommon.atCurv},forwardRiseR08:r8Rise,forwardRiseR09:r9Rise,protectedZoneDiff:zones,nearDrainagePermission:mean(near),farDrainagePermission:mean(far),terracePermissionAbove065:good/candidate},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round09_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;

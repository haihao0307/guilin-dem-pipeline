import * as R6 from '../round-06/r045_round06_kernel.mjs';
import * as K from './r045_round07_kernel.mjs';
import fs from 'node:fs';

const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function minLineSep(a,b){let d=1e9;for(const p of a)for(const q of b)d=Math.min(d,dist(p,q));return d}
function lineElevStats(line){const y=line.points.map(p=>K.height(...p));return{n:y.length,mean:mean(y),std:std(y),range:y.length?Math.max(...y)-Math.min(...y):Infinity,error:y.length?Math.max(...y.map(v=>Math.abs(v-line.target))):Infinity}}
function lineDrainStats(line){const ds=line.points.map(p=>K.nearestTerrainDrainageDistance(...p)),ps=line.points.map(p=>K.terracePermission(...p));return{minDrain:ds.length?Math.min(...ds):0,meanDrain:mean(ds),minPermission:ps.length?Math.min(...ps):0,meanPermission:mean(ps)}}
function transitionPhase(Ker){
  const zs=[];for(let x=-190;x<=190;x+=10){let best={z:0,v:-1};for(let z=-8;z<=84;z+=2){const e=2,v=Math.abs(Ker.height(x,z+e)-2*Ker.height(x,z)+Ker.height(x,z-e));if(v>best.v)best={z,v};}zs.push(best.z)}
  return{zs,std:std(zs),range:Math.max(...zs)-Math.min(...zs),mean:mean(zs)};
}
function maxForwardRise(Ker){let m=-Infinity,at=null;for(let x=-200;x<=200;x+=10)for(let z=-28;z<=108;z+=4){const v=Ker.height(x,z+4)-Ker.height(x,z);if(v>m){m=v;at=[x,z]}}return{max:m,at}}
function maxAdjacentDerivativeJump(Ker){let m=0,at=null;for(let x=-200;x<=200;x+=10)for(let z=-26;z<=110;z+=2){const a=Ker.height(x,z)-Ker.height(x,z-1),b=Ker.height(x,z+1)-Ker.height(x,z),v=Math.abs(b-a);if(v>m){m=v;at=[x,z]}}return{max:m,at}}

add('version_is_R045_07',K.VERSION==='R045.07',K.VERSION,'R045.07');
add('water_graph_identity_preserved',K.nodes.length===R6.nodes.length&&K.edges.length===R6.edges.length,{nodes:[R6.nodes.length,K.nodes.length],edges:[R6.edges.length,K.edges.length]},'unchanged');

// Macro foothill: break the synchronized long bench without creating a forward barrier.
const ph6=transitionPhase(R6),ph7=transitionPhase(K);
add('foothill_transition_lateral_phase_varies',ph7.std>ph6.std+1.0&&ph7.range>=ph6.range+4,{R06:ph6,R07:ph7},'std +>1m and range +>=4m');
const rise=maxForwardRise(K);add('foothill_transition_no_forward_barrier',rise.max<.22,rise,'<0.22m rise per 4m');
const jump=maxAdjacentDerivativeJump(K);add('foothill_local_derivative_change_bounded',jump.max<.12,jump,'<0.12m/m local second difference');

// The warp must not touch rear mountain or receiver river.
let rearDiff=0;for(let x=-220;x<=220;x+=20)for(const z of[-300,-260,-220,-180,-80])rearDiff=Math.max(rearDiff,Math.abs(K.height(x,z)-R6.height(x,z)));
add('rear_and_upper_slope_not_warped',rearDiff<1e-9,rearDiff,'0 within floating tolerance');
let riverDiff=0,rmin=1e9,rmax=-1e9;for(let x=-230;x<=230;x+=5){const z=K.riverZ(x);riverDiff=Math.max(riverDiff,Math.abs(K.height(x,z)-R6.height(x,z)));rmin=Math.min(rmin,z);rmax=Math.max(rmax,z)}
add('front_receiver_river_untouched',riverDiff<1e-9,{riverDiff,zRange:[rmin,rmax]},'0 height change at receiver centerline');

// Permission must remain a constrained eligibility mask, not a claim that terraces exist.
let total=0,good=0,near=[],far=[];for(let x=-195;x<=195;x+=10)for(let z=-150;z<=4;z+=9){const p=K.terracePermission(x,z),d=K.nearestTerrainDrainageDistance(x,z);total++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p);}const pct=good/total;
add('terrace_permission_constrained',pct>.08&&pct<.62,pct,'0.08..0.62');
add('terrace_permission_zero_near_drainage',mean(near)<.03,mean(near),'<.03');
add('terrace_permission_viable_away_from_drainage',mean(far)>.20,mean(far),'>.20');

// Bounded pilot only. Three near-level contour benches; no global terrace unlock.
const pilot=K.terracePilot;
add('pilot_preview_only',pilot.status==='preview-only'&&K.snapshot.terracePilotPreviewEnabled===true&&K.snapshot.terraceGeometryEnabled===false&&K.snapshot.parcelGenerationEnabled===false,{status:pilot.status,preview:K.snapshot.terracePilotPreviewEnabled,globalTerraces:K.snapshot.terraceGeometryEnabled,parcels:K.snapshot.parcelGenerationEnabled},'preview true; production terraces/parcels false');
add('pilot_seed_is_valid_permission_patch',pilot.seed.permission>.60&&pilot.seed.drainageDistance>18&&pilot.seed.divideDistance>10,pilot.seed,'permission>.60, drainage>18m, divide>10m');
add('pilot_has_three_benches',pilot.lines.length===3&&pilot.lines.every(l=>l.points.length>=8),pilot.lines.map(l=>({id:l.id,n:l.points.length,length:l.length})),'3 lines; each >=8 points');
const lengths=pilot.lines.map(l=>l.length);add('pilot_benches_have_useful_extent',Math.min(...lengths)>28&&Math.max(...lengths)<190,lengths,'28..190m each');
const es=pilot.lines.map(lineElevStats);add('pilot_benches_follow_level_contours',es.every(q=>q.error<.012),es,'max elevation error <0.012m');
const ds=pilot.lines.map(lineDrainStats);add('pilot_terminates_before_drainage',ds.every(q=>q.minDrain>=13.4),ds,'min drainage clearance >=13.4m');
add('pilot_stays_in_eligible_terrain',ds.every(q=>q.meanPermission>.48),ds.map(q=>q.meanPermission),'>.48 mean permission each');
const seps=[];for(let i=0;i<pilot.lines.length;i++)for(let j=i+1;j<pilot.lines.length;j++)seps.push(minLineSep(pilot.lines[i].points,pilot.lines[j].points));
add('pilot_benches_are_separate',Math.min(...seps)>2.2,seps,'pairwise minimum >2.2m');

// Preview cut/fill is deliberately shallow and local.
let maxCF=0,flatRanges=[],changed=0,sampled=0,nearDrainChanged=0;
for(const line of pilot.lines){
  const vals=[];
  for(let i=1;i<line.points.length-1;i+=2){const [x,z]=line.points[i],g=K.gradient(x,z),L=Math.hypot(g.dx,g.dz)||1,nx=g.dx/L,nz=g.dz/L,band=[];for(const off of[-.8,0,.8]){const px=x+nx*off,pz=z+nz*off,b=K.height(px,pz),t=K.terracedPilotHeight(px,pz);maxCF=Math.max(maxCF,Math.abs(t-b));band.push(t);sampled++;if(Math.abs(t-b)>1e-4)changed++;if(K.nearestTerrainDrainageDistance(px,pz)<8&&Math.abs(t-b)>1e-4)nearDrainChanged++;}vals.push(Math.max(...band)-Math.min(...band));}
  flatRanges.push(vals.length?Math.max(...vals):Infinity);
}
add('pilot_bench_crossfall_is_flattened',Math.max(...flatRanges)<.035,flatRanges,'max cross-bench range <0.035m');
add('pilot_cut_fill_is_bounded',maxCF<.42,maxCF,'<0.42m preview cut/fill');
add('pilot_never_modifies_near_drainage',nearDrainChanged===0,{nearDrainChanged,changed,sampled},'0 modified samples with drainage distance <8m');
const footprint=pilot.lines.reduce((s,l)=>s+l.length*pilot.benchHalfWidth*2,0),candidateArea=390*154,ratio=footprint/candidateArea;
add('pilot_footprint_is_small',ratio<.035,{footprint,candidateArea,ratio},'<3.5% of candidate slope rectangle');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,checks,metrics:{foothillPhaseR06:ph6,foothillPhaseR07:ph7,maxForwardRise4m:rise,maxDerivativeChange:jump,rearDiff,riverDiff,terracePermissionAbove065:pct,nearDrainagePermission:mean(near),farDrainagePermission:mean(far),pilotSeed:pilot.seed,pilotLines:pilot.lines.map((l,i)=>({id:l.id,target:l.target,length:l.length,points:l.points.length,elevation:es[i],drainage:ds[i]})),pilotPairSeparations:seps,pilotMaxCutFill:maxCF,pilotMaxCrossfall:Math.max(...flatRanges),pilotFootprintRatio:ratio},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round07_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;

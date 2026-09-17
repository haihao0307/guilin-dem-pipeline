import fs from 'node:fs';
import * as K from './r045_round08_kernel.mjs';
import * as R6 from '../round-06/r045_round06_kernel.mjs';

const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const cv=a=>Math.abs(mean(a))>1e-9?std(a)/Math.abs(mean(a)):0;
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function minLineSep(a,b){let d=1e9;for(const p of a)for(const q of b)d=Math.min(d,dist(p,q));return d}
function lineElevStats(line){const y=line.points.map(p=>K.height(...p));return{n:y.length,mean:mean(y),std:std(y),range:y.length?Math.max(...y)-Math.min(...y):Infinity,error:y.length?Math.max(...y.map(v=>Math.abs(v-line.target))):Infinity}}
function lineDrainStats(line){const ds=line.points.map(p=>K.nearestTerrainDrainageDistance(...p)),ps=line.points.map(p=>K.terracePermission(...p));return{minDrain:ds.length?Math.min(...ds):0,meanDrain:mean(ds),minPermission:ps.length?Math.min(...ps):0,meanPermission:mean(ps)}}
function foothillShiftStats(){const vals=[];for(let x=-190;x<=190;x+=10)vals.push(K.foothillShift(x,24));return{values:vals,std:std(vals),range:Math.max(...vals)-Math.min(...vals),maxAbs:Math.max(...vals.map(Math.abs)),mean:mean(vals)}}
function maxForwardRise(Ker){let m=-Infinity,at=null;for(let x=-200;x<=200;x+=10)for(let z=-28;z<=108;z+=4){const v=Ker.height(x,z+4)-Ker.height(x,z);if(v>m){m=v;at=[x,z]}}return{max:m,at}}
function maxAdjacentDerivativeJump(Ker){let m=0,at=null;for(let x=-200;x<=200;x+=10)for(let z=-26;z<=110;z+=2){const a=Ker.height(x,z)-Ker.height(x,z-1),b=Ker.height(x,z+1)-Ker.height(x,z),v=Math.abs(b-a);if(v>m){m=v;at=[x,z]}}return{max:m,at}}

add('version_is_R045_08',K.VERSION==='R045.08',K.VERSION,'R045.08');
add('water_graph_identity_preserved',K.nodes.length===R6.nodes.length&&K.edges.length===R6.edges.length,{nodes:[R6.nodes.length,K.nodes.length],edges:[R6.edges.length,K.edges.length]},'unchanged');

const shift=foothillShiftStats();
add('foothill_phase_remains_visible',shift.std>2.2&&shift.range>8,{std:shift.std,range:shift.range},'std>2.2m and range>8m');
add('foothill_phase_stays_bounded',shift.maxAbs<6.5,shift.maxAbs,'<6.5m at z=24');
const rise=maxForwardRise(K);add('foothill_transition_no_forward_barrier',rise.max<.22,rise,'<0.22m rise per 4m');
const jump=maxAdjacentDerivativeJump(K);add('foothill_local_derivative_change_bounded',jump.max<.12,jump,'<0.12m/m local second difference');

let rearDiff=0,riverDiff=0;
for(let x=-210;x<=210;x+=30){for(const z of [-260,-230,-205])rearDiff=Math.max(rearDiff,Math.abs(K.height(x,z)-R6.height(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])riverDiff=Math.max(riverDiff,Math.abs(K.height(x,rz+dz)-R6.height(x,rz+dz)));}
add('rear_mountain_controls_unchanged',rearDiff<1e-9,rearDiff,'0');
add('front_receiver_controls_unchanged',riverDiff<1e-9,riverDiff,'0');

const near=[],far=[];let candidate=0,good=0;
for(let x=-195;x<=195;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestTerrainDrainageDistance(x,z),p=K.terracePermission(x,z);candidate++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p)}
add('terrace_permission_excludes_near_drainage',mean(near)<.01,mean(near),'<0.01');
add('terrace_permission_exists_away_from_drainage',mean(far)>.25,mean(far),'>0.25');
add('terrace_candidate_not_global',good/candidate<.65,{good,candidate,fraction:good/candidate},'<65%');

const pilot=K.terracePilot;
add('pilot_has_four_varied_benches',pilot.lines.length===4,pilot.lines.length,'4');
add('pilot_seed_is_moderate_slope_probe',pilot.seed.slope>=.095&&pilot.seed.slope<=.195,pilot.seed.slope,'0.095..0.195 synthetic test slope');
const widths=pilot.lines.map(l=>l.fullWidth),lengths=pilot.lines.map(l=>l.length);
add('pilot_widths_are_materially_varied',cv(widths)>.18,{widths,cv:cv(widths)},'CV>0.18');
add('pilot_width_range_is_management_scale_probe',Math.min(...widths)>=4.5&&Math.max(...widths)<=8.5,{min:Math.min(...widths),max:Math.max(...widths)},'4.5..8.5m synthetic');
add('pilot_lines_have_usable_trace_length',pilot.lines.every(l=>l.points.length>=6&&l.length>18),pilot.lines.map(l=>({id:l.id,n:l.points.length,length:l.length})),'each >=6 pts and >18m');
add('pilot_lengths_are_not_identical',cv(lengths)>.04,{lengths,cv:cv(lengths)},'CV>0.04');

const es=pilot.lines.map(lineElevStats),ds=pilot.lines.map(lineDrainStats);
add('pilot_contours_remain_near_level',es.every(e=>e.error<.003),es,'max elevation error <0.003m');
add('pilot_stays_clear_of_major_drainage',ds.every(d=>d.minDrain>12.5),ds,'all min drainage >12.5m');
const seps=[],requiredSeps=[];for(let i=0;i<pilot.lines.length-1;i++){seps.push(minLineSep(pilot.lines[i].points,pilot.lines[i+1].points));requiredSeps.push(pilot.lines[i].halfWidth+pilot.lines[i+1].halfWidth)}
add('pilot_adjacent_bench_footprints_do_not_overlap',seps.every((v,i)=>v>requiredSeps[i]),{separations:seps,required:requiredSeps},'centreline separation > sum of adjacent half-widths');

let maxCF=0,maxCross=0,nearDrainChanged=0,riserSamples=0;
for(const line of pilot.lines){for(let i=0;i<line.points.length;i+=Math.max(1,Math.floor(line.points.length/7))){const [x,z]=line.points[i],g=K.gradient(x,z),L=Math.hypot(g.dx,g.dz)||1,nx=g.dx/L,nz=g.dz/L;for(const off of [-line.halfWidth,-line.halfWidth*.5,0,line.halfWidth*.5,line.halfWidth]){const xx=x+nx*off,zz=z+nz*off,b=K.height(xx,zz),t=K.terracedPilotHeight(xx,zz);maxCF=Math.max(maxCF,Math.abs(t-b));if(K.nearestTerrainDrainageDistance(xx,zz)<11&&Math.abs(t-b)>1e-6)nearDrainChanged++;if(K.pilotRiserInfluence(xx,zz)>.15)riserSamples++;}const vals=[-line.halfWidth*.5,0,line.halfWidth*.5].map(off=>K.terracedPilotHeight(x+nx*off,z+nz*off));maxCross=Math.max(maxCross,Math.max(...vals)-Math.min(...vals));}}
add('pilot_cut_fill_remains_preview_scale',maxCF<.75,maxCF,'<0.75m');
add('pilot_bench_core_is_near_level',maxCross<.18,maxCross,'<0.18m sampled crossfall');
add('pilot_never_modifies_near_drainage',nearDrainChanged===0,nearDrainChanged,'0 changed samples within 11m');
add('pilot_exposes_riser_band',riserSamples>0,riserSamples,'>0 sampled riser points');

const footprint=pilot.lines.reduce((s,l)=>s+l.length*l.fullWidth,0),candidateArea=390*154,ratio=footprint/candidateArea;
add('pilot_footprint_is_still_bounded',ratio<.055,{footprint,candidateArea,ratio},'<5.5% of candidate slope rectangle');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{foothillShift:shift,maxForwardRise4m:rise,maxDerivativeChange:jump,rearDiff,riverDiff,terracePermissionAbove065:good/candidate,nearDrainagePermission:mean(near),farDrainagePermission:mean(far),pilotSeed:pilot.seed,pilotWidths:widths,pilotLengths:lengths,pilotLines:pilot.lines.map((l,i)=>({id:l.id,target:l.target,width:l.fullWidth,length:l.length,points:l.points.length,elevation:es[i],drainage:ds[i]})),pilotPairSeparations:seps,pilotRequiredSeparations:requiredSeps,pilotMaxCutFill:maxCF,pilotMaxCrossfall:maxCross,pilotRiserSamples:riserSamples,pilotFootprintRatio:ratio},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round08_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;

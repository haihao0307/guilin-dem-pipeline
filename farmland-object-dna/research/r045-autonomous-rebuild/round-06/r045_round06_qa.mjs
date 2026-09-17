import * as R5 from '../round-05/r045_round05_kernel.mjs';
import * as K from './r045_round06_kernel.mjs';
import fs from 'node:fs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
function hollowContrast(Ker,h){const j=Math.min(2,h.p.length-2),a=h.p[j-1],p=h.p[j],b=h.p[j+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L,off=h.width*1.1,c=Ker.height(...p),l=Ker.height(p[0]+nx*off,p[1]+nz*off),r=Ker.height(p[0]-nx*off,p[1]-nz*off);return(l+r)/2-c}
function toeProm(Ker){const v=[];for(const x of[-118,-18,112])for(const z of[24,40,56,72])v.push(Ker.height(x,z)-(Ker.height(x-48,z)+Ker.height(x+48,z))/2);return{meanAbs:mean(v.map(Math.abs)),all:v}}
function toeRough(Ker){const v=[];for(const z of[20,32,44,56,68,80]){const ys=[];for(let x=-200;x<=200;x+=10)ys.push(Ker.height(x,z));for(let i=1;i<ys.length-1;i++)v.push(Math.abs(ys[i+1]-2*ys[i]+ys[i-1]));}return{mean:mean(v),max:Math.max(...v)}}
const ids=K.headwaterHollows.map(h=>h.streamId),c5=Object.fromEntries(K.headwaterHollows.map(h=>[h.streamId,hollowContrast(R5,h)])),c6=Object.fromEntries(K.headwaterHollows.map(h=>[h.streamId,hollowContrast(K,h)]));
add('A2_C2_excess_contrast_reduced',c6.A2<c5.A2-.12&&c6.C2<c5.C2-.12,{R05:{A2:c5.A2,C2:c5.C2},R06:{A2:c6.A2,C2:c6.C2}},'each >0.12m reduction');
add('A2_C2_drainage_not_erased',c6.A2>.35&&c6.C2>.35,{A2:c6.A2,C2:c6.C2},'>0.35m');
const drift=Object.fromEntries(ids.filter(k=>!['A2','C2'].includes(k)).map(k=>[k,Math.abs(c6[k]-c5[k])]));add('other_headwaters_minimally_changed',Math.max(...Object.values(drift))<.26,drift,'max <0.26m');
const p5=toeProm(R5),p6=toeProm(K);add('isolated_fan_prominence_reduced',p6.meanAbs<p5.meanAbs*.35,[p5.meanAbs,p6.meanAbs],'<0.35*R05');
const r5=toeRough(R5),r6=toeRough(K);add('foothill_lateral_curvature_reduced',r6.mean<r5.mean*.72,[r5,r6],'<0.72*R05 mean');
const rises=[];for(let x=-200;x<=200;x+=20){let q=-Infinity;for(let z=-20;z<109;z+=4)q=Math.max(q,K.height(x,z+4)-K.height(x,z));rises.push(q)}add('foothill_transition_no_forward_barrier',Math.max(...rises)<.18,rises,'all <0.18m rise per 4m');
const footZ=x=>18+2.4*Math.sin((x+10)*.016)+.8*Math.sin(x*.049),bd=[];for(let x=-200;x<=200;x+=20){const center=footZ(x)+1.5*Math.sin((x+40)*.007);for(const z0 of[center-16,center+22]){const left=K.height(x,z0)-K.height(x,z0-1),right=K.height(x,z0+1)-K.height(x,z0);bd.push(Math.abs(right-left));}}add('foothill_blend_boundary_derivative_jump_bounded',Math.max(...bd)<.015,[Math.max(...bd),mean(bd)],'<0.015m/m derivative jump');
const profiles=[-118,-18,112].map(x=>[16,32,48,64,80].map(z=>K.height(x,z))),span=Math.max(...profiles.map(mean))-Math.min(...profiles.map(mean));add('catchment_identity_retained_at_toe',span>.10,span,'>0.10m profile span');
const crest=[];for(let x=-220;x<=220;x+=10){const z=K.ridgeCrestZ(x);crest.push(K.height(x,z)-K.height(x,z+58));}add('rear_ridge_preserved',Math.min(...crest)>6.5,Math.min(...crest),'>6.5m');
let maxRise=-Infinity;for(let z=-170;z<142;z+=4)maxRise=Math.max(maxRise,K.height(0,z+4)-K.height(0,z));add('central_forward_profile_no_opposing_wall',maxRise<.65,maxRise,'<0.65m/4m');
let rmin=1e9,rmax=-1e9;for(let x=-230;x<=230;x+=5){const z=K.riverZ(x);rmin=Math.min(rmin,z);rmax=Math.max(rmax,z)}add('river_confined_to_front_receiver',rmin>154&&rmax<188,[rmin,rmax],'154<z<188');
let total=0,good=0,near=[],far=[];for(let x=-195;x<=195;x+=10)for(let z=-150;z<=4;z+=9){const p=K.terracePermission(x,z),d=K.nearestTerrainDrainageDistance(x,z);total++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p);}const pct=good/total;add('terrace_permission_constrained',pct>.10&&pct<.62,pct,'0.10..0.62');add('terrace_permission_zero_near_drainage',mean(near)<.03,mean(near),'<.03');add('terrace_permission_viable_away_from_drainage',mean(far)>.24,mean(far),'>.24');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,checks,metrics:{headwaterR05:c5,headwaterR06:c6,toeProminenceR05:p5.meanAbs,toeProminenceR06:p6.meanAbs,toeRoughnessR05:r5,toeRoughnessR06:r6,maxToeForwardRise4m:Math.max(...rises),maxCentralRise4m:maxRise,terracePermissionAbove065:pct,nearDrainagePermission:mean(near),farDrainagePermission:mean(far),catchmentToeProfileSpan:span},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round06_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;

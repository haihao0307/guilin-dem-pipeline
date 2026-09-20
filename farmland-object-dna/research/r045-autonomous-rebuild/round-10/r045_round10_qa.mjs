import fs from 'node:fs';
import * as K from './r045_round10_kernel.mjs';
import * as R9 from '../round-09/r045_round09_kernel.mjs';

const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const median=a=>{const b=[...a].sort((x,y)=>x-y);if(!b.length)return 0;const m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};

function morphStats(){
  let maxAbs=0,sum=0,n=0,changed=0,nearSum=0,nearN=0,farSum=0,farN=0;
  for(let x=-220;x<=220;x+=10)for(let z=-205;z<=-48;z+=3){
    const d=K.channelMorphDelta(x,z),a=Math.abs(d),dd=K.nearestTerrainDrainageDistance(x,z);maxAbs=Math.max(maxAbs,a);sum+=a;n++;if(a>.01)changed++;
    if(dd<18){nearSum+=a;nearN++;}if(dd>26){farSum+=a;farN++;}
  }
  const nearMeanAbs=nearSum/(nearN||1),farMeanAbs=farSum/(farN||1);
  return{maxAbs,meanAbs:sum/n,changedFraction:changed/n,nearMeanAbs,farMeanAbs,nearFarRatio:nearMeanAbs/(farMeanAbs||1e-9),sampleCount:n};
}
function sectionSamples(Ker){
  const rows=[];
  for(const c of K.terrainChannels){
    for(let i=0;i<c.p.length-1;i++){
      const a=c.p[i],b=c.p[i+1],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
      if(z<c.z0+10||z>c.z1-8)continue;
      const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L,r=c.shoulderOffset;
      const center=Ker.height(x,z),left=Ker.height(x+nx*r,z+nz*r),right=Ker.height(x-nx*r,z-nz*r);
      rows.push({id:c.id,kind:c.kind,x,z,center,left,right,relief:(left+right)/2-center,asym:Math.abs(left-right)});
    }
  }
  return rows;
}
function forwardBarrier(Ker){let max=-Infinity,at=null;for(let x=-210;x<=210;x+=10)for(let z=-198;z<=-52;z+=4){const v=Ker.height(x,z+4)-Ker.height(x,z);if(v>max){max=v;at=[x,z]}}return{max,at}}
function protectedDiff(){let rear=0,lower=0,river=0;for(let x=-210;x<=210;x+=30){for(const z of [-285,-250,-220,-215])rear=Math.max(rear,Math.abs(K.height(x,z)-R9.height(x,z)));for(const z of [-40,-20,0,40,100])lower=Math.max(lower,Math.abs(K.height(x,z)-R9.height(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])river=Math.max(river,Math.abs(K.height(x,rz+dz)-R9.height(x,rz+dz)));}return{rear,lower,river}}

add('version_is_R045_10',K.VERSION==='R045.10',K.VERSION,'R045.10');
add('water_graph_identity_preserved',K.nodes.length===R9.nodes.length&&K.edges.length===R9.edges.length,{nodes:[R9.nodes.length,K.nodes.length],edges:[R9.edges.length,K.edges.length]},'unchanged');
add('drainage_carriers_are_hierarchical',K.terrainChannels.some(c=>c.kind==='trunk')&&K.terrainChannels.some(c=>c.kind==='gully')&&K.terrainChannels.some(c=>c.kind==='tributary'),K.terrainChannels.map(c=>({id:c.id,kind:c.kind})),'trunk + gully + tributary present');

const morph=morphStats();
add('channel_morphology_is_bounded',morph.maxAbs<2.10,morph,'max |delta| <2.10 m');
// Network density makes raw changed-area fraction a poor locality test: a dense drainage graph can
// legitimately place much of the active slope within a shoulder width.  Locality is instead tested
// against actual distance to the drainage graph: strong response near carriers, negligible response
// on interfluves.  changedFraction remains reported as a diagnostic rather than an arbitrary gate.
add('channel_morphology_tracks_drainage_distance',morph.nearFarRatio>8&&morph.nearMeanAbs>.08,{nearMeanAbs:morph.nearMeanAbs,farMeanAbs:morph.farMeanAbs,nearFarRatio:morph.nearFarRatio,changedFraction:morph.changedFraction},'near/far mean |delta| ratio >8 and near mean >0.08 m');
add('far_interfluves_are_not_corrugated',morph.farMeanAbs<.060,morph.farMeanAbs,'mean |delta| <0.060 m where drainage distance >26 m');

const oldRows=sectionSamples(R9),newRows=sectionSamples(K);
const improvements=newRows.map((r,i)=>r.relief-oldRows[i].relief),newRelief=newRows.map(r=>r.relief),asym=newRows.map(r=>r.asym);
const positiveFraction=improvements.filter(v=>v>.12).length/(improvements.length||1);
add('terrain_channels_gain_cross_valley_relief',mean(improvements)>.30&&median(improvements)>.28,{mean:mean(improvements),median:median(improvements),positiveFraction,count:improvements.length},'mean >0.30 m and median >0.28 m');
add('most_carrier_sections_improve',positiveFraction>.78,positiveFraction,'>78% sections improve by >0.12 m');
add('valleys_remain_bounded_not_slot_trenches',Math.max(...newRelief)<6.5,{max:Math.max(...newRelief),mean:mean(newRelief)},'cross-valley relief <6.5 m');
add('bank_response_is_not_perfectly_symmetric',mean(asym)>.04&&mean(asym)<2.5,{meanAbsBankDifference:mean(asym),std:std(asym)},'0.04..2.5 m mean left/right difference');

const r9Barrier=forwardBarrier(R9),r10Barrier=forwardBarrier(K);
add('new_relief_does_not_create_forward_barrier',r10Barrier.max<Math.max(.42,r9Barrier.max+.12),{r09:r9Barrier,r10:r10Barrier},'< max(0.42 m, R09 + 0.12 m) per 4 m');
const protectedZones=protectedDiff();
add('rear_mountain_controls_unchanged',protectedZones.rear<1e-9,protectedZones.rear,'0');
add('lower_foothill_plain_controls_unchanged',protectedZones.lower<1e-9,protectedZones.lower,'0 at sampled z >= -40');
add('front_receiver_controls_unchanged',protectedZones.river<1e-9,protectedZones.river,'0');

const near=[],far=[];let candidate=0,good=0;for(let x=-195;x<=195;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestTerrainDrainageDistance(x,z),p=K.terracePermission(x,z);candidate++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p)}
add('terrace_permission_still_excludes_drainage',mean(near)<.01,mean(near),'<0.01 within 6 m');
add('terrace_permission_remains_available_away_from_drainage',mean(far)>.18,mean(far),'>0.18 beyond 18 m');
add('terrace_candidate_not_global',good/candidate<.65,{good,candidate,fraction:good/candidate},'<65%');

add('invalid_old_terrace_preview_is_not_promoted',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('visual_acceptance_remains_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('parcel_generation_remains_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('terrace_generator_remains_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('water_state_remains_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('morphology_does_not_claim_flow_state',/no active-flow/.test(K.snapshot.drainageMorphologyClass),K.snapshot.drainageMorphologyClass,'explicit no-active-flow claim');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{morph,sectionImprovement:{mean:mean(improvements),median:median(improvements),positiveFraction,newReliefMean:mean(newRelief),newReliefMax:Math.max(...newRelief),bankAsymMean:mean(asym),sampleCount:newRows.length},forwardBarrier:{r09:r9Barrier,r10:r10Barrier},protectedZones,nearDrainagePermission:mean(near),farDrainagePermission:mean(far),terracePermissionAbove065:good/candidate},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round10_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;

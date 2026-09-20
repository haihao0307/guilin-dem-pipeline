import fs from 'node:fs';
import * as K from './r045_round11_kernel.mjs';
import * as R10 from '../round-10/r045_round10_kernel.mjs';

const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const median=a=>{const b=[...a].sort((x,y)=>x-y);if(!b.length)return 0;const m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const cv=a=>Math.abs(mean(a))<1e-9?0:std(a)/Math.abs(mean(a));

function morphStats(){
  let maxAbs=0,sum=0,n=0,nearSum=0,nearN=0,farSum=0,farN=0;
  for(let x=-220;x<=220;x+=10)for(let z=-205;z<=-48;z+=3){
    const a=Math.abs(K.channelMorphDelta(x,z)),dd=K.nearestTerrainDrainageDistance(x,z);maxAbs=Math.max(maxAbs,a);sum+=a;n++;
    if(dd<18){nearSum+=a;nearN++;}if(dd>26){farSum+=a;farN++;}
  }
  const nearMeanAbs=nearSum/(nearN||1),farMeanAbs=farSum/(farN||1);
  return{maxAbs,meanAbs:sum/n,nearMeanAbs,farMeanAbs,nearFarRatio:nearMeanAbs/(farMeanAbs||1e-9),sampleCount:n};
}
function frameAt(c,u){
  const target=C(u,0,1)*(c.total||1);let i=0;while(i<c.cum.length-2&&c.cum[i+1]<target)i++;
  const a=c.p[i],b=c.p[i+1],seg=(c.cum[i+1]-c.cum[i])||1,t=(target-c.cum[i])/seg;
  const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;
  return{x,z,nx:-dz/L,nz:dx/L};
}
function sectionSamples(Ker){
  const rows=[];
  for(const c of K.terrainChannels){
    for(const u of [.18,.34,.52,.70,.86]){
      const f=frameAt(c,u),p=K.carrierProfile(c,u),r=p.shoulderOffset;
      const center=Ker.height(f.x,f.z),left=Ker.height(f.x+f.nx*r,f.z+f.nz*r),right=Ker.height(f.x-f.nx*r,f.z-f.nz*r);
      rows.push({id:c.id,kind:c.kind,u,center,left,right,relief:(left+right)/2-center,asym:Math.abs(left-right)});
    }
  }
  return rows;
}
function forwardBarrier(Ker){let max=-Infinity,at=null;for(let x=-210;x<=210;x+=10)for(let z=-198;z<=-52;z+=4){const v=Ker.height(x,z+4)-Ker.height(x,z);if(v>max){max=v;at=[x,z]}}return{max,at}}
function protectedDiff(){let rear=0,lower=0,river=0;for(let x=-210;x<=210;x+=30){for(const z of [-285,-250,-220,-215])rear=Math.max(rear,Math.abs(K.height(x,z)-R10.height(x,z)));for(const z of [-40,-20,0,40,100])lower=Math.max(lower,Math.abs(K.height(x,z)-R10.height(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])river=Math.max(river,Math.abs(K.height(x,rz+dz)-R10.height(x,rz+dz)));}return{rear,lower,river}}
const C=(x,a,b)=>Math.max(a,Math.min(b,x));

add('version_is_R045_11',K.VERSION==='R045.11',K.VERSION,'R045.11');
add('water_graph_identity_preserved',K.nodes.length===R10.nodes.length&&K.edges.length===R10.edges.length,{nodes:[R10.nodes.length,K.nodes.length],edges:[R10.edges.length,K.edges.length]},'unchanged');
add('drainage_hierarchy_preserved',K.terrainChannels.some(c=>c.kind==='trunk')&&K.terrainChannels.some(c=>c.kind==='gully')&&K.terrainChannels.some(c=>c.kind==='tributary'),K.terrainChannels.map(c=>({id:c.id,kind:c.kind})),'trunk + gully + tributary');

const profileRows=K.terrainChannels.map(c=>{const us=[.08,.24,.46,.68,.90],p=us.map(u=>K.carrierProfile(c,u));return{id:c.id,kind:c.kind,widthCV:cv(p.map(v=>v.floorWidth)),depthCV:cv(p.map(v=>v.depth)),head:p[0],mid:p[2],exit:p[4]}});
add('carrier_width_is_longitudinally_variable',mean(profileRows.map(r=>r.widthCV))>.075,{meanCV:mean(profileRows.map(r=>r.widthCV)),minCV:Math.min(...profileRows.map(r=>r.widthCV))},'mean width CV >0.075');
add('carrier_depth_is_longitudinally_variable',mean(profileRows.map(r=>r.depthCV))>.11,{meanCV:mean(profileRows.map(r=>r.depthCV)),minCV:Math.min(...profileRows.map(r=>r.depthCV))},'mean depth CV >0.11');
add('head_hollows_are_broader_than_transfer',profileRows.every(r=>r.head.floorWidth>r.mid.floorWidth*1.08),profileRows.map(r=>({id:r.id,ratio:r.head.floorWidth/r.mid.floorWidth})),'all head width / mid width >1.08');
add('head_hollows_are_shallower_than_transfer',profileRows.every(r=>r.head.depth<r.mid.depth*.78),profileRows.map(r=>({id:r.id,ratio:r.head.depth/r.mid.depth})),'all head depth / mid depth <0.78');
add('outlets_fade_in_depth',profileRows.every(r=>r.exit.depth<r.mid.depth*.92),profileRows.map(r=>({id:r.id,ratio:r.exit.depth/r.mid.depth})),'all exit depth / mid depth <0.92');

const morph=morphStats();
add('channel_morphology_is_bounded',morph.maxAbs<2.20,morph,'max |delta| <2.20 m');
add('channel_morphology_tracks_drainage_distance',morph.nearFarRatio>6&&morph.nearMeanAbs>.07,{nearMeanAbs:morph.nearMeanAbs,farMeanAbs:morph.farMeanAbs,nearFarRatio:morph.nearFarRatio},'near/far ratio >6 and near mean >0.07 m');
add('far_interfluves_remain_quiet',morph.farMeanAbs<.075,morph.farMeanAbs,'mean |delta| <0.075 m beyond 26 m');

const oldRows=sectionSamples(R10),newRows=sectionSamples(K),oldAsym=oldRows.map(r=>r.asym),newAsym=newRows.map(r=>r.asym),newRelief=newRows.map(r=>r.relief);
add('bank_bias_does_not_worsen',mean(newAsym)<=mean(oldAsym)+.04,{r10:mean(oldAsym),r11:mean(newAsym),delta:mean(newAsym)-mean(oldAsym)},'R11 mean asym <= R10 +0.04 m');
add('valleys_remain_bounded_not_slot_trenches',Math.max(...newRelief)<6.5,{max:Math.max(...newRelief),mean:mean(newRelief),median:median(newRelief)},'cross-valley relief <6.5 m');

const oldBarrier=forwardBarrier(R10),newBarrier=forwardBarrier(K);
add('segmentation_does_not_create_forward_barrier',newBarrier.max<Math.max(.42,oldBarrier.max+.10),{r10:oldBarrier,r11:newBarrier},'< max(0.42 m, R10 +0.10 m) per 4 m');
const protectedZones=protectedDiff();
add('rear_mountain_controls_unchanged',protectedZones.rear<1e-9,protectedZones.rear,'0');
add('lower_plain_controls_unchanged',protectedZones.lower<1e-9,protectedZones.lower,'0 at sampled z >= -40');
add('front_receiver_controls_unchanged',protectedZones.river<1e-9,protectedZones.river,'0');

const near=[],far=[];let candidate=0,good=0;for(let x=-195;x<=195;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestTerrainDrainageDistance(x,z),p=K.terracePermission(x,z);candidate++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p)}
add('terrace_permission_still_excludes_drainage',mean(near)<.01,mean(near),'<0.01 within 6 m');
add('terrace_permission_remains_available_away_from_drainage',mean(far)>.14,mean(far),'>0.14 beyond 18 m');
add('terrace_candidate_not_global',good/candidate<.65,{good,candidate,fraction:good/candidate},'<65%');

add('invalid_old_terrace_preview_is_not_promoted',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('visual_acceptance_remains_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('parcel_generation_remains_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('terrace_generator_remains_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('water_state_remains_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('morphology_does_not_claim_flow_state',/no active-flow/.test(K.snapshot.drainageMorphologyClass),K.snapshot.drainageMorphologyClass,'explicit no-active-flow claim');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{morph,profiles:profileRows,sections:{r10BankAsymMean:mean(oldAsym),r11BankAsymMean:mean(newAsym),r11ReliefMean:mean(newRelief),r11ReliefMax:Math.max(...newRelief)},forwardBarrier:{r10:oldBarrier,r11:newBarrier},protectedZones,nearDrainagePermission:mean(near),farDrainagePermission:mean(far),terracePermissionAbove065:good/candidate},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round11_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;

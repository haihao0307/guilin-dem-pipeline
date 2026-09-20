import * as R90 from '../round-90/r045_round90_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-90/r045_round90_kernel.mjs';

export const VERSION='R045.91';
export const R91_CONTRACT='R045.91-multiscale-bench-relaxation-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.018,RELAX=.62,EPS=1e-8;
const QC=new Map(),SC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function benchSide(f){return f<=.34?-1:f>=.66?1:0}
function carrier(x,z){return R78.r78CarrierWeightAt(x,z)>1e-12}
function eligibleBench(x,z){const a=R47.terraceStateAt(x,z);return safe(x,z)&&a.mask>.48&&carrier(x,z)&&benchSide(a.frac)!==0}
function sameBenchIdentity(a,b){return benchSide(a.frac)!==0&&benchSide(a.frac)===benchSide(b.frac)&&a.groupIndex===b.groupIndex&&a.index===b.index}
const median=a=>{const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:.5*(b[m-1]+b[m])};
function zero(reason='ineligible'){return{delta:0,requested:0,allowance:0,worstPrior3m:0,projected:false,reason,benchSide:0,neighborCount:0,farNeighborCount:0,axisCount:0,neighborMedian:0,centerBefore:0,localResidual:0,carrierWeight:0}}

export function r91EnvelopeAt(x,z){const c=R90.terraceDelta(x,z);let worst=0;for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R90.terraceDelta(xx,zz)));return{worstPrior3m:worst,allowance:C((PAIR_PROOF-worst)/2,0,ADDED_CAP)}}

// R90 concentrated the cross-slope middle-riser profile, but the fixed view still reads
// broad benches as locally corrugated rather than calm, long platforms. R91 targets that
// remaining measured quantity directly. It performs one non-recursive, multiscale robust
// relaxation step on already accepted R90 broad benches only. Neighbours are sampled at
// 3/6/9 m along the two audit axes, but only when every neighbour is safe, on the same
// lower/upper bench side, same family and exact stair. A query needs >=4 neighbours,
// >=2 neighbours at >=6 m and support on both axes. The target is the predecessor median,
// not a new terrace elevation. Work is <=18 mm and <=half the remaining R90 1.045 m
// predecessor pair margin, so the step cannot create a new 3 m proof crossing when both
// pair endpoints independently move in the worst opposite directions.
export function r91CorrectionAt(x,z){
 const k=key(x,z);if(QC.has(k))return QC.get(k);
 if(!eligibleBench(x,z)){const r=zero();QC.set(k,r);return r}
 const a=R47.terraceStateAt(x,z),vals=[],axes=new Set();let far=0;
 for(const r of[3,6,9])for(const[dx,dz,axis]of[[r,0,'x'],[-r,0,'x'],[0,r,'z'],[0,-r,'z']]){
   const xx=x+dx,zz=z+dz;if(!eligibleBench(xx,zz))continue;const b=R47.terraceStateAt(xx,zz);if(!sameBenchIdentity(a,b))continue;
   vals.push(R90.terraceDelta(xx,zz));axes.add(axis);if(r>=6)far++;
 }
 if(vals.length<4||far<2||axes.size<2){const r=zero('insufficient-multiscale-support');r.benchSide=benchSide(a.frac);r.neighborCount=vals.length;r.farNeighborCount=far;r.axisCount=axes.size;QC.set(k,r);return r}
 const centerBefore=R90.terraceDelta(x,z),neighborMedian=median(vals),localResidual=neighborMedian-centerBefore,w=C(R78.r78CarrierWeightAt(x,z),0,1);
 if(Math.abs(localResidual)<=.00075){const r=zero('already-multiscale-calm');r.benchSide=benchSide(a.frac);r.neighborCount=vals.length;r.farNeighborCount=far;r.axisCount=axes.size;r.neighborMedian=neighborMedian;r.centerBefore=centerBefore;r.localResidual=localResidual;r.carrierWeight=w;QC.set(k,r);return r}
 const requested=C(RELAX*localResidual*w,-ADDED_CAP,ADDED_CAP),env=r91EnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance);
 const out={delta,requested,allowance:env.allowance,worstPrior3m:env.worstPrior3m,projected:Math.abs(delta-requested)>1e-12,reason:Math.abs(delta)>EPS?'multiscale-bench-relaxation':'safety-projected-zero',benchSide:benchSide(a.frac),neighborCount:vals.length,farNeighborCount:far,axisCount:axes.size,neighborMedian,centerBefore,localResidual,carrierWeight:w};QC.set(k,out);return out;
}
function compute(x,z){const p=R90.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r91CorrectionAt(x,z).delta;if(Math.abs(d)<=EPS)return{...p,r91Delta:0};const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;return{...p,raw,delta,target:p.base+delta,r91Delta:d}}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R90.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round91:{scope:'make already accepted R90 broad benches calmer and more platform-like at a 3..9 m morphological scale without enlarging the terrace footprint, changing riser identity, crossing drainage separators, creating parcels or weakening fixed 3 m safety.',method:'apply one bounded non-recursive robust relaxation step to safe R90 broad-bench queries only. Require >=4 same-side, same-family, exact-stair neighbours sampled at 3/6/9 m, >=2 far neighbours and both audit axes; move toward the predecessor median, <=18 mm and <=half the remaining R90 1.045 m predecessor pair margin. Middle risers remain exact locks.',logicCorrection:'a sharper riser profile is not sufficient evidence that the adjoining terrace platforms are calm or visually readable. R90 reduced cross-slope profile residual, but that does not logically imply low within-bench roughness. R91 therefore measures and directly reduces same-identity broad-bench variation instead of substituting changed-point count, maximum displacement or riser concentration as a proxy.',constraint:'the 3/6/9 m sample radii, .34/.66 bench split, 1.045/1.05 m safety gates, 18 mm cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, true parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',xiaomaBoundary:'Xiaoma/TLO remains binding: a calmer geometric bench, sharper riser, shared-looking edge or conservation-style bookkeeping does not establish parcel ownership, hydraulic connectivity, water head/depth/discharge, gate state, soil-water state, sediment state or event state; unobserved state remains unknown.',mrRolordUse:'the retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video remains unavailable for replay, so no replay is claimed and multiscale smoothing is not agricultural truth.',referenceUse:'image(173).png was reread directly from the user library as non-metric morphology evidence: broad light terrace interiors read as calmer platforms between narrow dark contour-following risers, with unequal widths, nested turns and drainage interruptions. No terrace width, riser height, channel section or hydraulic parameter is inferred from the photograph.',predecessor:R90.VERSION,priorAccepted:R90.VERSION}};

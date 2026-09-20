import * as R87 from '../round-87/r045_round87_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-87/r045_round87_kernel.mjs';

export const VERSION='R045.88';
export const R88_CONTRACT='R045.88-proof-preserving-riser-concentration-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.045,MIN_SPAN=.055,MIN_SHAPE=.12;
const QC=new Map(),SC=new Map(),TC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function side(f){return f<=.34?-1:f>=.66?1:0}
function sameStair(a,b){return a.groupIndex===b.groupIndex&&a.index===b.index}
function carrier(x,z){return R78.r78CarrierWeightAt(x,z)>1e-12}
function eligibleRiser(x,z){const a=R47.terraceStateAt(x,z);return safe(x,z)&&a.mask>.48&&side(a.frac)===0&&carrier(x,z)}
function trendEligible(x,z,a){const b=R47.terraceStateAt(x,z);return safe(x,z)&&b.mask>.48&&carrier(x,z)&&sameStair(a,b)}
function zero(reason='ineligible'){return{delta:0,requested:0,allowance:0,worstPrior3m:0,trendSlope:0,trendSpan:0,trendCount:0,shape:0,phaseHalf:0,projected:false,reason}}

export function r88RiserClassAt(x,z){
 const a=R47.terraceStateAt(x,z),s=side(a.frac),isRiser=s===0&&a.mask>.48;
 return{isRiser,benchSide:s,phaseHalf:isRiser?(a.frac<.5?-1:a.frac>.5?1:0):0,frac:a.frac,groupIndex:a.groupIndex,index:a.index,mask:a.mask,safe:safe(x,z),carrier:carrier(x,z)};
}

export function r88EnvelopeAt(x,z){
 const c=R87.terraceDelta(x,z);let worst=0;
 for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R87.terraceDelta(xx,zz)));
 return{worstPrior3m:worst,allowance:C((PAIR_PROOF-worst)/2,0,ADDED_CAP)};
}

export function r88TrendAt(x,z){
 const k=key(x,z);if(TC.has(k))return TC.get(k);
 const a=R47.terraceStateAt(x,z),pts=[];
 for(const[xx,zz]of[[x,z],[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])if(trendEligible(xx,zz,a)){const b=R47.terraceStateAt(xx,zz);pts.push({f:b.frac,d:R87.terraceDelta(xx,zz)})}
 if(pts.length<3){const r={valid:false,count:pts.length,span:0,slope:0};TC.set(k,r);return r}
 const fs=pts.map(p=>p.f),span=Math.max(...fs)-Math.min(...fs);if(span<MIN_SPAN){const r={valid:false,count:pts.length,span,slope:0};TC.set(k,r);return r}
 const mf=fs.reduce((s,v)=>s+v,0)/pts.length,md=pts.reduce((s,p)=>s+p.d,0)/pts.length;
 let cov=0,vf=0;for(const p of pts){cov+=(p.f-mf)*(p.d-md);vf+=(p.f-mf)*(p.f-mf)}const slope=vf>1e-12?cov/vf:0;
 const r={valid:Math.abs(slope)>1e-6,count:pts.length,span,slope};TC.set(k,r);return r;
}

// R87 proved that broad-bench local extrema can be relaxed without pairwise roughening,
// but a flatter bench is not sufficient for a visually legible terrace. The saved user
// reference is dominated by calm bench interiors separated by concentrated narrow risers.
// R88 therefore changes only already-existing, already-accepted middle-phase riser samples.
// It estimates the inherited local stair trend from same-family/exact-stair +/-3 m samples
// and pushes the lower and upper halves away from phase 0.5 in that inherited direction.
// Every endpoint is independently capped by half of the remaining R87 1.045 m pair margin.
// Thus even two endpoints moving oppositely cannot create a new proof crossing. Any inherited
// over-limit transition has zero allowance on both endpoints and is classified before change.
export function r88CorrectionAt(x,z){
 const k=key(x,z);if(QC.has(k))return QC.get(k);
 if(!eligibleRiser(x,z)){const r=zero();QC.set(k,r);return r}
 const a=R47.terraceStateAt(x,z),trend=r88TrendAt(x,z);if(!trend.valid){const r=zero('no-reliable-local-trend');QC.set(k,r);return r}
 const shape=C((a.frac-.5)/.16,-1,1),phaseHalf=shape<0?-1:shape>0?1:0;if(Math.abs(shape)<MIN_SHAPE){const r=zero('near-riser-centre');QC.set(k,r);return r}
 const w=C(R78.r78CarrierWeightAt(x,z),0,1),requested=Math.sign(trend.slope)*shape*ADDED_CAP*w,env=r88EnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance);
 const r={delta,requested,allowance:env.allowance,worstPrior3m:env.worstPrior3m,trendSlope:trend.slope,trendSpan:trend.span,trendCount:trend.count,shape,phaseHalf,projected:Math.abs(delta-requested)>1e-12,reason:Math.abs(delta)>1e-12?'proof-preserving-riser-concentration':'safety-projected-zero'};QC.set(k,r);return r;
}
function compute(x,z){const p=R87.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r88CorrectionAt(x,z).delta;if(Math.abs(d)<=1e-12)return{...p,r88Delta:0};const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;return{...p,raw,delta,target:p.base+delta,r88Delta:d}}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R87.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round88:{
 scope:'preserve accepted R045.87 broad-bench monotonicity while making already-existing riser transitions more concentrated where the predecessor has real safety margin; do not expand footprint, invent parcels or reinterpret drainage separators.',
 method:'classify R47 middle phase (.34 < frac < .66) as the riser transition only on accepted safe carrier. Estimate local stair direction from same-family exact-stair +/-3 m R87 samples, then move lower/upper riser halves away from phase 0.5 in that inherited direction. Added displacement is capped at 45 mm and at half of the remaining 1.045 m predecessor pair margin; broad benches are exact locks.',
 logicCorrection:'two earlier shortcuts are invalid: flatter bench interiors are not sufficient for a visually legible terrace, and a large 3 m height difference is not automatically a spike. The inherited R87 maximum pair is same-family/exact-stair and lies inside the middle-phase transition, so it must be classified as a riser before modification. R88 leaves any inherited over-limit pair with zero allowance rather than smoothing or sharpening it blindly.',
 constraint:'the .34/.66 phase split, 6 m authority lattice, +/-3 m probes, 1.045/1.05 m safety gates, 45 mm added cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, a classified riser, shared-looking edges, flatter benches and conservation-style bookkeeping do not establish hydraulic connectivity, ownership, head, water depth, discharge, gate state, soil-water state, sediment state or event state; unobserved state remains unknown.',
 mrRolordUse:'the retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video remains unavailable for replay, so no replay is claimed and riser concentration is not agricultural truth.',
 referenceUse:'image(173).png was reread non-metrically: broad light bench interiors are separated by narrow dark contour-following risers, with unequal widths, nested turns and drainage interruptions. R88 uses only that contrast relationship; no measured width, riser height, channel section or hydraulic parameter is inferred.',
 predecessor:R87.VERSION,priorAccepted:R87.VERSION}};

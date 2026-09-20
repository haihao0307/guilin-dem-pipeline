import * as R88 from '../round-88/r045_round88_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-88/r045_round88_kernel.mjs';

export const VERSION='R045.89';
export const R89_CONTRACT='R045.89-riser-run-coherence-v2';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.006,PHASE_TOL=.18,EPS=1e-7;
const QC=new Map(),SC=new Map(),UC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function side(f){return f<=.34?-1:f>=.66?1:0}
function half(f){return f<.5?-1:f>.5?1:0}
function sameStair(a,b){return a.groupIndex===b.groupIndex&&a.index===b.index}
function carrier(x,z){return R78.r78CarrierWeightAt(x,z)>1e-12}
function eligibleRiser(x,z){const a=R47.terraceStateAt(x,z);return safe(x,z)&&a.mask>.48&&side(a.frac)===0&&carrier(x,z)&&Math.abs(a.frac-.5)>=.015}
function clearSegment(x,z,xx,zz,a){const d=Math.hypot(xx-x,zz-z),n=Math.max(1,Math.ceil(d/PROBE));for(let k=1;k<n;k++){const t=k/n,px=x+(xx-x)*t,pz=z+(zz-z)*t,b=R47.terraceStateAt(px,pz);if(!safe(px,pz)||!carrier(px,pz)||!sameStair(a,b)||side(b.frac)!==0||half(b.frac)!==half(a.frac)||Math.abs(b.frac-a.frac)>PHASE_TOL+.05)return false}return true}
const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:.5*(b[m-1]+b[m])};
function zero(reason='ineligible'){return{delta:0,requested:0,allowance:0,worstPrior3m:0,supportCount:0,supportTarget:0,supportResidualBefore:0,supportResidualAfter:0,phaseHalf:0,projected:false,reason}}

export function r89EnvelopeAt(x,z){const c=R88.terraceDelta(x,z);let worst=0;for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R88.terraceDelta(xx,zz)));return{worstPrior3m:worst,allowance:C((PAIR_PROOF-worst)/2,0,ADDED_CAP)}}

export function r89SupportAt(x,z){const k=key(x,z);if(UC.has(k))return UC.get(k);if(!eligibleRiser(x,z)){const r={valid:false,count:0,target:0,phaseHalf:0,coherent:0};UC.set(k,r);return r}const a=R47.terraceStateAt(x,z),ph=half(a.frac),vals=[];const offsets=[];for(const r of[3,6,9,12,15,18,21,24])offsets.push([r,0],[-r,0],[0,r],[0,-r],[r,r],[r,-r],[-r,r],[-r,-r]);for(const[dx,dz]of offsets){const xx=x+dx,zz=z+dz;if(!eligibleRiser(xx,zz))continue;const b=R47.terraceStateAt(xx,zz);if(!sameStair(a,b)||half(b.frac)!==ph||Math.abs(b.frac-a.frac)>PHASE_TOL||!clearSegment(x,z,xx,zz,a))continue;const d=R88.r88CorrectionAt(xx,zz).delta;if(Math.abs(d)>EPS)vals.push(d)}if(!vals.length){const r={valid:false,count:0,target:0,phaseHalf:ph,coherent:0};UC.set(k,r);return r}const mean=vals.reduce((s,v)=>s+v,0)/vals.length,coherent=vals.filter(v=>Math.sign(v)===Math.sign(mean)).length/vals.length,target=median(vals);const r={valid:Math.abs(target)>EPS&&coherent>=.67,count:vals.length,target,phaseHalf:ph,coherent};UC.set(k,r);return r}

// R88 proved stronger individual riser samples, but sample amplitude and total directed work
// do not prove a long contour-readable riser. The first R89 attempt made the same proxy error
// in a different form by equating continuity with filling only previously-zero samples: it found
// one off-grid opportunity and no authority-node work. V2 measures spatial coherence directly.
// Each safe middle-riser sample is compared with coherent same-family/exact-stair/same-half R88
// support out to 24 m. It moves only toward the non-recursive R88 median support value, with every
// connecting segment re-probed at <=3 m and every endpoint capped by half the remaining 1.045 m
// predecessor pair margin. This can fill a gap or reduce an amplitude outlier, but cannot bridge a
// drainage interruption, jump terrace identity, recursively grow from R89, or touch broad benches.
export function r89CorrectionAt(x,z){const k=key(x,z);if(QC.has(k))return QC.get(k);if(!eligibleRiser(x,z)){const r=zero();QC.set(k,r);return r}const u=r89SupportAt(x,z);if(!u.valid){const r=zero('no-coherent-run-support');QC.set(k,r);return r}const current=R88.r88CorrectionAt(x,z).delta,residual=u.target-current;if(Math.abs(residual)<=.0005){const r=zero('already-coherent');QC.set(k,r);return r}const w=C(R78.r78CarrierWeightAt(x,z),0,1),requested=C(residual,-ADDED_CAP,ADDED_CAP)*w,env=r89EnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance),after=Math.abs((current+delta)-u.target),before=Math.abs(residual);const r={delta,requested,allowance:env.allowance,worstPrior3m:env.worstPrior3m,supportCount:u.count,supportTarget:u.target,supportResidualBefore:before,supportResidualAfter:after,phaseHalf:u.phaseHalf,projected:Math.abs(delta-requested)>1e-12,reason:Math.abs(delta)>EPS?'supported-riser-run-coherence':'safety-projected-zero'};QC.set(k,r);return r}
function compute(x,z){const p=R88.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r89CorrectionAt(x,z).delta;if(Math.abs(d)<=EPS)return{...p,r89Delta:0};const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;return{...p,raw,delta,target:p.base+delta,r89Delta:d}}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R88.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round89:{scope:'make accepted R88 riser samples spatially coherent along existing contour carrier; no footprint, parcel, drainage or material expansion.',method:'for each safe middle-riser sample, collect non-recursive R88 support within 3..24 m on same family, exact stair and phase half. Every connecting segment is re-probed at <=3 m. Move only toward the median R88 support value, <=6 mm and <=half of remaining 1.045 m predecessor pair margin. Broad benches remain exact locks.',logicCorrection:'maximum riser amplitude and total directed work are not riser continuity, and continuity is not equivalent to filling only zero-valued samples. The first R89 attempt changed one off-grid query and no authority node despite a positive coverage-gain proxy. V2 therefore measures and reduces spatial support residual on the accepted riser run itself.',constraint:'the phase windows, 3..24 m support radii, <=3 m segment probes, 1.045/1.05 m gates, 6 mm cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, a longer or more coherent riser run, shared-looking edges, flatter benches and conservation-style bookkeeping do not establish hydraulic connectivity, ownership, head, water depth, discharge, gate state, soil-water state, sediment state or event state; unobserved state remains unknown.',mrRolordUse:'the retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video remains unavailable for replay, so no replay is claimed and riser coherence is not agricultural truth.',referenceUse:'image(173).png was reread non-metrically: long contour-following dark riser edges separate broad light benches, with unequal widths, nested turns and drainage interruptions. R89 uses the long-edge continuity relationship only; no measured width, riser height, channel section or hydraulic parameter is inferred.',predecessor:R88.VERSION,priorAccepted:R88.VERSION}};

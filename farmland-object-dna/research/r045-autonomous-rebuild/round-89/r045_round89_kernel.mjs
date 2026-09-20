import * as R88 from '../round-88/r045_round88_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-88/r045_round88_kernel.mjs';

export const VERSION='R045.89';
export const R89_CONTRACT='R045.89-riser-run-support-extension-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const PROBE=3,PAIR_PROOF=1.045,ADDED_CAP=.006,PHASE_TOL=.10,EPS=1e-7;
const QC=new Map(),SC=new Map(),UC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
function side(f){return f<=.34?-1:f>=.66?1:0}
function half(f){return f<.5?-1:f>.5?1:0}
function sameStair(a,b){return a.groupIndex===b.groupIndex&&a.index===b.index}
function carrier(x,z){return R78.r78CarrierWeightAt(x,z)>1e-12}
function eligibleRiser(x,z){const a=R47.terraceStateAt(x,z);return safe(x,z)&&a.mask>.48&&side(a.frac)===0&&carrier(x,z)&&Math.abs(a.frac-.5)>=.02}
function clearSegment(x,z,xx,zz,a){const d=Math.hypot(xx-x,zz-z),n=Math.max(1,Math.round(d/PROBE));for(let k=1;k<n;k++){const t=k/n,px=x+(xx-x)*t,pz=z+(zz-z)*t,b=R47.terraceStateAt(px,pz);if(!safe(px,pz)||!carrier(px,pz)||!sameStair(a,b)||side(b.frac)!==0||Math.abs(b.frac-a.frac)>PHASE_TOL+.04)return false}return true}
function zero(reason='ineligible'){return{delta:0,requested:0,allowance:0,worstPrior3m:0,supportCount:0,supportMean:0,supportMedianAbs:0,phaseHalf:0,projected:false,reason}}

export function r89EnvelopeAt(x,z){const c=R88.terraceDelta(x,z);let worst=0;for(const[xx,zz]of[[x+PROBE,z],[x-PROBE,z],[x,z+PROBE],[x,z-PROBE]])worst=Math.max(worst,Math.abs(c-R88.terraceDelta(xx,zz)));return{worstPrior3m:worst,allowance:C((PAIR_PROOF-worst)/2,0,ADDED_CAP)}}

export function r89SupportAt(x,z){const k=key(x,z);if(UC.has(k))return UC.get(k);if(!eligibleRiser(x,z)){const r={valid:false,count:0,mean:0,medianAbs:0,phaseHalf:0};UC.set(k,r);return r}const a=R47.terraceStateAt(x,z),ph=half(a.frac),vals=[];const offsets=[];for(const r of[6,9,12])offsets.push([r,0],[-r,0],[0,r],[0,-r],[r,r],[r,-r],[-r,r],[-r,-r]);for(const[dx,dz]of offsets){const xx=x+dx,zz=z+dz;if(!eligibleRiser(xx,zz))continue;const b=R47.terraceStateAt(xx,zz);if(!sameStair(a,b)||half(b.frac)!==ph||Math.abs(b.frac-a.frac)>PHASE_TOL||!clearSegment(x,z,xx,zz,a))continue;const d=R88.r88CorrectionAt(xx,zz).delta;if(Math.abs(d)>EPS)vals.push(d)}if(!vals.length){const r={valid:false,count:0,mean:0,medianAbs:0,phaseHalf:ph};UC.set(k,r);return r}const mean=vals.reduce((s,v)=>s+v,0)/vals.length,abs=vals.map(Math.abs).sort((a,b)=>a-b),m=Math.floor(abs.length/2),medianAbs=abs.length%2?abs[m]:.5*(abs[m-1]+abs[m]);const coherent=vals.filter(v=>Math.sign(v)===Math.sign(mean)).length/vals.length;const r={valid:Math.abs(mean)>EPS&&coherent>=.67,count:vals.length,mean,medianAbs,phaseHalf:ph,coherent};UC.set(k,r);return r}

// R88 made individual riser samples stronger, but isolated high-amplitude samples do not
// establish a contour-readable riser run. That is a proxy fallacy: amplitude is not continuity.
// R89 changes only R88-zero middle-phase samples that already sit on the accepted safe carrier
// and are spatially supported by a coherent same-family/exact-stair/same-half R88 riser sample.
// Segment probes at 3 m must remain safe, on the same stair, on carrier, and near the same phase,
// so the extension cannot bridge a drainage interruption or jump into a different terrace.
export function r89CorrectionAt(x,z){const k=key(x,z);if(QC.has(k))return QC.get(k);if(!eligibleRiser(x,z)){const r=zero();QC.set(k,r);return r}if(Math.abs(R88.r88CorrectionAt(x,z).delta)>EPS){const r=zero('r88-already-physical');QC.set(k,r);return r}const u=r89SupportAt(x,z);if(!u.valid){const r=zero('no-coherent-run-support');QC.set(k,r);return r}const w=C(R78.r78CarrierWeightAt(x,z),0,1),requested=Math.sign(u.mean)*Math.min(ADDED_CAP,.35*u.medianAbs)*w,env=r89EnvelopeAt(x,z),delta=C(requested,-env.allowance,env.allowance);const r={delta,requested,allowance:env.allowance,worstPrior3m:env.worstPrior3m,supportCount:u.count,supportMean:u.mean,supportMedianAbs:u.medianAbs,phaseHalf:u.phaseHalf,projected:Math.abs(delta-requested)>1e-12,reason:Math.abs(delta)>EPS?'supported-riser-run-extension':'safety-projected-zero'};QC.set(k,r);return r}
function compute(x,z){const p=R88.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=r89CorrectionAt(x,z).delta;if(Math.abs(d)<=EPS)return{...p,r89Delta:0};const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;return{...p,raw,delta,target:p.base+delta,r89Delta:d}}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}

export const snapshot={...R88.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round89:{scope:'extend contour-readable riser runs only inside already accepted R88 terrace carrier; no footprint, parcel, drainage or material expansion.',method:'only R88-zero middle-phase samples may move. Require coherent non-zero R88 support within 6/9/12 m on same family, exact stair and phase half; every 3 m segment probe must remain safe, on carrier and near the same phase. Added correction is <=6 mm and <=half of remaining 1.045 m predecessor pair margin.',logicCorrection:'riser amplitude is not riser continuity. R88 can strengthen isolated samples while the fixed view still lacks a long contour-readable edge. R89 therefore treats continuity as an independent spatial condition rather than inferring it from maximum displacement or total directed work.',constraint:'the phase windows, 6/9/12 m support radii, 3 m segment probes, 1.045/1.05 m gates, 6 mm cap and 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water operations.',xiaomaBoundary:'Xiaoma/TLO remains binding: geometric continuity, a longer riser run, shared-looking edges, flatter benches and conservation-style bookkeeping do not establish hydraulic connectivity, ownership, head, water depth, discharge, gate state, soil-water state, sediment state or event state; unobserved state remains unknown.',mrRolordUse:'the retained MrRolord record is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video remains unavailable for replay, so no replay is claimed and run extension is not agricultural truth.',referenceUse:'image(173).png was reread non-metrically: long contour-following dark riser edges separate broad light benches, with unequal widths, nested turns and drainage interruptions. R89 uses the long-edge relationship only; no measured width, riser height, channel section or hydraulic parameter is inferred.',predecessor:R88.VERSION,priorAccepted:R88.VERSION}};

import * as R68 from '../round-68/r045_round68_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
import * as R72 from '../round-72/r045_round72_kernel.mjs';
export * from '../round-68/r045_round68_kernel.mjs';

export const VERSION='R045.73';
export const R73_CONTRACT='R045.73-identity-clipped-full-carrier-ribbons-v1';
const X0=-216,X1=114,Z0=-126,Z1=6,STEP=6;
const CACHE=new Map(),EXACT=new Map();
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function sameIdentity(a,b){return a.groupIndex===b.groupIndex&&a.index===b.index}
function exactCarrierAt(x,z){
 const k=keyOf(x,z);let v=EXACT.get(k);if(v!==undefined)return v;
 const old=R47.terraceStateAt(x,z),comp=R72.r72ComponentAt(x,z),node=R72.r72NodeAt(x,z);
 const accepted=Boolean(comp.accepted),editable=accepted&&old.mask>.12&&old.mask<.82&&safe(x,z);
 const withinReach=editable&&Number.isFinite(comp.seedDistance)&&comp.seedDistance<=30.000001;
 v={accepted,editable,withinReach,old,comp,node};EXACT.set(k,v);return v;
}
function cornerContribution(x,z,q){
 const e=exactCarrierAt(x,z);return e.withinReach&&sameIdentity(e.old,q)?1:0;
}
function identityWeightAt(x,z){
 if(x<X0||x>X1||z<Z0||z>Z1||!safe(x,z))return 0;
 const q=R47.terraceStateAt(x,z);if(q.mask<=.12||q.mask>=.82)return 0;
 const gx=(x-X0)/STEP,gz=(z-Z0)/STEP,i=Math.floor(gx),j=Math.floor(gz),tx=C(gx-i,0,1),tz=C(gz-j,0,1),xa=X0+i*STEP,za=Z0+j*STEP;
 const w00=(1-tx)*(1-tz),w10=tx*(1-tz),w01=(1-tx)*tz,w11=tx*tz;
 return w00*cornerContribution(xa,za,q)+w10*cornerContribution(xa+STEP,za,q)+w01*cornerContribution(xa,za+STEP,q)+w11*cornerContribution(xa+STEP,za+STEP,q);
}
function ribbonProfile(f,step){return -.070*step*Math.sin(2*Math.PI*f)}
function compute(x,z){
 const prior=R68.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=identityWeightAt(x,z);
 if(w<=1e-12)return{...prior,r73ExpressionWeight:0,r73ProfileCorrection:0,r73Delta:0};
 const maskWindow=S(.12,.28,old.mask)*(1-S(.70,.82,old.mask)),rawCorr=ribbonProfile(old.frac,old.step)*w*maskWindow;
 if(Math.abs(rawCorr)<=1e-12)return{...prior,r73ExpressionWeight:w,r73ProfileCorrection:0,r73Delta:0};
 let dd=.84*old.mask*rawCorr;dd=C(dd,-.090,.090);const delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw,delta,target:prior.base+delta,r73ExpressionWeight:w,r73ProfileCorrection:rawCorr,r73Delta:dd,r73PriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r73CarrierAt(x,z){return exactCarrierAt(x,z)}
export function r73ExpressionWeightAt(x,z){return identityWeightAt(x,z)}
export function r73GraphSummary(){return R72.r72GraphSummary()}
export function terraceGroupMask(x,z){return R68.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R68.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round73:{
 scope:'convert the accepted R72 exact-identity carrier components into longer readable profile ribbons while removing off-grid identity bleed; keep inherited footprint, stair identity, strong cores and drainage separators frozen',
 method:'reuse only R72 components already accepted from frozen R47 same-family + exact-index connectivity and R67 contour evidence seeds. Medium-support nodes may express the ribbon when they lie within 30 m physical distance of a seed. At off-grid render/3 m QA probes, bilinear interpolation is identity-clipped: a corner contributes only when its frozen R47 family and exact stair index match the query point. R73 is reconstructed from accepted R68 geometry rather than stacked on R72, so evidence reach changes do not compound prior unverified corrections.',
 logicCorrection:'R72 correctly separated graph membership, evidence seeding and edit eligibility, but its off-grid interpolation mixed bare expressive bits without checking the query terrace identity. A nonzero interpolated weight can therefore cross a family/index boundary even when every authoritative 6 m node is valid. That is an interpolation-category error: valid node evidence does not license cross-identity surface blending. R73 clips interpolation by the frozen terrace identity and then extends only inside the already accepted component. Longer carrier expression still does not prove visual acceptance.',
 constraint:'the 6 m authoritative lattice, 30 m seed-reach cap, 0.070*step profile, 0.090 m node cap and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometry, adjacency, component continuity and conservation are necessary bookkeeping/evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership.',
 mrRolordUse:'saved MrRolord research is used only for hydrology-first ordering: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'the supplied terrace photograph is used only as non-metric morphology evidence for long nested contour-following benches, unequal widths, curved turns, concentrated riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic identity-clipped component-carried terrace ribbon expression over frozen inherited terrace identity; not surveyed terrace, parcel or hydraulic truth',
 priorR72:R72.VERSION}};

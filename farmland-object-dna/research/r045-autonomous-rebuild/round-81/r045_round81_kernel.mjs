import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-78/r045_round78_kernel.mjs';
export const VERSION='R045.81';
export const R81_CONTRACT='R045.81-full-carrier-bench-riser-profile-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const STEP=6,CAP=.006;
const NC=new Map(),SC=new Map();
const key=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiver(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiver(x,z)}
// Residual between a concentrated stair and a linear ramp: zero at band ends,
// negative on the lower bench, positive on the upper bench, with the transition
// concentrated into 0.44..0.56. Normalized to unit peak without inventing footprint.
function profile(f){return C((S(.44,.56,f)-f)/.44,-1,1)}
function orientation(x,z){const g=R30.gradient(x,z),m=Math.hypot(g.dx,g.dz);if(m<1e-9)return 0;const nx=g.dx/m,nz=g.dz/m;const px=R47.terraceStateAt(x+STEP,z).phase-R47.terraceStateAt(x-STEP,z).phase,pz=R47.terraceStateAt(x,z+STEP).phase-R47.terraceStateAt(x,z-STEP).phase,dp=(px*nx+pz*nz)/(2*STEP);return Math.abs(dp)<1e-4?0:(Math.sign(dp)||0)}
function zero(){return{delta:0,requested:0,orientation:0,carrierWeight:0}}
function node(x,z){const k=key(x,z);if(NC.has(k))return NC.get(k);const old=R47.terraceStateAt(x,z);if(old.mask<=.48||!safe(x,z)){const r=zero();NC.set(k,r);return r}const w=R78.r78CarrierWeightAt(x,z);if(w<=1e-12){const r=zero();NC.set(k,r);return r}const o=orientation(x,z),requested=CAP*o*profile(old.frac)*w;const r={delta:C(requested,-CAP,CAP),requested,orientation:o,carrierWeight:w};NC.set(k,r);return r}
export function r81NodeDeltaAt(x,z){return node(x,z)}
function interp(x,z){if(!safe(x,z))return 0;const old=R47.terraceStateAt(x,z),x0=Math.floor(x/STEP)*STEP,z0=Math.floor(z/STEP)*STEP,tx=(x-x0)/STEP,tz=(z-z0)/STEP;const cs=[[x0,z0,(1-tx)*(1-tz)],[x0+STEP,z0,tx*(1-tz)],[x0,z0+STEP,(1-tx)*tz],[x0+STEP,z0+STEP,tx*tz]];let s=0,w=0;for(const [xx,zz,ww] of cs){if(ww<=0)continue;const c=R47.terraceStateAt(xx,zz);if(c.groupIndex!==old.groupIndex||c.index!==old.index)continue;const d=node(xx,zz).delta;if(Math.abs(d)<=1e-12)continue;s+=ww*d;w+=ww}return w>1e-12?C(s/w,-CAP,CAP):0}
function compute(x,z){const p=R78.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),d=interp(x,z);if(Math.abs(d)<=1e-12)return{...p,r81Delta:0};const delta=p.delta+d,raw=old.mask>1e-9?delta/(.84*old.mask):p.raw;return{...p,raw,delta,target:p.base+delta,r81Delta:d}}
export function terraceStateAt(x,z){const k=key(x,z);if(!SC.has(k))SC.set(k,compute(x,z));return SC.get(k)}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export const snapshot={...R78.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,parcelGenerationEnabled:false,waterStateKnown:false,productionReady:false,round81:{scope:'replace R80 partial phase-window changes with a full accepted-carrier bench/riser residual field, rebuilt from accepted R78; no footprint, family, stair, drainage or parcel changes',logicCorrection:'R80 proved that 23 isolated phase-window changes across three families are not evidence of hillside-scale terrace organization. Lowering the long-run gate would be a proxy-metric fallacy. R81 changes the geometry instead: the whole frozen accepted carrier participates in a zero-end stair-minus-ramp residual, so continuity must emerge from already accepted same-identity carrier evidence.',constraint:'6 m lattice, 6 mm cap, 12 m drainage core and 1.05 m cliff gate are synthetic QA/morphology controls, not surveyed Yunnan dimensions. 12.5 m macro DEM plus photographs cannot recover metre/sub-metre microtopography, true parcels/management boundaries, measured bund/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event water management.',xiaomaBoundary:'geometric continuity, adjacency, shared bund appearance and conservation do not establish hydraulic connectivity, ownership, head, depth, discharge or current state; mesh refinement cannot invent measurements.',mrRolordUse:'retained ordering only: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials; original named video was not available to replay.',referenceUse:'retained image(173).png interpretation is non-metric: long curved contour benches, unequal widths, nested turns, concentrated riser edges and drainage interruptions.',predecessor:'R045.80 failed materiality/long-run candidate; R81 rebuilds from accepted R045.78 rather than stacking on failed R80.'}};
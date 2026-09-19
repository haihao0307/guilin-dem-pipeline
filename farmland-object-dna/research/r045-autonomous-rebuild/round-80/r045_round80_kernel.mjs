import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-78/r045_round78_kernel.mjs';

export const VERSION='R045.80';
export const R80_CONTRACT='R045.80-lattice-anchored-world-profile-v1';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const STEP=6,ADDED_CAP=.006,PAIR_PROOF=1.045;
const NODE_CACHE=new Map(),STATE_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function profileShape(f){if(f<=.34||f>=.66)return 0;if(f<.44)return-S(.34,.44,f);if(f<.46)return-1;if(f<.54)return M(-1,1,S(.46,.54,f));if(f<.56)return 1;return 1-S(.56,.66,f)}
function nodeOrientation(x,z){
 const g=R30.gradient(x,z),gm=Math.hypot(g.dx,g.dz);if(gm<1e-9)return 0;const nx=g.dx/gm,nz=g.dz/gm;
 const hp=R78.height(x+STEP,z),hm=R78.height(x-STEP,z),vp=R78.height(x,z+STEP),vm=R78.height(x,z-STEP);
 const gx=(hp-hm)/(2*STEP),gz=(vp-vm)/(2*STEP);
 const px=R47.terraceStateAt(x+STEP,z).phase-R47.terraceStateAt(x-STEP,z).phase;
 const pz=R47.terraceStateAt(x,z+STEP).phase-R47.terraceStateAt(x,z-STEP).phase;
 const dhdn=gx*nx+gz*nz,dpdn=(px*nx+pz*nz)/(2*STEP);
 if(Math.abs(dhdn)<.02||Math.abs(dpdn)<1e-4)return 0;
 return Math.sign(dhdn*dpdn)||0;
}
function nodeDeltaAt(x,z){
 const k=keyOf(x,z);if(NODE_CACHE.has(k))return NODE_CACHE.get(k);
 const old=R47.terraceStateAt(x,z),w=R78.r78CarrierWeightAt(x,z);
 if(old.mask<=.48||w<=1e-12||!safe(x,z)){const r={delta:0,requested:0,orientation:0,carrierWeight:0,projected:false};NODE_CACHE.set(k,r);return r}
 const ori=nodeOrientation(x,z);if(!ori){const r={delta:0,requested:0,orientation:0,carrierWeight:w,projected:false};NODE_CACHE.set(k,r);return r}
 const requested=ADDED_CAP*ori*profileShape(old.frac)*w;
 const r={delta:C(requested,-ADDED_CAP,ADDED_CAP),requested,orientation:ori,carrierWeight:w,projected:false};NODE_CACHE.set(k,r);return r;
}
export function r80NodeDeltaAt(x,z){return nodeDeltaAt(x,z)}
function interpolatedDelta(x,z){
 if(!safe(x,z))return 0;
 const old=R47.terraceStateAt(x,z),x0=Math.floor(x/STEP)*STEP,z0=Math.floor(z/STEP)*STEP,tx=(x-x0)/STEP,tz=(z-z0)/STEP;
 const corners=[[x0,z0,(1-tx)*(1-tz)],[x0+STEP,z0,tx*(1-tz)],[x0,z0+STEP,(1-tx)*tz],[x0+STEP,z0+STEP,tx*tz]];
 let s=0,w=0;
 for(const [xx,zz,ww]of corners){if(ww<=0)continue;const c=R47.terraceStateAt(xx,zz);if(c.groupIndex!==old.groupIndex||c.index!==old.index)continue;const nd=nodeDeltaAt(xx,zz);if(Math.abs(nd.delta)<=1e-12)continue;s+=ww*nd.delta;w+=ww}
 return w>1e-12?C(s/w,-ADDED_CAP,ADDED_CAP):0;
}
function compute(x,z){const prior=R78.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),dd=interpolatedDelta(x,z);if(Math.abs(dd)<=1e-12)return{...prior,r80Delta:0,r80AddedCap:ADDED_CAP,r80PairProof:PAIR_PROOF};const delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;return{...prior,raw,delta,target:prior.base+delta,r80Delta:dd,r80AddedCap:ADDED_CAP,r80PairProof:PAIR_PROOF}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=STATE_CACHE.get(k);if(v===undefined){v=compute(x,z);STATE_CACHE.set(k,v)}return v}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}

export const snapshot={...R78.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round80:{
 scope:'replace the unfinishable R79 off-grid re-solving path with a lattice-anchored world-profile field over the accepted R78 carrier, while still making a real bench/riser profile change and keeping footprint, identity and drainage frozen',
 method:'at each frozen 6 m carrier node, estimate the world-space terrain normal from the R30 macro gradient and a shared 6 m central stencil of accepted R78 physical height. Use the continuous inherited terrace phase to orient a zero-end shoulder/riser correction, cap each node at 6 mm, then bilinearly interpolate only among nodes with the same frozen family and exact stair index. Query points inside hard drainage or the foreground receiver remain unchanged.',
 logicCorrection:'R79 exposed two separate fallacies. A successful Chrome startup or strict-rule validator does not imply geometry acceptance when the authoritative numeric job times out. Conversely, simply increasing the timeout would hide an execution-path defect rather than strengthen evidence. R80 therefore changes the physical field and its evidence architecture together: shared lattice stencils replace recursive off-grid re-solving, and acceptance is based on world-space predecessor/new consequences, not page startup or change count alone.',
 constraint:'the 6 m lattice, 6 mm cap, 12 m drainage core and 1.05 m cliff gate are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometric adjacency, a shared bund, visual continuity and mass conservation are distinct from hydraulic connectivity, ownership and state. Allowed transfer is not proof of current connection, and mesh refinement cannot invent measurements.',
 mrRolordUse:'latest retained MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. No original named video source was available to replay; procedural displacement is not agricultural truth.',
 referenceUse:'the retained image(173).png reading remains non-metric: hillside-scale long curved contour benches, unequal widths, nested turns, concentrated riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic lattice-anchored world-profile correction over accepted R78 evidence; not surveyed terrace, parcel or hydraulic truth',
 predecessor:'R045.79 failed-candidate target rebuilt from accepted R045.78 rather than stacked on an unverified timeout round',priorAccepted:R78.VERSION}};
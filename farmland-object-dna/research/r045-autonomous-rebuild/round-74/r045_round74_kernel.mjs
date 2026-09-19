import * as R68 from '../round-68/r045_round68_kernel.mjs';
import * as R73 from '../round-73/r045_round73_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
import * as R72 from '../round-72/r045_round72_kernel.mjs';
export * from '../round-73/r045_round73_kernel.mjs';

export const VERSION='R045.74';
export const R74_CONTRACT='R045.74-evidence-dense-strong-carrier-expansion-v1';
const X0=-216,X1=114,Z0=-126,Z1=6,STEP=6;
const CACHE=new Map(),EXACT=new Map();
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function sameIdentity(a,b){return a.groupIndex===b.groupIndex&&a.index===b.index}
function seedDensity(c){return c.size>0?c.seedCount/c.size:0}
function strongDominatedAccepted(c){
 return !c.accepted&&c.size>=7&&c.span>=36&&c.seedCount>=4&&c.seedSpan>=18&&c.strongCount>=4&&c.editableCount>=2&&seedDensity(c)>=.45;
}
function expandedAccepted(c){return Boolean(c.accepted||strongDominatedAccepted(c))}
function exactCarrierAt(x,z){
 const k=keyOf(x,z);let v=EXACT.get(k);if(v!==undefined)return v;
 const old=R47.terraceStateAt(x,z),comp=R72.r72ComponentAt(x,z),node=R72.r72NodeAt(x,z);
 const newlyAccepted=strongDominatedAccepted(comp),accepted=expandedAccepted(comp),editable=newlyAccepted&&old.mask>.12&&old.mask<.82&&safe(x,z);
 v={accepted,newlyAccepted,editable,old,comp,node,seedDensity:seedDensity(comp)};EXACT.set(k,v);return v;
}
function cornerContribution(x,z,q){const e=exactCarrierAt(x,z);return e.editable&&sameIdentity(e.old,q)?1:0}
function newIdentityWeightAt(x,z){
 if(x<X0||x>X1||z<Z0||z>Z1||!safe(x,z))return 0;
 const q=R47.terraceStateAt(x,z);if(q.mask<=.12||q.mask>=.82)return 0;
 const gx=(x-X0)/STEP,gz=(z-Z0)/STEP,i=Math.floor(gx),j=Math.floor(gz),tx=C(gx-i,0,1),tz=C(gz-j,0,1),xa=X0+i*STEP,za=Z0+j*STEP;
 const w00=(1-tx)*(1-tz),w10=tx*(1-tz),w01=(1-tx)*tz,w11=tx*tz;
 return w00*cornerContribution(xa,za,q)+w10*cornerContribution(xa+STEP,za,q)+w01*cornerContribution(xa,za+STEP,q)+w11*cornerContribution(xa+STEP,za+STEP,q);
}
function ribbonProfile(f,step){return -.045*step*Math.sin(2*Math.PI*f)}
function compute(x,z){
 const prior=R73.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=newIdentityWeightAt(x,z);
 if(w<=1e-12)return{...prior,r74ExpressionWeight:0,r74ProfileCorrection:0,r74Delta:0};
 const maskWindow=S(.12,.28,old.mask)*(1-S(.70,.82,old.mask)),rawCorr=ribbonProfile(old.frac,old.step)*w*maskWindow;
 if(Math.abs(rawCorr)<=1e-12)return{...prior,r74ExpressionWeight:w,r74ProfileCorrection:0,r74Delta:0};
 let dd=.84*old.mask*rawCorr;dd=C(dd,-.060,.060);const delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw,delta,target:prior.base+delta,r74ExpressionWeight:w,r74ProfileCorrection:rawCorr,r74Delta:dd,r74PriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r74CarrierAt(x,z){return exactCarrierAt(x,z)}
export function r74ExpressionWeightAt(x,z){return newIdentityWeightAt(x,z)}
export function r74GraphSummary(){
 const b=R72.r72GraphSummary(),components=b.components.map(c=>({...c,seedDensity:seedDensity(c),r74StrongDominated:strongDominatedAccepted(c),r74Accepted:expandedAccepted(c)}));
 const ac=components.filter(c=>c.r74Accepted),nc=components.filter(c=>c.r74StrongDominated),families=[...new Set(ac.map(c=>c.groupIndex))].sort();
 return{...b,components,acceptedComponents:ac.length,acceptedFamilies:families,acceptedNodes:ac.reduce((s,c)=>s+c.size,0),acceptedEditable:ac.reduce((s,c)=>s+c.editableCount,0),acceptedSeeds:ac.reduce((s,c)=>s+c.seedCount,0),strongCarriers:ac.reduce((s,c)=>s+c.strongCount,0),newlyAcceptedComponents:nc.length,newlyAcceptedEditable:nc.reduce((s,c)=>s+c.editableCount,0),newlyAcceptedStrong:nc.reduce((s,c)=>s+c.strongCount,0),newlyAcceptedFamilies:[...new Set(nc.map(c=>c.groupIndex))].sort()};
}
export function terraceGroupMask(x,z){return R73.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R73.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round74:{
 scope:'extend the R73 full-component ribbon expression into evidence-dense strong-dominated inherited terrace components, especially the previously absent middle terrace family, without editing strong carrier cells, changing footprint/stair identity, or relaxing drainage separators',
 method:'retain R73 exactly on all previously accepted components. Add only R72 components that were rejected solely by the >=5 editable-node materiality proxy but have strong independent carrier evidence: >=7 inherited nodes, >=36 m span, >=4 contour-evidence seeds spanning >=18 m, >=4 frozen strong carrier nodes, >=2 editable medium-support nodes, and seed density >=0.45. Only those medium-support nodes are edited; strong nodes stay frozen. Off-grid expression remains family+exact-index clipped and drainage-safe.',
 logicCorrection:'R72 used editableCount>=5 inside component acceptance. That threshold mixed two different questions: whether a component is well evidenced, and how many cells happen to remain editable after strong carrier cells are frozen. A strong-dominated component can have better continuity evidence precisely because most of it is already strong, yet fail merely because only two or three shoulder cells remain editable. Treating low editable count as weak component evidence is a category error. R74 separates evidence density/physical span/strong-carrier continuity from edit opportunity. The correction does not imply that every long component is valid, and adding the missing terrace family still does not prove visual acceptance.',
 constraint:'the 6 m authoritative lattice, >=36 m strong-dominated carrier gate, seed-density threshold, 0.045*step profile, 0.060 m added-node cap and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: geometry, adjacency, component continuity and conservation are necessary bookkeeping/evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership.',
 mrRolordUse:'saved MrRolord research is used only for hydrology-first ordering: river hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'the supplied terrace photograph is used only as non-metric morphology evidence for long nested contour-following benches, unequal widths, curved turns, concentrated riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',
 evidenceClass:'synthetic evidence-dense strong-carrier terrace-ribbon expansion over frozen inherited identity; not surveyed terrace, parcel or hydraulic truth',
 priorR73:R73.VERSION}};
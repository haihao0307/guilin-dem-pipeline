import * as R67 from '../round-67/r045_round67_kernel.mjs';
import * as R66 from '../round-66/r045_round66_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-66/r045_round66_kernel.mjs';

export const VERSION='R045.68';
export const R68_CONTRACT='R045.68-connected-frozen-proposal-components-v1';
const X0=-216,X1=114,Z0=-126,Z1=6,STEP=6;
const CACHE=new Map(),CAND_CACHE=new Map(),LATTICE_INFO=new Map();
let GRAPH_BUILT=false,GRAPH_SUMMARY=null;
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const DIRS=[[-6,-6],[-6,0],[-6,6],[0,-6],[0,6],[6,-6],[6,0],[6,6]];
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;return Math.abs(a.index-b.index)<=1}
function candidateAt(x,z){
 const k=keyOf(x,z);let v=CAND_CACHE.get(k);if(v!==undefined)return v;
 const old=R47.terraceStateAt(x,z),p=R67.terraceStateAt(x,z),base=R66.terraceStateAt(x,z),pred=Math.abs(p.runPredictedDelta||0),physical=Math.abs(p.delta-base.delta),proposalDelta=p.delta-base.delta;
 v={ok:old.mask>.12&&old.mask<.82&&pred>=.0005&&physical>1e-6&&R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z),old,p,base,pred,physical,proposalDelta};
 CAND_CACHE.set(k,v);return v;
}
function physicalSpan(nodes){let m=0;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)m=Math.max(m,Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z));return m}
function buildFrozenGraph(){
 if(GRAPH_BUILT)return;GRAPH_BUILT=true;
 const nodes=new Map();for(let x=X0;x<=X1;x+=STEP)for(let z=Z0;z<=Z1;z+=STEP){const c=candidateAt(x,z);if(c.ok)nodes.set(keyOf(x,z),{x,z,s:c.old})}
 const seen=new Set(),components=[];let acceptedNodes=0;
 for(const [k,start] of nodes){if(seen.has(k))continue;const q=[start],comp=[];seen.add(k);while(q.length){const cur=q.pop();comp.push(cur);for(const[dx,dz]of DIRS){const nk=keyOf(cur.x+dx,cur.z+dz),n=nodes.get(nk);if(!n||seen.has(nk)||!compatible(cur.s,n.s))continue;seen.add(nk);q.push(n)}}const span=physicalSpan(comp),info={size:comp.length,span,accepted:comp.length>=4&&span>=18};if(info.accepted)acceptedNodes+=comp.length;for(const n of comp)LATTICE_INFO.set(keyOf(n.x,n.z),info);components.push({size:comp.length,span,accepted:info.accepted})}
 components.sort((a,b)=>b.size-a.size);GRAPH_SUMMARY={candidateNodes:nodes.size,acceptedNodes,rejectedNodes:nodes.size-acceptedNodes,components};
}
function latticeInfoExact(x,z){buildFrozenGraph();return LATTICE_INFO.get(keyOf(x,z))||{size:0,span:0,accepted:false}}
function acceptedNodeDelta(x,z){if(x<X0||x>X1||z<Z0||z>Z1)return 0;const info=latticeInfoExact(x,z);if(!info.accepted)return 0;const c=CAND_CACHE.get(keyOf(x,z))||candidateAt(x,z);return c.ok?c.proposalDelta:0}
function correctionAt(x,z){
 buildFrozenGraph();if(x<X0||x>X1||z<Z0||z>Z1)return 0;
 const old=R47.terraceStateAt(x,z);if(old.mask<=.12||old.mask>=.82||R30.nearestExtendedDrainageDistance(x,z)<=12||receiverProtected(x,z))return 0;
 const gx=(x-X0)/STEP,gz=(z-Z0)/STEP,i=Math.floor(gx),j=Math.floor(gz),tx=C(gx-i,0,1),tz=C(gz-j,0,1),xa=X0+i*STEP,za=Z0+j*STEP;
 const a=acceptedNodeDelta(xa,za),b=acceptedNodeDelta(xa+STEP,za),c=acceptedNodeDelta(xa,za+STEP),d=acceptedNodeDelta(xa+STEP,za+STEP);
 return M(M(a,b,tx),M(c,d,tx),tz);
}
function acceptanceWeightAt(x,z){
 buildFrozenGraph();if(x<X0||x>X1||z<Z0||z>Z1)return 0;
 const gx=(x-X0)/STEP,gz=(z-Z0)/STEP,i=Math.floor(gx),j=Math.floor(gz),tx=C(gx-i,0,1),tz=C(gz-j,0,1),xa=X0+i*STEP,za=Z0+j*STEP;
 const bit=(xx,zz)=>latticeInfoExact(xx,zz).accepted?1:0;
 return M(M(bit(xa,za),bit(xa+STEP,za),tx),M(bit(xa,za+STEP),bit(xa+STEP,za+STEP),tx),tz);
}
function compute(x,z){
 const prior=R66.terraceStateAt(x,z),corr=correctionAt(x,z),weight=acceptanceWeightAt(x,z);
 if(Math.abs(corr)<=1e-15)return{...prior,r68Candidate:false,r68Accepted:false,r68AcceptanceWeight:weight,r68ComponentSize:0,r68ComponentSpan:0,r68ProposalDelta:0};
 const old=R47.terraceStateAt(x,z),delta=prior.delta+corr,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
 return{...prior,raw,delta,target:prior.base+delta,r68Candidate:true,r68Accepted:weight>.999999,r68AcceptanceWeight:weight,r68ComponentSize:0,r68ComponentSpan:0,r68ProposalDelta:corr,r68PriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r68CandidateAt(x,z){const gx=(x-X0)/STEP,gz=(z-Z0)/STEP;if(Math.abs(gx-Math.round(gx))<1e-9&&Math.abs(gz-Math.round(gz))<1e-9)return candidateAt(x,z);const corr=correctionAt(x,z);return{ok:Math.abs(corr)>1e-15,pred:Math.abs(corr),physical:Math.abs(corr),proposalDelta:corr}}
export function r68ComponentAt(x,z){const gx=(x-X0)/STEP,gz=(z-Z0)/STEP;if(Math.abs(gx-Math.round(gx))<1e-9&&Math.abs(gz-Math.round(gz))<1e-9)return latticeInfoExact(x,z);const w=acceptanceWeightAt(x,z);return{size:0,span:0,accepted:w>.5,weight:w}}
export function r68AcceptanceWeightAt(x,z){return acceptanceWeightAt(x,z)}
export function r68GraphSummary(){buildFrozenGraph();return GRAPH_SUMMARY}
export function terraceGroupMask(x,z){return R66.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R66.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round68:{
 scope:'convert the failed R67 slope-wide proposal from scattered profile edits into only physically extended same-family/same-level contour-run edits, while retaining the accepted R66 footprint, levels and drainage separators exactly',
 method:'treat R67 only as a frozen proposal field over accepted R66 geometry. Build the candidate graph once on the authoritative 6 m slope lattice, using only frozen R67 proposal cells whose predicted physical R67-R66 delta is at least 0.5 mm, inherited R47 support is active but not strong, and drainage/receiver protection is clear. Connect eight-neighbour cells only when inherited family identity matches and terrace index differs by at most one. Accept components only when they contain at least four cells and span at least 18 m in real hypot() distance. Exact audit-lattice nodes either keep the full frozen R67 proposal or return exactly to R66. Between lattice nodes, interpolate only the already-accepted nodal R67-R66 correction values, not fresh off-grid R67 evaluations, and reapply inherited mask/drainage/receiver safety at the queried point. This keeps the browser/3 m probe field continuous while preventing off-grid proposal recomputation from inventing new evidence. R68 output never seeds its own graph.',
 logicCorrection:'R67 exposed two distinct reasoning errors. First, a large count of physically changed cells does not prove macro terrace organization; 72 changed cells still had only 23.6% participation in four-cell-or-longer compatible runs. Second, the persisted R67 result at branch head was generated against a different QA contract than the head QA source after a later edit, so evidence persistence without source provenance can certify the wrong contract. R68 changes the geometry by rejecting isolated proposal edits rather than relaxing the connectivity gate, and its workflow binds every result to the exact source commit and refuses to persist stale evidence after the branch moves.',
 constraint:'the authoritative 6 m compatibility graph, four-cell/18 m acceptance gate, 0.5 mm proposal deadband, between-node interpolation, inherited 12 m drainage core and all profile amplitudes are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity, head/depth/discharge/gate states or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: longer connected contour-run geometry, adjacency and conservation are not evidence of parcel ownership, surveyed riser section, hydraulic exchange, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available in this run to replay, and Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png was re-resolved and reread in this run as non-metric morphology evidence only: broad portions of one agricultural slope read as long curved contour-following benches with unequal widths, nested bends, concentrated darker riser edges and drainage interruptions. No width, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic connected frozen-proposal profile coherence over accepted R66/R47 terrace footprint; not surveyed terrace, parcel or hydraulic truth'
}};
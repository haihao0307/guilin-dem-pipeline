import * as R67 from '../round-67/r045_round67_kernel.mjs';
import * as R66 from '../round-66/r045_round66_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-66/r045_round66_kernel.mjs';

export const VERSION='R045.68';
export const R68_CONTRACT='R045.68-connected-frozen-proposal-components-v1';
const CACHE=new Map(),COMP_CACHE=new Map(),CAND_CACHE=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
const DIRS=[[-6,-6],[-6,0],[-6,6],[0,-6],[0,6],[6,-6],[6,0],[6,6]];
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;return Math.abs(a.index-b.index)<=1}
function candidateAt(x,z){
 const k=keyOf(x,z);let v=CAND_CACHE.get(k);if(v!==undefined)return v;
 const old=R47.terraceStateAt(x,z),p=R67.terraceStateAt(x,z),base=R66.terraceStateAt(x,z),pred=Math.abs(p.runPredictedDelta||0),physical=Math.abs(p.delta-base.delta);
 v={ok:old.mask>.12&&old.mask<.82&&pred>=.0005&&physical>1e-6&&R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z),old,p,base,pred,physical};
 CAND_CACHE.set(k,v);return v;
}
function physicalSpan(nodes){let m=0;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)m=Math.max(m,Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z));return m}
function componentInfoAt(x,z){
 const k=keyOf(x,z);let hit=COMP_CACHE.get(k);if(hit!==undefined)return hit;
 const start=candidateAt(x,z);if(!start.ok){hit={size:0,span:0,accepted:false};COMP_CACHE.set(k,hit);return hit}
 const q=[{x,z,s:start.old}],seen=new Set([k]),nodes=[];
 while(q.length){const cur=q.pop();nodes.push(cur);if(nodes.length>128)break;for(const[dx,dz]of DIRS){const xx=cur.x+dx,zz=cur.z+dz,nk=keyOf(xx,zz);if(seen.has(nk))continue;const c=candidateAt(xx,zz);if(!c.ok||!compatible(cur.s,c.old))continue;seen.add(nk);q.push({x:xx,z:zz,s:c.old})}}
 const span=physicalSpan(nodes),info={size:nodes.length,span,accepted:nodes.length>=4&&span>=18};for(const n of nodes)COMP_CACHE.set(keyOf(n.x,n.z),info);return info;
}
function compute(x,z){
 const prior=R66.terraceStateAt(x,z),proposal=R67.terraceStateAt(x,z),cand=candidateAt(x,z),comp=componentInfoAt(x,z);
 if(!cand.ok||!comp.accepted)return{...prior,r68Candidate:cand.ok,r68Accepted:false,r68ComponentSize:comp.size,r68ComponentSpan:comp.span,r68ProposalDelta:proposal.delta-prior.delta};
 return{...proposal,r68Candidate:true,r68Accepted:true,r68ComponentSize:comp.size,r68ComponentSpan:comp.span,r68ProposalDelta:proposal.delta-prior.delta,r68PriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r68CandidateAt(x,z){return candidateAt(x,z)}
export function r68ComponentAt(x,z){return componentInfoAt(x,z)}
export function terraceGroupMask(x,z){return R66.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R66.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round68:{
 scope:'convert the failed R67 slope-wide proposal from scattered profile edits into only physically extended same-family/same-level contour-run edits, while retaining the accepted R66 footprint, levels and drainage separators exactly',
 method:'treat R67 only as a frozen proposal field over accepted R66 geometry. A proposal cell is eligible only when its predicted physical R67-R66 delta is at least 0.5 mm, its inherited R47 support remains active but not strong, and it stays outside the inherited <=12 m drainage core and foreground receiver band. Build an eight-neighbour 6 m compatibility graph using only frozen proposal cells and inherited family/index identity. Accept the R67 profile correction only when that frozen candidate component contains at least four cells and spans at least 18 m in real hypot() distance. R68 output never seeds the graph, and rejected proposal cells return exactly to R66.',
 logicCorrection:'R67 exposed two distinct reasoning errors. First, a large count of physically changed cells does not prove macro terrace organization; 72 changed cells still had only 23.6% participation in four-cell-or-longer compatible runs. Second, the persisted R67 result at branch head was generated against a different QA contract than the head QA source after a later edit, so evidence persistence without source provenance can certify the wrong contract. R68 changes the geometry by rejecting isolated proposal edits rather than relaxing the connectivity gate, and its workflow binds every result to the exact source commit and refuses to persist stale evidence after the branch moves.',
 constraint:'the 6 m compatibility graph, four-cell/18 m acceptance gate, 0.5 mm proposal deadband, inherited 12 m drainage core and all profile amplitudes are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity, head/depth/discharge/gate states or event-level water management.',
 xiaomaBoundary:'Xiaoma/TLO remains binding: longer connected contour-run geometry, adjacency and conservation are not evidence of parcel ownership, surveyed riser section, hydraulic exchange, head, water depth, discharge, gate state, soil-water state or sediment state.',
 mrRolordUse:'saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video is not available in this run to replay, and Blender/Voronoi/shader dimensions are not agricultural truth.',
 referenceUse:'image(173).png was re-resolved and reread in this run as non-metric morphology evidence only: broad portions of one agricultural slope read as long curved contour-following benches with unequal widths, nested bends, concentrated darker riser edges and drainage interruptions. No width, riser height, channel size or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic connected frozen-proposal profile coherence over accepted R66/R47 terrace footprint; not surveyed terrace, parcel or hydraulic truth'
}};
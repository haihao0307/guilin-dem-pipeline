import * as R68 from '../round-68/r045_round68_kernel.mjs';
import * as R67 from '../round-67/r045_round67_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
import * as R70 from '../round-70/r045_round70_kernel.mjs';
export * from '../round-68/r045_round68_kernel.mjs';

export const VERSION='R045.71';
export const R71_CONTRACT='R045.71-strong-support-carrier-ribbons-v1';
const X0=-216,X1=114,Z0=-126,Z1=6,STEP=6;
const CACHE=new Map(),NODE_CACHE=new Map(),INFO=new Map();
let GRAPH_BUILT=false,GRAPH_SUMMARY=null;
const DIRS=[[-6,-6],[-6,0],[-6,6],[0,-6],[0,6],[6,-6],[6,0],[6,6]];
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const M=(a,b,t)=>a+(b-a)*t;
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function receiverProtected(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}
function safe(x,z){return R30.nearestExtendedDrainageDistance(x,z)>12&&!receiverProtected(x,z)}
function nodeEvidenceAt(x,z){
  const k=keyOf(x,z);let v=NODE_CACHE.get(k);if(v!==undefined)return v;
  const old=R47.terraceStateAt(x,z),ev=R67.contourRunEvidenceAt(x,z);
  const structural=old.mask>.12&&safe(x,z)&&ev.coherence>=.30&&ev.span>=24&&ev.supports>=4;
  const editable=structural&&old.mask<.82;
  v={ok:structural,structural,editable,old,ev};NODE_CACHE.set(k,v);return v;
}
function sameRibbon(a,b){return a.s.groupIndex===b.s.groupIndex&&a.s.index===b.s.index}
function physicalSpan(nodes){let m=0;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)m=Math.max(m,Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z));return m}
function buildGraph(){
  if(GRAPH_BUILT)return;GRAPH_BUILT=true;
  const nodes=new Map();
  for(let x=X0;x<=X1;x+=STEP)for(let z=Z0;z<=Z1;z+=STEP){const e=nodeEvidenceAt(x,z);if(e.structural)nodes.set(keyOf(x,z),{x,z,s:e.old,ev:e.ev,editable:e.editable})}
  const seen=new Set(),components=[];let acceptedStructural=0,acceptedEditable=0;const families=new Set();
  for(const [k,start] of nodes){
    if(seen.has(k))continue;const q=[start],comp=[];seen.add(k);
    while(q.length){const cur=q.pop();comp.push(cur);for(const[dx,dz]of DIRS){const nk=keyOf(cur.x+dx,cur.z+dz),n=nodes.get(nk);if(!n||seen.has(nk)||!sameRibbon(cur,n))continue;seen.add(nk);q.push(n)}}
    const span=physicalSpan(comp),editableCount=comp.filter(n=>n.editable).length;
    const accepted=comp.length>=5&&span>=24&&editableCount>=3;
    const info={size:comp.length,span,editableCount,accepted,groupIndex:comp[0]?.s.groupIndex??-1,index:comp[0]?.s.index??-1};
    if(accepted){acceptedStructural+=comp.length;acceptedEditable+=editableCount;families.add(info.groupIndex)}
    for(const n of comp)INFO.set(keyOf(n.x,n.z),info);components.push(info);
  }
  components.sort((a,b)=>b.span-a.span||b.size-a.size);
  GRAPH_SUMMARY={structuralNodes:nodes.size,acceptedStructural,acceptedEditable,rejectedStructural:nodes.size-acceptedStructural,acceptedComponents:components.filter(c=>c.accepted).length,acceptedFamilies:[...families].sort(),components};
}
function infoExact(x,z){buildGraph();return INFO.get(keyOf(x,z))||{size:0,span:0,editableCount:0,accepted:false,groupIndex:-1,index:-1}}
function acceptedBit(x,z){return infoExact(x,z).accepted?1:0}
function acceptanceWeightAt(x,z){
  buildGraph();if(x<X0||x>X1||z<Z0||z>Z1||!safe(x,z))return 0;
  const old=R47.terraceStateAt(x,z);if(old.mask<=.12||old.mask>=.82)return 0;
  const gx=(x-X0)/STEP,gz=(z-Z0)/STEP,i=Math.floor(gx),j=Math.floor(gz),tx=C(gx-i,0,1),tz=C(gz-j,0,1),xa=X0+i*STEP,za=Z0+j*STEP;
  return M(M(acceptedBit(xa,za),acceptedBit(xa+STEP,za),tx),M(acceptedBit(xa,za+STEP),acceptedBit(xa+STEP,za+STEP),tx),tz);
}
function ribbonProfile(f,step){return -.045*step*Math.sin(2*Math.PI*f)}
function compute(x,z){
  const prior=R68.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=acceptanceWeightAt(x,z);
  if(w<=1e-12)return{...prior,r71RibbonWeight:0,r71ProfileCorrection:0,r71Delta:0};
  const maskWindow=S(.12,.28,old.mask)*(1-S(.70,.82,old.mask)),rawCorr=ribbonProfile(old.frac,old.step)*w*maskWindow;
  if(Math.abs(rawCorr)<=1e-12)return{...prior,r71RibbonWeight:w,r71ProfileCorrection:0,r71Delta:0};
  let dd=.84*old.mask*rawCorr;dd=C(dd,-.060,.060);const delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
  return{...prior,raw,delta,target:prior.base+delta,r71RibbonWeight:w,r71ProfileCorrection:rawCorr,r71Delta:dd,r71PriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r71NodeEvidenceAt(x,z){return nodeEvidenceAt(x,z)}
export function r71ComponentAt(x,z){return infoExact(x,z)}
export function r71AcceptanceWeightAt(x,z){return acceptanceWeightAt(x,z)}
export function r71GraphSummary(){buildGraph();return GRAPH_SUMMARY}
export function terraceGroupMask(x,z){return R68.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R68.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round71:{scope:'promote inherited strong terrace support from an exclusion zone into a frozen structural carrier that can connect medium-support contour evidence without changing the strong geometry itself',method:'build the same-family + exact-index contour graph on every safe inherited active R47 node that carries R67 bilateral contour evidence, including mask >=0.82 nodes as frozen carrier nodes. A component is accepted only when it has >=5 structural nodes, >=24 m physical span and >=3 editable medium-support nodes. Profile correction is applied only where inherited mask is 0.12..0.82; strong carrier nodes remain exactly R68. This separates topological evidence from edit eligibility instead of deleting the strongest parts of a ribbon from its own graph.',logicCorrection:'R70 made a carrier-set/edit-set category error: it excluded inherited mask >=0.82 nodes from the connectivity graph because those nodes were not editable. Non-editable does not mean non-evidentiary. Strong inherited terrace support can legitimately connect two medium-support shoulders while remaining geometrically frozen. The converse is also false: a larger connected carrier graph does not prove visual acceptance, so fixed-camera A/B remains independent.',constraint:'the 6 m audit lattice, bilateral-run thresholds, five-node/24 m carrier gate, 0.045*step sine profile, 0.060 m correction cap and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real management parcels, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity or event-level water management.',xiaomaBoundary:'Xiaoma/TLO remains binding: stronger contour continuity, adjacency and conservation do not establish parcel ownership, surveyed riser section, hydraulic exchange, head, depth, discharge, gate state, soil-water state or sediment state.',mrRolordUse:'the saved MrRolord research is used only for hydrology-first ordering: river hierarchy -> accumulated terrain influence -> terrain-conforming land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision are not agricultural truth and are not copied literally.',referenceUse:'the supplied terrace reference is used only as non-metric morphology evidence: long nested contour-following bands, unequal widths, curved turns, concentrated riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred from the photograph.',evidenceClass:'synthetic strong-support carrier graph with medium-support profile expression; not surveyed terrace, parcel or hydraulic truth',priorR70:R70.VERSION}};

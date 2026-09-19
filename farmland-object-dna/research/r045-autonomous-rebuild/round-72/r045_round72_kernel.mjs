import * as R68 from '../round-68/r045_round68_kernel.mjs';
import * as R67 from '../round-67/r045_round67_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
import * as R71 from '../round-71/r045_round71_kernel.mjs';
export * from '../round-68/r045_round68_kernel.mjs';

export const VERSION='R045.72';
export const R72_CONTRACT='R045.72-component-seeded-carrier-ribbons-v1';
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
function nodeAt(x,z){
  const k=keyOf(x,z);let v=NODE_CACHE.get(k);if(v!==undefined)return v;
  const old=R47.terraceStateAt(x,z);
  if(old.mask<=.12||!safe(x,z)){v={active:false,seed:false,editable:false,old,ev:null};NODE_CACHE.set(k,v);return v}
  const ev=R67.contourRunEvidenceAt(x,z);
  const seed=ev.coherence>=.30&&ev.span>=24&&ev.supports>=4;
  v={active:true,seed,editable:old.mask<.82,old,ev};NODE_CACHE.set(k,v);return v;
}
function sameRibbon(a,b){return a.old.groupIndex===b.old.groupIndex&&a.old.index===b.old.index}
function span(nodes){let m=0;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)m=Math.max(m,Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z));return m}
function distToSeeds(n,seeds){let d=Infinity;for(const s of seeds)d=Math.min(d,Math.hypot(n.x-s.x,n.z-s.z));return d}
function buildGraph(){
  if(GRAPH_BUILT)return;GRAPH_BUILT=true;
  const nodes=new Map();
  for(let x=X0;x<=X1;x+=STEP)for(let z=Z0;z<=Z1;z+=STEP){const e=nodeAt(x,z);if(e.active)nodes.set(keyOf(x,z),{x,z,...e})}
  const seen=new Set(),components=[];let acceptedNodes=0,acceptedEditable=0,acceptedExpressive=0,acceptedSeeds=0,strongCarriers=0;const families=new Set();
  for(const [k,start] of nodes){
    if(seen.has(k))continue;const q=[start],comp=[];seen.add(k);
    while(q.length){const cur=q.pop();comp.push(cur);for(const[dx,dz]of DIRS){const nk=keyOf(cur.x+dx,cur.z+dz),n=nodes.get(nk);if(!n||seen.has(nk)||!sameRibbon(cur,n))continue;seen.add(nk);q.push(n)}}
    const seeds=comp.filter(n=>n.seed),editable=comp.filter(n=>n.editable),strong=comp.filter(n=>!n.editable),compSpan=span(comp),seedSpan=span(seeds);
    const accepted=comp.length>=6&&compSpan>=24&&seeds.length>=3&&seedSpan>=18&&editable.length>=5&&strong.length>=1;
    const expressive=new Set();if(accepted)for(const n of editable)if(distToSeeds(n,seeds)<=18.000001)expressive.add(keyOf(n.x,n.z));
    const info={size:comp.length,span:compSpan,seedCount:seeds.length,seedSpan,editableCount:editable.length,strongCount:strong.length,expressiveCount:expressive.size,accepted,groupIndex:comp[0]?.old.groupIndex??-1,index:comp[0]?.old.index??-1};
    if(accepted){acceptedNodes+=comp.length;acceptedEditable+=editable.length;acceptedExpressive+=expressive.size;acceptedSeeds+=seeds.length;strongCarriers+=strong.length;families.add(info.groupIndex)}
    for(const n of comp)INFO.set(keyOf(n.x,n.z),{...info,seed:n.seed,editable:n.editable,expressive:expressive.has(keyOf(n.x,n.z)),seedDistance:n.editable?distToSeeds(n,seeds):0});components.push(info);
  }
  components.sort((a,b)=>b.span-a.span||b.size-a.size);
  GRAPH_SUMMARY={activeNodes:nodes.size,acceptedNodes,acceptedEditable,acceptedExpressive,acceptedSeeds,strongCarriers,acceptedComponents:components.filter(c=>c.accepted).length,acceptedFamilies:[...families].sort(),components};
}
function infoAtExact(x,z){buildGraph();return INFO.get(keyOf(x,z))||{size:0,span:0,seedCount:0,seedSpan:0,editableCount:0,strongCount:0,expressiveCount:0,accepted:false,seed:false,editable:false,expressive:false,seedDistance:Infinity,groupIndex:-1,index:-1}}
function expressiveBit(x,z){const i=infoAtExact(x,z);return i.accepted&&i.expressive?1:0}
function expressionWeightAt(x,z){
  buildGraph();if(x<X0||x>X1||z<Z0||z>Z1||!safe(x,z))return 0;
  const old=R47.terraceStateAt(x,z);if(old.mask<=.12||old.mask>=.82)return 0;
  const gx=(x-X0)/STEP,gz=(z-Z0)/STEP,i=Math.floor(gx),j=Math.floor(gz),tx=C(gx-i,0,1),tz=C(gz-j,0,1),xa=X0+i*STEP,za=Z0+j*STEP;
  return M(M(expressiveBit(xa,za),expressiveBit(xa+STEP,za),tx),M(expressiveBit(xa,za+STEP),expressiveBit(xa+STEP,za+STEP),tx),tz);
}
function profile(f,step){return -.045*step*Math.sin(2*Math.PI*f)}
function compute(x,z){
  const prior=R68.terraceStateAt(x,z),old=R47.terraceStateAt(x,z),w=expressionWeightAt(x,z);
  if(w<=1e-12)return{...prior,r72ExpressionWeight:0,r72ProfileCorrection:0,r72Delta:0};
  const maskWindow=S(.12,.28,old.mask)*(1-S(.70,.82,old.mask)),rawCorr=profile(old.frac,old.step)*w*maskWindow;
  if(Math.abs(rawCorr)<=1e-12)return{...prior,r72ExpressionWeight:w,r72ProfileCorrection:0,r72Delta:0};
  let dd=.84*old.mask*rawCorr;dd=C(dd,-.060,.060);const delta=prior.delta+dd,raw=old.mask>1e-9?delta/(.84*old.mask):prior.raw;
  return{...prior,raw,delta,target:prior.base+delta,r72ExpressionWeight:w,r72ProfileCorrection:rawCorr,r72Delta:dd,r72PriorDelta:prior.delta};
}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE.get(k);if(v===undefined){v=compute(x,z);CACHE.set(k,v)}return v}
export function r72NodeAt(x,z){return nodeAt(x,z)}
export function r72ComponentAt(x,z){return infoAtExact(x,z)}
export function r72ExpressionWeightAt(x,z){return expressionWeightAt(x,z)}
export function r72GraphSummary(){buildGraph();return GRAPH_SUMMARY}
export function terraceGroupMask(x,z){return R68.terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=R47.terraceStateAt(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export const snapshot={...R68.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,waterStateKnown:false,round72:{scope:'turn frozen R47 terrace identity into the carrier graph and use R67 bilateral contour evidence as component-level seeds, so verified strong core can carry evidence across medium-support shoulders without requiring every editable cell to independently re-prove the whole contour run',method:'build the safe inherited active R47 graph using exact terrace family + exact terrace index. R67 bilateral contour evidence marks seeds rather than defining the graph itself. Accept only components with >=6 inherited active nodes, >=24 m physical span, >=3 evidence seeds spanning >=18 m, >=5 medium-support editable nodes and >=1 frozen strong-support carrier. Expression is further limited to editable nodes within 18 m of an evidence seed. Strong support and all footprint/index geometry remain frozen.',logicCorrection:'R71 fixed the carrier/edit category error and proved a 51.26 m evidence span, but it still required every editable graph node to be an R67 evidence seed. That silently reintroduced the same local-proof bottleneck: component-level evidence was being discovered but not allowed to support adjacent cells of the exact same inherited terrace identity. The correction is not to relax family/index or drainage identity; it is to separate graph membership, evidence seeding and edit eligibility. A component-level seed does not prove visual acceptance or field truth.',constraint:'the 6 m audit lattice, 18 m seed-expression radius, component/seed counts, 0.045*step profile, 0.060 m cap and inherited 12 m drainage core are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity, or event-level water management.',xiaomaBoundary:'Xiaoma/TLO remains binding: geometry, adjacency, component continuity and conservation are necessary bookkeeping/evidence relations but do not establish hydraulic exchange law, head, depth, discharge, gate state, soil-water state, sediment state or parcel ownership.',mrRolordUse:'saved MrRolord research is used only for hydrology-first ordering: river hierarchy -> accumulated terrain influence -> terrain-conforming land use -> paths/vegetation/materials. Voronoi, shader displacement and adaptive subdivision are not agricultural truth.',referenceUse:'the supplied terrace photograph is used only as non-metric morphology evidence for long nested contour-following benches, unequal widths, curved turns, concentrated riser edges and drainage interruptions. No field width, riser height, channel section or hydraulic parameter is inferred.',evidenceClass:'synthetic component-seeded terrace ribbon expression over frozen inherited terrace identity; not surveyed terrace, parcel or hydraulic truth',priorR71:R71.VERSION}};

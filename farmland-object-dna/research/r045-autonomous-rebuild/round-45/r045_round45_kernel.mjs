import * as R43 from '../round-43/r045_round43_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
export * from '../round-43/r045_round43_kernel.mjs';

export const VERSION='R045.45';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ACTIVE=.12,DX=6,DZ=6,X0=-222,X1=120,Z0=-132,Z1=12;
const DIRS=[[1,0,'contour-x'],[0,1,'contour-z'],[1,1,'diag-down'],[1,-1,'diag-up']];
const CACHE43=new Map(),CACHE45=new Map();
const keyOf=(x,z)=>`${Number(x).toFixed(4)},${Number(z).toFixed(4)}`;
function r43At(x,z){const k=keyOf(x,z);let v=CACHE43.get(k);if(v===undefined){v=R43.terraceStateAt(x,z);CACHE43.set(k,v)}return v}
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=5}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function latticeKey(ix,iz){return `${ix},${iz}`}
const NX=Math.round((X1-X0)/DX)+1,NZ=Math.round((Z1-Z0)/DZ)+1;
const LATTICE=Array.from({length:NZ},(_,j)=>Array.from({length:NX},(_,i)=>{const x=X0+i*DX,z=Z0+j*DZ;return{x,z,s:r43At(x,z)}}));
const LABEL=Array.from({length:NZ},()=>Array(NX).fill(-1));
const COMP_SIZES=[];
(function buildComponents(){const dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];let id=0;for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){if(LABEL[j][i]>=0||LATTICE[j][i].s.mask<=ACTIVE)continue;LABEL[j][i]=id;const q=[[i,j]];let n=0;while(q.length){const [cx,cz]=q.pop(),a=LATTICE[cz][cx].s;n++;for(const [di,dj] of dirs){const ni=cx+di,nj=cz+dj;if(ni<0||ni>=NX||nj<0||nj>=NZ||LABEL[nj][ni]>=0)continue;const b=LATTICE[nj][ni].s;if(b.mask<=ACTIVE||!compatible(a,b))continue;LABEL[nj][ni]=id;q.push([ni,nj])}}COMP_SIZES[id]=n;id++}})();
function inGrid(i,j){return i>=0&&i<NX&&j>=0&&j<NZ}
function midpointSafe(ax,az,bx,bz){return safetyAt(.5*(ax+bx),.5*(az+bz))>.08}
function weakCompatibleCell(i,j,target){if(!inGrid(i,j))return null;const c=LATTICE[j][i],s=c.s;if(s.mask<=.02||s.mask>ACTIVE||!compatible(target,s)||safetyAt(c.x,c.z)<=.08)return null;return c}
function findActiveAnchor(i,j,di,dj,sgn,target,maxN=9){for(let n=1;n<=maxN;n++){const ii=i+sgn*di*n,jj=j+sgn*dj*n;if(!inGrid(ii,jj))return null;const c=LATTICE[jj][ii],s=c.s;if(s.mask>ACTIVE){if(!compatible(target,s))return null;return{...c,i:ii,j:jj,n,label:LABEL[jj][ii]}}if(!weakCompatibleCell(ii,jj,target))return null;const prevI=i+sgn*di*(n-1),prevJ=j+sgn*dj*(n-1),p=LATTICE[prevJ][prevI];if(!midpointSafe(p.x,p.z,c.x,c.z))return null}return null}
function corridorCells(i,j,di,dj,left,right,target){const cells=[];for(let k=-left.n+1;k<=right.n-1;k++){const ii=i+di*k,jj=j+dj*k;if(!inGrid(ii,jj))return null;const c=weakCompatibleCell(ii,jj,target);if(!c)return null;cells.push({...c,i:ii,j:jj});if(k<right.n-1){const ni=i+di*(k+1),nj=j+dj*(k+1),d=LATTICE[nj][ni];if(!midpointSafe(c.x,c.z,d.x,d.z))return null}}return cells}
const SEEDS=[];
(function buildSeeds(){const seen=new Set();for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const target=LATTICE[j][i].s;if(target.mask<=.02||target.mask>ACTIVE||safetyAt(LATTICE[j][i].x,LATTICE[j][i].z)<=.08)continue;for(const [di,dj,name] of DIRS){const left=findActiveAnchor(i,j,di,dj,-1,target),right=findActiveAnchor(i,j,di,dj,1,target);if(!left||!right||left.label<0||right.label<0||left.label===right.label||!compatible(left.s,right.s))continue;const weakCount=left.n+right.n-1;if(weakCount<1||weakCount>8)continue;const cells=corridorCells(i,j,di,dj,left,right,target);if(!cells||cells.length!==weakCount)continue;const pair=[left.label,right.label].sort((a,b)=>a-b).join(':');for(const c of cells){const k=latticeKey(c.i,c.j);if(seen.has(k))continue;seen.add(k);SEEDS.push({x:c.x,z:c.z,i:c.i,j:c.j,groupIndex:c.s.groupIndex,leftLabel:left.label,rightLabel:right.label,leftN:left.n,rightN:right.n,weakCount,direction:name,pair,anchorMasks:[left.s.mask,right.s.mask],componentSizes:[COMP_SIZES[left.label],COMP_SIZES[right.label]]})}}})();
const SEED_BUCKET=new Map();for(const s of SEEDS){const k=latticeKey(s.i,s.j);if(!SEED_BUCKET.has(k))SEED_BUCKET.set(k,[]);SEED_BUCKET.get(k).push(s)}
export function gapClosureSeeds(){return SEEDS.map(s=>({...s}))}
function nearestClosureSupport(x,z,base){if(base.mask>ACTIVE||base.mask<=.015||safetyAt(x,z)<=.08)return null;const fi=(x-X0)/DX,fj=(z-Z0)/DZ,ci=Math.round(fi),cj=Math.round(fj);let best=null;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const arr=SEED_BUCKET.get(latticeKey(ci+di,cj+dj));if(!arr)continue;for(const seed of arr){if(seed.groupIndex!==base.groupIndex)continue;const d=Math.hypot(x-seed.x,z-seed.z),r=5.6;if(d>=r)continue;const q=LATTICE[seed.j][seed.i].s;if(!compatible(base,q))continue;const w=1-S(.8*r,r,d),score=w*(1+.03*Math.min(...seed.componentSizes));if(!best||score>best.score)best={...seed,distance:d,weight:w,score,mode:'frozen-component-gap-closure'}}}return best}
export function macroGapClosureSupportAt(x,z){return nearestClosureSupport(x,z,r43At(x,z))}
export function macroGapClosureGain(x,z){const base=r43At(x,z);if(base.mask>ACTIVE)return 0;const sup=macroGapClosureSupportAt(x,z);if(!sup)return 0;const safe=safetyAt(x,z),target=C(.145+.075*sup.weight+.035*safe,.148,.255),rawAbs=Math.abs(base.raw),deltaBound=rawAbs>1e-9?.22/(.84*rawAbs):.28;return C(Math.max(0,target-base.mask),0,Math.min(.28,deltaBound))}
function computeTerraceState(x,z){const base=r43At(x,z);if(base.mask>ACTIVE)return{...base,macroGapClosureGain:0,macroGapClosureSupport:null};const gain=macroGapClosureGain(x,z),mask=C(base.mask+gain,0,1),delta=.84*mask*base.raw,sup=gain>0?macroGapClosureSupportAt(x,z):null;return{...base,mask,delta,target:base.base+delta,macroGapClosureGain:gain,macroGapClosureSupport:sup}}
export function terraceStateAt(x,z){const k=keyOf(x,z);let v=CACHE45.get(k);if(v===undefined){v=computeTerraceState(x,z);CACHE45.set(k,v)}return v}
export function terraceGroupMask(x,z){return terraceStateAt(x,z).mask}
export function terraceFrameAt(x,z){const s=r43At(x,z);return{step:s.step,phase:s.phase}}
export function terraceDelta(x,z){return terraceStateAt(x,z).delta}
export function height(x,z){return R30.height(x,z)+terraceDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R30.terracePermission(x,z)}
export function suitability(x,z){return R30.suitability(x,z)}

export const snapshot={...R43.snapshot,version:VERSION,visualAcceptance:false,browserQA:false,productionReady:false,parcelGenerationEnabled:false,terraceGeometryEnabled:true,terracePilotPreviewEnabled:true,waterStateKnown:false,round45:{
 scope:'replace R44 same-component ribbon lengthening with bounded closures that are allowed only when they connect two distinct frozen-R43 compatible terrace components across an entirely safe weak gap',
 method:'build the accepted R43 active lattice and its same-family/stair-compatible 2-D components first. A weak corridor is promoted only when frozen active anchors from two different R43 components exist on opposite sides along one of four lattice directions, every intervening cell is weak/same-family/stair-compatible, every 6 m cell and 3 m segment midpoint clears the agricultural, drainage and foreground-receiver safety gates, and the total weak gap is at most eight 6 m cells. R45 cells never seed R45 cells. Existing R43 active surfaces and the inherited 0.84 multiplier, stair step, phase and raw response remain exact.',
 logicCorrection:'R44 proved that adding more locally supported cells can leave the compatible component count unchanged; local support density is therefore not sufficient evidence of macroscopic terrace organization. Browser success also cannot compensate for a failed numeric topology gate. R45 does not lower the gate or amplify risers; it targets only frozen gaps whose opposite anchors belong to different accepted R43 components and validates every intervening cell and midpoint so a synthetic closure cannot jump across a protected drainage separator.',
 constraint:'the 6 m QA lattice, up-to-eight-cell synthetic gap limit, four search directions, radial closure interpolation, 12 m hard drainage core and generated component closures are morphology/QA parameters, not surveyed Yunnan terrace dimensions, branch locations or measured hydraulic connectivity. Current 12.5 m macro DEM and photographs cannot provide field microtopography, parcel/management boundaries, bund-riser-channel sections, inlet/outlet sill elevations, hydraulic connectivity or event water-management records.',
 xiaomaBoundary:'Xiaoma/TLO boundaries remain active: a continuous displayed surface or a conserved ledger does not establish legal parcel connection, shared-edge identity, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state without field-scale evidence.',
 mrRolordUse:'the saved MrRolord frame audit is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. Voronoi, Blender dimensions, shader displacement and adaptive subdivision are not agricultural truth.',
 referenceUse:'image(173).png is reread only for non-metric morphology: long curved contour-following ribbons, unequal widths, nested organization, local branching/remerging and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.',
 evidenceClass:'synthetic frozen-R43 inter-component gap closure; not surveyed terrace, parcel or hydraulic truth',
 seedCount:SEEDS.length,
 componentCount:COMP_SIZES.length,
 forbiddenClaims:['surveyed terrace footprint','surveyed branch location','surveyed merge location','measured terrace width','measured continuation length','measured riser height','measured bund section','measured channel section','known inlet sill','known outlet sill','known hydraulic connectivity','known water depth','known discharge','known gate state','known soil-water state','regional truth from photograph']
}};

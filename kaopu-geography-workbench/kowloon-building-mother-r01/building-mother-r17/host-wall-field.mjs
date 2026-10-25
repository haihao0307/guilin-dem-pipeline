/** One host-owned wall solid and its opening table. No post-render whole-scene
 * hole subtraction. Outer source surface is evidence; inward depth is a design
 * parameter. Existing window identities and emitter recipes stay attached. */
import {intersectAperturesRay,queryApertures,apertureUnionPositiveNeighbour,packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {aperturePackedBounds} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs';
import {hostWallBounds} from './host-aperture-index.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]),mul=(a,t)=>a.map(v=>v*t);
export const hostLocal=(h,p)=>{const q=sub(p,h.origin);return [dot(q,h.u),dot(q,h.v),dot(q,h.n)]};
export const hostWorld=(h,q)=>add(h.origin,add(mul(h.u,q[0]),add(mul(h.v,q[1]),mul(h.n,q[2]))));
const insideRect=(p,r,strict=false)=>strict?p[0]>r[0]&&p[0]<r[2]&&p[1]>r[1]&&p[1]<r[3]:p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];
export function deriveHostWallField({patch,apertures,masks,thickness=.26}){
 if(!(thickness>0&&thickness<=.6)||patch?.loops?.length!==1||patch.loops[0].length!==4)throw Error('First host compiler requires explicit rectangular source face and positive design thickness');
 const xs=patch.loops[0].map(p=>p[0]),ys=patch.loops[0].map(p=>p[1]),rect=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
 if(patch.loops[0].some(p=>![rect[0],rect[2]].includes(p[0])||![rect[1],rect[3]].includes(p[1])))throw Error('Nonrectangular source face is not silently replaced');
 const h={schema:'kaopu.host-wall-solid/1',sourcePatchId:patch.sourcePatchId,objectId:patch.objectId,materialRole:patch.materialRole,origin:[...patch.origin],u:[...patch.u],v:[...patch.v],n:[...patch.n],rect,depth:[-thickness,0],thicknessEvidence:'authored_candidate_not_surveyed',windows:[],sourceGeometryUnchanged:true};
 for(const a of apertures){const m=masks.find(m=>m.enabled&&m.instanceId===a.instanceId&&m.sourcePatchId===patch.sourcePatchId);if(!m)continue;if(m.sourceObjectId!==patch.objectId)throw Error('Host source identity mismatch');const reveal=a.primitives.find(p=>p.partRole==='window_opening_reveal');if(!reveal?.inner)throw Error('Explicit hollow reveal defines the actual clear wall opening');
  const c=hostLocal(h,reveal.origin);if(Math.abs(Math.abs(dot(reveal.u,h.u))-1)>1e-7||Math.abs(Math.abs(dot(reveal.v,h.v))-1)>1e-7)throw Error('Rotated opening requires another compiler, not guessed alignment');
  const center=[c[0]+dot(reveal.u,h.u)*reveal.inner.center[0],c[1]+dot(reveal.v,h.v)*reveal.inner.center[1]],half=reveal.inner.half,hole=[center[0]-half[0],center[1]-half[1],center[0]+half[0],center[1]+half[1]],mc=hostLocal(h,m.frame.origin),maskRect=[mc[0]-m.width/2,mc[1]-m.height/2,mc[0]+m.width/2,mc[1]+m.height/2];
  if(hole[0]<rect[0]||hole[2]>rect[2]||hole[1]<rect[1]||hole[3]>rect[3])throw Error('Opening crosses retained wall boundary');
  if(h.windows.some(w=>hole[0]<w.hole[2]&&hole[2]>w.hole[0]&&hole[1]<w.hole[3]&&hole[3]>w.hole[1]))throw Error('Overlapping opening domains require explicit merge');
  const infill={...a,primitives:a.primitives.filter(p=>p!==reveal)};
  h.windows.push({instanceId:a.instanceId,openingId:a.recessedConstruction?.revealId,sourcePatchId:patch.sourcePatchId,floorId:a.floorId,hole,maskRect,revealObjectId:reveal.objectId,infill,original:a,depth:structuredClone(h.depth)});
 }
 h.windows.sort((a,b)=>a.hole[1]-b.hole[1]||a.instanceId-b.instanceId);
 const packed=packApertureDescriptors(h.windows.map(w=>w.infill)),partBounds=aperturePackedBounds(packed,packed.primitiveCount),supports=[hostWallBounds(patch,h.depth),...(partBounds??[null])];
 // Bounds cover the uploaded F32 dot-frame field, not only the original double
 // corner construction. Unknown support disables culling instead of omission.
 h.bounds=supports.some(b=>!b)?null:{min:[0,1,2].map(k=>Math.min(...supports.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...supports.map(b=>b.max[k])))};
 h.dependencies={sourceBoundary:patch.sourcePatchId,openingTable:h.windows.map(w=>w.instanceId),infillDerivedFromSameOpenings:true,postSceneSourceMaskRequired:false};return h;
}
export function hostWallInsideLocal(h,q){return q[2]>h.depth[0]&&q[2]<h.depth[1]&&insideRect(q,h.rect,true)&&!h.windows.some(w=>insideRect(q,w.hole));}
export function hostWallInside(h,p){return hostWallInsideLocal(h,hostLocal(h,p));}
const slab=(o,d,a,b)=>d===0?(o<a||o>b?[1,-1]:[-Infinity,Infinity]):[Math.min((a-o)/d,(b-o)/d),Math.max((a-o)/d,(b-o)/d)];
const boxInterval=(o,d,lo,hi)=>{const q=lo.map((v,k)=>slab(o[k],d[k],v,hi[k]));return[Math.max(...q.map(v=>v[0])),Math.min(...q.map(v=>v[1]))]};
export function hostWallPositiveNeighbour(h,point,normal){const q=hostLocal(h,point),d=[dot(normal,h.u),dot(normal,h.v),dot(normal,h.n)],e=.000002,iv=boxInterval(q,d,[h.rect[0],h.rect[1],h.depth[0]],[h.rect[2],h.rect[3],h.depth[1]]);if(iv[0]>e||iv[1]<=e)return false;for(const w of h.windows){const a=boxInterval(q,d,[w.hole[0],w.hole[1],h.depth[0]],[w.hole[2],w.hole[3],h.depth[1]]);if(a[0]<=e&&a[1]>e)return false;}return true;}
export function hostInfillPositiveNeighbour(h,point,normal){return h.windows.some(w=>apertureUnionPositiveNeighbour(w.infill,point,normal,{epsilon:.000002}));}
const nextUp=x=>{const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,x);let v=b.getBigUint64(0);b.setBigUint64(0,v+(x>=0?1n:-1n));return b.getFloat64(0)};
export function traceHostWallSolid(h,origin,direction,{maxDistance=10000,filterInfill=false}={}){
 const len=Math.hypot(...direction);if(!(len>0))throw Error('Nonzero ray');const rd=mul(direction,1/len),o=hostLocal(h,origin),d=[dot(rd,h.u),dot(rd,h.v),dot(rd,h.n)];let best=null,tests=0;
 const emit=(axis,value,normal,domain,id)=>{tests++;if(d[axis]===0)return;const t=(value-o[axis])/d[axis];if(t<0||t>maxDistance||best&&t>best.t)return;const q=add(o,mul(d,t));if(!domain(q))return;const n=add(mul(h.u,normal[0]),add(mul(h.v,normal[1]),mul(h.n,normal[2]))),point=add(origin,mul(rd,t));if(filterInfill&&hostInfillPositiveNeighbour(h,point,n))return;if(best&&t===best.t&&id>best.objectId)return;best={hit:true,t,point,local:q,normal:n,objectId:id,materialRole:2,kind:'host-wall-solid'};};
 const cap=q=>insideRect(q,h.rect)&&!h.windows.some(w=>insideRect(q,w.hole,true));
 // Existing reveal front rings preserve their former hit identity. Newly
 // generated rear wall outside those rings keeps the source wall identity.
 for(const [z,n]of[[h.depth[0],-1],[h.depth[1],1]]){let id=h.objectId;if(d[2]!==0){const q=add(o,mul(d,(z-o[2])/d[2])),w=h.windows.find(w=>insideRect(q,w.maskRect));if(w)id=w.revealObjectId;}emit(2,z,[0,0,n],cap,id);}
 const depth=q=>q[2]>=h.depth[0]&&q[2]<=h.depth[1];
 for(const [axis,value,sign]of[[0,h.rect[0],-1],[0,h.rect[2],1],[1,h.rect[1],-1],[1,h.rect[3],1]])emit(axis,value,axis===0?[sign,0,0]:[0,sign,0],q=>depth(q)&&insideRect(q,h.rect),h.objectId);
 for(const w of h.windows)for(const [axis,value,sign]of[[0,w.hole[0],1],[0,w.hole[2],-1],[1,w.hole[1],1],[1,w.hole[3],-1]])emit(axis,value,axis===0?[sign,0,0]:[0,sign,0],q=>depth(q)&&insideRect(q,w.hole),w.revealObjectId);
 return best?{...best,planeTests:tests}:{hit:false,planeTests:tests};
}
export function traceHostWall(h,origin,direction,{maxDistance=10000}={}){
 let best=traceHostWallSolid(h,origin,direction,{maxDistance,filterInfill:true}),windowTests=0;const rd=mul(direction,1/Math.hypot(...direction));
 for(const w of h.windows){let minDistance=0;for(let k=0;k<20;k++){const limit=best.hit?Math.min(maxDistance,best.t):maxDistance;if(minDistance>limit)break;const q=intersectAperturesRay(w.infill,origin,rd,{minDistance,maxDistance:Math.max(Number.MIN_VALUE,limit)});windowTests++;if(!q.hit)break;if(hostWallPositiveNeighbour(h,q.point,q.normal)){minDistance=nextUp(q.t);continue;}if(!best.hit||q.t<best.t||q.t===best.t&&q.objectId<best.objectId)best={...q,kind:'host-window-infill'};break;}}
 return{...best,windowTests,hostPatchId:h.sourcePatchId};
}
export function queryHostWall(h,p){if(hostWallInside(h,p))return{inside:true,kind:'host-wall-solid',objectId:h.objectId};for(const w of h.windows){const q=queryApertures(w.infill,p);if(q.inside)return{...q,kind:'host-window-infill'};}return{inside:false,kind:'empty'};}

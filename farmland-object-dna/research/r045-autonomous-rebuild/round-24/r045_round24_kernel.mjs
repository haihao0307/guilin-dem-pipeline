import * as R23 from '../round-23/r045_round23_kernel.mjs';
export * from '../round-23/r045_round23_kernel.mjs';

export const VERSION='R045.24';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-.5*(x/s)*(x/s));

// R045.24 fixes the remaining lower-planform error from R23. The logical failure would be to add
// arbitrary extra lobes or simply increase the R23 toe amplitude: either move would decorate a
// still-uniform plain without explaining why those masses occur. This round instead derives three
// unequal receiving bays from the already inherited outlet carriers. They are terrain morphology,
// not new waterways, surveyed fans, terraces, parcels, or active-flow claims.
export const receiverBand={z0:28,z1:132,enter0:28,enter1:50,leave0:108,leave1:132};

function segFrame(px,pz,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
  const t=C(((px-a[0])*dx+(pz-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
  const rx=px-qx,rz=pz-qz;
  return{d:Math.hypot(rx,rz),signed:(dx*rz-dz*rx)/L,t,L,qx,qz};
}
function nearestPath(path,x,z){
  let best={d:1e9,signed:0,u:0};
  for(let i=0;i<path.p.length-1;i++){
    const q=segFrame(x,z,path.p[i],path.p[i+1]);
    const u=(path.cum[i]+q.L*q.t)/(path.total||1);
    if(q.d<best.d)best={d:q.d,signed:q.signed,u};
  }
  return best;
}

export const receivingPlainProfiles=R23.outletContinuum.map((o,i)=>({
  id:o.id,
  path:o.path,
  width0:[32,39,28][i]??32,
  width1:[71,58,82][i]??70,
  offset0:[-18,16,-9][i]??0,
  swing:[23,-31,37][i]??20,
  phase:[.24,1.18,2.27][i]??0,
  depth:[.27,.34,.23][i]??.27,
  shoulder:[.12,.09,.15][i]??.11,
  nested:[.10,.14,.08][i]??.10,
  nestedSide:[1,-1,1][i]??1
}));

export function receivingEnvelope(z){
  if(z<=receiverBand.z0||z>=receiverBand.z1)return 0;
  return S(receiverBand.enter0,receiverBand.enter1,z)*(1-S(receiverBand.leave0,receiverBand.leave1,z));
}

export function receivingPlainComponent(p,x,z){
  const env=receivingEnvelope(z);if(env<=0)return 0;
  const q=nearestPath(p.path,x,z),u=q.u;
  const d=R23.nearestExtendedDrainageDistance(x,z);
  const drainClear=S(12,54,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R23.riverZ(x));
  const riverClear=S(R23.riverW(x)+10,R23.riverW(x)+34,riverGap);if(riverClear<=0)return 0;
  const downstream=S(.30,.58,u);
  if(downstream<=0)return 0;

  // The bay centre bends away from the outlet carrier at a different rate for each catchment.
  // Width expands downslope but each profile uses a different ratio; this prevents clone fans.
  const width=M(p.width0,p.width1,S(.38,.95,u));
  const centre=p.offset0+p.swing*Math.sin(Math.PI*(.82*u)+p.phase);
  const local=q.signed-centre;
  const bay=-p.depth*G(local,width);

  // An unequal outer shoulder and a smaller nested hollow create a broad bay-within-apron planform,
  // not a terrace step. They remain tied to the same carrier-local coordinate system.
  const shoulderCentre=centre-p.nestedSide*width*1.16;
  const outer=p.shoulder*G(q.signed-shoulderCentre,width*.72);
  const nestedCentre=centre+p.nestedSide*width*.72;
  const inner=-p.nested*G(q.signed-nestedCentre,width*.48)*S(.48,.82,u);
  const longitudinal=.90+.10*Math.sin(Math.PI*2*u+p.phase);
  return env*drainClear*riverClear*downstream*longitudinal*(bay+outer+inner);
}

export function receivingPlainDelta(x,z){
  let d=0;for(const p of receivingPlainProfiles)d+=receivingPlainComponent(p,x,z);
  return C(d,-.68,.46);
}

export function height(x,z){return R23.height(x,z)+receivingPlainDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R23.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R23.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R23.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R23.riverW(x)+4,R23.riverW(x)+18,Math.abs(z-R23.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R23.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round24:{
    scope:'replace the still-uniform lower receiving plain with three unequal nested carrier-coupled bays while preserving inherited drainage, R23 foothill contact and receiver river; terraces remain locked',
    method:'three outlet-carrier local coordinate fields with unequal width expansion, lateral bending, shallow receiving hollows, outer shoulders and smaller nested hollows; exact drainage/river protection and smooth z support',
    logicCorrection:'adding arbitrary extra lobes or merely amplifying the R23 toe would decorate the plain without causal structure. R24 ties every new receiving mass to an inherited outlet carrier before any terrace pattern is allowed',
    xiaomaBoundary:'rendered terrain continuity and carrier intersection are geometry evidence only; they do not establish hydraulic connectivity, water depth, discharge, control elevation, soil water or sediment state',
    mrRolordUse:'the saved frame audit was reread this round: river hierarchy -> cumulative distance/terrain -> land use. The recorded video observations are reused; no unsupported metric copying from Blender is performed',
    referenceUse:'image(173).png was reread this round only for unequal nested hillside occupation and non-uniform contour hierarchy; no terrace width, riser height, channel section or water depth is inferred from the photograph',
    evidenceClass:'synthetic carrier-coupled lower-plain morphology for substrate testing; not surveyed Yunnan agricultural geometry',
    forbiddenClaims:['surveyed receiving-bay geometry','measured terrace bench','measured riser or bund section','active irrigation connectivity','field water depth','discharge','control elevation','soil or sediment property','ownership or cadastral boundary','regional terrace dimensions']
  }
};

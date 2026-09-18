import * as R24 from '../round-24/r045_round24_kernel.mjs';
export * from '../round-24/r045_round24_kernel.mjs';

export const VERSION='R045.25';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-.5*(x/s)*(x/s));

// R045.25 keeps the work in the one-sided agricultural-slope / foothill-plain stage.
// The logical error would be to equate "more visible in the long view" with "larger vertical amplitude".
// R24 already proved that three carrier-coupled receiving bays exist, but their whole-scene footprint is
// still weak. This round changes lateral occupancy and downstream sweep with broad, shallow aprons tied
// to the same inherited outlet carriers. It does not create terraces, parcels, canals, paths or actors.
export const apronBand={z0:12,z1:130,enter0:12,enter1:34,leave0:108,leave1:130};

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

export const apronProfiles=R24.receivingPlainProfiles.map((p,i)=>({
  id:p.id,
  path:p.path,
  width0:[62,48,72][i]??60,
  width1:[118,93,132][i]??110,
  offset:[-22,28,-10][i]??0,
  sweep:[48,-42,55][i]??40,
  phase:[.35,1.31,2.18][i]??0,
  depth:[.19,.23,.17][i]??.19,
  shoulder:[.105,.12,.10][i]??.105,
  nested:[.060,.075,.052][i]??.060,
  edgeSign:[1,-1,1][i]??1
}));

export function apronEnvelope(z){
  if(z<=apronBand.z0||z>=apronBand.z1)return 0;
  return S(apronBand.enter0,apronBand.enter1,z)*(1-S(apronBand.leave0,apronBand.leave1,z));
}

export function apronComponent(p,x,z){
  const env=apronEnvelope(z);if(env<=0)return 0;
  const q=nearestPath(p.path,x,z),u=q.u;
  const downstream=S(.20,.48,u)*(1-S(.94,1.0,u));if(downstream<=0)return 0;
  const d=R24.nearestExtendedDrainageDistance(x,z);
  const drainClear=S(13,60,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R24.riverZ(x));
  const riverClear=S(R24.riverW(x)+12,R24.riverW(x)+38,riverGap);if(riverClear<=0)return 0;
  const width=M(p.width0,p.width1,S(.28,.92,u));
  // A broad lateral sweep, rather than extra depth, is the substantive change from R24.
  const centre=p.offset + p.sweep*Math.sin(Math.PI*(.70*u)+p.phase) + .28*p.sweep*(u-.52);
  const local=q.signed-centre;
  const hollow=-p.depth*G(local,width);
  // Unequal one-sided shoulder keeps each apron from reading as a symmetric Gaussian trench.
  const primaryEdge=p.shoulder*G(local-p.edgeSign*width*1.18,width*.50);
  const counterEdge=.43*p.shoulder*G(local+p.edgeSign*width*1.60,width*.68);
  const nested=-p.nested*G(local+p.edgeSign*width*.46,width*.36)*S(.42,.80,u);
  const longitudinal=.88+.12*Math.sin(Math.PI*1.72*u+p.phase);
  return env*downstream*drainClear*riverClear*longitudinal*(hollow+primaryEdge+counterEdge+nested);
}

export function apronDelta(x,z){
  let d=0;for(const p of apronProfiles)d+=apronComponent(p,x,z);
  return C(d,-.52,.38);
}

export function height(x,z){return R24.height(x,z)+apronDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

// R25 support begins below the terrace-candidate zone (z>12), so permission remains inherited exactly.
export function terracePermission(x,z){return R24.terracePermission(x,z)}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R24.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R24.riverW(x)+4,R24.riverW(x)+18,Math.abs(z-R24.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R24.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round25:{
    scope:'make the three R24 receiving bays alter whole-scene lower-plain planform through broad carrier-coupled footslope aprons while preserving inherited drainage, R24 relief and receiver river; terraces remain locked',
    method:'three unequal broad shallow apron fields in inherited outlet-carrier coordinates, with different width expansion, lateral sweep, one-sided shoulders and nested recesses; exact drainage/receiver protection and smooth support',
    logicCorrection:'whole-scene legibility is not evidence that vertical amplitude should simply be increased. Amplifying R24 would risk artificial berms; R25 changes lateral occupancy and sweep first, and every new mass remains tied to an inherited outlet carrier',
    xiaomaBoundary:'the current 12.5 m macro DEM and rendered geometry do not establish field-scale boundaries, bund/channel sections, control elevations, hydraulic connectivity, water depth, discharge, soil water or sediment state',
    mrRolordUse:'the saved frame audit was reread this round. R25 retains river hierarchy -> cumulative terrain field -> land use ordering and translates it to deterministic world-space browser fields rather than copying Blender nodes or dimensions',
    referenceUse:'image(173).png was reread this round for broad unequal nested hillside occupation, curved contour hierarchy and non-uniform lower transitions only; no terrace width, riser height, channel section, water depth or regional metric is inferred from the photograph',
    evidenceClass:'synthetic carrier-coupled footslope/receiving-plain macro morphology for substrate and visual testing; not surveyed Yunnan agricultural geometry',
    forbiddenClaims:['surveyed apron footprint','measured terrace bench','measured riser or bund section','measured canal section','active irrigation connectivity','field water depth','discharge','control elevation','soil or sediment property','ownership or cadastral boundary','regional terrace dimensions']
  }
};

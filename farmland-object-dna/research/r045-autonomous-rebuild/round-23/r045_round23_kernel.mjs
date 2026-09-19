import * as R22 from '../round-22/r045_round22_kernel.mjs';
export * from '../round-22/r045_round22_kernel.mjs';

export const VERSION='R045.23';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// R045.23 addresses a different macro blocker than R22: the slope-to-plain transition still reads
// as an oversized, nearly featureless lower sheet. The logical error would be to start drawing terrace
// benches simply because the lower slope is now numerically continuous. Terraces would only mask an
// unresolved substrate. This round therefore builds a curved foothill contact and broad toe/apron
// relief first. It is still terrain-only and does not create terrace, parcel, irrigation, road or actor data.
export const foothillBand={z0:8,z1:138,enter0:8,enter1:30,leave0:112,leave1:138};

export function foothillContactZ(x){
  // Deliberately non-horizontal and non-periodic-looking at scene scale: two long wavelengths with
  // unequal phase and amplitude. This is a synthetic generator control, not a surveyed breakline.
  return 55 + 18*Math.sin((x+34)/108) + 9*Math.sin((x-91)/57);
}

function bell(v,s){return Math.exp(-.5*(v/s)**2)}

export function foothillEnvelope(z){
  if(z<=foothillBand.z0||z>=foothillBand.z1)return 0;
  return S(foothillBand.enter0,foothillBand.enter1,z)*(1-S(foothillBand.leave0,foothillBand.leave1,z));
}

export function foothillContactDelta(x,z){
  const env=foothillEnvelope(z);if(env<=0)return 0;
  const d=R22.nearestExtendedDrainageDistance(x,z);
  const drainClear=S(12,58,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R22.riverZ(x));
  const riverClear=S(R22.riverW(x)+10,R22.riverW(x)+34,riverGap);if(riverClear<=0)return 0;
  const zc=foothillContactZ(x);
  const side=.64+.36*S(-170,130,x);
  // A broad convex toe above the contact, followed by a weaker receiving apron hollow below it.
  // Their different widths make the slope break readable without becoming a terrace-like step.
  const toe=.92*bell(z-(zc-19),35);
  const apron=-.44*bell(z-(zc+31),47);
  // One weaker off-axis lobe keeps the foothill from becoming a single mathematical ribbon.
  const dx=(x-96)/118,dz=(z-(zc+6))/72;
  const sideLobe=.24*Math.exp(-.5*(dx*dx+dz*dz));
  return C(env*drainClear*riverClear*side*(toe+apron+sideLobe),-.72,1.08);
}

export function height(x,z){return R22.height(x,z)+foothillContactDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}

export function terracePermission(x,z){
  if(z<-132||z>8||Math.abs(x)>205)return 0;
  const g=gradient(x,z),s=g.mag;
  const slopeBand=S(.045,.085,s)*(1-S(.28,.39,s));
  const drainageClear=S(7,16,R22.nearestExtendedDrainageDistance(x,z));
  const divideClear=S(5,12,R22.nearestDivideDistance(x,z));
  const faceForward=1-S(.42,.80,Math.abs(g.dx)/(Math.abs(g.dz)+.05));
  const curv=1-S(.018,.060,Math.abs(curvature(x,z)));
  const geom=S(-130,-112,z)*(1-S(0,12,z));
  return C(slopeBand*drainageClear*(.55+.45*divideClear)*faceForward*curv*geom,0,1);
}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R22.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R22.riverW(x)+4,R22.riverW(x)+18,Math.abs(z-R22.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R22.snapshot,
  version:VERSION,
  visualAcceptance:false,
  browserQA:false,
  productionReady:false,
  parcelGenerationEnabled:false,
  terraceGeometryEnabled:false,
  terracePilotPreviewEnabled:false,
  waterStateKnown:false,
  round23:{
    scope:'shape the oversized lower foothill into a curved slope-to-plain contact with broad toe/apron relief while preserving inherited drainage and receiver geometry; terraces remain locked',
    method:'x-varying synthetic foothill contact plus broad convex toe, weaker receiving-apron hollow and one off-axis lobe; exact drainage/receiver protection with smooth fades',
    logicCorrection:'numerical continuity of the lower slope is not evidence that terrace benches should be drawn. Adding terrace stripes now would conceal an unresolved foothill substrate rather than solve it',
    xiaomaBoundary:'topology and rendered-ground intersection evidence must precede claims of connected water behaviour; continuous terrain appearance does not establish hydraulic connectivity, water depth, discharge, gate state, soil water or sediment state',
    mrRolordUse:'the original MrRolord video was searched again but not located; only the previously saved drainage-first ordering topology/carriers -> terrain influence -> land use is reused, and no fresh viewing is claimed',
    referenceUse:'image(173).png was reread only for non-uniform nested contour hierarchy and curved hillside occupation; no terrace width, riser height, channel section or water depth is inferred from the photograph',
    evidenceClass:'synthetic foothill macro-morphology for visual and topological substrate testing; not surveyed Yunnan field geometry',
    forbiddenClaims:['surveyed foothill breakline','measured terrace bench','measured riser or bund section','active irrigation connectivity','field water depth','discharge','soil or sediment property','ownership or cadastral boundary','regional terrace dimensions']
  }
};

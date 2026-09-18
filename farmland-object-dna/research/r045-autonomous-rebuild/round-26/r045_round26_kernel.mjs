import * as R25 from '../round-25/r045_round25_kernel.mjs';
export * from '../round-25/r045_round25_kernel.mjs';

export const VERSION='R045.26';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const G=(x,s)=>Math.exp(-.5*(x/s)*(x/s));

function segFrame(px,pz,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1,L=Math.sqrt(l2);
  const t=C(((px-a[0])*dx+(pz-a[1])*dz)/l2,0,1),qx=M(a[0],b[0],t),qz=M(a[1],b[1],t);
  const rx=px-qx,rz=pz-qz;
  return{d:Math.hypot(rx,rz),signed:(dx*rz-dz*rx)/L,t,L};
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

// R26 changes hierarchy/footprint, not raw vertical amplitude. The three lobes intentionally
// occupy major / subordinate / local scales while remaining tied to the three inherited outlets.
export const receivingHierarchy=R25.apronProfiles.map((p,i)=>({
  id:p.id,
  path:p.path,
  scaleClass:['major','subordinate','local'][i],
  zStart:[24,36,48][i],
  zEnd:[130,120,108][i],
  width0:[82,68,54][i],
  width1:[158,118,88][i],
  centre0:[-18,26,-12][i],
  sweep:[58,-39,31][i],
  bend:[34,22,-27][i],
  depth:[.128,.098,.073][i],
  shoulder:[.058,.049,.038][i],
  nested:[.052,.041,.031][i],
  edgeSign:[1,-1,1][i],
  phase:[.22,1.18,2.04][i]
}));

function bandEnvelope(p,z){
  if(z<=p.zStart||z>=p.zEnd)return 0;
  const enter1=Math.min(p.zStart+18,p.zEnd-12),leave0=Math.max(p.zStart+18,p.zEnd-20);
  return S(p.zStart,enter1,z)*(1-S(leave0,p.zEnd,z));
}

export function hierarchyComponent(p,x,z){
  const env=bandEnvelope(p,z);if(env<=0)return 0;
  const q=nearestPath(p.path,x,z),u=q.u;
  const along=S(.24,.47,u)*(1-S(.94,1.0,u));if(along<=0)return 0;
  const d=R25.nearestExtendedDrainageDistance(x,z),drainClear=S(13,56,d);if(drainClear<=0)return 0;
  const riverGap=Math.abs(z-R25.riverZ(x));
  const riverClear=S(R25.riverW(x)+12,R25.riverW(x)+38,riverGap);if(riverClear<=0)return 0;
  const widen=S(.28,.88,u),width=M(p.width0,p.width1,widen);
  const centre=p.centre0+p.sweep*S(.30,.88,u)+p.bend*Math.sin(Math.PI*(.88*u)+p.phase);
  const local=q.signed-centre;
  const hollow=-p.depth*G(local,width);
  const nested=-p.nested*G(local+p.edgeSign*width*.43,width*.31)*S(.42,.82,u);
  // First runner proved the old shoulder was inside the broad hollow and cancelled in the final
  // signed field. Move it outside the receiving hollow instead of weakening the QA requirement.
  const shoulder=p.shoulder*G(local-p.edgeSign*width*1.88,width*.36);
  const counter=.36*p.shoulder*G(local+p.edgeSign*width*2.06,width*.43);
  const taper=.90+.10*Math.sin(Math.PI*1.35*u+p.phase);
  return env*along*drainClear*riverClear*taper*(hollow+nested+shoulder+counter);
}

export function hierarchyDelta(x,z){
  let d=0;for(const p of receivingHierarchy)d+=hierarchyComponent(p,x,z);
  return C(d,-.36,.24);
}

export function height(x,z){return R25.height(x,z)+hierarchyDelta(x,z)}
export function gradient(x,z){const e=1,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e);return{dx,dz,mag:Math.hypot(dx,dz)}}
export function slope(x,z){return gradient(x,z).mag}
export function curvature(x,z){const e=2,c=height(x,z),xx=(height(x+e,z)-2*c+height(x-e,z))/(e*e),zz=(height(x,z+e)-2*c+height(x,z-e))/(e*e);return xx+zz}
export function terracePermission(x,z){return R25.terracePermission(x,z)}
export function suitability(x,z){
  if(z>=150||z<-175)return 0;
  const s=slope(x,z),base=z<20?(1-S(.11,.34,s))*S(.035,.11,s):1-S(.025,.12,s);
  const src=z<120?R25.nearestExtendedDrainageDistance(x,z):999,sp=1-S(7,18,src);
  const rp=z>135?1-S(R25.riverW(x)+4,R25.riverW(x)+18,Math.abs(z-R25.riverZ(x))):0;
  return C(base*(1-.82*sp)*(1-.95*rp),0,1);
}

export const snapshot={
  ...R25.snapshot,
  version:VERSION,
  visualAcceptance:false,browserQA:false,productionReady:false,
  parcelGenerationEnabled:false,terraceGeometryEnabled:false,terracePilotPreviewEnabled:false,waterStateKnown:false,
  round26:{
    scope:'strengthen the one-sided agricultural slope to foothill receiving-plain hierarchy by giving the three inherited outlet-coupled receiving bodies major, subordinate and local planform scales; terraces remain locked',
    method:'three unequal outlet-coordinate toe-lobe fields with different support length, width growth, lateral sweep, bend, nested recess and outer shoulder; inherited drainage axes, upper work and foreground receiver are protected exactly',
    logicCorrection:'weak whole-scene legibility does not justify simply increasing relief amplitude. A larger vertical signal can make the same wrong footprint more obvious; R26 changes nested planform scale and downstream occupation first.',
    qaCorrection:'the first R26 runner showed that declared shoulders were fully cancelled because they sat inside the broad receiving hollow. The geometry was corrected by moving shoulders outside the hollow; the signed-relief QA gate was not weakened.',
    xiaomaBoundary:'the canonical macro terrain basis is about 12.5 m spacing and does not establish field boundaries, terrace bench/riser sections, bund or channel sections, control elevations, hydraulic connectivity, water depth, discharge, soil-water state or sediment state.',
    mrRolordUse:'the saved MrRolord frame audit was reread this round. R26 keeps river hierarchy and accumulated terrain fields ahead of land use, translating that ordering into deterministic browser geometry without copying Blender dimensions or Voronoi parcel styling.',
    referenceUse:'the user reference image image(173).png was reopened this round. It supports unequal nested contour occupation and non-uniform lower transitions only; no terrace width, riser height, channel size, water depth or regional metric is inferred from the photograph.',
    evidenceClass:'synthetic outlet-coupled macro footslope hierarchy for visual and substrate testing; not surveyed Yunnan agricultural geometry or hydraulic truth',
    forbiddenClaims:['surveyed field boundary','measured terrace width','measured riser height','measured bund section','measured channel section','known control elevation','known hydraulic connectivity','known water depth','known discharge','known soil-water state','known sediment state','regional truth from photograph']
  }
};

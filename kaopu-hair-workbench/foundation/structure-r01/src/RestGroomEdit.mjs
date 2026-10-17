import {PROFILE,sub,add,mul,smooth} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';
export function editRestGroom(reference,records,near,bvh,{unshaped=false}={}){
 const originals=unshaped?reference.unshapedGuides:reference.guides,byId=new Map(records.map(r=>[r.id,r])),guides=[],changes=[];
 for(const old of originals){const g=structuredClone(old),r=byId.get(g.rootId),o=g.rootId*26,refDirection=reference.rootData.slice(o+13,o+16),delta=sub(r.direction,refDirection),reach=g.zone<=1?PROFILE.GuideGroom.fringeEditArc:PROFILE.GuideGroom.editArc;
  const strength=Math.min(1,Math.hypot(...delta)/.25),clearances=old.arcLengths.map((s,n)=>n&&s<reach?Math.min(Math.max(0,near(old.points.slice(n*3,n*3+3)).signed),.0008*(1-Math.exp(-s/.020))):0),changed=[];
  for(let n=1;n<g.points.length/3-1;n++){const s=old.arcLengths[n];if(s>=reach)continue;const p=old.points.slice(n*3,n*3+3),weight=s*(1-smooth(s/reach));let q=add(p,mul(delta,weight));
   for(let attempt=0;attempt<5;attempt++){const h=near(q);if(h.signed>=clearances[n]-1e-9)break;q=add(q,mul(h.n,clearances[n]-h.signed));}
   g.points.splice(n*3,3,...q);changed.push(n);
  }
  // Fair edited interior samples; root, first chord and lower rest stay fixed.
  for(let pass=0;pass<6;pass++)for(const n of changed){if(n<2||old.arcLengths[n+1]>=reach)continue;const a=g.points.slice(n*3-3,n*3),b=g.points.slice(n*3+3,n*3+6),p=g.points.slice(n*3,n*3+3);let q=add(mul(p,1-.25*strength),mul(add(a,b),.125*strength));const h=near(q);if(h.signed<clearances[n])q=add(q,mul(h.n,clearances[n]-h.signed));g.points.splice(n*3,3,...q);}
  rebuildGuide(g);let max=0;for(const n of changed)max=Math.max(max,Math.hypot(...sub(g.points.slice(n*3,n*3+3),old.points.slice(n*3,n*3+3))));
  changes.push({id:g.id,zone:g.zone,reach,maxDisplacementMM:max*1000,lowerOutletFixed:true,cutEndpointFixed:true});guides.push(g);
 }
 return{guides,report:{method:'continuous root-direction delta over explicit rest groom; bounded upper arc with original cuts and lower outlets',reference:'R04',changes,maxDisplacementMM:Math.max(...changes.map(c=>c.maxDisplacementMM)),limits:'Local comb editor. Does not create a new silhouette, repartition lower outlets or claim arbitrary grooming.'}};
}

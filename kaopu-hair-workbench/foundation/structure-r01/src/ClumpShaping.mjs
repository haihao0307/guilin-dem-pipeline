import {unit,project,cross,sub,add,mul,dot,smooth} from './HairStyleProfile.mjs';
import {curveDistance} from './StaticGroomRules.mjs';

export function rebuildGuide(g){
 const N=g.points.length/3,points=Array.from({length:N},(_,n)=>g.points.slice(n*3,n*3+3));
 const tangents=points.map((p,n)=>unit(sub(points[Math.min(N-1,n+1)],points[Math.max(0,n-1)])));
 let normal=unit(project(g.frames.slice(3,6),tangents[0]));g.arcLengths=[0];g.frames=[];
 for(let n=0;n<N;n++){
  normal=unit(project(normal,tangents[n]));if(Math.hypot(...normal)<.1)normal=unit(project(Math.abs(tangents[n][0])<.8?[1,0,0]:[0,0,1],tangents[n]));
  const binormal=unit(cross(tangents[n],normal));normal=unit(cross(binormal,tangents[n]));g.frames.push(...tangents[n],...normal,...binormal);
  if(n)g.arcLengths.push(g.arcLengths.at(-1)+Math.hypot(...sub(points[n],points[n-1])));
 }
 g.length=g.arcLengths.at(-1);g.cut.endpoint=points.at(-1).slice();
}
function sample(g,t){const target=g.length*t;let j=0;while(j<g.arcLengths.length-2&&g.arcLengths[j+1]<target)j++;const f=(target-g.arcLengths[j])/(g.arcLengths[j+1]-g.arcLengths[j]);return{p:[0,1,2].map(k=>g.points[j*3+k]*(1-f)+g.points[j*3+k+3]*f),n:g.frames.slice(j*9+3,j*9+6),b:g.frames.slice(j*9+6,j*9+9)};}
export function shapeMidClumps(guides,graph,accept){
 const originals=new Map(guides.map(g=>[g.id,structuredClone(g)]));let proposed=0,accepted=0,maxDisplacement=0;
 for(const group of graph.filter(g=>g.level==='mid')){
  const leader=originals.get(group.representativeGuide);if(group.guides.length<2)continue;
  for(const id of group.guides){if(id===leader.id)continue;const g=guides.find(g=>g.id===id),source=originals.get(id),N=g.points.length/3;
   const desired=source.points.slice(),changed=[];for(let n=1;n<N-1;n++){
    const t=source.arcLengths[n]/source.length,weight=smooth((source.arcLengths[n]-.035)/.065)*(1-smooth((t-.65)/.35));if(weight<1e-5)continue;
    const p=source.points.slice(n*3,n*3+3),frame=sample(leader,t),offset=sub(p,frame.p);
    // Compress only transverse offsets of RELATED complete curves in the
    // representative's transported frame. Keep longitudinal offset and cut.
    let delta=add(mul(frame.n,-dot(offset,frame.n)*.34*weight),mul(frame.b,-dot(offset,frame.b)*.16*weight));
    const d=Math.hypot(...delta);if(d>.004)delta=mul(delta,.004/d);
    const q=add(p,delta);proposed++;desired.splice(n*3,3,...q);changed.push(n);
   }
   // Validate a whole smooth candidate, not one node against neighbours that
   // have not moved yet. Backtracking reduces the complete displacement.
   for(const scale of [1,.75,.5,.25,.125]){const candidate={...g,points:source.points.map((v,k)=>v+(desired[k]-v)*scale)};if(changed.every(n=>accept(candidate.points.slice(n*3,n*3+3),candidate,n,source))){g.points=candidate.points;accepted+=changed.length;for(const n of changed)maxDisplacement=Math.max(maxDisplacement,Math.hypot(...sub(g.points.slice(n*3,n*3+3),source.points.slice(n*3,n*3+3))));break;}}
   rebuildGuide(g);
  }
 }
 const sections=[];
 for(const group of graph){const members=group.guides.map(id=>guides.find(g=>g.id===id));group.curveDiameter=Math.max(0,...members.flatMap(a=>members.map(b=>curveDistance(a,b))));group.method+='; bounded transported-frame mid-wisp compression';
  if(group.level!=='mid'||members.length<2)continue;
  const leader=originals.get(group.representativeGuide),spread=(map,t)=>{
   const f=sample(leader,t),offsets=group.guides.map(id=>sub(sample(map.get(id),t).p,f.p));return Math.sqrt(offsets.reduce((s,p)=>s+dot(p,f.n)**2+dot(p,f.b)**2,0)/offsets.length);
  };
  sections.push({id:group.id,members:members.length,stations:[.25,.5,.75,1].map(t=>({arcFraction:t,beforeMM:spread(originals,t)*1000,afterMM:spread(new Map(guides.map(g=>[g.id,g])),t)*1000}))});
 }
 return{method:'bounded anisotropic mid-wisp contraction in transported local frames; root and cut fixed',proposed,accepted,rejected:proposed-accepted,maxDisplacementMM:maxDisplacement*1000,sections,limits:'Sparse guide shaping only. No dense child hair, self-contact, physical cohesion, or claim of measured hair-bundle parameters.'};
}

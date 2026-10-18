import {PROFILE,flowAt,partX,partSide,smooth,unit} from './HairStyleProfile.mjs';
// Fixed geometric neighbourhood; continuous dividing affinity instead of
// deleting/recreating graph edges when a moving part crosses a root.
const cache=new WeakMap();
export function solveSurfaceFlow(records){
 const start=performance.now();let geometry=cache.get(records),cachedGeometry=!!geometry;
 if(!geometry){const nodes=records.filter(r=>r.active),edges=nodes.map(()=>[]);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=nodes[i],b=nodes[j];if((a.zone<=1)!==(b.zone<=1)||a.n[0]*b.n[0]+a.n[1]*b.n[1]+a.n[2]*b.n[2]<.65)continue;
  const d2=(a.p[0]-b.p[0])**2+(a.p[1]-b.p[1])**2+(a.p[2]-b.p[2])**2;if(d2>.026**2)continue;
  const w=Math.exp(-d2/.013**2);edges[i].push([j,w]);edges[j].push([i,w]);
 }geometry={nodes,edges,warm:null};cache.set(records,geometry);}
 const {nodes}=geometry,N=nodes.length,width=PROFILE.PartingCurves[0].width,prob=nodes.map(r=>(partSide(r.p)+1)*.5);
 let transitionEdges=0,forbiddenEdges=0;const edges=geometry.edges.map((list,i)=>list.flatMap(([j,w])=>{
  const affinity=nodes[i].zone<=1?1:prob[i]*prob[j]+(1-prob[i])*(1-prob[j]);if(affinity===0)return[];
  if((nodes[i].zone<=1)!==(nodes[j].zone<=1))forbiddenEdges++;
  if((prob[i]>0&&prob[i]<1)||(prob[j]>0&&prob[j]<1))transitionEdges++;
  return[[j,w*affinity]];
 }));
 const strengths=nodes.map(r=>{const[x,y,z]=r.p,part=smooth((y-.365)/.035)*(1-smooth(Math.abs(x-partX(z))/(width*2.222222222222))),ear=smooth((Math.abs(x)-.050)/.022)*(1-smooth((y-.332)/.028))*(1-smooth(Math.abs(z-.025)/.052)),w=PROFILE.WhorlField[0],whorl=(1-smooth(Math.hypot(x-w.center[0],z-w.center[2])/w.radius))*smooth((y-.36)/.03);return 1.2+8*Math.max(part,ear,r.zone<=1?1:0,whorl);});
 const targets=nodes.map(r=>flowAt(r.p,r.n,r.zone)),denom=strengths.map((s,i)=>s+edges[i].reduce((sum,e)=>sum+e[1],0));
 let values=geometry.warm?.slice()||Float64Array.from(targets.flat()),iterations=0,residual=Infinity;
 for(;iterations<600;iterations++){
  const next=new Float64Array(N*3);residual=0;
  for(let i=0;i<N;i++){const n=nodes[i].n,t=targets[i];let x=t[0]*strengths[i],y=t[1]*strengths[i],z=t[2]*strengths[i];
   for(const[j,w]of edges[i]){const k=j*3,d=values[k]*n[0]+values[k+1]*n[1]+values[k+2]*n[2];x+=(values[k]-d*n[0])*w;y+=(values[k+1]-d*n[1])*w;z+=(values[k+2]-d*n[2])*w;}
   const d=x*n[0]+y*n[1]+z*n[2],k=i*3;next[k]=(x-d*n[0])/denom[i];next[k+1]=(y-d*n[1])/denom[i];next[k+2]=(z-d*n[2])/denom[i];residual=Math.max(residual,Math.hypot(next[k]-values[k],next[k+1]-values[k+1],next[k+2]-values[k+2]));
  }values=next;if(residual<1e-7){iterations++;break;}
 }
 geometry.warm=values.slice();const rawDirections=new Map(nodes.map((r,i)=>[r.id,Array.from(values.subarray(i*3,i*3+3))])),result=new Map(nodes.map(r=>[r.id,unit(rawDirections.get(r.id))]));
 return{directions:result,rawDirections,report:{method:'screened tangent graph-Laplacian with continuous part affinity',nodes:N,undirectedEdges:edges.reduce((s,e)=>s+e.length,0)/2,transitionEdges:transitionEdges/2,iterations,residual,converged:residual<1e-7,forbiddenEdges,minimumRawMagnitude:Math.min(...Array.from(rawDirections.values(),v=>Math.hypot(...v))),screen:1.2,cachedGeometry,solveMS:performance.now()-start,limits:'Scalp field and bounded local comb edits only; fixed rest outlets. Not a volumetric field or arbitrary style generator.'}};
}

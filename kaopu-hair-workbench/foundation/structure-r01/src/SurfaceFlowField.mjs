import {PROFILE,flowAt,partX,smooth,unit,project,dot,add,mul,sub} from './HairStyleProfile.mjs';

// Screened graph-Laplacian on supported scalp roots, NOT the paper's volumetric
// biharmonic field / incremental Cholesky. Tangent transport prevents averaging
// vectors across differently oriented scalp patches. Dividing/fringe boundaries
// are disconnected. The small screen term retains the authored comb prior.
export function solveSurfaceFlow(records){
 const start=performance.now(),nodes=records.filter(r=>r.active),radius=.026,screen=1.2;
 const family=r=>(r.zone<=1?'fringe':'scalp')+'/'+(r.p[0]<partX(r.p[2])?'left':'right');
 const keys=nodes.map(family),edges=nodes.map(()=>[]);
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  if(keys[i]!==keys[j]||dot(nodes[i].n,nodes[j].n)<.65)continue;
  const d=Math.hypot(...sub(nodes[i].p,nodes[j].p));if(d>radius)continue;
  const w=Math.exp(-d*d/(.013*.013));edges[i].push([j,w]);edges[j].push([i,w]);
 }
 const strengths=nodes.map(r=>{const[x,y,z]=r.p;
  const part=smooth((y-.365)/.035)*(1-smooth(Math.abs(x-partX(z))/.020));
  const ear=smooth((Math.abs(x)-.050)/.022)*(1-smooth((y-.332)/.028))*(1-smooth(Math.abs(z-.025)/.052));
  const w=PROFILE.WhorlField[0],whorl=(1-smooth(Math.hypot(x-w.center[0],z-w.center[2])/w.radius))*smooth((y-.36)/.03);
  return screen+8*Math.max(part,ear,r.zone<=1?1:0,whorl);
 });
 const targets=nodes.map(r=>flowAt(r.p,r.n,r.zone));let values=targets.map(v=>v.slice()),iterations=0,residual=Infinity;
 for(;iterations<600;iterations++){
  residual=0;const next=values.map((v,i)=>{
   let sum=mul(targets[i],strengths[i]),weight=strengths[i];
   for(const[j,w]of edges[i]){sum=add(sum,mul(project(values[j],nodes[i].n),w));weight+=w;}
   const q=mul(project(sum,nodes[i].n),1/weight);residual=Math.max(residual,Math.hypot(...sub(q,v)));return q;
  });values=next;if(residual<1e-7){iterations++;break;}
 }
 const result=new Map(nodes.map((r,i)=>[r.id,unit(values[i])]));
 let forbiddenEdges=0,energy=0;for(let i=0;i<nodes.length;i++)for(const[j,w]of edges[i]){if(keys[i]!==keys[j])forbiddenEdges++;energy+=w*Math.hypot(...sub(values[i],project(values[j],nodes[i].n)))**2;}
 return{directions:result,report:{method:'screened tangent graph-Laplacian (Jacobi)',nodes:nodes.length,undirectedEdges:edges.reduce((s,e)=>s+e.length,0)/2,iterations,residual,converged:residual<1e-7,forbiddenEdges,screen,energy:energy/2,solveMS:performance.now()-start,limits:'Root-domain field only; no volumetric solver or incremental factorization. Local control still requires precompilation.'}};
}

// Round members reuse R07 closestOnLine distance minus radius; no polygon mesh.
// Small extracted analytic-prism kernel. R06 finitePrism math, no renderer/cases.
export const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
export const boundsOf=ps=>({min:[0,1,2].map(k=>Math.min(...ps.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...ps.map(p=>p.bounds.max[k])))});
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function prism(id,loops,range,{origin=[0,0,0],u=[1,0,0],v=[0,0,1],w=[0,1,0]}={}){
 if(!loops.length||range[1]<=range[0])throw Error('Finite prism required');
 const points=loops.flat().flatMap(q=>range.map(h=>origin.map((x,i)=>x+u[i]*q[0]+v[i]*q[1]+w[i]*h)));
 const planes=[{normal:[0,0,1],offset:range[0],domain:'cap'},{normal:[0,0,1],offset:range[1],domain:'cap'}];
 for(const loop of loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[j],b=loop[i],n=[b[1]-a[1],a[0]-b[0],0],L=Math.hypot(...n);if(!L)throw Error('Zero edge');planes.push({normal:n.map(x=>x/L),offset:dot(n,[...a,0])/L,domain:'side',edge:[a,b]});}
 return{kind:'finite_polygon_prism',nodeId:id,origin,u,v,w,loops,range,planes,materialRole:2,bounds:{min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))}};
}

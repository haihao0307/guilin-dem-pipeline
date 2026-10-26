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
export function context(root){const nodes=[],edges=[],primitives=[],roundMembers=[],ids=new Set(),objectIds=new Set();const stableId=id=>{let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;const value=2000+h%8000000;if(objectIds.has(value))throw Error('Numeric identity collision');objectIds.add(value);return value;};const edge=(from,to,type)=>edges.push({from,to,type});
 const node=(id,type,label,owner=root,props={})=>{if(ids.has(id))throw Error('Duplicate identity '+id);ids.add(id);nodes.push({id,type,label,...props});if(owner)edge(id,owner,'ownedBy');return id;};node(root,'building','共享建筑母体',null);
 const register=(id,type,p,opts={})=>{const{owner=root,label=type,floorId=null,stage=5,supports=[]}=opts;node(id,type,label,owner,{floorId,stage,...(opts.partRole?{partRole:opts.partRole}:{})});supports.forEach(s=>{edge(id,s,'supportedBy');edge(id,s,'dependsOn');});return Object.assign(p,{nodeId:id,semanticClass:type,floorId,stage,componentLabel:label,objectId:stableId(id)});};
 const emit={nodes,edges,primitives,roundMembers,node,edge,prism(id,type,loops,range,opts={}){const p=register(id,type,prism(id,loops,range,opts),opts);primitives.push(p);return p;},box(id,type,low,high,opts={}){return emit.prism(id,type,[rect(low[0],low[2],high[0],high[2])],[low[1],high[1]],opts);},roundMember(id,type,start,end,diameter,opts={}){if(![...start,...end,diameter].every(Number.isFinite)||diameter<=0||Math.hypot(...end.map((v,k)=>v-start[k]))<1e-8)throw Error('Finite round member required');const radius=diameter/2,bounds={min:start.map((v,k)=>Math.min(v,end[k])-radius),max:start.map((v,k)=>Math.max(v,end[k])+radius)},p=register(id,type,{kind:'capsule',start:[...start],end:[...end],radius,tubeRadius:radius,bounds,surfaceBounds:bounds},{stage:6,...opts});roundMembers.push(p);return p;}};return emit;}

/** One Loop subdivision of authored display cloth; original body vertices are untouched. */
export function refineClothSurface(positions,triangles){
 const n=positions.length/3,adj=Array.from({length:n},()=>new Set()),edges=new Map(),boundary=Array.from({length:n},()=>[]);
 for(let t=0;t<triangles.length;t+=3){const a=triangles[t],b=triangles[t+1],c=triangles[t+2];
  for(const [i,j,k] of [[a,b,c],[b,c,a],[c,a,b]]){if(i===j)continue;adj[i].add(j);adj[j].add(i);const key=i<j?i+':'+j:j+':'+i;if(edges.has(key))edges.get(key).opposite.push(k);else edges.set(key,{i,j,opposite:[k]});}
 }
 for(const e of edges.values())if(e.opposite.length===1){boundary[e.i].push(e.j);boundary[e.j].push(e.i)}
 let p=positions.slice();
 for(let it=0;it<4;it++){const q=p.slice(),alpha=it%2===0?.38:-.39;
  for(let i=0;i<n;i++){if(boundary[i].length||adj[i].size<3)continue;for(let k=0;k<3;k++){let sum=0;for(const j of adj[i])sum+=p[j*3+k];q[i*3+k]+=alpha*(sum/adj[i].size-p[i*3+k]);}}p=q;
 }
 const out=p.slice();
 for(let i=0;i<n;i++){const nb=boundary[i];if(nb.length===2){for(let k=0;k<3;k++)out[i*3+k]=.96*p[i*3+k]+.02*(p[nb[0]*3+k]+p[nb[1]*3+k]);}
  else if(!nb.length&&adj[i].size>=3){const v=adj[i].size,beta=v===3?3/16:3/(8*v);for(let k=0;k<3;k++){let sum=0;for(const j of adj[i])sum+=p[j*3+k];out[i*3+k]=(1-v*beta)*p[i*3+k]+beta*sum;}}
 }
 for(const e of edges.values()){e.index=out.length/3;for(let k=0;k<3;k++)out.push(e.opposite.length===2?.375*(p[e.i*3+k]+p[e.j*3+k])+.125*(p[e.opposite[0]*3+k]+p[e.opposite[1]*3+k]):.5*(p[e.i*3+k]+p[e.j*3+k]));}
 const edge=(i,j)=>edges.get(i<j?i+':'+j:j+':'+i).index,idx=[];
 for(let t=0;t<triangles.length;t+=3){const a=triangles[t],b=triangles[t+1],c=triangles[t+2];if(a===b||a===c||b===c)continue;const ab=edge(a,b),bc=edge(b,c),ca=edge(c,a);idx.push(a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca);}
 return {positions:out,indices:idx};
}

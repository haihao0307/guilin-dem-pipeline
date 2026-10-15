// Synthetic vertical display closure at actual retained terrain boundary edges.
// This is not measured coastal geology or a retaining-wall structure.
export function makeCoastClosure(positions,indices,HK,mask,{bottomM=-2}={}){
 const {width:w,height:h}=HK,key=(a,b)=>a<b?a+','+b:b+','+a,edges=new Map();
 const mixedEdges=new Set();
 for(let r=0;r<h-1;r++)for(let c=0;c<w-1;c++){
  const j=r*w+c;for(const t of [[j,j+w,j+1],[j+1,j+w,j+w+1]]){
   if(!t.some(i=>mask[i]===0))continue;
   for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3];if(mask[a]!==0&&mask[b]!==0)mixedEdges.add(key(a,b));}
  }
 }
 for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],s=key(a,b);if(!mixedEdges.has(s))continue;const e=edges.get(s);if(e)e.count++;else edges.set(s,{a,b,count:1});}
 const verts=[],ix=[],segments=[];
 for(const [s,e]of edges){
  if(e.count!==1||!mixedEdges.has(s))continue;
  const a=Array.from(positions.slice(e.a*7,e.a*7+3)),b=Array.from(positions.slice(e.b*7,e.b*7+3));
  if(![...a,...b].every(Number.isFinite)||Math.max(a[1],b[1])<=bottomM)continue;
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),n=[dz/length,0,-dx/length],base=verts.length/7;
  for(const p of [a,b,[a[0],bottomM,a[2]],[b[0],bottomM,b[2]]])verts.push(...p,...n,1);
  ix.push(base,base+2,base+1,base+1,base+2,base+3);segments.push({a,b,bottomM});
 }
 return {positions:new Float32Array(verts),indices:new Uint32Array(ix),segments,stats:{segments:segments.length,triangles:ix.length/3,bottomM,sourcePositionsModified:false,sourceHeightsModified:false,sourceMaskModified:false,samplerModified:false,measuredCoast:false,role:'synthetic_coastal_display_closure'}};
}
export function installCoastClosure(target=globalThis){
 let stats=null,coverageEnabled=true;
 return target.HKCoastClosure={append(cache,sourcePositions,sourceIndices,HK,mask){
  const c=makeCoastClosure(sourcePositions,sourceIndices,HK,mask),p=new Float32Array(cache.positions.length+c.positions.length),i=new Uint32Array(cache.indices.length+c.indices.length),offset=cache.positions.length/7;
  p.set(cache.positions);p.set(c.positions,cache.positions.length);i.set(cache.indices);for(let k=0;k<c.indices.length;k++)i[cache.indices.length+k]=c.indices[k]+offset;
  stats={...c.stats,landClip:'same_three_node_triangle_as_retained_terrain',waveMotherChanged:false};return{positions:p,indices:i};
 },applySeaUniforms(gl,p,loc){gl.uniform1i(loc(p,'uHKTriangleCoastEnabled'),coverageEnabled?1:0);},
 setCoverageEnabled(value){coverageEnabled=!!value;target.HKRouteViewRequest?.();},
 stats:()=>({...stats,coverageEnabled,ablationScope:'clip_only_side_closures_held_constant'})};
}

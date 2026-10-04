// Verify the exact oriented (s, side) triangles, not just a matching triangle count.
// These are the only topology-dependent inputs to the unchanged shape and tangent functions.
module.exports=function verifyRibbonTopology(){
 const proofs=[];
 for(const n of [1,8,24,36,128]){
  const v=(i,side)=>[Math.fround(i/n),side],old=[],strip=[];
  for(let i=0;i<n;i++)old.push([v(i,-1),v(i,1),v(i+1,-1)],[v(i+1,-1),v(i,1),v(i+1,1)]);
  const vertices=Array.from({length:2*(n+1)},(_,j)=>v(Math.floor(j/2),j%2?1:-1));
  for(let j=0;j<vertices.length-2;j++)strip.push(j%2?[vertices[j+1],vertices[j],vertices[j+2]]:[vertices[j],vertices[j+1],vertices[j+2]]);
  if(JSON.stringify(old)!==JSON.stringify(strip))throw Error('Ribbon triangle coverage mismatch at '+n+' segments');
  proofs.push({segments:n,triangles:old.length,oldVertices:6*n,stripVertices:2*(n+1),orientedTriangleCoordinatesExact:true});
 }
 return {passed:true,proofs};
};
if(require.main===module)console.log(JSON.stringify(module.exports(),null,2));

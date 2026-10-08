// Temporary assembly fixtures derived from the original shoulder seams and exact-body SDF.
// Never modifies UVs, triangles, analytic curves, body geometry, or permanent constraints.
export function prepareShoulderFixtures(spec,sdf){
 const panels=new Map(spec.panels.map(p=>[p.id,p]));const q=new Float64Array(5);let count=0;
 const world=(p,id)=>{const [u,v]=p.uvMm[id],b=p.placement.rigidBasis,t=p.placement.translationMm;return[(b[0]*u+b[1]*v+t[0])/1000,(b[3]*u+b[4]*v+t[1])/1000,(b[6]*u+b[7]*v+t[2])/1000];};
 for(const seam of spec.seams.filter(s=>s.stageId==='shoulders')){
  const a=panels.get(seam.a.panelId),b=panels.get(seam.b.panelId),pairs=seam.stitchVertexPairs;
  if(!a||!b||!pairs?.length)continue;
  const endpoints=[pairs[0],pairs.at(-1)];
  const pair=endpoints.sort((p1,p2)=>Math.abs(world(a,p2[0])[0])-Math.abs(world(a,p1[0])[0]))[0];
  const pa=world(a,pair[0]),pb=world(b,pair[1]);const x=(pa[0]+pb[0])/2,z=.008860204985917;
  // This Z slice is the existing Anny acromion surface landmark plane, not a replacement body.
  let previous=sdf.sample(x,1.68,z,q)[0],hit=null;
  for(let y=1.678;y>1.36;y-=.002){const d=sdf.sample(x,y,z,q)[0];if(previous>=.004&&d<.004){let lo=y,upper=y+.002;for(let j=0;j<18;j++){const mid=(lo+upper)/2;if(sdf.sample(x,mid,z,q)[0]<.004)lo=mid;else upper=mid;}hit=[x,(lo+upper)/2,z];break;}previous=d;}
  if(!hit)continue;
  for(const [p,id,side]of[[a,pair[0],1],[b,pair[1],-1]]){
   if(!p.temporaryPins.includes(id))p.temporaryPins.push(id);
   p.temporaryPinTargetsMm[id]=hit.map((v,k)=>v*1000+(k===2?side*.4:0));count++;
  }
 }
 spec.source.temporaryFixturePlan={count,method:'outer endpoints of original shoulder seams; upward full-body-SDF contact in recorded Anny acromion Z plane',releasedBeforeGravity:true,doesNotAlterRestMaterial:true};
 return count;
}

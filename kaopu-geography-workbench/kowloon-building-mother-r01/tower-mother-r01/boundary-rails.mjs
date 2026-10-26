// Display geometry from floor boundary relationships; teaching guard, not code certification.
function boundary(e,id,floorId,slabId,segments,y){
 e.node(id,'boundary_guard','楼板边界护栏',floorId,{stage:6});const posts=new Map();
 for(const [j,[a,b]]of segments.entries()){
  for(const height of [.55,1.1])e.roundMember(id+':rail:'+j+':'+height,'handrail',[a[0],y+height,a[1]],[b[0],y+height,b[1]],.05,{owner:id,floorId,stage:6,label:height===1.1?'边界护栏扶手':'边界护栏中横杆',supports:[slabId],partRole:'floor_boundary_guard'});
  const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.2);for(let k=0;k<=n;k++){const q=a.map((v,i)=>v+(b[i]-v)*k/n);posts.set(q.map(v=>v.toFixed(6)).join(','),q);}
 }
 let k=0;for(const q of posts.values())e.roundMember(id+':post:'+k++,'handrail',[q[0],y-.03,q[1]],[q[0],y+1.1,q[1]],.035,{owner:id,floorId,stage:6,label:'边界护栏立杆',supports:[slabId],partRole:'floor_boundary_post'});
}
export function towerGuards(e,p,levels,roof,root){
 const hole=[[[.97,.97],[.97,5.03]],[[.97,5.03],[5.03,5.03]],[[5.03,5.03],[5.03,.97]],[[5.03,.97],[2.05,.97]]];
 for(const l of [...levels.slice(1),roof])boundary(e,l.id+':opening-guard',l.id,l.id+':slab',hole,l.elevation+p.finish);
 const W=p.width,D=p.depth;boundary(e,root+':roof-edge-guard',roof.id,roof.id+':slab',[[[0,0],[W,0]],[[W,0],[W,D]],[[W,D],[0,D]],[[0,D],[0,0]]],roof.elevation+p.finish);
}

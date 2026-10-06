/* Independent triangle intersection audit, original implementation.
   Strict non-coplanar intersections only; not continuous collision detection. */
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function segmentTriangle(a,b,x,y,z){const d=sub(b,a),e1=sub(y,x),e2=sub(z,x),p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-10)return false;const inv=1/det,t=sub(a,x),u=dot(t,p)*inv;if(u< -1e-8||u>1+1e-8)return false;const q=cross(t,e1),v=dot(d,q)*inv;if(v< -1e-8||u+v>1+1e-8)return false;const at=dot(e2,q)*inv;return at>1e-7&&at<1-1e-7;}
function intersects(a,b){for(let i=0;i<3;i++)if(segmentTriangle(a[i],a[(i+1)%3],...b)||segmentTriangle(b[i],b[(i+1)%3],...a))return true;return false;}
const overlaps=(a,b)=>!a.lo.some((x,k)=>x>b.hi[k]||a.hi[k]<b.lo[k]);
const bounds=points=>({lo:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),hi:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))});
function mesh(positions,faces){const triangles=faces.map((ids,id)=>{const points=ids.map(i=>positions[i]);return{id,ids,points,...bounds(points)};});function build(rows){const lo=[0,1,2].map(k=>Math.min(...rows.map(r=>r.lo[k]))),hi=[0,1,2].map(k=>Math.max(...rows.map(r=>r.hi[k])));if(rows.length<=8)return{lo,hi,rows};const axis=[0,1,2].sort((a,b)=>(hi[b]-lo[b])-(hi[a]-lo[a]))[0];rows.sort((a,b)=>a.lo[axis]+a.hi[axis]-b.lo[axis]-b.hi[axis]);const mid=rows.length>>1;return{lo,hi,left:build(rows.slice(0,mid)),right:build(rows.slice(mid))};}return{triangles,root:build([...triangles])};}
function candidates(node,box,out){if(!overlaps(node,box))return;if(node.rows){for(const row of node.rows)if(overlaps(row,box))out.push(row);}else{candidates(node.left,box,out);candidates(node.right,box,out);}}
export function prepareBodyAudit(body){return mesh(body.positionsMm,body.triangles);}
export function strictIntersectionAudit(spec,positionsMm,groups,bodyMesh){let offset=0;const faces=spec.panels.flatMap(p=>{const f=p.triangles.map(t=>t.map(i=>i+offset));offset+=p.uvMm.length;return f;}),cloth=mesh(positionsMm,faces),bodyFaces=[],selfPairs=[];
 for(const t of cloth.triangles){const rows=[];candidates(bodyMesh.root,t,rows);if(rows.some(b=>intersects(t.points,b.points)))bodyFaces.push(t.id);}
 for(const t of cloth.triangles){const rows=[];candidates(cloth.root,t,rows);for(const b of rows){if(b.id<=t.id||t.ids.some(i=>b.ids.some(j=>groups[i]===groups[j])))continue;if(intersects(t.points,b.points))selfPairs.push([t.id,b.id]);}}
 return{bodyIntersectingFaceCount:bodyFaces.length,bodyIntersectingFaces:bodyFaces,selfStrictTriangleIntersectionCount:selfPairs.length,selfPairs,coplanarOverlapChecked:false,continuousCollisionChecked:false,stitchedAdjacencyMapUsed:true,method:'independent BVH + segment/triangle intersection on final geometry'};
}

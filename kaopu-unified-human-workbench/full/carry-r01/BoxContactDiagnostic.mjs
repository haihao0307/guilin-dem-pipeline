/** Exact static triangle-distance diagnostic in object-local coordinates.
 * No swept collision, friction or force-closure inference. */
import {triangleDistance} from '../../collision-architecture/r03-dynamic/TriangleContact.mjs';
export function boxTriangles(e){const p=[];for(let x=-1;x<=1;x+=2)for(let y=-1;y<=1;y+=2)for(let z=-1;z<=1;z+=2)p.push([x*e[0],y*e[1],z*e[2]]);return [[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]].map(f=>f.map(i=>p[i]));}
export function measureMeshBox({positions,faces,halfExtents,triangleIds=null}){
 if(halfExtents.length!==3||!halfExtents.every(x=>Number.isFinite(x)&&x>0))throw Error('Positive box extents required');
 const box=boxTriangles(halfExtents);let nearest=Infinity,nearestTriangle=-1,intersectionCount=0,tested=0,maxInsideVertexDepth=0;
 const ids=triangleIds||Array.from({length:faces.length/3},(_,i)=>i);
 for(const id of ids){const t=[0,1,2].map(k=>positions[faces[id*3+k]]);if(t.some(p=>!p||!p.every(Number.isFinite)))throw Error('Finite actual mesh vertices required');const low=[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))),high=[0,1,2].map(k=>Math.max(...t.map(p=>p[k]))),bound=Math.hypot(...halfExtents.map((e,k)=>Math.max(0,low[k]-e,-e-high[k])));if(bound>nearest)continue;
  for(const p of t){const d=p.map((x,k)=>Math.abs(x)-halfExtents[k]);if(d.every(x=>x<0))maxInsideVertexDepth=Math.max(maxInsideVertexDepth,-Math.max(...d));}
  let d=Infinity;for(const b of box)d=Math.min(d,triangleDistance(t,b).distance);tested++;if(d<1e-10)intersectionCount++;if(d<nearest){nearest=d;nearestTriangle=id;}
 }
 return{nearestSurfaceM:nearest,nearestTriangle,intersectionCount,maxInsideVertexDepth,testedTriangles:tested,totalRegionTriangles:ids.length,scope:'static actual mesh versus 12 exact box triangles; no dynamics or force closure'};
}

import fs from 'node:fs';
import zlib from 'node:zlib';
import {buildNativeSurface,normalArray,point} from '../kernel/NativeSurface.mjs';
import {TeacherSkinBVH} from '../kernel/SurfaceQuery.mjs';
import {unit,sub,dot,mix} from '../src/HairStyleProfile.mjs';
export function earGeometry(){
 const input=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../inputs/native-input.json.gz',import.meta.url)))),h=buildNativeSurface(input).head,normals=normalArray(h.positions,h.triangles),bvh=new TeacherSkinBVH({triangles:h.triangles,componentId:h.components,template:h.positions},h.positions,null,[0,1]);
 const near=p=>{const q=bvh.nearest(p);return dot(sub(p,q.p),unit(point(h,q.t,q.b,normals)));};
 function geometry(g){let bodyCrossings=0,maxTurnDegrees=0;for(let n=1;n<97;n++){
  const a=g.points.slice(n*3-3,n*3),p=g.points.slice(n*3,n*3+3);if(bvh.segmentHit(n===1?mix(a,p,.00002):a,p))bodyCrossings++;
  if(n>1)maxTurnDegrees=Math.max(maxTurnDegrees,Math.acos(Math.max(-1,Math.min(1,dot(unit(sub(a,g.points.slice(n*3-6,n*3-3))),unit(sub(p,a))))))*180/Math.PI);
 }return{bodyCrossings,maxTurnDegrees};}
 const clearances=new Map();function accept(candidate,source){
  if(!clearances.has(source))clearances.set(source,Array.from({length:97},(_,n)=>near(source.points.slice(n*3,n*3+3))));
  const baseline=clearances.get(source);for(let n=1;n<97;n++)if(candidate.points.slice(n*3,n*3+3).some((v,k)=>v!==source.points[n*3+k])&&near(candidate.points.slice(n*3,n*3+3))<Math.min(.0015,baseline[n])-1e-8)return false;
  const g=geometry(candidate);return !g.bodyCrossings&&g.maxTurnDegrees<20;
 }
 return{geometry,accept,near};
}

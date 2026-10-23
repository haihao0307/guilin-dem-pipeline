/** Conservative screen rectangle for unchanged exact field passes.
 * Pixel-edge frusta, not projected-corner heuristics. Camera inside any bound,
 * malformed data, or unreliable near-pole camera fails open to the full tile.
 */
import {prepareTileFrustum,aabbIntersectsTile} from '../whole-building-ground-r01/tile-visibility.mjs';
const valid=b=>b?.min?.length===3&&b?.max?.length===3&&b.min.every((v,k)=>Number.isFinite(v)&&Number.isFinite(b.max[k])&&v<=b.max[k]);
export function conservativePassRect(frame,tile,bounds,{granularity=4}={}){
 if(!frame?.valid||!frame.sidePlanesReliable||!Array.isArray(bounds)||!bounds.length||bounds.some(b=>!valid(b))||bounds.some(b=>frame.eye.every((v,k)=>v>=b.min[k]&&v<=b.max[k]))||bounds.some(b=>b.min.reduce((n,v,k)=>n+frame.forward[k]*((frame.forward[k]>=0?v:b.max[k])-frame.eye[k]),0)<=1e-5))return {...tile,reason:'fail-open'};
 const intersects=r=>{const f=prepareTileFrustum(frame,r);return bounds.some(b=>aabbIntersectsTile(f,b));};
 if(!intersects(tile))return null;
 function trim(axis,upper){let lo=tile[axis],hi=lo+tile[axis==='x'?'width':'height'];const limit=hi;
  while(hi-lo>granularity){const mid=Math.floor((lo+hi)/2),r={...tile};r[axis]=upper?mid:tile[axis];r[axis==='x'?'width':'height']=upper?limit-mid:mid-tile[axis];const visible=intersects(r);if(upper){if(visible)lo=mid;else hi=mid;}else{if(visible)hi=mid;else lo=mid;}}
  return upper?hi:lo;
 }
 const x=trim('x',false),right=trim('x',true),y=trim('y',false),top=trim('y',true);return{x,y,width:right-x,height:top-y,reason:'closed-pixel-frusta'};
}

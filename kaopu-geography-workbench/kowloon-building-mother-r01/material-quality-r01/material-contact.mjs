/** CPU oracle for bounded LOCAL contact visibility, not full-building shadows. */
import {apertureOccludesSegment} from './apertures.mjs';
export const CONTACT_VISIBILITY=Object.freeze({maximumDistanceM:.20,normalBiasM:.000015,minimumSegmentM:.000008,lightSamples:2,scope:'same_aperture_opaque_parts_only',softShadow:false});
export function localContactVisibility(components,objectId,point,normal,lightPoint,{enabled=true}={}){
 if(!Array.isArray(components)||![point,normal,lightPoint].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))||Math.abs(Math.hypot(...normal)-1)>1e-7)throw Error('Finite points and unit normal required');
 if(!enabled||objectId<4000)return 1;
 const instance=Math.floor((objectId-4000)/8),origin=point.map((x,i)=>x+normal[i]*CONTACT_VISIBILITY.normalBiasM),delta=lightPoint.map((x,i)=>x-origin[i]),distance=Math.hypot(...delta);
 if(distance<=.00003)return 1;
 const direction=delta.map(x=>x/distance),end=Math.min(distance,CONTACT_VISIBILITY.maximumDistanceM);
 for(const p of components.flatMap(c=>c.primitives)){
  if(p.materialRole===6||Math.floor((p.objectId-4000)/8)!==instance)continue;
  if(apertureOccludesSegment(p,origin,direction,CONTACT_VISIBILITY.minimumSegmentM,end))return 0;
 }
 return 1;
}

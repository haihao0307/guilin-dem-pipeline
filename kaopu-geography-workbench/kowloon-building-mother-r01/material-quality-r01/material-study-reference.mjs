/** Offline reference for the bounded authored area-light receiver, not a GPU
 * parity claim. Unit-frame coordinates are physical aperture-local metres. */
import {directMaterialBRDF} from './material.mjs';
export const STUDY_LIGHTS=Object.freeze([
 {center:[-.55,.20,1.40],half:[.35,.90],radiance:[9,8.2,7.4]},
 {center:[.55,-.20,1.70],half:[.25,.65],radiance:[2.3,3,4.4]}
]);
const nodes=[-.7745966692,0,.7745966692],weights=[.5555555556,.8888888889,.5555555556];
export function studyAreaLightingReference(point,surface,normal,view,strength=1){
 let sum=[0,0,0];
 for(const light of STUDY_LIGHTS)for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  const delta=light.center.map((c,i)=>c+(i<2?light.half[i]*nodes[i===0?x:y]:0)-point[i]),distance2=Math.max(delta.reduce((s,v)=>s+v*v,0),.01),l=delta.map(v=>v/Math.sqrt(distance2));
  const solidAngle=Math.max(l[2],0)*light.half[0]*light.half[1]*weights[x]*weights[y]/distance2,variance=(light.half[0]**2+light.half[1]**2)/(81*distance2);
  const s={...surface,roughness:Math.min((surface.roughness**4+variance)**.25,1),clearcoatRoughness:Math.min(((surface.clearcoatRoughness??1)**4+variance)**.25,1)};
  const sample=directMaterialBRDF(s,normal,view,l,light.radiance.map(c=>c*solidAngle*strength));sum=sum.map((v,i)=>v+sample[i]);
 }
 return sum;
}
export function studyDisplayReference(radiance,exposure=1){return radiance.map(x=>Math.max(x*exposure/(1+x*exposure),0)**(1/2.2));}

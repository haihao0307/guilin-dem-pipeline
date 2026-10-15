export {COUNT,SEGMENTS,hashFloats,MATERIALS,halton} from '../references/fiber-r02/kernel.mjs';
import {seedRandom,COUNT} from '../references/fiber-r02/kernel.mjs';
export function makeRoots(count=COUNT,seed=270314){
 const random=seedRandom(seed),roots=new Float32Array(count*4),traits=new Float32Array(count*4);
 for(let i=0;i<count;i++){
  // Long terminal hairs only. Roots never respawn during motion.
  const x=random(),z=random(),pigment=random(),group=Math.floor(x*17);
  roots.set([(x-.5)*.060,(z-.5)*.011,Math.min(16,group),pigment],i*4);
  traits.set([.79+.21*random(),.75+.45*random(),random()*Math.PI*2,random()<.028?1:0],i*4);
 }
 return {roots,traits,count,seed};
}
export function groom(x,z,t,wave=1){
 const envelope=Math.sin(Math.PI*t);
 return [x*(1-.20*t*t)+wave*.012*Math.sin(6*t)*envelope,
 .128-.259*t,
 z*(1-.18*t)+wave*.012*Math.sin(7.2*t+.4)*envelope];
}

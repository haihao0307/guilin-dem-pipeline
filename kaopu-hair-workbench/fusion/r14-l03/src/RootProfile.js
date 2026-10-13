/** R14 root emergence in metres, independent of total segment count.
 * Original barycentric anchors are immutable. No scalp paint or hidden cap.
 * Root blend is a grooming control, not a measured biological parameter.
 */
import {crownWeight} from './GroomTopology.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function rootGap(distance){return .00002+.00053*smooth(0,.006,distance);}
export function rootEnvelopeDerivative(root,length,d,distance){
 const s=clamp(distance/Math.max(length,1e-6)),short=smooth(.006,.040,length),top=smooth(.325,.375,root[1]);
 const height=Math.min(d.volumeMM*.001*(1-.84*crownWeight(root))*(.35+.65*top),length*.14)*short;
 // sin^2 starts with zero slope. The previous sin profile lifted even stubble.
 return height/Math.max(length,.001)*Math.PI*Math.sin(2*Math.PI*s)*smooth(0,d.rootBlendMM*.001,distance);
}
export function rootDetailGain(length,d,distance){return smooth(.008,.035,length)*smooth(d.rootBlendMM*.001,d.rootBlendMM*.001+.010,distance);}
export function rootClumpGain(length,d,distance){return smooth(.005,.025,length)*smooth(d.rootBlendMM*.001,d.rootBlendMM*.001+.016,distance);}

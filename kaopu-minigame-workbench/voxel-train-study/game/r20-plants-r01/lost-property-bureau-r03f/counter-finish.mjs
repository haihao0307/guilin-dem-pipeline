/** One bounded original-mother parameter experiment on the new counter only.
 * No original mother, paint, colour, exposure, light or geometry is rewritten.
 * counts.y is a QA-visible receiver switch, never a distance-field input.
 */
export const COUNTER_FINISH = Object.freeze({textureScale:3,grainContrast:.34,baselineTextureScale:.70,baselineGrainContrast:.20902697160467504,scope:'component-framed material 4/18 counter members only'});
export const COUNTER_FINISH_BINDING='if(u.counts.y==1u&&f.component.enabled>.5&&(f.mat==4u||f.mat==18u)){wp.textureScale=3.;wp.grainContrast=.34;}';
export function bindPublicCounterFinish(original) {
 const anchor='wp.clearcoat=select(.08,.48,f.mat==18u);';
 if(original.split(anchor).length!==2)throw Error('Counter binding anchor changed; stop rather than rewrite an unknown material.');
 return original.replace(anchor,anchor+'\n '+COUNTER_FINISH_BINDING);
}

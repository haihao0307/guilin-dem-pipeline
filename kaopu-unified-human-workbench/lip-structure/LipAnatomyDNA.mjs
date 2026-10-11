import {clamp} from './LipMath.mjs';
/** Identity and optics are separate from performance. Values are authoring
 * controls, not estimates of a person's physiology from a photograph. */
export const DNA_DEFAULTS=Object.freeze({schema:'kaopu/lip-anatomy-dna@1',upperMelanin:.26,lowerMelanin:.16,upperBlood:.48,lowerBlood:.54,oxygenation:.72,upperRoughness:.54,lowerRoughness:.49,upperWetness:.35,lowerWetness:.45,tissueDepth:1,microGeometry:1,skinRefinement:.65});
export const DNA_RANGES={upperMelanin:[0,1],lowerMelanin:[0,1],upperBlood:[0,1],lowerBlood:[0,1],oxygenation:[0,1],upperRoughness:[.3,.8],lowerRoughness:[.3,.8],upperWetness:[0,1],lowerWetness:[0,1],tissueDepth:[.5,1.5],microGeometry:[0,1.5],skinRefinement:[0,1]};
export function validateDNA(o={}){if(!o||typeof o!=='object'||Array.isArray(o))throw Error('嘴唇身份必须为对象');const n={...DNA_DEFAULTS,...o};if(n.schema!==DNA_DEFAULTS.schema)throw Error('嘴唇身份版本不兼容');for(const[k,v]of Object.entries(n))if(k!=='schema'){const r=DNA_RANGES[k];if(!r||!Number.isFinite(v)||v<r[0]||v>r[1])throw Error('嘴唇身份参数越界：'+k);}return n;}
export class LipAnatomyDNA{
 constructor(rails,o={}){this.settings=validateDNA(o);this.referenceWidth=rails.half*2;this.units='metres';this.source='retained native landmark rails; no new head or donor topology';}
 set(o){this.settings=validateDNA({...this.settings,...o});return this.settings;}
 scale(width){return clamp(width/this.referenceWidth,.35,2.2);}
 archive(){return structuredClone(this.settings);}
}

export const PERFORMANCE_DEFAULTS=Object.freeze({schema:'kaopu/lip-performance@1',pucker:0,funnel:0,press:0,seal:0,rollIn:0,rollOut:0,stretchLeft:0,stretchRight:0,upperRaise:0,lowerDepress:0,cornerLeft:0,cornerRight:0,adhesion:0,release:0});
export const PERFORMANCE_RANGES=Object.fromEntries(Object.keys(PERFORMANCE_DEFAULTS).filter(k=>k!=='schema').map(k=>[k,k.startsWith('corner')?[-1,1]:[0,1]]));
export function validatePerformance(o={}){if(!o||typeof o!=='object'||Array.isArray(o))throw Error('唇部动作必须是对象');const s={...PERFORMANCE_DEFAULTS,...o};if(s.schema!==PERFORMANCE_DEFAULTS.schema)throw Error('唇部动作版本不兼容');for(const[k,v]of Object.entries(s))if(k!=='schema'){const r=PERFORMANCE_RANGES[k];if(!r||!Number.isFinite(v)||v<r[0]||v>r[1])throw Error('唇部动作越界：'+k);}return s;}
export const PERFORMANCE_PRESETS={neutral:{jawOpen:0},speak:{jawOpen:.36,upperRaise:.20,lowerDepress:.12},pucker:{jawOpen:.06,pucker:.82,seal:.24},funnel:{jawOpen:.38,funnel:.7},press:{jawOpen:0,press:.82,seal:.78},smile:{jawOpen:.12,stretchLeft:.58,stretchRight:.58,cornerLeft:.58,cornerRight:.58},asymmetric:{jawOpen:.06,cornerLeft:.72,stretchLeft:.38,cornerRight:-.12},roll:{jawOpen:.08,rollIn:.65,press:.25},release:{jawOpen:.20,adhesion:.72,release:.28}};
/** Uses the existing registered Anny jawOpen expression. GNM's four joints
 * are neck/head/eyes, NOT jaw. The prior expression owner is restored on close;
 * all original GNM/MHR coefficients stay saved rather than being erased. */
export class LipPerformance{
 constructor(model,o={}){this.model=model;this.settings=validatePerformance(o);this.ownerBeforeJaw=null;}
 set(patch={}){const {jawOpen,...rest}=patch,next=validatePerformance({...this.settings,...rest});if(jawOpen!==undefined){if(!Number.isFinite(jawOpen)||jawOpen<0||jawOpen>1)throw Error('下颌开合越界');const state=structuredClone(this.model.state);if(jawOpen>0){if(this.ownerBeforeJaw===null)this.ownerBeforeJaw=state.owners.expression;state.owners.expression='anny';state.anny.facialActions.jawOpen=jawOpen;}else{state.anny.facialActions.jawOpen=0;if(this.ownerBeforeJaw){state.owners.expression=this.ownerBeforeJaw;this.ownerBeforeJaw=null;}}this.model.compute(state);}this.settings=next;return this.archive();}
 get jawOpen(){return this.model.state?.owners.expression==='anny'?Math.max(0,Math.min(1,this.model.state?.anny?.facialActions?.jawOpen||0)):0;}
 preset(name){if(!PERFORMANCE_PRESETS[name])throw Error('未知嘴唇动作');return this.set({...PERFORMANCE_DEFAULTS,...PERFORMANCE_PRESETS[name]});}
 archive(){return structuredClone(this.settings);}
}

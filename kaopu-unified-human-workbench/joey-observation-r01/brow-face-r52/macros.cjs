'use strict';
const macros=[{id:'D-native-brow-layout',purpose:'R51 A longitudinal direction with moderate mouth-width change and original nose translation to counter its lower nosebase; native CC0 brows and current-head R30 roots.',values:{'head-scale-vert-incr':0,'chin-height-incr':0,'mouth-trans-up':.15,'nose-scale-vert-incr':.13,'nose-trans-up':.35,'mouth-scale-horiz-incr':-.15}}];
function makeCandidate(base,spec){const a=structuredClone(base);for(const[k,v]of Object.entries(spec.values)){if(!Number.isFinite(v)||v < -1||v>1)throw Error('Invalid native shape value '+k);a.state.anny.localChanges[k]=v;}return a;}
module.exports={macros,makeCandidate};

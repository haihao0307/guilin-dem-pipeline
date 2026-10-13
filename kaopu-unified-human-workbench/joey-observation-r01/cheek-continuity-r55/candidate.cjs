'use strict';
// One original artistic hypothesis. Private photographs/target points are excluded.
const spec={id:'R55-cheek-continuity',base:'R52',values:{'l-cheek-inner-incr':.35,'r-cheek-inner-incr':.35,'l-cheek-volume-incr':.30,'r-cheek-volume-incr':.30},purpose:'Test a fuller continuous inner-cheek surface beside the nose without changing jaw, nose, mouth, eyebrows or eyes.'};
function makeCandidate(base){const a=structuredClone(base);for(const[k,v]of Object.entries(spec.values)){if(!Number.isFinite(v)||v < -1||v > 1)throw Error('Invalid native control '+k);a.state.anny.localChanges[k]=v;}return a;}
module.exports={spec,makeCandidate};

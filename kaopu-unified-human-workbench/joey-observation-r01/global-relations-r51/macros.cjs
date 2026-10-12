'use strict';
// Three independent, authored hypotheses. No per-photo identity or hidden vertex deformation.
const macros=[
 {id:'A-vertical-layout',purpose:'Release the old vertical compression; coordinate nose endpoint, mouth level and lower-face length.',values:{'head-scale-vert-incr':0,'chin-height-incr':0,'mouth-trans-up':.15,'nose-scale-vert-incr':.13}},
 {id:'B-cheek-jaw-balance',purpose:'Less shortened face; softer cheek volume and less forward jaw corner without narrowing every facial feature.',values:{'head-scale-vert-incr':-.05,'head-fat-incr':-.25,'l-cheek-volume-incr':.32,'r-cheek-volume-incr':.32,'chin-bones-incr':-.65,'mouth-trans-up':.2}},
 {id:'C-mouth-layout',purpose:'Coordinate overall length with mouth width and nose-to-mouth spacing; leave chin-height axis unchanged.',values:{'head-scale-vert-incr':0,'mouth-scale-horiz-incr':-.25,'mouth-trans-up':0,'nose-scale-vert-incr':.08}}
];
function makeCandidate(base,spec){const a=structuredClone(base);for(const[k,v]of Object.entries(spec.values)){if(!Number.isFinite(v)||v < -1||v>1)throw Error('Invalid native shape value '+k);a.state.anny.localChanges[k]=v;}return a;}
module.exports={macros,makeCandidate};

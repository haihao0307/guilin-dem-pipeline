'use strict';
// Original native semantic controls; dimensions are not millimetres or PCA scores.
const axes=[
 ['head-height',['head-scale-vert-incr']],['head-width',['head-scale-horiz-incr']],['head-depth',['head-scale-depth-incr']],['head-fullness',['head-fat-incr']],
 ['forehead-height',['forehead-scale-vert-incr']],['temple-width',['forehead-temple-incr']],
 ['cheek-height',['l-cheek-trans-up','r-cheek-trans-up']],['cheek-volume',['l-cheek-volume-incr','r-cheek-volume-incr']],['cheek-inner',['l-cheek-inner-incr','r-cheek-inner-incr']],['cheek-bone',['l-cheek-bones-incr','r-cheek-bones-incr']],
 ['chin-height',['chin-height-incr']],['chin-width',['chin-width-incr']],['jaw-bone',['chin-bones-incr']],['chin-projection',['chin-prominent-incr']],
 ['mouth-height-position',['mouth-trans-up']],['mouth-width',['mouth-scale-horiz-incr']],['mouth-depth',['mouth-scale-depth-incr']],['nose-height-position',['nose-trans-up']],['nose-length',['nose-scale-vert-incr']]
].map(([id,labels])=>({id,labels}));
function applyDelta(archive,axis,delta){if(!Number.isFinite(delta)||!axis.labels?.length)throw Error('Invalid axis probe');const a=structuredClone(archive);for(const label of axis.labels){const value=(a.state.anny.localChanges[label]??0)+delta;if(!Number.isFinite(value)||value < -1||value>1)throw Error('Native parameter outside bounds: '+label);a.state.anny.localChanges[label]=value;}return a;}
module.exports={axes,applyDelta};

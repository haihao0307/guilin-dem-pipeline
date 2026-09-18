/* R03.A source-alpha display policy. Honors the reference material's BLEND
 * semantics with an opaque pass plus a translucent pass. The translucent pass
 * is intentionally marked order-dependent; this is not yet refractive fins,
 * weighted OIT, or final material-fidelity acceptance. */
const AlphaPolicy=(()=>{'use strict';
const opaqueThreshold=.985,alphaFloor=.015;
function classify(a){if(!Number.isFinite(a))throw Error('alpha must be finite');a=Math.max(0,Math.min(1,a));return a<alphaFloor?'discard':a>=opaqueThreshold?'opaque':'translucent'}
function beginOpaque(gl){gl.disable(gl.BLEND);gl.depthMask(true)}
function beginTranslucent(gl){gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false)}
function restore(gl){gl.depthMask(true);gl.disable(gl.BLEND)}
return{opaqueThreshold,alphaFloor,classify,beginOpaque,beginTranslucent,restore,orderIndependent:false,refractive:false};})();
if(typeof module!=='undefined')module.exports=AlphaPolicy;

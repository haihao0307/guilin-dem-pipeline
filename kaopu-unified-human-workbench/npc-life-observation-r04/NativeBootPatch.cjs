'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const rendererFile=require.resolve('./NativeBootRenderer.cjs');
const rendererSHA256='d951fdd3878c32c1ca3b7f8027ad12633960da1b6b68e6dbc2065e4b7c3dd1ac';
if(crypto.createHash('sha256').update(fs.readFileSync(rendererFile)).digest('hex')!==rendererSHA256)
  throw Error('Retained R04 native startup renderer changed; re-audit before building');
const native=require('./NativeBootRenderer.cjs');
/** Observation owns animation in this composition. R07 remains untouched on disk.
 * Do not instantiate (then hide/dispose) its second MotionStudio: construction
 * registers handlers, creates a scene root and schedules its own RAF.
 * This anchor is audited against the SHA-locked R07 host in build.cjs.
 */
const MOTION_CREATION_ANCHOR = 'if(_s(n))ct=new l({viewer:De,controller:ge,host:c});else{c.remove();return}';
const MOTION_DISABLED_REPLACEMENT = 'if(_s(n)){ct=null;c.remove();window.__NPC_HOST_AUTHORITY__=Object.freeze({schema:"kaopu/npc-host-authority@1",owner:"npc-life-observation",legacyMotionController:"not-created",legacyMotionRAF:"not-created",scope:"observation-composition-only"});}else{c.remove();return}';
function patchNativeMotionOwnership(html) {
  if (typeof html !== 'string') throw new TypeError('Native host must be UTF-8 text');
  const count = html.split(MOTION_CREATION_ANCHOR).length - 1;
  if (count !== 1) throw new Error('R07 MotionStudio composition anchor must match exactly once; got ' + count);
  return html.replace(MOTION_CREATION_ANCHOR, MOTION_DISABLED_REPLACEMENT);
}

function patchNativeBoot(html){
  return patchNativeMotionOwnership(native.patchNativeBoot(html));
}
module.exports={...native,patchNativeBoot,patchNativeMotionOwnership,MOTION_CREATION_ANCHOR,MOTION_DISABLED_REPLACEMENT};

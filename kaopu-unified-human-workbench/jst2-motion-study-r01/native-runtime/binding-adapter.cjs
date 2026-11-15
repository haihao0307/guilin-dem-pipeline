'use strict';
const assert=require('node:assert/strict');

// R07's full-body material calls skin.material.onBeforeCompile dynamically to
// inherit its vertex deformation. NativeBinding visits both materials. Keep
// that shared vertex contract exactly once; do not touch either skin fragment.
function adaptBinding(source){
  const anchor='prior(s);Object.assign(s.uniforms,this.U);s.vertexShader=';
  assert.equal(source.split(anchor).length,2,'NativeBinding shader hook changed');
  return source.replace(anchor,"prior(s);Object.assign(s.uniforms,this.U);if(s.vertexShader.includes('uniform sampler2D mrRanges,mrEntries,mrBones;')){this.lastShader=s;return;}s.vertexShader=");
}
module.exports={adaptBinding};

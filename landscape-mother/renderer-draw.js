(() => {
'use strict';
const { LandscapeMotherRenderer } = window.LandscapeMotherRendererCore;
Object.assign(LandscapeMotherRenderer.prototype, {
  drawSkirt() {
    const gl = this.gl;
    gl.useProgram(this.programs.skirt);
    gl.uniformMatrix4fv(this.uniforms.skirt.viewProjection, false, this.viewProjection);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.skirt.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.skirt.count);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
  },
  drawTerrain(mode, detailMix, eye) {
    const gl = this.gl;
    gl.useProgram(this.programs.terrain);
    gl.uniformMatrix4fv(this.uniforms.terrain.viewProjection, false, this.viewProjection);
    gl.uniform1f(this.uniforms.terrain.detailMix, detailMix);
    gl.uniform1i(this.uniforms.terrain.mode, mode);
    gl.uniform1f(this.uniforms.terrain.minimum, this.compiled.minimum);
    gl.uniform1f(this.uniforms.terrain.maximum, this.compiled.maximum);
    gl.uniform1f(this.uniforms.terrain.materialDetail, this.materialDetail);
    gl.uniform1f(this.uniforms.terrain.colorRichness, this.colorRichness);
    gl.uniform3f(this.uniforms.terrain.eye, eye[0], eye[1], eye[2]);
    gl.bindVertexArray(this.terrain.vao);
    gl.drawElements(gl.TRIANGLES, this.terrain.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  },
  drawWater(eye, now, mode) {
    if (!this.showWater || !this.water.indexCount || ![0, 1, 4].includes(mode)) return;
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.programs.water);
    gl.uniformMatrix4fv(this.uniforms.water.viewProjection, false, this.viewProjection);
    gl.uniform3f(this.uniforms.water.eye, eye[0], eye[1], eye[2]);
    gl.uniform1f(this.uniforms.water.time, now * 0.001);
    gl.bindVertexArray(this.water.vao);
    gl.drawElements(gl.TRIANGLES, this.water.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  },
  drawViewport(x, width, mode, detailMix, now) {
    const gl = this.gl;
    gl.viewport(x, 0, width, this.canvas.height);
    gl.scissor(x, 0, width, this.canvas.height);
    const eye = this.updateMatrices(width, this.canvas.height);
    this.drawSkirt();
    this.drawTerrain(mode, detailMix, eye);
    this.drawWater(eye, now, mode);
  },
  render(now = performance.now()) {
    this.resize();
    const gl = this.gl;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (this.mode === 6) {
      const left = Math.floor(this.canvas.width / 2);
      this.drawViewport(0, left, 1, 0, now);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.drawViewport(left, this.canvas.width - left, 0, this.detailMix, now);
    } else {
      this.drawViewport(0, this.canvas.width, this.mode, this.mode === 1 ? 0 : this.detailMix, now);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.finish();
    if (this.lastFrameAt) {
      this.frameSamples.push(now - this.lastFrameAt);
      if (this.frameSamples.length > 120) this.frameSamples.shift();
    }
    this.lastFrameAt = now;
    this.dirty = false;
    this.time = now;
  },
  signature() {
    this.render(performance.now());
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const step = Math.max(1, Math.floor(Math.max(width, height) / 360));
    let count = 0;
    let sum = 0;
    let sumSquared = 0;
    let edgeSum = 0;
    let hash = 2166136261 >>> 0;
    const lumaAt = (x, y) => {
      const offset = (y * width + x) * 4;
      return (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255;
    };
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const offset = (y * width + x) * 4;
        const luma = lumaAt(x, y);
        sum += luma;
        sumSquared += luma * luma;
        if (x + step < width) edgeSum += Math.abs(luma - lumaAt(x + step, y));
        hash ^= pixels[offset]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= pixels[offset + 1]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= pixels[offset + 2]; hash = Math.imul(hash, 16777619) >>> 0;
        count += 1;
      }
    }
    const mean = sum / Math.max(1, count);
    const variance = Math.max(0, sumSquared / Math.max(1, count) - mean * mean);
    return {
      hash: hash.toString(16).padStart(8, '0'),
      meanLuminance: mean,
      luminanceStdDev: Math.sqrt(variance),
      edgeEnergy: edgeSum / Math.max(1, count),
      sampleCount: count,
      canvas: [width, height],
    };
  },
});
})();

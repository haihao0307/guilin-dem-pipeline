(() => {
'use strict';
const { LandscapeMotherRenderer, clamp, mat4Multiply, mat4Perspective, mat4LookAt } = window.LandscapeMotherRendererCore;
Object.assign(LandscapeMotherRenderer.prototype, {
  resize() {
    const ratio = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    const width = Math.max(2, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(2, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.dirty = true;
    }
  },
  eye() {
    const horizontal = Math.cos(this.camera.pitch) * this.camera.distance;
    return [
      this.camera.target[0] + Math.sin(this.camera.yaw) * horizontal,
      this.camera.target[1] + Math.sin(this.camera.pitch) * this.camera.distance,
      this.camera.target[2] + Math.cos(this.camera.yaw) * horizontal,
    ];
  },
  updateMatrices(width = this.canvas.width, height = this.canvas.height) {
    const eye = this.eye();
    mat4Perspective(this.projection, Math.PI / 4.15, width / Math.max(1, height), 0.45, 9000);
    mat4LookAt(this.view, eye, this.camera.target, [0, 1, 0]);
    mat4Multiply(this.viewProjection, this.projection, this.view);
    return eye;
  },
  averageFps() {
    if (this.frameSamples.length < 8) return null;
    const average = this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length;
    return average > 0 ? 1000 / average : null;
  },
  setMode(mode) {
    this.mode = clamp(Number(mode), 0, 6);
    this.dirty = true;
  },
  setView(name) {
    const relief = this.compiled.maximum - this.compiled.minimum;
    if (name === 'top') {
      this.camera.target = [0, relief * 0.18, 0];
      this.camera.yaw = -0.05;
      this.camera.pitch = 1.485;
      this.camera.distance = 1320;
    } else if (name === 'rock') {
      const fields = this.compiled.fields;
      let best = 0;
      for (let index = 1; index < fields.rock.length; index += 1) {
        const score = fields.rock[index] * (0.6 + Math.max(0, fields.tpi[index]));
        const bestScore = fields.rock[best] * (0.6 + Math.max(0, fields.tpi[best]));
        if (score > bestScore) best = index;
      }
      const row = Math.floor(best / this.compiled.grid);
      const column = best % this.compiled.grid;
      this.camera.target = [
        column * this.compiled.spacing - this.compiled.sideM * 0.5,
        this.compiled.denseTruth[best] - this.compiled.minimum,
        row * this.compiled.spacing - this.compiled.sideM * 0.5,
      ];
      this.camera.yaw = -1.02;
      this.camera.pitch = 0.27;
      this.camera.distance = 360;
    } else if (name === 'field') {
      const fields = this.compiled.fields;
      let sx = 0;
      let sz = 0;
      let weight = 0;
      for (let row = 0; row < this.compiled.grid; row += this.compiled.subdivision) {
        for (let column = 0; column < this.compiled.grid; column += this.compiled.subdivision) {
          const index = row * this.compiled.grid + column;
          const value = fields.paddy[index];
          sx += (column * this.compiled.spacing - this.compiled.sideM * 0.5) * value;
          sz += (row * this.compiled.spacing - this.compiled.sideM * 0.5) * value;
          weight += value;
        }
      }
      this.camera.target = weight ? [sx / weight, 14, sz / weight] : [0, 14, 0];
      this.camera.yaw = -0.72;
      this.camera.pitch = 0.23;
      this.camera.distance = 310;
    } else {
      this.camera.target = [0, relief * 0.24, 0];
      this.camera.yaw = -0.78;
      this.camera.pitch = 0.52;
      this.camera.distance = this.compiled.mobile ? 1450 : 1380;
    }
    this.dirty = true;
  },
  orbit(dx, dy) {
    this.camera.yaw -= dx * 0.0055;
    this.camera.pitch = clamp(this.camera.pitch + dy * 0.0045, 0.07, 1.49);
    this.dirty = true;
  },
  pan(dx, dy) {
    const scale = this.camera.distance * 0.00105;
    const rightX = Math.cos(this.camera.yaw);
    const rightZ = -Math.sin(this.camera.yaw);
    const forwardX = Math.sin(this.camera.yaw);
    const forwardZ = Math.cos(this.camera.yaw);
    this.camera.target[0] = clamp(this.camera.target[0] - dx * scale * rightX - dy * scale * forwardX, -540, 540);
    this.camera.target[2] = clamp(this.camera.target[2] - dx * scale * rightZ - dy * scale * forwardZ, -540, 540);
    this.dirty = true;
  },
  zoom(delta) {
    this.camera.distance = clamp(this.camera.distance * Math.exp(delta * 0.001), this.camera.minDistance, this.camera.maxDistance);
    this.dirty = true;
  },
});
})();

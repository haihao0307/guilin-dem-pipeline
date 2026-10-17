(() => {
'use strict';
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const { TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER } = window.LandscapeMotherTerrainShaders;
const { WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER, SKIRT_VERTEX_SHADER, SKIRT_FRAGMENT_SHADER } = window.LandscapeMotherWaterShaders;
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'shader compile failed');
  }
  return shader;
}
function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log || 'program link failed');
  }
  return program;
}
function mat4Multiply(out, a, b) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
  }
  out.set(result);
  return out;
}
function mat4Perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = 2 * far * near / (near - far);
  return out;
}
function mat4LookAt(out, eye, center, up) {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let length = Math.hypot(zx, zy, zz) || 1;
  zx /= length;
  zy /= length;
  zz /= length;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  length = Math.hypot(xx, xy, xz) || 1;
  xx /= length;
  xy /= length;
  xz /= length;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out.set([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
  return out;
}
class LandscapeMotherRenderer {
  constructor(canvas, compiled) {
    this.canvas = canvas;
    this.compiled = compiled;
    this.mode = 0;
    this.detailMix = 1;
    this.materialDetail = 1;
    this.colorRichness = 1;
    this.showWater = true;
    this.maxDpr = compiled.mobile ? 1.15 : 1.5;
    this.camera = {
      target: [0, (compiled.maximum - compiled.minimum) * 0.24, 0],
      yaw: -0.78,
      pitch: 0.52,
      distance: compiled.mobile ? 1450 : 1380,
      minDistance: 90,
      maxDistance: 4800,
    };
    this.projection = new Float32Array(16);
    this.view = new Float32Array(16);
    this.viewProjection = new Float32Array(16);
    this.frameSamples = [];
    this.lastFrameAt = 0;
    this.dirty = true;
    this.time = 0;
    this.gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    if (!this.gl) throw new Error('WebGL2 is required');
    this.setupPrograms();
    this.buildTerrain();
    this.buildWater();
    this.buildSkirt();
    this.configureGl();
  }
  configureGl() {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0.015, 0.026, 0.022, 1);
  }
  setupPrograms() {
    const gl = this.gl;
    this.programs = {
      terrain: createProgram(gl, TERRAIN_VERTEX_SHADER, TERRAIN_FRAGMENT_SHADER),
      water: createProgram(gl, WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER),
      skirt: createProgram(gl, SKIRT_VERTEX_SHADER, SKIRT_FRAGMENT_SHADER),
    };
    this.uniforms = {
      terrain: {
        viewProjection: gl.getUniformLocation(this.programs.terrain, 'uViewProjection'),
        detailMix: gl.getUniformLocation(this.programs.terrain, 'uDetailMix'),
        mode: gl.getUniformLocation(this.programs.terrain, 'uMode'),
        minimum: gl.getUniformLocation(this.programs.terrain, 'uMinElevation'),
        maximum: gl.getUniformLocation(this.programs.terrain, 'uMaxElevation'),
        materialDetail: gl.getUniformLocation(this.programs.terrain, 'uMaterialDetail'),
        colorRichness: gl.getUniformLocation(this.programs.terrain, 'uColorRichness'),
        eye: gl.getUniformLocation(this.programs.terrain, 'uEye'),
      },
      water: {
        viewProjection: gl.getUniformLocation(this.programs.water, 'uViewProjection'),
        eye: gl.getUniformLocation(this.programs.water, 'uEye'),
        time: gl.getUniformLocation(this.programs.water, 'uTime'),
      },
      skirt: {
        viewProjection: gl.getUniformLocation(this.programs.skirt, 'uViewProjection'),
      },
    };
  }
}
window.LandscapeMotherRendererCore = Object.freeze({
  clamp, createProgram, mat4Multiply, mat4Perspective, mat4LookAt, LandscapeMotherRenderer,
});
})();

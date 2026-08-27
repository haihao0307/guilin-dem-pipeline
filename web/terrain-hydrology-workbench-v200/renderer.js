import { clamp, identity, perspective, lookAt, multiply, loadImage, loadArrayBuffer } from './math.js';
import { vertexSource, fragmentSource } from './shaders.js';

const MODE_INDEX = Object.freeze({ terrain: 0, terrace: 1, hydrology: 2, slope: 3 });

export class TerrainRenderer {
  constructor(canvas, region, options = {}) {
    this.canvas = canvas;
    this.region = region;
    this.focus = Boolean(options.focus);
    this.readout = options.readout || null;
    this.metrics = options.metrics || null;
    this.fallback = options.fallback || null;
    this.gl = null;
    this.backend = 'pending';
    this.loaded = false;
    this.mode = 0;
    this.verticalScale = 1;
    this.height = null;
    this.mask = null;
    this.meshCols = 0;
    this.meshRows = 0;
    this.pointerMap = new Map();
    this.lastPinch = null;
    this.dragMode = 'orbit';
    this.renderQueued = false;
    this.minimumDistance = this.focus ? 12 : 45;
    this.patch = {
      originX: 0,
      originY: 0,
      scaleX: 1,
      scaleY: 1,
      widthMeters: region.world.widthMeters,
      heightMeters: region.world.heightMeters,
    };
    this.camera = { yaw: -.62, pitch: .69, distance: 13500, x: 0, z: 0 };
    this.resizeObserver = new ResizeObserver(() => this.requestRender());
    this.resizeObserver.observe(canvas);
  }

  async load() {
    const root = this.region.assets.root;
    this.updateReadout('正在读取完整高程、有效性掩膜和水系诊断层');
    const [heightBuffer, maskBuffer, hydrologyImage] = await Promise.all([
      loadArrayBuffer(`${root}/${this.region.assets.height}`),
      loadArrayBuffer(`${root}/${this.region.assets.mask}`),
      loadImage(`${root}/${this.region.assets.hydrology}`),
    ]);
    this.height = new Uint16Array(heightBuffer);
    this.mask = new Uint8Array(maskBuffer);
    this.hydrologyImage = hydrologyImage;
    const expected = this.region.grid.width * this.region.grid.height;
    if (this.height.length !== expected || this.mask.length !== expected) {
      throw new Error(`${this.region.id} 高程资产尺寸不符合 manifest`);
    }
    this.configureCamera('overview');
    const gl = this.canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      this.backend = 'high-resolution-preview';
      this.canvas.hidden = true;
      if (this.fallback) {
        this.fallback.hidden = false;
        this.fallback.src = `${root}/${this.region.assets.preview}`;
      }
      this.loaded = true;
      this.updateReadout('浏览器没有提供 WebGL2，当前显示高精度二维地形预览');
      this.updateMetrics();
      return;
    }
    this.gl = gl;
    this.backend = 'webgl2-r16ui-height-texture';
    this.createProgram();
    this.createTextures();
    this.createMesh();
    this.attachInput();
    this.loaded = true;
    this.updateReadout();
    this.requestRender();
  }

  compile(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader) || 'shader compile error');
    }
    return shader;
  }

  createProgram() {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, this.compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, this.compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'program link error');
    }
    this.program = program;
    this.uniform = (name) => gl.getUniformLocation(program, name);
  }

  createTextures() {
    const gl = this.gl;
    const { width, height } = this.region.grid;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    this.heightTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, this.height);

    this.maskTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.mask);

    this.hydrologyTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.hydrologyTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.hydrologyImage);
  }

  chooseMeshSize() {
    const requested = this.focus ? this.region.render.focusMesh : this.region.render.cardMesh;
    if (!this.focus) return requested;
    const mobile = matchMedia('(max-width: 720px)').matches;
    const lowMemory = Number(navigator.deviceMemory || 8) < 6;
    if (mobile || lowMemory) return 513;
    return Math.max(requested, 1025);
  }

  createMesh() {
    const gl = this.gl;
    const meshSize = this.chooseMeshSize();
    this.meshCols = meshSize;
    this.meshRows = meshSize;
    const vertices = new Float32Array(this.meshCols * this.meshRows * 2);
    let offset = 0;
    for (let row = 0; row < this.meshRows; row += 1) {
      for (let column = 0; column < this.meshCols; column += 1) {
        vertices[offset++] = column / (this.meshCols - 1);
        vertices[offset++] = row / (this.meshRows - 1);
      }
    }

    this.indexCount = (this.meshCols - 1) * (this.meshRows - 1) * 6;
    const indices = new Uint32Array(this.indexCount);
    offset = 0;
    for (let row = 0; row < this.meshRows - 1; row += 1) {
      for (let column = 0; column < this.meshCols - 1; column += 1) {
        const a = row * this.meshCols + column;
        const b = a + 1;
        const c = a + this.meshCols;
        const d = c + 1;
        indices[offset++] = a;
        indices[offset++] = c;
        indices[offset++] = b;
        indices[offset++] = b;
        indices[offset++] = c;
        indices[offset++] = d;
      }
    }

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }

  attachInput() {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.pointerUp(event));
    this.canvas.addEventListener('pointercancel', (event) => this.pointerUp(event));
    this.canvas.addEventListener('wheel', (event) => this.wheel(event), { passive: false });
  }

  pointerDown(event) {
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.dragMode = event.button === 2 || event.shiftKey ? 'pan' : 'orbit';
    if (this.pointerMap.size === 2) this.lastPinch = this.pinchState();
  }

  pointerMove(event) {
    const previous = this.pointerMap.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    this.pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointerMap.size >= 2) {
      const current = this.pinchState();
      if (this.lastPinch) {
        this.camera.distance = clamp(
          this.camera.distance * this.lastPinch.distance / Math.max(1, current.distance),
          this.minimumDistance,
          60000,
        );
        this.panCamera(current.centerX - this.lastPinch.centerX, current.centerY - this.lastPinch.centerY);
      }
      this.lastPinch = current;
      this.requestRender();
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (this.dragMode === 'pan') {
      this.panCamera(dx, dy);
    } else {
      this.camera.yaw -= dx * .006;
      this.camera.pitch = clamp(this.camera.pitch - dy * .005, .055, 1.545);
    }
    this.requestRender();
  }

  pointerUp(event) {
    this.pointerMap.delete(event.pointerId);
    this.lastPinch = this.pointerMap.size === 2 ? this.pinchState() : null;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  }

  pinchState() {
    const points = [...this.pointerMap.values()].slice(0, 2);
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    return {
      distance: Math.hypot(dx, dy),
      centerX: (points[0].x + points[1].x) / 2,
      centerY: (points[0].y + points[1].y) / 2,
    };
  }

  wheel(event) {
    event.preventDefault();
    this.camera.distance = clamp(
      this.camera.distance * Math.exp(event.deltaY * .0011),
      this.minimumDistance,
      60000,
    );
    this.requestRender();
  }

  panCamera(dx, dy) {
    const scale = Math.max(.18, this.camera.distance * .0009);
    const rightX = Math.cos(this.camera.yaw);
    const rightZ = -Math.sin(this.camera.yaw);
    const forwardX = Math.sin(this.camera.yaw);
    const forwardZ = Math.cos(this.camera.yaw);
    this.camera.x -= dx * scale * rightX + dy * scale * forwardX;
    this.camera.z -= dx * scale * rightZ + dy * scale * forwardZ;
    this.camera.x = clamp(this.camera.x, -this.region.world.widthMeters / 2, this.region.world.widthMeters / 2);
    this.camera.z = clamp(this.camera.z, -this.region.world.heightMeters / 2, this.region.world.heightMeters / 2);
  }

  configureCamera(preset) {
    const extent = Math.max(this.region.world.widthMeters, this.region.world.heightMeters);
    if (preset === 'near') {
      this.camera = { yaw: -.72, pitch: .50, distance: extent * .18, x: 0, z: 0 };
    } else if (preset === 'ground') {
      this.camera = { yaw: -.42, pitch: .16, distance: extent * .018, x: 0, z: extent * .05 };
    } else {
      this.camera = { yaw: -.62, pitch: .69, distance: extent * 1.34, x: 0, z: 0 };
    }
    this.requestRender();
  }

  setMode(modeName) {
    this.mode = MODE_INDEX[modeName] ?? 0;
    this.requestRender();
  }

  rawHeight(column, row) {
    const width = this.region.grid.width;
    const height = this.region.grid.height;
    const x = Math.max(0, Math.min(width - 1, column));
    const y = Math.max(0, Math.min(height - 1, row));
    return this.height[y * width + x] || 0;
  }

  sampleGround(x, z) {
    const width = this.region.grid.width;
    const height = this.region.grid.height;
    const u = clamp(x / this.region.world.widthMeters + .5, 0, 1);
    const v = clamp(.5 - z / this.region.world.heightMeters, 0, 1);
    const gx = u * (width - 1);
    const gy = v * (height - 1);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const top = this.rawHeight(x0, y0) * (1 - tx) + this.rawHeight(x1, y0) * tx;
    const bottom = this.rawHeight(x0, y1) * (1 - tx) + this.rawHeight(x1, y1) * tx;
    const raw = top * (1 - ty) + bottom * ty;
    return (
      this.region.encoding.offset
      + raw * this.region.encoding.scale
      - this.region.elevation.mean
    ) * this.verticalScale;
  }

  computePatch() {
    const worldWidth = this.region.world.widthMeters;
    const worldHeight = this.region.world.heightMeters;
    if (!this.focus) {
      this.patch = {
        originX: 0,
        originY: 0,
        scaleX: 1,
        scaleY: 1,
        widthMeters: worldWidth,
        heightMeters: worldHeight,
      };
      return this.patch;
    }

    const extent = Math.max(worldWidth, worldHeight);
    const patchMeters = clamp(this.camera.distance * 5.5, 240, extent);
    const scaleX = Math.min(1, patchMeters / worldWidth);
    const scaleY = Math.min(1, patchMeters / worldHeight);
    const centerU = clamp(this.camera.x / worldWidth + .5, 0, 1);
    const centerV = clamp(.5 - this.camera.z / worldHeight, 0, 1);
    const originX = clamp(centerU - scaleX / 2, 0, 1 - scaleX);
    const originY = clamp(centerV - scaleY / 2, 0, 1 - scaleY);
    this.patch = {
      originX,
      originY,
      scaleX,
      scaleY,
      widthMeters: worldWidth * scaleX,
      heightMeters: worldHeight * scaleY,
    };
    return this.patch;
  }

  resize() {
    const ratio = Math.min(devicePixelRatio || 1, this.focus ? 2 : 1.5);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  requestRender() {
    if (!this.loaded || !this.gl || this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  render() {
    if (!this.loaded || !this.gl) return;
    const gl = this.gl;
    this.resize();
    const patch = this.computePatch();
    const targetY = this.sampleGround(this.camera.x, this.camera.z);
    const cp = Math.cos(this.camera.pitch);
    const sp = Math.sin(this.camera.pitch);
    const eye = [
      this.camera.x + this.camera.distance * cp * Math.sin(this.camera.yaw),
      targetY + this.camera.distance * sp,
      this.camera.z + this.camera.distance * cp * Math.cos(this.camera.yaw),
    ];
    const projection = identity();
    const view = identity();
    const mvp = identity();
    const near = Math.max(.015, Math.min(12, this.camera.distance * .00022));
    const far = Math.max(80000, this.camera.distance * 5 + 40000);
    perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, near, far);
    lookAt(view, eye, [this.camera.x, targetY, this.camera.z], [0, 1, 0]);
    multiply(mvp, projection, view);

    gl.clearColor(.075, .10, .085, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.hydrologyTexture);

    gl.uniform1i(this.uniform('uHeight'), 0);
    gl.uniform1i(this.uniform('uMask'), 1);
    gl.uniform1i(this.uniform('uHydrology'), 2);
    gl.uniformMatrix4fv(this.uniform('uMVP'), false, mvp);
    gl.uniform2f(this.uniform('uWorldSize'), this.region.world.widthMeters, this.region.world.heightMeters);
    gl.uniform2i(this.uniform('uGridSize'), this.region.grid.width, this.region.grid.height);
    gl.uniform2f(this.uniform('uSpacing'), this.region.grid.spacingMeters[0], this.region.grid.spacingMeters[1]);
    gl.uniform2f(this.uniform('uPatchUvOrigin'), patch.originX, patch.originY);
    gl.uniform2f(this.uniform('uPatchUvScale'), patch.scaleX, patch.scaleY);
    gl.uniform1f(this.uniform('uHeightOffset'), this.region.encoding.offset);
    gl.uniform1f(this.uniform('uHeightScale'), this.region.encoding.scale);
    gl.uniform1f(this.uniform('uMeanElevation'), this.region.elevation.mean);
    gl.uniform1f(this.uniform('uMinElevation'), this.region.elevation.min);
    gl.uniform1f(this.uniform('uMaxElevation'), this.region.elevation.max);
    gl.uniform1f(this.uniform('uVerticalScale'), this.verticalScale);
    gl.uniform1i(this.uniform('uMode'), this.mode);

    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    this.updateReadout(null, eye);
    this.updateMetrics();
  }

  updateReadout(message = null, eye = null) {
    if (!this.readout) return;
    if (message) {
      this.readout.textContent = message;
      return;
    }
    const eyeText = eye
      ? ` · 镜头离地约 ${Math.max(0, eye[1] - this.sampleGround(eye[0], eye[2])).toFixed(1)} m`
      : '';
    const detailText = this.focus
      ? ' · 近景连续重建显示，真值采样仍为 12.5 m'
      : '';
    this.readout.textContent = `${this.region.truthLabel} · 完整 ${this.region.grid.width} × ${this.region.grid.height} 高程纹理${detailText}${eyeText}`;
  }

  updateMetrics() {
    if (!this.metrics) return;
    const visualSpacing = Math.max(
      this.patch.widthMeters / Math.max(1, this.meshCols - 1),
      this.patch.heightMeters / Math.max(1, this.meshRows - 1),
    );
    this.metrics.textContent = `${(this.camera.distance / 1000).toFixed(this.camera.distance < 1000 ? 3 : 1)} km 镜头 · ${this.meshCols || 0} × ${this.meshRows || 0} 网格 · 视觉三角约 ${visualSpacing.toFixed(visualSpacing < 1 ? 2 : 1)} m · 真值 12.5 m`;
  }

  dispose() {
    this.loaded = false;
    this.resizeObserver.disconnect();
    if (this.gl) {
      const gl = this.gl;
      if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
      if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.heightTexture) gl.deleteTexture(this.heightTexture);
      if (this.maskTexture) gl.deleteTexture(this.maskTexture);
      if (this.hydrologyTexture) gl.deleteTexture(this.hydrologyTexture);
      if (this.program) gl.deleteProgram(this.program);
    }
  }
}

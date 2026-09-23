(() => {
'use strict';
const { LandscapeMotherRenderer, clamp } = window.LandscapeMotherRendererCore;
Object.assign(LandscapeMotherRenderer.prototype, {
  buildTerrain() {
    const gl = this.gl;
    const { grid, spacing, sideM, denseTruth, minimum, truthNormals, enhancedNormals, fields, displacement } = this.compiled;
    const strideFloats = 25;
    const vertices = new Float32Array(grid * grid * strideFloats);
    let cursor = 0;
    for (let row = 0; row < grid; row += 1) {
      for (let column = 0; column < grid; column += 1) {
        const index = row * grid + column;
        const normalOffset = index * 3;
        vertices[cursor++] = column * spacing - sideM * 0.5;
        vertices[cursor++] = denseTruth[index] - minimum;
        vertices[cursor++] = row * spacing - sideM * 0.5;
        vertices[cursor++] = truthNormals[normalOffset];
        vertices[cursor++] = truthNormals[normalOffset + 1];
        vertices[cursor++] = truthNormals[normalOffset + 2];
        vertices[cursor++] = enhancedNormals[normalOffset];
        vertices[cursor++] = enhancedNormals[normalOffset + 1];
        vertices[cursor++] = enhancedNormals[normalOffset + 2];
        vertices[cursor++] = denseTruth[index];
        vertices[cursor++] = fields.slope[index];
        vertices[cursor++] = fields.curvature[index];
        vertices[cursor++] = fields.tpi[index];
        vertices[cursor++] = fields.rock[index];
        vertices[cursor++] = fields.paddy[index];
        vertices[cursor++] = fields.wet[index];
        vertices[cursor++] = fields.alluvium[index];
        vertices[cursor++] = fields.bund[index];
        vertices[cursor++] = fields.ditch[index];
        vertices[cursor++] = fields.fracture[index];
        vertices[cursor++] = fields.strata[index];
        vertices[cursor++] = displacement[index];
        vertices[cursor++] = fields.unitSeed[index];
        vertices[cursor++] = fields.flow[index];
        vertices[cursor++] = fields.sediment[index];
      }
    }
    const indices = new Uint32Array((grid - 1) * (grid - 1) * 6);
    let indexCursor = 0;
    for (let row = 0; row < grid - 1; row += 1) {
      for (let column = 0; column < grid - 1; column += 1) {
        const a = row * grid + column;
        const b = a + 1;
        const c = a + grid;
        const d = c + 1;
        indices[indexCursor++] = a;
        indices[indexCursor++] = c;
        indices[indexCursor++] = b;
        indices[indexCursor++] = b;
        indices[indexCursor++] = c;
        indices[indexCursor++] = d;
      }
    }
    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const stride = strideFloats * 4;
    const layout = [[0, 3, 0], [1, 3, 3], [2, 3, 6], [3, 4, 9], [4, 4, 13], [5, 4, 17], [6, 4, 21]];
    for (const [location, size, offset] of layout) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.terrain = {
      vao, vertexBuffer, indexBuffer, indexCount: indices.length,
      vertexCount: grid * grid, triangleCount: indices.length / 3,
    };
  },

  buildWater() {
    const gl = this.gl;
    const vertices = [];
    const indices = [];
    const add = (x, y, z, classValue, progress, mainstemCode) => {
      vertices.push(x, y, z, classValue, progress, mainstemCode);
      return vertices.length / 6 - 1;
    };
    for (const segment of this.compiled.segments) {
      const dx = segment.x1 - segment.x0;
      const dz = segment.z1 - segment.z0;
      const length = Math.hypot(dx, dz);
      if (length < 0.02) continue;
      const nx = -dz / length;
      const nz = dx / length;
      const base = segment.classValue === 0 ? 6 : (segment.classValue === 1 ? 2.4 : 1.6);
      const mainstem = segment.mainstemCode > 0;
      const widthAt = progress => mainstem
        ? Math.max(base, segment.sourceWidth * (0.12 + 0.88 * Math.pow(clamp(progress, 0, 1), 1.6)))
        : Math.max(base, Math.min(segment.sourceWidth || base, base * 2.2));
      const half0 = clamp(widthAt(segment.startProgress) * 0.5, base * 0.5, 95);
      const half1 = clamp(widthAt(segment.endProgress) * 0.5, base * 0.5, 95);
      const y0 = segment.y0 - this.compiled.minimum + 0.45;
      const y1 = segment.y1 - this.compiled.minimum + 0.45;
      const a = add(segment.x0 + nx * half0, y0, segment.z0 + nz * half0, segment.classValue, segment.startProgress, segment.mainstemCode);
      const b = add(segment.x0 - nx * half0, y0, segment.z0 - nz * half0, segment.classValue, segment.startProgress, segment.mainstemCode);
      const c = add(segment.x1 + nx * half1, y1, segment.z1 + nz * half1, segment.classValue, segment.endProgress, segment.mainstemCode);
      const d = add(segment.x1 - nx * half1, y1, segment.z1 - nz * half1, segment.classValue, segment.endProgress, segment.mainstemCode);
      indices.push(a, b, c, c, b, d);
    }
    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.water = { vao, vertexBuffer, indexBuffer, indexCount: indices.length };
  },

  buildSkirt() {
    const gl = this.gl;
    const { grid, spacing, sideM, denseTruth, minimum } = this.compiled;
    const vertices = [];
    const pushEdge = points => {
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        const bottom = -78;
        vertices.push(
          a[0], a[1], a[2], a[0], bottom, a[2], b[0], b[1], b[2],
          b[0], b[1], b[2], a[0], bottom, a[2], b[0], bottom, b[2],
        );
      }
    };
    const north = [];
    const south = [];
    const west = [];
    const east = [];
    for (let index = 0; index < grid; index += 1) {
      const x = index * spacing - sideM * 0.5;
      const z = index * spacing - sideM * 0.5;
      north.push([x, denseTruth[index] - minimum, -sideM * 0.5]);
      south.push([x, denseTruth[(grid - 1) * grid + index] - minimum, sideM * 0.5]);
      west.push([-sideM * 0.5, denseTruth[index * grid] - minimum, z]);
      east.push([sideM * 0.5, denseTruth[index * grid + grid - 1] - minimum, z]);
    }
    pushEdge(north);
    pushEdge(east);
    pushEdge(south.reverse());
    pushEdge(west.reverse());
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
    this.skirt = { vao, buffer, count: vertices.length / 3 };
  },
});
})();

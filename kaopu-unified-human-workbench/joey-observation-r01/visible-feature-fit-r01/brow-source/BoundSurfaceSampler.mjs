// Exact triangle-frame transport. Each needed source vertex and face is evaluated
// once per pose; no animation-cache or alternate character geometry is created.
export class BoundSurfaceSampler {
  constructor(geometry, anchors) {
    this.length = geometry.attributes.position.array.length;
    this.indexCount = geometry.index.count;
    this.anchors = anchors;
    this.deformed = new Float64Array(this.length);
    this.triangles = [];
    const faces = new Map(), vertices = new Set();
    for (const anchor of anchors) {
      const key = anchor.ids.join(':');
      let tri = faces.get(key);
      if (!tri) {
        tri = { ids: anchor.ids.map(i => i * 3), basis: new Float64Array(9) };
        faces.set(key, tri); this.triangles.push(tri);
        for (const i of anchor.ids) vertices.add(i * 3);
      }
      anchor.sampleTriangle = tri;
      anchor.sampleCenter = new Float64Array(3);
      anchor.sampled = anchor.offsets.map(() => [0, 0, 0]);
    }
    this.vertices = Uint32Array.from(vertices);
  }
  update(g, weights) {
    const source = g.attributes.position.array, p = this.deformed;
    if (source.length !== this.length || g.index.count !== this.indexCount)
      throw Error('Surface topology changed: rebuild follicle bindings first');
    for (const i of this.vertices) { p[i] = source[i]; p[i+1] = source[i+1]; p[i+2] = source[i+2]; }
    const targets = g.morphAttributes.position || [];
    for (let j = 0; j < targets.length; j++) {
      const w = weights?.[j] || 0; if (!w) continue;
      const a = targets[j].array;
      if (g.morphTargetsRelative) {
        for (const i of this.vertices) { p[i] += a[i]*w; p[i+1] += a[i+1]*w; p[i+2] += a[i+2]*w; }
      } else {
        for (const i of this.vertices) { p[i] += (a[i]-source[i])*w; p[i+1] += (a[i+1]-source[i+1])*w; p[i+2] += (a[i+2]-source[i+2])*w; }
      }
    }
    for (const tri of this.triangles) {
      const [a,b,c] = tri.ids, f = tri.basis;
      let x=p[b]-p[a], y=p[b+1]-p[a+1], z=p[b+2]-p[a+2];
      const l=Math.hypot(x,y,z)||1; x/=l; y/=l; z/=l;
      const cx=p[c]-p[a], cy=p[c+1]-p[a+1], cz=p[c+2]-p[a+2];
      let nx=y*cz-z*cy, ny=z*cx-x*cz, nz=x*cy-y*cx;
      const nl=Math.hypot(nx,ny,nz)||1; nx/=nl; ny/=nl; nz/=nl;
      f[0]=x;f[1]=y;f[2]=z;f[3]=ny*z-nz*y;f[4]=nz*x-nx*z;f[5]=nx*y-ny*x;f[6]=nx;f[7]=ny;f[8]=nz;
    }
    for (const anchor of this.anchors) {
      const tri=anchor.sampleTriangle, [a,b,c]=tri.ids, w=anchor.weights, center=anchor.sampleCenter, f=tri.basis;
      for(let k=0;k<3;k++) center[k]=p[a+k]*w[0]+p[b+k]*w[1]+p[c+k]*w[2];
      for(let j=0;j<anchor.offsets.length;j++) {
        const v=anchor.offsets[j], q=anchor.sampled[j];
        q[0]=center[0]+f[0]*v[0]+f[3]*v[1]+f[6]*v[2];
        q[1]=center[1]+f[1]*v[0]+f[4]*v[1]+f[7]*v[2];
        q[2]=center[2]+f[2]*v[0]+f[5]*v[1]+f[8]*v[2];
      }
    }
  }
  report() { return { neededVertices:this.vertices.length, sharedTriangles:this.triangles.length, anchors:this.anchors.length, temporaryBytes:this.deformed.byteLength }; }
}


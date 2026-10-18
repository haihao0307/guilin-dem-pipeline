/**
 * Native A6 continuous coach shell, independent R01 design case. No imported geometry, source meshes,
 * fitted vertex residuals, texture images, framework or I/O dependencies.
 * Coordinate system: x right, y up, z rearward; z=0 body midpoint; y=0 rail datum.
 * The complete 24 native apertures retain their independent reveal, gasket, glazing and door assemblies. Dimensions below are editable design controls, not measured A6 engineering.
 */
export const A6_COACH_EVIDENCE = Object.freeze({
  checkedOn: '2026-10-17',
  provenance: 'Native A6 adaptation of first-party student-native-r01 aperture/surface algorithms. No teacher positions, arrays, fitted residuals or source geometry.',
  designReferences: ['A6-REF-03', 'A6-REF-10', 'A6-REF-11', 'A6-REF-19', 'A6-REF-20', 'A6-REF-34', 'A6-EXTRA-R08', 'A6-EXTRA-BLUE'],
  referenceUse: 'Continuous green curved body, real independent apertures, flush fine trim, independent compact ends and raised bogie openings. Images are not dimension evidence.',
  fixedMechanics: { bogieCentres: 16, wheelDiameter: 0.914, wheelbase: 2.6, fullEndZ: [-11.49, 11.49], floorUndersideY: 1.175, partCount: 238 },
  dimensionStatus: 'Editable design metres; no whole-vehicle measurement, dynamic, structural or aerodynamic certification.',
  geometryIndependentOfMechanics: true
});

export const A6_COACH_DEFAULTS = Object.freeze({
  nominalCoupledLength: 23,
  bodyLength: 22.57,
  bodyWidth: 2.740,
  bodyBottom: 0.98,
  waistY: 2.04,
  sideTop: 3.15,
  crownHeight: 4.03,
  lowerInset: 0.12,
  upperInset: 0,
  endInset: 0.085,
  endTaperLength: 1.05,
  endRoofDip: 0,
  shellThickness: 0.045,
  floorY: 1.24,
  floorThickness: 0.065,
  windowCount: 8,
  windowSpan: 14.90,
  windowWidth: 1.65,
  windowHeight: 0.86,
  windowBottom: 2.03,
  windowRadius: 0.095,
  windowFrame: 0.030,
  glassInset: 0.024,
  glassThickness: 0.014,
  vestibuleWindows: true,
  vestibuleWindowWidth: 0.45,
  vestibuleWindowHeight: 0.65,
  doorWidth: 0.84,
  doorHeight: 1.84,
  doorBottom: 1.17,
  doorEndOffset: 1.00,
  doorRadius: 0.065,
  doorOpenAngleDeg: 0,
  gangwayWidth: 0.94,
  gangwayHeight: 1.90,
  gangwayBottom: 1.24,
  gangwayRadius: 0.095,
  gangwayCollar: 0.12,
  bogieCentres: 16.0,
  bogieClearanceLength: 3.90,
  bogieClearanceWidth: 2.50,
  bogieClearanceTop: 1.1635,
  bogieHemHeight: 1.24,
  bogieHemLength: 4.10,
  bogieHemEase: 0.42,
  gangwayLength: 0.19,
  aeroInterfaceLength: 0.16,
  windowBeltBottom: 1.99,
  windowBeltTop: 3.035,
  goldLineY: 1.96,
  goldLineHeight: 0.018,
  longitudinalStep: 0.34,
  sectionStep: 0.12,
  roofSegments: 48,
  cornerSegments: 10,
  includeGlass: true,
  includeDoors: true,
  includeFloor: true,
  includeInnerShell: true,
  includeGangways: true
});

const EPS = 1e-8;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const m = Math.hypot(...a); return m > 1e-12 ? mul(a, 1 / m) : [0, 1, 0]; };
const range = (a, b, step) => { const n = Math.max(1, Math.ceil((b - a) / step)); return Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i / n)); };
const unique = a => [...new Set(a.map(x => Math.round(x * 1e10) / 1e10))].sort((a, b) => a - b);
const inRange = (x, a, b) => x >= a - EPS && x <= b + EPS;

function parameters(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected A6 coach parameters');
  const p = { ...A6_COACH_DEFAULTS, ...input };
  const unknown = Object.keys(input).filter(k => !(k in A6_COACH_DEFAULTS));
  if (unknown.length) throw new RangeError(`Unknown A6 coach parameter(s): ${unknown.join(', ')}`);
  for (const [key, value] of Object.entries(p)) {
    if (typeof A6_COACH_DEFAULTS[key] === 'boolean') {
      if (typeof value !== 'boolean') throw new TypeError(`${key} must be boolean`);
    } else if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${key} must be a finite number`);
  }
  const positive = ['nominalCoupledLength', 'bodyLength', 'bodyWidth', 'shellThickness', 'floorThickness', 'windowWidth', 'windowHeight', 'windowRadius', 'windowFrame', 'doorWidth', 'doorHeight', 'doorRadius', 'endTaperLength', 'gangwayWidth', 'gangwayHeight', 'gangwayRadius', 'gangwayCollar', 'longitudinalStep', 'sectionStep', 'bogieClearanceLength', 'bogieClearanceWidth'];
  for (const k of positive) if (p[k] <= 0) throw new RangeError(`${k} must be positive`);
  for (const k of ['lowerInset', 'upperInset', 'endInset', 'endRoofDip', 'glassInset']) if (p[k] < 0) throw new RangeError(`${k} cannot be negative`);
  if (!(p.bodyBottom < p.floorY && p.floorY < p.waistY && p.waistY < p.sideTop && p.sideTop < p.crownHeight)) throw new RangeError('Require bodyBottom < floorY < waistY < sideTop < roofTop');
  if (p.bodyLength > p.nominalCoupledLength) throw new RangeError('Bare bodyLength cannot exceed nominalCoupledLength');
  if (p.bodyLength < 10 || p.bodyWidth < 1.8 || p.bodyWidth > 4.0) throw new RangeError('Body outside supported study envelope');
  if (p.bodyWidth / 2 - p.lowerInset - p.endInset < 0.7 || p.bodyWidth / 2 - p.upperInset - p.endInset < 0.7) throw new RangeError('Section inset collapses the body');
  if (p.shellThickness >= 0.15 || p.shellThickness < 0.005) throw new RangeError('shellThickness outside supported range 0.005..0.15');
  if (p.endTaperLength > p.bodyLength / 3) throw new RangeError('endTaperLength too long');
  if (p.windowBottom <= p.bodyBottom || p.windowBottom + p.windowHeight >= p.sideTop - 0.015) throw new RangeError('Saloon windows must fit below sideTop');
  if (p.doorBottom <= p.bodyBottom || p.doorBottom + p.doorHeight >= p.sideTop - 0.015) throw new RangeError('Door aperture must fit side skin');
  if (p.floorY - p.floorThickness <= p.bodyBottom || p.bogieClearanceTop > p.floorY - p.floorThickness) throw new RangeError('Bogie clearance must stay below the floor underside');
  if (!Number.isInteger(p.windowCount) || p.windowCount < 1 || p.windowCount > 16) throw new RangeError('windowCount must be integer 1..16');
  if (p.windowCount > 1 && p.windowSpan / (p.windowCount - 1) < p.windowWidth + p.windowFrame * 2 + 0.08) throw new RangeError('Windows overlap or leave insufficient pillars');
  if (p.windowRadius >= Math.min(p.windowWidth, p.windowHeight) / 2 || p.doorRadius >= Math.min(p.doorWidth, p.doorHeight) / 2) throw new RangeError('Opening corner radius too large');
  if (p.doorEndOffset <= p.doorWidth / 2 + 0.1) throw new RangeError('Door is too close to body end');
  if (p.gangwayBottom < p.bodyBottom || p.gangwayBottom + p.gangwayHeight >= p.crownHeight - p.endRoofDip - 0.2) throw new RangeError('Gangway does not fit end wall');
  if (p.gangwayWidth + 2 * p.gangwayCollar >= p.bodyWidth - 2 * p.endInset - 0.1) throw new RangeError('Gangway collar too wide');
  if (p.bogieCentres <= 0 || p.bogieCentres + p.bogieClearanceLength >= p.bodyLength) throw new RangeError('Bogie envelope does not fit body length');
  if (p.doorOpenAngleDeg < 0 || p.doorOpenAngleDeg > 90) throw new RangeError('doorOpenAngleDeg must be 0..90');
  if (!Number.isInteger(p.roofSegments) || p.roofSegments < 16 || p.roofSegments > 128 || !Number.isInteger(p.cornerSegments) || p.cornerSegments < 4 || p.cornerSegments > 24) throw new RangeError('Unsupported curve tessellation');
  if (p.longitudinalStep < 0.08 || p.longitudinalStep > 1 || p.sectionStep < 0.035 || p.sectionStep > 0.4) throw new RangeError('Tessellation step outside safe range');
  if (p.bogieCentres !== 16 || p.floorY !== 1.24 || p.floorThickness !== 0.065 || p.bodyLength !== 22.57) throw new RangeError('A6 coach mechanical interfaces are frozen: 16 m bogie centres, 22.57 m body, floor 1.24/1.175');
  if (p.bogieHemHeight < 1.18 || p.bogieHemHeight > 1.45 || p.bogieHemLength < 3.9 || p.bogieHemLength > 4.3 || p.bogieHemEase < 0.2 || p.bogieHemEase > 0.7) throw new RangeError('Unsupported bogie hem relief');
  if (p.gangwayLength < 0.06 || p.gangwayLength > 0.195 || p.aeroInterfaceLength < 0.04 || p.aeroInterfaceLength > p.gangwayLength) throw new RangeError('End interfaces must fit frozen mechanical ends');
  if (p.windowBeltBottom <= p.goldLineY + p.goldLineHeight / 2 || p.windowBeltTop >= p.sideTop || p.windowBeltBottom >= p.windowBeltTop) throw new RangeError('Invalid window belt');
  if (p.glassThickness !== 0.014) throw new RangeError('A6 glazing must match the fixed 14 mm native optical recipe');
  if (p.crownHeight < 3.8 || p.crownHeight > 4.25) throw new RangeError('Crown outside supported A6 design study');
  return p;
}

class Mesh {
  constructor(name, material, category, metadata = {}) {
    this.name = name; this.material = material; this.category = category; this.metadata = metadata;
    this.positions = []; this.normals = []; this.uvs = []; this.indices = [];
  }
  vertex(point, normal, uv) {
    const id = this.positions.length / 3;
    this.positions.push(...point); this.normals.push(...unit(normal)); this.uvs.push(...uv); return id;
  }
  quad(points, normals, uvs) {
    const n = unit(normals.reduce((s, x) => add(s, x), [0, 0, 0]));
    const ids = points.map((v, i) => this.vertex(v, normals[i], uvs[i]));
    const tris = [[0, 1, 2], [0, 2, 3]];
    for (let tri of tris) {
      const geom = cross(sub(points[tri[1]], points[tri[0]]), sub(points[tri[2]], points[tri[0]]));
      if (Math.hypot(...geom) < 1e-12) continue;
      if (dot(geom, n) < 0) tri = [tri[0], tri[2], tri[1]];
      this.indices.push(...tri.map(i => ids[i]));
    }
  }
  finish() {
    return {
      name: this.name, material: this.material, category: this.category, metadata: this.metadata,
      positions: new Float32Array(this.positions), normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs), indices: new Uint32Array(this.indices),
      materialGroups: [{ start: 0, count: this.indices.length, materialIndex: 0 }],
      uvUnits: 'design-metres', doubleSided: this.material === 'glass'
    };
  }
}

function bodyHem(p, z) {
  const distance = Math.abs(Math.abs(z) - p.bogieCentres / 2);
  const rise = 1 - smooth((distance - p.bogieHemLength / 2) / p.bogieHemEase);
  // The inherited door apertures are retained, including their original low sill.
  // A short smooth local approach yields to the entire door; no aperture is clipped.
  const doorCentre = p.bodyLength / 2 - p.doorEndOffset;
  const doorDistance = Math.abs(Math.abs(z) - doorCentre);
  const doorEase = smooth((doorDistance - p.doorWidth / 2 - 0.025) / 0.22);
  return p.bodyBottom + rise * (Math.min(p.bogieHemHeight, p.doorBottom - 0.035) - p.bodyBottom + (p.bogieHemHeight - Math.min(p.bogieHemHeight, p.doorBottom - 0.035)) * doorEase);
}

function makeSection(p) {
  const half = p.bodyWidth / 2;
  const taper = z => 1 - smooth((p.bodyLength / 2 - Math.abs(z)) / p.endTaperLength);
  const scale = z => 1 - p.endInset / half * taper(z);
  const sideWidth = y => half - p.lowerInset * (1 - smooth((y - p.bodyBottom) / (p.waistY - p.bodyBottom))) - p.upperInset * smooth((y - p.waistY) / (p.sideTop - p.waistY));
  const drop = (z, y) => p.endRoofDip * taper(z) * smooth((y - p.bodyBottom) / (p.sideTop - p.bodyBottom));
  const sidePoint = (sign, z, y) => [sign * sideWidth(y) * scale(z), y - drop(z, y), z];
  const sideNormal = (sign, z, y) => {
    const h = 1e-5;
    const dy = sub(sidePoint(sign, z, y + h), sidePoint(sign, z, y - h));
    const dz = sub(sidePoint(sign, z + h, y), sidePoint(sign, z - h, y));
    return mul(unit(cross(dy, dz)), sign);
  };
  const side = (sign, depth = 0, inward = false) => (z, y) => {
    const n = sideNormal(sign, z, y);
    return { point: sub(sidePoint(sign, z, y), mul(n, depth)), normal: inward ? mul(n, -1) : n, uv: [z + p.bodyLength / 2, y - p.bodyBottom] };
  };
  const roofPoint = (z, theta) => [(half - p.upperInset) * Math.cos(theta) * scale(z), p.sideTop + (p.crownHeight - p.sideTop) * Math.sin(theta) - p.endRoofDip * taper(z), z];
  const roofNormal = (z, theta) => {
    const h = 1e-5;
    return unit(cross(sub(roofPoint(z, theta + h), roofPoint(z, theta - h)), sub(roofPoint(z + h, theta), roofPoint(z - h, theta))));
  };
  const roof = (depth = 0, inward = false) => (z, theta) => {
    const n = roofNormal(z, theta);
    return { point: sub(roofPoint(z, theta), mul(n, depth)), normal: inward ? mul(n, -1) : n, uv: [z + p.bodyLength / 2, theta * (half + p.crownHeight - p.sideTop) / 2] };
  };
  const endWidth = y => (y <= p.sideTop ? sideWidth(y) : (half - p.upperInset) * Math.sqrt(Math.max(0, 1 - ((y - p.sideTop) / (p.crownHeight - p.sideTop)) ** 2))) * scale(p.bodyLength / 2);
  const end = (sign, depth = 0, inward = false) => (x, y) => ({
    point: [x, y - (y <= p.sideTop ? drop(sign * p.bodyLength / 2, y) : p.endRoofDip), sign * (p.bodyLength / 2 - depth)],
    normal: [0, 0, inward ? -sign : sign], uv: [x + half, y - p.bodyBottom]
  });
  return { side, sidePoint, sideNormal, roof, end, endWidth, sideWidth, scale };
}

function rect(id, kind, cx, bottom, width, height, radius) {
  return { id, kind, cx, cy: bottom + height / 2, width, height, radius, left: cx - width / 2, right: cx + width / 2, bottom, top: bottom + height };
}
function resizeRect(r, d) { return rect(r.id, r.kind, r.cx, r.bottom - d, r.width + d * 2, r.height + d * 2, Math.max(0.005, r.radius + d)); }
function verticalBounds(r, x) {
  const dx = Math.max(r.left + r.radius - x, x - (r.right - r.radius), 0);
  const corner = Math.sqrt(Math.max(0, r.radius ** 2 - dx ** 2));
  return dx > 0 ? [r.bottom + r.radius - corner, r.top - r.radius + corner] : [r.bottom, r.top];
}
function horizontalBounds(r, y) {
  const dy = Math.max(r.bottom + r.radius - y, y - (r.top - r.radius), 0);
  const corner = Math.sqrt(Math.max(0, r.radius ** 2 - dy ** 2));
  return dy > 0 ? [r.left + r.radius - corner, r.right - r.radius + corner] : [r.left, r.right];
}
function contour(r, segments = 10, lineSegments = 10) {
  const centers = [[r.right - r.radius, r.top - r.radius], [r.left + r.radius, r.top - r.radius], [r.left + r.radius, r.bottom + r.radius], [r.right - r.radius, r.bottom + r.radius]];
  const out = [];
  for (let k = 0; k < 4; k++) {
    const center = centers[k], start = k * Math.PI / 2;
    for (let i = 0; i <= segments; i++) {
      const a = start + i / segments * Math.PI / 2;
      out.push([center[0] + r.radius * Math.cos(a), center[1] + r.radius * Math.sin(a)]);
    }
    const a = start + Math.PI / 2, q = [center[0] + r.radius * Math.cos(a), center[1] + r.radius * Math.sin(a)];
    const next = centers[(k + 1) % 4], e = [next[0] + r.radius * Math.cos(a), next[1] + r.radius * Math.sin(a)];
    for (let i = 1; i < lineSegments; i++) out.push([lerp(q[0], e[0], i / lineSegments), lerp(q[1], e[1], i / lineSegments)]);
  }
  return out;
}
function cuts(r, p, axis = 0) { return contour(r, p.cornerSegments).map(v => v[axis]); }
function patch(mesh, mapping, u0, u1, vlo0, vlo1, vhi0, vhi1, step) {
  const n = Math.max(1, Math.ceil(Math.max(vhi0 - vlo0, vhi1 - vlo1) / step));
  for (let j = 0; j < n; j++) {
    const a = j / n, b = (j + 1) / n;
    const samples = [mapping(u0, lerp(vlo0, vhi0, a)), mapping(u1, lerp(vlo1, vhi1, a)), mapping(u1, lerp(vlo1, vhi1, b)), mapping(u0, lerp(vlo0, vhi0, b))];
    mesh.quad(samples.map(x => x.point), samples.map(x => x.normal), samples.map(x => x.uv));
  }
}
function sideSkin(name, material, mapping, p, openings, outer = null, category = 'shell', clip = null) {
  const mesh = new Mesh(name, material, category);
  const lo = outer ? outer.left : -p.bodyLength / 2, hi = outer ? outer.right : p.bodyLength / 2;
  const zs = unique([...range(lo, hi, p.longitudinalStep), ...openings.flatMap(o => [...cuts(o, p), ...(clip ? clip.filter(y=>y>o.bottom&&y<o.top).flatMap(y=>horizontalBounds(o,y)) : [])]), ...[-1,1].flatMap(s=>[-1,1].flatMap(t=>[s*p.bogieCentres/2+t*p.bogieHemLength/2,s*p.bogieCentres/2+t*(p.bogieHemLength/2+p.bogieHemEase)])), ...(outer ? cuts(outer, p) : [])]).filter(z => inRange(z, lo, hi));
  for (let i = 0; i < zs.length - 1; i++) {
    const a = zs[i], b = zs[i + 1], mid = (a + b) / 2;
    const hole = openings.find(o => mid > o.left && mid < o.right);
    let boundsA = outer ? verticalBounds(outer, a) : [bodyHem(p, a), p.sideTop];
    let boundsB = outer ? verticalBounds(outer, b) : [bodyHem(p, b), p.sideTop];
    if (clip) { boundsA = [Math.max(boundsA[0],clip[0]),Math.min(boundsA[1],clip[1])]; boundsB = [Math.max(boundsB[0],clip[0]),Math.min(boundsB[1],clip[1])]; }
    const fill=(la,lb,ha,hb)=>{ if(Math.max(ha-la,hb-lb)>EPS) patch(mesh,mapping,a,b,la,lb,ha,hb,p.sectionStep); };
    if (!hole) fill(...[boundsA[0], boundsB[0], boundsA[1], boundsB[1]]);
    else {
      const va = verticalBounds(hole, a), vb = verticalBounds(hole, b);
      fill(boundsA[0], boundsB[0], clamp(va[0],...boundsA), clamp(vb[0],...boundsB));
      fill(clamp(va[1],...boundsA), clamp(vb[1],...boundsB), boundsA[1], boundsB[1]);
    }
  }
  return mesh.finish();
}
/** A closed 14 mm pane, sampled on the same native section as its aperture.
 * A constant cross-column subdivision prevents T-junctions along curved corners.
 * The side seal is an actual perimeter surface, not a double-sided zero-thickness sheet.
 */
function solidGlazing(name,mapping,p,opening) {
  const mesh=new Mesh(name,'glass','glazing',{
    closedSolid:true,physicalThicknessM:p.glassThickness,opticalRecipeThicknessM:0.014,
    normalOffsetThickness:true,geometryThicknessVerified:true,
    construction:'independent outer optical face + inner optical face + sealed perimeter',
    sourceGeometryUsed:false
  });
  const zs=unique([...range(opening.left,opening.right,p.longitudinalStep),...cuts(opening,p)]).filter(z=>inRange(z,opening.left,opening.right));
  const n=Math.max(6,Math.ceil(opening.height/p.sectionStep));
  const point=(i,j,back=false)=>{
    const z=zs[i],[low,high]=verticalBounds(opening,z),sample=mapping(z,lerp(low,high,j/n));
    return {point:back?sub(sample.point,mul(sample.normal,p.glassThickness)):sample.point,normal:back?mul(sample.normal,-1):sample.normal,uv:sample.uv};
  };
  for(const back of [false,true])for(let i=0;i<zs.length-1;i++)for(let j=0;j<n;j++){
    const q=[point(i,j,back),point(i+1,j,back),point(i+1,j+1,back),point(i,j+1,back)];
    mesh.quad(q.map(s=>s.point),q.map(s=>s.normal),q.map(s=>s.uv));
  }
  const boundary=[];
  for(let i=0;i<zs.length;i++)boundary.push([i,0]);
  for(let j=1;j<=n;j++)boundary.push([zs.length-1,j]);
  for(let i=zs.length-2;i>=0;i--)boundary.push([i,n]);
  for(let j=n-1;j>0;j--)boundary.push([0,j]);
  const center=mapping(opening.cx,opening.cy).point;
  for(let k=0;k<boundary.length;k++){
    const a=boundary[k],b=boundary[(k+1)%boundary.length],q=[point(...a),point(...b),point(...b,true),point(...a,true)];
    let normal=unit(cross(sub(q[1].point,q[0].point),sub(q[3].point,q[0].point)));
    const radial=sub(mul(add(q[0].point,q[1].point),.5),center);if(dot(normal,radial)<0)normal=mul(normal,-1);
    mesh.quad(q.map(s=>s.point),[normal,normal,normal,normal],[[k,0],[k+1,0],[k+1,p.glassThickness],[k,p.glassThickness]]);
  }
  const out=mesh.finish();out.doubleSided=false;out.metadata.opticalFaceVertexCount=(zs.length-1)*n*4;return out;
}

function ring(name, material, mapping, outer, inner, p, category = 'trim') {
  const mesh = new Mesh(name, material, category);
  const a = contour(outer, p.cornerSegments), b = contour(inner, p.cornerSegments);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    const samples = [mapping(...a[i]), mapping(...a[j]), mapping(...b[j]), mapping(...b[i])];
    mesh.quad(samples.map(s => s.point), samples.map(s => s.normal), samples.map(s => s.uv));
  }
  return mesh.finish();
}
function reveal(name, mappingA, mappingB, opening, p, material = 'blackPaint', intoOpening = true) {
  const mesh = new Mesh(name, material, 'aperture-reveal');
  const loop = contour(opening, p.cornerSegments);
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length;
    const points = [mappingA(...loop[i]).point, mappingA(...loop[j]).point, mappingB(...loop[j]).point, mappingB(...loop[i]).point];
    let n = unit(cross(sub(points[1], points[0]), sub(points[3], points[0])));
    const towardCenter = sub(mappingA(opening.cx, opening.cy).point, mul(add(points[0], points[1]), 0.5));
    if ((dot(n, towardCenter) < 0) === intoOpening) n = mul(n, -1);
    mesh.quad(points, [n, n, n, n], [[0, 0], [1, 0], [1, p.shellThickness], [0, p.shellThickness]]);
  }
  return mesh.finish();
}
function makeOpenings(p) {
  const openings = [];
  for (let i = 0; i < p.windowCount; i++) openings.push(rect(`saloon-${i + 1}`, 'saloon-window', p.windowCount === 1 ? 0 : -p.windowSpan / 2 + p.windowSpan * i / (p.windowCount - 1), p.windowBottom, p.windowWidth, p.windowHeight, p.windowRadius));
  for (const sign of [-1, 1]) {
    const center = sign * (p.bodyLength / 2 - p.doorEndOffset);
    openings.push(rect(`vestibule-door-${sign < 0 ? 'front' : 'rear'}`, 'side-door', center, p.doorBottom, p.doorWidth, p.doorHeight, p.doorRadius));
    if (p.vestibuleWindows) openings.push(rect(`vestibule-window-${sign < 0 ? 'front' : 'rear'}`, 'vestibule-window', sign * (p.bodyLength / 2 - p.doorEndOffset - p.doorWidth / 2 - 0.80), p.windowBottom + 0.12, p.vestibuleWindowWidth, p.vestibuleWindowHeight, 0.055));
  }
  openings.sort((a, b) => a.left - b.left);
  for (let i = 0; i < openings.length; i++) {
    const a = openings[i];
    if (a.left < -p.bodyLength / 2 + 0.08 || a.right > p.bodyLength / 2 - 0.08 || a.bottom <= p.bodyBottom || a.top >= p.sideTop) throw new RangeError(`${a.id} leaves the side skin`);
    if (i > 0 && a.left - openings[i - 1].right < p.windowFrame * 2 + 0.025) throw new RangeError(`${a.id} overlaps the neighbouring aperture or its trim`);
  }
  return openings;
}
function rotateDoor(part, sign, opening, section, p) {
  const angle = p.doorOpenAngleDeg * Math.PI / 180 * sign;
  const pivot = section.side(sign, 0.018)(opening.left + 0.022, p.doorBottom).point;
  part.metadata = { ...part.metadata, hinge: { position: pivot, axis: [0, 1, 0], angleDeg: p.doorOpenAngleDeg }, editableDoor: true };
  if (!angle) return part;
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let i = 0; i < part.positions.length; i += 3) {
    const x = part.positions[i] - pivot[0], z = part.positions[i + 2] - pivot[2];
    part.positions[i] = pivot[0] + c * x + s * z; part.positions[i + 2] = pivot[2] - s * x + c * z;
    const nx = part.normals[i], nz = part.normals[i + 2];
    part.normals[i] = c * nx + s * nz; part.normals[i + 2] = -s * nx + c * nz;
  }
  return part;
}
function endWall(name, sign, depth, p, section, gangway, inward = false) {
  const mesh = new Mesh(name, inward ? 'interior' : 'paint', 'end-wall');
  const ys = unique([...range(p.bodyBottom, p.sideTop, p.sectionStep), ...Array.from({ length: p.roofSegments / 2 + 1 }, (_, i) => p.sideTop + (p.crownHeight - p.sideTop) * Math.sin(i / (p.roofSegments / 2) * Math.PI / 2)), ...cuts(gangway, p, 1)]).filter(y => inRange(y, p.bodyBottom, p.crownHeight));
  const map = section.end(sign, depth, inward), mapping = (y, x) => map(x, y);
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i], b = ys[i + 1], mid = (a + b) / 2;
    const wa = section.endWidth(a), wb = section.endWidth(b);
    if (mid <= gangway.bottom || mid >= gangway.top) patch(mesh, mapping, a, b, -wa, -wb, wa, wb, p.sectionStep);
    else {
      const ha = horizontalBounds(gangway, a), hb = horizontalBounds(gangway, b);
      patch(mesh, mapping, a, b, -wa, -wb, ha[0], hb[0], p.sectionStep);
      patch(mesh, mapping, a, b, ha[1], hb[1], wa, wb, p.sectionStep);
    }
  }
  return mesh.finish();
}
function bellows(sign, gangway, p, section) {
  const mesh = new Mesh(`gangway-bellows-${sign}`, 'rubber', 'gangway');
  const length = p.gangwayLength;
  const count = 12, rings = [];
  for (let i = 0; i <= count; i++) {
    const expanded = resizeRect(gangway, p.gangwayCollar + (i % 2 ? 0.016 : -0.012));
    rings.push(contour(expanded, p.cornerSegments).map(([x, y]) => section.end(sign, -length * i / count)(x, y).point));
  }
  for (let k = 0; k < count; k++) for (let i = 0; i < rings[k].length; i++) {
    const j = (i + 1) % rings[k].length;
    const pts = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]];
    let normal = unit(cross(sub(pts[1], pts[0]), sub(pts[3], pts[0])));
    const radial = [pts[0][0], pts[0][1] - (p.gangwayBottom + p.gangwayHeight / 2), 0];
    if (dot(normal, radial) < 0) normal = mul(normal, -1);
    mesh.quad(pts, [normal, normal, normal, normal], [[i / rings[k].length, k / count], [j / rings[k].length, k / count], [j / rings[k].length, (k + 1) / count], [i / rings[k].length, (k + 1) / count]]);
  }
  return mesh.finish();
}
function addFloor(parts, p, section) {
  for (const face of ['top', 'underside']) {
    const y = face === 'top' ? p.floorY : p.floorY - p.floorThickness;
    const normal = [0, face === 'top' ? 1 : -1, 0];
    const floor = new Mesh(`floor-${face}`, face === 'top' ? 'interior' : 'blackPaint', 'floor-interface');
    const zs = range(-p.bodyLength / 2 + p.shellThickness, p.bodyLength / 2 - p.shellThickness, p.longitudinalStep);
    const map = (z, x) => ({ point: [x, y, z], normal, uv: [z + p.bodyLength / 2, x + p.bodyWidth / 2] });
    for (let i = 0; i < zs.length - 1; i++) {
      const a = zs[i], b = zs[i + 1], wa = section.sideWidth(y) * section.scale(a) - p.shellThickness, wb = section.sideWidth(y) * section.scale(b) - p.shellThickness;
      patch(floor, map, a, b, -wa, -wb, wa, wb, p.sectionStep * 2);
    }
    parts.push(floor.finish());
  }
}
function addAeroInterfaces(parts,p,section) {
  for(const sign of [-1,1]){
    const mesh=new Mesh(`aero-interface-${sign}`,'paint','aero-interface',{
      independentEnd:true,openBottomY:1.60,structuralConnection:false,
      construction:'short inward-returning fairing skin, not a pipe or rigid inter-car bridge',
      articulationStatus:'provisional static spacing only'
    });
    const bodyZ=sign*p.bodyLength/2;
    function mapped(point,normal,t){
      const inset=.025*smooth(t),radial=[point[0],point[1]-1.60,0], ds=30*t*t*(t-1)*(t-1), n=unit([normal[0],normal[1],sign*.025*ds*dot(normal,radial)/p.aeroInterfaceLength]);
      return {point:[point[0]-radial[0]*inset,point[1]-radial[1]*inset,bodyZ+sign*p.aeroInterfaceLength*t],normal:n,uv:[point[1],t*p.aeroInterfaceLength]};
    }
    // Build side and roof domains, separately editable from the normal shell.
    for(const side of [-1,1]){
      const ys=range(1.60,p.sideTop,.07);
      for(let i=0;i<ys.length-1;i++) for(let k=0;k<8;k++){
        const t=k/8,u=(k+1)/8,a=section.side(side)(bodyZ,ys[i]),b=section.side(side)(bodyZ,ys[i+1]);
        const q=[mapped(a.point,a.normal,t),mapped(b.point,b.normal,t),mapped(b.point,b.normal,u),mapped(a.point,a.normal,u)];
        mesh.quad(q.map(x=>x.point),q.map(x=>x.normal),q.map(x=>x.uv));
      }
    }
    for(let i=0;i<p.roofSegments;i++)for(let k=0;k<8;k++){
      const a=section.roof()(bodyZ,Math.PI*i/p.roofSegments),b=section.roof()(bodyZ,Math.PI*(i+1)/p.roofSegments),t=k/8,u=(k+1)/8,
        q=[mapped(a.point,a.normal,t),mapped(b.point,b.normal,t),mapped(b.point,b.normal,u),mapped(a.point,a.normal,u)];
      mesh.quad(q.map(x=>x.point),q.map(x=>x.normal),q.map(x=>x.uv));
    }
    parts.push(mesh.finish());
  }
}

function boundsOf(parts) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) for (let i = 0; i < part.positions.length; i += 3) for (let j = 0; j < 3; j++) {
    min[j] = Math.min(min[j], part.positions[i + j]); max[j] = Math.max(max[j], part.positions[i + j]);
  }
  return { min, max, size: max.map((x, i) => x - min[i]) };
}

/** Build deterministic, independently editable shell components; no Three dependency. */
export function buildA6CoachShell(input = {}) {
  const p = parameters(input), section = makeSection(p), openings = makeOpenings(p), parts = [];
  for (const sign of [-1, 1]) {
    const sideName = sign < 0 ? 'left' : 'right';
    const outer = section.side(sign), inner = section.side(sign, p.shellThickness, true);
    parts.push(sideSkin(`shell-side-${sideName}-lower`, 'paint', outer, p, openings, null, 'shell', [p.bodyBottom, p.windowBeltBottom]));
    parts.push(sideSkin(`shell-side-${sideName}-window-belt`, 'blackPaint', outer, p, openings, null, 'window-belt', [p.windowBeltBottom, p.windowBeltTop]));
    parts.push(sideSkin(`shell-side-${sideName}-shoulder`, 'paint', outer, p, openings, null, 'shell', [p.windowBeltTop,p.sideTop]));
    parts.push(sideSkin(`flush-gold-line-${sideName}`, 'trim-brass', section.side(sign,-0.0015), p, openings, null, 'flush-inlay', [p.goldLineY-p.goldLineHeight/2,p.goldLineY+p.goldLineHeight/2]));
    const hem = new Mesh(`finite-raised-hem-${sideName}`, 'paint', 'shell-edge', {raisedOverBogies:true, doorSillsPreserved:true});
    const hemZs = range(-p.bodyLength/2,p.bodyLength/2,0.06);
    for(let i=0;i<hemZs.length-1;i++){
      const a=hemZs[i],b=hemZs[i+1],ya=bodyHem(p,a),yb=bodyHem(p,b),
        points=[outer(a,ya).point,outer(b,yb).point,section.side(sign,p.shellThickness)(b,yb).point,section.side(sign,p.shellThickness)(a,ya).point],
        normal=unit([0,-1,(yb-ya)/(b-a)]);
      hem.quad(points,[normal,normal,normal,normal],[[a,0],[b,0],[b,p.shellThickness],[a,p.shellThickness]]);
    }
    parts.push(hem.finish());
    if (p.includeInnerShell) parts.push(sideSkin(`lining-side-${sideName}`, 'interior', inner, p, openings, null, 'lining'));
    for (const aperture of openings) {
      const prefix = `${sideName}-${aperture.id}`;
      parts.push(reveal(`${prefix}-reveal`, outer, section.side(sign, p.shellThickness), aperture, p));
      parts.push(ring(`${prefix}-gasket`, 'rubber', section.side(sign, -0.009), resizeRect(aperture, p.windowFrame), aperture, p));
      if (aperture.kind !== 'side-door') {
        if (p.includeGlass) parts.push(solidGlazing(`${prefix}-glass`, section.side(sign, p.glassInset), p, resizeRect(aperture, -0.007)));
      } else if (p.includeDoors) {
        const leaf = resizeRect(aperture, -0.018);
        const glass = rect(`${prefix}-door-window`, 'door-window', aperture.cx, p.windowBottom + 0.03, p.doorWidth * 0.61, Math.min(p.windowHeight - 0.04, 0.78), 0.06);
        if (glass.top >= leaf.top - 0.05 || glass.bottom <= leaf.bottom + 0.05) throw new RangeError('Door window no longer fits door leaf');
        const doorParts = [
          sideSkin(`${prefix}-leaf`, 'paint', section.side(sign, 0.019), p, [glass], leaf, 'door'),
          sideSkin(`${prefix}-leaf-back`, 'interior', section.side(sign, 0.059, true), p, [glass], leaf, 'door'),
          sideSkin(`${prefix}-flush-gold-line`, 'trim-brass', section.side(sign, 0.0175), p, [], leaf, 'flush-inlay', [p.goldLineY-p.goldLineHeight/2,p.goldLineY+p.goldLineHeight/2]),
          reveal(`${prefix}-leaf-edge`, section.side(sign, 0.059), section.side(sign, 0.019), leaf, p, 'paint', false),
          reveal(`${prefix}-window-reveal`, section.side(sign, 0.019), section.side(sign, 0.059), glass, p),
          ring(`${prefix}-window-gasket`, 'rubber', section.side(sign, 0.013), resizeRect(glass, 0.015), glass, p, 'door')
        ];
        if (p.includeGlass) doorParts.push(solidGlazing(`${prefix}-window-glass`, section.side(sign, 0.036), p, resizeRect(glass, -0.006)));
        parts.push(...doorParts.map(part => rotateDoor(part, sign, aperture, section, p)));
      }
    }
  }
  const zs = range(-p.bodyLength / 2, p.bodyLength / 2, p.longitudinalStep);
  for (const inward of [false, ...(p.includeInnerShell ? [true] : [])]) {
    const roof = new Mesh(inward ? 'roof-lining' : 'shell-roof', inward ? 'interior' : 'paint', inward ? 'lining' : 'shell');
    const map = section.roof(inward ? p.shellThickness : 0, inward);
    for (let i = 0; i < zs.length - 1; i++) patch(roof, map, zs[i], zs[i + 1], 0, 0, Math.PI, Math.PI, Math.PI / p.roofSegments);
    parts.push(roof.finish());
  }
  const gangway = rect('end-gangway', 'gangway', 0, p.gangwayBottom, p.gangwayWidth, p.gangwayHeight, p.gangwayRadius);
  for (const sign of [-1, 1]) {
    parts.push(endWall(`end-wall-${sign}`, sign, 0, p, section, gangway));
    if (p.includeInnerShell) parts.push(endWall(`end-lining-${sign}`, sign, p.shellThickness, p, section, gangway, true));
    parts.push(reveal(`end-aperture-${sign}`, section.end(sign), section.end(sign, p.shellThickness), gangway, p));
    parts.push(ring(`end-collar-${sign}`, 'brushedMetal', section.end(sign, -0.009), resizeRect(gangway, p.gangwayCollar), gangway, p, 'gangway'));
    if (p.includeGangways) {
      parts.push(bellows(sign, gangway, p, section));
      const length = p.gangwayLength;
      parts.push(ring(`gangway-face-${sign}`, 'rubber', section.end(sign, -length), resizeRect(gangway, p.gangwayCollar), gangway, p, 'gangway'));
    }
  }
  addAeroInterfaces(parts,p,section);
  if (p.includeFloor) addFloor(parts, p, section);
  const modified = Object.entries(input).filter(([k, v]) => A6_COACH_DEFAULTS[k] !== v).map(([k]) => k);
  return {
    schema: 'kaopu.a6-native-coach-shell/1.0', generator: 'native-a6-continuous-section-real-aperture-sweep-r01',
    parts, parameters: p, evidence: { ...A6_COACH_EVIDENCE, modifiedParameters: modified },
    openings: [-1, 1].flatMap(side => openings.map(o => ({ ...o, side, coordinateDomain: 'z / nominal section-y', actualCenter: section.sidePoint(side, o.cx, o.cy), skinIsOpen: true }))),
    interfaces: {
      coordinateSystem: {x:'lateral',y:'rail datum up',z:'rearward; coach midpoint zero',unit:'design m'},
      floor: {topY:p.floorY,undersideY:p.floorY-p.floorThickness,thickness:p.floorThickness,status:'frozen-native-interface'},
      bogies: [-1,1].map(sign=>({center:[0,0,sign*8],wheelDiameter:.914,wheelbase:2.6,hemAtCentre:bodyHem(p,sign*8),status:'unchanged-external-mechanics'})),
      gangways: [-1,1].map(sign=>({bodyFaceZ:sign*p.bodyLength/2,tipZ:sign*(p.bodyLength/2+p.gangwayLength),aeroTipZ:sign*(p.bodyLength/2+p.aeroInterfaceLength),width:p.gangwayWidth,height:p.gangwayHeight,bottom:p.gangwayBottom,status:'provisional-independent-short-interface; no coupler geometry modified'})),
      commonCrownY:p.crownHeight, commonGoldLineY:p.goldLineY,
      protectedMechanicalEndsZ:[-11.49,11.49], mechanicalPartsGenerated:0
    },
    bounds: boundsOf(parts),
    envelopeCheck: {nominalBareWidth:p.bodyWidth,generatedWidth:boundsOf(parts).size[0],status:'design-envelope-includes-independent-trim; not whole-vehicle certified'},
    completion: {shell:'native-editable-A6-study',chassis:'keep-all-238-existing-coach-parts-external',interiors:'floor-and-lining-only',visualApproval:'pending',dynamicClearance:'not-certified'}
  };
}
export const generateA6CoachShell = buildA6CoachShell;

/** Analytical section inspection for QA/UI, without accessing a source asset. */
export function sampleA6CoachSection(input = {}, z = 0, samples = 64) {
  const p = parameters(input), section = makeSection(p), out = [];
  for (const y of range(bodyHem(p,z), p.sideTop, (p.sideTop - bodyHem(p,z)) / (samples / 4))) out.push(section.sidePoint(1, z, y));
  for (let i = 1; i <= samples / 2; i++) out.push(section.roof()(z, Math.PI * i / (samples / 2)).point);
  for (const y of range(bodyHem(p,z), p.sideTop, (p.sideTop - bodyHem(p,z)) / (samples / 4)).reverse().slice(1)) out.push(section.sidePoint(-1, z, y));
  return out;
}

/** Read-only curve diagnostics for tests and section views. */
export function sampleA6CoachHem(input={},z=0){return bodyHem(parameters(input),z);}
export function sampleA6CoachSurface(input={},domain='side',a=0,b=3.15,sign=1){const section=makeSection(parameters(input));return domain==='roof'?section.roof()(a,b):section.side(sign)(a,b);}

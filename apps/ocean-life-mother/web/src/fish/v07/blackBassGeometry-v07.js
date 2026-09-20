import {BLACK_BASS_R1_CARD} from './blackBassData-v07.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul = (a,s) => [a[0]*s,a[1]*s,a[2]*s];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => { const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; };

function rotateAboutHinge(point, hinge, angle) {
  const [x, y, u] = point;
  const [, hy, hu] = hinge;
  const dy = y - hy;
  const du = u - hu;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x, hy + dy * c - du * s, hu + dy * s + du * c];
}

function superellipsePoint(theta, halfWidth, topY, bottomY, exponent = 2.25) {
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const p = 2 / exponent;
  const x = Math.sign(sin) * Math.pow(Math.abs(sin), p) * halfWidth;
  const centerY = (topY + bottomY) * 0.5;
  const radiusY = cos >= 0 ? topY - centerY : centerY - bottomY;
  const y = centerY + Math.sign(cos) * Math.pow(Math.abs(cos), p) * radiusY;
  return [x, y];
}

function catmullRom(a, b, c, d, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

export function resampleProfile(stations, subdivisions = 4) {
  if (!Number.isInteger(subdivisions) || subdivisions < 1) throw new Error('subdivisions');
  const out = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const p0 = stations[Math.max(0, i - 1)];
    const p1 = stations[i];
    const p2 = stations[i + 1];
    const p3 = stations[Math.min(stations.length - 1, i + 2)];
    for (let k = 0; k < subdivisions; k++) {
      const t = k / subdivisions;
      const row = p1.map((_, j) => catmullRom(p0[j], p1[j], p2[j], p3[j], t));
      row[0] = lerp(p1[0], p2[0], t);
      row[1] = Math.max(row[1], 1e-5);
      if (row[2] <= row[3]) row[2] = row[3] + 1e-5;
      out.push(row);
    }
  }
  out.push([...stations.at(-1)]);
  return out;
}

export function loftProfile(stations, { radialSegments = 32, exponent = 2.25, transformPoint = null, subdivisions = 4, skipFace = null } = {}) {
  if (!Array.isArray(stations) || stations.length < 2) throw new Error('stations');
  if (!Number.isInteger(radialSegments) || radialSegments < 8) throw new Error('radialSegments');
  const sampled = resampleProfile(stations, subdivisions);
  const positions = [];
  const indices = [];
  for (const station of sampled) {
    const [u, halfWidth, topY, bottomY] = station;
    if (![u, halfWidth, topY, bottomY].every(Number.isFinite) || halfWidth <= 0 || topY <= bottomY) throw new Error('invalid station');
    for (let k = 0; k < radialSegments; k++) {
      const theta = (2 * Math.PI * k) / radialSegments;
      const [x, y] = superellipsePoint(theta, halfWidth, topY, bottomY, exponent);
      const p = transformPoint ? transformPoint([x, y, u]) : [x, y, u];
      positions.push(...p);
    }
  }
  const ringCount = sampled.length;
  let skippedFaceCount=0;
  for (let i = 0; i < ringCount - 1; i++) {
    for (let k = 0; k < radialSegments; k++) {
      const thetaMid=2*Math.PI*(k+0.5)/radialSegments;
      if(skipFace && skipFace({ring:i,segment:k,thetaMid,stationA:sampled[i],stationB:sampled[i+1]})){skippedFaceCount++;continue;}
      const a = i * radialSegments + k;
      const b = i * radialSegments + ((k + 1) % radialSegments);
      const c = (i + 1) * radialSegments + ((k + 1) % radialSegments);
      const d = (i + 1) * radialSegments + k;
      indices.push(a, b, c, a, c, d);
    }
  }
  return { positions, indices, ringCount, radialSegments, skippedFaceCount };
}

function angleDistance(a,b){const d=Math.abs(a-b)%(2*Math.PI);return Math.min(d,2*Math.PI-d);}

export function buildCranialMesh(options = {}) {
  return loftProfile(BLACK_BASS_R1_CARD.cranialProfile, {
    radialSegments: options.radialSegments ?? 72,
    exponent: options.exponent ?? 2.35,
    subdivisions: options.subdivisions ?? 5,
    skipFace:({thetaMid,stationA,stationB})=>{
      const u=(stationA[0]+stationB[0])*0.5;
      if(u<0.807 || u>0.994) return false;
      const sideBand=Math.min(angleDistance(thetaMid,Math.PI/2),angleDistance(thetaMid,3*Math.PI/2));
      const posterior=smoothstep(0.807,0.842,u);
      const anterior=smoothstep(0.994,0.970,u);
      const halfAngle=0.060+0.018*posterior*anterior;
      return sideBand<halfAngle;
    }
  });
}

export function transformJawPoint(point, mouthOpenRad = 0) {
  const [minOpen, maxOpen] = BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad;
  const angle = clamp(mouthOpenRad, minOpen, maxOpen);
  return rotateAboutHinge(point, BLACK_BASS_R1_CARD.jaw.hinge, angle);
}

export function transformJawPointWeighted(point, mouthOpenRad, weight) {
  const moved = transformJawPoint(point, mouthOpenRad);
  return [lerp(point[0], moved[0], weight), lerp(point[1], moved[1], weight), lerp(point[2], moved[2], weight)];
}

export function buildLowerJawMesh({ mouthOpenRad = 0, radialSegments = 48, exponent = 2.25, subdivisions = 4 } = {}) {
  const [minOpen, maxOpen] = BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad;
  const angle = clamp(mouthOpenRad, minOpen, maxOpen);
  return {
    ...loftProfile(BLACK_BASS_R1_CARD.jaw.envelope, {
      radialSegments,
      exponent,
      subdivisions,
      transformPoint: point => transformJawPoint(point, angle)
    }),
    mouthOpenRad: angle,
    hinge: [...BLACK_BASS_R1_CARD.jaw.hinge]
  };
}

export function buildMouthCavityMesh({ mouthOpenRad = 0, radialSegments = 40, subdivisions = 4 } = {}) {
  const [minOpen,maxOpen] = BLACK_BASS_R1_CARD.jaw.safeOpenRangeRad;
  const angle=clamp(mouthOpenRad,minOpen,maxOpen);
  const t=(angle-minOpen)/(maxOpen-minOpen || 1);
  const expanded=BLACK_BASS_R1_CARD.cavityProfile.map(([u,w,top,bottom])=>[u,w,top,bottom-0.025*t*smoothstep(0.79,1.0,u)]);
  return loftProfile(expanded, { radialSegments, exponent: 2.0, subdivisions });
}

export function buildEllipsoidMesh(center, radii, { latitudeSegments = 18, longitudeSegments = 28 } = {}) {
  const positions = [];
  const indices = [];
  for (let iy = 0; iy <= latitudeSegments; iy++) {
    const v = iy / latitudeSegments;
    const phi = Math.PI * v;
    for (let ix = 0; ix < longitudeSegments; ix++) {
      const u = ix / longitudeSegments;
      const theta = 2 * Math.PI * u;
      positions.push(
        center[0] + radii[0] * Math.sin(phi) * Math.cos(theta),
        center[1] + radii[1] * Math.cos(phi),
        center[2] + radii[2] * Math.sin(phi) * Math.sin(theta)
      );
    }
  }
  for (let iy = 0; iy < latitudeSegments; iy++) {
    for (let ix = 0; ix < longitudeSegments; ix++) {
      const nx = (ix + 1) % longitudeSegments;
      const a = iy * longitudeSegments + ix;
      const b = iy * longitudeSegments + nx;
      const c = (iy + 1) * longitudeSegments + nx;
      const d = (iy + 1) * longitudeSegments + ix;
      indices.push(a, b, c, a, c, d);
    }
  }
  return { positions, indices };
}

export function buildCurveTube(points, radiusLateral, radiusNormal, { radialSegments = 12, cap = true } = {}) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('curve points');
  const rx = Array.isArray(radiusLateral) ? radiusLateral : points.map(()=>radiusLateral);
  const rn = Array.isArray(radiusNormal) ? radiusNormal : points.map(()=>radiusNormal);
  if (rx.length !== points.length || rn.length !== points.length) throw new Error('curve radii');
  const positions=[]; const indices=[];
  for(let i=0;i<points.length;i++){
    const prev=points[Math.max(0,i-1)], next=points[Math.min(points.length-1,i+1)];
    const tangent=norm(sub(next,prev));
    const lateralRaw=sub([1,0,0],mul(tangent,tangent[0]));
    const e1=norm(lateralRaw);
    const e2=norm(cross(tangent,e1));
    for(let k=0;k<radialSegments;k++){
      const a=2*Math.PI*k/radialSegments;
      const p=add(points[i],add(mul(e1,Math.cos(a)*rx[i]),mul(e2,Math.sin(a)*rn[i])));
      positions.push(...p);
    }
  }
  for(let i=0;i<points.length-1;i++){
    for(let k=0;k<radialSegments;k++){
      const a=i*radialSegments+k,b=i*radialSegments+(k+1)%radialSegments;
      const c=(i+1)*radialSegments+(k+1)%radialSegments,d=(i+1)*radialSegments+k;
      indices.push(a,b,c,a,c,d);
    }
  }
  if(cap){
    for(const [i,flip] of [[0,true],[points.length-1,false]]){
      const ci=positions.length/3; positions.push(...points[i]);
      const base=i*radialSegments;
      for(let k=0;k<radialSegments;k++){
        const a=base+k,b=base+(k+1)%radialSegments;
        if(flip) indices.push(ci,b,a); else indices.push(ci,a,b);
      }
    }
  }
  return {positions,indices,ringCount:points.length,radialSegments};
}

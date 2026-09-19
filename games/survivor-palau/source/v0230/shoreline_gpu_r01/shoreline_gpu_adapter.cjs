'use strict';
const Shoreline = require('../shoreline_profile.cjs');

const VERSION = 'smi-shoreline-gpu-adapter/0.1';
const PROFILE_ID = 'SMI_WAKE_BAY_R01';

function finite(n, label) {
  if (!Number.isFinite(n)) throw new TypeError(`Non-finite ${label}`);
  return Number(n);
}
function f(n) {
  const v = finite(n, 'GLSL constant');
  if (Object.is(v, -0)) return '-0.0';
  if (Number.isInteger(v)) return `${v}.0`;
  const s = String(v);
  return /[.eE]/.test(s) ? s : `${s}.0`;
}
function validateAuthoritativeSource(S = Shoreline) {
  if (!S || !Array.isArray(S.KNOTS) || S.KNOTS.length < 2 || !S.BAY) throw new TypeError('Authoritative shoreline source required');
  if (S.shoreAt(27 * Math.cos(S.BAY.center), 27 * Math.sin(S.BAY.center), () => -99, () => 27, .18).profileId !== PROFILE_ID) {
    throw new Error(`Unexpected shoreline profile; expected ${PROFILE_ID}`);
  }
  for (let i = 1; i < S.KNOTS.length; i++) if (!(S.KNOTS[i][0] > S.KNOTS[i - 1][0])) throw new Error('KNOTS must be strictly ordered');
  for (const [s, y, m] of S.KNOTS) { finite(s, 'knot s'); finite(y, 'knot y'); finite(m, 'knot slope'); }
  for (const k of ['center','fullHalfAngle','fadeAngle','crossMin','crossFullMin','crossFullMax','crossMax']) finite(S.BAY[k], `BAY.${k}`);
  return true;
}

function glslSource({ legacyBed = 'bedH', islandRadius = 'islandR', functionName = 'smiAuthoritativeBedG' } = {}) {
  validateAuthoritativeSource();
  if (!/^\w+$/.test(legacyBed) || !/^\w+$/.test(islandRadius) || !/^\w+$/.test(functionName)) throw new TypeError('GLSL identifiers only');
  const K = Shoreline.KNOTS;
  const B = Shoreline.BAY;
  const rows = K.map((k, i) => `const vec3 SMI_WB_K${i}=vec3(${f(k[0])},${f(k[1])},${f(k[2])});`).join('\n');
  const segments = [];
  for (let i = 0; i < K.length - 1; i++) {
    segments.push(`if(s<=SMI_WB_K${i+1}.x)return smiWakeHermiteG(s,SMI_WB_K${i},SMI_WB_K${i+1});`);
  }
  return `// Generated from ../shoreline_profile.cjs (${PROFILE_ID}); do not hand-edit constants.\n${rows}\n` +
`float smiWakeSmooth01G(float t){t=clamp(t,0.0,1.0);return t*t*(3.0-2.0*t);}\n` +
`float smiWakeHermiteG(float s,vec3 a,vec3 b){float h=b.x-a.x,t=(s-a.x)/h,t2=t*t,t3=t2*t;return(2.0*t3-3.0*t2+1.0)*a.y+(t3-2.0*t2+t)*h*a.z+(-2.0*t3+3.0*t2)*b.y+(t3-t2)*h*b.z;}\n` +
`float smiWakeProfileG(float s){if(s<=SMI_WB_K0.x)return SMI_WB_K0.y+SMI_WB_K0.z*(s-SMI_WB_K0.x);${segments.join('')}vec3 k=SMI_WB_K${K.length-1};return k.y+k.z*(s-k.x);}\n` +
`float smiWakeAngleWeightG(float theta){float a=abs(atan(sin(theta-${f(B.center)}),cos(theta-${f(B.center)})));if(a<=${f(B.fullHalfAngle)})return 1.0;if(a>=${f(B.fullHalfAngle+B.fadeAngle)})return 0.0;return 1.0-smiWakeSmooth01G((a-${f(B.fullHalfAngle)})/${f(B.fadeAngle)});}\n` +
`float smiWakeCrossWeightG(float s){float left=smiWakeSmooth01G((s-(${f(B.crossMin)}))/${f(B.crossFullMin-B.crossMin)});float right=1.0-smiWakeSmooth01G((s-(${f(B.crossFullMax)}))/${f(B.crossMax-B.crossFullMax)});return clamp(left*right,0.0,1.0);}\n` +
`vec3 smiWakeFrameG(vec2 p){float r=length(p),theta=atan(p.y,p.x),R=${islandRadius}(p),s=r-R;return vec3(s,theta,smiWakeAngleWeightG(theta)*smiWakeCrossWeightG(s));}\n` +
`float ${functionName}(vec2 p){vec3 f=smiWakeFrameG(p);return mix(${legacyBed}(p),smiWakeProfileG(f.x),f.z);}\n`;
}

function cpuBedAt(x, z, legacyBed, islandRadius) {
  validateAuthoritativeSource();
  return Shoreline.bedAt(x, z, legacyBed, islandRadius);
}
function cpuFrameAt(x, z, islandRadius) {
  validateAuthoritativeSource();
  return Shoreline.frameAt(x, z, islandRadius);
}

module.exports = Object.freeze({ VERSION, PROFILE_ID, authoritative: Shoreline, validateAuthoritativeSource, glslSource, cpuBedAt, cpuFrameAt });

/* SYNTHETIC HOST QA. All shader bodies in this file were authored for this test.
 * They are coordinate patterns, not reproductions of any original artwork.
 * A few exact, generic declaration lines are host-required injection anchors.
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export const LABEL = 'SYNTHETIC HOST QA — original shaders and physical iOS NOT tested';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const pack = value => gzipSync(Buffer.from(JSON.stringify(value))).toString('base64url');

function coordinatePattern(offset) {
  return `// Self-authored synthetic coordinate pattern, variant ${offset}.
void mainImage(out vec4 result, in vec2 fragCoord) {
    vec3 ro = vec3(1.2, 0.8, 2.5);
    vec3 ta = vec3(0.0);
    mat3 ca = mat3(1.0);
    vec2 p = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    vec3 camera = ca * ro;
    vec3 phase = vec3(p.x * 13.0, p.y * 17.0, (p.x + p.y) * 11.0);
    phase += camera * 2.3 + vec3(iTime * 0.73 + ${offset}.0);
    result = vec4(0.5 + 0.43 * sin(phase), 1.0);
}
`;
}

const flower = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
out vec4 fragColorOut;
// Self-authored synthetic coordinate pattern, not a flower reconstruction.
void mainImage(out vec4 result, in vec2 fragCoord) {
    vec2 p = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    vec3 phase = vec3(p.x * 15.0, p.y * 12.0, length(p) * 19.0);
    result = vec4(0.5 + 0.43 * sin(phase + vec3(iTime * 0.71)), 1.0);
}
void main(){ mainImage(fragColorOut, gl_FragCoord.xy); }
`;

export const spikySource = `// Self-authored synthetic camera/texture pattern, not a coral reconstruction.
void mainImage(out vec4 result, in vec2 I) {
    vec2 uv = (2.0 * I - iResolution.xy) / iResolution.y;
    vec3 ro = vec3(1.2, 0.8, 2.5);
    vec3 rd = normalize(vec3(uv, -1.0));
    float colorInit = 0.30375 + 0.25 * sin(uv.x * 5.0 + iTime);
    vec3 proColor = 0.5 + 0.4 * sin(vec3(uv.x * 9.0, uv.y * 11.0, uv.x * 6.0 + uv.y * 7.0) + ro + rd * 2.0 + iTime * 0.7);
    vec3 texColor = texture(iChannel0, uv * 0.2 + 0.5).rgb;
    vec3 color;
    color = mix(proColor, texColor, 0.3315);
    result = vec4(color, 1.0);
}
`;

export const materialSource = `// Self-authored synthetic stripe texture for the host FBO path.
vec3 originalCoralTexture(vec2 uv) {
    return 0.5 + 0.4 * sin(vec3(uv.x * 25.132741, uv.y * 18.849556, (uv.x + uv.y) * 12.566371));
}
`;

export const sources = Object.freeze({ color: coordinatePattern(1), transparent: coordinatePattern(3), rosette: flower });
export const records = Object.values(Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, {
  id,
  source,
  sha256: sha256(source),
  notice: LABEL,
}])));
export const manifest = Object.fromEntries(records.map(record => [record.id, {
  sha256: record.sha256,
  bytes: Buffer.byteLength(record.source),
}]));
export const originalsBundle = { schema: 'coral-case-originals/1', cases: records };
export const originalsHash = pack(originalsBundle);
export const legacyBundle = {
  schema: 'coral-user-source-replay/1',
  sha256: manifest.rosette.sha256,
  fragment: flower,
  sourceFile: 'SYNTHETIC-HOST-QA-ONLY.glsl',
  notice: LABEL,
};
export const legacyHash = pack(legacyBundle);
export const previewSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#102b32"/><path d="M0 0L480 270M480 0L0 270" stroke="#367988" stroke-width="5"/><text x="240" y="126" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="22">SYNTHETIC HOST QA</text><text x="240" y="156" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="14">No original artwork loaded</text></svg>`;

/** Isolated g0 far-proxy source proof. No host/runtime source is rewritten. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const SOURCE_SHA256 = 'fa540676720626a10de4d1329b3b17aa240ede0e2e51414afc9bf164583801c2';
export const SOURCE_BYTES = 114401;
// Original compact producer's upstream source identity, required by receiver.
export const PRODUCER_SOURCE_SHA256 = '588042e14707b2dcab1e890c18fca2afdd20104eaecb7a5d3b25baa71c6a8d36';
export const ENTRY_POINT = 'stationTerminalProxy';
export const DEFAULT_SOURCE = fileURLToPath(new URL('../compact-trace-r01/generated/runtime-0.wgsl', import.meta.url));
export const DEFAULT_OUTPUT_DIR = fileURLToPath(new URL('./generated/', import.meta.url));
export const sha256 = text => createHash('sha256').update(text).digest('hex');

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Terminal proxy rejected source: ${message}`);
}

/** Extract literal source bytes, including formatting, never reserialize WGSL. */
export function extractDeclaration(source, kind, name) {
  const pattern = new RegExp(`\\b${kind}\\s+${name}\\b`, 'g');
  const matches = [...source.matchAll(pattern)];
  requireCondition(matches.length === 1, `${kind} ${name} must be unique`);
  const start = matches[0].index;
  const open = source.indexOf('{', start);
  requireCondition(open !== -1, `${name} body is missing`);
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    if (source[index] === '{') depth++;
    else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Terminal proxy rejected source: ${name} body is unclosed`);
}

function binding(source, name) {
  const pattern = new RegExp(`^@group\\([^\\n;]+\\b${name}:[^;]+;`, 'gm');
  const matches = [...source.matchAll(pattern)];
  requireCondition(matches.length === 1, `binding ${name} must be unique`);
  return matches[0][0];
}

const EXPECTED_GUARD = 'if(terminalEnvelope<.15){recordCandidate(terminalHallRawWinner(completeTerminalHall(p,skipFloor)));}else{recordPart(p,terminalEnvelope,0u,p,0.);}';
const EXPECTED_INITIALIZATION = 'stationCandidates.count=0u;stationCandidateOverflow=false;stationRawCandidateCount=0u;stationCandidateUpper=10000.;';
const EXPECTED_QUERY_TAIL = ' let h=stationDomain(p,skipRoof,skipFloor);\n return mergeCompactTrace(merged,vec4<f32>(h.d,f32(h.id),h.baseD,h.seed),f32(stationRawCandidateCount),stationCandidateOverflow);\n}';
const CANONICAL_PHASE_GUARD = 'if((phase==0.&&trace.w!=0.)||(phase==1.&&trace.w!=1.)){return merged;}';
const FULL_LOAD = 'let full=textureLoad(fullHitA,ij,0);';

export function emitTerminalProxy(source) {
  requireCondition(typeof source === 'string', 'expected WGSL text');
  const inputSHA256 = sha256(source);
  requireCondition(inputSHA256 === SOURCE_SHA256 && Buffer.byteLength(source) === SOURCE_BYTES,
    `g0 identity differs (expected ${SOURCE_SHA256}, received ${inputSHA256}); regenerate proof before accepting any source change`);
  const structures = Object.fromEntries(['Params', 'HostFrame', 'GroupQueryControl'].map(name => [name, extractDeclaration(source, 'struct', name)]));
  const bindings = Object.fromEntries(['u', 'frame', 'groupQueryControl', 'traceInput', 'fullHitA'].map(name => [name, binding(source, name)]));
  const dependencies = Object.fromEntries(['localPoint', 'hostRay', 'box', 'mergeCompactTrace'].map(name => [name, extractDeclaration(source, 'fn', name)]));
  const proofFunctions = Object.fromEntries(['stationDomain', 'stationNativeId', 'recordPart', 'recordCandidate', 'resolveCandidates'].map(name => [name, extractDeclaration(source, 'fn', name)]));
  const domain = proofFunctions.stationDomain;
  const envelopeMatches = [...domain.matchAll(/let terminalEnvelope=box\(p-vec3<f32>\(([^)]+)\),vec3<f32>\(([^)]+)\)\);/g)];
  requireCondition(envelopeMatches.length === 1, 'original terminal envelope expression is missing or ambiguous');
  const envelope = envelopeMatches[0][0];
  requireCondition(domain.includes(EXPECTED_INITIALIZATION), 'candidate initialization changed');
  requireCondition(domain.includes(EXPECTED_GUARD), 'original strict .15 terminal guard changed');
  requireCondition(domain.replace(/\s+/g, '') === `fnstationDomain(p:vec3<f32>,skipRoof:bool,skipFloor:bool)->HitField{${EXPECTED_INITIALIZATION}${envelope}${EXPECTED_GUARD}returnresolveCandidates(p);}`.replace(/\s+/g, ''),
    'stationDomain contains an unproved extra operation');
  requireCondition(proofFunctions.recordPart === 'fn recordPart(p:vec3<f32>,d:f32,id:u32,q:vec3<f32>,seed:f32){recordCandidate(HitField(d,id,q,seed,d,vec3<f32>(1.),0.));}', 'far candidate payload changed');
  requireCondition(!/id==0u/.test(proofFunctions.stationNativeId), 'id0 has become a native material');
  requireCondition(proofFunctions.recordCandidate.includes('stationRawCandidateCount>=STATION_CANDIDATE_CAPACITY') && proofFunctions.recordCandidate.includes('stationRawCandidateCount+=1u;'), 'raw count/overflow contract changed');
  requireCondition(source.includes('const STATION_CANDIDATE_CAPACITY:u32=96u;'), 'capacity changed');
  requireCondition(proofFunctions.resolveCandidates.includes('var h=HitField(10000.,0u,p,0.,10000.,vec3<f32>(1.),0.);') && proofFunctions.resolveCandidates.includes('if(candidate.d<h.d){h=candidate;}'), 'strict original winner changed');
  const originalQuery = extractDeclaration(source, 'fn', 'stationCompactQuery');
  requireCondition(originalQuery.endsWith(EXPECTED_QUERY_TAIL), 'original query tail changed');
  const originalPrefix = originalQuery.slice(originalQuery.indexOf('{') + 1, -EXPECTED_QUERY_TAIL.length);
  requireCondition(originalPrefix.includes(CANONICAL_PHASE_GUARD) && originalPrefix.includes(FULL_LOAD), 'canonical early returns changed');
  const finiteHelpers = `fn terminalProxyFinite(value:f32)->bool{return (bitcast<u32>(value)&0x7f800000u)!=0x7f800000u;}
fn terminalProxyFinite3(value:vec3<f32>)->bool{return terminalProxyFinite(value.x)&&terminalProxyFinite(value.y)&&terminalProxyFinite(value.z);}
fn terminalProxyFinite4(value:vec4<f32>)->bool{return terminalProxyFinite3(value.xyz)&&terminalProxyFinite(value.w);}`;
  // Validity guards only enlarge the unchanged full-g0 fallback region. Unknown
  // states cannot certify a proxy, even where an original early return is likely.
  const inputGuard = `if(!terminalProxyFinite4(trace)||!terminalProxyFinite3(ray[0])||!terminalProxyFinite3(ray[1])||!terminalProxyFinite3(p)||!terminalProxyFinite4(groupQueryControl.offsetAndPhase)||!terminalProxyFinite4(groupQueryControl.options)){discard;}
 if((phase!=0.&&phase!=1.)||(trace.w!=0.&&trace.w!=1.&&trace.w!=2.&&trace.w!=3.)||(groupQueryControl.options.x!=0.&&groupQueryControl.options.x!=1.&&groupQueryControl.options.x!=2.&&groupQueryControl.options.x!=3.)){discard;}
 `;
  const guardedPrefix = originalPrefix.replace(CANONICAL_PHASE_GUARD, inputGuard + CANONICAL_PHASE_GUARD)
    .replace(FULL_LOAD, FULL_LOAD + 'if(!terminalProxyFinite4(full)){discard;}');
  const entry = `@fragment fn ${ENTRY_POINT}(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{${guardedPrefix} ${envelope}
 if(!terminalProxyFinite(terminalEnvelope)){discard;}
 if(terminalEnvelope<.15){discard;}
 // recordPart(id0) increments rawCount once. id0 is non-native; no material
 // displacement is applied. The original strict winner retains10000 at ties.
 var d=10000.;if(terminalEnvelope<d){d=terminalEnvelope;}
 return mergeCompactTrace(merged,vec4<f32>(d,0.,d,0.),1.,false);
}`;
  const wgsl = `// Generated isolated g0 light program. Input SHA256: ${SOURCE_SHA256}
// Discard leaves stencil0; a separate unchanged original g0 program handles it.
// This does not claim that a branch inside the heavy program makes it cheaper.
${Object.values(structures).join('\n')}
${Object.values(bindings).join('\n')}
${Object.values(dependencies).join('\n')}
${finiteHelpers}
${entry}\n`;
  const extracted = {...structures, ...bindings, ...dependencies, ...proofFunctions, originalPrefix, terminalEnvelope: envelope};
  const manifest = {
    experiment: 'terminal-proxy-r01', version: 1, group: 0, entry: ENTRY_POINT,
    sourceSHA256: PRODUCER_SOURCE_SHA256, proxySourceSHA256: inputSHA256,
    outputs: {proxy: {entry: ENTRY_POINT, sha256: sha256(wgsl), bytes: Buffer.byteLength(wgsl)}},
    input: {path: 'experiments/compact-trace-r01/generated/runtime-0.wgsl', sha256: inputSHA256, bytes: Buffer.byteLength(source)},
    output: {path: 'proxy.wgsl', sha256: sha256(wgsl), bytes: Buffer.byteLength(wgsl)},
    bindings: {uniforms: [{group: 0, binding: 0, name: 'u', type: 'Params'}, {group: 0, binding: 1, name: 'frame', type: 'HostFrame'}, {group: 0, binding: 2, name: 'groupQueryControl', type: 'GroupQueryControl'}], textures: [{group: 1, binding: 0, name: 'traceInput'}, {group: 1, binding: 5, name: 'fullHitA'}]},
    extracted: Object.fromEntries(Object.entries(extracted).map(([name, text]) => [name, {sha256: sha256(text), bytes: Buffer.byteLength(text)}])),
    proof: {
      sourceLocked: true, originalEnvelope: envelope, originalGuard: EXPECTED_GUARD,
      center: envelopeMatches[0][1].split(',').map(Number), halfExtent: envelopeMatches[0][2].split(',').map(Number),
      activeEligibility: 'Known phase0/1, skip0/1/2/3, trace status0/1/2/3, finite trace/ray/p/control, finite fullHitA if automatic skip is reached, finite terminalEnvelope>=.15.',
      canonicalEarlyReturns: 'Exact source phase and automatic-skip returns produce (10000,0,0,0); extra validity guards may conservatively route them to full g0.',
      rawCount: 'stationDomain resets raw0/count0/overflowfalse/upper10000; one recordPart(id0) calls recordCandidate exactly once, so raw1 and no local96-capacity overflow.',
      winner: 'id0 is non-native; recordPart makes baseD=terminalEnvelope and seed0. Below10000 it wins strictly. At10000 it ties and preserves the default. Above10000 recording is pruned, with raw1 preserved. Resolved d=baseD=min(terminalEnvelope,10000), id0 and seed0.',
      merge: 'Original mergeCompactTrace bytes are retained. Prefix starts(10000,0,0,0), raw1. Finite far winners below10000 have finite d/id/baseD/seed well below1e30, so invalid flag0. At/above10000 strict merge retains the default, raw1, flags0. Original96 overflow logic is unchanged.',
      fallback: 'Every active near, nonfinite, or unknown case discards. Fixed-function stencil must keep discarded pixels0 and execute the separate unchanged original g0 only there.',
      exclusions: 'No host, other group, mother/material, full-query reference, advance, shading, asset, or publication change. No GPU performance or equivalence claim until independent QA passes.',
    },
  };
  return {wgsl, manifest};
}

export function writeTerminalProxy({sourcePath = DEFAULT_SOURCE, outputDir = DEFAULT_OUTPUT_DIR} = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const result = emitTerminalProxy(source);
  fs.mkdirSync(outputDir, {recursive: true});
  fs.writeFileSync(path.join(outputDir, 'proxy.wgsl'), result.wgsl);
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(result.manifest, null, 2) + '\n');
  return result.manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {};
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (flag === '--source' && process.argv[i + 1]) options.sourcePath = path.resolve(process.argv[++i]);
    else if (flag === '--output-dir' && process.argv[i + 1]) options.outputDir = path.resolve(process.argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${flag}`);
  }
  const manifest = writeTerminalProxy(options);
  process.stdout.write(JSON.stringify({entry: manifest.entry, sourceSHA256: manifest.input.sha256, proxySHA256: manifest.output.sha256, proxyBytes: manifest.output.bytes}) + '\n');
}

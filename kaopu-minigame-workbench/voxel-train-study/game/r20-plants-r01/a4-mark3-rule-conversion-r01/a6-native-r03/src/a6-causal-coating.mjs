/**
 * A6-only coating transport. The fixed R06 metalField supplies layer loss,
 * metre-valued peel edges and common layer coverage. R08 intact enamel keeps its
 * actual factory callback and 20 µm finish; no vendor or R01 module is edited.
 */
import {PARAMETERIZED_METAL_FIELDS} from '../../master-materials-v3-1/r06-source-parameters.mjs';

export const A6_COATING_VERSION = 'a6-r06-r08-causal-coating/1';
export const A6_DEFAULT_COATING_WEAR = 0.32;
export const A6_COATING_ROLES = Object.freeze(['paint', 'body-green', 'blackPaint', 'black-coated-steel', 'black-painted-steel', 'roof-black', 'buffer-red', 'red']);
export const A6_COATING_PROVENANCE = Object.freeze({
  version: A6_COATING_VERSION,
  fixedRelease: 'master-materials-v3-1',
  releaseCommit: '7577ae37c8bc13bc3f7c0204c1857e83074c257a',
  layerFactory: 'master-materials-v3-1/vendor/material-master-r06/metal-surface.mjs#metalField',
  layerSourceSha256: 'eb41a40ac4960ec3e2b55bc4637ac4dba641f602d6c1f30909778160b1dc029f',
  parameterAdapter: 'master-materials-v3-1/r06-source-parameters.mjs#PARAMETERIZED_METAL_FIELDS',
  parameterAdapterSha256: '572a79ead1eeca53cbfeabdd57c3d295130c75f4b77d1d9a711bc557105854e6',
  enamelFactory: 'master-materials-v3-1/vendor/train-r08/materials/matter.mjs#createTrainMatter(T).paint',
  enamelSourceSha256: 'ddde6a46c197742abed03f5e98b6edcd5cf9ed1e51f3e876cd8b63a7273a674a',
  nativeTransport: 'student-native-r01/src/native-materials.mjs',
  nativeTransportSha256: '84c894d410506497264f75aa52e02fd10a2bdc53e91cd62a5c1d1c51090e2caa',
  reusedUnchanged: ['mt_kh', 'mt_kn', 'mt_kfb', 'mt_knvg', 'mt_kfbvg', 'mt_aa', 'mt_resolved', 'warped potential', 'surface-projected analytic gradient', 'metre edge distance', 'primer adhesion pockets'],
  originalVendorChanged: false, oldNativeChanged: false, fragmentByteIdentical: false,
  sourceTextureOrBakedFieldUsed: false, fittedToReferenceImage: false,
});
export const A6_COATING_SCALE = Object.freeze({
  units: 'm', calibratedAgainstRealPaint: false,
  wearInterpretation: 'Dimensionless layer-loss threshold control, not age, corrosion or percentage of missing paint.',
  threshold: '1.02 - 0.50 * wear', coatThicknessM: 0.00014, primerThicknessM: 0.000055,
  peelExtentM: Object.freeze([0.00018, 0.0011]),
  macroLatticePerM: Object.freeze([13, 13 * 2.13, 13 * 4.17]),
  edgePerturbations: Object.freeze([{frequencyPerM: 137, amplitudeM: 0.0012}, {frequencyPerM: 517, amplitudeM: 0.00032}]),
  substrateMicroLatticePerM: 490, substrateMicroHeightCoefficientM: 0.000006,
  originalR08IntactMicroLatticePerM: 65, originalR08IntactMicroHeightCoefficientM: 0.000020,
  primerColorSRGB: '#746b50', substrateColorSRGB: '#535b59',
  paletteInterpretation: 'Authored muted primer and fresh dark steel candidate; no claim to measured historical paint or alloy.',
  corrosion: false, pits: false, stain: false, wet: false, artificialJointOrigins: false,
});

export function validateA6CoatingWear(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('A6 coatingWear must be a finite number in [0, 1].');
  return value;
}
function replaceOnce(source, before, after, scope) {
  if (source.split(before).length !== 2) throw new Error(`A6 causal coating ${scope} drift: ${before}`);
  return source.replace(before, after);
}
/** Explicit A6-only derivatives; all untouched master algebra stays imported. */
export const A6_COATING_SUBSTITUTIONS = Object.freeze([
  ['uniform vec3 uTrainSourceColor;', 'uniform vec3 uTrainSourceColor;uniform vec3 uA6PrimerColor,uA6SubstrateColor;'],
  ['vec3 coat=uTrainSourceColor,undercoat=vec3(.17,.087,.040),steel=vec3(.30,.32,.31);', 'vec3 coat=uTrainSourceColor,undercoat=uA6PrimerColor,steel=uA6SubstrateColor;'],
  ['float oxideClass=mt_aa(.40,reactive,max(.004,fp*9.));', 'float oxideClass=0.; // A6 fresh exposure: corrosion is explicitly disabled.'],
  ['float pits=exposed*(.25+.75*maturity)*pitSeed*(.35+.65*meso)*mt_resolved(284.,fp);', 'float pits=0.; // No unsupported pitting.'],
  ['float stain=history*drip*(.12+.88*exposed);', 'float stain=0.; // No independent decorative dirt.'],
  ['(.35+.18*pits)*bare', '(.36+.04*(micro-.5))*bare'],
  ['height+=(micro-.5)*(uTrainMicroReliefM*(1.-exposed)+.000065*oxide*(.4+.6*porous));', 'height+=(micro-.5)*(uTrainMicroReliefM*intact+.000006*bare);'],
].map(pair => Object.freeze(pair)));
let fields = PARAMETERIZED_METAL_FIELDS;
for (const [before, after] of A6_COATING_SUBSTITUTIONS) fields = replaceOnce(fields, before, after, 'R06 field');
export const A6_COATING_FIELDS = fields;

/** Install only on explicitly declared painted-metal roles. */
export function applyA6CausalCoating(T, material, {role, wear = A6_DEFAULT_COATING_WEAR} = {}) {
  validateA6CoatingWear(wear);
  if (!A6_COATING_ROLES.includes(role)) throw new Error('A6 coating requires an explicit painted-metal role.');
  if (material.userData.a6Coating) throw new Error('A6 coating is already installed.');
  const native = material.userData.nativeMaster;
  const family = native?.recipe?.family;
  if (!['paint', 'metal'].includes(family) || material.metalness !== 0) throw new Error('A6 coating needs the native dielectric paint or painted-steel factory.');
  const colorUniform = hex => {const c = new T.Color().setStyle(hex, T.SRGBColorSpace); return {value: new T.Vector3(c.r, c.g, c.b)};};
  const uniforms = {
    uWear: {value: wear}, uHistory: {value: 0}, uWet: {value: 0}, uRepair: {value: 0}, uMode: {value: 0}, uVariant: {value: 1}, uRack: {value: 0},
    uJoints: {value: Array.from({length: 16}, () => new T.Vector3())}, uJointCount: {value: 0},
    uTrainSourceColor: {value: new T.Vector3(material.color.r, material.color.g, material.color.b)},
    uTrainSourceMetallic: {value: 0}, uTrainSourceRoughness: {value: material.roughness},
    uTrainRoughnessMin: {value: 0}, uTrainRoughnessMax: {value: 1},
    uTrainMicroReliefM: {value: family === 'paint' ? 0 : native.recipe.microReliefM},
    uA6PrimerColor: colorUniform(A6_COATING_SCALE.primerColorSRGB),
    uA6SubstrateColor: colorUniform(A6_COATING_SCALE.substrateColorSRGB),
  };
  const audit = material.userData.a6Coating = {
    version: A6_COATING_VERSION, role, inheritedFamily: family, wear,
    provenance: {...A6_COATING_PROVENANCE}, scale: {...A6_COATING_SCALE},
    enabled: true, shaderHookExecuted: false, actualWebGLCompileValidated: false, visualAcceptance: false,
    originalColorSRGB: '#' + material.color.getHexString(T.SRGBColorSpace),
    originalScalarMetalness: material.metalness, originalScalarRoughness: material.roughness,
    layerMeaning: ['intact existing A6 enamel', 'interrupted surviving primer', 'fresh exposed steel'],
    layerCoverageSharedBy: ['diffuse', 'F0/metalness', 'roughness', 'height/normal'],
    originalNativeAuditDescribesUnderlyingFactoryOnly: true,
  };
  material.userData.a6CoatingUniforms = uniforms;
  const original = material.onBeforeCompile.bind(material), oldKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = shader => {
    original(shader);
    Object.assign(shader.uniforms, uniforms);
    if (family === 'metal') {
      if (!shader.fragmentShader.startsWith(PARAMETERIZED_METAL_FIELDS)) throw new Error('A6 native R06 prefix drift.');
      shader.fragmentShader = A6_COATING_FIELDS + shader.fragmentShader.slice(PARAMETERIZED_METAL_FIELDS.length);
    } else {
      // New varyings use exactly the same immutable native metre frame. Original
      // R08 vKP/vKN and original factory microfinish remain present and active.
      shader.vertexShader = 'varying vec3 vRestM;varying vec3 vSurfaceN;\n' + shader.vertexShader;
      shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\nvRestM=(uNativeRestMetres*vec4(position,1.)).xyz;vSurfaceN=normalize(uNativeRestNormal*normal);', 'R08 fixed domain');
      shader.fragmentShader = A6_COATING_FIELDS + shader.fragmentShader;
      shader.fragmentShader = replaceOnce(shader.fragmentShader, 'vec3 kq=vKP+vec3(11.00);', 'vec3 kq=vKP+vec3(11.00);float a6fp=max(length(dFdx(vRestM)),length(dFdy(vRestM)));MetalSurface a6ms=metalField(vRestM,a6fp);diffuseColor.rgb=a6ms.color;', 'R08 colour');
      shader.fragmentShader = replaceOnce(shader.fragmentShader, 'roughnessFactor=clamp(roughnessFactor+(kn(kq*65.)-.5)*.012,.08,.99);', 'roughnessFactor=clamp(a6ms.rough+(kn(kq*65.)-.5)*.012*a6ms.layers.x,.08,.99);', 'R08 roughness');
      shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=a6ms.metal;', 'R08 substrate metalness');
      shader.fragmentShader = replaceOnce(shader.fragmentShader, 'float h=(kn(kq*65.)-.5)*fh88FinishReliefM*(1.-smoothstep(.4,1.6,footprint));', 'float h=(kn(kq*65.)-.5)*fh88FinishReliefM*(1.-smoothstep(.4,1.6,footprint))*a6ms.layers.x+a6ms.height;', 'R08 coherent layer height');
      shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.diffuseColor=a6ms.coverageDiffuse;material.specularColor=a6ms.coverageF0;\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat*=a6ms.layers.x;\n#endif', 'R08 coverage BRDF');
    }
    audit.shaderHookExecuted = true;
  };
  material.customProgramCacheKey = () => oldKey() + '|' + A6_COATING_VERSION + '|' + family;
  material.needsUpdate = true;
  return {
    setWear(value) {validateA6CoatingWear(value); uniforms.uWear.value = value; audit.wear = value;},
    audit,
  };
}

export const A6_REST_ATTRIBUTE_VERSION = 'a6-explicit-material-rest-attributes/1';
/**
 * Bind deforming A6 shrouds to caller-supplied immutable material coordinates.
 * a6RestPosition / a6RestNormal are already in the authored METRE rest frame,
 * not the deformed object position and not a frame to transform a second time.
 * They must correspond vertex-for-vertex to the live mesh's tessellation.
 * Current position, normal and every lighting/displacement chunk stay untouched.
 * Do not share this material with meshes that lack the two required attributes.
 */
export function bindA6RestAttributes(material) {
  const coating = material?.userData?.a6Coating;
  if (!coating || !['paint', 'metal'].includes(coating.inheritedFamily)) throw new Error('A6 rest attributes require an installed A6 painted-metal coating.');
  if (coating.restAttributes) return material;
  const audit = coating.restAttributes = {
    version: A6_REST_ATTRIBUTE_VERSION,
    positionAttribute: 'a6RestPosition', normalAttribute: 'a6RestNormal',
    units: 'm', coordinatesAlreadyInMaterialRestFrame: true,
    requiredVertexCorrespondence: 'Same vertex count, order and tessellation as live geometry.',
    currentLightingPositionPreserved: true, currentLightingNormalPreserved: true,
    materialFrameMatrixAppliedAgain: false, shaderHookExecuted: false,
    geometryCorrespondenceVerified: false, actualWebGLCompileValidated: false,
  };
  const original = material.onBeforeCompile.bind(material), key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = shader => {
    original(shader);
    let vertex = replaceOnce(shader.vertexShader,
      'vRestM=(uNativeRestMetres*vec4(position,1.)).xyz;vSurfaceN=normalize(uNativeRestNormal*normal);',
      'vRestM=a6RestPosition;vSurfaceN=normalize(a6RestNormal);', 'R06 explicit rest attributes');
    if (coating.inheritedFamily === 'paint') vertex = replaceOnce(vertex,
      'vKP=(uNativeRestMetres*kpos).xyz;vKN=normalize(uNativeRestNormal*knorm);',
      'vKP=a6RestPosition;vKN=normalize(a6RestNormal);', 'R08 explicit rest attributes');
    shader.vertexShader = 'attribute vec3 a6RestPosition;attribute vec3 a6RestNormal;\n' + vertex;
    audit.shaderHookExecuted = true;
  };
  material.customProgramCacheKey = () => key() + '|' + A6_REST_ATTRIBUTE_VERSION;
  material.needsUpdate = true;
  return material;
}

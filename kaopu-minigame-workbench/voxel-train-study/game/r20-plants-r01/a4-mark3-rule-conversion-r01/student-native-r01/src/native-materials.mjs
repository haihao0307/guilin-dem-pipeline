/**
 * Authored material recipes for first-party, metre-designed native train meshes.
 * This module has no model loader, original node IDs, parser associations, source
 * material definitions, source-matching fallback, geometry payload or residuals.
 *
 * R06 metal uses the already locked eight-substitution field exported by v3.1.
 * Its inherited uniform names contain “Source”; values below are OUR recipes,
 * never copied from an original model. R03 glass fragment remains unchanged.
 * R08 paint uses two declared, guarded native-only transport substitutions to
 * remove inherited macro albedo mottling and narrow roughness to a small-scale
 * field; the original vendor, normal microheight and BRDF remain unchanged.
 * Material coordinates use an explicit immutable rest frame. Geometry is not edited.
 */
import {makeMetalMaterial, METAL_FIELDS} from '../../master-materials-v3-1/vendor/material-master-r06/metal-surface.mjs';
import {PARAMETERIZED_METAL_FIELDS, SOURCE_RECIPE_VERSION} from '../../master-materials-v3-1/r06-source-parameters.mjs';
import {createTrainMatter} from '../../master-materials-v3-1/vendor/train-r08/materials/matter.mjs';
import {buildGlassCase, GLASS_RECIPE} from '../../master-materials-v3-1/vendor/material-master-r03/wood-glass.mjs';

export const NATIVE_MATERIAL_VERSION = 'kaopu.student-native-materials/1.1.0';
export const NATIVE_MASTER_RELEASE = Object.freeze({
  directory: 'master-materials-v3-1',
  commit: '7577ae37c8bc13bc3f7c0204c1857e83074c257a',
  threeRevision: '170',
  metalRecipe: SOURCE_RECIPE_VERSION,
  metalFactory: 'vendor/material-master-r06/metal-surface.mjs#makeMetalMaterial',
  paintFactory: 'vendor/train-r08/materials/matter.mjs#createTrainMatter(T).paint',
  glassFactory: 'vendor/material-master-r03/wood-glass.mjs#buildGlassCase',
  originalVendorChanged: false,
});
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
export const NATIVE_MATERIAL_RECIPES = freeze({
  'body-green': {
    label: 'Authored deep-green enamel', family: 'paint', colorSRGB: '#103e35',
    metalness: 0, roughness: 0.40, clearcoat: 0, clearcoatRoughness: 0.24,
    envMapIntensity: 0.60, microReliefM: 0.000020,
    rationale: 'Second native visual candidate: restrained enamel roughness, no unsupported extra clearcoat, reduced instance environment reflection. Native-only two-substitution microfinish transport removes uncalibrated macro mottling; this does not certify visual acceptance.',
  },
  'black-painted-steel': {
    label: 'Authored black-painted steel', family: 'metal', colorSRGB: '#14191b',
    metalness: 0, roughness: 0.58, envMapIntensity: 0.45, microReliefM: 0.000012,
    rationale: 'Second native visual candidate: rough intact dielectric paint over steel, with restrained environment reflection. No bare-metal F0, rust, oil or exposed substrate is invented.',
  },
  'polished-rod-steel': {
    label: 'Authored polished linkage steel', family: 'metal', colorSRGB: '#b9c2c6',
    metalness: 1, roughness: 0.21, envMapIntensity: 1.15, microReliefM: 0.000004,
    rationale: 'Explicit conductor reflectance and restrained analytic microrelief; not a measured alloy or anisotropic machining model.',
  },
  'dark-iron': {
    label: 'Authored dark iron', family: 'metal', colorSRGB: '#51585a',
    metalness: 0.92, roughness: 0.48, envMapIntensity: 1.0, microReliefM: 0.000012,
    rationale: 'Dark metallic running gear, kept separate from dielectric black paint.',
  },
  'window-glass': {
    label: 'R03 finite window-glass recipe', family: 'glass',
    colorSRGB: GLASS_RECIPE.color, metalness: GLASS_RECIPE.metalness,
    roughness: GLASS_RECIPE.roughness, thicknessM: GLASS_RECIPE.thickness,
    transmission: GLASS_RECIPE.transmission, ior: GLASS_RECIPE.ior,
    attenuationColorSRGB: GLASS_RECIPE.attenuationColor,
    attenuationDistanceM: GLASS_RECIPE.attenuationDistance, envMapIntensity: 1.0,
    rationale: 'Existing R03 finite-glass receiver: limited screen-space dielectric transport, not a recovered mature glass mother.',
  },
  'interior-cream': {
    label: 'Authored warm interior enamel', family: 'paint', colorSRGB: '#b5aa89',
    metalness: 0, roughness: 0.57, clearcoat: 0, clearcoatRoughness: 0.30,
    envMapIntensity: 0.85, microReliefM: 0.000020,
    rationale: 'Warm painted interior panels using the actual R08 enamel field; no claim to wood or leather.',
  },
  'roof-black': {
    label: 'Authored satin black roof enamel', family: 'paint', colorSRGB: '#202426',
    metalness: 0, roughness: 0.50, clearcoat: 0, clearcoatRoughness: 0.30,
    envMapIntensity: 0.9, microReliefM: 0.000020,
    rationale: 'Satin dielectric roof finish, deliberately separate from polished rods and body enamel.',
  },
  'buffer-red': {
    label: 'Authored red buffer-beam enamel', family: 'paint', colorSRGB: '#8e2523',
    metalness: 0, roughness: 0.36, clearcoat: 0.18, clearcoatRoughness: 0.26,
    envMapIntensity: 1.0, microReliefM: 0.000020,
    rationale: 'Authored painted buffer-beam recipe, not a source-model material recovery.',
  },
  'matte-black-dielectric': {
    label: 'Authored matte black dielectric candidate', family: 'paint', colorSRGB: '#171b1c',
    metalness: 0, roughness: 0.82, clearcoat: 0, clearcoatRoughness: 0.50,
    envMapIntensity: 0.85, microReliefM: 0.000020,
    rationale: 'Native rubber role has no dedicated locked rubber mother. This is an explicit rough black dielectric appearance candidate reusing the R08 field, not verified rubber physics.',
  },
  'trim-brass': {
    label: 'Authored brass-colour metal trim', family: 'metal', colorSRGB: '#c89849',
    metalness: 1, roughness: 0.28, envMapIntensity: 1.1, microReliefM: 0.000004,
    rationale: 'Authored conductor colour for trim; alloy composition and spectral response are not measured.',
  },
});

/** Native-only derivative of the actual locked R08 paint callback.
 * Exactly two substitutions; the original vendor and normal/BRDF code stay intact.
 */
export const NATIVE_PAINT_TRANSPORT_VERSION = 'kaopu.native-r08-enamel-micro-transport/1';
export const NATIVE_PAINT_SUBSTITUTIONS = freeze([
  ['vec3 kq=vKP+vec3(11.00);float kp=kfb(kq*3.1);diffuseColor.rgb*=.94+.09*kp;',
    'vec3 kq=vKP+vec3(11.00);'],
  ['roughnessFactor=clamp(roughnessFactor+(kn(kq*9.)-.5)*.12,.08,.99);',
    'roughnessFactor=clamp(roughnessFactor+(kn(kq*65.)-.5)*.012,.08,.99);'],
]);
export const NATIVE_PAINT_TRANSPORT = freeze({
  version: NATIVE_PAINT_TRANSPORT_VERSION, substitutionCount: 2,
  originalPaintFactorySha256: 'ddde6a46c197742abed03f5e98b6edcd5cf9ed1e51f3e876cd8b63a7273a674a',
  originalFieldFactorySha256: 'bbf9376b7a0a69d85627bd6cf4e5662be2557ee67a0a8a83411878bff133d062',
  originalR170HookFragmentSha256: 'ee1a0a2a39608dfc3d24acfa7e38a429f94c8215bd2653be23128a5534391ae9',
  originalVendorChanged: false, fragmentByteIdentical: false,
  noiseKernelChanged: false, normalMicroheightCodeChanged: false, brdfChanged: false,
  macroAlbedoModulationRemoved: true, actualRenderAcceptance: false,
});
/** These are designed metre-domain controls, not historical-paint measurements.
 * Value-noise lattice spacing is not a periodic surface wavelength.
 */
export const NATIVE_PAINT_FIELD_SCALE = freeze({
  units: 'm', calibratedAgainstRealPaint: false,
  fieldInterpretation: 'Authored enamel appearance derivative of R08; no corrosion, exposure, rust or aging phase is present.',
  originalColor: {latticeFrequenciesPerM: [3.1, 6.603, 12.927],
    latticeSpacingsM: [1 / 3.1, 1 / 6.603, 1 / 12.927], octaveWeights: [0.57, 0.28, 0.15],
    multiplierRange: [0.94, 1.03], active: false,
    interpretation: 'Removed uncalibrated macro albedo modulation; not established enamel microstructure.'},
  color: {multiplier: 1, authoredColorPreserved: true},
  originalRoughness: {latticeFrequencyPerM: 9, latticeSpacingM: 1 / 9,
    additiveRange: [-0.06, 0.06], active: false},
  roughness: {latticeFrequencyPerM: 65, latticeSpacingM: 1 / 65,
    additiveRange: [-0.006, 0.006], finalClamp: [0.08, 0.99],
    interpretation: 'Small dimensionless roughness variation using the same locked kn kernel; the design lattice is 15.38 mm, not a measured paint grain.'},
  normal: {latticeFrequencyPerM: 65, latticeSpacingM: 1 / 65,
    heightCoefficientM: 0.000020, ungatedHeightRangeM: [-0.000010, 0.000010],
    footprintFadeM: [0.4 / 65, 1.6 / 65],
    interpretation: 'Unchanged footprint-filtered normal microheight. The 20 micrometre design coefficient is not measured paint relief.'},
});

export const NATIVE_MATERIAL_ALIASES = freeze({
  paint: 'body-green', blackPaint: 'black-painted-steel',
  brushedMetal: 'polished-rod-steel', glass: 'window-glass',
  interior: 'interior-cream', rubber: 'matte-black-dielectric',
  'black-coated-steel': 'black-painted-steel', 'linkage-polished': 'polished-rod-steel',
});
export function resolveNativeMaterialRecipe(recipeId) {
  const resolved = Object.hasOwn(NATIVE_MATERIAL_ALIASES, recipeId) ? NATIVE_MATERIAL_ALIASES[recipeId] : recipeId;
  if (!Object.hasOwn(NATIVE_MATERIAL_RECIPES, resolved)) throw new Error('Unknown explicit native material recipe: ' + recipeId);
  return resolved;
}

const ZERO_STATE = Object.freeze({wear: 0, history: 0, wet: 0, repair: 0, mode: 0});
const DOMAIN_ASSIGNMENTS = Object.freeze({
  metal: ['vRestM=(modelMatrix*vec4(position,1.)).xyz-uOrigin;vSurfaceN=normalize(mat3(modelMatrix)*normal);',
    'vRestM=(uNativeRestMetres*vec4(position,1.)).xyz;vSurfaceN=normalize(uNativeRestNormal*normal);'],
  paint: ['vKP=mix(position,(kpDomain*modelMatrix*kpos).xyz,kpUseDomain);vKN=mix(normal,mat3(kpDomain*modelMatrix)*knorm,kpUseDomain);',
    'vKP=(uNativeRestMetres*kpos).xyz;vKN=normalize(uNativeRestNormal*knorm);'],
  glass: ['wgGlassPosition=position;', 'wgGlassPosition=(uNativeRestMetres*vec4(position,1.)).xyz;'],
});

function requireRevision(T) {
  if (String(T?.REVISION) !== NATIVE_MASTER_RELEASE.threeRevision) {
    throw new Error('Native materials require locked Three r170; a different revision needs independent shader validation.');
  }
}
function recipeFor(recipeId) {
  return NATIVE_MATERIAL_RECIPES[resolveNativeMaterialRecipe(recipeId)];
}
function restDomain(T, {restMatrix, units} = {}) {
  if (units !== 'm') throw new Error('Native material units must explicitly be m (designed metres, not full-train measurement certification).');
  const a = restMatrix?.isMatrix4 ? restMatrix.toArray() : Array.isArray(restMatrix) ? [...restMatrix] : null;
  if (!a || a.length !== 16 || a.some(x => !Number.isFinite(x))) {
    throw new Error('Supply an explicit fixed native restMatrix with 16 finite column-major values.');
  }
  const near = (x, y) => Math.abs(x - y) <= 1e-7;
  if (![3, 7, 11].every(i => near(a[i], 0)) || !near(a[15], 1)) throw new Error('Native restMatrix must be affine.');
  const basis = [[a[0], a[1], a[2]], [a[4], a[5], a[6]], [a[8], a[9], a[10]]];
  const dot = (u, v) => u.reduce((sum, x, i) => sum + x * v[i], 0);
  if (!basis.every(v => near(dot(v, v), 1)) || !near(dot(basis[0], basis[1]), 0) ||
      !near(dot(basis[0], basis[2]), 0) || !near(dot(basis[1], basis[2]), 0)) {
    throw new Error('Native restMatrix must preserve metre lengths; bake designed dimensions into native geometry, not a material-domain scale.');
  }
  const matrix = new T.Matrix4().fromArray(a);
  if (!near(matrix.determinant(), 1)) throw new Error('Native restMatrix must be a right-handed rigid rest frame.');
  return {matrix, normal: new T.Matrix3().getNormalMatrix(matrix), record: freeze({
    units: 'm', status: 'designed-metres', referenceScale: 1, matrixColumnMajor: [...a],
    evidence: 'Caller supplies native mesh-local metres to a fixed authored rest frame. This is a design-unit contract, not evidence that every train dimension is measured.',
    fixedRestDomain: true, worldMovementAffectsPattern: false, geometryScaled: false,
    physicalCertification: false, wholeTrainDimensionsVerified: false,
  })};
}
function disposeFactoryScaffold(group, keep) {
  const geometries = new Set(), materials = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) if (material !== keep) material.dispose();
  group.clear();
}
function makePaintTemplate(T) {
  // The factory creates a demonstration family. Only its real paint material is
  // retained; all other materials and supplied demonstration geometries are freed.
  const family = createTrainMatter(T), keep = family.paint;
  for (const value of new Set(Object.values(family))) {
    if (value !== keep && (value?.isMaterial || value?.isBufferGeometry)) value.dispose();
  }
  return keep;
}
function makeGlassTemplate(T) {
  const group = buildGlassCase(T, {variant: 0, wear: 0, strength: 0, mode: 0,
    thickness: GLASS_RECIPE.thickness, compareThickness: GLASS_RECIPE.thickness});
  const keep = group.userData.materials[0];
  disposeFactoryScaffold(group, keep);
  return keep;
}
function cloneFactoryMaterial(T, template) {
  const material = template.clone(), original = template.onBeforeCompile.bind(template);
  const ownUniforms = template.userData.uniforms ? T.UniformsUtils.clone(template.userData.uniforms) : null;
  material.onBeforeCompile = shader => {
    original(shader);
    if (ownUniforms) Object.assign(shader.uniforms, ownUniforms);
  };
  material.customProgramCacheKey = template.customProgramCacheKey.bind(template);
  if (ownUniforms) material.userData.uniforms = ownUniforms;
  return material;
}
function applyNativePaintTransport(material) {
  const original = material.onBeforeCompile.bind(material), originalKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = shader => {
    original(shader);
    for (const [before, after] of NATIVE_PAINT_SUBSTITUTIONS) {
      if (shader.fragmentShader.split(before).length !== 2) {
        throw new Error('Locked R08 native paint substitution drift: ' + before);
      }
      shader.fragmentShader = shader.fragmentShader.replace(before, after);
    }
  };
  material.customProgramCacheKey = () => originalKey() + '|' + NATIVE_PAINT_TRANSPORT_VERSION;
}
function makeAuthoredMetal(T, recipe) {
  const material = makeMetalMaterial(T, {family: 'sign', variant: 0, origin: [0, 0, 0],
    state: {...ZERO_STATE}, jointOrigins: []});
  const color = new T.Color().setStyle(recipe.colorSRGB, T.SRGBColorSpace);
  const uniforms = material.userData.uniforms;
  Object.assign(uniforms, {
    uTrainSourceColor: {value: new T.Vector3(color.r, color.g, color.b)},
    uTrainSourceMetallic: {value: recipe.metalness},
    uTrainSourceRoughness: {value: recipe.roughness},
    uTrainRoughnessMin: {value: 0}, uTrainRoughnessMax: {value: 1},
    uTrainMicroReliefM: {value: recipe.microReliefM},
  });
  const original = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = shader => {
    original(shader);
    if (!shader.fragmentShader.startsWith(METAL_FIELDS)) throw new Error('Locked R06 factory field changed.');
    shader.fragmentShader = PARAMETERIZED_METAL_FIELDS + shader.fragmentShader.slice(METAL_FIELDS.length);
  };
  material.customProgramCacheKey = () => SOURCE_RECIPE_VERSION + '|native-authored';
  material.userData.update = () => { throw new Error('Native recipe weathering and diagnostic updates are locked off; no inferred rust, oil or wear.'); };
  return material;
}
function wrapRestDomain(material, domain, family, audit) {
  const original = material.onBeforeCompile.bind(material), originalKey = material.customProgramCacheKey.bind(material);
  const [before, after] = DOMAIN_ASSIGNMENTS[family];
  material.onBeforeCompile = shader => {
    original(shader);
    if (shader.vertexShader.split(before).length !== 2) throw new Error('Locked ' + family + ' vertex assignment drift; review native rest wrapper.');
    if (family === 'metal' && !shader.fragmentShader.startsWith(PARAMETERIZED_METAL_FIELDS)) throw new Error('Locked parameterized R06 field drift.');
    if (family === 'paint' && shader.uniforms.fh88FinishReliefM?.value !== 0.000020) throw new Error('Locked R08 paint relief drift.');
    shader.uniforms.uNativeRestMetres = {value: domain.matrix};
    shader.uniforms.uNativeRestNormal = {value: domain.normal};
    shader.vertexShader = 'uniform mat4 uNativeRestMetres;uniform mat3 uNativeRestNormal;\n' + shader.vertexShader.replace(before, after);
    audit.shaderHookExecuted = true;
  };
  material.customProgramCacheKey = () => originalKey() + '|' + NATIVE_MATERIAL_VERSION + '|fixed-native-metres';
}

/** Allocate a small reusable factory pool; no original model data is accepted. */
export function createNativeMaterialLibrary(T) {
  requireRevision(T);
  let paintTemplate = null, glassTemplate = null, disposed = false;
  const materials = new Set();
  function create(recipeId, options = {}) {
    if (disposed) throw new Error('Native material library has been disposed.');
    const requestedRole = recipeId;
    recipeId = resolveNativeMaterialRecipe(recipeId);
    const recipe = recipeFor(recipeId), domain = restDomain(T, options);
    let material;
    if (recipe.family === 'metal') material = makeAuthoredMetal(T, recipe);
    else if (recipe.family === 'paint') {
      material = cloneFactoryMaterial(T, paintTemplate ??= makePaintTemplate(T));
      applyNativePaintTransport(material);
    }
    else material = cloneFactoryMaterial(T, glassTemplate ??= makeGlassTemplate(T));
    material.name = recipe.label + ' · ' + NATIVE_MATERIAL_VERSION;
    material.color.setStyle(recipe.colorSRGB, T.SRGBColorSpace);
    material.metalness = recipe.metalness;
    material.roughness = recipe.roughness;
    material.envMapIntensity = recipe.envMapIntensity;
    material.side = T.FrontSide;
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
    if (recipe.family === 'paint') {
      material.clearcoat = recipe.clearcoat;
      material.clearcoatRoughness = recipe.clearcoatRoughness;
      material.userData.provenance = {...material.userData.provenance,
        factoryFinish: material.userData.provenance?.finish,
        finish: {metalness: recipe.metalness, roughness: recipe.roughness, clearcoat: recipe.clearcoat, clearcoatRoughness: recipe.clearcoatRoughness},
        normalReliefMeasured: false, domainUnits: 'designed metres'};
    }
    if (recipe.family === 'glass') {
      // The factory's original demonstration-pane dimensions are not evidence
      // about the caller's geometry. Explicitly discard that inherited claim.
      delete material.userData.physicalThicknessM;
      material.userData.opticalThicknessM = recipe.thicknessM;
      material.userData.physicalGeometryVerified = false;
      material.userData.uniforms.wgWear.value = 0;
      material.userData.uniforms.wgStrength.value = 0;
      material.userData.uniforms.wgVariant.value = 0;
    }
    const audit = {
      version: NATIVE_MATERIAL_VERSION, release: {...NATIVE_MASTER_RELEASE}, recipeId, requestedRole,
      recipe: structuredClone(recipe), factory: NATIVE_MASTER_RELEASE[recipe.family + 'Factory'],
      recipeOrigin: 'first-party authored semantic recipe, not original-model matching',
      domain: domain.record, actualMasterFactoryCalled: true,
      shaderHookExecuted: false, actualWebGLCompileValidated: false, visualAcceptance: false,
      geometryChanged: false, physicalCertification: false,
      paintTransport: recipe.family === 'paint' ? structuredClone(NATIVE_PAINT_TRANSPORT) : null,
      paintFieldScale: recipe.family === 'paint' ? structuredClone(NATIVE_PAINT_FIELD_SCALE) : null,
      microReliefMeasured: false, weathering: {...ZERO_STATE, variant: 0, inferredRust: false, inferredOil: false},
      fragmentPolicy: recipe.family === 'metal' ? 'Existing locked eight-substitution R06 parameterization; original vendor untouched.' : recipe.family === 'paint' ? 'Declared native-only two-substitution R08 derivative; vendor, original normal microheight and BRDF unchanged. Not original fragment equality.' : 'Original R03 glass factory fragment callback unchanged.',
      glassLimits: recipe.family === 'glass' ? {
        recipeStatus: GLASS_RECIPE.status, opticalThicknessM: recipe.thicknessM,
        nativePaneClosednessVerified: false, nativePaneThicknessVerified: false,
        limitation: GLASS_RECIPE.limitations,
      } : null,
    };
    material.userData.nativeMaster = audit;
    wrapRestDomain(material, domain, recipe.family, audit);
    material.needsUpdate = true;
    materials.add(material);
    return material;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const material of materials) material.dispose();
    materials.clear();
    paintTemplate?.dispose();
    glassTemplate?.dispose();
  }
  return {version: NATIVE_MATERIAL_VERSION, create, dispose};
}

/** Convenience single material; dispose() also frees its isolated factory pool. */
export function createNativeMaterial(T, recipeId, options) {
  const library = createNativeMaterialLibrary(T);
  let material;
  try { material = library.create(recipeId, options); }
  catch (error) { library.dispose(); throw error; }
  const originalDispose = material.dispose.bind(material);
  let disposed = false;
  material.dispose = () => {
    if (disposed) return;
    disposed = true;
    originalDispose();
    library.dispose();
  };
  return material;
}

/**
 * Explicit binding or mesh.userData.nativeMaterial = {recipe, restMatrix}.
 * root is the native train group only. Other scene content is not traversed.
 * All meshes must declare semantics unless options.bindings explicitly narrows
 * the target list. Current matrixWorld is NEVER used as an implicit rest pose.
 */
export function installNativeMaterials(T, root, options = {}) {
  requireRevision(T);
  if (!root?.traverse) throw new Error('A native train root is required.');
  const declared = options.bindings ?? [];
  if (!Array.isArray(declared)) throw new Error('bindings must be an explicit array.');
  const bindings = options.bindings ? [...declared] : [];
  if (!options.bindings) root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const semantic = mesh.userData?.nativeMaterial;
    if (!semantic || typeof semantic !== 'object') throw new Error('Missing explicit nativeMaterial semantics for mesh ' + mesh.name);
    bindings.push({mesh, ...semantic});
  });
  const members = new Set(); root.traverse(object => members.add(object));
  const selected = new Set();
  // Validate everything before creating any candidates or touching assignments.
  for (const binding of bindings) {
    const {mesh, recipe, restMatrix} = binding;
    if (!mesh?.isMesh || !members.has(mesh) || mesh.isInstancedMesh || mesh.isSkinnedMesh) {
      throw new Error('Native material binding requires an ordinary non-instanced, non-skinned mesh inside the native root.');
    }
    if (selected.has(mesh)) throw new Error('Duplicate native mesh material binding.');
    selected.add(mesh);
    if (Array.isArray(mesh.material)) throw new Error('Native multi-material geometry needs explicit separate meshes; no implicit slot guesses.');
    recipeFor(recipe);
    restDomain(T, {restMatrix, units: options.units});
  }
  const library = createNativeMaterialLibrary(T), assignments = [], records = [];
  try {
    for (const binding of bindings) {
      const {mesh, recipe, restMatrix} = binding;
      const material = library.create(recipe, {restMatrix, units: options.units});
      assignments.push({mesh, before: mesh.material, after: material});
      material.userData.nativeMaster.meshName = mesh.name;
      records.push(material.userData.nativeMaster);
    }
  } catch (error) { library.dispose(); throw error; }
  for (const assignment of assignments) assignment.mesh.material = assignment.after;
  let disposed = false;
  return {
    version: NATIVE_MATERIAL_VERSION, records,
    geometryChanged: false, visualAcceptance: false, physicalCertification: false,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const assignment of assignments) if (assignment.mesh.material === assignment.after) assignment.mesh.material = assignment.before;
      library.dispose();
    },
  };
}

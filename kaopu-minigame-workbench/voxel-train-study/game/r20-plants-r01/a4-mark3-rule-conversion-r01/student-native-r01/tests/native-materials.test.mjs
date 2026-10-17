import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../../../a4-a6-source-comparison-r03/vendor/three.module.js';
import {createNativeMaterial, createNativeMaterialLibrary, installNativeMaterials,
  NATIVE_MATERIAL_VERSION, NATIVE_MASTER_RELEASE, NATIVE_MATERIAL_RECIPES,
  NATIVE_MATERIAL_ALIASES, resolveNativeMaterialRecipe,
  NATIVE_PAINT_SUBSTITUTIONS, NATIVE_PAINT_TRANSPORT, NATIVE_PAINT_FIELD_SCALE} from '../src/native-materials.mjs';
import {createTrainMatter} from '../../master-materials-v3-1/vendor/train-r08/materials/matter.mjs';
import {buildGlassCase, GLASS_RECIPE} from '../../master-materials-v3-1/vendor/material-master-r03/wood-glass.mjs';
import {PARAMETERIZED_METAL_FIELDS} from '../../master-materials-v3-1/r06-source-parameters.mjs';

const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const report = {
  schema: 'kaopu.student-native-materials-tests/1', adapterVersion: NATIVE_MATERIAL_VERSION,
  engineRevision: T.REVISION, originalModelGeometryLoaded: false,
  tests: [], recipeChecks: [], javascriptFactoryAndShaderHooksPassed: false,
  actualWebGLCompileValidated: false, visualAcceptance: false, physicalCertification: false,
};
const identity = () => new T.Matrix4();
function compileHook(material) {
  const lib = material.isMeshPhysicalMaterial ? T.ShaderLib.physical : T.ShaderLib.standard;
  const shader = {uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader};
  material.onBeforeCompile(shader);
  return shader;
}
function materialTest(name, fn) {
  test(name, () => { fn(); report.tests.push({name, passed: true}); });
}
function disposeFamily(family) {
  for (const value of new Set(Object.values(family))) if (value?.isMaterial || value?.isBufferGeometry) value.dispose();
}
function geometrySnapshot(geometry) {
  const snapshot = {uuid: geometry.uuid, index: geometry.index, attributes: {}, groups: JSON.stringify(geometry.groups), userData: JSON.stringify(geometry.userData)};
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    snapshot.attributes[name] = {reference: attribute, array: attribute.array, hash: hash(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)), version: attribute.version};
  }
  if (geometry.index) snapshot.indexHash = hash(Buffer.from(geometry.index.array.buffer, geometry.index.array.byteOffset, geometry.index.array.byteLength));
  return snapshot;
}
function assertGeometryUnchanged(geometry, snapshot) {
  assert.equal(geometry.uuid, snapshot.uuid);
  assert.equal(geometry.index, snapshot.index);
  assert.equal(JSON.stringify(geometry.groups), snapshot.groups);
  assert.equal(JSON.stringify(geometry.userData), snapshot.userData);
  assert.deepEqual(Object.keys(geometry.attributes), Object.keys(snapshot.attributes));
  for (const [name, old] of Object.entries(snapshot.attributes)) {
    const now = geometry.attributes[name];
    assert.equal(now, old.reference); assert.equal(now.array, old.array); assert.equal(now.version, old.version);
    assert.equal(hash(Buffer.from(now.array.buffer, now.array.byteOffset, now.array.byteLength)), old.hash);
  }
  if (geometry.index) assert.equal(hash(Buffer.from(geometry.index.array.buffer, geometry.index.array.byteOffset, geometry.index.array.byteLength)), snapshot.indexHash);
}

materialTest('locked v3.1 and all original vendor bytes are unchanged', () => {
  const base = new URL('../../master-materials-v3-1/', import.meta.url);
  const lock = JSON.parse(fs.readFileSync(new URL('runtime-lock.json', base)));
  for (const file of lock.files) assert.equal(hash(fs.readFileSync(new URL(file.path, base))), file.sha256, file.path);
  assert.equal(lock.releaseCommit, NATIVE_MASTER_RELEASE.commit);
  assert.equal(T.REVISION, NATIVE_MASTER_RELEASE.threeRevision);
  report.lockedFileCount = lock.files.length;
  report.lockedRelease = lock.releaseCommit;
});

materialTest('every explicit recipe calls a real locked factory and carries designed-metre limits', () => {
  const library = createNativeMaterialLibrary(T);
  for (const [id, recipe] of Object.entries(NATIVE_MATERIAL_RECIPES)) {
    const material = library.create(id, {units: 'm', restMatrix: identity()});
    const audit = material.userData.nativeMaster, shader = compileHook(material);
    assert.equal(audit.actualMasterFactoryCalled, true);
    assert.equal(audit.shaderHookExecuted, true);
    assert.equal(audit.actualWebGLCompileValidated, false);
    assert.equal(audit.visualAcceptance, false); assert.equal(audit.physicalCertification, false);
    assert.equal(audit.domain.status, 'designed-metres');
    assert.equal(audit.domain.wholeTrainDimensionsVerified, false);
    assert.equal(audit.domain.geometryScaled, false);
    assert.equal(material.color.getHexString(T.SRGBColorSpace), recipe.colorSRGB.slice(1));
    assert.equal(material.metalness, recipe.metalness); assert.equal(material.roughness, recipe.roughness);
    assert.equal(material.side, T.FrontSide); assert.equal(material.map, null);
    assert(shader.vertexShader.includes('uniform mat4 uNativeRestMetres;'));
    assert.deepEqual(shader.uniforms.uNativeRestMetres.value.toArray(), identity().toArray());
    if (recipe.family === 'metal') {
      assert(shader.fragmentShader.startsWith(PARAMETERIZED_METAL_FIELDS));
      const u = shader.uniforms, color = new T.Color(recipe.colorSRGB);
      assert.deepEqual(u.uTrainSourceColor.value.toArray(), color.toArray());
      assert.equal(u.uTrainSourceMetallic.value, recipe.metalness);
      assert.equal(u.uTrainSourceRoughness.value, recipe.roughness);
      assert.equal(u.uTrainMicroReliefM.value, recipe.microReliefM);
      for (const key of ['uWear', 'uHistory', 'uWet', 'uRepair', 'uVariant', 'uRack', 'uJointCount']) assert.equal(u[key].value, 0);
      assert.equal(u.uTrainRoughnessMin.value, 0); assert.equal(u.uTrainRoughnessMax.value, 1);
      assert.throws(() => material.userData.update({wear: 1}), /locked off/);
    } else if (recipe.family === 'paint') {
      assert.equal(shader.uniforms.fh88FinishReliefM.value, 0.000020);
      assert.equal(material.clearcoat, recipe.clearcoat);
      assert.equal(material.clearcoatRoughness, recipe.clearcoatRoughness);
      assert.equal(material.userData.provenance.finish.clearcoat, material.clearcoat);
    } else {
      assert.equal(material.transmission, GLASS_RECIPE.transmission);
      assert.equal(material.ior, GLASS_RECIPE.ior);
      assert.equal(material.thickness, GLASS_RECIPE.thickness);
      assert.equal(material.attenuationDistance, GLASS_RECIPE.attenuationDistance);
      assert.equal(material.userData.physicalThicknessM, undefined);
      assert.equal(audit.glassLimits.nativePaneClosednessVerified, false);
      assert.equal(audit.glassLimits.nativePaneThicknessVerified, false);
      for (const key of ['wgWear', 'wgStrength', 'wgVariant']) assert.equal(shader.uniforms[key].value, 0);
    }
    report.recipeChecks.push({id, family: recipe.family, colorSRGB: recipe.colorSRGB, metalness: recipe.metalness, roughness: recipe.roughness, factory: audit.factory});
  }
  library.dispose();
});

materialTest('native R08 paint uses exactly two guarded edits; original normal code and R03 glass remain exact', () => {
  const factory = createTrainMatter(T), rawPaint = compileHook(factory.paint);
  const glassCase = buildGlassCase(T, {variant: 0, wear: 0, strength: 0, mode: 0,
    thickness: GLASS_RECIPE.thickness, compareThickness: GLASS_RECIPE.thickness});
  const rawGlass = compileHook(glassCase.userData.materials[0]);
  const library = createNativeMaterialLibrary(T);
  for (const [id, recipe] of Object.entries(NATIVE_MATERIAL_RECIPES)) {
    const material = library.create(id, {units: 'm', restMatrix: identity()});
    const shader = compileHook(material);
    if (recipe.family === 'paint') {
      let expected = rawPaint.fragmentShader;
      for (const [before, after] of NATIVE_PAINT_SUBSTITUTIONS) {
        assert.equal(expected.split(before).length - 1, 1, 'Exactly one guarded occurrence');
        expected = expected.replace(before, after);
      }
      assert.equal(shader.fragmentShader, expected, id);
      assert.notEqual(shader.fragmentShader, rawPaint.fragmentShader);
      assert(!shader.fragmentShader.includes('diffuseColor.rgb*=.94+.09*kp;'));
      assert(!shader.fragmentShader.includes('kn(kq*9.)'));
      assert(shader.fragmentShader.includes('(kn(kq*65.)-.5)*.012'));
      const normalCode = source => source.slice(source.indexOf('float footprint=length(fwidth(kq))*65.;'), source.indexOf('#include <clearcoat_normal_fragment_begin>'));
      assert(normalCode(rawPaint.fragmentShader).length > 100);
      assert.equal(normalCode(shader.fragmentShader), normalCode(rawPaint.fragmentShader));
      assert.equal(material.userData.nativeMaster.paintTransport.substitutionCount, 2);
      assert.equal(material.userData.nativeMaster.paintTransport.fragmentByteIdentical, false);
      assert.equal(material.userData.nativeMaster.paintFieldScale.roughness.latticeFrequencyPerM, 65);
      report.nativePaintFragmentSha256 = hash(shader.fragmentShader);
    }
    if (recipe.family === 'glass') assert.equal(shader.fragmentShader, rawGlass.fragmentShader, id);
  }
  report.originalPaintFragmentSha256 = hash(rawPaint.fragmentShader);
  assert.equal(report.originalPaintFragmentSha256, NATIVE_PAINT_TRANSPORT.originalR170HookFragmentSha256);
  report.nativePaintSubstitutionCount = NATIVE_PAINT_SUBSTITUTIONS.length;
  report.nativePaintOriginalFragmentEquality = false;
  report.nativePaintNormalAndBrdfPreserved = true;
  report.nativePaintFieldScale = structuredClone(NATIVE_PAINT_FIELD_SCALE);
  report.glassFragmentSha256 = hash(rawGlass.fragmentShader);
  report.parameterizedMetalFieldSha256 = hash(PARAMETERIZED_METAL_FIELDS);
  library.dispose(); disposeFamily(factory); glassCase.userData.dispose();
});

materialTest('native aliases are explicit and unknown roles fail without grey fallback', () => {
  const library = createNativeMaterialLibrary(T);
  for (const [alias, id] of Object.entries(NATIVE_MATERIAL_ALIASES)) {
    assert.equal(resolveNativeMaterialRecipe(alias), id);
    const material = library.create(alias, {units: 'm', restMatrix: identity()});
    assert.equal(material.userData.nativeMaster.recipeId, id);
    assert.equal(material.userData.nativeMaster.requestedRole, alias);
  }
  assert.throws(() => library.create('unmapped-source-part', {units: 'm', restMatrix: identity()}), /Unknown explicit/);
  assert.match(NATIVE_MATERIAL_RECIPES['matte-black-dielectric'].rationale, /no dedicated locked rubber mother/);
  library.dispose();
});

materialTest('metre domain must be explicit rigid right-handed rest frame; no inferred calibration', () => {
  const library = createNativeMaterialLibrary(T);
  assert.throws(() => library.create('paint', {restMatrix: identity()}), /explicitly be m/);
  assert.throws(() => library.create('paint', {units: 'm'}), /explicit fixed native restMatrix/);
  assert.throws(() => library.create('paint', {units: 'm', restMatrix: new T.Matrix4().makeScale(2, 2, 2)}), /preserve metre/);
  assert.throws(() => library.create('paint', {units: 'm', restMatrix: new T.Matrix4().makeScale(-1, 1, 1)}), /right-handed/);
  const nan = identity().toArray(); nan[0] = NaN;
  assert.throws(() => library.create('paint', {units: 'm', restMatrix: nan}), /16 finite/);
  assert.throws(() => createNativeMaterialLibrary({...T, REVISION: '171'}), /locked Three r170/);
  const matrix = new T.Matrix4().makeRotationY(0.5).setPosition(1.2, 2.5, -3.7), saved = matrix.toArray();
  const material = library.create('brushedMetal', {units: 'm', restMatrix: matrix});
  const shader = compileHook(material);
  matrix.makeTranslation(800, 900, 1000);
  assert.deepEqual(shader.uniforms.uNativeRestMetres.value.toArray(), saved);
  assert.deepEqual(material.userData.nativeMaster.domain.matrixColumnMajor, saved);
  assert.deepEqual(shader.uniforms.uNativeRestNormal.value.toArray(), new T.Matrix3().getNormalMatrix(new T.Matrix4().fromArray(saved)).toArray());
  library.dispose();
});

materialTest('binding changes only material references; position, normal, UV, indices and authored semantics remain exact', () => {
  const root = new T.Group(), originals = [], geometryRecords = [];
  for (const [i, role] of ['paint', 'blackPaint', 'glass', 'rubber', 'brushedMetal', 'interior'].entries()) {
    const geometry = new T.BoxGeometry(1.2, 0.5, role === 'glass' ? 0.014 : 0.2);
    geometry.userData = {nativeDesign: true, units: 'm'};
    const old = new T.MeshBasicMaterial({color: 0xff00ff}), mesh = new T.Mesh(geometry, old);
    mesh.name = 'native-part-' + i; mesh.position.set(i, 0.2, 0.3);
    const restMatrix = new T.Matrix4().makeTranslation(i, 0.2, 0.3).toArray();
    mesh.userData.nativeMaterial = {recipe: role, restMatrix};
    root.add(mesh); originals.push({mesh, material: old, geometry, position: mesh.position.toArray(), userData: JSON.stringify(mesh.userData)});
    geometryRecords.push(geometrySnapshot(geometry));
  }
  const outside = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  const api = installNativeMaterials(T, root, {units: 'm'});
  assert.equal(api.records.length, 6);
  for (const [i, old] of originals.entries()) {
    assert.notEqual(old.mesh.material, old.material);
    assert.equal(old.mesh.geometry, old.geometry); assertGeometryUnchanged(old.geometry, geometryRecords[i]);
    assert.deepEqual(old.mesh.position.toArray(), old.position);
    assert.equal(JSON.stringify(old.mesh.userData), old.userData);
    compileHook(old.mesh.material); assert.equal(api.records[i].shaderHookExecuted, true);
  }
  assert.equal(outside.material.isMeshBasicMaterial, true);
  const captured = api.records.map(record => structuredClone(record.domain));
  root.position.set(30, 40, 50); root.rotation.set(0.4, 0.9, 0.2); root.updateMatrixWorld(true);
  for (const old of originals) compileHook(old.mesh.material);
  assert.deepEqual(api.records.map(record => record.domain), captured);
  api.dispose(); api.dispose();
  for (const [i, old] of originals.entries()) {
    assert.equal(old.mesh.material, old.material); assertGeometryUnchanged(old.geometry, geometryRecords[i]);
    old.material.dispose(); old.geometry.dispose();
  }
  outside.geometry.dispose(); outside.material.dispose();
});

materialTest('missing semantics and invalid batch fail transactionally without material replacement', () => {
  const root = new T.Group(), material = new T.MeshBasicMaterial(), mesh = new T.Mesh(new T.BoxGeometry(), material);
  root.add(mesh);
  assert.throws(() => installNativeMaterials(T, root, {units: 'm'}), /Missing explicit/);
  assert.equal(mesh.material, material);
  mesh.userData.nativeMaterial = {recipe: 'paint', restMatrix: identity().toArray()};
  const second = new T.Mesh(new T.BoxGeometry(), material); root.add(second);
  second.userData.nativeMaterial = {recipe: 'invalid', restMatrix: identity().toArray()};
  assert.throws(() => installNativeMaterials(T, root, {units: 'm'}), /Unknown explicit/);
  assert.equal(mesh.material, material); assert.equal(second.material, material);
  const api = installNativeMaterials(T, root, {units: 'm', bindings: [{mesh, recipe: 'paint', restMatrix: identity()}]});
  assert.equal(second.material, material); api.dispose();
  mesh.geometry.dispose(); second.geometry.dispose(); material.dispose();
});

materialTest('independent clones do not share mutable glass uniforms and disposal is bounded', () => {
  const library = createNativeMaterialLibrary(T);
  const a = library.create('glass', {units: 'm', restMatrix: identity()}), b = library.create('glass', {units: 'm', restMatrix: identity()});
  assert.notEqual(a.userData.uniforms, b.userData.uniforms);
  assert.notEqual(a.userData.uniforms.wgHalfSize.value, b.userData.uniforms.wgHalfSize.value);
  let aDisposed = 0; a.addEventListener('dispose', () => aDisposed++);
  library.dispose(); library.dispose(); assert.equal(aDisposed, 1);
  assert.throws(() => library.create('paint', {units: 'm', restMatrix: identity()}), /disposed/);
  const single = createNativeMaterial(T, 'paint', {units: 'm', restMatrix: identity()});
  let singleDisposed = 0; single.addEventListener('dispose', () => singleDisposed++);
  single.dispose(); single.dispose(); assert.equal(singleDisposed, 1);
});

materialTest('native adapter has no original-model binding, loader, fetch, texture or geometry payload dependency', () => {
  const code = fs.readFileSync(new URL('../src/native-materials.mjs', import.meta.url), 'utf8');
  for (const blocked of ['source-semantic-bindings.mjs', 'train-binding.mjs', 'GLTFLoader', 'parser.associations', 'fetch(', 'source-assets/', '.residual.']) assert.equal(code.includes(blocked), false, blocked);
  const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map(match => match[1]);
  assert.equal(imports.length, 4);
  assert(imports.every(path => path.startsWith('../../master-materials-v3-1/')));
});

test.after(() => {
  report.javascriptFactoryAndShaderHooksPassed = report.tests.length === 9;
  const out = new URL('../qa/native-materials-verification.json', import.meta.url);
  fs.mkdirSync(new URL('../qa/', import.meta.url), {recursive: true});
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
});

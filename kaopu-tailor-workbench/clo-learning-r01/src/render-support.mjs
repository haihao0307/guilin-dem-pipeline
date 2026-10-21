import {CommonSkinLayer} from '../vendor/CommonSkinLayer.mjs';

/** Native S03/r0434 neutral person and original skin, with no mesh replacement.
 * The frozen coordinates are Z-up metres. The original CommonViewer maps
 * [native X, native Y, native Z] to [X, Z, -Y]. We retain that exact mapping.
 * The solver's original ground shift belongs to the garment display adapter;
 * it must not be applied a second time to this native body.
 */
export function createNativeBody(THREE, frozenPerson, requestRender = () => {}) {
  if (!frozenPerson || !Number.isInteger(frozenPerson.vertexCount)) {
    throw new Error('原人物冻结数据无效。');
  }
  const count = frozenPerson.vertexCount;
  if (frozenPerson.positions?.length !== count * 3 || frozenPerson.faces?.length % 3) {
    throw new Error('原人物几何尺寸与冻结清单不符。');
  }
  const positions = Float32Array.from(frozenPerson.positions);
  if (!positions.every(Number.isFinite)) throw new Error('原人物坐标含无效数值。');
  if (!frozenPerson.faces?.every(i => Number.isInteger(i) && i >= 0 && i < count)) {
    throw new Error('原人物面索引无效。');
  }
  const faces = Uint32Array.from(frozenPerson.faces);
  const model = {...frozenPerson, positions, faces};
  const displayPositions = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    displayPositions[i] = positions[i];
    displayPositions[i + 1] = positions[i + 2];
    displayPositions[i + 2] = -positions[i + 1];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(displayPositions, 3));
  geometry.setIndex(new THREE.BufferAttribute(faces, 1));
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(0xbab3a5);
  for (let i = 0; i < count; i++) colors.set([base.r, base.g, base.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const originalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .72, metalness: 0, side: THREE.FrontSide
  });
  const mesh = new THREE.Mesh(geometry, originalMaterial);
  mesh.name = 'original-r0434-native-person';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const viewer = {
    model, geometry, mesh, material: originalMaterial, displayPositions,
    wire: false, band: false, render: () => requestRender()
  };
  const skin = new CommonSkinLayer(viewer);
  viewer.skin = skin;
  mesh.userData = {
    source: 'original common person r0434-8c8245dd87e5',
    geometrySHA256: 'fbc056553c1731b790769124bee121554f0800400271eaf564a0ad5e6f458571',
    topologySHA256: 'e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de',
    originalIndicesRetained: true,
    coordinateMapping: '[X,Z,-Y] metres; original orientation mapping only',
    bodyScaling: false, sourceFrozenPose: true
  };
  return {mesh, geometry, skin, model, viewer, dispose() {
    skin.dispose();
    originalMaterial.dispose();
    geometry.dispose();
  }};
}

// Exact default nativeGarmentMesh appearance from the r0434 source. These
// display values do not replace the digital-muslin physical material in spec.
export const NATIVE_CLOTH_APPEARANCE = Object.freeze({
  color: 0xc6b591, roughness: .82, side: 'DoubleSide'
});

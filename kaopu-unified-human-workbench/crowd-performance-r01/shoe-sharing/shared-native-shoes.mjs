import * as T from 'three';

// The caller supplies an original R14 buildStyle result and initialized native
// StyleMaterials. Share only a fixed (style, size, thickness, bend, appearance)
// recipe. This does not add a footwear physics solver or modify any geometry.
export function prepareSharedNativeShoe(nativeModel, nativeMaterials) {
  const {style, parts} = nativeModel;
  const resources = parts.map(part => {
    const roles = part.geometry.groups.length
      ? (['rubber', 'elastic', 'webbing', 'edge', 'metal'].includes(part.role)
        ? [part.role, part.role, part.role] : [part.role, 'lining', 'cut'])
      : [part.role];
    const materials = roles.map(role => {
      const material = nativeMaterials.get(role, style, {clay: false, wire: false});
      // Same default, unsectioned construction as R14 main.mjs applyClip.
      material.clippingPlanes = [];
      material.clipShadows = false;
      return material;
    });
    return {part, styleId: style.id, geometry: part.geometry,
      material: part.geometry.groups.length ? materials : materials[0]};
  });
  const active = new Set();
  let disposed = false;
  function create({name = style.id, mirror = false} = {}) {
    if (disposed) throw new Error('Shared shoe resource is disposed.');
    const shoe = new T.Group();
    shoe.name = name;
    shoe.scale.set(mirror ? -.001 : .001, .001, .001);
    for (const {part, geometry, material} of resources) {
      // Material arrays are small instance-owned containers. Actual Material
      // objects, textures and BufferGeometry objects remain shared by reference.
      const mesh = new T.Mesh(geometry, Array.isArray(material) ? [...material] : material);
      mesh.name = part.id;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData = {...part, geometry: undefined, style: style.id};
      shoe.add(mesh);
    }
    active.add(shoe);
    return shoe;
  }
  function release(shoe) {
    if (!active.delete(shoe)) throw new Error('Unknown or already released shoe.');
    shoe.removeFromParent();
    // One actor leaving must not dispose shared geometry/material resources.
  }
  function disposeGeometry() {
    if (active.size) throw new Error('Release all shoe instances before disposal.');
    if (disposed) return;
    disposed = true;
    for (const geometry of new Set(resources.map(r => r.geometry))) geometry.dispose();
    // Native StyleMaterials remains the owner of shared materials and textures.
  }
  return {resources, create, release, disposeGeometry, get activeCount() {return active.size;}};
}

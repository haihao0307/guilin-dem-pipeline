const ACTIVE_TERRAIN_BY_SCENE = new WeakMap();
const FLAG = Symbol.for('wenzhou.r3.8.overlay-transform-contract-installed');

function isTerrainCandidate(object) {
  return !!(
    object?.isMesh &&
    !object.userData?.wenzhouSeaDemo &&
    !object.userData?.wenzhouSurfaceEvidence &&
    !object.userData?.wenzhouLandcoverEvidence &&
    !object.userData?.wenzhouOsmEvidence &&
    !object.userData?.wenzhouSoilContextEvidence &&
    object.material?.alphaMap &&
    object.geometry?.attributes?.uv &&
    object.geometry?.attributes?.position
  );
}

function inheritTerrainTransform(object, terrain) {
  const liftM = Number(object.userData?.visualLiftM || 0);
  object.scale.copy(terrain.scale);
  object.position.copy(terrain.position);
  object.quaternion.copy(terrain.quaternion);
  object.position.y += liftM / 1000;
  object.userData.transformInheritedFromTerrain = true;
}

export function installOverlayTransformContract(THREE) {
  if (THREE.Object3D.prototype[FLAG]) return;
  THREE.Object3D.prototype[FLAG] = true;

  const originalAdd = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (...objects) {
    if (this.isScene) {
      for (const object of objects) {
        if (isTerrainCandidate(object)) {
          ACTIVE_TERRAIN_BY_SCENE.set(this, object);
          continue;
        }
        if (object?.userData?.wenzhouSoilContextEvidence) {
          const terrain = ACTIVE_TERRAIN_BY_SCENE.get(this);
          if (terrain) inheritTerrainTransform(object, terrain);
        }
      }
    }
    return originalAdd.apply(this, objects);
  };

  document.documentElement.dataset.wenzhouOverlayTransformContract = 'true';
}

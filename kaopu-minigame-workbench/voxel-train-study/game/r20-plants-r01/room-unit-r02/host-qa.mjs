// Optional host mount. Reuse its THREE and scene, renderer, camera and clock.
// The host calls room.update(authoritativeSeconds) in its existing update loop.
import {loadNativeDwelling} from './room-native.mjs';
import {pinnedDependencies} from './native-codec/codec.mjs';

async function localBytes(relativePath) {
  const response = await fetch(new URL(relativePath, import.meta.url));
  if (!response.ok) throw new Error('Missing local dwelling file: ' + relativePath);
  return new Uint8Array(await response.arrayBuffer());
}

export async function mountNativeDwelling({THREE, scene, position = [-10, .17, 13], yaw = 0} = {}) {
  if (!scene?.add || !THREE?.Group) throw new Error('Existing host THREE and scene required');
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || !Number.isFinite(yaw)) {
    throw new Error('Finite rigid metre-preserving placement required');
  }
  const dependencyBytes = {};
  for (const dependency of pinnedDependencies()) {
    // Every slash is encoded. Nested native/timber paths have two separators.
    dependencyBytes[dependency.id] = await localBytes('./' + dependency.id.replaceAll('__', '/'));
  }
  const bytes = await localBytes('./native-codec/samples/original-material-dwelling.KaoPu');
  const room = await loadNativeDwelling(bytes, {THREE, dependencyBytes});
  room.root.position.fromArray(position);
  room.root.rotation.y = yaw;
  scene.add(room.root);
  return room;
}

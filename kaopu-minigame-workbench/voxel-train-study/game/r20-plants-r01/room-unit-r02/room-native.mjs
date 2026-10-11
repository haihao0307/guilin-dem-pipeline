// The container contains an inert recipe, never generators or source URLs.
// All generators come from this trusted host module closure.
import {decode, verifyDependencyBytes, formatInfo} from './native-codec/codec.mjs';
import {buildDwellingUnit} from './room-unit.mjs';

export async function loadNativeDwelling(bytes, {THREE, dependencyBytes} = {}) {
  await verifyDependencyBytes(dependencyBytes);
  const score = await decode(bytes);
  const room = buildDwellingUnit(score, {THREE});
  room.proof.nativeContainer = {
    format: 'SQLite 3', profile: formatInfo.profile, decoded: true,
    dependencyPinsVerified: true, recipeOnly: true,
    materialGenerators: ['OriginalTimber-v3', 'BrickR3.12'],
    wallBindingMode: score.wallBindingMode,
    embeddedGeometry: false, embeddedTextures: false, embeddedExecutableCode: false,
    generalKaoPuReader: false,
  };
  return room;
}

/** Audited source/input profile + exact complete native output hash pairs.
 * No quantization, numerical mutation, hash wildcard, or runtime sampling.
 * Unknown or mixed pairs are rejected. Qualification uses full cross-runtime
 * field comparisons in CI; retained raw hashes distinguish actual output bytes.
 */
export const EQUIVALENCE_VERSION='native78-ficus-runtime-hash-pairs/1';
export const KNOWN_NATIVE_HASH_PAIRS=Object.freeze([
 Object.freeze({id:'node24-reference',geometry:'04f2540de4b18ce8c13eb5cf3122db93639d29430c11d6f42d72ad3469bb8d74',content:'77a3555fbf894deb9b610e616e7c0d0955d53c341652343f3b7eaf5638e26ea5'}),
 Object.freeze({id:'node22-qualified',geometry:'bdb1a347149b0f7383ee91ed791c1a5b68f81893962d7df5ac3471d8d8f39a5c',content:'c5adba44e1283fba3e8d047fe0656f15e174ce09d120a36cab488502af760877'}),
 Object.freeze({id:'chromium143-qualified',geometry:'c7b3df24fa43d11b19bd733f5c589c3dcf0b6fb1b6c13b83ee7921eae98d6213',content:'38a9e7686abcf483c90629c5e097ff913d187f9dccf1cf3b6d47f815e5bc6052'})
]);
export function assertKnownNativeHashes(asset){
 const match=KNOWN_NATIVE_HASH_PAIRS.find(p=>asset?.geometryHash===p.geometry&&asset?.contentHash===p.content);
 if(!match)throw Error('Unqualified native output hash pair: '+String(asset?.geometryHash)+' / '+String(asset?.contentHash));
 return {version:EQUIVALENCE_VERSION,matchedPair:match.id,geometryHash:match.geometry,contentHash:match.content,renderGeometryUnmodified:true,sourceAndInputHashRequired:true,unknownOutputsRejected:true,qualification:'Full arrays and materialized organ fields; no universal engine claim',geometryExactExcept:'barkCoordinates69 x/y near zero',barkDirectionInputMagnitudeExclusive:1e-12,barkMaximumPairDifferenceExclusive:2e-12,growthMaximumPairDifferenceExclusive:1e-12};
}

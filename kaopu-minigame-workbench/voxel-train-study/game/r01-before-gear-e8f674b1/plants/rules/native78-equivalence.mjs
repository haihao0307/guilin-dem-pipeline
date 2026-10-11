/** Exact measured full-source Musa outputs only. No engine wildcards or numeric tolerance. */
export const EQUIVALENCE_VERSION='native78-musa-runtime-hash-pairs/2';
export const KNOWN_NATIVE_HASH_PAIRS=Object.freeze([
 Object.freeze({id:'node24-reference',qualifiedEngines:Object.freeze(['Node24.19.0','Node22.23.3']),geometry:'90ee8e44193b450aecf7c437e45717634010f2d8f87e908dadfcca68eaa0dac9',content:'d29345d6d95a25c849930af1cbf4556486bbf1f302a131a9090639a29ee66b2c'}),
 Object.freeze({id:'chromium143-qualified',qualifiedEngines:Object.freeze(['Chromium143']),geometry:'90ee8e44193b450aecf7c437e45717634010f2d8f87e908dadfcca68eaa0dac9',content:'983c3905c2adfe36079eb29369d37f70ac66bfadbe75fa7e188100be87f0a8a9'})
]);
export function assertKnownNativeHashes(asset){
 const match=KNOWN_NATIVE_HASH_PAIRS.find(p=>asset?.geometryHash===p.geometry&&asset?.contentHash===p.content);
 if(!match)throw Error('Unqualified native output hash pair: '+String(asset?.geometryHash)+' / '+String(asset?.contentHash));
 return {version:EQUIVALENCE_VERSION,matchedPair:match.id,qualifiedEngines:[...match.qualifiedEngines],geometryHash:match.geometry,contentHash:match.content,renderGeometryUnmodified:true,sourceAndInputHashRequired:true,unknownOutputsRejected:true,qualification:'Measured Node24.19.0, Node22.23.3 and Chromium143; exact same 11 geometry arrays and six resource byte arrays. Chromium raw growth Float64/graph last bits retain their separately audited complete content hash. No runtime numeric tolerance or normalization.'};
}

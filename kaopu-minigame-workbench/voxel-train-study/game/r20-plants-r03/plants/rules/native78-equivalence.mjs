/** Exact measured full-source Musa outputs only. No engine wildcards or numeric tolerance. */
export const EQUIVALENCE_VERSION='native78-musa-runtime-hash-pairs/1';
export const KNOWN_NATIVE_HASH_PAIRS=Object.freeze([
 Object.freeze({id:'node24-reference',geometry:'90ee8e44193b450aecf7c437e45717634010f2d8f87e908dadfcca68eaa0dac9',content:'d29345d6d95a25c849930af1cbf4556486bbf1f302a131a9090639a29ee66b2c'})
]);
export function assertKnownNativeHashes(asset){
 const match=KNOWN_NATIVE_HASH_PAIRS.find(p=>asset?.geometryHash===p.geometry&&asset?.contentHash===p.content);
 if(!match)throw Error('Unqualified native output hash pair: '+String(asset?.geometryHash)+' / '+String(asset?.contentHash));
 return {version:EQUIVALENCE_VERSION,matchedPair:match.id,geometryHash:match.geometry,contentHash:match.content,renderGeometryUnmodified:true,sourceAndInputHashRequired:true,unknownOutputsRejected:true,qualification:'Actual full-source Node24.19.0 versus Musa dependency-slice arrays, resources, bindings and complete geometry/content hashes; other engines unqualified'};
}

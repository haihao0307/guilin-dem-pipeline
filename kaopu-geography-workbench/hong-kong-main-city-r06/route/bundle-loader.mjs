import {patchConsistRuntime} from '../train/runtime-patch.mjs';
import {patchRouteMetadata} from './runtime-metadata-patch.mjs';
import {patchRailVerticalRuntime} from '../../hong-kong-main-city-r02/rail-profile/runtime-patch.mjs';
import {patchVerified,countExact} from '../../hong-kong-main-city-r02/projection/patch-plan.mjs';
import {patchDynamicVerified} from '../../hong-kong-main-city-r02/projection/dynamic-patch-plan.mjs';
export function auditBlobDependencies(text){
 // SHA-locked bundle has one explicit absolute-base dynamic import, no relative static imports.
 if(/\bimport\s*(?:["'{*]|[\w$]+\s+from)/.test(text)||text.includes('import.meta'))throw Error('Bundle now requires static imports or import.meta; use a verified prepatched file instead');
 const expected='import(new URL("candidates/runtime.mjs",window.HK_TRAIN_ASSET_BASE))';
 if(countExact(text,'import(')!==1||countExact(text,expected)!==1)throw Error('Unexpected bundle dynamic import dependency');
 return {staticImports:0,importMeta:0,dynamicImports:1,dynamicImportBase:'window.HK_TRAIN_ASSET_BASE',candidatePath:'candidates/runtime.mjs'};
}
export async function load150kmIntegration({bundleURL,assetBaseURL,dynamicNear=false}={}){
 const url=new URL(bundleURL,location.href),assetBase=new URL(assetBaseURL,location.href);
 if(!['http:','https:'].includes(assetBase.protocol)||!assetBase.pathname.endsWith('/'))throw Error('Asset base must be an absolute HTTP(S) directory URL');
 if(window.HK_TRAIN_ASSET_BASE&&new URL(window.HK_TRAIN_ASSET_BASE,location.href).href!==assetBase.href)throw Error('Candidate asset base conflict; do not silently retarget assets');
 const response=await fetch(url);if(!response.ok)throw Error('Train bundle HTTP '+response.status);
 const result=await (dynamicNear?patchDynamicVerified:patchVerified)('three',await response.arrayBuffer());auditBlobDependencies(result.text);const rail=patchConsistRuntime(patchRouteMetadata(patchRailVerticalRuntime(result.text).text).text);auditBlobDependencies(rail.text);if(!window.HKRailVertical)throw Error('Constrained railway profile must be installed before the game bundle');
 window.HK_TRAIN_ASSET_BASE=assetBase.href;
 const blobURL=URL.createObjectURL(new Blob([rail.text],{type:'text/javascript'}));
 try{return await import(blobURL);}catch(error){
  // No original-60km fallback or hash-check-then-re-fetch import. If CSP blocks Blob,
  // generate and pin a prepatched module in the next release instead.
  throw Error('Verified 150km Blob module could not load; use a separately pinned prepatched module. '+error.message);
 }finally{URL.revokeObjectURL(blobURL);}
}

export async function loadSharedProjectionIntegration(options){return load150kmIntegration({...options,dynamicNear:true});}

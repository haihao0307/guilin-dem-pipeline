/** PLANT_FUNCTION_R01: pinned mother rules, exact native78 organ generation.
 * This is the new game adapter, not a pre-existing universal KAOPU standard.
 */
import * as THREE from '../vendor/three.module.min.js';
import {profile78,generateTropical78,fixedAsset76} from './native78-ficus-author.mjs';
import {createFixedMesh76,installWind76} from './native78-runtime.mjs';
import {hashSpecimen,SIGNATURE_VERSION,BARK_DIRECTION_ZERO_THRESHOLD,GROWTH_GRID_STEP} from './native78-equivalence.mjs';
export const OPERATOR_VERSION='PLANT_FUNCTION_R02';
const EXPECTED_SIGNATURE='196486cad21adfb898fd3bdf019810d4ecf8acc8482c5eae4d97776a37e4f180';
const ORIGINAL_HEAD='d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122';
const EXPECTED_GEOMETRY='04f2540de4b18ce8c13eb5cf3122db93639d29430c11d6f42d72ad3469bb8d74';
const EXPECTED_CONTENT='77a3555fbf894deb9b610e616e7c0d0955d53c341652343f3b7eaf5638e26ea5';
const now=()=>performance.now();
function uniqueBytes(root){const buffers=new Set(),geometries=new Set(),materials=new Set(),textures=new Set();let triangles=0,groups=0;root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;geometries.add(g);triangles+=(g.index?.count||g.attributes.position.count)/3;groups+=g.groups.length||1;for(const a of Object.values(g.attributes))buffers.add(a.array.buffer);if(g.index)buffers.add(g.index.array.buffer);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});return{geometryBytes:[...buffers].reduce((s,b)=>s+b.byteLength,0),geometryBuffers:buffers.size,geometries:geometries.size,materials:materials.size,textures:textures.size,texturePixelBytes:[...textures].reduce((s,t)=>s+(t.image?.data?.byteLength||0),0),triangles,colorDrawGroups:groups};}
export async function buildNativeFicus(recipe,{verifyResources}={}){
 const p=recipe.profile;if(p.species!=='ficus-microcarpa'||p.stage!=='juvenile'||p.seed!==761014||p.habitatForm!=='sheltered')throw Error('Operator release supports only the audited juvenile specimen');
 const canonical=profile78(p.species,p);if(JSON.stringify(canonical)!==JSON.stringify(p)&&Object.keys(canonical).some(k=>canonical[k]!==p[k]))throw Error('Native profile changed during construction');
 const started=now(),heapBefore=performance.memory?.usedJSHeapSize??null;let sentinelDelay=null;
 const sentinel=new Promise(resolve=>setTimeout(()=>{sentinelDelay=now()-started;resolve();},0));
 let fixed=null;const shadowMaterials=[];
 try{
  const specimen=generateTropical78(canonical,{compactBlades76:true}),generated=now();
  const sourceGeometryBytes=Object.values(specimen.geometry).reduce((n,x)=>n+(ArrayBuffer.isView(x)?x.byteLength:0),0);
  const asset=await fixedAsset76(specimen),signature=await hashSpecimen(specimen),hashed=now();
  if(signature!==EXPECTED_SIGNATURE)throw Error('Native bounded signature mismatch: '+signature);
  const equivalence={version:SIGNATURE_VERSION,signature,referenceSignature:EXPECTED_SIGNATURE,rawHashEqualToNode24:asset.geometryHash===EXPECTED_GEOMETRY&&asset.contentHash===EXPECTED_CONTENT,referenceRawGeometryHash:EXPECTED_GEOMETRY,referenceRawContentHash:EXPECTED_CONTENT,renderGeometryUnmodified:true,geometryArraysExactExcept:'barkCoordinates69 direction x/y near-zero only; no normal/position tolerance',barkDirectionZeroThreshold:BARK_DIRECTION_ZERO_THRESHOLD,barkMaximumPairDifferenceExclusive:2*BARK_DIRECTION_ZERO_THRESHOLD,growthDoubleMaximumPairDifferenceExclusive:GROWTH_GRID_STEP,compactLeafGettersIncluded:true};
  if(verifyResources)await verifyResources(Object.fromEntries(specimen.surfaces.resources.map(r=>[r.id,r.bytes])));
  fixed=createFixedMesh76(asset);fixed.group.name='原生小叶榕 · 幼株761014';
  fixed.wind.strength.value=recipe.motion.strength;
  fixed.group.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});installWind76(depth,fixed.wind);o.customDepthMaterial=depth;shadowMaterials.push(depth);});
  fixed.group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(fixed.group),renderResources=uniqueBytes(fixed.group),built=now();await sentinel;
  if(renderResources.triangles!==307346)throw Error('Native renderer dropped or duplicated saved triangles');
  const proof=Object.freeze({operator:OPERATOR_VERSION,sourceHead:ORIGINAL_HEAD,threeGeneratorRevision:THREE.REVISION,hostRendererRevision:'170; actual WebGL compatibility must be tested',species:p.species,developmentStage:p.stage,seed:p.seed,profile:{...p},units:'metre',rootScale:[1,1,1],sourceGeometryHash:asset.geometryHash,sourceContentHash:asset.contentHash,sourceEquivalent:true,equivalence,productionGate:specimen.production.status,visualAcceptance:false,hardwareMeasured:false,leafCount:specimen.growth.blades.length,branchCount:specimen.growth.axes.filter(a=>a.kind==='branch').length,aerialRootCount:specimen.growth.axes.filter(a=>a.role==='aerial-root').length,groundedPropCount:specimen.growth.axes.filter(a=>a.role==='grounded-prop').length,bounds:{min:box.min.toArray(),max:box.max.toArray()},triangles:renderResources.triangles,sourceGeometryBytes,renderResources,resourceIds:specimen.surfaces.resources.map(r=>r.id),materialsIncludeImages:true,externalModels:false,geometrySampling:'full native78; no simplification, LOD or leaf removal',timing:{mainThreadGenerationMs:generated-started,contentValidationMs:hashed-generated,totalBuildMs:built-started,eventLoopSentinelDelayMs:sentinelDelay,heapBefore,heapAfter:performance.memory?.usedJSHeapSize??null},wind:{model:'native76',timeSource:'host.elapsed',strength:recipe.motion.strength,leafMaximumAngleRadians:recipe.motion.strength*.06,shadowUsesSameWind:true}});
  let disposed=false,elapsed=0;
  return{root:fixed.group,proof,update(timeSeconds){if(disposed)return;if(!Number.isFinite(timeSeconds)||timeSeconds<0)throw Error('Finite nonnegative host seconds required');elapsed=timeSeconds;fixed.wind.time.value=timeSeconds;},snapshot(){return{...proof,elapsed,disposed};},dispose(){if(disposed)return;disposed=true;fixed.group.removeFromParent();fixed.dispose();for(const m of shadowMaterials)m.dispose();}};
 }catch(error){fixed?.dispose();for(const m of shadowMaterials)m.dispose();throw error;}
}

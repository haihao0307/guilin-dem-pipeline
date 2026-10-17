#!/usr/bin/env node
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {reconstructDocument,sha256,makeGltfBridge,verifyImplementation} from '../src/exact-decoder.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reports=[];
const syncSha=b=>createHash('sha256').update(b).digest('hex');
function readTransportResidual(base){
 const record=JSON.parse(fs.readFileSync(path.join(base,'storage-manifest.json'))).residual;let offset=0;
 const parts=record.parts.map(part=>{const b=fs.readFileSync(path.join(base,part.path));assert.equal(part.offset,offset);assert.equal(b.length,part.bytes);assert.equal(syncSha(b),part.sha256);offset+=b.length;return b;});
 const gzip=Buffer.concat(parts);assert.equal(gzip.length,record.bytes);assert.equal(syncSha(gzip),record.sha256);
 const raw=gunzipSync(gzip);assert.equal(raw.length,record.rawBytes);assert.equal(syncSha(raw),record.rawSHA256);return raw;
}
const readRawOrGzip=p=>fs.existsSync(p)?fs.readFileSync(p):(fs.existsSync(p+'.gz')?gunzipSync(fs.readFileSync(p+'.gz')):readTransportResidual(path.dirname(p)));
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
for(const model of ['a4','mark3']){
 const base=path.resolve(process.env.KAOPU_SOURCE_ROOT||path.resolve(root,'../../a4-a6-source-comparison-r03/source-assets'),model),target=path.join(root,'generated',model);
 const original=JSON.parse(fs.readFileSync(path.join(base,'object.json'))),manifest=JSON.parse(readRawOrGzip(path.join(target,'program.json')));
 await verifyImplementation(manifest,async p=>new Uint8Array(fs.readFileSync(path.join(root,p))));
 const wrongImplementation=structuredClone(manifest);wrongImplementation.implementationLocks.runtimeModules[0].sha256='0'.repeat(64);await assert.rejects(verifyImplementation(wrongImplementation,async p=>new Uint8Array(fs.readFileSync(path.join(root,p)))),/Implementation integrity mismatch/);
 const residual=new Uint8Array(readRawOrGzip(path.join(target,'residual.bin'))),source=gunzipSync(fs.readFileSync(path.join(base,'fields.bin.gz')));
 const assets=new Map(manifest.shapeAssets.map(a=>[a.path,new Uint8Array(fs.readFileSync(path.join(target,a.path)))]));
 assert.deepStrictEqual(Buffer.from(residual),readTransportResidual(target));
 const {document,payload}=await reconstructDocument(manifest,residual,assets);
 for(const key of ['fields','objectGraph','displaySkeleton','images','fieldPayload'])assert.deepStrictEqual(document.content[key],original.content[key],model+' '+key);
 assert.deepStrictEqual(Buffer.from(payload),source);
 const bridge=makeGltfBridge(document,'fields.bin');assert.equal(bridge.accessors.length,manifest.source.fieldCount);
 for(const image of manifest.contentMetadata.images)assert.equal(await sha256(fs.readFileSync(path.join(target,image.payload))),image.sha256);
 const corrupt=residual.slice();corrupt[Math.floor(corrupt.length/2)]^=1;
 await assert.rejects(reconstructDocument(manifest,corrupt,assets),/Residual integrity mismatch/);
 const broken=structuredClone(manifest);broken.meshInstances[0].primitiveBindings[0].attributes.POSITION=broken.fieldInstances.length-1;
 await assert.rejects(reconstructDocument(broken,residual,assets),/Typed field binding mismatch/);
 await assert.rejects(reconstructDocument(manifest,residual,new Map()),/Missing shape asset/);
 const changedTemplate=structuredClone(manifest);changedTemplate.meshFunctions[0].primitives[0].properties.mode=1;
 await assert.rejects(reconstructDocument(changedTemplate,residual,assets),/Runtime definition integrity mismatch/);
 const changedInstance=structuredClone(manifest),slot=changedInstance.componentInstances.flatMap(i=>i.slots).find(s=>s.properties.matrix||s.properties.translation);
 (slot.properties.matrix||slot.properties.translation)[0]+=1;
 await assert.rejects(reconstructDocument(changedInstance,residual,assets),/Runtime definition integrity mismatch/);
 const changedMaterial=structuredClone(manifest),materialCall=changedMaterial.materialFunctions.calls.find(c=>c.fn==='pbr_metallic_roughness'),materialArgument=materialCall.args.findIndex(v=>typeof v==='number');materialCall.args[materialArgument]+=0.125;await assert.rejects(reconstructDocument(changedMaterial,residual,assets),/Runtime definition integrity mismatch/);
 const missingMaterials=structuredClone(manifest);delete missingMaterials.materialFunctions;await assert.rejects(reconstructDocument(missingMaterials,residual,assets),/Missing material functions/);
 const changedShape=structuredClone(manifest),changedAssets=new Map(assets),asset=changedShape.shapeAssets[0];
 const shapeRaw=new Uint8Array(gunzipSync(assets.get(asset.path))),shapeView=new DataView(shapeRaw.buffer,shapeRaw.byteOffset,shapeRaw.byteLength);
 if(asset.opcode==='radialWheelExact')shapeView.setFloat32(32,shapeView.getFloat32(32,true)+0.001,true);else shapeView.setFloat64(8,shapeView.getFloat64(8,true)+0.001,true);
 const shapeGzip=new Uint8Array(gzipSync(shapeRaw,{level:9,mtime:0}));changedAssets.set(asset.path,shapeGzip);asset.bytes=shapeGzip.length;asset.sha256=await sha256(shapeGzip);asset.uncompressedSHA256=await sha256(shapeRaw);
 for(const f of changedShape.fieldFunctions)for(const rule of f.program)if(rule.asset===asset.path)rule.assetSHA256=asset.sha256;
 await assert.rejects(reconstructDocument(changedShape,residual,changedAssets),/Field integrity mismatch/);
 for(const newAsset of manifest.shapeAssets.filter(a=>['affineQuarterArcExact','windowBandSparseOverlayExact','mainShellSparseOverlayExact','bodyShellSparseOverlayExact','bodyShellCoonsSparseOverlayExact','underframeTSparseOverlayExact','halfEllipsoidSparseOverlayExact','seatCushionSparseOverlayExact','extendedMainShellSparseOverlayExact','ceilingProfileSweepSparseExact','interiorPlaneSparseExact'].includes(a.opcode))){
  const testManifest=structuredClone(manifest),testAssets=new Map(assets),raw=new Uint8Array(gunzipSync(assets.get(newAsset.path))),v=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  if(newAsset.opcode==='affineQuarterArcExact')v.setFloat32(24,v.getFloat32(24,true)+0.001,true);else if(newAsset.opcode==='mainShellSparseOverlayExact')v.setFloat64(120,v.getFloat64(120,true)*1.01,true);else if(['bodyShellSparseOverlayExact','bodyShellCoonsSparseOverlayExact'].includes(newAsset.opcode)){const at=36+v.getUint32(24,true)+v.getUint32(28,true)+48;v.setFloat64(at,v.getFloat64(at,true)+0.001,true);}else if(newAsset.opcode==='halfEllipsoidSparseOverlayExact')v.setFloat64(100,v.getFloat64(100,true)+0.001,true);else if(newAsset.opcode==='extendedMainShellSparseOverlayExact')v.setFloat64(148,v.getFloat64(148,true)*1.01,true);else if(newAsset.opcode==='ceilingProfileSweepSparseExact')v.setFloat32(28,v.getFloat32(28,true)+0.001,true);else if(newAsset.opcode==='interiorPlaneSparseExact'){const at=newAsset.sourceAccessors[0]===184?20:36;v.setFloat64(at,v.getFloat64(at,true)+0.01,true);}else if(newAsset.opcode==='underframeTSparseOverlayExact')v.setFloat64(24,v.getFloat64(24,true)*1.005,true);else if(newAsset.opcode==='seatCushionSparseOverlayExact')v.setFloat64(28,v.getFloat64(28,true)*1.01,true);else v.setFloat64(96,v.getFloat64(96,true)+0.001,true);
  const encoded=new Uint8Array(gzipSync(raw,{level:9,mtime:0}));testAssets.set(newAsset.path,encoded);const a=testManifest.shapeAssets.find(x=>x.path===newAsset.path);a.bytes=encoded.length;a.sha256=await sha256(encoded);a.uncompressedSHA256=await sha256(raw);
  for(const f of testManifest.fieldFunctions)for(const rule of f.program)if(rule.asset===a.path)rule.assetSHA256=a.sha256;
  await assert.rejects(reconstructDocument(testManifest,residual,testAssets),/Field integrity mismatch/);
 }
 const result={model,verifiedFields:manifest.source.fieldCount,nodes:bridge.nodes.length,meshes:bridge.meshes.length,materials:bridge.materials.length,textures:bridge.textures.length,animations:(bridge.animations||[]).length,payloadSHA256:await sha256(payload),residualCorruptionRejected:true,typedFieldMisbindingRejected:true,sharedTemplateMutationRejected:true,instanceTransformMutationRejected:true,shapeParameterMutationRejected:true,missingShapeFailsWithoutFallback:true,transportPartsReassembleExactly:true,implementationFilesLocked:true,implementationMutationRejected:true,materialParameterMutationRejected:true,missingMaterialFunctionsRejected:true,windowParameterMutationRejected:true};reports.push(result);console.log(JSON.stringify(result));
}
fs.writeFileSync(path.join(root,'reports/js-verification.json'),JSON.stringify({passed:true,models:reports},null,2)+'\n');

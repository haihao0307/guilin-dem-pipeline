/** Node integration test of the actual vendored r170 GLTFLoader; no GPU claim. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createGltfTextureRuleBridge} from './gltf-texture-bridge.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),vendor=path.join(root,'a4-a6-source-comparison-r03/vendor');
const threeURL=pathToFileURL(path.join(vendor,'three.module.js')).href,T=await import(threeURL);
const dataURL=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const utils=dataURL((await fs.readFile(path.join(vendor,'BufferGeometryUtils.mjs'),'utf8')).replaceAll("from 'three'",`from '${threeURL}'`));
const loaderCode=(await fs.readFile(path.join(vendor,'GLTFLoader.mjs'),'utf8')).replaceAll("from 'three'",`from '${threeURL}'`).replace("from './BufferGeometryUtils.mjs'",`from '${utils}'`);
const {GLTFLoader}=await import(dataURL(loaderCode));
globalThis.self=globalThis;
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,props){this.type=type;Object.assign(this,props);}};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),summary=[];
function fixture(document){
 const c=document.content,arr=new Float32Array([0,0,0,1,0,0,0,1,0, 0,0,1,0,0,1,0,0,1, 0,0,1,0,0,1]);
 return {asset:{version:'2.0'},images:c.images.map(i=>({...structuredClone(i.definition),uri:i.payload})),textures:structuredClone(c.displaySkeleton.textures),samplers:structuredClone(c.displaySkeleton.samplers),extensionsUsed:['KHR_texture_transform'],materials:[{alphaMode:'BLEND',doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0,texCoord:1,extensions:{KHR_texture_transform:{offset:[.125,.25],scale:[.5,.75],rotation:.2,texCoord:1}}}}}],buffers:[{byteLength:arr.byteLength,uri:'data:application/octet-stream;base64,'+Buffer.from(arr.buffer).toString('base64')}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36},{buffer:0,byteOffset:72,byteLength:24}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]},{bufferView:1,componentType:5126,count:3,type:'VEC3'},{bufferView:2,componentType:5126,count:3,type:'VEC2'}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2,TEXCOORD_1:2},material:0}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
}
const getBytes=async url=>{assert(!/\/images\//.test(String(url)),'Original encoded image request forbidden');return new Uint8Array(await fs.readFile(fileURLToPath(url)));};
for(const model of ['a4','mark3']){
 const document=JSON.parse(await fs.readFile(path.join(root,`a4-a6-source-comparison-r03/source-assets/${model}/object.json`),'utf8')),gltf=fixture(document),before=JSON.stringify(gltf);
 const bridge=await createGltfTextureRuleBridge(T,{model,document,gltf,getBytes}),loader=new GLTFLoader();loader.register(bridge.plugin);
 const result=await loader.parseAsync(JSON.stringify(gltf),'');bridge.assertComplete(result);assert.equal(JSON.stringify(gltf),before,'Bridge changed glTF JSON');
 const textures=await result.parser.getDependencies('texture');
 for(const [i,texture]of textures.entries()){
  assert(texture.isDataTexture);assert.equal(texture.flipY,false);assert.equal(texture.premultiplyAlpha,false);assert.equal(texture.format,T.RGBAFormat);assert.equal(texture.type,T.UnsignedByteType);assert.equal(texture.unpackAlignment,1);
  const row=bridge.report.images.find(r=>r.imageIndex===gltf.textures[i].source);assert.equal(sha(texture.image.data),row.rgbaPixelsSHA256);assert.equal(texture.image.width,row.width);assert.equal(texture.image.height,row.height);
  const sampler=gltf.samplers[gltf.textures[i].sampler]||{},filters={9728:T.NearestFilter,9729:T.LinearFilter,9984:T.NearestMipmapNearestFilter,9985:T.LinearMipmapNearestFilter,9986:T.NearestMipmapLinearFilter,9987:T.LinearMipmapLinearFilter},wraps={33071:T.ClampToEdgeWrapping,33648:T.MirroredRepeatWrapping,10497:T.RepeatWrapping};
  assert.equal(texture.magFilter,filters[sampler.magFilter]||T.LinearFilter);assert.equal(texture.minFilter,filters[sampler.minFilter]||T.LinearMipmapLinearFilter);assert.equal(texture.wrapS,wraps[sampler.wrapS]||T.RepeatWrapping);assert.equal(texture.wrapT,wraps[sampler.wrapT]||T.RepeatWrapping);
 }
 const material=(await result.parser.getDependencies('material'))[0];assert.equal(material.map.channel,1);assert.equal(material.map.colorSpace,T.SRGBColorSpace);assert.deepEqual(material.map.offset.toArray(),[.125,.25]);assert.deepEqual(material.map.repeat.toArray(),[.5,.75]);assert.equal(material.map.rotation,.2);assert.equal(material.transparent,true);assert.equal(material.side,T.DoubleSide);assert(material.map.isDataTexture);
 assert(bridge.report.fetchURLs.every(url=>!url.includes('/images/')));assert(bridge.report.images.every(row=>row.customLoaderCalls===1));
 // Deliberately model the parser's historical catch-to-null: bridge must reject.
 const fake={json:gltf,loadTextureImage:async()=>null},guard=await createGltfTextureRuleBridge(T,{model,document,gltf,getBytes});
 await assert.rejects(guard.plugin(fake).loadTexture(0),/swallowed texture load failure/);
 const changed=structuredClone(document);changed.content.images[0].sha256='0'.repeat(64);await assert.rejects(createGltfTextureRuleBridge(T,{model,document:changed,gltf,getBytes}),/document source encoded SHA/);
 const corrupt=async url=>{const bytes=await getBytes(url);if(String(url).endsWith('.residual.raw.gz')){bytes[bytes.length-1]^=1;}return bytes;};
 await assert.rejects(createGltfTextureRuleBridge(T,{model,document,gltf,getBytes:corrupt}),/gzip residual SHA/);
 summary.push({...bridge.report,tests:{actualVendoredGLTFLoader:true,samplerPreserved:true,uvChannelAndTransformPreserved:true,colorSpaceAndAlphaPreserved:true,noOriginalEncodedRequests:true,sourceIdentityMismatchRejected:true,gzipCorruptionRejected:true,parserNullRejected:true,glTFJSONUnchanged:true}});
 textures.forEach(t=>t.dispose());material.map.dispose();material.dispose();
}
const report={pass:true,threeRevision:T.REVISION,gpuTestPerformed:false,models:summary};
await fs.writeFile(path.join(here,'gltf-texture-bridge.node-test.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,threeRevision:T.REVISION,models:summary.map(r=>({model:r.model,images:r.images.length,textures:r.textures.length,tests:r.tests}))},null,2));

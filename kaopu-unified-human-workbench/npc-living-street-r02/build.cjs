#!/usr/bin/env node
'use strict';
/**
 * NPC-LIVING-STREET-R02 packaging adapter.
 * The canonical R07 source is read, SHA-locked, and NEVER overwritten.
 * Native R07 mesh, coefficients, skin functions, eye textures and renderer stay
 * in their original bundle. The new workbench runs in that same document.
 *
 * node prepare.cjs      # fixed build compiler + official Cannon dependency
 * node build.cjs        # fixed-network preview.html for publication/QA
 * node prepare.cjs --packets hot,anny-0,... # exact observed native packet IDs
 * node build.cjs --offline # offline standalone.html from the verified cache
 * node build.cjs --check-host  # structural host/THREE checks, writes nothing
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const VERSION = 'NPC-LIVING-STREET-R02';
const CANONICAL_SHA = '5543f756ca3af1428323696324303fa70b8de850';
const HOST_SHA256 = 'd1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const CANNON_SHA256 = 'f0700cbd3a482954949b9d58c1b0f76dcc74767750297647a39d8c40dd63d37c';
const here = __dirname;
const hostPath = path.resolve(here, 'vendor/r07-preview.html');
const faceLockPath = path.join(here, 'native-face-assets.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const patch = (source, anchor, replacement, count = 1) => {
  assert.equal(source.split(anchor).length, count + 1, 'R07 adapter anchor: ' + anchor);
  return source.split(anchor).join(replacement);
};

// Names are from the SHA-locked R07 esbuild closure, all from its Three r170.
// Exporting these references retains constructor, material and renderer identity.
// No second Three module is bundled by this workbench.
const nativeThree = {
  Vector2: 'Ae', Vector3: 'V', Vector4: 'yt', Quaternion: 'Ot',
  Matrix3: 'Je', Matrix4: 'tt', Euler: 'Jn', Color: 'Ee', MathUtils: 'gn',
  Object3D: 'M0', Group: 'Ht', Scene: 'Qr', PerspectiveCamera: 'd0',
  BufferGeometry: 'Qe', BufferAttribute: 'He', Float32BufferAttribute: 'Ze',
  BoxGeometry: 'p0', CylinderGeometry: 'Cl', PlaneGeometry: 'S0', SphereGeometry: 'ra',
  Mesh: 'st', MeshStandardMaterial: 'wt', MeshBasicMaterial: 'mn',
  Line: 'El', LineSegments: 'ud', LineBasicMaterial: 'eo', GridHelper: 'Fl',
  Texture: 'D0', CanvasTexture: 'Ds', DataTexture: 'vt', Source: 'fl',
  ShaderLib: 'qn', UniformsUtils: 'ey', ShaderMaterial: 'K0',
  HemisphereLight: 'ss', DirectionalLight: 'Zn', Box3: 'o0',
  Camera:'_l', OrthographicCamera:'Kr', MeshDepthMaterial:'ia', MeshPhysicalMaterial:'Il',
  Sphere:'ts', Plane:'In', Ray:'Zr', Frustum:'na', Triangle:'Is', Layers:'gl',
  WebGLRenderTarget:'Y0', ShaderChunk:'Xe', UniformsLib:'Me', EventDispatcher:'Ii',
  TextureLoader:'no', PMREMGenerator:'vl', Curve:'Fn',
  ArcCurve:'dd', CatmullRomCurve3:'sa', CubicBezierCurve:'pd', CubicBezierCurve3:'fd',
  EllipseCurve:'kl', LineCurve:'md', LineCurve3:'gd',
  QuadraticBezierCurve:'yd', QuadraticBezierCurve3:'Tl', SplineCurve:'xd',
  // Constants are the existing R07 symbols, not a duplicate constants module.
  FrontSide: 'fn', BackSide: 'B0', DoubleSide: 'Z0',
  RGBAFormat: 'ht', FloatType: 'Ft', UnsignedByteType: 'Ln',
  NearestFilter: '_t', LinearFilter: 'Et', LinearMipmapLinearFilter: 'L0',
  ClampToEdgeWrapping: 'Dt', RepeatWrapping: 'v2',
  SRGBColorSpace: '$t', LinearSRGBColorSpace: 'Q0', NoColorSpace: 'r0',
  DynamicDrawUsage:'io', GLSL3:'Q3', HalfFloatType:'Yn', MirroredRepeatWrapping:'w2',
  NoBlending:'es', NormalBlending:'zr', PCFSoftShadowMap:'Pd', RGBADepthPacking:'lg'
};

const threeAdditionalEntries={
  InstancedBufferAttribute:'core/InstancedBufferAttribute.js',
  InstancedBufferGeometry:'core/InstancedBufferGeometry.js',
  Shape:'extras/core/Shape.js',Path:'extras/core/Path.js',
  ExtrudeGeometry:'geometries/ExtrudeGeometry.js',
  RawShaderMaterial:'materials/RawShaderMaterial.js',Raycaster:'core/Raycaster.js'
};
const nativeModuleAliases={
  'core/BufferAttribute.js':['BufferAttribute','Float32BufferAttribute'],
  'core/BufferGeometry.js':['BufferGeometry'],
  'core/Layers.js':['Layers'],'core/EventDispatcher.js':['EventDispatcher'],
  ...Object.fromEntries(['Vector2','Vector3','Vector4','Matrix3','Matrix4','Quaternion','Euler','Color','Box3','Sphere','Plane','Ray','Triangle','Frustum'].map(name=>['math/'+name+'.js',[name]])),
  'materials/ShaderMaterial.js':['ShaderMaterial'],
  'extras/core/Curve.js':['Curve'],
  ...Object.fromEntries(['ArcCurve','CatmullRomCurve3','CubicBezierCurve','CubicBezierCurve3','EllipseCurve','LineCurve','LineCurve3','QuadraticBezierCurve','QuadraticBezierCurve3','SplineCurve'].map(name=>['extras/curves/'+name+'.js',[name]]))
};
const allThreeNames=Object.keys(nativeThree).concat(Object.keys(threeAdditionalEntries),'REVISION');
const officialThreeRoot=path.join(here,'vendor/three-additions/three-0.170.0/src');

function verifyMotionSources(){
  const file=path.join(here,'motion-source-lock.json'),raw=fs.readFileSync(file),lock=JSON.parse(raw);
  assert.equal(lock.schema,'npc-life-r02-motion-source-lock/1');
  assert.equal(lock.sameNativeRuntime,true);assert.equal(lock.nativeBoneCount,104);
  assert(Array.isArray(lock.files)&&lock.files.length>0,'Original motion source lock has exact files');
  for(const item of lock.files){
    const location=path.resolve(here,item.path);
    assert(location.startsWith(path.join(here,'vendor/motion')+path.sep),'Locked motion source stays in the native motion directory');
    const bytes=fs.readFileSync(location);
    assert.equal(bytes.length,item.bundledBytes,'Exact bundled motion byte count '+item.path);
    assert.equal(hash(bytes),item.bundledSHA256,'Exact bundled motion hash '+item.path);
    if(!item.adapted){
      assert.equal(bytes.length,item.sourceBytes);assert.equal(hash(bytes),item.sourceSHA256);
      const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
      assert.equal(blob,item.sourceGitBlobSha,'Unchanged original motion Git object '+item.path);
    }
  }
  const capture=lock.pickupCapture;
  assert(capture?.output?.path,'Complete pickup source has a locked derived output');
  const capturePath=path.resolve(here,capture.output.path);
  assert(capturePath.startsWith(path.join(here,'vendor/motion')+path.sep),'Pickup source stays in native motion assets');
  const captureBytes=fs.readFileSync(capturePath),captureData=JSON.parse(captureBytes);
  assert.equal(captureBytes.length,capture.output.bytes);assert.equal(hash(captureBytes),capture.output.sha256);
  assert.equal(captureData.points.length,357);assert.equal(captureData.fps,120);assert.equal(captureData.names.length,31);
  const hand=captureData.names.indexOf('rhand');assert(hand>=0);
  const contactFrame=captureData.points.reduce((best,row,i)=>row[hand][1]<captureData.points[best][hand][1]?i:best,0);
  assert.equal(contactFrame,99,'Pickup contact event comes from the complete original capture');
  for(const source of capture.sourceFiles){
    const sourcePath=path.resolve(here,source.path);
    assert(sourcePath.startsWith(path.join(here,'evidence/capture-recovery-source')+path.sep));
    const bytes=fs.readFileSync(sourcePath);assert.equal(bytes.length,source.bytes);assert.equal(hash(bytes),source.sha256);
    assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),source.gitBlob);
  }
  return {sourceLockSHA256:hash(raw),verifiedFiles:lock.files.length,sameNativeRuntime:true,nativeBoneCount:104,
    completePickup:{frames:357,fps:120,joints:31,contactFrame,sha256:hash(captureBytes),originalSourcesVerified:capture.sourceFiles.length}};
}

function exposeNativeThree(html) {
  const anchors = {
    Vector3: 'V=class n{constructor(e=0,t=0,i=0){n.prototype.isVector3=!0',
    Matrix4: 'tt=class n{constructor(e,t,i,s,r,o,a,c,l,h,u,d,p,f,g,m){n.prototype.isMatrix4=!0',
    BoxGeometry: 'p0=class n extends Qe{constructor(e=1,t=1,i=1,s=1,r=1,o=1)',
    CylinderGeometry: 'Cl=class n extends Qe{constructor(e=1,t=1,i=1,s=32,r=1,o=!1,a=0,c=Math.PI*2)',
    Mesh: 'st=class extends M0{constructor(e=new Qe,t=new mn)',
    DataTexture: 'vt=class extends D0{constructor(e=null,t=1,i=1,s,r,o,a,c,l=_t,h=_t,u,d)',
    Float32BufferAttribute: 'Ze=class extends He{constructor(e,t,i){super(new Float32Array(e),t,i)}}'
  };
  for (const [name, anchor] of Object.entries(anchors)) {
    assert.equal(html.split(anchor).length, 2, 'Native Three constructor drift: ' + name);
  }
  const exported = Object.entries(nativeThree).map(([name, symbol]) => name + ':' + symbol).join(',');
  return patch(html, 'window.__IDENTITY_QA__=',
    'window.__NPC_THREE__=Object.freeze({REVISION:"170",' + exported + '});window.__IDENTITY_QA__=');
}

function verifyNativeExports(html) {
  const core = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('Wd=We(()=>'))?.[1];
  assert(core, 'Native R07 runtime closure');
  const end = core.indexOf('var Ke=We(()=>{Wd()});');
  assert(end > 0, 'Native Three module boundary');
  const exported = Object.entries(nativeThree).map(([name,symbol]) => name + ':' + symbol).join(',');
  const context = {console};
  // Initialize only the original Three module, never the document/model/app.
  vm.runInNewContext(core.slice(0,end) + 'Wd();globalThis.native={' + exported + '};})();', context, {timeout:10000});
  const t = context.native;
  for (const name of Object.keys(nativeThree)) assert.notEqual(t[name], undefined, 'Native export unavailable: ' + name);
  assert.equal(new t.Group().isObject3D, true);
  assert.equal(new t.Mesh(new t.BoxGeometry(), new t.MeshStandardMaterial()).isMesh, true);
  assert.equal(new t.CylinderGeometry().isBufferGeometry, true);
  assert.equal(new t.PlaneGeometry().isBufferGeometry, true);
  assert.equal(new t.Matrix4().isMatrix4, true);
  assert.equal(new t.DataTexture().isDataTexture, true);
  assert.equal(t.DoubleSide, 2);
  assert.equal(t.RGBAFormat, 1023);
  assert.equal(t.FloatType, 1015);
  assert.equal(t.NearestFilter, 1003);
  assert.equal(typeof t.ShaderLib.standard.vertexShader, 'string');
  assert.equal(new t.MeshPhysicalMaterial().isMeshPhysicalMaterial,true);
  assert.equal(new t.Camera().isCamera,true);
  assert.equal(new t.OrthographicCamera().isOrthographicCamera,true);
  assert.equal(new t.Frustum().planes.length,6);
  assert.equal(new t.CubicBezierCurve3().isCubicBezierCurve3,true);
  assert.equal(typeof t.Triangle.getBarycoord,'function');
  assert.equal(typeof t.PMREMGenerator.prototype.fromScene,'function');
  assert.equal(typeof t.TextureLoader.prototype.load,'function');
  assert.equal(t.DynamicDrawUsage,35048);assert.equal(t.GLSL3,'300 es');
  assert.equal(t.HalfFloatType,1016);assert.equal(t.NoBlending,0);assert.equal(t.NormalBlending,1);
  assert.equal(t.PCFSoftShadowMap,2);assert.equal(t.RGBADepthPacking,3201);
  return t;
}

function findEsbuild() {
  const candidates = [
    process.env.NPC_ESBUILD_MODULE,
    'esbuild',
    path.join(here, 'vendor/build-tools/node_modules/esbuild'),
    path.join(os.tmpdir(), 'npc-life-build-tools/node_modules/esbuild'),
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'esbuild')
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const builder = require(p);
      assert.equal(builder.version, '0.25.11', 'Pinned esbuild version');
      return builder;
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }
  throw Error('esbuild 0.25.11 missing. Run node ' + path.join(here, 'prepare.cjs') + ' first.');
}

function threeAliasPlugin() {
  return {
    name: 'same-native-r07-three',
    setup(build) {
      build.onResolve({filter: /(?:^three$|(?:^|[\/\\])three(?:\.module)?\.js$)/}, () => ({path: 'r07-native-three', namespace: 'r07-native'}));
      build.onLoad({filter: /.*/, namespace: 'r07-native'}, () => ({
        loader: 'js',
        contents: 'const native = globalThis.__NPC_THREE__;\n' +
          'if (!native || native.REVISION !== "170") throw Error("Canonical R07 Three runtime is unavailable");\n' +
          allThreeNames.map(name => 'export const ' + name + ' = native.' + name + ';').join('\n') +
          '\nexport default native;'
      }));
    }
  };
}

/** Only classes absent from the tree-shaken host are compiled. Every imported
 * native base class is an alias to the exact original constructor, preserving
 * geometry IDs, material identity, math objects and the single renderer.
 */
async function buildThreeAdditions() {
  const lock=require('./vendor/three-additions/THREE-SOURCE-LOCK.json');
  const esbuild=findEsbuild();
  const aliases={name:'same-three-native-base-classes',setup(build){
    build.onResolve({filter:/\.js$/},args=>{
      const file=path.resolve(args.resolveDir,args.path),relative=path.relative(officialThreeRoot,file).replaceAll(path.sep,'/');
      if(nativeModuleAliases[relative])return {path:relative,namespace:'native-base'};
      if(relative==='math/MathUtils.js')return {path:relative,namespace:'native-math-utils'};
      return null;
    });
    build.onLoad({filter:/.*/,namespace:'native-base'},args=>({loader:'js',contents:nativeModuleAliases[args.path].map(name=>'export const '+name+'=globalThis.__NPC_THREE__.'+name+';').join('\n')}));
    build.onLoad({filter:/.*/,namespace:'native-math-utils'},()=>({loader:'js',contents:lock.mathUtilsExports.map(name=>'export const '+name+'=globalThis.__NPC_THREE__.MathUtils'+(name==='MathUtils'?'':'.'+name)+';').join('\n')}));
  }};
  const entry=Object.entries(threeAdditionalEntries).map(([name,file])=>'export {'+name+'} from '+JSON.stringify('./'+file)+';').join('\n');
  const built=await esbuild.build({stdin:{contents:entry,resolveDir:officialThreeRoot,sourcefile:'r07-missing-classes.js',loader:'js'},bundle:true,write:false,format:'iife',globalName:'__NPC_THREE_ADDITIONS__',platform:'browser',target:['es2022'],charset:'utf8',minify:true,legalComments:'inline',metafile:true,plugins:[aliases]});
  const sourceInputs=Object.keys(built.metafile.inputs).filter(file=>!file.startsWith('native-base:')&&!file.startsWith('native-math-utils:')&&!file.includes('r07-missing-classes.js'));
  for(const input of sourceInputs){const file=path.resolve(input),relative=path.relative(path.dirname(officialThreeRoot),file).replaceAll(path.sep,'/');assert.equal(hash(fs.readFileSync(file)),lock.files[relative],'Official Three source integrity '+relative);}
  assert(!sourceInputs.some(file=>/WebGLRenderer|WebGLBackend|common\/Renderer|renderers\/webgl/.test(file)),'A second renderer must never be bundled');
  const bundle=built.outputFiles[0].text;
  new vm.Script(bundle,{filename:'native-three-additions.js'});
  const install=bundle+'\n;(()=>{const original=globalThis.__NPC_THREE__;for(const name of Object.keys(__NPC_THREE_ADDITIONS__))if(name in original)throw Error("Duplicate native Three class: "+name);globalThis.__NPC_THREE__=Object.freeze({...original,...__NPC_THREE_ADDITIONS__});})();';
  return {bundle,install,sourceInputs,report:{version:'0.170.0',tarballURL:lock.tarballURL,tarballIntegrity:lock.tarballIntegrity,tarballSHA256:lock.tarballSHA256,additionalClasses:Object.keys(threeAdditionalEntries),nativeAliases:Object.values(nativeModuleAliases).flat(),secondRenderer:false,bytes:Buffer.byteLength(install),sha256:hash(install),officialInputs:sourceInputs.map(file=>path.relative(path.dirname(officialThreeRoot),path.resolve(file)).replaceAll(path.sep,'/'))}};
}

async function loadNativeThreeForQA(options={}) {
  const original=fs.readFileSync(hostPath);assert.equal(hash(original),HOST_SHA256);
  const native=verifyNativeExports(original.toString('utf8')),additions=options.additions||await buildThreeAdditions();
  const context={console,__NPC_THREE__:Object.freeze({REVISION:'170',...native})};
  vm.runInNewContext(additions.install,context,{timeout:10000});
  const t=context.__NPC_THREE__;
  for(const name of Object.keys(native))assert.equal(t[name],native[name],'Preserve native constructor identity '+name);
  for(const name of allThreeNames)assert.notEqual(t[name],undefined,'Complete wardrobe Three export '+name);
  assert(new t.InstancedBufferGeometry() instanceof native.BufferGeometry);
  assert(new t.InstancedBufferAttribute(new Float32Array(6),3) instanceof native.BufferAttribute);
  assert(new t.RawShaderMaterial() instanceof native.ShaderMaterial);
  assert(new t.Raycaster().ray instanceof native.Ray);
  const shape=new t.Shape();shape.moveTo(0,0);shape.lineTo(1,0);shape.lineTo(1,1);shape.lineTo(0,1);shape.closePath();
  const hole=new t.Path();hole.moveTo(.25,.25);hole.lineTo(.25,.75);hole.lineTo(.75,.75);hole.lineTo(.75,.25);hole.closePath();shape.holes.push(hole);
  const extrude=new t.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:false});
  assert(extrude instanceof native.BufferGeometry);assert(extrude.attributes.position.count>0);extrude.dispose();
  return t;
}

async function buildClothWorker() {
  const entry=path.join(here,'vendor/appearance/cloth-adapted/geometry-worker.mjs');
  assert(fs.existsSync(entry),'Exact inherited cloth geometry worker must be prepared');
  const esbuild=findEsbuild();
  const pureMathNames=['Vector2','Vector3','Vector4','Matrix3','Matrix4','Quaternion','Euler','Color','Box3','Sphere','Triangle','MathUtils'];
  const built=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'iife',platform:'browser',target:['es2022'],charset:'utf8',minify:true,legalComments:'inline',metafile:true,plugins:[{name:'worker-pure-three-math-only',setup(build){
    build.onResolve({filter:/^three$/},()=>({path:'pure-math',namespace:'worker-three'}));
    build.onLoad({filter:/.*/,namespace:'worker-three'},()=>({loader:'js',resolveDir:officialThreeRoot,contents:pureMathNames.map(name=>'export {'+name+'} from "./math/'+name+'.js";').join('\n')}));
  }}]});
  const code=built.outputFiles[0].text;new vm.Script(code,{filename:'embedded-cloth-geometry-worker.js'});
  const inputs=Object.keys(built.metafile.inputs).filter(file=>!file.startsWith('worker-three:'));
  assert(!inputs.some(file=>/renderers\//.test(file)),'Worker must contain no renderer');
  assert(!/\bimport\s*(?:\(|[{*])/.test(code),'Embedded worker must have no runtime imports');
  return {code,inputs,report:{sourceEntry:'vendor/appearance/cloth-adapted/geometry-worker.mjs',sourceSHA256:hash(fs.readFileSync(entry)),bytes:Buffer.byteLength(code),sha256:hash(code),inlineBlob:true,externalImports:false,rendererIncluded:false}};
}

function embeddedNativeFaceTextures(html) {
  const lock = JSON.parse(fs.readFileSync(faceLockPath, 'utf8'));
  assert.equal(lock.canonicalSHA256, HOST_SHA256, 'Face textures belong to this exact R07 source');
  assert.deepEqual(lock.files.map(file => file.name), ['detail.png', 'chroma.png']);
  const dataURIs = {};
  for (const file of lock.files) {
    const bytes = fs.readFileSync(path.join(here, 'vendor', file.local));
    assert.equal(bytes.length, file.bytes, 'Native face texture size ' + file.name);
    assert.equal(hash(bytes), file.sha256, 'Native face texture SHA ' + file.name);
    assert.equal(file.mimeType, 'image/png');
    assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Native face PNG signature ' + file.name);
    assert.equal(bytes.toString('ascii',12,16), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), file.width);
    assert.equal(bytes.readUInt32BE(20), file.height);
    assert.equal(bytes[24], file.bitDepth);
    assert.equal(bytes[25], file.colorType);
    dataURIs[file.name] = 'data:image/png;base64,' + bytes.toString('base64');
  }
  // Only replace the transport argument of the original TextureLoader call.
  // Its original NoColorSpace/flipY/wrap/mipmap/filter then-clause is retained.
  html = patch(html,
    'new URL("./assets/"+e,"' + lock.sourceModuleURL + '").href',
    '(' + JSON.stringify(dataURIs) + ')[e]');
  const license = fs.readFileSync(path.join(here, 'vendor', lock.license.local));
  assert.equal(license.length, lock.license.bytes, 'Native face license size');
  assert.equal(hash(license), lock.license.sha256, 'Original native face license retained');
  // The source UI already includes the attribution link. Keep it functional
  // without a network dependency, retaining all source credits verbatim.
  html = patch(html,
    'new URL("./THIRD_PARTY.txt","' + lock.sourceModuleURL.replace('FaceSkin.mjs','FaceUI.mjs') + '").href',
    JSON.stringify('data:text/plain;charset=utf-8;base64,' + license.toString('base64')));
  return {html, report:{
    mode:'embedded-original-png-data-uri',
    sourceCommit:lock.sourceCommit, lockSHA256:hash(fs.readFileSync(faceLockPath)),
    files:lock.files, license:lock.license,
    unchangedTextureSettings:lock.unchangedTextureSettings,
    resampled:false, recolored:false, originalLicenseEmbedded:true
  }};
}

function embeddedNativeAssets(manifestBytes) {
  const lockPath = path.join(here,'vendor/PACKETS.json');
  assert(fs.existsSync(lockPath), 'Offline packet cache missing. Run prepare.cjs --packets <observed native packet IDs> or --all-native.');
  const lock = JSON.parse(fs.readFileSync(lockPath,'utf8'));
  assert.equal(lock.sourceManifestSHA256,hash(manifestBytes),'Offline cache belongs to this exact native manifest');
  assert(lock.packetIds.includes('hot'), 'Offline cache must include the original hot packet');
  const chunks = {};
  for (const chunk of lock.chunks) {
    const bytes = fs.readFileSync(path.join(here,'vendor/assets',chunk.local));
    assert.equal(bytes.byteLength,chunk.bytes,'Offline chunk size '+chunk.local);
    assert.equal(hash(bytes),chunk.sha256,'Offline chunk hash '+chunk.local);
    chunks[chunk.url] = bytes.toString('base64');
  }
  // The legacy streaming transport captures fetch during its initialization, so
  // install this in <head> before the unmodified source runtime starts. Original
  // packet/chunk SHA validation continues to run on every served byte buffer.
  const script = `(function(){
const entries=${JSON.stringify(chunks)},decoded=new Map();
const state={mode:'embedded',packetIds:${JSON.stringify(lock.packetIds)},allNativePackets:${lock.allNativePackets},compressedBytes:${lock.compressedBytes},served:[],missing:[],networkRequests:0};
window.__NPC_ASSETS__=state;
const fetchNative=globalThis.fetch.bind(globalThis);
globalThis.fetch=async function(input,init){
 const url=new URL(typeof input==='string'?input:input.url||String(input),location.href).href;
 const signal=init&&init.signal||(input&&input.signal);if(signal&&signal.aborted)throw new DOMException('The operation was aborted','AbortError');
 if(Object.prototype.hasOwnProperty.call(entries,url)){
  if(!decoded.has(url)){const encoded=entries[url],binary=atob(encoded),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);decoded.set(url,bytes);entries[url]=null;}
  const bytes=decoded.get(url);state.served.push(url);
  return new Response(bytes,{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.byteLength),'X-NPC-Asset':'embedded-native'}});
 }
 if(url.startsWith('data:')||url.startsWith('blob:'))return fetchNative(input,init);
 state.missing.push(url);throw Error('Standalone native asset was not embedded: '+url);
};
})();`;
  return {lock,script};
}

function localNativeAssets() {
  const lock=JSON.parse(fs.readFileSync(path.join(here,'vendor/PACKETS.json'),'utf8'));
  const local={};fs.mkdirSync(path.join(here,'dist/assets'),{recursive:true});
  for(const chunk of lock.chunks){
    const p=path.join(here,'vendor/assets',chunk.local);
    assert.equal(hash(fs.readFileSync(p)),chunk.sha256,'Local chunk integrity '+chunk.local);
    const out=path.join(here,'dist/assets',chunk.local);
    if(!fs.existsSync(out)||hash(fs.readFileSync(out))!==chunk.sha256)fs.copyFileSync(p,out);
    local[chunk.url]={file:'assets/'+chunk.local,bytes:chunk.bytes,sha256:chunk.sha256};
  }
  const script=`(()=>{
const entries=${JSON.stringify(local)},realFetch=globalThis.fetch.bind(globalThis);
const state={mode:'same-origin-native-packets',served:[],completed:[],failed:[],missing:[]};window.__NPC_ASSETS__=state;
globalThis.fetch=async function(input,init){
 const u=new URL(typeof input==='string'?input:input.url||String(input),location.href).href,entry=entries[u];
 if(entry){
  state.served.push(u);
  try{
   const response=await realFetch(new URL(entry.file,location.href).href,init);
   if(!response.ok)throw Error('Native chunk HTTP '+response.status+': '+entry.file);
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength!==entry.bytes)throw Error('Native chunk byte length mismatch: '+entry.file);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
   if(digest!==entry.sha256)throw Error('Native chunk SHA256 mismatch: '+entry.file);
   state.completed.push({url:u,bytes:bytes.byteLength,sha256:digest,networkBodyFullyRead:true});
   return new Response(bytes,{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.byteLength),'X-NPC-Asset':'verified-same-origin-native'}});
  }catch(error){state.failed.push({url:u,message:String(error.message||error)});throw error;}
 }
 if(u.startsWith('data:')||u.startsWith('blob:')||u.startsWith(location.origin+'/'))return realFetch(input,init);
 state.missing.push(u);throw Error('Unregistered runtime dependency: '+u);
};})();`;
  return {lock,script};
}

async function main() {
  const motionSourceVerification=verifyMotionSources();
  const original = fs.readFileSync(hostPath);
  assert.equal(hash(original), HOST_SHA256, 'Canonical R07 host changed; re-audit before adapting');
  assert.equal(original.byteLength, 5449139, 'Canonical R07 host byte count');
  verifyNativeExports(original.toString('utf8'));
  const threeAdditions=await buildThreeAdditions();
  await loadNativeThreeForQA({additions:threeAdditions});
  const required=JSON.parse(fs.readFileSync(path.join(here,'vendor/appearance/required-three-exports.json'),'utf8'));
  assert(required.every(name=>allThreeNames.includes(name)),'Every inherited appearance Three dependency must be exported');
  const clothWorker=await buildClothWorker();
  const threeLicense=fs.readFileSync(path.join(here,'vendor/three-additions/three-0.170.0/LICENSE'),'utf8');
  let html = exposeNativeThree(original.toString('utf8'));
  const nativeFaceTextures = embeddedNativeFaceTextures(html);
  html = nativeFaceTextures.html;

  // R06 already starts native idle lazily. This second guard prevents a hidden
  // original control from triggering the expensive facial bake during actor work.
  html = patch(html, 'invalidate(){if(this.disposed)return;',
    'invalidate(){if(this.disposed)return;if(window.__MOTION_DEFER_IDLE__){this.ready=!1;this.status="面部通道按需校准";return;}');

  // The source catalogue is hidden in this observation page. Its thumbnails are
  // not part of the native model, material, eyes or weights. Preserve their URLs
  // as metadata while preventing unused catalogue image/metadata network work.
  html = patch(html, 'N.src=new URL("../assets/"+C.previewFolder+',
    'N.dataset.nativePreview=new URL("../assets/"+C.previewFolder+');
  html = patch(html, 'for(let C of["presets-r02"])fetch(', 'for(let C of[])fetch(');

  const cannonPath = path.join(here, 'vendor/cannon-es.js');
  assert.equal(hash(fs.readFileSync(cannonPath)), CANNON_SHA256, 'Official cannon-es 0.20.0 changed');
  const cannonLicense = fs.readFileSync(path.join(here,'vendor/cannon-es.LICENSE'),'utf8');
  assert.equal(hash(cannonLicense),'4714d0272f50cb21fe46fe29333c7c600d3c85b5ebd2a80f4db07e8cfccbf5b2','Cannon MIT license retained');
  const manifestBytes = fs.readFileSync(path.resolve(here, 'vendor/StreamingManifest.json'));
  const assets = JSON.parse(manifestBytes);
  const offline = process.argv.includes('--offline');
  const embedded = offline ? embeddedNativeAssets(manifestBytes) : localNativeAssets();
  const requiredPackets=JSON.parse(fs.readFileSync(path.join(here,'evidence/SIX_BODY_REQUIRED_PACKETS.json'),'utf8'));
  assert.equal(requiredPackets.canonicalSHA256,HOST_SHA256);
  assert.equal(new Set(requiredPackets.packetIds).size,23,'Six-body native packet lower bound');
  for(const id of requiredPackets.packetIds)assert(embedded.lock.packetIds.includes(id),'R02 cannot use the old two-person packet set; missing '+id);
  const report = {
    schema: 'kaopu/npc-living-street-build@2',
    version: VERSION,
    sourceHead:process.env.SOURCE_HEAD||process.env.GITHUB_SHA||null,
    canonicalVersion: 'HUMAN-INTEGRATED-R07',
    canonicalCommit: CANONICAL_SHA,
    canonicalPath: 'kaopu-unified-human-workbench/human-integrated-r07/preview.html',
    canonicalSHA256: HOST_SHA256,
    canonicalBytes: original.byteLength,
    adaptedFromCanonicalWithoutOverwriting: true,
    sameDocument: true,
    iframe: false,
    sameThreeRuntime: true,
    threeRevision: '170',
    threeAdditions:threeAdditions.report,
    clothWorker:clothWorker.report,
    appearanceSourceLockSHA256:hash(fs.readFileSync(path.join(here,'appearance-source-lock.json'))),
    motionSourceVerification,
    cannonVersion: '0.20.0',
    cannonSHA256: CANNON_SHA256,
    nativeGeometryRetained: true,
    allNativeCoefficientsRetained: true,
    nativeSkinAndEyeTexturesRetained: true,
    nativeFaceTextures: nativeFaceTextures.report,
    idleCalibration: 'deferred',
    hiddenCatalogueThumbnails: 'not-requested',
    assetMode: offline ? 'embedded-native-packets' : 'same-origin-native-packets',
    standalone: offline,
    embeddedPacketIds: offline ? (embedded?.lock.packetIds || []) : [],
    packagedNativePacketIds:embedded.lock.packetIds,
    packagedNativeChunkCount:embedded.lock.chunks.length,
    packagedNativeCompressedBytes:embedded.lock.compressedBytes,
    packetLockSHA256:hash(fs.readFileSync(path.join(here,'vendor/PACKETS.json'))),
    embeddedCompressedBytes: offline ? (embedded?.lock.compressedBytes || 0) : 0,
    completeNativeArchiveEmbedded: offline && (embedded?.lock.allNativePackets || false),
    standaloneRuntimeVerified: false,
    nativePacketCount: assets.files.length,
    nativeChunkCount: assets.files.reduce((sum, file) => sum + file.chunks.length, 0),
    nativeCompressedBytes: assets.files.reduce((sum, file) => sum + file.bytes, 0),
    nativeBase: 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/',
    visualAcceptance: false,
    productionReady: false
  };

  // Syntax-check every inline program after the bounded host changes. The native
  // HTML remains unchanged on disk, and no renderer / model is executed in Node.
  for (const [i, script] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()) {
    new vm.Script(script[1], {filename: 'adapted-r07-inline-' + i});
  }
  if (process.argv.includes('--check-host')) {
    console.log(JSON.stringify({...report, structuralChecksPassed: true, threeExports: allThreeNames}, null, 2));
    return;
  }

  const entry = path.join(here, 'src/Workbench.mjs');
  assert(fs.existsSync(entry), 'Workbench.mjs entry is required');
  const esbuild = findEsbuild();
  const built = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, format: 'iife', platform: 'browser',
    target: ['es2022'], charset: 'utf8', minify: true, legalComments: 'inline',
    metafile: true, plugins: [threeAliasPlugin()]
  });
  const workbench = built.outputFiles[0].text;
  new vm.Script(workbench, {filename: 'npc-living-street-workbench.js'});
  const cssPaths = ['styles.css', 'workbench.css'].map(file => path.join(here, file)).filter(file => fs.existsSync(file));
  const css = cssPaths.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const bootstrap = {
    version: VERSION, canonicalVersion: report.canonicalVersion,
    canonicalSHA256: HOST_SHA256, cannonVersion: report.cannonVersion,
    sourceHead:report.sourceHead,assetMode: report.assetMode, sameThreeRuntime: true
  };
  html = patch(html, '</head>',
    '<script>window.__MOTION_DEFER_IDLE__=true;window.__NPC_LIFE_BUILD__=' + JSON.stringify(bootstrap) + ';window.__NPC_BUILD__=window.__NPC_LIFE_BUILD__;</script>' +
    (embedded ? '<script data-npc-native-assets>' + embedded.script.replaceAll('</script', '<\\/script') + '</script>' : '') +
    (css ? '<style data-npc-workbench-style>' + css.replaceAll('</style', '<\\/style') + '</style>' : '') + '</head>');
  // The official LICENSE already contains a complete /* ... */ block. Keep it
  // as-is; wrapping it in another block comment would leave a stray closing */
  // and prevent the entire observation script from parsing in the browser.
  const bridge='/*! Three.js 0.170.0 additions; canonical renderer retained.\n'+threeLicense.replaceAll('*/','* /')+'*/\n'+threeAdditions.install+
    '\n;globalThis.__NPC_CLOTH_WORKER_URL=URL.createObjectURL(new Blob(['+JSON.stringify(clothWorker.code)+'],{type:"text/javascript"}));\n'+
    'globalThis.__NPC_CLOTH_WORKER_BUILD__='+JSON.stringify(clothWorker.report)+';';
  html = patch(html, '</body>', '<script data-npc-native-bridge>'+bridge.replaceAll('</script','<\\/script')+'</script><script data-npc-workbench>/*! cannon-es 0.20.0 */\n' + cannonLicense + '\n' + workbench.replaceAll('</script', '<\\/script') + '</script></body>');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>街角日常 · KAOPU 六人生活街区 R02</title>');
  // Gate the actual final HTML, including wrappers, licenses and injected
  // bootstrap/asset scripts. Checking only the pre-insertion esbuild output
  // does not detect syntax errors introduced by HTML assembly.
  const finalScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(finalScripts.length,6,'All final inline scripts, native class bridge and worker are retained');
  const finalScriptSyntax=finalScripts.map((match,index)=>{
    new vm.Script(match[1],{filename:'final-npc-html-script-'+index+'.js'});
    return {index,bytes:Buffer.byteLength(match[1]),sha256:hash(match[1])};
  });
  assert.equal(hash(fs.readFileSync(hostPath)), HOST_SHA256, 'Build must not mutate the canonical source');
  const outputPath = path.join(here, offline ? 'standalone.html' : 'dist/index.html');
  fs.writeFileSync(outputPath, html);
  const sourceFiles = [...new Set(Object.keys(built.metafile.inputs).filter(file => !file.startsWith('r07-native:'))
    .concat(threeAdditions.sourceInputs,clothWorker.inputs,faceLockPath,...cssPaths,
      path.join(here,'vendor/three-additions/THREE-SOURCE-LOCK.json'),
      path.join(here,'appearance-source-lock.json'),path.join(here,'motion-source-lock.json'),
      path.join(here,'evidence/SIX_BODY_REQUIRED_PACKETS.json')))
    .values()].map(file=>path.relative(here,path.resolve(file)).replaceAll(path.sep,'/')).sort();
  Object.assign(report, {
    builtAt: new Date().toISOString(), esbuildVersion: esbuild.version,
    previewBytes: Buffer.byteLength(html), previewSHA256: hash(html),
    workbenchBytes: Buffer.byteLength(workbench), sourceFiles,
    adapterSHA256:hash(fs.readFileSync(__filename)),finalInlineScriptSyntaxChecked:true,finalScriptSyntax,
    sourceSHA256: Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.resolve(here,file)))])),
    styleFiles: cssPaths.map(file => path.basename(file))
  });
  fs.writeFileSync(path.join(here, offline ? 'BUILD.standalone.json' : 'BUILD.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({version: VERSION, outputPath, previewBytes: report.previewBytes, previewSHA256: report.previewSHA256, assetMode: report.assetMode, sameThreeRuntime: true}, null, 2));
}

module.exports={loadNativeThreeForQA,buildThreeAdditions,buildClothWorker,nativeThree,allThreeNames};
if(require.main===module)main().catch(error => {console.error(error);process.exitCode = 1;});

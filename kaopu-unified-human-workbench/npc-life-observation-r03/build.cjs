#!/usr/bin/env node
'use strict';
/**
 * NPC-LIFE-OBSERVATION-R03 packaging adapter.
 * The canonical R07 source is read, SHA-locked, and NEVER overwritten.
 * Native R07 mesh, coefficients, skin functions, eye textures and renderer stay
 * in their original bundle. The new workbench runs in that same document.
 *
 * node prepare.cjs      # fixed build compiler + official Cannon dependency
 * node build.cjs        # complete standalone preview.html for publication/QA
 * The same exact bytes are used for file-protocol and public HTTPS verification.
 * node build.cjs --check-host  # structural host/THREE checks, writes nothing
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {standalonePayload}=require('./StandalonePayload.cjs');
const {patchNativeBoot,nativeBootScript}=require('./NativeBootPatch.cjs');

const VERSION = 'NPC-LIFE-OBSERVATION-R03';
const CANONICAL_SHA = '5543f756ca3af1428323696324303fa70b8de850';
const HOST_SHA256 = 'd1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const CANNON_SHA256 = 'f0700cbd3a482954949b9d58c1b0f76dcc74767750297647a39d8c40dd63d37c';
const here = __dirname;
const hostPath = path.resolve(here, '../human-integrated-r07/preview.html');
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
  // Constants are the existing R07 symbols, not a duplicate constants module.
  FrontSide: 'fn', BackSide: 'B0', DoubleSide: 'Z0',
  RGBAFormat: 'ht', FloatType: 'Ft', UnsignedByteType: 'Ln',
  NearestFilter: '_t', LinearFilter: 'Et', LinearMipmapLinearFilter: 'L0',
  ClampToEdgeWrapping: 'Dt', RepeatWrapping: 'v2',
  SRGBColorSpace: '$t', LinearSRGBColorSpace: 'Q0', NoColorSpace: 'r0'
};

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
          Object.keys(nativeThree).concat('REVISION').map(name => 'export const ' + name + ' = native.' + name + ';').join('\n') +
          '\nexport default native;'
      }));
    }
  };
}


async function main() {
  const original = fs.readFileSync(hostPath);
  assert.equal(hash(original), HOST_SHA256, 'Canonical R07 host changed; re-audit before adapting');
  assert.equal(original.byteLength, 5449139, 'Canonical R07 host byte count');
  verifyNativeExports(original.toString('utf8'));
  let html = patchNativeBoot(exposeNativeThree(original.toString('utf8')));

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

  html = patch(html, 'r.manager.itemStart(e),a.src=e,a', 'r.manager.itemStart(e),a.dataset.npcRequired=\"true\",a.src=window.__NPC_IMAGE_URL__(e),a');

  const cannonPath = path.join(here, 'vendor/cannon-es.js');
  assert.equal(hash(fs.readFileSync(cannonPath)), CANNON_SHA256, 'Official cannon-es 0.20.0 changed');
  const cannonLicense = fs.readFileSync(path.join(here,'vendor/cannon-es.LICENSE'),'utf8');
  assert.equal(hash(cannonLicense),'4714d0272f50cb21fe46fe29333c7c600d3c85b5ebd2a80f4db07e8cfccbf5b2','Cannon MIT license retained');
  const manifestBytes = fs.readFileSync(path.resolve(here, '../human-integrated-r06/StreamingManifest.json'));
  const assets = JSON.parse(manifestBytes);
  const offline = true;
  const embedded = standalonePayload(here,manifestBytes);
  const report = {
    schema: 'kaopu/npc-life-observation-build@3',
    version: VERSION,
    acceptedInteractionBaseline: '85718686d88585a449c3add050a089c45eee1207',
    interactionIncrement: 'bounded-standalone-boot-and-frame-acknowledged-continuous-observation',
    acceptedRuntimeBaseline:'339a687dcc64160bd78730c671b8926b62af55df',
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
    cannonVersion: '0.20.0',
    cannonSHA256: CANNON_SHA256,
    nativeGeometryRetained: true,
    allNativeCoefficientsRetained: true,
    nativeSkinAndEyeTexturesRetained: true,
    idleCalibration: 'deferred',
    hiddenCatalogueThumbnails: 'not-requested',
    assetMode: 'embedded-native-packets-and-images',
    standalone: offline,
    embeddedPacketIds: embedded?.lock.packetIds || [],
    embeddedCompressedBytes: embedded.lock.compressedBytes,
    embeddedOriginalImages:embedded.images,
    embeddedImageBytes:1374970,
    embeddedResourceBytes:embedded.embeddedBytes,
    expectedExternalCoreRequests:0,
    bootBudgetMS:180000,
    nativeRenderCallBudget:12,
    gpuFrameWaitBudgetMS:45000,
    defaultPlayback:'frame-acknowledged',
    maxSimulationSecondsPerObservedFrame:0.12,
    completeNativeArchiveEmbedded: embedded?.lock.allNativePackets || false,
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
    console.log(JSON.stringify({...report, structuralChecksPassed: true, threeExports: Object.keys(nativeThree)}, null, 2));
    return;
  }

  const entry = path.join(here, 'Workbench.mjs');
  assert(fs.existsSync(entry), 'Workbench.mjs entry is required');
  const esbuild = findEsbuild();
  const built = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, format: 'iife', platform: 'browser',
    target: ['es2022'], charset: 'utf8', minify: true, legalComments: 'inline',
    metafile: true, plugins: [threeAliasPlugin()]
  });
  const workbench = built.outputFiles[0].text;
  new vm.Script(workbench, {filename: 'npc-life-observation-workbench.js'});
  const monitorBuilt=await esbuild.build({entryPoints:[path.join(here,'BootMonitor.mjs')],bundle:true,write:false,format:'iife',platform:'browser',target:['es2022'],charset:'utf8',minify:true,metafile:true});
  const monitor=monitorBuilt.outputFiles[0].text;new vm.Script(monitor,{filename:'npc-early-boot-monitor.js'});
  const cssPaths = ['styles.css', 'workbench.css', 'BootShell.css'].map(file => path.join(here, file)).filter(file => fs.existsSync(file));
  const css = cssPaths.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const bootstrap = {
    version: VERSION, canonicalVersion: report.canonicalVersion,
    canonicalSHA256: HOST_SHA256, cannonVersion: report.cannonVersion,
    assetMode: report.assetMode, sameThreeRuntime: true
  };
  const escapeScript=s=>s.replaceAll('</script','<\\/script');
  // Keep the two original programs in their original order and closure. Only
  // their start time changes: the already visible shell gets two browser frames.
  const nativeScripts=[];
  html=html.replace(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g,(_,source)=>{nativeScripts.push(source);return '';});
  assert.equal(nativeScripts.length,2,'The complete two-script original R07 host');
  html=html.replace(/<meta\s+charset=["'][^"']+["']\s*\/?>(?:\s*)/gi,'');
  const early='<meta charset="utf-8">'+
    '<script data-npc-bootstrap>window.__MOTION_DEFER_IDLE__=true;window.__NPC_PROGRAMS__=[];window.__NPC_LIFE_BUILD__='+JSON.stringify(bootstrap)+';window.__NPC_BUILD__=window.__NPC_LIFE_BUILD__;</script>'+
    '<script data-npc-boot-monitor>'+escapeScript(monitor)+'</script>'+
    '<script data-npc-native-boot>'+escapeScript(nativeBootScript())+'</script>';
  html=patch(html,'<head>','<head>'+early);
  html=patch(html,'</head>','<style data-npc-workbench-style>'+css.replaceAll('</style','<\\/style')+'</style></head>');
  const shell=fs.readFileSync(path.join(here,'BootShell.html'),'utf8');
  const bodyTags=html.match(/<body\b[^>]*>/g);assert.equal(bodyTags?.length,1,'One original body element');html=patch(html,bodyTags[0],bodyTags[0]+shell);
  const staged=nativeScripts.map((source,i)=>'<script data-npc-original="'+i+'">window.__NPC_PROGRAMS__.push(function(){'+escapeScript(source)+'\n});</script>').join('');
  const runner=`(function(){
const state=window.__NPC_SHELL_PAINT__={firstRAFMS:null,secondRAFMS:null,payloadStartedAtMS:null,shellVisibleAtFirstRAF:false,shellVisibleAtSecondRAF:false};
function visible(){const e=document.getElementById('npc-boot-shell');if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}
requestAnimationFrame(t=>{state.firstRAFMS=t;state.shellVisibleAtFirstRAF=visible();requestAnimationFrame(u=>{state.secondRAFMS=u;state.shellVisibleAtSecondRAF=visible();try{window.__NPC_BOOT__.check();window.__NPC_BOOT__.stage('native-start','正在初始化完整人物与皮肤');state.payloadStartedAtMS=performance.now();for(const start of window.__NPC_PROGRAMS__)start();window.__NPC_PROGRAMS__=[];}catch(error){window.__NPC_BOOT__.fail(error,{code:'NATIVE_PROGRAM_START_FAILED'});}});});
})();`;
  html=patch(html,'</body>',
    '<script data-npc-native-assets>'+escapeScript(embedded.script)+'</script>'+staged+
    '<script data-npc-workbench>window.__NPC_PROGRAMS__.push(function(){/*! cannon-es 0.20.0 */\n'+cannonLicense+'\n'+escapeScript(workbench)+'\n});</script>'+
    '<script data-npc-start-after-shell>'+escapeScript(runner)+'</script></body>');
  html=html.replace(/<title>[^<]*<\/title>/,'<title>生活动作观察室 · NPC R03</title>');
  assert.equal((html.match(/<meta charset="utf-8">/g)||[]).length,1,'One canonical UTF-8 declaration');
  assert(Buffer.from(html).subarray(0,1024).includes(Buffer.from('<meta charset="utf-8">')),'UTF-8 declared before every script and within first 1024 bytes');
  // Gate the actual final HTML, including wrappers, licenses and injected
  // bootstrap/asset scripts. Checking only the pre-insertion esbuild output
  // does not detect syntax errors introduced by HTML assembly.
  const finalScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(finalScripts.length,8,'Both original programs plus six bounded boot/observation programs');
  const finalScriptSyntax=finalScripts.map((match,index)=>{
    new vm.Script(match[1],{filename:'final-npc-html-script-'+index+'.js'});
    return {index,bytes:Buffer.byteLength(match[1]),sha256:hash(match[1])};
  });
  assert.equal(hash(fs.readFileSync(hostPath)), HOST_SHA256, 'Build must not mutate the canonical source');
  const outputPath = path.join(here, 'preview.html');
  fs.writeFileSync(outputPath, html);
  const sourceFiles = [...new Set([...Object.keys(built.metafile.inputs),...Object.keys(monitorBuilt.metafile.inputs)])].filter(file => !file.startsWith('r07-native:'));
  Object.assign(report, {
    builtAt: new Date().toISOString(), esbuildVersion: esbuild.version,
    previewBytes: Buffer.byteLength(html), previewSHA256: hash(html),
    workbenchBytes: Buffer.byteLength(workbench), sourceFiles,
    adapterSHA256:hash(fs.readFileSync(__filename)),finalInlineScriptSyntaxChecked:true,finalScriptSyntax,
    sourceSHA256: Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.resolve(file)))])),
    styleFiles: cssPaths.map(file => path.basename(file)),
    buildModuleSHA256:Object.fromEntries(['build.cjs','prepare.cjs','AssetContract.cjs','StandalonePayload.cjs','NativeBootPatch.cjs','BootShell.html','BootShell.css'].map(f=>[f,hash(fs.readFileSync(path.join(here,f)))])),
    nativeScriptsRetained:2,shellFirstExecution:true
  });
  fs.writeFileSync(path.join(here, 'BUILD.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({version: VERSION, outputPath, previewBytes: report.previewBytes, previewSHA256: report.previewSHA256, assetMode: report.assetMode, sameThreeRuntime: true}, null, 2));
}

main().catch(error => {console.error(error);process.exitCode = 1;});

#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const {adaptBinding}=require('./binding-adapter.cjs');
const here=__dirname,root=path.resolve(here,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=fs.readFileSync(path.join(root,'native/r07-host.html'));
assert.equal(original.length,5449139);assert.equal(hash(original),'d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a');
let html=original.toString('utf8');
function patch(a,b,n=1){assert.equal(html.split(a).length,n+1,'Exact native anchor '+a);html=html.split(a).join(b);}
const nativeThree={Vector2:'Ae',Vector3:'V',Vector4:'yt',Quaternion:'Ot',Matrix3:'Je',Matrix4:'tt',Euler:'Jn',Color:'Ee',MathUtils:'gn',Object3D:'M0',Group:'Ht',Scene:'Qr',PerspectiveCamera:'d0',BufferGeometry:'Qe',BufferAttribute:'He',Float32BufferAttribute:'Ze',BoxGeometry:'p0',CylinderGeometry:'Cl',PlaneGeometry:'S0',SphereGeometry:'ra',Mesh:'st',MeshStandardMaterial:'wt',MeshBasicMaterial:'mn',Line:'El',LineSegments:'ud',LineBasicMaterial:'eo',GridHelper:'Fl',Texture:'D0',CanvasTexture:'Ds',DataTexture:'vt',Source:'fl',ShaderLib:'qn',UniformsUtils:'ey',ShaderMaterial:'K0',HemisphereLight:'ss',DirectionalLight:'Zn',Box3:'o0',FrontSide:'fn',BackSide:'B0',DoubleSide:'Z0',RGBAFormat:'ht',FloatType:'Ft',UnsignedByteType:'Ln',NearestFilter:'_t',LinearFilter:'Et',LinearMipmapLinearFilter:'L0',ClampToEdgeWrapping:'Dt',RepeatWrapping:'v2',SRGBColorSpace:'$t',LinearSRGBColorSpace:'Q0',NoColorSpace:'r0'};
patch('window.__IDENTITY_QA__=','window.__NPC_THREE__=Object.freeze({REVISION:"170",'+Object.entries(nativeThree).map(([k,v])=>k+':'+v).join(',')+'});window.__IDENTITY_QA__=');
patch('invalidate(){if(this.disposed)return;','invalidate(){if(this.disposed)return;if(window.__MOTION_DEFER_IDLE__){this.ready=!1;this.status="面部通道按需校准";return;}');
patch('N.src=new URL("../assets/"+C.previewFolder+','N.dataset.nativePreview=new URL("../assets/"+C.previewFolder+');
patch('for(let C of["presets-r02"])fetch(','for(let C of[])fetch(');
patch('r.manager.itemStart(e),a.src=e,a','r.manager.itemStart(e),a.src=window.__NATIVE_IMAGE_URL__(e),a');
const script=s=>s.replaceAll('</script','<\\/script');
const bootstrap=fs.readFileSync(path.join(here,'sha256.js'),'utf8')+'\n'+fs.readFileSync(path.join(here,'bootstrap.js'),'utf8');
patch('<meta charset="utf-8">','<meta charset="utf-8"><script data-native-bootstrap>'+script(bootstrap)+'</script>');
const css=fs.readFileSync(path.join(here,'viewer.css'),'utf8');
patch('</head>','<style data-native-viewer>'+css+'</style></head>');
const body=html.match(/<body\b[^>]*>/)[0];
patch(body,body+'<div id="native-loading"><div class="pulse"></div><div id="native-status">正在载入原生 R07 人物</div><div id="native-status-detail">完整人物、皮肤与 104 骨架</div></div><div id="native-corner"></div><details id="native-debug"><summary>显示诊断</summary><button id="native-debug-refresh" type="button">刷新诊断</button><pre id="native-debug-data">{"phase":"loading"}</pre></details>');
const bindingRaw=fs.readFileSync(path.join(root,'NativeBinding.mjs'),'utf8');
const rigRaw=fs.readFileSync(path.join(root,'NativeRig.mjs'),'utf8');
const binding=adaptBinding(bindingRaw).replace(/^import .*;\s*$/gm,'').replace(/^export \{THREE\};\s*$/gm,'').replace(/^export /gm,'');
const rig=rigRaw.replace(/^export /gm,'');
const entry=fs.readFileSync(path.join(here,'viewer.js'),'utf8');
const bundled='(()=>{\nconst BindingModule=(()=>{const THREE=window.__NPC_THREE__;\n'+binding+'\nreturn{NativeBinding,RigidPoseSampler,THREE};})();\nconst RigModule=(()=>{\n'+rig+'\nreturn{NativeRig,math};})();\n'+entry+'\n})();';
new vm.Script(bundled,{filename:'native-motion-viewer-bundle.js'});
patch('</body>','<script data-native-viewer>'+script(bundled)+'</script></body>');
html=html.replace(/<title>[^<]*<\/title>/,'<title>KAOPU · 原生人物动作观察</title>');
let count=0;for(const s of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){new vm.Script(s[1],{filename:'native-final-inline-'+count++});}
assert.equal(hash(fs.readFileSync(path.join(root,'native/r07-host.html'))),hash(original),'Do not mutate the canonical source');
fs.writeFileSync(path.join(here,'native.html'),html);
const manifest={schema:'kaopu/native-motion-viewer-build@1',version:'NATIVE-MOTION-VIEWER-R01',sourceHostSHA256:hash(original),sourceHostBytes:original.length,previewSHA256:hash(html),previewBytes:Buffer.byteLength(html),nativeGeometryRetained:true,nativeMaterialRetained:true,nativeWeightTruncation:false,duplicateThreeRuntime:false,idempotentNativeVertexHook:true,personCount:1,poseSystem:'104 fixed-bone native matrices, full CSR skinning',externalModelImported:false,assetMode:'SHA-locked local sidecars',scriptsSyntaxChecked:count,sourceFiles:Object.fromEntries(['sha256.js','bootstrap.js','viewer.js','viewer.css','build.cjs','binding-adapter.cjs','prepare.py'].map(f=>[f,hash(fs.readFileSync(path.join(here,f)))])),bindingSHA256:hash(bindingRaw),rigSHA256:hash(rigRaw),runtimeVerified:false};
fs.writeFileSync(path.join(here,'BUILD.json'),JSON.stringify(manifest,null,2)+'\n');
if(process.argv.includes('--dist')){
  const dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
  const deployed=html.replace('<script data-native-bootstrap>','<script data-native-bootstrap>window.__NATIVE_ASSET_BASE__="native-assets/";');
  fs.writeFileSync(path.join(dist,'native.html'),deployed);
  fs.mkdirSync(path.join(dist,'native-assets'),{recursive:true});
  for(const file of fs.readdirSync(path.join(here,'assets')))fs.copyFileSync(path.join(here,'assets',file),path.join(dist,'native-assets',file));
  fs.copyFileSync(path.join(here,'SOURCE_LOCK.json'),path.join(dist,'native-assets','SOURCE_LOCK.json'));
  manifest.publicPreviewSHA256=hash(deployed);manifest.publicPreviewBytes=Buffer.byteLength(deployed);
  fs.writeFileSync(path.join(dist,'native-assets','BUILD.json'),JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({file:path.join(here,'native.html'),bytes:manifest.previewBytes,sha256:manifest.previewSHA256,distWritten:process.argv.includes('--dist')}));

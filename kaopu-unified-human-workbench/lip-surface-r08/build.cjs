'use strict';
/* Fixed R06 native person, plus the reviewed R08 appearance/controller layer. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const dir=__dirname,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseline=fs.readFileSync(process.env.BASELINE_PREVIEW_PATH||path.resolve(dir,'../lip-corner-r06/preview.html'));
const expected='a6f50aa8e1f7898da5e40b73fb7ab8476db7ca4a14505a6ffad2e8aca1f63cac';
if(hash(baseline)!==expected)throw Error('Immutable accepted R06 baseline bytes differ');
const source=process.env.SOURCE_SHA||process.env.GITHUB_SHA||'local-unpublished';
const modules=['src/SurfaceMaterial.js','src/SurfaceLip.js'].map(name=>({name,text:fs.readFileSync(path.join(dir,name),'utf8')}));
for(const m of modules){new vm.Script(m.text,{filename:m.name});if(m.text.includes('</script'))throw Error('Unsafe script terminator');}
const isolated={window:{}};vm.runInNewContext(modules.find(m=>m.name==='src/SurfaceMaterial.js').text,isolated,{timeout:1000,filename:'reviewed-SurfaceMaterial.js'});
const material=isolated.window.__LIP_SURFACE_MATERIAL__,surfaceModes=Array.from(material?.modes||[]),fragmentChanges=Array.from(material?.patchIds||[]);
if(material?.version!=='native-lip-surface@2'||JSON.stringify(surfaceModes)!==JSON.stringify(['r08','r06']))throw Error('Unexpected reviewed surface implementation or modes');
if(!fragmentChanges.length||new Set(fragmentChanges).size!==fragmentChanges.length||fragmentChanges.some(id=>typeof id!=='string'||!id))throw Error('Missing unique reviewed fragment patch IDs');
// Literal coordinate binding is proved against the actual original GPU shader
// during public verification. A source-only build records its reviewed IDs.
const metadata={version:'LIP-SURFACE-R08',sourceCommit:source,baselineSource:'1e1e216c2005f4c318da190e1b3b160cc4bd4a6d',baselineBuild:'1237284ea60f9c198b2b63543f098a7551a9af2f',baselineSHA256:expected,modules:Object.fromEntries(modules.map(m=>[m.name,hash(m.text)]))};
const suffix='\n<!-- LIP-SURFACE-R08 APPEND-ONLY NATIVE APPEARANCE -->\n<script>window.__LIP_SURFACE_SOURCE__='+JSON.stringify(metadata)+';\n'+modules.map(m=>m.text).join('\n')+'\n</script>\n';
const host=baseline.toString('utf8'),at=host.lastIndexOf('</body>');if(at<0)throw Error('Missing host closing body');
const preview=host.slice(0,at)+suffix+host.slice(at);
if(preview.replace(suffix,'')!==host)throw Error('R06 ancestor restoration differs');
const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>hash(m[1]));
const inherited=scripts(host),current=scripts(preview);
if(JSON.stringify(current.slice(0,inherited.length))!==JSON.stringify(inherited))throw Error('An inherited script changed');
const manifest={...metadata,previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),originalScriptHashes:inherited,baselineRestorationExact:true,
 nativeGeometryChanged:false,canonicalGeometryChanged:false,materialChanged:true,surfaceImplementation:material.version,archiveSchema:'kaopu/lip-surface@2',surfaceModes,fragmentChanges,
 originalAuthoringValuesChanged:false,newUniforms:0,newMeshes:0,newImageMaps:0,lightingChanged:false,
 standaloneOffline:false,inheritedStreamingAssets:true,visualAcceptance:false,productionReady:false,buildTime:new Date().toISOString()};
fs.writeFileSync(path.join(dir,'preview.html'),preview);fs.writeFileSync(path.join(dir,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version:metadata.version,source,previewSHA256:manifest.previewSHA256,previewBytes:manifest.previewBytes,baselineRestorationExact:true}));

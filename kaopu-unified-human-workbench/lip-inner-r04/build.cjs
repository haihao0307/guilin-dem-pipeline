/* R04: exact immutable R02 ancestor, isolated appended specialist. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const dir=__dirname,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseline=fs.readFileSync(process.env.BASELINE_PREVIEW_PATH||path.resolve(dir,'../lip-realism-r02/preview.html'));
const expected='ccc7af8e97969667bf63ab8bbc61e845d95e7b5e7f70adb167a662a63c0cb571';
if(hash(baseline)!==expected)throw Error('Immutable R02 baseline bytes differ');
const source=process.env.SOURCE_SHA||process.env.GITHUB_SHA||'local-unpublished';
const modules=['MucosaSurface.js','InnerLip.js'].map(name=>({name,text:fs.readFileSync(path.join(dir,name),'utf8')}));
for(const module of modules){new vm.Script(module.text,{filename:module.name});if(module.text.includes('</script'))throw Error('Unsafe script terminator');}
const metadata={version:'LIP-INNER-R04',sourceCommit:source,baselineSource:'01cfde47476b7be6764e9c6a79d925462511539b',baselineBuild:'ba0c4eb337e03997878aecaf477d8ec3fe8b7231',baselineSHA256:expected,modules:Object.fromEntries(modules.map(m=>[m.name,hash(m.text)]))};
const suffix='\n<!-- LIP-INNER-R04 APPEND-ONLY SPECIALIST -->\n<script>window.__LIP_INNER_SOURCE__='+JSON.stringify(metadata)+';\n'+modules.map(m=>m.text).join('\n')+'\n</script>\n';
const host=baseline.toString('utf8'),at=host.lastIndexOf('</body>');if(at<0)throw Error('Missing host closing body');
const preview=host.slice(0,at)+suffix+host.slice(at);
if(preview.replace(suffix,'')!==host)throw Error('R02 ancestor restoration differs');
const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>hash(m[1]));
const inherited=scripts(host),current=scripts(preview);
if(JSON.stringify(current.slice(0,inherited.length))!==JSON.stringify(inherited))throw Error('An inherited script changed');
const manifest={...metadata,previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),originalScriptHashes:inherited,baselineRestorationExact:true,nativeGeometryChanged:false,canonicalGeometryChanged:false,newMeshes:0,newImageMaps:0,lightingChanged:false,standaloneOffline:false,inheritedStreamingAssets:true,visualAcceptance:false,productionReady:false,buildTime:new Date().toISOString()};
fs.writeFileSync(path.join(dir,'preview.html'),preview);fs.writeFileSync(path.join(dir,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version:metadata.version,source,previewSHA256:manifest.previewSHA256,previewBytes:manifest.previewBytes,baselineRestorationExact:true}));

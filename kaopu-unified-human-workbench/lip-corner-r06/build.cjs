/* Preserve the fixed R05 host byte-for-byte and append the reviewed R06 layer. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const dir=__dirname,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseline=fs.readFileSync(process.env.BASELINE_PREVIEW_PATH||path.resolve(dir,'../lip-motion-r05/preview.html'));
const expected='231cc60f696e1bfbe7831e5afb5bfb845f7358391dacd25bc3efa00c7a21710b';
if(hash(baseline)!==expected)throw Error('Immutable R05 baseline bytes differ');
const source=process.env.SOURCE_SHA||process.env.GITHUB_SHA||'local-unpublished';
const modules=['src/CornerContinuity.js','src/CornerLip.js'].map(name=>({name,text:fs.readFileSync(path.join(dir,name),'utf8')}));
for(const m of modules){new vm.Script(m.text,{filename:m.name});if(m.text.includes('</script'))throw Error('Unsafe script terminator');}
const metadata={version:'LIP-CORNER-R06',sourceCommit:source,baselineSource:'a8bba75322c12df151ecbcebc416087b5248aa5f',baselineBuild:'11ed0391f798b5323f4eb4aefec4307fc0b9aee0',baselineSHA256:expected,modules:Object.fromEntries(modules.map(m=>[m.name,hash(m.text)]))};
const suffix='\n<!-- LIP-CORNER-R06 APPEND-ONLY NATIVE CONTINUITY -->\n<script>window.__LIP_CORNER_SOURCE__='+JSON.stringify(metadata)+';\n'+modules.map(m=>m.text).join('\n')+'\n</script>\n';
const host=baseline.toString('utf8'),at=host.lastIndexOf('</body>');if(at<0)throw Error('Missing host closing body');
const preview=host.slice(0,at)+suffix+host.slice(at);
if(preview.replace(suffix,'')!==host)throw Error('R05 ancestor restoration differs');
const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>hash(m[1]));
const inherited=scripts(host),current=scripts(preview);
if(JSON.stringify(current.slice(0,inherited.length))!==JSON.stringify(inherited))throw Error('An inherited script changed');
const manifest={...metadata,previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),originalScriptHashes:inherited,baselineRestorationExact:true,nativeGeometryChanged:true,canonicalGeometryChanged:false,newMeshes:0,newImageMaps:0,lightingChanged:false,standaloneOffline:false,inheritedStreamingAssets:true,visualAcceptance:false,productionReady:false,buildTime:new Date().toISOString()};
fs.writeFileSync(path.join(dir,'preview.html'),preview);fs.writeFileSync(path.join(dir,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version:metadata.version,source,previewSHA256:manifest.previewSHA256,previewBytes:manifest.previewBytes,baselineRestorationExact:true}));

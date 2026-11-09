/* R05 preserves the exact fixed R04 host and appends a bounded native solver. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const dir=__dirname,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseline=fs.readFileSync(process.env.BASELINE_PREVIEW_PATH||path.resolve(dir,'../lip-inner-r04/preview.html'));
const expected='16e30c857d0f460b661845d557043a367638076dad920bd1966b34a59bedaae8';
if(hash(baseline)!==expected)throw Error('Immutable R04 baseline bytes differ');
const source=process.env.SOURCE_SHA||process.env.GITHUB_SHA||'local-unpublished';
const modules=['src/MotionContinuity.js','src/MotionLip.js'].map(name=>({name,text:fs.readFileSync(path.join(dir,name),'utf8')}));
for(const m of modules){new vm.Script(m.text,{filename:m.name});if(m.text.includes('</script'))throw Error('Unsafe script terminator');}
const metadata={version:'LIP-MOTION-R05',sourceCommit:source,baselineSource:'9d855c6051e76a20f052c95f0dda95103d946ef7',baselineBuild:'f70e40b301ea964956d9915ab820e4efe1105549',baselineSHA256:expected,modules:Object.fromEntries(modules.map(m=>[m.name,hash(m.text)]))};
const suffix='\n<!-- LIP-MOTION-R05 APPEND-ONLY NATIVE CONTINUITY -->\n<script>window.__LIP_MOTION_SOURCE__='+JSON.stringify(metadata)+';\n'+modules.map(m=>m.text).join('\n')+'\n</script>\n';
const host=baseline.toString('utf8'),at=host.lastIndexOf('</body>');if(at<0)throw Error('Missing host closing body');
const preview=host.slice(0,at)+suffix+host.slice(at);
if(preview.replace(suffix,'')!==host)throw Error('R04 ancestor restoration differs');
const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>hash(m[1]));
const inherited=scripts(host),current=scripts(preview);
if(JSON.stringify(current.slice(0,inherited.length))!==JSON.stringify(inherited))throw Error('An inherited script changed');
const manifest={...metadata,previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),originalScriptHashes:inherited,baselineRestorationExact:true,nativeGeometryChanged:true,canonicalGeometryChanged:false,newMeshes:0,newImageMaps:0,lightingChanged:false,standaloneOffline:false,inheritedStreamingAssets:true,visualAcceptance:false,productionReady:false,buildTime:new Date().toISOString()};
fs.writeFileSync(path.join(dir,'preview.html'),preview);fs.writeFileSync(path.join(dir,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version:metadata.version,source,previewSHA256:manifest.previewSHA256,previewBytes:manifest.previewBytes,baselineRestorationExact:true}));

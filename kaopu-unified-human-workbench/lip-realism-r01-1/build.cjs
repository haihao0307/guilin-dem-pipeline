/* Append-only lip specialist build. The accepted R07 and both original scripts
 * remain byte-identical. No ancestor rebuild, copying remote donor geometry,
 * deleting old acceptance evidence or modifying the canonical pointer. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,upstream=path.resolve(dir,'../human-integrated-r07/preview.html');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const expected='d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const bytes=fs.readFileSync(upstream);
if(hash(bytes)!==expected)throw Error('R07 frozen host hash mismatch; review the new host before integrating');
const host=bytes.toString('utf8'),moduleText=fs.readFileSync(path.join(dir,'LipSurface.js'),'utf8');
new (require('node:vm').Script)(moduleText,{filename:'LipSurface.js'});
if(moduleText.includes('</script'))throw Error('Unsafe inline script terminator');
const source=process.env.SOURCE_SHA||process.env.GITHUB_SHA||'local-unpublished';
const metadata={version:'LIP-REALISM-R01.1',sourceCommit:source,baseCommit:'5543f756ca3af1428323696324303fa70b8de850',inheritedLipVersion:'LIP-REALISM-R01',inheritedLipSourceCommit:'544ec81bcef6185a553df138585c7059e832a122',inheritedLipModuleSHA256:'0e3246b07a5f0a9f0f4de3298dcfc43ccf88c8018e55792c28225cb74b76b03d',hostSHA256:expected,moduleSHA256:hash(moduleText)};
const marker='<!-- LIP-REALISM-R01.1 APPEND-ONLY SPECIALIST -->';
const suffix='\n'+marker+'\n<script>window.__LIP_REALISM_SOURCE__='+JSON.stringify(metadata)+';\n'+moduleText+'\n</script>\n';
const at=host.lastIndexOf('</body>');if(at<0)throw Error('Frozen host closing body missing');
const preview=host.slice(0,at)+suffix+host.slice(at);
if(preview.replace(suffix,'')!==host)throw Error('Original host bytes changed');
const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>hash(m[1]));
const originals=scripts(host),result=scripts(preview);
if(JSON.stringify(result.slice(0,originals.length))!==JSON.stringify(originals))throw Error('Original scripts changed');
fs.writeFileSync(path.join(dir,'preview.html'),preview);
fs.writeFileSync(path.join(dir,'BUILD_MANIFEST.json'),JSON.stringify({...metadata,previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),originalScriptHashes:originals,hostRestorationExact:true,canonicalGeometryChanged:false,displayLipReliefAdjusted:true,referenceAssetsImported:0,newImageMaps:0,standaloneOffline:false,inheritedStreamingAssets:true,buildTime:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify({version:metadata.version,source,previewBytes:Buffer.byteLength(preview),previewSHA256:hash(preview),hostRestorationExact:true}));

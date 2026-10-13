import esbuild from 'esbuild';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
const p=path.dirname(fileURLToPath(import.meta.url)),source=process.env.GITHUB_SHA||'local-test',out=p+'/site';fs.mkdirSync(out+'/assets',{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),assets={};
function pack(name,raw,{gzip=false,texture=false}={}){
 const packed=gzip?gzipSync(raw,{level:9,mtime:0}):raw,chunks=[];
 for(let i=0;i<packed.length;i+=524288){const b=packed.subarray(i,i+524288),hash=sha(b),rel='assets/'+hash.slice(0,24)+'.dat';fs.writeFileSync(out+'/'+rel,b);chunks.push({path:rel,bytes:b.length,sha256:hash});}
 return assets[name]={name,bytes:raw.length,sha256:sha(raw),packedBytes:packed.length,gzip,texture,chunks};
}
pack('core',fs.readFileSync(p+'/build-data/core.bin'),{gzip:true});pack('deferred',fs.readFileSync(p+'/build-data/deferred.bin'),{gzip:true});
const plugin={name:'exact-png-blob-reference',setup(build){build.onLoad({filter:/\.png$/},args=>{const rel=path.relative(p,args.path).split(path.sep).join('/');if(!assets[rel])pack(rel,fs.readFileSync(args.path),{texture:true});return{contents:'export default globalThis.__HAIR_TEXTURES['+JSON.stringify(rel)+'];',loader:'js'};});}};
await esbuild.build({entryPoints:[p+'/src/app.js'],bundle:true,format:'esm',outfile:p+'/bundle.js',target:'es2022',minify:true,legalComments:'inline',plugins:[plugin],alias:{three:p+'/vendor/three.module.js'}});
pack('module',fs.readFileSync(p+'/bundle.js'),{gzip:true});
const manifest={version:'R14.2-L02',source,frozenAppearance:'c40a86c92b2fe37179e29a67628bf26303745d60',parentLoadfix:'bb5cb1dc9b451f6cd190fc726856a8ecbfb7244b',assets,original:JSON.parse(fs.readFileSync(p+'/build-data/original.json')),startupBytes:Object.values(assets).filter(a=>a.name!=='deferred').reduce((n,a)=>n+a.packedBytes,0),nativePages:true,qualityChanged:false};
let html=fs.readFileSync(p+'/index.html','utf8').replace('<link rel="stylesheet" href="workbench.css">','<style>'+fs.readFileSync(p+'/workbench.css','utf8')+'</style>');
html=html.replace('href="TEACHER_INDEX.md"','href="https://github.com/haihao0307/guilin-dem-pipeline/blob/'+source+'/kaopu-hair-workbench/fusion/r14-fast/README.md"');
html=html.replace('<script type="module" src="bundle.js"></script>','<script id="assetManifest" type="application/json">'+JSON.stringify(manifest).replace(/</g,'\\u003c')+'</script><script>'+fs.readFileSync(p+'/boot.js','utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace('<body>','<body><noscript>本工作台需要启用 JavaScript 才能显示三维人物。</noscript>');
html=html.replace('<summary>实际质量边界</summary>','<summary>实际质量边界</summary><p>本页为直接托管入口。此前 htmlpreview 入口的本机存档属于另一个网站，仍保留在那里；需用原入口导出 JSON，再在此导入。缓存不可用时会正常联网读取，不自动降低画质。</p>');
fs.writeFileSync(out+'/index.html',html);fs.writeFileSync(p+'/ASSET_MANIFEST.json',JSON.stringify(manifest,null,2));
fs.writeFileSync(out+'/THIRD_PARTY.txt',fs.readdirSync(p+'/licenses').map(n=>fs.readFileSync(p+'/licenses/'+n,'utf8')).join('\n\n')+'\n'+fs.readFileSync(p+'/native-head/face-transfer/THIRD_PARTY.txt','utf8')+'\n'+fs.readFileSync(p+'/native-head/eye-materials/THIRD_PARTY.md','utf8'));
const report={version:manifest.version,source,htmlBytes:Buffer.byteLength(html),htmlSha256:sha(Buffer.from(html)),startupAssetBytes:manifest.startupBytes,oldDocumentBytes:21035459,coreBytes:assets.core.bytes,corePackedBytes:assets.core.packedBytes,deferredPackedBytes:assets.deferred.packedBytes,modulePackedBytes:assets.module.packedBytes,textureBytes:Object.values(assets).filter(a=>a.texture).reduce((n,a)=>n+a.bytes,0),originalModelSha256:manifest.original.sha256,originalBasisPreserved:true,qualityChanged:false,publicBrowserVerified:false};
fs.writeFileSync(p+'/BUILD_MANIFEST.json',JSON.stringify(report,null,2));fs.writeFileSync(out+'/BUILD_MANIFEST.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const root=path.resolve(__dirname,'../..'),repo=path.dirname(root),out=path.resolve('qa-skin-quality-r01/public');fs.mkdirSync(out,{recursive:true});
 const baseline=fs.readFileSync(root+'/identity-lab/preview.html','utf8');assert.equal(hash(baseline),'99942c121ec46428e980568a6b0b82c5872359bf1a7576f600ac5fa1a4a952ad');
 const nativeSource=fs.readFileSync(root+'/full/ui/identity-app.generated.mjs','utf8');
 const plugin={name:'unchanged-native-asset-commits',setup(b){b.onResolve({filter:/\.(mjs|js)\?/},a=>({path:path.resolve(a.resolveDir,a.path.split('?')[0])}));b.onLoad({filter:/\.(mjs|js)$/},a=>{let s=fs.readFileSync(a.path,'utf8'),rel=path.relative(repo,a.path).split(path.sep).join('/');if(s.includes('import.meta.url'))s=s.replaceAll('import.meta.url',JSON.stringify('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+(rel.includes('/face-transfer/')?'02f596def9d07ebfc187e1eb18ad345a57c8a6b6':'0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe')+'/'+rel));return{contents:s,loader:'js',resolveDir:path.dirname(a.path)};});}};
 const built=await esbuild.build({entryPoints:[__dirname+'/PreviewEntry.mjs'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',alias:{three:root+'/full/source/registration-vendor/three.module.js'},plugins:[plugin]});
 assert.equal([...baseline.matchAll(/<script\b/g)].length,1);const code=built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
 let html=baseline.replace(/<script>[\s\S]*?<\/script>/,()=>'<script>'+code+'</script>').replace(/<title>[^<]*<\/title>/,'<title>共同人物 · R02 五官区域材质候选</title>');
 assert.equal([...html.matchAll(/<script\b/g)].length,1);assert.equal(fs.readFileSync(root+'/full/ui/identity-app.generated.mjs','utf8'),nativeSource);
 const manifest={schema:'kaopu/regional-preview@1',version:'regional-skin/r02',originalPreviewSHA256:hash(baseline),previewSHA256:hash(html),previewBytes:Buffer.byteLength(html),originalEntrySHA256:hash(nativeSource),nativeSceneRetained:true,newTextures:0,newGeometry:0,filmQualityAccepted:false,sources:Object.keys(built.metafile.inputs).filter(p=>p.includes('/skin-quality-r01/')).map(p=>({path:path.relative(repo,p),sha256:hash(fs.readFileSync(p))}))};
 fs.writeFileSync(out+'/preview.html',html);fs.writeFileSync(out+'/BUILD.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
})().catch(e=>{console.error(e);process.exit(1)});

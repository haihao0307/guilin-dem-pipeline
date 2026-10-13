const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const DEPS='3da5cddb8a55c868bc6a6f7108ba20b8cc1abcd1',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
// main contains this isolated entry, not an unreviewed merge of the ancestor
// branch chain. Build dependencies are materialized from an immutable commit.
if(!fs.existsSync(root+'/ear-tissue-r05/build-runtime.cjs')){
 const tmp=path.join(repo,'.ear-r06-build-deps');fs.mkdirSync(tmp,{recursive:true});cp.execFileSync('git',['fetch','--depth=1','origin',DEPS],{cwd:repo,stdio:'inherit'});const tar=cp.execFileSync('git',['archive',DEPS,'kaopu-unified-human-workbench'],{cwd:repo,maxBuffer:1024*1024*700});cp.execFileSync('tar',['-x','-C',tmp],{input:tar});const dest=path.join(tmp,'kaopu-unified-human-workbench/ear-continuity-r06');fs.cpSync(__dirname,dest,{recursive:true,filter:p=>!p.includes('/acceptance/')});cp.execFileSync(process.execPath,[dest+'/build.cjs'],{cwd:repo,stdio:'inherit'});for(const f of['preview.html','BUILD.json'])fs.copyFileSync(dest+'/'+f,__dirname+'/'+f);process.exit(0);
}
(async()=>{
 const src=root+'/ear-tissue-r05/build-runtime.cjs',manifest=JSON.parse(fs.readFileSync(root+'/ear-tissue-r05/BUILD.json'));assert.equal(manifest.previewSHA256,'3cf1395501ee8b50e14cfa6306f88a8636e3c5a68a3b89767a8c54b41cd7878d');for(const f of manifest.sources)assert.equal(sha(fs.readFileSync(repo+'/'+f.path)),f.sha256,'Frozen dependency modified: '+f.path);
 let code=fs.readFileSync(src,'utf8');const patch=(a,b)=>{assert(code.includes(a),'R05 builder anchor missing '+a);code=code.replace(a,()=>b)};
 patch('let app="import {mountTissueUI}', 'let app="import {mountContinuityUI} from \'../../ear-continuity-r06/ContinuityUI.mjs\';\\nimport {mountTissueUI}');
 patch("import{EarViewer as CommonViewer}from'../../ear-tissue-r05/EarViewer.mjs'", "import{EarViewer as CommonViewer}from'../../ear-continuity-r06/ContinuityViewer.mjs'");
 patch('mountTissueUI({model,viewer,controller});wasLoaded=true;', 'mountTissueUI({model,viewer,controller});mountContinuityUI({model,viewer,controller});wasLoaded=true;');
 patch("path.resolve(__dirname,'LipMaterial.mjs')", "path.resolve(root,'ear-tissue-r05/LipMaterial.mjs')");patch("fs.readFileSync(__dirname+'/layout.css','utf8')", "fs.readFileSync(root+'/ear-tissue-r05/layout.css','utf8')");code=code.replaceAll('EAR-R05.0','EAR-R06.0');
 // Hash-checked upstream builder, modified in memory only. No source overwrite.
 code=code.replace('(async()=>{','return (async()=>{');await new Function('require','__dirname',code)(require,__dirname);
 const html=fs.readFileSync(__dirname+'/preview.html'),sources=fs.readdirSync(__dirname).filter(n=>/\.(mjs|cjs)$/.test(n)).map(n=>({path:'kaopu-unified-human-workbench/ear-continuity-r06/'+n,sha256:sha(fs.readFileSync(__dirname+'/'+n))}));
 const m={schema:'kaopu/ear-r06-build@1',version:'EAR-R06.0',baselineBuild:'63e5dfddf2b5ca0d686651804beeba3333b2f41e',dependencyReceipt:DEPS,dependencyManifestSHA256:sha(fs.readFileSync(root+'/ear-tissue-r05/BUILD.json')),geometry:'unaltered R04 current display',tissue:'unaltered R05 surface seeds and optical thickness',primaryChange:'geometric visibility of existing lamps through whole head and folds',oneCharacter:true,oneCanvas:true,previewSHA256:sha(html),previewBytes:html.length,sources,productionReady:false,visualAcceptance:'USER_PENDING',runtimeAssetPolicy:'retained immutable R05 HTTPS assets; no new external assets'};fs.writeFileSync(__dirname+'/BUILD.json',JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify(m));
})().catch(e=>{console.error(e);process.exit(1)});

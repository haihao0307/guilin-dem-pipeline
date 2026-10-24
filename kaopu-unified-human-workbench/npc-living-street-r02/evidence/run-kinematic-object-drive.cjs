const fs=require('node:fs'),path=require('node:path'),url=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
  globalThis.__ITEM_QA_THREE__=await require('../build.cjs').loadNativeThreeForQA();globalThis.__ITEM_QA_ROOT__=root;
  let esbuild;for(const p of ['esbuild','/tmp/npc-life-build-tools/node_modules/esbuild',path.join(root,'vendor/build-tools/node_modules/esbuild')])try{esbuild=require(p);break;}catch{}
  if(!esbuild)throw Error('Pinned esbuild is unavailable');
  const bundle=await esbuild.build({entryPoints:[path.join(__dirname,'check-kinematic-object-drive.mjs')],bundle:true,write:false,platform:'node',format:'esm',target:'node22',logLevel:'error'}),file=path.join(__dirname,'.kinematic-object-drive-runtime.mjs');
  fs.writeFileSync(file,bundle.outputFiles[0].contents);await import(url.pathToFileURL(file).href+'?t='+Date.now());
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),url=require('node:url');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const THREE=await require('../build.cjs').loadNativeThreeForQA();globalThis.__NPC_QA_THREE__=THREE;globalThis.__BREAD_QA_ROOT__=root;
 let builder;for(const p of ['esbuild','/tmp/npc-life-build-tools/node_modules/esbuild',path.join(root,'vendor/build-tools/node_modules/esbuild')])try{builder=require(p);break;}catch{}
 if(!builder)throw Error('Pinned esbuild missing');
 const result=await builder.build({entryPoints:[path.join(__dirname,'check-native-bread-transport.mjs')],bundle:true,write:false,platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'error',plugins:[{name:'same-original-three',setup(b){b.onResolve({filter:/three\.module\.js$|^three$/},()=>({path:'original-r07-three',namespace:'retained-three'}));b.onLoad({filter:/.*/,namespace:'retained-three'},()=>({loader:'js',contents:Object.keys(THREE).filter(k=>/^[A-Za-z_$][\w$]*$/.test(k)).map(k=>`export const ${k}=globalThis.__NPC_QA_THREE__.${k};`).join('\n')}));}}]});
 const manifest={};for(const p of Object.keys(result.metafile.inputs).filter(p=>!p.startsWith('retained-three:'))){const file=path.resolve(root,p);if(fs.existsSync(file)){const b=fs.readFileSync(file);manifest[path.relative(root,file).replaceAll(path.sep,'/')]={bytes:b.length,sha256:sha(b)};}}
 globalThis.__BREAD_QA_SOURCE_HASHES__=manifest;const file=path.join(__dirname,'.native-bread-transport-runtime.mjs');fs.writeFileSync(file,result.outputFiles[0].contents);
 await import(url.pathToFileURL(file).href+'?t='+Date.now());
 const changed=Object.keys(manifest).filter(p=>sha(fs.readFileSync(path.join(root,p)))!==manifest[p].sha256);fs.writeFileSync(path.join(__dirname,'NATIVE_BREAD_TRANSPORT_INPUTS.json'),JSON.stringify({sourceHashes:manifest,changedDuringRun:changed,bundleSha256:sha(result.outputFiles[0].contents)},null,2)+'\n');
 if(changed.length)throw Error('Sources changed during measurement: '+changed.join(','));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

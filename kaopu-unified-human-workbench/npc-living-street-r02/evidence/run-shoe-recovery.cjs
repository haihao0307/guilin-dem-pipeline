/** Local, same-original-Three numerical geometry audit. No network/browser. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),url=require('node:url');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function builder(){for(const p of ['esbuild',path.join(root,'vendor/build-tools/node_modules/esbuild'),'/tmp/npc-life-build-tools/node_modules/esbuild',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES&&path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'esbuild')].filter(Boolean))try{return require(p);}catch{}throw Error('Prepared esbuild missing');}
(async()=>{
 const THREE=await require(path.join(root,'build.cjs')).loadNativeThreeForQA();globalThis.__SHOE_QA_THREE__=THREE;globalThis.__SHOE_QA_ROOT__=root;
 const entry=path.join(__dirname,'shoe-recovery',process.env.SHOE_QA_ENTRY||'probe.mjs');
 const result=await builder().build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'error',plugins:[{name:'original-r07-three',setup(b){
 b.onResolve({filter:/three\.module\.js$|^three$/},()=>({path:'original-r07-three',namespace:'retained-three'}));
 b.onLoad({filter:/.*/,namespace:'retained-three'},()=>({loader:'js',contents:Object.keys(THREE).filter(k=>/^[A-Za-z_$][\w$]*$/.test(k)).map(k=>`export const ${k}=globalThis.__SHOE_QA_THREE__.${k};`).join('\n')}));}}]});
 const manifest={};for(const p of Object.keys(result.metafile.inputs).filter(p=>!p.startsWith('retained-three:'))){const file=path.resolve(root,p);if(fs.existsSync(file)){const b=fs.readFileSync(file);manifest[path.relative(root,file)]={bytes:b.length,sha256:sha(b)};}}
 globalThis.__SHOE_QA_SOURCE_HASHES__=manifest;
 const bundle=path.join(__dirname,'SHOE_RECOVERY_RUNTIME.mjs');fs.writeFileSync(bundle,result.outputFiles[0].contents);
 await import(url.pathToFileURL(bundle).href+'?t='+Date.now());
 const changed=Object.entries(manifest).filter(([p,r])=>sha(fs.readFileSync(path.join(root,p)))!==r.sha256).map(([p])=>p);
 if(changed.length)throw Error('Source changed during shoe diagnostic: '+changed.join(','));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

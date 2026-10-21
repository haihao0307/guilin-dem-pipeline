/** Portable source snapshot + numerical runner. No browser or remote API. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),url=require('node:url');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function builder(){for(const x of ['esbuild',path.join(root,'vendor/build-tools/node_modules/esbuild'),'/tmp/npc-life-build-tools/node_modules/esbuild',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES&&path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'esbuild')].filter(Boolean))try{return require(x);}catch{}throw Error('Pinned esbuild missing; run prepare.cjs');}
(async()=>{
 const THREE=await require(path.join(root,'build.cjs')).loadNativeThreeForQA();globalThis.__NPC_QA_THREE__=THREE;globalThis.__CAPTURE_QA_ROOT__=root;
 const kind=process.argv[2]||'stance',entry=path.join(__dirname,kind==='stance'?'check-capture-recovery-stance.mjs':'check-capture-recovery-chain.mjs');
 const result=await builder().build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'error',plugins:[{name:'same-original-r07-three',setup(b){
  b.onResolve({filter:/three\.module\.js$|^three$/},()=>({path:'original-r07-three',namespace:'retained-three'}));
  b.onLoad({filter:/.*/,namespace:'retained-three'},()=>({loader:'js',contents:Object.keys(THREE).filter(k=>/^[A-Za-z_$][\w$]*$/.test(k)).map(k=>`export const ${k}=globalThis.__NPC_QA_THREE__.${k};`).join('\n')}));
 }}]});
 const files=Object.keys(result.metafile.inputs).filter(p=>!p.startsWith('retained-three:')).map(p=>path.resolve(root,p)),manifest={};
 for(const file of files)if(fs.existsSync(file)){const b=fs.readFileSync(file);manifest[path.relative(root,file).replaceAll(path.sep,'/')]={bytes:b.length,sha256:sha(b)};}
 globalThis.__CAPTURE_QA_SOURCE_HASHES__=manifest;
 const bundle=path.join(__dirname,'.capture-recovery-'+kind+'-runtime.mjs');fs.writeFileSync(bundle,result.outputFiles[0].contents);
 const started=Date.now();try{await import(url.pathToFileURL(bundle).href+'?t='+started);}finally{
  const changed=[];for(const [p,r]of Object.entries(manifest))if(sha(fs.readFileSync(path.join(root,p)))!==r.sha256)changed.push(p);
  const receipt={schema:'captured-pickup-recovery-runtime-inputs/1',kind,entry:path.relative(root,entry),actorIds:(process.env.ACTOR_IDS||'D').split(','),sourceFiles:manifest,bundle:{bytes:result.outputFiles[0].contents.length,sha256:sha(result.outputFiles[0].contents)},sourceChangedDuringRun:changed,elapsedMS:Date.now()-started};
  fs.writeFileSync(path.join(__dirname,'CAPTURE_RECOVERY_'+kind.toUpperCase()+'_INPUTS.json'),JSON.stringify(receipt,null,2)+'\n');
  if(changed.length)throw Error('Numerical runtime sources changed during run: '+changed.join(','));
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

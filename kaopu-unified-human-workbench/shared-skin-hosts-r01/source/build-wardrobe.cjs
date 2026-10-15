const fs=require('node:fs'),path=require('node:path'),esbuild=require('../Human-Hair-F03-Preparation-20261014/.local-tools/node_modules/esbuild');
const root=path.resolve(__dirname,'../MP05-Continuous-Demand-R01/candidate-r08-release'),base='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-denim-r08-ccccfd5ca9c1/';
let host=fs.readFileSync(path.join(root,'platform-runtime/preview.html'),'utf8');
host=host.replace(/<script>\(\(\)=>\{const original=window.fetch;window.fetch=async function[\s\S]*?\}\)\(\);<\/script>/,'');
host=host.replace('<head>','<head><script>if(parent.__SKIN_OFFLINE_FETCH__){window.fetch=parent.__SKIN_OFFLINE_FETCH__;window.Worker=parent.Worker;URL.revokeObjectURL=parent.__SKIN_OFFLINE_REVOKE__;URL.createObjectURL=parent.__SKIN_OFFLINE_CREATE_URL__;const p=HTMLImageElement.prototype,s=Object.getOwnPropertyDescriptor(p,"src");Object.defineProperty(p,"src",{...s,set(u){if(/^https?:/.test(u))fetch(u).then(r=>r.blob()).then(b=>s.set.call(this,URL.createObjectURL(b)));else s.set.call(this,u);}});}</script>');
host=host.replace('<head>','<head><script>'+fs.readFileSync(path.join(__dirname,'offline-images.js'),'utf8')+'</script>');
const plugins=[{name:'frozen-resource-transport',setup(b){b.onResolve({filter:/^three$/},()=>({path:path.join(root,'vendor/three.module.js')}));b.onLoad({filter:/\.mjs$/},args=>{const rel=path.relative(root,args.path).replaceAll('\\','/');let s=fs.readFileSync(args.path,'utf8');
 if(rel==='platform-person.mjs')s=s.replace("iframe.src=new URL('./platform-runtime/preview.html',import.meta.url)",()=>"iframe.srcdoc="+JSON.stringify(host));
 if(rel==='app.mjs')s=s.replace("history.replaceState(null,'',url);","if(location.protocol==='about:')window.__SKIN_EMBEDDED_QUERY__=url.search;else history.replaceState(null,'',url);").replace('const q=new URL(location.href).searchParams;',`const q=new URL(location.href).searchParams;const skinLook=new URLSearchParams(location.hash.slice(1)).get('look');if(!q.has('look')&&skinLook)q.set('look',skinLook);`);
 s=s.replace(/new Worker\(new URL\(['"]\.\/([^'"]+)['"],\s*import\.meta\.url\)/g,(_,n)=>'new Worker(window.__SKIN_WORKERS__['+JSON.stringify(n)+']');
 s=s.replaceAll('import.meta.url',JSON.stringify(base+rel));return{contents:s,loader:'js'};});}}];
async function bundle(f){return(await esbuild.build({entryPoints:[path.join(root,f)],bundle:true,write:false,format:'iife',minify:true,target:'es2022',plugins,legalComments:'inline'})).outputFiles[0].text;}
(async()=>{const workers={};for(const n of ['cloth-worker.mjs','live-cloth-worker.mjs','geometry-worker.mjs'])workers[n]=await bundle(n);
 const main=await bundle('app.mjs'),live=await bundle('live-ui.mjs'),visible=await bundle('visible-transport.mjs');
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<link rel="stylesheet" href="style.css">/,'<style>'+fs.readFileSync(path.join(root,'base-style.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'style.css'),'utf8').replace(/@import[^;]+;/g,'')+'</style>').replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace(/<script type="module" src="[^"]+"><\/script>/g,'');
 html=html.replace('<head>','<head><base href="'+base+'">');
 const boot='window.__SKIN_WORKERS__=Object.fromEntries(Object.entries('+JSON.stringify(workers)+').map(([k,s])=>[k,URL.createObjectURL(new Blob([s],{type:"text/javascript"}))]));';
 html=html.replace('</body>',()=>'<script>'+[boot,visible,main,live].join('\n').replaceAll('</script','<\\/script')+'</script></body>');fs.writeFileSync(path.join(__dirname,'candidates/wardrobe.html'),html);console.log('Bundled wardrobe',Buffer.byteLength(html));
})().catch(e=>{console.error(e);process.exitCode=1;});

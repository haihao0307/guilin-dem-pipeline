import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const {buildSync}=createRequire(import.meta.url)('../.r54-build/node_modules/esbuild');
// Bundle the existing generator and compressed function coefficients unchanged.
// A classic Blob worker works on file:// as well as HTTPS, without module CORS.
export function embedReconstruction(html,root){
  const assets={};
  const visit=(directory,relative='')=>{for(const name of readdirSync(directory)){const file=join(directory,name),key=relative+name;if(statSync(file).isDirectory()){visit(file,key+'/');continue;}if(/\.(gz|json)$/.test(name))assets[key]=readFileSync(file).toString('base64');}};
  const reconstruction=join(root,'reconstruction');visit(reconstruction);
  let worker=readFileSync(join(reconstruction,'worker.mjs'),'utf8');
  worker=worker.replace("const url=new URL(file,import.meta.url);url.searchParams.set('v',data.revision||'1');",'const url=file;').replace("fetch(url,{cache:'force-cache',signal:controller.signal})",'__r54Read(file)');
  if(worker.includes('fetch(url'))throw Error('Worker data loader was not embedded');
  const readSource=`const __r54Assets=${JSON.stringify(assets)};async function __r54Read(file){const text=__r54Assets[file];if(text===undefined)throw Error('Missing embedded parameter: '+file);const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new Response(bytes,{status:200});}\n`;
  const bundle=buildSync({stdin:{contents:worker,resolveDir:reconstruction,sourcefile:'worker.mjs'},bundle:true,format:'iife',platform:'browser',target:'es2022',write:false,metafile:true});
  const serialized=JSON.stringify(readSource+bundle.outputFiles[0].text).replace(/</g,'\\u003c');
  const loader=`<script>\nwindow.__SHORTS_R54_EMBEDDED__=true;(()=>{const code=${serialized};const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));window.__createShortsWorker=()=>new Worker(url);addEventListener('pagehide',()=>URL.revokeObjectURL(url));})();\n</script>`;
  const source="const worker=new window.Worker(url,{type:'module'});";
  if(!html.includes(source))throw Error('Original Worker attachment changed');
  html=html.replace(source,'const worker=window.__createShortsWorker();').replace('</head>',loader+'</head>');
  return {html,report:{singleFileHtml:true,moduleFiles:Object.keys(bundle.metafile.inputs).length,embeddedDataFiles:Object.keys(assets).length,requiredExternalAssets:0,workerFormat:'classic-bundled'}};
}

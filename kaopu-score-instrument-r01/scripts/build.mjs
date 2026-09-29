import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(root,'dist');
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true});
const [template,license,result]=await Promise.all([
  readFile(resolve(root,'src/index.template.html'),'utf8'),
  readFile(resolve(root,'node_modules/three/LICENSE'),'utf8'),
  build({entryPoints:[resolve(root,'src/app.js')],bundle:true,write:false,minify:true,format:'iife',platform:'browser',target:['es2022'],legalComments:'none',treeShaking:true})
]);
const bundle=result.outputFiles[0].text.replaceAll('</script','<\\/script');
new Function(bundle);
const source=process.env.GITHUB_SHA || 'local';
const insert=`<!-- Third-party license: Three.js\n${license.replaceAll('-->','-- >')}\n--><meta name="kaopu-source-sha" content="${source}"><script>${bundle}</script>`;
const render=(n)=>template.replace('__INSTRUMENT_BYTES__',String(n)).replace('<!--KAOPU_BUNDLE-->',()=>insert);
let n=0;
for(let i=0;i<10;i++){ const size=Buffer.byteLength(render(n)); if(size===n) break; n=size; }
const html=render(n);
if(Buffer.byteLength(html)!==n) throw new Error('Byte ledger did not converge');
await writeFile(resolve(dist,'index.html'),html);
console.log(`HTML_BYTES ${n}; BUNDLE_BYTES ${Buffer.byteLength(bundle)}; SOURCE ${source}`);

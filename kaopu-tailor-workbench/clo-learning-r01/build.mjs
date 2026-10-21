import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {gunzipSync,gzipSync} from 'node:zlib';
import {build} from './build-tools/node_modules/esbuild/lib/main.js';
import {measurePaper,LIMITS} from './src/length-operation.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const read=p=>fs.readFile(path.join(root,p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const encoded=b=>Buffer.from(b).toString('base64');
const jsonGzip=async p=>JSON.parse(gunzipSync(await read(p)));
const backend='upstream/kaopu-tailor-workbench/pattern-batch/r02/backend/';
const manifest=JSON.parse(await read('SOURCE_MANIFEST.json'));
for(const [p,entry]of Object.entries(manifest.files)) {
  const content=await read('upstream/'+p);
  if(sha(content)!==entry.sha256||content.length!==entry.bytes)throw Error('Source bytes changed: '+p);
}
for(const entry of manifest.bundledVendorFiles) {
  const content=await read(entry.path);
  if(sha(content)!==entry.sha256||content.length!==entry.bytes)throw Error('Bundled source bytes changed: '+entry.path);
}
await import('./prepare-worker.mjs');
const frozenBytes=await read('assets/native-person.json.gz');
if(sha(frozenBytes)!==manifest.frozenPerson.sha256)throw Error('Frozen person bytes changed');
const frozen=JSON.parse(gunzipSync(frozenBytes));
const person=Object.fromEntries(['vertexCount','bodyCount','positions','faces','state','skinFields'].map(k=>[k,frozen[k]]));
const personJSON=JSON.stringify(person);
const paperText=gunzipSync(await read('upstream/kaopu-tailor-workbench/presets/r04/assets/papers/S03.json.gz')).toString();
const paper=JSON.parse(paperText),original=await jsonGzip('upstream/kaopu-tailor-workbench/presets/r04/assets/results/S03.json.gz');
const candidate=await jsonGzip('evidence/solve-60.json.gz');
if(candidate.deltaMm!==60||candidate.record.staticGate?.passed!==true||candidate.binding?.operation?.deltaMm!==60)throw Error('Build requires a freshly solved +60 mm candidate');
const sourceFiles=['src/app.mjs','src/stage.mjs','src/render-support.mjs','src/length-operation.mjs','src/worker-entry.mjs','src/worker-extension.txt','src/shell.html','src/style.css','prepare-worker.mjs','run-solve.mjs','build.mjs','SOURCE_MANIFEST.json','build-tools/package-lock.json','generated/native-adapter.mjs',...manifest.bundledVendorFiles.map(entry=>entry.path)];
const sourceHashes={};for(const p of sourceFiles)sourceHashes[p]=sha(await read(p));
const localDigest=sha(JSON.stringify(sourceHashes));
const sourceCommit=process.env.GITHUB_SHA||'local-'+localDigest;
const buildId='clo-study-r01-'+sourceCommit.slice(0,12);
const provenance={schema:'kaopu-clo-study-build/1',taskId:'CLO-LEARNING-PILOT-R01-20261021',buildId,sourceCommit,sourceHead:sourceCommit,sourceInputSHA256:localDigest,upstreamCommit:manifest.sourceSha,createdAt:new Date().toISOString(),sourceHashes,
  personSourceSHA256:sha(frozenBytes),personPresentationSHA256:sha(personJSON),personProjection:{retainedFields:Object.keys(person),numericQuantization:false,coordinatesChanged:false,rigEditingIncluded:false},
  defaultResultSHA256:sha(await read('evidence/solve-60.json.gz')),defaultResultCreatedAt:candidate.createdAt,
  standalone:true,requiredRuntimeNetworkRequests:0,originalSolverStagesUnchanged:true,productionReady:false,visualAcceptance:false};
const worker=await build({entryPoints:[path.join(root,'src/worker-entry.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2022',write:false,minify:true,legalComments:'inline',metafile:true});
if(worker.warnings.length)throw Error('Worker bundle warnings: '+JSON.stringify(worker.warnings));
const workerCode=worker.outputFiles[0].text;
new Script(workerCode,{filename:'clo-study-worker.js'});
const notices=[];
for(const p of Object.keys(manifest.files).filter(p=>/LICENSE|NOTICE/i.test(p)))notices.push('ORIGINAL SOURCE NOTICE (this study does not load the Python runtime): '+p+'\n'+(await read('upstream/'+p)).toString());
notices.push('Three.js r170\n'+(await read('vendor/THREE-LICENSE.txt')).toString());
const payload={schema:'kaopu-clo-study-payload/1',person,paperText,original,candidate,baseMeasurements:measurePaper(paper),limits:LIMITS,
  identity:JSON.parse((await read(backend+'assets/identity.json')).toString()),provenance,thirdPartyNotices:notices.join('\n\n'),
  workerAssets:{bodyGzip:encoded(gzipSync(await read(backend+'assets/common-body.json'),{level:9})),sdfGzip:encoded(await read(backend+'assets/common-body.sdfd.gz')),metaText:(await read(backend+'assets/body-sdf-grid.json')).toString(),wasm:encoded(await read(backend+'correctives/r043c/joint-r043c.wasm'))}};
const packed=encoded(gzipSync(JSON.stringify(payload),{level:9}));
await fs.mkdir(path.join(root,'generated'),{recursive:true});
await fs.writeFile(path.join(root,'generated/resources.mjs'),'export const PACKED_DATA='+JSON.stringify(packed)+';\nexport const WORKER_CODE='+JSON.stringify(workerCode)+';\n');
const app=await build({entryPoints:[path.join(root,'src/app.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2022',write:false,minify:true,legalComments:'inline',metafile:true});
if(app.warnings.length)throw Error('App bundle warnings: '+JSON.stringify(app.warnings));
const js=app.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
let html=(await read('src/shell.html')).toString();
for(const token of ['<!--STYLE-->','<!--RUNTIME-->'])if(html.split(token).length!==2)throw Error('HTML placeholder changed: '+token);
const css=(await read('src/style.css')).toString();
// A replacement callback preserves literal $&, $`, $' and $$ in bundled code.
html=html.replace('<!--STYLE-->',()=>'<style>'+css+'</style>').replace('<!--RUNTIME-->',()=>'<script>'+js+'</script>');
html=html.replace('<html lang="zh-CN">','<html lang="zh-CN" data-artifact-build="'+buildId+'" data-source-head="'+sourceCommit+'">');
if(/<script[^>]+src\s*=|<link[^>]+href\s*=|<img[^>]+src\s*=/i.test(html))throw Error('Unexpected required external resource');
const inlineScripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if(inlineScripts.length!==1||inlineScripts[0][1]!==js)throw Error('Bundled runtime changed during HTML insertion');
new Script(inlineScripts[0][1],{filename:'clo-study-inline.js'});
await fs.mkdir(path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/index.html'),html);
await fs.writeFile(path.join(root,'dist/manifest.json'),JSON.stringify({...provenance,htmlSHA256:sha(html),htmlBytes:Buffer.byteLength(html),workerSHA256:sha(workerCode),upstreamFileCount:Object.keys(manifest.files).length,checks:{sourceIntegrity:true,defaultStaticGate:true,standaloneResources:true,embeddedJavaScriptSyntax:true,browserVerified:false,publicHttpsVerified:false}},null,2)+'\n');
await fs.writeFile(path.join(root,'evidence/BUNDLE_INPUTS.json'),JSON.stringify({worker:worker.metafile,app:app.metafile},null,2)+'\n');
console.log(JSON.stringify({buildId,sourceCommit,htmlBytes:Buffer.byteLength(html),htmlSHA256:sha(html),defaultStaticGate:candidate.record.staticGate.passed,artifact:'dist/index.html'}));

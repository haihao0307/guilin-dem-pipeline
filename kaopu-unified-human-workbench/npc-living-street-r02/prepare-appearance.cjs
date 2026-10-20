#!/usr/bin/env node
'use strict';
/** Reproduce the pinned public native appearance inputs, then build only local
 * adapters/data modules. This script does not publish or modify upstream code.
 * The generated 6.7 MB base64 module is a build product, not a Git source.
 *   node prepare-appearance.cjs             # verified cache or pinned download
 *   node prepare-appearance.cjs --cache-only # no network, fail if a source is absent
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'vendor/appearance');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
function localFile(name){const file=path.resolve(root,name);assert(file.startsWith(root+path.sep),'Appearance path must stay inside its cache');return file;}
function valid(bytes,row){return bytes.length===row.bytes&&sha(bytes)===row.sha256&&blob(bytes)===row.gitBlob;}
async function fetchPinned(row,cachedOnly) {
  const file=localFile(row.local);if(fs.existsSync(file)&&valid(fs.readFileSync(file),row))return 'cached';
  if(cachedOnly)throw Error('Missing or mismatched appearance source: '+row.local);
  const url=new URL(row.url);
  assert.equal(url.origin,'https://raw.githubusercontent.com','Pinned public GitHub source only');
  assert(/^\/(haihao0307)\/(guilin-dem-pipeline|Humanoid-Rig-Lab-Next)\/[a-f0-9]{40}\//.test(url.pathname),'Appearance URL must use a fixed source commit');
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Appearance download '+response.status+' '+row.local);
  const bytes=Buffer.from(await response.arrayBuffer());assert(valid(bytes,row),'Appearance source hash mismatch: '+row.local);
  fs.mkdirSync(path.dirname(file),{recursive:true});const temporary=file+'.verified-tmp';fs.writeFileSync(temporary,bytes);fs.renameSync(temporary,file);return 'downloaded';
}
async function prepareAppearance({cachedOnly=false,quiet=false}={}) {
  const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'appearance-source-lock.json'),'utf8'));
  let cursor=0,cached=0,downloaded=0;
  await Promise.all(Array.from({length:5},async()=>{while(cursor<lock.files.length){const row=lock.files[cursor++],status=await fetchPinned(row,cachedOnly);status==='cached'?cached++:downloaded++;}}));
  const generated=[];
  function write(name,bytes){const file=localFile(name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);const b=fs.readFileSync(file);generated.push({local:name,bytes:b.length,sha256:sha(b)});}
  for(const entry of lock.adaptedCopies) {
    let text=fs.readFileSync(localFile(entry.source),'utf8');
    if(entry.output.startsWith('hair-long-adapted/'))text=text.replaceAll("'/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js'","'three'");
    if(entry.output.startsWith('hair-short-adapted/'))text=text.replaceAll("'../vendor/three.module.js'","'three'");
    if(['cloth-adapted/solid-helpers.mjs','cloth-adapted/solid-textiles.mjs'].includes(entry.output)) {
      const before="new URL('./geometry-worker.mjs',import.meta.url)";assert(text.includes(before),'Native cloth worker source changed');
      text=text.replaceAll(before,"(globalThis.__NPC_CLOTH_WORKER_URL || (()=>{throw Error('Native cloth worker was not bundled by the host');})())");
    }
    write(entry.output,text);
  }
  const html=fs.readFileSync(localFile(lock.generated.scanFrom),'utf8');
  const match=html.match(/<div hidden id="scan-data">([A-Za-z0-9+/=]+)<\/div>/);assert(match,'Original R14 scan payload absent');
  const scan=JSON.parse(zlib.gunzipSync(Buffer.from(match[1],'base64')).toString('utf8'));
  assert.deepEqual(Object.keys(scan).sort(),['diff','nor_gl','rough']);
  write(lock.generated.scanJSON,JSON.stringify(scan));
  const data={};for(const id of lock.dataPackets)data[id]=fs.readFileSync(localFile('cloth-r10/native/'+id+'.json.gz')).toString('base64');
  data.person=fs.readFileSync(localFile('cloth-r10/assets/native-person.json.gz')).toString('base64');
  const moduleSource='// Exact gzip payloads from MP05 R10, verified by appearance-source-lock.json.\nconst DATA='+JSON.stringify(data)+';\n'+
    "const pending=new Map();\nexport function appearanceData(id){if(!pending.has(id)){if(!DATA[id])throw Error('Unknown original appearance packet '+id);pending.set(id,(async()=>{const bytes=Uint8Array.from(atob(DATA[id]),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text());})());}return pending.get(id);}\n";
  write(lock.generated.dataModule,moduleSource);
  const report={schema:'npc-r02-appearance-prepared/1',verifiedSourceFiles:lock.files.length,cached,downloaded,
    sourceBytes:lock.files.reduce((n,f)=>n+f.bytes,0),sourceLockSHA256:sha(fs.readFileSync(path.join(__dirname,'appearance-source-lock.json'))),
    allSourceByteHashesVerified:true,generated,defaultKnitEnabled:false,visualVerified:false};
  fs.writeFileSync(localFile('APPEARANCE_PREPARED.json'),JSON.stringify(report,null,2)+'\n');
  if(!quiet)console.log(JSON.stringify({verifiedSourceFiles:report.verifiedSourceFiles,cached,downloaded,generatedFiles:generated.length,
    dataModuleBytes:generated.find(x=>x.local===lock.generated.dataModule).bytes,allSourceByteHashesVerified:true}));
  return report;
}
module.exports={prepareAppearance};
if(require.main===module)prepareAppearance({cachedOnly:process.argv.includes('--cache-only')||process.argv.includes('--offline')}).catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});

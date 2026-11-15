#!/usr/bin/env node
'use strict';
/** Build-time dependencies only. No NPM/CDN dependency in the delivered runtime. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const {promisify} = require('node:util');
const execFile = promisify(cp.execFile);
const here = __dirname;
const vendor = path.join(here, 'vendor');
const tarballURL = 'https://registry.npmjs.org/cannon-es/-/cannon-es-0.20.0.tgz';
const integrity = 'sha512-eZhWTZIkFOnMAJOgfXJa9+b3kVlvG+FX4mdkpePev/w/rP5V8NRquGyEozcjPfEoXUlb+p7d9SUcmDSn14prOA==';
const lockedFiles = {
  'cannon-es.js': {member:'package/dist/cannon-es.js', sha256:'f0700cbd3a482954949b9d58c1b0f76dcc74767750297647a39d8c40dd63d37c'},
  'cannon-es.LICENSE': {member:'package/LICENSE', sha256:'4714d0272f50cb21fe46fe29333c7c600d3c85b5ebd2a80f4db07e8cfccbf5b2'}
};
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const {contract,PACKET_IDS,IMAGES,verifyPNG,verifyCache,MANIFEST_SHA256}=require('./AssetContract.cjs');
async function download(url) {
  // curl respects the build environment's configured network proxy. This is a
  // build-time byte fetch only; no package lifecycle or downloaded script runs.
  const {stdout} = await execFile('curl',['--fail','--silent','--show-error','--location','--max-time','120',url],{encoding:'buffer',maxBuffer:8*1024*1024});
  return stdout;
}

async function prepareNativePackets() {
  const argv=process.argv.slice(2);
  assert(!argv.includes('--all-native'),'R03 packages only the exact observed native packets; the unrelated archive is not loaded');
  const index=argv.indexOf('--packets');
  const value=argv.find(arg=>arg.startsWith('--packets='))?.slice(10)||(index>=0?argv[index+1]:null);
  if(value)assert.deepEqual(value.split(','),PACKET_IDS,'The accepted three complete presets use the fixed packet set');
  const manifestPath=path.resolve(here,'../human-integrated-r06/StreamingManifest.json');
  const rawManifest=fs.readFileSync(manifestPath),spec=contract(rawManifest);
  fs.mkdirSync(path.join(vendor,'assets'),{recursive:true});
  fs.mkdirSync(path.join(vendor,'images'),{recursive:true});
  const queue=[...spec.chunks.map(c=>({...c,file:path.join(vendor,'assets',c.local)})),...IMAGES.map(i=>({...i,file:path.join(vendor,'images',i.name)}))];
  let cursor=0,complete=0;
  async function one(){
    while(cursor<queue.length){
      const entry=queue[cursor++];let bytes=fs.existsSync(entry.file)?fs.readFileSync(entry.file):null;
      if(!bytes||bytes.length!==entry.bytes||hash(bytes)!==entry.sha256){
        bytes=await download(entry.url);assert.equal(bytes.length,entry.bytes,'Native resource bytes '+entry.url);assert.equal(hash(bytes),entry.sha256,'Native resource SHA '+entry.url);fs.writeFileSync(entry.file,bytes);
      }
      if(entry.name)verifyPNG(bytes,entry);
      complete++;if(complete%10===0||complete===queue.length)console.log('Original native resources verified '+complete+'/'+queue.length);
    }
  }
  await Promise.all(Array.from({length:6},one));
  const lock={schema:'kaopu/npc-native-packets@2',source:'HUMAN-INTEGRATED-R07 native R05 streaming',sourceManifestSHA256:MANIFEST_SHA256,packetIds:PACKET_IDS,allNativePackets:false,compressedBytes:44303931,chunks:spec.chunks};
  fs.writeFileSync(path.join(vendor,'PACKETS.json'),JSON.stringify(lock,null,2)+'\n');
  fs.writeFileSync(path.join(vendor,'IMAGES.json'),JSON.stringify({schema:'kaopu/npc-original-images@1',images:IMAGES},null,2)+'\n');
  verifyCache(here,rawManifest);
  console.log('Exact standalone cache verified: 18 native packets / 55 chunks / 2 original PNG images.');
}
async function main() {
  fs.mkdirSync(vendor, {recursive:true});
  const missing = Object.entries(lockedFiles).some(([name, lock]) => !fs.existsSync(path.join(vendor,name)) || hash(fs.readFileSync(path.join(vendor,name))) !== lock.sha256);
  if (missing) {
    const data = await download(tarballURL);
    assert.equal('sha512-' + crypto.createHash('sha512').update(data).digest('base64'), integrity, 'Official NPM tarball integrity');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'npc-cannon-'));
    const tgz = path.join(temp,'cannon-es-0.20.0.tgz');
    fs.writeFileSync(tgz,data);
    try {
      for (const [name, lock] of Object.entries(lockedFiles)) {
        const content = cp.execFileSync('tar',['-xOzf',tgz,lock.member], {maxBuffer:2*1024*1024});
        assert.equal(hash(content),lock.sha256, 'Vendored file integrity ' + name);
        fs.writeFileSync(path.join(vendor,name),content);
      }
    } finally {fs.rmSync(temp,{recursive:true,force:true});}
  }
  fs.writeFileSync(path.join(vendor,'DEPENDENCIES.json'), JSON.stringify({
    schema:'kaopu/vendored-dependencies@1',
    cannon:{name:'cannon-es',version:'0.20.0',license:'MIT',tarballURL,integrity,files:lockedFiles},
    three:{version:'0.170.0',license:'MIT',source:'canonical HUMAN-INTEGRATED-R07 inline bundle',duplicateRuntime:false},
    esbuild:{version:'0.25.11',buildTimeOnly:true}
  },null,2)+'\n');
  const buildTools = path.join(os.tmpdir(),'npc-life-build-tools');
  const compiler = path.join(buildTools,'node_modules/esbuild');
  let version;
  try {version=require(compiler).version;} catch {}
  if (version !== '0.25.11') {
    cp.execFileSync('npm',['install','--prefix',buildTools,'--no-audit','--no-fund','--ignore-scripts','esbuild@0.25.11'],{stdio:'inherit'});
  }
  assert.equal(require(compiler).version,'0.25.11');
  await prepareNativePackets();
  console.log('Dependencies verified: Cannon 0.20.0, esbuild 0.25.11; Three comes from the unchanged canonical host.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

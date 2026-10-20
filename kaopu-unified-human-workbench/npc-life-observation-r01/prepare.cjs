#!/usr/bin/env node
'use strict';
/** Build-time dependencies only. No NPM/CDN dependency in the delivered runtime. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const here = __dirname;
const vendor = path.join(here, 'vendor');
const tarballURL = 'https://registry.npmjs.org/cannon-es/-/cannon-es-0.20.0.tgz';
const integrity = 'sha512-eZhWTZIkFOnMAJOgfXJa9+b3kVlvG+FX4mdkpePev/w/rP5V8NRquGyEozcjPfEoXUlb+p7d9SUcmDSn14prOA==';
const lockedFiles = {
  'cannon-es.js': {member:'package/dist/cannon-es.js', sha256:'f0700cbd3a482954949b9d58c1b0f76dcc74767750297647a39d8c40dd63d37c'},
  'cannon-es.LICENSE': {member:'package/LICENSE', sha256:'4714d0272f50cb21fe46fe29333c7c600d3c85b5ebd2a80f4db07e8cfccbf5b2'}
};
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const nativeBase = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/';

async function prepareNativePackets() {
  const argv = process.argv.slice(2);
  const index = argv.indexOf('--packets');
  const value = argv.find(arg=>arg.startsWith('--packets='))?.slice('--packets='.length) || (index>=0 ? argv[index+1] : null);
  const all = argv.includes('--all-native');
  if (!all && !value) return;
  const manifestPath = path.resolve(here,'../human-integrated-r06/StreamingManifest.json');
  const rawManifest = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(rawManifest);
  const ids = new Set(all ? manifest.files.map(file=>file.id) : ['hot',...value.split(',').map(id=>id.trim()).filter(Boolean)]);
  for (const id of ids) assert(manifest.files.some(file=>file.id===id), 'Unknown native packet ' + id);
  const packets = manifest.files.filter(file=>ids.has(file.id));
  const unique = new Map();
  for(const packet of packets) for(const chunk of packet.chunks) unique.set(chunk.url,{...chunk,url:new URL(chunk.url,nativeBase).href,local:path.basename(chunk.url)});
  const queue = [...unique.values()];
  const assets = path.join(vendor,'assets');
  fs.mkdirSync(assets,{recursive:true});
  let cursor=0,complete=0;
  async function one() {
    while (cursor<queue.length) {
      const chunk=queue[cursor++];
      const target=path.join(assets,chunk.local);
      let content=fs.existsSync(target)?fs.readFileSync(target):null;
      if(!content || content.byteLength!==chunk.bytes || hash(content)!==chunk.sha256) {
        const response=await fetch(chunk.url,{signal:AbortSignal.timeout(120000)});
        assert(response.ok,'Native chunk HTTP '+response.status+' '+chunk.local);
        content=Buffer.from(await response.arrayBuffer());
        assert.equal(content.byteLength,chunk.bytes,'Native chunk length '+chunk.local);
        assert.equal(hash(content),chunk.sha256,'Native chunk SHA '+chunk.local);
        fs.writeFileSync(target,content);
      }
      complete++;
      if(complete%10===0 || complete===queue.length) console.log('Native packets verified '+complete+'/'+queue.length);
    }
  }
  await Promise.all(Array.from({length:Math.min(6,queue.length)},one));
  const lock={
    schema:'kaopu/npc-native-packets@1',source:'HUMAN-INTEGRATED-R07 native R05 streaming',
    nativeBase,sourceManifestSHA256:hash(rawManifest),packetIds:packets.map(file=>file.id),
    allNativePackets:packets.length===manifest.files.length,
    compressedBytes:queue.reduce((sum,chunk)=>sum+chunk.bytes,0),
    packets:packets.map(file=>({id:file.id,bytes:file.bytes,sha256:file.sha256,rawBytes:file.rawBytes,rawSHA256:file.rawSHA256})),
    chunks:queue.map(({url,local,bytes,sha256})=>({url,local,bytes,sha256}))
  };
  fs.writeFileSync(path.join(vendor,'PACKETS.json'),JSON.stringify(lock,null,2)+'\n');
  console.log('Native asset cache locked: '+lock.packetIds.join(', ')+'; '+lock.compressedBytes+' bytes');
}
async function main() {
  fs.mkdirSync(vendor, {recursive:true});
  const missing = Object.entries(lockedFiles).some(([name, lock]) => !fs.existsSync(path.join(vendor,name)) || hash(fs.readFileSync(path.join(vendor,name))) !== lock.sha256);
  if (missing) {
    const response = await fetch(tarballURL);
    assert(response.ok, 'Official NPM tarball HTTP ' + response.status);
    const data = Buffer.from(await response.arrayBuffer());
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

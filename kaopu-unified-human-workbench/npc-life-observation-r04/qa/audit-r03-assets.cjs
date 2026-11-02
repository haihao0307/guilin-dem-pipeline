#!/usr/bin/env node
'use strict';
// Independent final-artifact audit. No browser or GPU success is inferred here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),zlib=require('node:zlib'),vm=require('node:vm');
const here=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={schema:'kaopu/npc-r03-final-asset-audit@1',startedAt:new Date().toISOString(),cases:[],passed:false,browserExecuted:false};
function check(name,fn){const result=fn();report.cases.push({name,passed:true,...result});}
try{
 const bytes=fs.readFileSync(path.join(here,'preview.html')),html=bytes.toString('utf8'),build=JSON.parse(fs.readFileSync(path.join(here,'BUILD.json')));
 const rawManifest=fs.readFileSync(path.join(here,'../human-integrated-r06/StreamingManifest.json'));
 assert.equal(hash(rawManifest),'f3075563d5b20ae6bd6471de77eb6394fa4cb12f5aa37774075ccaadd9c7fbd4');
 const manifest=JSON.parse(rawManifest),ids=['hot','anny-0','anny-1','anny-2','anny-3','anny-5','anny-6','anny-9','anny-10','anny-19','anny-21','anny-22','anny-26','anny-28','anny-29','anny-32','anny-34','anny-35'];
 const base='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/';
 const assetScript=html.match(/<script data-npc-native-assets>([\s\S]*?)<\/script>/)?.[1];assert(assetScript,'Final HTML includes original asset transport');
 const matches=assetScript.match(/const packetEntries=([^\n]+);const imageEntries=([^\n]+);/);assert(matches,'Both payload maps actually present in final HTML');
 const packetEntries=JSON.parse(matches[1]),imageEntries=JSON.parse(matches[2]);
 check('exact-original-packets-from-final-HTML',()=>{
  const packets=ids.map(id=>manifest.files.find(f=>f.id===id));assert(packets.every(Boolean));
  const chunks=new Map();for(const p of packets)for(const c of p.chunks)chunks.set(new URL(c.url,base).href,c);
  assert.equal(chunks.size,55);assert.deepEqual(Object.keys(packetEntries).sort(),[...chunks.keys()].sort());
  let sum=0;const buffers=new Map();
  for(const[url,c]of chunks){const b=Buffer.from(packetEntries[url],'base64');assert.equal(b.length,c.bytes,url);assert.equal(hash(b),c.sha256,url);assert.equal(b.toString('base64'),packetEntries[url]);buffers.set(url,b);sum+=b.length;}
  assert.equal(sum,44303931);
  for(const p of packets){const b=Buffer.concat(p.chunks.map(c=>buffers.get(new URL(c.url,base).href)));assert.equal(b.length,p.bytes);assert.equal(hash(b),p.sha256);const raw=zlib.gunzipSync(b);assert.equal(raw.length,p.rawBytes);assert.equal(hash(raw),p.rawSHA256);}
  return{packets:18,chunks:55,compressedBytes:sum,originalRawPacketSHA256Verified:true};
 });
 check('two-original-PNGs-from-final-HTML',()=>{
  const expected=[['detail.png',894772,'330121475d188b626b27138d1e41c1712201a605ef147bc62f549e262074417a'],['chroma.png',480198,'9d499858603d6b367a1bd6c844312d51573250835bba50a5177624b1d4485df4']];
  const face='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/02f596def9d07ebfc187e1eb18ad345a57c8a6b6/kaopu-unified-human-workbench/face-transfer/assets/';
  assert.deepEqual(Object.keys(imageEntries).sort(),expected.map(([n])=>face+n).sort());
  for(const[n,size,sha]of expected){const data=imageEntries[face+n];assert(data.startsWith('data:image/png;base64,'));const b=Buffer.from(data.slice(22),'base64');assert.equal(b.length,size);assert.equal(hash(b),sha);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),1024);assert.equal(b.readUInt32BE(20),512);}
  assert(html.includes('a.src=window.__NPC_IMAGE_URL__(e)'),'Original ImageLoader maps only the original bytes');
  return{images:2,bytes:1374970,width:1024,height:512};
 });
 check('final-HTML-encoding-syntax-and-version',()=>{
  assert.equal(build.version,'NPC-LIFE-OBSERVATION-R04');assert.equal(build.previewBytes,bytes.length);assert.equal(build.previewSHA256,hash(bytes));assert.equal(build.standalone,true);
  assert.equal((html.match(/<meta charset="utf-8">/g)||[]).length,1);assert(bytes.subarray(0,1024).includes(Buffer.from('<meta charset="utf-8">')));
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,8);scripts.forEach((m,i)=>new vm.Script(m[1],{filename:'final-script-'+i}));
  assert.equal((html.match(/data-npc-original=/g)||[]).length,2);assert(!/<script[^>]+src=/i.test(html),'No external script dependency');
  return{htmlBytes:bytes.length,htmlSHA256:hash(bytes),inlineScripts:8,originalNativeScripts:2,earlyUTF8:true};
 });
 check('visible-shell-precedes-native-execution-contract',()=>{
  const shell=html.indexOf('id="npc-boot-shell"'),assets=html.indexOf('<script data-npc-native-assets>'),native=html.indexOf('<script data-npc-original="0">'),runner=html.indexOf('<script data-npc-start-after-shell>');
  assert(shell>=0&&assets>shell&&native>assets&&runner>native);
  assert(html.indexOf('<script data-npc-boot-monitor>')<shell);assert(html.includes('window.__NPC_PROGRAMS__.push(function(){'));
  const run=html.slice(runner);assert.equal((run.match(/requestAnimationFrame\(/g)||[]).length,2);assert(run.includes('shellVisibleAtFirstRAF=visible()'));assert(run.includes('shellVisibleAtSecondRAF=visible()'));assert(run.includes('window.__NPC_BOOT__.check()'));
  assert(assetScript.includes('throw denied(url)'),'Missing standalone assets stop visibly instead of starting hidden network fetches');
  return{shellBeforeOriginalPrograms:true,twoRAFContract:true,actualPaintAndNetwork:'must be independently verified in real Chromium'};
 });
 report.passed=report.cases.length===4;report.finishedAt=new Date().toISOString();
}catch(error){report.failure=error.stack;process.exitCode=1;}
fs.writeFileSync(path.join(__dirname,'audit-r03-assets.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

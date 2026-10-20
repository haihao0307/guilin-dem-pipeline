#!/usr/bin/env node
'use strict';
// Stage only this candidate's immutable public path after executed CI gates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const here=__dirname,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const head=process.env.SOURCE_HEAD;
assert(/^[a-f0-9]{40}$/.test(head||''),'A full current source commit is required');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
assert.equal(read(path.join(here,'INTEGRATION_STATUS.json')).releaseCandidate,true,'Diagnostic-only integration builds may never publish');
const suite=read(process.env.NPC_SUITE_REPORT||'/tmp/street-suite/qa.json');
const offline=read(process.env.NPC_OFFLINE_REPORT||'/tmp/street-offline/qa.json');
assert.equal(suite.sourceHead,head);assert.equal(suite.status,'SUITE_PASSED');
assert.equal(suite.fullSuitePassed,true);assert.equal(suite.fullSuiteRun,true);assert.equal(suite.autonomousChainPassed,true);
assert.equal(suite.keyInteractionPassed,true);assert.equal(suite.environmentActivitiesPassed,true);
assert.equal(suite.appearanceVerified,true);assert.equal(suite.sixLocomotionVerified,true);assert.equal(suite.phoneViewport?.tested,true);
assert.equal(offline.sourceHead,head);assert.equal(offline.status,'OFFLINE_PASSED');assert.equal(offline.startupPassed,true);
assert.equal(offline.offlineVerified,true);assert.equal(offline.keyInteractionPassed,true);assert.equal(offline.appearanceVerified,true);
for(const qa of [suite,offline]){assert.equal(qa.diagnosticOnly,false);assert.equal(qa.integration?.releaseCandidate,true);assert.equal(qa.verifierSHA256,hash(fs.readFileSync(path.join(here,'verify-browser.cjs'))));assert.equal(qa.version,'NPC-LIVING-STREET-R02');assert.equal(qa.sourceGate?.passed,true);assert.equal(qa.completed,true);assert.equal(qa.cleanup?.completed,true);}
assert.equal(offline.deliveryMode,'standalone-file-offline');assert.equal(new URL(offline.finalURL).protocol,'file:');
assert.equal(offline.offline.networkDisabledBeforeNavigation,true);assert.equal(offline.offline.serviceWorkersBlocked,true);
assert.equal(offline.offline.externalNetworkRequests,0);assert.equal(offline.offline.sidecarFileRequests,0);
assert.equal(offline.offline.blockedRequests.length,0);assert.equal(offline.offline.serverUsed,false);
const build=read(path.join(here,'BUILD.json')),single=read(path.join(here,'BUILD.standalone.json'));
assert.equal(build.schema,'kaopu/npc-living-street-build@2');assert.equal(build.sourceHead,head);assert.equal(single.sourceHead,head);
assert.equal(build.version,'NPC-LIVING-STREET-R02');assert.equal(single.version,build.version);assert.equal(build.assetMode,'same-origin-native-packets');
assert.equal(single.standalone,true);assert.equal(offline.observedPreviewSHA256,single.previewSHA256);
assert.equal(suite.observedPreviewSHA256,build.previewSHA256,'The public HTML is exactly the browser-tested suite document');
assert.equal(suite.build.previewSHA256,build.previewSHA256);
assert.equal(hash(fs.readFileSync(path.join(here,'build.cjs'))),build.adapterSHA256);
for(const [name,expected]of Object.entries(build.sourceSHA256)){
  assert.equal(hash(fs.readFileSync(path.join(here,name))),expected,'Frozen production source: '+name);
  assert.equal(single.sourceSHA256[name],expected,'Standalone uses the same production source: '+name);
  assert.equal(suite.build.sourceSHA256[name],expected,'Executed suite uses the same production source: '+name);
}
assert.equal(build.adapterSHA256,single.adapterSHA256);assert.equal(build.adapterSHA256,suite.build.adapterSHA256);
const html=fs.readFileSync(path.join(here,'dist/index.html'));
assert.equal(hash(html),build.previewSHA256);assert.equal(html.length,build.previewBytes);
const lock=read(path.join(here,'vendor/PACKETS.json'));
assert(lock.chunks.length>0&&lock.packetIds.includes('hot'));
assert.equal(lock.observedClosure?.sourceHead,head);assert.equal(lock.observedClosure.sourceHeadEqualityRequired,true);
assert.equal(lock.observedClosure.companionQA?.startupPassed,true);assert.equal(lock.observedClosure.companionQA.sourceHead,head);
assert.equal(lock.observedClosure.requiredPacketMinimum?.observedAll,true);
assert.equal(lock.observedClosure.requiredPacketMinimum.packetIds.length,23);
assert.equal(build.packetLockSHA256,hash(fs.readFileSync(path.join(here,'vendor/PACKETS.json'))));
assert.equal(single.packetLockSHA256,build.packetLockSHA256);
assert.deepEqual(lock.packetIds,build.packagedNativePacketIds);
assert.equal(lock.sourceManifestSHA256,hash(fs.readFileSync(path.join(here,'vendor/StreamingManifest.json'))));
assert.deepEqual(lock.packetIds,single.embeddedPacketIds,'Standalone and network packet sets agree');
const output=path.resolve(process.env.NPC_PUBLIC_STAGE||'/tmp/street-public');
assert(!fs.existsSync(output)||fs.readdirSync(output).length===0,'Stage must be new or empty');
fs.mkdirSync(path.join(output,'assets'),{recursive:true});
for(const c of lock.chunks){
  assert.equal(path.basename(c.local),c.local,'No paths outside the native asset directory');
  const bytes=fs.readFileSync(path.join(here,'vendor/assets',c.local));
  assert.equal(bytes.length,c.bytes);assert.equal(hash(bytes),c.sha256);
  fs.writeFileSync(path.join(output,'assets',c.local),bytes);
}
build.sourceHead=head;
build.publicPath='npc-living-street/r02-20261020/'+head+'/';
build.publicURL='https://haihao0307.github.io/guilin-dem-pipeline/'+build.publicPath;
build.standaloneRuntimeVerified=true;
build.packagedNativePacketCount=lock.packetIds.length;
build.packagedNativeChunkCount=lock.chunks.length;
build.packagedNativeCompressedBytes=lock.compressedBytes;
build.verification={nativeInteractionSuite:true,sixCompleteNativePeople:true,originalAppearanceVerified:true,
  measuredNativeLocomotion:true,spawnedBottleInteraction:true,contactGatedEnvironmentActivities:true,phoneViewport:true,
  standaloneStartup:true,standaloneFileOffline:true,standaloneNewBottleInteraction:true,publicURLVerified:false,
  suiteReportSHA256:hash(fs.readFileSync(process.env.NPC_SUITE_REPORT||'/tmp/street-suite/qa.json')),
  offlineReportSHA256:hash(fs.readFileSync(process.env.NPC_OFFLINE_REPORT||'/tmp/street-offline/qa.json'))};
build.visualAcceptance=false;build.productionReady=false;
fs.writeFileSync(path.join(output,'index.html'),html);
fs.writeFileSync(path.join(output,'BUILD.json'),JSON.stringify(build,null,2)+'\n');
fs.copyFileSync(path.join(here,'vendor/cannon-es.LICENSE'),path.join(output,'CANNON-LICENSE.txt'));
fs.copyFileSync(path.join(here,'vendor/three-additions/three-0.170.0/LICENSE'),path.join(output,'THREE-LICENSE.txt'));
fs.copyFileSync(path.join(here,'vendor/PACKETS.json.provenance.json'),path.join(output,'NATIVE-PACKET-PROVENANCE.json'));
fs.writeFileSync(path.join(output,'ASSETS.json'),JSON.stringify({sourceHead:head,sourceManifestSHA256:lock.sourceManifestSHA256,
  packetIds:lock.packetIds,chunks:lock.chunks.map(c=>({file:'assets/'+c.local,bytes:c.bytes,sha256:c.sha256}))},null,2)+'\n');
// Public verifier reads this same root manifest; the HTML remains byte-identical.
fs.writeFileSync(path.join(here,'BUILD.json'),JSON.stringify(build,null,2)+'\n');
console.log(JSON.stringify({output,url:build.publicURL,sha256:build.previewSHA256,bytes:build.previewBytes,
  nativeChunks:lock.chunks.length,nativeCompressedBytes:lock.compressedBytes,visualAcceptance:false},null,2));

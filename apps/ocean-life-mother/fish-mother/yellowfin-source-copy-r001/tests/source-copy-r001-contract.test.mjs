import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const readJson=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const identity=readJson('SOURCE_IDENTITY.json');
const status=readJson('CURRENT_STATUS.json');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sourcePath=path.join(root,'source-workspace/source/tuna_fish_4k.glb');
const evidencePath=path.join(root,'source-workspace/evidence/YELLOWFIN_EXACT_SOURCE_COPY_EVIDENCE_R001.json');
const gatePath=path.join(root,'SOURCE_INGEST_GATE_R001.json');
let n=0;const ok=(v,m)=>{assert(v,m);n++};

ok(identity.taskMode==='REPLICATION_LOCKED','replication mode locked');
ok(identity.referenceId==='FISH-REF-002','exact reference id');
ok(identity.selectedVariant.expectedBytes===58908280,'expected byte count locked');
ok(identity.selectedVariant.expectedSha256==='5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe','expected hash locked');
ok(identity.pinnedUpstream.commit==='c8c32e7880733ffd628c6106fd5749a2abab97c3','upstream commit pinned');
ok(status.gates.generationLocked===true,'generation stays locked');
ok(status.gates.independentReconstructionUnlocked===false,'independent reconstruction stays locked');
ok(html.includes("const EXPECTED_SHA='5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe'"),'browser hash guard present');
ok(html.includes('REPLICATION_LOCKED'),'workbench mode visible');
ok(html.includes('fixed提交镜像')||html.includes('固定提交镜像'),'pinned mirror fallback visible');

ok(fs.existsSync(sourcePath),'verified source binary committed');
const bytes=fs.readFileSync(sourcePath);
ok(bytes.length===58908280,'source byte count exact');
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
ok(sha===identity.selectedVariant.expectedSha256,'source sha256 exact');
ok(fs.existsSync(evidencePath),'R006 evidence extracted');
const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
ok(evidence.input.sha256===sha,'evidence bound to exact source');
ok(evidence.input.bytes===bytes.length,'evidence byte count bound');
ok(fs.existsSync(gatePath),'source ingest gate emitted');
const gate=JSON.parse(fs.readFileSync(gatePath,'utf8'));
ok(gate.checks.exactSha256Verified===true,'ingest hash gate passed');
ok(gate.checks.r006ExtractorExecuted===true,'R006 extractor executed');
ok(gate.checks.strictReferencePackageBuilt===true,'strict package built');
ok(gate.independentReconstructionUnlocked===false,'copy acceptance still required');

console.log(`Yellowfin Source Copy R001 contract: ${n} assertions passed`);

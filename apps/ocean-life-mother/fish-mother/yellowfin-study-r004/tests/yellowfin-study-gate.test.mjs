import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('./../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));

const norm=read('NORMALIZED_SOURCE_MEASUREMENTS_R001.json');
const conflict=read('SOURCE_AUTHORITY_CONFLICT_LEDGER_R001.json');
const progress=read('STUDY_PROGRESS_R001.json');

let checks=0;
const ok=(v,m)=>{assert(v,m);checks++};

ok(norm.referenceId==='FISH-REF-002','source reference locked');
ok(norm.coordinateFrame.sourceBodyLength===3.003418,'source body length');
ok(norm.coordinateFrame.x.includes('sourceBodyLength'),'x normalized');
ok(norm.coordinateFrame.u.includes('sourceY-tailY'),'u normalized');
ok(norm.coordinateFrame.z.includes('sourceBodyLength'),'z normalized');
ok(Array.isArray(norm.usageRules)&&norm.usageRules.some(x=>x.includes('Do not mix')),'frame mixing prohibited');
ok(norm.anatomyPartitionAnchorsAlreadyNormalized.upperJaw[1]===0.900217,'upper jaw u preserved');
ok(norm.anatomyPartitionAnchorsAlreadyNormalized.eyeLeft[1]===0.882019,'eye u preserved');
ok(norm.anatomyPartitionAnchorsAlreadyNormalized.peduncle2[1]===0.274335,'peduncle u preserved');

const headPair=norm.derivedAnchorDistancesPctBodyLength.find(x=>x.a==='snout'&&x.b==='head');
ok(headPair && headPair.distancePctL>25.3 && headPair.distancePctL<25.4,'snout-head anchor distance stable');

ok(conflict.comparableFacts.length===1,'only one currently comparable morphometric');
ok(conflict.nonComparableWithoutFurtherMeasurement.length>=4,'non-comparable metrics explicitly retained');
ok(conflict.rules.some(x=>x.includes('Do not force')),'authority metric coercion prohibited');

ok(progress.generationLocked===true,'generation remains locked');
ok(progress.nextAllowedBuild==='YELLOWFIN-SOURCE-COPY-R001','next build name fixed');
ok(progress.open.includes('finlet exact dorsal and ventral count on FISH-REF-002'),'finlet source measurement still open');
ok(progress.open.includes('minimum caudal peduncle width/depth'),'peduncle measurement still open');

const invalid=fs.readFileSync(new URL('../yellowfin-study-r003/INVALID_COORDINATE_FRAME.md',root),'utf8');
ok(invalid.includes('must not be used'),'R003 invalidation preserved');
ok(!fs.existsSync(new URL('SOURCE_COPY_GEOMETRY.glb',root)),'no premature source-copy geometry');

console.log(`Yellowfin study gate: ${checks} assertions passed`);

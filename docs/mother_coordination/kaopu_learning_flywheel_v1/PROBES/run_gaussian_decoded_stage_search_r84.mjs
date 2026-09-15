import fs from 'node:fs';
import crypto from 'node:crypto';

const R80_PATH=process.env.R80_PATH||'docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_alpha_calibration_result_r80.json';
const R82_PATH=process.env.R82_PATH||'docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_color_decode_result_r82.json';
const R80_HASH='19fc9645e760d2fe3fc363985d9c52f07166979abbf5a3e3276ee16f41c7eab8';
const R82_HASH='0463086b181acd9d7991acb07c693b8d1179aba5f65b58d155bbdca5108802f1';
const MATRIX_ID='KAOPU-GAUSSIAN-R84-DECODED-STAGE-MATRIX-A';
const INITIAL_SEED=0x84c0ffee,MAX_SAMPLES=1000000;
const EXPECTED={
  no_sum:{sample:3460,alpha1Byte:140,color1RawByte:143,color1DecodedByte:157,alpha2Byte:40,color2RawByte:67,color2DecodedByte:14,prefix1:0.1402587890625,values:{staged:0.134765625,no_comp:0.134765625,no_prod:0.134765625,no_sum:0.1346435546875}},
  no_prod:{sample:50805,alpha1Byte:84,color1RawByte:127,color1DecodedByte:127,alpha2Byte:119,color2RawByte:164,color2DecodedByte:196,prefix1:0.06805419921875,values:{staged:0.2037353515625,no_comp:0.2037353515625,no_prod:0.20361328125,no_sum:0.2037353515625}},
  no_comp:{sample:443253,alpha1Byte:207,color1RawByte:225,color1DecodedByte:255,alpha2Byte:144,color2RawByte:186,color2DecodedByte:238,prefix1:0.336669921875,values:{staged:0.476318359375,no_comp:0.4765625,no_prod:0.476318359375,no_sum:0.476318359375}}
};
const OLD_R81={
  no_comp:[[21,248],[52,1]],
  no_prod:[[13,8],[123,248]],
  no_sum:[[1,224],[120,192]]
};
const OLD_EXPECTED={no_comp:0.03125,no_prod:0.2000732421875,no_sum:0.19189453125};
const r80=JSON.parse(fs.readFileSync(R80_PATH,'utf8')),r82=JSON.parse(fs.readFileSync(R82_PATH,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const alpha=Float32Array.from(r80.calibration.entries.map(x=>x.centerAlpha));
const decoded=Uint8Array.from(r82.entries.map(x=>x.decodedBytes[0]));

// Exact port of the pinned Three.js r186 DataUtils lookup-table conversion used by R78-R83.
const buffer=new ArrayBuffer(4),floatView=new Float32Array(buffer),uint32View=new Uint32Array(buffer);
const baseTable=new Uint32Array(512),shiftTable=new Uint32Array(512),mantissaTable=new Uint32Array(2048),exponentTable=new Uint32Array(64),offsetTable=new Uint32Array(64);
for(let i=0;i<256;i++){const e=i-127;if(e<-27){baseTable[i]=0;baseTable[i|256]=0x8000;shiftTable[i]=shiftTable[i|256]=24;}else if(e<-14){baseTable[i]=0x0400>>(-e-14);baseTable[i|256]=(0x0400>>(-e-14))|0x8000;shiftTable[i]=shiftTable[i|256]=-e-1;}else if(e<=15){baseTable[i]=(e+15)<<10;baseTable[i|256]=((e+15)<<10)|0x8000;shiftTable[i]=shiftTable[i|256]=13;}else if(e<128){baseTable[i]=0x7c00;baseTable[i|256]=0xfc00;shiftTable[i]=shiftTable[i|256]=24;}else{baseTable[i]=0x7c00;baseTable[i|256]=0xfc00;shiftTable[i]=shiftTable[i|256]=13;}}
for(let i=1;i<1024;i++){let m=i<<13,e=0;while((m&0x00800000)===0){m<<=1;e-=0x00800000;}m&=~0x00800000;e+=0x38800000;mantissaTable[i]=m|e;}
for(let i=1024;i<2048;i++)mantissaTable[i]=0x38000000+((i-1024)<<13);
for(let i=1;i<31;i++)exponentTable[i]=i<<23;exponentTable[31]=0x47800000;exponentTable[32]=0x80000000;for(let i=33;i<63;i++)exponentTable[i]=0x80000000+((i-32)<<23);exponentTable[63]=0xc7800000;for(let i=1;i<64;i++)if(i!==32)offsetTable[i]=1024;
function toHalfFloat(v){floatView[0]=Math.max(-65504,Math.min(65504,v));const f=uint32View[0],e=(f>>23)&0x1ff;return baseTable[e]+((f&0x007fffff)>>shiftTable[e]);}
function fromHalfFloat(v){const m=v>>10;uint32View[0]=mantissaTable[offsetTable[m]+(v&0x3ff)]+exponentTable[m];return floatView[0];}
function halfRoundNearestEven(value){const lowBits=toHalfFloat(Math.fround(value)),low=fromHalfFloat(lowBits);if(low===value)return low;const highBits=lowBits+1,high=fromHalfFloat(highBits),dl=value-low,dh=high-value;if(dl<dh)return low;if(dh<dl)return high;return(lowBits&1)===0?low:high;}
function evaluate(a1b,r1,a2b,r2){const a1=alpha[a1b],a2=alpha[a2b],src1=decoded[r1]/255,src2=decoded[r2]/255,prefix1=halfRoundNearestEven(Math.fround(src1*a1)),comp=Math.fround(1-a2),s=Math.fround(src2*a2),d=Math.fround(prefix1*comp);return{prefix1,values:{staged:halfRoundNearestEven(Math.fround(s+d)),no_comp:halfRoundNearestEven(Math.fround(s+Math.fround(prefix1*(1-a2)))),no_prod:halfRoundNearestEven(Math.fround(src2*a2+prefix1*comp)),no_sum:halfRoundNearestEven(s+d)}};}
function isolation(name,v){return name==='no_comp'?v.no_comp!==v.staged&&v.no_prod===v.staged&&v.no_sum===v.staged:name==='no_prod'?v.no_prod!==v.staged&&v.no_comp===v.staged&&v.no_sum===v.staged:v.no_sum!==v.staged&&v.no_comp===v.staged&&v.no_prod===v.staged;}
let seed=INITIAL_SEED>>>0;function nextByte(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;}
const found={};let samplesExecuted=0;
for(let sample=0;sample<MAX_SAMPLES&&Object.keys(found).length<3;sample++){samplesExecuted=sample+1;const alpha1Byte=nextByte(),color1RawByte=nextByte(),alpha2Byte=nextByte(),color2RawByte=nextByte(),ev=evaluate(alpha1Byte,color1RawByte,alpha2Byte,color2RawByte);for(const name of ['no_comp','no_prod','no_sum'])if(!found[name]&&isolation(name,ev.values))found[name]={sample,alpha1Byte,color1RawByte,color1DecodedByte:decoded[color1RawByte],alpha2Byte,color2RawByte,color2DecodedByte:decoded[color2RawByte],...ev};}
const oldR81Replay=Object.fromEntries(Object.entries(OLD_R81).map(([name,[[a1,r1],[a2,r2]]])=>{const ev=evaluate(a1,r1,a2,r2);return[name,{...ev,allModelsCollapsed:new Set(Object.values(ev.values)).size===1,expectedExact:Object.values(ev.values).every(x=>x===OLD_EXPECTED[name])}];}));
const candidateMatrix={id:MATRIX_ID,status:'Candidate-unrendered-target',cases:Object.fromEntries(Object.entries(found).map(([name,x])=>[name,{targetAblation:name,targetChannel:name==='no_comp'?0:name==='no_prod'?1:2,records:[{alphaByte:x.alpha1Byte,colorRawByte:x.color1RawByte,colorDecodedByte:x.color1DecodedByte},{alphaByte:x.alpha2Byte,colorRawByte:x.color2RawByte,colorDecodedByte:x.color2DecodedByte}],prefix1:x.prefix1,predictedHalf:x.values}]))};
const checks={r80TableIdentity:r80.schema==='kaopu-gaussian-alpha-calibration/r80'&&sha(Buffer.from(alpha.buffer))===R80_HASH,r82TableIdentity:r82.schema==='kaopu-gaussian-color-decode/r82'&&sha(Buffer.from(decoded))===R82_HASH,r83CollapseReproduced:Object.values(oldR81Replay).every(x=>x.allModelsCollapsed&&x.expectedExact),boundedSearch:Object.keys(found).length===3&&samplesExecuted<=MAX_SAMPLES,expectedFirstHitsExact:JSON.stringify(found)===JSON.stringify(EXPECTED),allThreeIsolated:Object.entries(found).every(([name,x])=>isolation(name,x.values)),newIdentity:MATRIX_ID!=='R81'&&!MATRIX_ID.includes('UNCHANGED-R81'),noHalfTargetRendered:true};
const result={schema:'kaopu-gaussian-decoded-stage-search/r84',status:Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail',question:'Can a newly identified raw-SPZ-byte matrix isolate complement, product and sum staging after the frozen r186 decode?',answer:Object.keys(found).length===3?'yes-candidate-matrix-found':'not-in-budget',sourceLocks:{r80Hash:R80_HASH,r82Hash:R82_HASH,threeRevision:'0.186.0',dataUtilsCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',dataUtilsBlob:'44e34e8d912528aa9f7219390e9ba82b6c9609c6'},search:{method:'fixed-seed LCG candidate discovery replay; not exhaustive',initialSeed:INITIAL_SEED>>>0,finalSeed:seed,maxSamples:MAX_SAMPLES,samplesExecuted,firstHits:found},oldR81Replay,candidateMatrix,checks,interpretation:{observation:'The fixed search replay reproduced the R83 collapse and found one decoded-aware scalar discriminator for each of the three declared ablations.',candidate:'The new matrix is suitable only for a separately preregistered Half prefix-1 target test.',rejected:['Reuse the R81 identity.','Call the bounded pseudorandom search exhaustive.','Treat CPU discrimination as renderer-stage evidence.'],observationRoots:{r80Runtime:'Inherited Float calibration on Chromium/ANGLE SwiftShader.',r82Parser:'Inherited pinned parser table; official source and byte-identical execution remain one lineage.',r84Search:'Deterministic CPU candidate generation and replay.'}},limits:{candidateDiscoveryWasExploratoryBeforeFreeze:true,searchExhaustive:false,halfTargetRendered:false,hardwareGpu:false,webgpu:false,targetDevice:false,realAsset:false,humanAcceptance:false,motherAdoptionAcknowledged:false}};
fs.writeFileSync('r84-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,answer:result.answer,samplesExecuted,firstHits:found,checks},null,2));if(result.status!=='Candidate-pass')process.exitCode=10;

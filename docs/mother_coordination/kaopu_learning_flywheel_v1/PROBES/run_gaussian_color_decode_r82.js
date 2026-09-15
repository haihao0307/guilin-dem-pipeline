import fs from 'node:fs';
import crypto from 'node:crypto';
import { SPZLoader } from 'three/addons/loaders/SPZLoader.js';
import { gzipSync } from 'three/addons/libs/fflate.module.js';

const THREE_COMMIT='148ef33ecb6d2502ff796d4554abd1549c95d519';
const SPZ_LOADER_BLOB='456aa33e7c6e10bec74b34a5413606bb45bb0c16';
const UTILS_BLOB='9d4752a92b01ce2aa936253e03f3315c8d154a48';
const EXPECTED_TABLE_HASH='0463086b181acd9d7991acb07c693b8d1179aba5f65b58d155bbdca5108802f1';
const SH_C0=0.2820947917738781,SPZ_COLOR_SCALE=SH_C0/0.15,ROTATION_PACKED=0xc0000115;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function gitBlob(b){return crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');}
function expectedByte(i){const out=new Uint8ClampedArray(1);out[0]=((i/255-0.5)*SPZ_COLOR_SCALE+0.5)*255;return out[0];}
function rawSpz(colorByte){const bytes=new Uint8Array(36),view=new DataView(bytes.buffer);view.setUint32(0,0x5053474e,true);view.setUint32(4,3,true);view.setUint32(8,1,true);view.setUint8(12,0);view.setUint8(13,12);view.setUint8(14,0);view.setUint8(15,0);let o=25;bytes[o++]=255;bytes[o++]=colorByte;bytes[o++]=colorByte;bytes[o++]=colorByte;bytes[o++]=128;bytes[o++]=96;bytes[o++]=96;view.setUint32(o,ROTATION_PACKED,true);return bytes;}

const packageJson=JSON.parse(fs.readFileSync('node_modules/three/package.json','utf8'));
const loaderBytes=fs.readFileSync('node_modules/three/examples/jsm/loaders/SPZLoader.js');
const utilsBytes=fs.readFileSync('node_modules/three/examples/jsm/utils/GaussianSplatUtils.js');
const sourceIdentity={packageVersion:packageJson.version,threeCommit:THREE_COMMIT,spzLoaderGitBlob:gitBlob(loaderBytes),spzLoaderExpectedBlob:SPZ_LOADER_BLOB,utilsGitBlob:gitBlob(utilsBytes),utilsExpectedBlob:UTILS_BLOB};

const entries=[];
for(let sourceByte=0;sourceByte<256;sourceByte++){
  const raw=rawSpz(sourceByte),gzip=gzipSync(raw,{mtime:0}),geometry=new SPZLoader().parse(gzip.buffer.slice(gzip.byteOffset,gzip.byteOffset+gzip.byteLength)),color=geometry.getAttribute('color'),expected=expectedByte(sourceByte);
  entries.push({sourceByte,expectedByte:expected,arrayConstructor:color.array.constructor.name,normalized:color.normalized,decodedBytes:Array.from(color.array),normalizedGet:[color.getX(0),color.getY(0),color.getZ(0),color.getW(0)],count:color.count,itemSize:color.itemSize});
}
const table=Uint8Array.from(entries.map(x=>x.decodedBytes[0])),distinct=[...new Set(table)],strictIncreases=Array.from(table).slice(1).filter((v,i)=>v>table[i]).length,plateaus=Array.from(table).slice(1).filter((v,i)=>v===table[i]).length;
const stats={tableHash:sha256(table),distinctDecodedBytes:distinct.length,zeroLastSourceByte:Array.from(table).lastIndexOf(0),fullFirstSourceByte:Array.from(table).indexOf(255),strictIncreases,plateaus,examples:Object.fromEntries([0,1,8,21,52,59,60,120,123,128,192,195,196,224,248,255].map(i=>[i,table[i]]))};
const checks={
  packageVersion:packageJson.version==='0.186.0',
  sourceBlobIdentity:sourceIdentity.spzLoaderGitBlob===SPZ_LOADER_BLOB&&sourceIdentity.utilsGitBlob===UTILS_BLOB,
  all256Covered:entries.length===256&&entries.every((x,i)=>x.sourceByte===i),
  expectedFormulaExact:entries.every(x=>x.decodedBytes[0]===x.expectedByte&&x.decodedBytes[1]===x.expectedByte&&x.decodedBytes[2]===x.expectedByte),
  alphaPreserved:entries.every(x=>x.decodedBytes[3]===255),
  attributeContract:entries.every(x=>x.arrayConstructor==='Uint8ClampedArray'&&x.normalized===true&&x.count===1&&x.itemSize===4),
  normalizedReadsExact:entries.every(x=>x.normalizedGet[0]===x.expectedByte/255&&x.normalizedGet[1]===x.expectedByte/255&&x.normalizedGet[2]===x.expectedByte/255&&x.normalizedGet[3]===1),
  tableHash:stats.tableHash===EXPECTED_TABLE_HASH,
  nondecreasing:Array.from(table).every((v,i,a)=>i===0||v>=a[i-1]),
  saturationAndMultiplicity:stats.zeroLastSourceByte===59&&stats.fullFirstSourceByte===196&&stats.distinctDecodedBytes===138&&stats.strictIncreases===137&&stats.plateaus===118
};
const result={schema:'kaopu-gaussian-color-decode/r82',status:Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail',question:'Does the pinned Three.js r186 parser produce the complete COLOR_LUT contract predicted by its official source for all 256 SPZ color bytes?',sourceIdentity,constants:{SH_C0,SPZ_COLOR_SCALE,expectedTableHash:EXPECTED_TABLE_HASH},method:{oneRecordPerParse:true,sourceRgb:'same tested byte in all three channels',sourceAlphaByte:255,spzVersion:3,attributeRead:'underlying Uint8ClampedArray and normalized BufferAttribute getters',renderTargetUsed:false,gpuUsed:false},entries,stats,checks,interpretation:{observation:'The installed source bytes and all 256 decoded parser outputs are executable observations. The formula is independently read from the same locked official source and is not a separate implementation root.',candidate:'The frozen table may be used as an input contract for a later separately preregistered replay of unchanged R81 cases.',rejected:['Raw SPZ color byte divided by 255 is the general decoded attribute value.','SPZ color encoding preserves 256 distinct output levels in this r186 path.'],observationRoots:{officialSource:'Pinned Three.js source at '+THREE_COMMIT,executableParser:'Node.js execution of the byte-identical npm package; reproducibility evidence, not algorithmically independent of official source.'}},limits:{parserOnly:true,noGaussianRender:true,noHalfTarget:true,noGpu:true,noArithmeticStageConclusion:true,hardwareGpu:false,webgpu:false,targetDevice:false,realAsset:false,humanAcceptance:false,motherAdoptionAcknowledged:false}};
fs.writeFileSync('r82-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,sourceIdentity,stats,checks},null,2));if(result.status!=='Candidate-pass')process.exitCode=10;

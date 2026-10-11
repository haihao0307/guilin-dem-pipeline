import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {CONTROL_GROUPS,FUSION_DEFAULTS,fusion,setFusion,regionWeights,organicNoise,edgeRetreat,regionalLength,regionalDensity,normalizedBeardWeights,blendedBeardCoverage,beardLengthScale,blendedBeardDirection} from '../src/FusionFields.js';
import {beardField} from '../src/RegionFields.js';
import {checkedDownload,readStream,loadFixedAsset} from '../src/AssetLoader.js';
const checks=[];function check(name,condition){assert(condition,name);checks.push(name);console.log('PASS',name)}
check('35 regional controls with unique keys',Object.keys(FUSION_DEFAULTS).length===35&&new Set(Object.values(CONTROL_GROUPS).flat().map(r=>r[0])).size===35);
const ear=[.080,.29,.005],nape=[.02,.278,-.072],crown=[.018,.38,.02];
const original={...fusion};setFusion({hairEarTaper:0,hairNapeTaper:0,hairEarContour:0,hairNapeContour:0});
const plain=regionalLength(ear,.001),nplain=regionalLength(nape,.001);
check('disabled contours do not retreat any root boundary',edgeRetreat(ear)===0&&edgeRetreat(nape)===0);
setFusion(original);check('ear edge is gradually shorter',regionalLength(ear,.001)<plain);
check('nape edge is gradually shorter',regionalLength(nape,.001)<nplain);
check('interior taper tends to original regional length',Math.abs(regionalLength(nape,.5)-nplain)<1e-10);
check('crown is outside both edge masks',regionWeights(crown).ear===0&&regionWeights(crown).nape===0&&edgeRetreat(crown)===0&&regionalLength(crown,0)===1);
let stable=true,bounded=true,continuous=true,positive=true;
for(let i=0;i<10000;i++){const p=[Math.sin(i*1.7)*.1,.2+(i%200)/1000,Math.cos(i*.7)*.12],n=organicNoise(p);stable&&=n===organicNoise(p);bounded&&=n>=0&&n<=1;const q=[p[0]+1e-8,p[1],p[2]];continuous&&=Math.abs(n-organicNoise(q))<.0001;positive&&=edgeRetreat(p)>=0&&edgeRetreat(p)<.006;}
check('contour noise is deterministic',stable);check('contour noise remains in [0,1]',bounded);check('contour masks continuous across sampled cell boundaries',continuous);check('contours retreat only within bounded original root domain',positive);
check('original safety boundary never becomes visible outside margin',regionalDensity(ear,-.001)===0&&regionalDensity(nape,-.001)===0);
setFusion({hairEarTaper:100,hairNapeTaper:100});check('maximum taper remains positive',regionalLength(ear,0)>.03&&regionalLength(nape,0)>.03);setFusion(original);
const rows=[];for(let x=-.08;x<=.08;x+=.004)for(let y=.18;y<=.30;y+=.004)for(let z=.03;z<=.12;z+=.01){const p=[x,y,z];if(beardField(p).weight>.01)rows.push(p)}
check('test probes cover nonempty authored beard fields',rows.length>100);
check('beard weights form a normalized partition',rows.every(p=>Math.abs(normalizedBeardWeights(p).reduce((s,w)=>s+w,0)-1)<1e-12));
check('full beard coverage is one in all zones',rows.every(p=>Math.abs(blendedBeardCoverage(p,[1,1,1,1,1])-1)<1e-12));
check('zero beard coverage really hides all zones',rows.every(p=>blendedBeardCoverage(p,[0,0,0,0,0])===0));
check('moustache coverage excludes non-moustache-only roots',rows.filter(p=>beardField(p).weights[1]===0).every(p=>blendedBeardCoverage(p,[0,1,0,0,0])===0));
check('length scale is a bounded continuous mixture',rows.every(p=>beardLengthScale(p)>=.65-1e-12&&beardLengthScale(p)<=1.05+1e-12));
check('blended beard directions are finite normalized and downward',rows.every(p=>{const d=blendedBeardDirection(p);return d.every(Number.isFinite)&&Math.abs(Math.hypot(...d)-1)<1e-12&&d[1]<0}));
const blob=new TextEncoder().encode('exact unchanged model bytes for transport tests');const sha256=createHash('sha256').update(blob).digest('hex');const options={size:blob.length,sha256,idleMs:30,totalMs:150};
const raw=await checkedDownload('mock',{...options,fetchImpl:async()=>new Response(blob)});check('raw bytes and SHA-256 verified',Buffer.from(raw).equals(Buffer.from(blob)));
const packed=await checkedDownload('mock',{...options,gzip:true,fetchImpl:async()=>new Response(gzipSync(blob))});check('lossless gzip returns identical original bytes',Buffer.from(packed).equals(Buffer.from(blob)));
await assert.rejects(()=>checkedDownload('mock',{...options,sha256:'0'.repeat(64),fetchImpl:async()=>new Response(blob)}),/SHA-256/);check('corrupt model hash is rejected',true);
await assert.rejects(()=>checkedDownload('mock',{...options,fetchImpl:async()=>new Response(blob.slice(1))}),/不完整/);check('truncated model is rejected',true);
await assert.rejects(()=>checkedDownload('mock',{...options,fetchImpl:async()=>new Response('',{status:503})}),/HTTP 503/);check('HTTP failure is not reported as loaded',true);
let cancelled=false;await assert.rejects(()=>checkedDownload('stall',{...options,fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled=true}}))}),/停滞|超时/);check('stalled response stream is cancelled by watchdog',cancelled);
const controller=new AbortController();controller.abort(new Error('explicit cancellation'));await assert.rejects(()=>readStream(new ReadableStream(),{signal:controller.signal,maxBytes:10}),/explicit cancellation/);check('caller cancellation is preserved',true);
await assert.rejects(()=>readStream(new Blob([new Uint8Array(12)]).stream(),{maxBytes:10}),/超过/);check('stream byte cap rejects oversized responses',true);
const oldFetch=globalThis.fetch;let calls=[],fallbackNoted=false;try{globalThis.fetch=async url=>{calls.push(url);return url==='packed'?new Response('missing',{status:404}):new Response(blob)};const result=await loadFixedAsset({primary:'packed',fallback:'raw',...options,onFallback:()=>fallbackNoted=true});check('failed compressed path falls back to same verified source',result.transport==='original-raw-fallback'&&Buffer.from(result.buffer).equals(Buffer.from(blob))&&fallbackNoted&&calls.join(',')==='packed,raw');}finally{globalThis.fetch=oldFetch}
setFusion(original);fs.mkdirSync(new URL('../evidence',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../evidence/fields.json',import.meta.url),JSON.stringify({success:true,checks,fieldProbes:10000,beardProbes:rows.length},null,2));

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
/** Audited in independent browser run38380892272: P01/P03/P05 output
 * positions, normals, indices AND RGBA pixels are exactly equal. Only skip
 * eager ancestor-constructor recomputations after the native base is bound;
 * the complete outer update still runs and later edits keep the full path. */
const viewer=__dirname+'/UnifiedViewer.mjs';let s=fs.readFileSync(viewer,'utf8');
const before='update(){if(!this.anatomySurfaces)return super.update();',after='update(){if(!this.anatomySurfaces){if(!this.skin)return super.update();return}';
if(!s.includes(after)){assert.equal(s.split(before).length,2,'R05 constructor source drift');s=s.replace(before,after);fs.writeFileSync(viewer,s);}
// Inspect real compositor output rather than relying on font/RAF screenshots.
// Failed capture still fails the gate; no assertion or view is removed.
const verify=__dirname+'/verify.cjs';s=fs.readFileSync(verify,'utf8');
const old="await p.screenshot({path:out+'/'+n+'.jpg',type:'jpeg',quality:91,timeout:90000});";
const replacement="const session=await p.context().newCDPSession(p);let timeout;try{const image=await Promise.race([session.send('Page.captureScreenshot',{format:'jpeg',quality:91,captureBeyondViewport:false}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Compositor capture timed out: '+n)),90000);})]);fs.writeFileSync(out+'/'+n+'.jpg',Buffer.from(image.data,'base64'));}finally{clearTimeout(timeout);await session.detach();}";
if(!s.includes('Compositor capture timed out')){assert.equal(s.split(old).length,2,'R05 screenshot helper drift');s=s.replace(old,replacement);fs.writeFileSync(verify,s);}
// Re-run the original eight transport failure cases against the actual R05
// parallel transport. A parallel 404 starts three finite requests, not one.
let test=fs.readFileSync(__dirname+'/specialists/lip-startup-r03/unit.mjs','utf8');
test=test.replace("'./ChunkTransport.mjs'","'./StreamTransport.mjs'").replaceAll('kaopu-lips-verified-chunks-p3','kaopu-human-verified-stream-r05');
assert.equal(test.split('assert.equal(calls,1);').length,2);test=test.replace('assert.equal(calls,1);','assert.equal(calls,3);assert.equal(t.stats.retries,0);');
fs.writeFileSync(__dirname+'/test-transport.mjs',test);const result=cp.execFileSync(process.execPath,[__dirname+'/test-transport.mjs'],{encoding:'utf8'}),report=JSON.parse(result);assert(report.passed&&report.checks.length===8&&report.checks.every(x=>x.passed));fs.mkdirSync('r05-evidence',{recursive:true});fs.writeFileSync('r05-evidence/transport-unit.json',result);console.log(result);

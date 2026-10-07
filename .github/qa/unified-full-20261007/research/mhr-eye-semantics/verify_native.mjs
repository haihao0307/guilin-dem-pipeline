/** Read-only evaluation audit. Writes only sibling research outputs. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadMHR} from '../../teachers.mjs';
const O=new URL('./',import.meta.url),m=loadMHR(),zero=()=>({identity:Array(45).fill(0),pose:Array(204).fill(0),expression:Array(72).fill(0),correctives:false});
const base=m.evaluate(zero()).vertices.slice(),cachedBuffer=fs.readFileSync(new URL('../head-channels/mhr-expression-deltas.f32',import.meta.url)),cached=new Float32Array(cachedBuffer.buffer,cachedBuffer.byteOffset,cachedBuffer.byteLength/4),rows=[],deltas=[];
const maxDiff=(a,b)=>a.reduce((v,x,i)=>Math.max(v,Math.abs(x-b[i])),0);
for(let k=14;k<22;k++){
 const s=zero();s.expression[k]=1;const q=m.evaluate(s),v=q.vertices.slice(),delta=Float32Array.from(v,(x,i)=>x-base[i]);deltas.push(delta);
 const h=zero();h.expression[k]=.5;const half=m.evaluate(h).vertices.slice();
 const n=zero();n.expression[k]=-1;const neg=m.evaluate(n).vertices.slice();
 const on=m.evaluate({...s,correctives:true}).vertices.slice();
 rows.push({index:k,label:m.meta.expression_names[k],cachedMaxDifferenceMM:10*maxDiff(delta,cached.subarray(k*base.length,(k+1)*base.length)),halfLinearMaxErrorMM:10*maxDiff(half,Float64Array.from(base,(x,i)=>x+.5*delta[i])),negativeLinearMaxErrorMM:10*maxDiff(neg,Float64Array.from(base,(x,i)=>x-delta[i])),correctivesOnOffMaxDifferenceMM:10*maxDiff(v,on)});
}
const mix=zero(),weights=[.23,.41,.19,.07,.31,.11,.13,.17];for(let j=0;j<8;j++)mix.expression[14+j]=weights[j];const v=m.evaluate(mix).vertices.slice(),want=Float64Array.from(base,(x,i)=>x+deltas.reduce((s,d,j)=>s+weights[j]*d[i],0));
const report={sourceCommit:m.meta.commit,assetRelease:m.meta.asset_release,rawModelSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../../source/mhr-model.raw.bin',import.meta.url))).digest('hex'),units:'mm',neutralIdentityAndPose:true,coefficient1:true,channels:rows,mixedWeights:weights,mixedLinearMaxErrorMM:10*maxDiff(v,want)};
fs.writeFileSync(new URL('native-verification.json',O),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

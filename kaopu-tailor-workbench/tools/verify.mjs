import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createExample,cut,ClothLab} from '../src/core.mjs';
const result={version:'tailor-seam-lab-r1',date:'2026-10-06',scenarios:{},productionReady:false};
for(const [name,options] of [['straight',{}],['ease8',{ease:0.08}],['loaded',{}]]){
  const spec=createExample(options),lab=new ClothLab(cut(spec));lab.gravity=name==='loaded';const before=lab.metrics();lab.activate('join');for(let i=0;i<180;i++)lab.step();
  const joined=lab.metrics();assert.ok(joined.finite);assert.equal(joined.vertexCount,before.vertexCount);assert.equal(joined.restSignature,before.restSignature);
  if(name==='straight'){assert.ok(joined.maxSeamGapMm<1.2);assert.ok(joined.maxPrincipalStrain<.05);}
  result.scenarios[name]={before,joined,numericGatePassed:joined.maxSeamGapMm<1.2&&joined.maxPrincipalStrain<.05,scope:'synthetic-small-swatch-only'};
}
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const file of ['src/app.mjs','src/core.mjs','style.css'])assert.ok(fs.statSync(new URL('../'+file,import.meta.url)).size>0);
assert.match(html,/不代表短裤完成/);assert.match(html,/未实现布片自碰撞/);assert.match(html,/PatternGSL/);
fs.mkdirSync(new URL('../qa/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../qa/numerical.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

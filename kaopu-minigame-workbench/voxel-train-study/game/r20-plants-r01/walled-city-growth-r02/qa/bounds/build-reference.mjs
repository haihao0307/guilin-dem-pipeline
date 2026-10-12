import fs from 'node:fs';import {compileSettlementRecipe} from '../../compiler/compile.mjs';import {querySettlement} from '../../compiler/kernel.mjs';import {withoutAcceleration} from './reference.mjs';
const source=fs.readFileSync(new URL('../../compiler/kernel.mjs',import.meta.url),'utf8');
const ref=await import('data:text/javascript;base64,'+Buffer.from(withoutAcceleration(source)).toString('base64'));
const r=compileSettlementRecipe(),points=[];
for(const y of [6.44,6.68,6.96,7.23,7.48,7.64])for(const dx of [-.0002,0,.0002]){
 const p=[-19.25+dx,y,-6.22].map(Math.fround),a=querySettlement(r,p,600),b=ref.querySettlement(r,p,600);points.push({p,kind:dx===0?'actual-failed-point':'adjacent-threshold-control',accelerated:a,reference:b});
}
fs.writeFileSync(new URL('./points.json',import.meta.url),JSON.stringify({scope:'18 sparse macro points, six actual failures and adjacent controls; no mother-surface redefinition',cpuReference:'same scalar expressions, all floors, no broad-phase returns or cap',sourceBytes:source.length,points},null,2)+'\n');console.log('18 reference points written');

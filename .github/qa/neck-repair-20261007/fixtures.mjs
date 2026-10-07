import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
import{AnnyModel}from'./baseline/kaopu-unified-human-workbench/src/AnnyModel.js';
import{GNMHeadModel,parseContainer}from'./baseline/kaopu-unified-human-workbench/src/GNMModel.js';
import{UnifiedModel,DEFAULT_STATE}from'./baseline/kaopu-unified-human-workbench/src/UnifiedModel.js';
export const ROOT=path.dirname(fileURLToPath(import.meta.url)),B=path.join(ROOT,'baseline'),U=path.join(B,'kaopu-unified-human-workbench'),out=path.join(ROOT,'research');fs.mkdirSync(out,{recursive:true});
const json=p=>JSON.parse(fs.readFileSync(p)),ab=p=>{const b=fs.readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
export function load(){const am=json(path.join(B,'kaopu-anny-workbench/assets/anny-model.json')),anny=new AnnyModel(am,ab(path.join(B,'kaopu-anny-workbench/assets/anny-model.bin'))),g=parseContainer(ab(path.join(B,'kaopu-face-workbench/assets/gnm_head_web.bin'))),gnm=new GNMHeadModel(g.meta,g.sections),c=json(path.join(U,'assets/canonical.json')),m=new UnifiedModel(anny,gnm,c,json(path.join(U,'assets/mhr-torso-delta.json')),json(path.join(U,'assets/adapter-fingerprint.json')));return{anny,gnm,c,m};}
export{DEFAULT_STATE};
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{anny,gnm,c,m}=load(),contour=c.neckContour,fair=c.neckFairing,rows=[];
 for(const[age,ageValue]of[['young',2/3],['child',1/3],['old',1]])for(const stage of['raw','contour','final']){c.neckContour=stage==='raw'?null:contour;c.neckFairing=stage==='final'?fair:null;const s=DEFAULT_STATE();s.phenotypes.age=ageValue;const v=m.compute(s);fs.writeFileSync(path.join(out,age+'-'+stage+'.bin'),Buffer.from(v.buffer));rows.push({name:age+'-'+stage,state:s,metrics:m.metrics()});}
 c.neckContour=contour;c.neckFairing=fair;const n=m.compute(DEFAULT_STATE());fs.writeFileSync(path.join(out,'neutral.json'),JSON.stringify({vertices:Array.from(n),faces:Array.from(m.faces),bodyCount:m.bodyCount,headBone:m.headBone,referenceHead:m.referenceHead,referenceNeck:m.referenceNeck,headTemplate:Array.from(gnm.template),headRegions:Array.from(gnm.regionId),headComponents:Array.from(gnm.componentId),headMaterials:Array.from(gnm.materialId)}));
 fs.writeFileSync(path.join(out,'ablation-states.json'),JSON.stringify(rows,null,2));console.log(rows.map(r=>({name:r.name,contourMM:r.metrics.neckContourMaxMM,fairMM:r.metrics.neckFairingMaxMM})));
}

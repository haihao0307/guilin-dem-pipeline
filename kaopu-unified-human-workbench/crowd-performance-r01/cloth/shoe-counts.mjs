import fs from 'node:fs/promises';
import {buildStyle} from './shoe-workshop/r14/src/model.mjs';
const rows=[];
for(const id of ['penny','chelsea','monk','canvas']){
 const x=buildStyle(id);
 rows.push({id,vertices:x.parts.reduce((n,p)=>n+p.geometry.attributes.position.count,0),triangles:x.report.triangles,meshParts:x.parts.length,colorPassDraws:x.parts.reduce((n,p)=>n+Math.max(1,p.geometry.groups.length),0),geometryBufferBytes:x.parts.reduce((n,p)=>n+Object.values(p.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(p.geometry.index?.array.byteLength||0),0),generationMS:x.report.generationMs,physicalSolver:false,wearerFitValidated:false});
 for(const p of x.parts)p.geometry.dispose();
}
const report={schema:'native-shoe-capacity-audit@1',sourceCommit:'4306b375404a40b7b9842f29cfa5e53fcde70278',scope:'one shoe, original unmodified R14 generated geometry; draw counts theoretical beauty pass before shadows, not FPS',node:process.version,rows};
await fs.writeFile(new URL('./shoe-counts.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

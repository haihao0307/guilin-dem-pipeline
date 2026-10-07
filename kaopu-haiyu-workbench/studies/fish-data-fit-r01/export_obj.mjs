// Export authored mainform only; never references source-STL coordinates.
import fs from 'node:fs';import {evaluate} from './geometry.mjs';const root=new URL('./',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('data/sample.json',root)));
for(const [name,options]of [['scomber-v2-v12-mainform',{}],['scomber-v8-mainform',{single:8}],['haiyu-mapped-local-segment',{layout:'haiyu',bend:4}]]){
 const q=evaluate(data,options),out=['# Haiyu independently generated structural schematic',' # Units mm; sampled vertebrae only; not a whole fish','# Body faces + 3D arch/spine line curves. No scan triangles.','# Opposite side mirrored; body profile and bridge geometry are authored.'];let count=0;
 for(const m of q.meshes){out.push('o '+m.id);for(const v of m.vertices)out.push('v '+v.map(x=>x.toFixed(7)).join(' '));for(const f of m.faces)out.push('f '+f.map(i=>i+1+count).join(' '));count+=m.vertices.length}
 for(const l of q.lines){out.push('g '+l.id);for(const v of l.points)out.push('v '+v.map(x=>x.toFixed(7)).join(' '));out.push('l '+l.points.map((_,i)=>i+1+count).join(' '));count+=l.points.length}
 fs.writeFileSync(new URL('data/'+name+'.obj',root),out.join('\n')+'\n');console.log(name,count,'vertices');
}

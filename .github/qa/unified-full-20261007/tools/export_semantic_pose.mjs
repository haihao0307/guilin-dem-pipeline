/** Open-mouth native surfaces disambiguate upper/lower lip ray hits. */
import fs from'node:fs';import{loadAnny,loadGNM,loadMHR}from'../teachers.mjs';
const dir=new URL('../research/geometry/',import.meta.url),write=(n,a)=>fs.writeFileSync(new URL(n,dir),Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const a=loadAnny(),g=loadGNM(),m=loadMHR(),probe=JSON.parse(fs.readFileSync(new URL('../fixtures/gnm-jaw-semantic-probe.json',import.meta.url)));
g.setExpressionVector(probe.values);const gv=new Float32Array(g.numVertices*3);g.computeVertices(gv);write('gnm-jawOpen-vertices.f32',gv);
write('anny-jawOpen-vertices.f32',a.forward({phenotypes:{age:2/3},facialActions:{jawOpen:1}}).vertices);
const state={...m.state,expression:new Float32Array(72)};state.expression[m.meta.expression_names.indexOf('jawDrop')]=1;write('mhr-jawOpen-vertices.f32',m.evaluate(state).vertices);
fs.writeFileSync(new URL('semantic-pose-inputs.json',dir),JSON.stringify({gnm:probe,anny:{phenotypes:{age:2/3},facialActions:{jawOpen:1}},mhr:{expression:{jawDrop:1}},purpose:'Rest-triangle correspondence from native articulated surfaces; not expression-adapter validation'},null,2));

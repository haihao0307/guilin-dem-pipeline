import assert from 'node:assert/strict';import fs from 'node:fs';
const shader=fs.readFileSync(new URL('../src/leaf.js',import.meta.url),'utf8'),coefficients=shader.match(/absorptionPerMM=vec3\(([^)]+)\)/)[1].split(',').map(Number),transmittance=(mm,cosine)=>coefficients.map(s=>Math.exp(-s*mm/Math.max(.20,Math.abs(cosine))));
const thin=transmittance(.04,1),secondary=transmittance(.30,1),primary=transmittance(1.2,1),grazing=transmittance(.04,.2);
for(let k=0;k<3;k++){assert.ok(thin[k]>secondary[k]&&secondary[k]>primary[k]);assert.ok(grazing[k]<thin[k]);assert.ok(thin[k]>=0&&thin[k]<=1);}
assert.ok(thin[1]>thin[0]&&thin[1]>thin[2]);
const report={status:'PASS',stage:'CPU optical-rule monotonicity only, not GLSL verification',units:'millimetres',coefficients,assumedLaminarThickness:.04,thin,secondary,primary,grazing,greenContrast:thin[1]/primary[1],physicalCalibration:false,multipleScattering:false};fs.writeFileSync(new URL('../qa/absorption-rule-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);

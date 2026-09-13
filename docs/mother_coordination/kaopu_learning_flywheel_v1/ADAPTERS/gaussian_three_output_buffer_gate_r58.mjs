import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const required=['fourSuccessfulPages','allPageChecks','sourceLocked','defaultIsHalfFloat','explicitIsFloat','floatPathMatchesSource','halfPathFiniteAndBounded','webglCanvasClassified','webgpuCanvasClassified'];
const missing=required.filter(k=>input.checks?.[k]!==true);
const out={schema:'kaopu-three-output-buffer-gate/r58',status:missing.length?'Candidate-fail':'Candidate-pass',requiredChecks:required,failedChecks:missing,limits:input.limits};
process.stdout.write(JSON.stringify(out,null,2)+'\n');if(missing.length)process.exitCode=10;

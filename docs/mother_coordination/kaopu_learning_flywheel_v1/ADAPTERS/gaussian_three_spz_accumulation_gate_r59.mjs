import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const required=['twoSuccessfulPages','allPageChecks','sameLockedSpz','actualLoaderAndSplat','normalBlendAndSortControlled','pairedLayerGradient','accumulationOutcomeClassified','tailBehaviorClassified','presentationCaptured'];
const failed=required.filter(k=>input.checks?.[k]!==true);
const out={schema:'kaopu-three-spz-accumulation-gate/r59',status:failed.length?'Candidate-fail':'Candidate-pass',requiredChecks:required,failedChecks:failed,limits:input.limits};
process.stdout.write(JSON.stringify(out,null,2)+'\n');if(failed.length)process.exitCode=10;

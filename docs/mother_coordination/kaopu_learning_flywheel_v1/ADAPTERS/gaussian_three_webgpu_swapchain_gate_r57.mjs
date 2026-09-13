import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const required=['twoSuccessfulRuns','allPageChecks','sourceLocked','swapchainNotBlank','swapchainWithinTwoCodes','linearAndSrgbSwapchainDiffer','screenshotControlClassified'];
const missing=required.filter(k=>input.checks?.[k]!==true);
const out={schema:'kaopu-three-webgpu-swapchain-gate/r57',status:missing.length?'Candidate-fail':'Candidate-pass',requiredChecks:required,failedChecks:missing,limits:input.limits};
process.stdout.write(JSON.stringify(out,null,2)+'\n');if(missing.length)process.exitCode=10;

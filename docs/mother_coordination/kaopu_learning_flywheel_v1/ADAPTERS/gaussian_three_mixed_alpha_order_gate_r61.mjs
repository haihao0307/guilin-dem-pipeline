import fs from 'node:fs';
const d=JSON.parse(fs.readFileSync(0,'utf8'));
const required=['allPagesSuccessful','allPageChecks','pairSourcesSame','calibrationComplete','oneMultiset','distinctSequences','metricExactlyMatched','floatOrderStable','orderCounterexample','presentationCaptured','outcomeClassified'];
const failed=required.filter(k=>d.checks?.[k]!==true);
const out={schema:'kaopu-three-mixed-alpha-order-gate/r61',status:failed.length?'Candidate-fail':'Candidate-pass',requiredChecks:required,failedChecks:failed,assessment:d.analysis?.sumAlphaSquaredAssessment??'unclassified',limits:d.limits};
process.stdout.write(JSON.stringify(out,null,2)+'\n');
if(failed.length)process.exitCode=10;


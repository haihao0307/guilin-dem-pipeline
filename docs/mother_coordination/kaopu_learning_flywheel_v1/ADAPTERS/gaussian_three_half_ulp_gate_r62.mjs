let raw='';for await(const chunk of process.stdin)raw+=chunk;
const d=JSON.parse(raw),required=['allPageChecks','distinctSequences','lockedR61Reproduced','halfReplayExact','floatReplayClose','thresholdCountEqualsExactStalls','targetCountCollision','targetObservedOutputDivergence','outcomeClassified'];
const failures=required.filter(k=>d.checks?.[k]!==true);
const out={schema:'kaopu-three-half-ulp-gate/r62',status:failures.length?'Candidate-fail':'Candidate-pass',inputSchema:d.schema,failures,assessment:d.analysis?.assessment,stepMechanismAssessment:d.analysis?.stepMechanismAssessment,targetSameCount:d.analysis?.targetSameCount,targetHalfObservedAbsDifference:d.analysis?.targetHalfObservedAbsDifference,limits:d.limits};
process.stdout.write(JSON.stringify(out,null,2)+'\n');if(failures.length)process.exitCode=10;

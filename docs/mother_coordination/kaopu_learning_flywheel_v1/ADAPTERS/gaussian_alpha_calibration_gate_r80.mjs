let raw='';for await(const chunk of process.stdin)raw+=chunk;const d=JSON.parse(raw);
const required=['allPageChecks','all256Covered','centerStrictlyIncreasing','zeroAtByte0','noHalfTargets','candidateFound','candidateIsolated','independentRepeats'];
const failures=required.filter(k=>d.checks?.[k]!==true);if(d.schema!=='kaopu-gaussian-alpha-calibration/r80')failures.push('schema');if(d.limits?.halfTargetRendered!==false)failures.push('halfTargetRendered');
const out={schema:'kaopu-gaussian-alpha-calibration-gate/r80',status:failures.length?'Candidate-fail':'Candidate-pass',failures,centerTableHash:d.calibration?.centerTableHash,minimumPositive:d.calibration?.minimumPositive,maximum:d.calibration?.maximum,repeatBytes:d.calibration?.repeatBytes,repeatComparisons:d.calibration?.repeatComparisons,derivedCandidate:d.derivedCandidate,checks:d.checks,limits:d.limits};
process.stdout.write(JSON.stringify(out,null,2)+'\n');if(failures.length)process.exitCode=10;

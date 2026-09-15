let raw='';for await(const chunk of process.stdin)raw+=chunk;const d=JSON.parse(raw);
const required=['packageVersion','sourceBlobIdentity','all256Covered','expectedFormulaExact','alphaPreserved','attributeContract','normalizedReadsExact','tableHash','nondecreasing','saturationAndMultiplicity'];
const failures=required.filter(k=>d.checks?.[k]!==true);if(d.schema!=='kaopu-gaussian-color-decode/r82')failures.push('schema');if(d.status!=='Candidate-pass')failures.push('result-status');
const out={schema:'kaopu-gaussian-color-decode-gate/r82',status:failures.length?'Candidate-fail':'Candidate-pass',failures,sourceIdentity:d.sourceIdentity,constants:d.constants,stats:d.stats,checks:d.checks,limits:d.limits};
process.stdout.write(JSON.stringify(out,null,2)+'\n');if(failures.length)process.exitCode=10;

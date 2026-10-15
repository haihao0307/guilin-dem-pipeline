// Focused follow-up after full unchanged SDF regression at 710b9206.
// Existing workflow is unchanged. This entry checks all 57 unchanged baseline files,
// runs the complete geometry CPU contracts, then real continuous WebGL interaction.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const base=path.resolve(__dirname,'..'),qa=path.join(base,'geometry-orbit-r01/qa'),baseline=JSON.parse(fs.readFileSync(path.join(qa,'sdf-source-baseline.json')));
for(const f of baseline.oldSourceFiles){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f.path))).digest('hex');if(actual!==f.sha256)throw Error('Original SDF source changed: '+f.path)}
console.log('UNCHANGED_SDF_BASELINE',baseline.baseline,baseline.oldSourceFiles.length,'files');
execFileSync(process.execPath,[path.join(qa,'geometry.test.mjs')],{stdio:'inherit'});
require(path.join(qa,'browser.cjs'));

const fs=require('fs'),assert=require('node:assert/strict');
const root=process.env.QA_ROOT||'qa-eye-e1';
const reference=JSON.parse(fs.readFileSync(root+'/reference-ae2bd807/stability-report.json'));
const fixed=JSON.parse(fs.readFileSync(root+'/stability/stability-report.json'));
const main=JSON.parse(fs.readFileSync(root+'/e2/report.json'));
const checks=[];
function check(name,pass){checks.push({name,pass:!!pass});}
function mode(r,name){return r.modes.find(m=>m.mode===name);}
check('pinned failing source was actually routed',reference.shaderVariant==='reference-ae2bd807'&&reference.checks.filter(c=>c.name.startsWith('immutable reference shader')).length===2&&reference.checks.every(c=>c.pass));
check('same immutable ET13 page',reference.base===fixed.base&&fixed.base==='2702e9482cfd1655411bb0920929872669301334');
check('same actual original framebuffer',mode(reference,'native-baseline').rows[0].hash===mode(fixed,'native-baseline').rows[0].hash);
check('reference original control remains stable',mode(reference,'native-baseline').distinct===1&&mode(reference,'original').distinct===1);
check('legacy error reproduced upstream or at output',!reference.pass&&!reference.error&&reference.errors.length===0&&['refracted-tissue','refracted-no-relief'].some(n=>{const m=mode(reference,n);return m.distinct>1||m.rows.some(row=>row.targetProbe.some((p,i)=>JSON.stringify(p.values)!==JSON.stringify(m.rows[0].targetProbe[i].values)));}));
check('fixed all 13 modes exact repeated output and upstream probe',fixed.pass===true&&fixed.probeStable===true&&fixed.modes.length===13);
check('both variants used same camera and source positions',fixed.modes.every(m=>{const ref=mode(reference,m.mode);return !ref||JSON.stringify(ref.rows[0].cameraMatrix)===JSON.stringify(m.rows[0].cameraMatrix)&&JSON.stringify(ref.rows[0].projectionMatrix)===JSON.stringify(m.rows[0].projectionMatrix)&&ref.rows[0].version===m.rows[0].version;}));
check('fixed full browser suite and all five strict byte checks pass',main.pass===true&&main.strictBytePass===true&&main.strictByteChecks.length===5&&main.strictByteChecks.every(c=>c.pass));
const result={pass:checks.every(c=>c.pass),checks,referenceCommit:reference.reference?.commit,fixedCommit:fixed.commit,previousStrictFailuresPreserved:reference.reference?.strictByteChecks.filter(c=>!c.pass),interpretation:'Shader-only A/B. No epsilon/tolerance replaces exact bytes; geometry/shape/material settings remain fixed. Film-eye appearance is outside this numeric repair.'};
fs.writeFileSync(root+'/controlled-ab.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert(result.pass,'Controlled derivative repair failed');

'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.argv[2],online=process.argv[3],offline=process.argv[4];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected={online:hash(online),offline:hash(offline)};
const files=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else if(/^cluster-(file|public)-(core|catalog|orbit|touch)-results\.json$/.test(e.name))files.push(q);}}walk(root);
const supplementalReports=files.map(f=>({file:f,value:JSON.parse(fs.readFileSync(f))}));
if(supplementalReports.length===8&&supplementalReports.every(x=>x.value.scope==='skin-file-preview-r1')){
 const errors=[],matrixResult=process.env.HAIR_QA_MATRIX_RESULT;
 if(matrixResult!=='success')errors.push('Skin preview matrix incomplete: '+matrixResult);
 for(const phase of ['file','public'])for(const group of ['core','catalog','orbit','touch']){
  const matches=supplementalReports.filter(x=>x.value.phase===phase&&x.value.group===group),runs=phase==='file'&&['core','catalog'].includes(group);
  if(matches.length!==1){errors.push(phase+'/'+group+' duplicate or missing');continue;}
  const r=matches[0].value;
  if(r.htmlSha256!==expected[phase==='file'?'offline':'online']||r.onlineHtmlSha256!==expected.online||r.standaloneHtmlSha256!==expected.offline||r.errors.length||r.contactAcceptance!==false||r.fullRegressionPassed!==false||r.publicSkinAvailable!==false||r.notRerun===runs)errors.push(phase+'/'+group+' source or scope mismatch');
  if(runs&&(r.skinPreviewPassed!==true||r.skinPreview?.passed!==true||r.skinPreview?.errors?.length))errors.push(phase+'/'+group+' preview incomplete or failed');
 }
 const report={scope:'skin-file-preview-r1',timestamp:new Date().toISOString(),matrixResult,skinPreviewPassed:errors.length===0,passed:false,publicSkinAvailable:false,visualAcceptance:false,fullRegressionPassed:false,contactAcceptance:false,productionReady:false,physicalIPhoneTested:false,errors,reusedEvidence:supplementalReports[0].value.reusedEvidence,groups:supplementalReports.map(x=>({phase:x.value.phase,group:x.value.group,notRerun:x.value.notRerun,skinPreviewPassed:x.value.skinPreviewPassed,checks:x.value.skinPreview?.checks?.length,result:x.file}))};
 fs.writeFileSync(path.join(root,'aggregate-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;return;
}
if(supplementalReports.length===8&&supplementalReports.every(x=>x.value.scope==='r9-editor-focused')){
 const errors=[],matrixResult=process.env.HAIR_QA_MATRIX_RESULT;
 if(matrixResult!=='success')errors.push('R9 focused matrix incomplete: '+matrixResult);
 for(const phase of ['file','public'])for(const group of ['core','catalog','orbit','touch']){
  const matches=supplementalReports.filter(x=>x.value.phase===phase&&x.value.group===group);
  if(matches.length!==1){errors.push(phase+'/'+group+' duplicate or missing');continue;}
  const r=matches[0].value;
  if(r.htmlSha256!==expected[phase==='file'?'offline':'online']||r.onlineHtmlSha256!==expected.online||r.standaloneHtmlSha256!==expected.offline||r.errors.length||r.contactAcceptance!==false||r.fullRegressionPassed!==false||r.editorPassed!==true||r.gnmGroomR9?.passed!==true||r.gnmGroomR9?.errors?.length||r.gnmGroomR9?.checks?.some(t=>!t.pass))errors.push(phase+'/'+group+' incomplete, failed or mismatched source');
 }
 const report={scope:'r9-editor-focused',timestamp:new Date().toISOString(),matrixResult,editorPassed:errors.length===0,passed:false,fullRegressionPassed:false,contactAcceptance:false,productionReady:false,physicalIPhoneTested:false,knownRootGate:[3,2,3,3],errors,reusedEvidence:supplementalReports[0].value.reusedEvidence,groups:supplementalReports.map(x=>({phase:x.value.phase,group:x.value.group,editorPassed:x.value.editorPassed,checks:x.value.gnmGroomR9?.checks?.length,result:x.file}))};
 fs.writeFileSync(path.join(root,'aggregate-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;return;
}
if(supplementalReports.length===8&&supplementalReports.every(x=>x.value.scope==='r8-supplemental-same-runtime')){
 const catalog=supplementalReports.filter(x=>x.value.group==='catalog'),errors=[],matrixResult=process.env.HAIR_QA_MATRIX_RESULT;
 if(matrixResult!=='success')errors.push('Supplemental matrix did not complete successfully: '+matrixResult);
 for(const phase of ['file','public'])for(const group of ['core','catalog','orbit','touch']){const a=supplementalReports.filter(x=>x.value.phase===phase&&x.value.group===group);if(a.length!==1){errors.push(phase+'/'+group+' duplicate or missing report');continue;}const r=a[0].value;if(r.htmlSha256!==expected[phase==='file'?'offline':'online']||r.onlineHtmlSha256!==expected.online||r.standaloneHtmlSha256!==expected.offline||r.errors.length||r.contactAcceptance!==false||r.fullRegressionPassed!==false||r.notRerun!==(group!=='catalog'))errors.push(phase+'/'+group+' byte or scope mismatch');}
 for(const phase of ['file','public']){const a=catalog.filter(x=>x.value.phase===phase);if(a.length!==1||a[0].value.supplementalPassed!==true||a[0].value.gnmOpacitySupplement?.passed!==true||a[0].value.errors.length)errors.push(phase+' supplemental incomplete or failed');}
 const report={scope:'r8-supplemental-same-runtime',matrixResult,timestamp:new Date().toISOString(),passed:false,fullRegressionPassed:false,supplementalPassed:errors.length===0,contactAcceptance:false,productionReady:false,physicalIPhoneTested:false,visualAcceptance:false,errors,knownRootGate:[3,2,3,3],reusedEvidence:supplementalReports[0].value.reusedEvidence,groups:supplementalReports.map(x=>({phase:x.value.phase,group:x.value.group,notRerun:x.value.notRerun,supplementalPassed:x.value.supplementalPassed,result:x.file}))};
 fs.writeFileSync(path.join(root,'aggregate-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;return;
}
const matrixResult=process.env.HAIR_QA_MATRIX_RESULT;
const summary={matrixResult,timestamp:new Date().toISOString(),expected,passed:false,groups:[],errors:[],physicalIPhoneTested:false,visualAcceptance:false};
if(matrixResult!=='success')summary.errors.push('Matrix jobs did not all complete successfully: '+matrixResult);
for(const phase of ['file','public'])for(const group of ['core','catalog','orbit','touch']){
 const matches=files.filter(f=>path.basename(f)===`cluster-${phase}-${group}-results.json`);
 if(matches.length!==1){summary.errors.push(`${phase}/${group}: expected one result, got ${matches.length}`);continue;}
 const r=JSON.parse(fs.readFileSync(matches[0]));
 const ok=r.passed===true&&r.phase===phase&&r.group===group&&JSON.stringify(r.completedSections)==JSON.stringify([group])&&r.htmlSha256===expected[phase==='file'?'offline':'online']&&r.onlineHtmlSha256===expected.online&&r.standaloneHtmlSha256===expected.offline&&r.errors.length===0&&r.tests.length>0&&r.tests.every(t=>t.pass===true);
 summary.groups.push({phase,group,passed:ok,tests:r.tests.length,htmlSha256:r.htmlSha256,result:matches[0]});if(!ok)summary.errors.push(`${phase}/${group}: incomplete, failing or mismatched-byte evidence`);
 const helperKeys={core:['featherStudy','colorResponse','gnmTeacherExperiment'],catalog:['gnmHairOpacity','catalog','c4dFiber','fiberCatalog','houdiniGroom','startupProfile'],orbit:['lightingGeometry','gnmHome','gnmStudy','orbitAppearance','groomCatalog'],touch:['gnmShadowSeed','firstEntry','featherCatalog','mobileTouch','rabbitTouch']}[group];
 for(const key of helperKeys){const h=r[key];if(!h||h.passed===false||h.errors?.length||h.tests?.some(t=>!t.pass))summary.errors.push(`${phase}/${group}: invalid ${key}`);}
 if(phase==='file'&&group==='catalog'&&r.baselineStartupProfile?.passed!==true)summary.errors.push('missing exact historical startup check');
}
summary.passed=summary.groups.length===8&&summary.errors.length===0;
fs.writeFileSync(path.join(root,'aggregate-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(!summary.passed)process.exitCode=1;



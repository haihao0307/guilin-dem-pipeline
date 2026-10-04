'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.argv[2],online=process.argv[3],offline=process.argv[4];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected={online:hash(online),offline:hash(offline)};
const files=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory())walk(q);else if(/^cluster-(file|public)-(core|catalog|orbit|touch)-results\.json$/.test(e.name))files.push(q);}}walk(root);
const matrixResult=process.env.HAIR_QA_MATRIX_RESULT;
const summary={matrixResult,timestamp:new Date().toISOString(),expected,passed:false,groups:[],errors:[],physicalIPhoneTested:false,visualAcceptance:false};
if(matrixResult!=='success')summary.errors.push('Matrix jobs did not all complete successfully: '+matrixResult);
for(const phase of ['file','public'])for(const group of ['core','catalog','orbit','touch']){
 const matches=files.filter(f=>path.basename(f)===`cluster-${phase}-${group}-results.json`);
 if(matches.length!==1){summary.errors.push(`${phase}/${group}: expected one result, got ${matches.length}`);continue;}
 const r=JSON.parse(fs.readFileSync(matches[0]));
 const ok=r.passed===true&&r.phase===phase&&r.group===group&&JSON.stringify(r.completedSections)==JSON.stringify([group])&&r.htmlSha256===expected[phase==='file'?'offline':'online']&&r.onlineHtmlSha256===expected.online&&r.standaloneHtmlSha256===expected.offline&&r.errors.length===0&&r.tests.length>0&&r.tests.every(t=>t.pass===true);
 summary.groups.push({phase,group,passed:ok,tests:r.tests.length,htmlSha256:r.htmlSha256,result:matches[0]});if(!ok)summary.errors.push(`${phase}/${group}: incomplete, failing or mismatched-byte evidence`);
 const helperKeys={core:['featherStudy','firstEntry','colorResponse','startupProfile','lightingGeometry'],catalog:['catalog','c4dFiber','fiberCatalog','houdiniGroom'],orbit:['orbitAppearance','groomCatalog'],touch:['featherCatalog','mobileTouch','rabbitTouch']}[group];
 for(const key of helperKeys){const h=r[key];if(!h||h.passed===false||h.errors?.length||h.tests?.some(t=>!t.pass))summary.errors.push(`${phase}/${group}: invalid ${key}`);}
 if(phase==='file'&&group==='core'&&r.baselineStartupProfile?.passed!==true)summary.errors.push('missing exact historical startup check');
}
summary.passed=summary.groups.length===8&&summary.errors.length===0;
fs.writeFileSync(path.join(root,'aggregate-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(!summary.passed)process.exitCode=1;

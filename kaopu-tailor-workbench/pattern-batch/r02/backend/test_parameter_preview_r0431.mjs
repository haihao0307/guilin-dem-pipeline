import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {validateRequest,requestFromBinding} from './parameter-request-r0431.mjs';
import {previewIdentity,previewKey,hasSessionVariant,sessionStatus,captureNativePreview} from './variant-preview-r0431.mjs';
import {materialHash,sha,stable} from './source-contract.mjs';
const checks=[];function check(name,ok,detail){checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw Error(name);}
function throws(name,fn){let failed=false;try{fn()}catch{failed=true}check(name,failed);}
const schema=JSON.parse(await fs.readFile(new URL('./parameter-schema.json',import.meta.url))),audit=JSON.parse(await fs.readFile(new URL('./PARAMETER_AUDIT_R043.json',import.meta.url)));
for(const row of audit.rows){const value=row.example.to;check('schema accepts audited native value '+row.path,validateRequest(schema,{parameters:{[row.path]:value}}).parameters[row.path]===value);}
for(const [name,q]of Object.entries({unknown:{parameters:{bogus:1}},fractionalInteger:{parameters:{'collar.bc_angle':95.5}},notBoolean:{parameters:{'sleeve.sleeveless':'false'}},wrongChoice:{parameters:{'meta.bottom':'Cylinder'}},numericString:{parameters:{'shirt.width':'1.2'}},notFinite:{parameters:{'shirt.width':NaN}},outsideRange:{parameters:{'shirt.width':100}},array:[],parametersNull:{parameters:null},parametersArray:{parameters:[]},badEase:{easeCm:NaN},blankEase:{easeCm:''},negativeEase:{easeCm:-1},waistOver:{waistEaseCm:7}}))throws('reject invalid '+name,()=>validateRequest(schema,q));
const request={parameters:{'shirt.width':1.2},easeCm:3,waistEaseCm:0},binding={...request,parameterRequestSHA256:await sha(stable(request))};
check('restore request uses same hashed source parameters',stable(await requestFromBinding(binding,schema))===stable(request));
let rejected=false;try{await requestFromBinding({...binding,easeCm:6},schema)}catch{rejected=true}check('reject tampered variant parameters',rejected);
check('base record has no variant request',await requestFromBinding({},schema)===null);
const sessions=new Map();const key=previewKey('T01-P01',sessions);check('baseline combination is not a changed variant',!hasSessionVariant('T01-P01',sessions));
sessions.set('T01',{binding:{...binding,presetId:'T01',materialSHA256:'a'.repeat(64)},record:{staticGate:{passed:false,failures:['cloth-intersections']}}});
check('new top invalidates baked combination thumbnail',hasSessionVariant('T01-P01',sessions)&&previewKey('T01-P01',sessions)!==key);
check('new top leaves unrelated combinations unchanged',!hasSessionVariant('T02-P01',sessions));
check('current session quality overrides old default static pass',sessionStatus('T01',sessions,{kind:'static-pass',label:'old'}).kind==='needs-repair');
const key2=previewKey('T01-P01',sessions);sessions.get('T01').binding.parameterRequestSHA256='b'.repeat(64);check('next source variant invalidates prior captured preview',key2!==previewKey('T01-P01',sessions));
const previewStore=new Map();let restored=0;
const fakeViewer={cameraState:()=>({position:[0,1,2]}),view:()=>{},render:()=>{},restoreCamera:()=>{restored++}};
const shot=captureNativePreview({viewer:fakeViewer,canvas:{toDataURL:()=> 'data:image/png;base64,'+'A'.repeat(32)},key:'valid',previews:previewStore});
check('preview success retains actual returned pixels and restores camera',shot.captured&&shot.cameraRestored&&restored===1&&previewStore.has('valid'));
previewStore.set('failed','old');
const noShot=captureNativePreview({viewer:fakeViewer,canvas:{toDataURL:()=>{throw Error('SecurityError')}},key:'failed',previews:previewStore});
check('preview capture failure does not throw away solver result',!noShot.captured&&noShot.cameraRestored&&noShot.reason==='SecurityError');
check('failed capture cannot preserve a stale image for new request',!previewStore.has('failed'));
const blankShot=captureNativePreview({viewer:fakeViewer,canvas:{toDataURL:()=> 'data:,'},key:'blank',previews:previewStore});
check('context-lost blank capture is not accepted as a new thumbnail',!blankShot.captured);
const report={baseCommit:'58338295d84f03fafae66c14e23d3af13646242d',scope:'local parameter validation and preview identity tests using original audited parameter values; no native drafting/browser/deployment claim',passed:checks.every(c=>c.passed),count:checks.length,checks};
await fs.writeFile(new URL('./PARAMETER_PREVIEW_TESTS_R0431.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,count:checks.length}));

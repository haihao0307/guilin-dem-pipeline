import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {paperSVG} from './vendor/paper-preview.mjs';
import {parameterLabel,parameterState,valueAt} from './vendor/catalogue-controls.mjs';
import {makeRequest,validateBodyProfile} from './bridge.mjs';
const P=path.dirname(fileURLToPath(import.meta.url));
const read=n=>JSON.parse(fs.readFileSync(path.join(P,n),'utf8'));
const save=(n,x)=>{const p=path.join(P,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x));};
const library=read('library.json'),schema=read('parameter-schema.json');
const contexts=[];fs.mkdirSync(path.join(P,'thumbs'),{recursive:true});
for(const row of library.presets){
 if(!row.paperValid)continue;
 const pattern=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(P,row.paperAsset))));
 fs.writeFileSync(path.join(P,row.thumbnail),paperSVG(pattern,{thumbnail:true}));
 contexts.push({id:row.id,design:pattern.design});
 const packet=makeRequest(row,pattern.design,library.referenceBody,schema);
 if(packet.generatorRequest.design!==pattern.design&&JSON.stringify(packet.generatorRequest.design)===JSON.stringify(pattern.design)){}else throw Error('Design clone failed');
 row.authoredControls=Object.entries(row.overrides).map(([p,v])=>({path:p,label:parameterLabel(p),value:v,...parameterState(p,pattern.design)}));
 row.activeParameterCount=schema.parameters.filter(p=>parameterState(p.path,pattern.design).enabled).length;
}
function addContext(id,source,changes){
 const d=structuredClone(contexts.find(c=>c.id===source).design);
 for(const[k,v]of Object.entries(changes)){const parts=k.split('.'),last=parts.pop();parts.reduce((o,p)=>o[p],d)[last].v=v;}
 contexts.push({id,design:d,technicalProbeOnly:true});
}
addContext('probe-asym-bezier','T15',{'collar.f_collar':'Bezier2NeckHalf','collar.b_collar':'Bezier2NeckHalf','collar.bc_depth':0.25,'left.collar.f_collar':'Bezier2NeckHalf','left.collar.b_collar':'Bezier2NeckHalf','sleeve.sleeveless':false,'left.sleeve.sleeveless':false,'sleeve.length':0.8,'left.sleeve.length':0.8,'sleeve.cuff.type':'CuffBandSkirt','left.sleeve.cuff.type':'CuffBandSkirt','sleeve.standing_shoulder':true,'left.sleeve.standing_shoulder':true});
addContext('probe-asym-angle','T15',{'collar.f_collar':'TrapezoidNeckHalf','collar.b_collar':'TrapezoidNeckHalf','collar.bc_depth':0.25,'left.collar.f_collar':'TrapezoidNeckHalf','left.collar.b_collar':'TrapezoidNeckHalf','sleeve.sleeveless':true,'left.sleeve.sleeveless':true,'sleeve.armhole_shape':'ArmholeAngle','left.sleeve.armhole_shape':'ArmholeAngle'});
addContext('probe-curved-neck','T01',{'collar.f_collar':'CurvyNeckHalf','collar.b_collar':'CurvyNeckHalf','collar.bc_depth':0.3});
addContext('probe-asym-curved-neck','T15',{'left.collar.f_collar':'CurvyNeckHalf','left.collar.b_collar':'CurvyNeckHalf','collar.bc_depth':0.3});
addContext('probe-pants-compound-cuff','P10',{'pants.cuff.type':'CuffBandSkirt','pants.cuff.cuff_len':0.15,'pants.cuff.top_ruffle':1.15});
addContext('probe-raised-shoulder','T13',{'sleeve.standing_shoulder':true});
const activeByPath={};
for(const p of schema.parameters)activeByPath[p.path]=contexts.filter(c=>parameterState(p.path,c.design).enabled).map(c=>c.id);
fs.mkdirSync(path.join(P,'qa'),{recursive:true});
fs.writeFileSync(path.join(P,'qa/probe-contexts.json.gz'),zlib.gzipSync(JSON.stringify({contexts,activeByPath}),{level:9}));
save('parameter-atlas.json',{schema:'kaopu-tailor-parameter-atlas@1',fieldCount:schema.parameters.length,
 notes:schema.activationNotes,allParametersMastered:false,
 parameters:schema.parameters.map(p=>({...p,label:parameterLabel(p.path),candidateContexts:activeByPath[p.path],status:'not-yet-probed',evidence:null}))});
save('library.json',library);
const missing=structuredClone(library.referenceBody);delete missing.bodyCm.hips;
let rejected=false;try{validateBodyProfile(missing,schema)}catch{rejected=true;}if(!rejected)throw Error('Missing body measurements must not acquire hidden defaults');
console.log('P01_METADATA',JSON.stringify({presets:library.presets.length,fields:schema.parameters.length,technicalContexts:contexts.length-library.presets.length,missingMeasurementRejected:rejected}));

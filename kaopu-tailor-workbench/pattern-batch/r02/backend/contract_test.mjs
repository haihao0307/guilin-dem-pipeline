import {writeFileSync} from 'node:fs';
import {samePerson,requirePerson,checkPacket,facesOf,assertFiniteCoordinates,materialHash} from './source-contract.mjs';
const id={geometrySHA256:'a'.repeat(64),topologySHA256:'b'.repeat(64),stateSHA256:'c'.repeat(64),adapterFingerprint:'d'.repeat(64)},tests=[];
const reject=(name,fn)=>{let rejected=false;try{fn()}catch{rejected=true}tests.push({name,passed:rejected});if(!rejected)throw Error('Incorrectly accepted '+name)};
for(const k of Object.keys(id)){const bad={...id,[k]:'0'.repeat(64)};if(samePerson(id,bad))throw Error(k);reject('person mismatch '+k,()=>requirePerson(id,bad))}
const binding={person:id,presetId:'T01',recipeHash:'r',paperSHA256:'p',materialSHA256:'m'};
for(const k of ['presetId','recipeHash','paperSHA256','materialSHA256'])reject('source mismatch '+k,()=>checkPacket({binding:{...binding,[k]:'bad'}},binding));
const spec={panels:[{id:'a',uvMm:[[0,0],[1,0],[0,1]],triangles:[[0,1,2]]},{id:'b',uvMm:[[0,0],[1,0],[0,1]],triangles:[[0,1,2]]}],seams:[]};
if(JSON.stringify(facesOf(spec))!=='[0,1,2,3,4,5]')throw Error('face order changed');tests.push({name:'native panel vertex and triangle ordering',passed:true});
reject('wrong vertex count',()=>assertFiniteCoordinates(spec,[0,1]));reject('nonfinite coordinates',()=>assertFiniteCoordinates(spec,new Array(18).fill(NaN)));
const old=await materialHash(spec);spec.panels[0].uvMm[0][0]=.1;if(old===await materialHash(spec))throw Error('UV change missed');tests.push({name:'rest UV mutation invalidates binding',passed:true});
writeFileSync(new URL('CONTRACT_TESTS.json',import.meta.url),JSON.stringify({passed:true,checks:tests},null,2));console.log('NATIVE_SOURCE_CONTRACT',tests.length,'PASS');

import assert from 'node:assert/strict';import{SCHEMA,PRESETS,initialRecord,validateRecord,validateProfile,validateState,seedVector,opticalBase,fingerprint}from'./SkinProfile.mjs';
const tests=[];function test(n,f){f();tests.push(n);console.log('PASS',n);}
test('six distinct named looks',()=>{assert.equal(PRESETS.length,6);assert.equal(new Set(PRESETS.map(p=>p.id)).size,6);});
for(const p of PRESETS)test('bounded complete profile '+p.id,()=>assert.deepEqual(validateRecord(initialRecord(p.id)).profile,validateProfile(p.profile)));
test('deterministic seed vector',()=>assert.deepEqual(seedVector(41731),seedVector(41731)));
test('different skin identities',()=>assert.equal(new Set(PRESETS.map(p=>fingerprint(initialRecord(p.id)))).size,6));
test('seed actually differentiates noise phase',()=>assert.notDeepEqual(seedVector(41731),seedVector(41732)));
for(const [k,v]of[['melanin',NaN],['oil',Infinity],['seed',1.5],['seed',0],['detail',2],['unknown',1]])test('reject invalid '+k+v,()=>assert.throws(()=>validateProfile({[k]:v})));
test('state independent of genetic recipe',()=>{const p=initialRecord();const before=JSON.stringify(p.profile);p.state=validateState({sweat:1});assert.equal(JSON.stringify(p.profile),before);});
test('higher pigment absorbs more in every RGB channel',()=>{const a=opticalBase(.1,.2),b=opticalBase(.8,.2);assert(a.every((v,i)=>v>b[i]&&v<1&&b[i]>0));});
test('more blood changes colour without adding emitted energy',()=>{const a=opticalBase(.2,.1),b=opticalBase(.2,.8);assert(b.every((v,i)=>v<=a[i]));});
test('reject wrong schema',()=>assert.throws(()=>validateRecord({...initialRecord(),schema:'skin/9'})));
test('reject quality enum',()=>assert.throws(()=>validateRecord({...initialRecord(),quality:'magic'})));
test('roundtrip JSON',()=>{const a=initialRecord('deep');assert.deepEqual(validateRecord(JSON.parse(JSON.stringify(a))),a);});
console.log(JSON.stringify({schema:SCHEMA,passed:tests.length,tests},null,2));

import assert from 'node:assert/strict';
import {quintic,ATTACHMENT_LOOPS,buildNativeDomain} from './EarDomain.mjs';
import {sampleEar,earDelta} from './EarMath.mjs';
import {EAR_DEFAULT,EAR_CONTROLS,MATERIAL_KEYS,EAR_SCHEMA} from './EarParameters.mjs';
import {validateEar} from './EarState.mjs';
assert.equal(EAR_SCHEMA,'kaopu/ear-structure@3');assert.equal(EAR_CONTROLS.length,36);assert.equal(MATERIAL_KEYS.size,7);
assert.equal(quintic(-1),0);assert.equal(quintic(2),1);assert.equal(quintic(0),0);assert.equal(quintic(1),1);let prior=0;for(let i=0;i<=100;i++){const x=quintic(i/100);assert(x>=prior&&x<=1);prior=x;}
for(const a of Object.values(ATTACHMENT_LOOPS)){assert.equal(a.length,42);assert.equal(new Set(a).size,42);assert(a.every(Number.isInteger));}
assert.throws(()=>buildNativeDomain({template:[],triangles:[],meta:{gnmVersion:'other'}}));
for(const p of [[.072,.280,.000],[.070,.302,.020],[.07,.246,.045]])assert.equal(sampleEar(p,0,1,0),null,'protected skull must not be selected by position');
assert.equal(sampleEar([.085,.28,.02],1,1,1),null,'non-skin is excluded');
for(const angle of[-9,0,12]){const s={...EAR_DEFAULT,rootAngle:angle},a=earDelta(sampleEar([.087,.28,.015],0,1,1),s),b=earDelta(sampleEar([-.087,.28,.015],0,-1,1),s);assert(a.every(Number.isFinite));assert.equal(a[0],-b[0]);assert.equal(a[1],b[1]);assert.equal(a[2],b[2]);}
for(const schema of ['kaopu/ear-structure@1','kaopu/ear-structure@2',EAR_SCHEMA])assert.equal(validateEar({schema}).schema,EAR_SCHEMA);
assert.throws(()=>validateEar({left:{rootAngle:100}}));console.log('PASS EAR-R04 unit: topology contract, zero support, mirror symmetry, 36 controls and @1/@2 migration');

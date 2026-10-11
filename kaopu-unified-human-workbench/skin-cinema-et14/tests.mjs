import assert from 'node:assert/strict';
import {DEFAULTS,FIELDS,PRESETS,validate,foldedProfile} from './Schema.mjs';
assert.equal(FIELDS.length,17);assert.deepEqual(validate(DEFAULTS),DEFAULTS);
for(const p of Object.values(PRESETS))validate({...DEFAULTS,...p.values});
for(const [k,,lo,hi]of FIELDS){assert.throws(()=>validate({...DEFAULTS,[k]:NaN}));assert.throws(()=>validate({...DEFAULTS,[k]:hi+1}));assert.throws(()=>validate({...DEFAULTS,[k]:lo-1}));}
assert.throws(()=>validate({...DEFAULTS,unknown:1}));assert.throws(()=>validate({...DEFAULTS,enabled:1}));
let integral=0;const dx=.0002,sigma=.3,amplitude=.12;for(let x=-3;x<=3;x+=dx)integral+=foldedProfile(x,sigma,amplitude)*dx;
assert(Math.abs(integral)<1e-7);assert(foldedProfile(0,sigma,amplitude)<0);assert(foldedProfile(sigma*1.8,sigma,amplitude)>0);
for(const s of [.66,1,1.58]){const center=foldedProfile(0,sigma*s,amplitude/s);assert(Number.isFinite(center));}
assert(Math.abs(foldedProfile(0,sigma*.66,amplitude/.66))>Math.abs(foldedProfile(0,sigma*1.58,amplitude/1.58)));
console.log(JSON.stringify({schemaChecks:true,fields:17,presets:Object.keys(PRESETS).length,transverseIntegral:integral,geometryDisplacement:false,stressSimulation:false,visualAcceptance:false}));

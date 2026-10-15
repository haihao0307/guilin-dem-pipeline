import assert from 'node:assert/strict';
import {StrandDynamics} from '../src/physics.mjs';
const rows=[];
for(const kind of ['hair']){
 const d=new StrandDynamics();d.configure(1);d.impulse();
 for(let n=0;n<120;n++)d.advance(1/120);
 const active=d.snapshot();assert.equal(active.rootError,0);assert.ok(active.maxRelativeStretch<1e-10);assert.ok(active.maxOffset>.0001);assert.ok(active.maxOffset<.2);
 const energy=active.kineticEnergy;
 for(let n=0;n<960;n++)d.advance(1/120);
 const settled=d.snapshot();assert.ok(settled.kineticEnergy<energy*.1);assert.ok(settled.maxOffset<active.maxOffset*.2);
 const weights=new Float32Array(85);weights[42]=1;d.setGrab(weights,.7,[.04,0,.01]);
 for(let n=0;n<120;n++)d.advance(1/120);
 const grab=d.snapshot();assert.equal(grab.rootError,0);assert.ok(grab.maxRelativeStretch<1e-10);assert.ok(Math.hypot(...d.sample(42,.7))>Math.hypot(...d.sample(0,.7))*2);
 d.release();d.paused=true;const frozen=d.q.slice();d.advance(.05);assert.deepEqual(d.q,frozen);
 rows.push({kind,active,settled,grab});
}
const a=new StrandDynamics(),b=new StrandDynamics();a.impulse();b.impulse();for(let n=0;n<120;n++)a.advance(1/120);for(let n=0;n<60;n++)b.advance(1/60);assert.deepEqual(a.q,b.q);
console.log(JSON.stringify({passed:true,checks:['pinned follicle and tangent','guide edge length','finite impulse response','release energy decay','localized grab','pause freeze','fixed-step input equivalence'],rows},null,2));

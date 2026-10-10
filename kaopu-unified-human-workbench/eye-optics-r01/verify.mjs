import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {reproduceET08,createIrisAtlas} from './IrisField.mjs';
import {settings,PRESETS,PARAMETER_SCHEMA} from './EyeParameters.mjs';
import {refract,fresnelNormal,traceTwoInterface} from './OpticalReference.mjs';
import {patchEyeShader} from './NativeEyeOptics.mjs';
const sha=a=>crypto.createHash('sha256').update(a).digest('hex'),results=[];
const check=(name,f)=>{f();results.push({name,pass:true});};
check('ET08 original irisField byte-exact reproduction',()=>assert.equal(sha(reproduceET08().data),'2e95deecd470365bb2f43d9cc45b8ceccafc76c1ff7bb61e3752ed99e405a761'));
const atlases=Object.fromEntries(Object.keys(PRESETS).map(k=>[k,createIrisAtlas(k)]));
for(const[k,a]of Object.entries(atlases)){
 check(k+' deterministic',()=>assert.equal(sha(a.data),sha(createIrisAtlas(k).data)));
 check(k+' has positive collarette/fiber relief and negative crypt relief',()=>assert(a.report.minHeight<-.3&&a.report.maxHeight>.3));
 check(k+' finite height bound',()=>assert(a.report.minHeight>=-1&&a.report.maxHeight<=1));
}
check('presets differ in morphology, not only color',()=>assert(new Set(Object.values(atlases).map(a=>a.report.cryptCoverage)).size===3));
check('structural blue and hazel differ with color ignored',()=>{let changed=0;const a=atlases['radial-blue'].data,b=atlases['open-hazel'].data;for(let i=1;i<a.length;i+=4)if(a[i]!==b[i])changed++;assert(changed>a.length/8);});
check('all scalar controls carry unit and uncertainty',()=>assert(Object.values(PARAMETER_SCHEMA).every(p=>p.unit&&p.confidence&&p.evidence)));
check('non-finite and out-of-range params rejected',()=>{for(const p of[{pupilDiameterMM:NaN},{irisReliefMM:9},{preset:'unknown'},{wrong:1}])assert.throws(()=>settings(p));});
check('normal incidence ray does not bend',()=>assert.deepEqual(refract([0,0,-1],[0,0,1],1,1.376),[0,0,-1]));
check('Snell law numeric',()=>{const i=.6,r=refract([Math.sin(i),0,-Math.cos(i)],[0,0,1],1,1.376);assert(Math.abs(r[0]*1.376-Math.sin(i))<1e-12);});
check('total internal reflection returns explicit null',()=>assert.equal(refract([.95,0,-Math.sqrt(1-.95**2)],[0,0,1],1.376,1),null));
check('air tear F0 and cornea aqueous F0 distinct',()=>assert(fresnelNormal(1,1.336)>.02&&fresnelNormal(1.376,1.336)<.001));
const rays=[0,15,30,45,60].map(deg=>({deg,...traceTwoInterface({surfaceXY:[1,0],viewDirection:[Math.sin(deg*Math.PI/180),0,Math.cos(deg*Math.PI/180)]})}));
check('two-interface optics finite over central view sweep',()=>assert(rays.every(r=>r.valid&&r.hitMM.every(Number.isFinite))));
check('two-interface optics changes view-dependent iris hit',()=>assert(new Set(rays.map(r=>r.hitMM[0].toFixed(6))).size===5));
check('shader fails closed without native eye anchor',()=>assert.throws(()=>patchEyeShader({uniforms:{},fragmentShader:''},{})));
check('shader retains old function for exact A/B path',()=>{const s={uniforms:{},fragmentShader:'vec3 fEyeColor(){return vec3(1.);}\n#include <lights_physical_fragment>\n#include <lights_fragment_begin>'};patchEyeShader(s,{});assert(s.fragmentShader.includes('vec3 e1PreviousEyeColor(){return vec3(1.);}'));assert(s.fragmentShader.includes('clearcoatNormal=e1OuterNormal'));assert(!s.fragmentShader.includes('refract('));});
console.log(JSON.stringify({pass:true,checks:results,atlases:Object.fromEntries(Object.entries(atlases).map(([k,a])=>[k,{sha256:sha(a.data),...a.report}])),rays,limitation:'CPU maths and schema only; browser render is a separate test'},null,2));

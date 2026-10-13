// Corrections justified by first real fixed-public screenshots (run
// 38381211788). These update readable source files, never a minified bundle.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
function edit(name,fn){const p=path.join(__dirname,name);let s=fs.readFileSync(p,'utf8');if(s.includes('SKIN_DNA_REVIEW_REFINED_V2'))return;const once=(a,b)=>{assert.equal(s.split(a).length,2,name+' anchor '+a);s=s.replace(a,()=>b);};fn(once);fs.writeFileSync(p,'// SKIN_DNA_REVIEW_REFINED_V2\n'+s);}
edit('SkinMaterial.mjs',once=>{
 once("float r=mix(.09,.30,sdHash(k+39.));float d=length(f-o-c),aa=max(.035,footprint);float island=1.-smoothstep(r-aa,r+aa,d);v+=island*step(h,amount*.57)*mix(.35,1.,sdHash(k+29.));","vec2 delta=f-o-c;delta.x*=mix(.78,1.28,sdHash(k+53.));float angle=atan(delta.y,delta.x);float r=mix(.075,.28,sdHash(k+39.))*(1.+.17*sin(angle*3.+h*13.)+.10*sin(angle*5.+h*29.));float d=length(delta),aa=max(r*.25,footprint);float island=1.-smoothstep(max(0.,r-aa),r+aa,d);v+=island*step(h,amount*.42)*mix(.28,1.,sdHash(k+29.));");
 once('(sdCoarse-.5)*.17+(sdMedium-.5)*.09+(sdFine-.5)*.023','(sdCoarse-.5)*.046+(sdMedium-.5)*.044+(sdFine-.5)*.022');
 once('sdFreckle*=mix(.12,','sdFreckle*=mix(.045,');
 once('sdFreckle*.19+sdAgeSpot','sdFreckle*.145+sdAgeSpot');
 once('uSDOn*.22','uSDOn*.06');
 once('sdRough=clamp(.64+sdDryness*.105','sdRough=clamp(.56+sdDryness*.105');
 once('sdGrain*.000010','sdGrain*.000018');
 once("'/skin-dna-r01-v1'","'/skin-dna-r01-v2'");
});
edit('SkinDNA.mjs',once=>{once("apply();return api;","window.lifelikeIdle?.pause(true);apply();return api;");});
edit('test.mjs',once=>{
 once("const tests=[];","const {createForCharacter}=await import('./CharacterSkin.mjs');\nconst tests=[];");
 once('console.log(JSON.stringify({schema:',"test('36 stable independent character recipes',()=>{const rows=Array.from({length:36},(_,i)=>createForCharacter('skin-fixture-'+i,PRESETS[i%6].id));assert.equal(new Set(rows.map(fingerprint)).size,36);for(let i=0;i<36;i++)assert.deepEqual(rows[i],createForCharacter('skin-fixture-'+i,PRESETS[i%6].id));});\ntest('reject missing character ID',()=>assert.throws(()=>createForCharacter('')));\nconsole.log(JSON.stringify({schema:");
});
edit('verify.cjs',once=>{
 once("const seedA=await pixels();","await page.locator('#skin-dna-controls details summary').click();const seedA=await pixels();");
 once("assert(d.settings.diffusion>0);","assert(d.settings.diffusion>0);assert(d.report.frames>0);assert.equal(d.report.specularBlurred,false);");
 once("await page.locator('#sd-quality').selectOption('fast');","await page.locator('#sd-quality').selectOption('fast');\nconst recipes=await page.evaluate(()=>{const previous=skinDNA.archive();const a=skinDNA.forCharacter('person-review-01','silk'),b=skinDNA.forCharacter('person-review-02','silk'),c=skinDNA.forCharacter('person-review-01','silk');skinDNA.restore(previous);return{distinct:JSON.stringify(a)!==JSON.stringify(b),stable:JSON.stringify(a)===JSON.stringify(c)};});assert(recipes.distinct&&recipes.stable);pass('reusable-stable-character-ID-generator',recipes);\nconst ebBefore=await pixels();await page.locator('#sd-light').selectOption('original');const orig=await snap('10b-original-light-restored');const lightReport=await page.evaluate(()=>skinDNA.report().lighting);assert(lightReport.enabledLegacyLights>0);assert.notEqual(orig,ebBefore.hash);await page.locator('#sd-light').selectOption('neutral');assert.equal((await pixels()).hash,ebBefore.hash);pass('original-light-and-EB1-roundtrip',lightReport);");
});
edit('build.cjs',once=>{
 once("put(__dirname+'/BUILD.json',JSON.stringify(b,null,2)","b.sources=b.sources.filter(s=>!s.path.endsWith('/.build-runtime.cjs'));b.reviewRefinement='V2: weaker macro pigment, irregular soft freckles, bounded inherited normal, optical roughness calibration';put(__dirname+'/BUILD.json',JSON.stringify(b,null,2)");
});
console.log('Applied V2 review refinement / tests / original preservation.');

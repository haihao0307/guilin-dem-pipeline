/* Source-level, deterministic, image-free DNA semantic regression. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const src=fs.readFileSync('iteration/skin-variation-dna-r01/dna-kernel.js','utf8');
const sandbox={window:{},performance:{now:()=>1}};
vm.runInNewContext(src,sandbox,{timeout:10000});
const dna=sandbox.window.KAOPU_SKIN_VARIATION_DNA_R01;
assert(dna&&dna.version==='SKIN-VARIATION-DNA-R01');
const names=['VascularMap','MelaninVariationMap','SebumRoughnessMap','UnderEyeMap','AcneHistoryMap','FollicleAndBeardMap','DrynessAndFlakeMap'];
assert.strictEqual(dna.spec.length,14);
assert.deepStrictEqual(Object.keys(dna.presets).sort(),['adult','mature','young']);
function packed(seed){const size=128*128;return{width:128,height:128,layers:5,data:new Uint8Array(size*4*5),report:{seed}};}
const a=dna.pack(packed(4242)),b=dna.pack(packed(4242)),c=dna.pack(packed(8181));
assert.strictEqual(a.layers,7);assert.strictEqual(a.data.length,128*128*4*7);
assert.strictEqual(Buffer.compare(Buffer.from(a.data),Buffer.from(b.data)),0,'Seed reproducibility');
assert.notStrictEqual(Buffer.compare(Buffer.from(a.data),Buffer.from(c.data)),0,'Different identities should vary');
assert.strictEqual(a.report.variationDNA.eventCounts.follicleRoots,dna.roots(4242).length);
assert(!a.report.variationDNA.vertexDisplacementImplemented);
assert(!a.report.variationDNA.piePihGeometry);
assert(!a.report.variationDNA.sourcePixelsCopied);
for(const [name,channel] of [['PIE',0],['PIH',1],['freckles',2],['capillaries',3]]){
 let sum=0;const off=5*128*128*4;for(let k=0;k<128*128;k++)sum+=a.data[off+k*4+channel];assert(sum>0,name+' layer empty');
}
for(const [name,channel] of [['sebum',0],['dryness',1],['scar',2],['underEye',3]]){
 let sum=0;const off=6*128*128*4;for(let k=0;k<128*128;k++)sum+=a.data[off+k*4+channel];assert(sum>0,name+' layer empty');
}
for(const [k,val] of Object.entries(dna.presets)){assert.strictEqual(dna.validate(val).amount,val.amount,k);}
for(const map of names){assert(map.endsWith('Map'));}
const faulty={...dna.presets.young,PIE:99};assert.throws(()=>dna.validate({...dna.presets.young,acne:99}));
assert(dna.colour.includes('dnPIE=')&&dna.colour.includes('dnPIH='));
assert(dna.colour.includes('dnFollicle=p3B.r')&&dna.colour.includes('p3EyeZone'));
assert(!dna.colour.includes('ambientOcclusion')&&!dna.colour.includes('aoMap'));
assert(dna.surface.includes('dnPit')&&!dna.surface.includes('displacementFactor'));
const summary={passed:true,version:dna.version,semantics:names,rootCount:dna.roots(4242).length,seed:4242,fingerprint:a.report.variationDNA.fingerprint,oldLayers:5,newLayers:7,sourcePixelsCopied:false,scarVertexDisplacement:false};
console.log(JSON.stringify(summary,null,2));

'use strict';const assert=require('assert'),fs=require('fs'),path=require('path'),closure=require('./glsl-function-closure.cjs');
const source=`#version 300 es
precision highp float;
struct Thing { vec3 a; };
float child(float x){return x*2.;}
float reachable(float x){return child(x);}
vec2 reachable(vec2 x){return vec2(child(x.x));}
#define EMPTY_HEADER_GUARD
float dead(float x){return x*99.;}
void main(){float q=reachable(1.);q+=1.;}
`;
const x=closure(source);for(const n of ['main','reachable','child'])assert(x.manifest.keptDefinitions.some(d=>d.name===n));assert.equal(x.manifest.keptDefinitions.filter(d=>d.name==='reachable').length,2);assert(x.manifest.removedDefinitions.includes('dead'));assert(!x.source.includes('return x*99.'));assert(x.source.includes('struct Thing { vec3 a; };'));assert(x.source.includes('#define EMPTY_HEADER_GUARD'));for(const macro of ['#define F child','#define F(x) child(x)'])assert.throws(()=>closure(macro+'\n'+source),/Unsupported replacement macro/);assert.throws(()=>closure('float nope(){return 1.;}'),/Missing main/);
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'BOILER_PROBE_SOURCE.json')));for(const name of ['closure_search','closure_actual_fragment','box_search_control']){const again=closure(input.probes[name]);assert.equal(again.source,input.probes[name]);}
const r={status:'PASS',scope:'Static exact dependency closure, not GPU execution',syntheticOverloadsAndEmptyGuardProtected:true,replacementMacrosFailClosed:true,missingMainRejected:true,realPrunedSourceIdempotent:true,closures:Object.fromEntries(Object.entries(input.closures).map(([k,v])=>[k,{beforeBytes:v.beforeBytes,afterBytes:v.afterBytes,totalDefinitions:v.totalDefinitions,keptDefinitions:v.keptDefinitions.length}]))};fs.writeFileSync(path.join(__dirname,'GLSL_CLOSURE_RESULT.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r));

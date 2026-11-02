'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {MOTION_CREATION_ANCHOR: ORIGINAL, MOTION_DISABLED_REPLACEMENT: REPLACEMENT, patchNativeMotionOwnership: patch} = require('../NativeBootPatch.cjs');
const tests=[];
const test=(name,fn)=>{fn();tests.push({name,passed:true});};
test('exact single replacement',()=>assert.equal(patch('before;'+ORIGINAL+';after'),'before;'+REPLACEMENT+';after'));
test('missing anchor rejected',()=>assert.throws(()=>patch('changed upstream host'),/exactly once/));
test('duplicate anchor rejected',()=>assert.throws(()=>patch(ORIGINAL+ORIGINAL),/exactly once/));
test('already patched host rejected',()=>assert.throws(()=>patch(REPLACEMENT),/exactly once/));
test('non-text input rejected',()=>assert.throws(()=>patch(null),TypeError));
function execute(code,current=true) {
  const ctx={window:{},n:1,_s:()=>current,De:{},ge:{},removed:0,constructed:0,raf:0};
  ctx.c={remove(){ctx.removed++;}};
  ctx.l=class {constructor(){ctx.constructed++;ctx.raf++;}};
  vm.runInNewContext('(function(){let ct=null;'+code+';return ct;})()',ctx);
  return ctx;
}
test('negative control reproduces second controller and RAF',()=>{const c=execute(ORIGINAL);assert.equal(c.constructed,1);assert.equal(c.raf,1);assert.equal(c.removed,0);});
test('current generation never constructs legacy controller',()=>{const c=execute(patch(ORIGINAL));assert.equal(c.constructed,0);assert.equal(c.raf,0);assert.equal(c.removed,1);assert.equal(c.window.__NPC_HOST_AUTHORITY__.owner,'npc-life-observation');assert(Object.isFrozen(c.window.__NPC_HOST_AUTHORITY__));});
test('cancelled generation retains original early-return semantics',()=>{const c=execute(patch(ORIGINAL),false);assert.equal(c.constructed,0);assert.equal(c.removed,1);assert.equal(c.window.__NPC_HOST_AUTHORITY__,undefined);});
test('reinitialization still does not instantiate legacy motion',()=>{const c=execute(patch(ORIGINAL));vm.runInNewContext('(function(){let ct=null;'+REPLACEMENT+'})()',c);assert.equal(c.constructed,0);assert.equal(c.raf,0);assert.equal(c.removed,2);});
const host=path.resolve(__dirname,'../../human-integrated-r07/preview.html');
if(fs.existsSync(host)) {
  const bytes=fs.readFileSync(host),original=bytes.toString('utf8');
  test('golden canonical R07 host unchanged',()=>assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a'));
  test('golden host patch reversible byte for byte',()=>assert.equal(patch(original).replace(REPLACEMENT,ORIGINAL),original));
  test('all adapted inline programs parse',()=>{for(const m of patch(original).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);});
  const preview=path.resolve(__dirname,'../preview.html');
  if(fs.existsSync(preview))test('built artifact contains exactly one ownership guard',()=>{const html=fs.readFileSync(preview,'utf8');assert.equal(html.split(REPLACEMENT).length-1,1);assert.equal(html.includes(ORIGINAL),false);});
}
const result={schema:'kaopu/npc-host-ownership-fixture@1',passed:true,tests,scope:'composition/fixture and optional golden-host syntax; not a browser or visual pass'};
fs.writeFileSync(path.join(__dirname,'r04-host-ownership-report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

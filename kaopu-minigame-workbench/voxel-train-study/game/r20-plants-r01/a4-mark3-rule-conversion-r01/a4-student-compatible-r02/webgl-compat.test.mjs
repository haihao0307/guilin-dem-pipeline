import test from 'node:test';import assert from 'node:assert/strict';
import {createCompatibleRenderer} from './webgl-compat.mjs';
function harness(modes,{rendererError=null}={}){const attempts=[];let renderers=0;let lost=0;
 const T={WebGLRenderer:class {constructor(options){renderers++;this.options=options;if(rendererError)throw rendererError;}}};
 const createCanvas=()=>({addEventListener(){},remove(){},getContext(type,attrs){attempts.push({type,attrs});const mode=modes[attempts.length-1];if(mode instanceof Error)throw mode;if(!mode)return null;return {getContextAttributes:()=>attrs,getExtension:()=>({loseContext:()=>lost++})};}});
 return {T,createCanvas,attempts,get renderers(){return renderers;},get lost(){return lost;}};
}
test('normal context does not request a retained framebuffer',()=>{const h=harness([true]);const r=createCompatibleRenderer(h.T,h);assert.equal(r.diagnostics.selected,'standard');assert.equal(h.attempts.length,1);assert.equal(h.renderers,1);assert.equal(h.attempts[0].attrs.preserveDrawingBuffer,false);});
test('AA context refusal has one bounded non-AA retry',()=>{const h=harness([false,true]);const r=createCompatibleRenderer(h.T,h);assert.equal(r.diagnostics.selected,'reduced-context');assert.deepEqual(h.attempts.map(x=>x.attrs.antialias),[true,false]);assert.equal(h.renderers,1);});
test('all contexts unavailable reports failure before any renderer',()=>{const h=harness([false,false]);assert.throws(()=>createCompatibleRenderer(h.T,h),e=>e.code==='WEBGL_CONTEXT_UNAVAILABLE'&&e.diagnostics.attempts.length===2);assert.equal(h.renderers,0);});
test('explicit SecurityError is not retried',()=>{const e=new Error('denied');e.name='SecurityError';const h=harness([e,true]);assert.throws(()=>createCompatibleRenderer(h.T,h),e=>e.code==='WEBGL_CONTEXT_BLOCKED');assert.equal(h.attempts.length,1);});
test('renderer errors after a created context are not hidden by retry',()=>{const error=new Error('other initialization bug'),h=harness([true,true],{rendererError:error});assert.throws(()=>createCompatibleRenderer(h.T,h),e=>e===error);assert.equal(h.attempts.length,1);assert.equal(h.lost,1);});

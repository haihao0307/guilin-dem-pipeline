import test from 'node:test';import assert from 'node:assert/strict';
import {sameFrameRequest,shouldPreemptOnRelease} from '../whole-building-mobile-r01/frame-request.mjs';
const q=()=>({width:585,view:'whole',visible:null,camera:{eye:[10,20,30],target:[0,10,0],fov:.7,cut:true},number:1});
test('release cancels only a truly superseded in-flight request',()=>{const a=q(),b=q();b.number=13;assert(sameFrameRequest(a,b));assert(!shouldPreemptOnRelease(a,b));b.camera.eye[0]+=1;assert(shouldPreemptOnRelease(a,b));assert(!shouldPreemptOnRelease(null,b));assert(!shouldPreemptOnRelease(a,null));});
test('resolution view and selected layer changes are not treated as equivalent',()=>{for(const key of ['width','view','visible']){const a=q(),b=q();b[key]=key==='width'?640:key==='view'?'core':['T02'];assert(shouldPreemptOnRelease(a,b));}});

import test from 'node:test';
import assert from 'node:assert/strict';
import {PIXEL_BUDGETS,boundedResolution,validateExplicitResolution} from '../gpu-recovery-r01/pixel-budget.mjs';

test('quality budgets explicitly cap width, height and total area without mutable presets',()=>{
 assert.deepEqual(PIXEL_BUDGETS.conservative,{maxWidth:160,maxHeight:160,maxPixels:17920});
 assert.deepEqual(PIXEL_BUDGETS.medium,{maxWidth:320,maxHeight:320,maxPixels:71680});
 assert.deepEqual(PIXEL_BUDGETS.high,{maxWidth:840,maxHeight:840,maxPixels:560280});
 assert.ok(Object.isFrozen(PIXEL_BUDGETS));for(const preset of Object.values(PIXEL_BUDGETS))assert.ok(Object.isFrozen(preset));
});

for(const [quality,budget] of Object.entries(PIXEL_BUDGETS))test(`${quality} bounds desktop, portrait, and extreme aspect ratios`,()=>{
 for(const [width,height] of [[1920,1080],[1000,1000],[900,2000],[320,10000],[10000,320],[1,1e300],[1e300,1],[1e300,1e300],[Number.MAX_VALUE,2],[2,Number.MAX_VALUE],[1,1],[160,112],[333.33,999.99]]){
  const output=boundedResolution(width,height,budget);
  assert.ok(Number.isInteger(output.width)&&Number.isInteger(output.height),JSON.stringify(output));
  assert.ok(output.width>=1&&output.height>=1);assert.ok(output.width<=budget.maxWidth);assert.ok(output.height<=budget.maxHeight);assert.ok(output.width*output.height<=budget.maxPixels);
  assert.ok(output.width<=Math.max(1,Math.floor(width)));assert.ok(output.height<=Math.max(1,Math.floor(height)));
 }
});

test('normal aspect is preserved to less than one pixel rounding per axis',()=>{
 for(const [width,height] of [[1920,1080],[1000,1000],[900,2000],[333.33,999.99]]){
  const budget=PIXEL_BUDGETS.conservative,scale=Math.min(1,budget.maxWidth/width,budget.maxHeight/height,Math.sqrt(budget.maxPixels/(width*height)));
  const output=boundedResolution(width,height,budget);
  assert.ok(Math.abs(output.width-width*scale)<1.000001);assert.ok(Math.abs(output.height-height*scale)<1.000001);
 }
 assert.deepEqual(boundedResolution(160,112),{width:160,height:112});
 assert.deepEqual(boundedResolution(112,160),{width:112,height:160});
});

test('area limit is still enforced when the short axis floors to one pixel',()=>{
 const budget={maxWidth:1000,maxHeight:1000,maxPixels:7};
 assert.deepEqual(boundedResolution(1e200,1,budget),{width:7,height:1});
 assert.deepEqual(boundedResolution(1,1e200,budget),{width:1,height:7});
});

test('explicit size is honored exactly only within all high-budget boundaries',()=>{
 assert.deepEqual(validateExplicitResolution(840,667),{width:840,height:667});
 assert.deepEqual(validateExplicitResolution(667,840),{width:667,height:840});
 assert.deepEqual(validateExplicitResolution(1,840),{width:1,height:840});
 for(const dimensions of [[841,1],[1,841],[840,668],[668,840],[840,840],[160.5,112],[160,112.5],[NaN,100],[100,Infinity],[0,100],[-1,100],[Number.MAX_VALUE,1]])assert.throws(()=>validateExplicitResolution(...dimensions),RangeError);
});

test('explicit lower budget validation never silently escalates or downscales',()=>{
 assert.deepEqual(validateExplicitResolution(160,112,PIXEL_BUDGETS.conservative),{width:160,height:112});
 assert.throws(()=>validateExplicitResolution(160,160,PIXEL_BUDGETS.conservative),/17920-pixel/);
 assert.throws(()=>validateExplicitResolution(320,224,PIXEL_BUDGETS.conservative),RangeError);
 assert.deepEqual(validateExplicitResolution(320,224,PIXEL_BUDGETS.medium),{width:320,height:224});
});

test('malformed dimensions or budgets are rejected',()=>{
 for(const dimensions of [[0,100],[100,0],[-1,100],[1,Infinity],[NaN,100],['160',112],[.5,100]])assert.throws(()=>boundedResolution(...dimensions),RangeError);
 for(const budget of [null,{}, {maxWidth:0,maxHeight:100,maxPixels:1},{maxWidth:100,maxHeight:100.5,maxPixels:1},{maxWidth:100,maxHeight:100,maxPixels:Infinity}]){
  assert.throws(()=>boundedResolution(100,100,budget),RangeError);assert.throws(()=>validateExplicitResolution(100,100,budget),RangeError);
 }
});

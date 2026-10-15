import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { previewResolution, initialView } from '../view-settings.mjs';
test('normal public preview starts at 960 by 640, with bounded explicit sizes', () => {
  assert.deepEqual(previewResolution(new URLSearchParams()), {width:960,height:640});
  assert.deepEqual(previewResolution(new URLSearchParams('width=720')), {width:720,height:480});
  assert.deepEqual(previewResolution(new URLSearchParams('width=480&height=320')), {width:480,height:320});
  assert.deepEqual(previewResolution(new URLSearchParams('width=99999&height=99999')), {width:960,height:640});
  assert.deepEqual(previewResolution(new URLSearchParams('width=Infinity&height=oops')), {width:960,height:640});
});
test('public view deep links are safe and preserve default front street', () => {
  const views = {street:{},hall:{},writing:{}};
  assert.equal(initialView(new URLSearchParams(),views),'street');
  assert.equal(initialView(new URLSearchParams('view=hall'),views),'hall');
  assert.equal(initialView(new URLSearchParams('view=__proto__'),views),'street');
});
test('quality control is accessible and source model remains the canonical module', () => {
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
  assert.match(html,/id="quality" aria-label="画面精度"/);
  assert.match(app,/createRenderer,VIEWS.*\.\/renderer.mjs/);
  assert.match(app,/previewResolution\(params\)/);
});

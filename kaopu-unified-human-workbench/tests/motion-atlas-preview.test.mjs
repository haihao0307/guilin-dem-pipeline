import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../motion-atlas-r03/index.html',import.meta.url),'utf8');
const evidence=JSON.parse(await readFile(new URL('../motion-atlas-r03/sample-evidence.json',import.meta.url),'utf8'));

test('source-backed Motion Atlas preview uses the pinned CMU 16_33 data and required controls',()=>{
 assert.match(html,/CMU-WALK-SOURCE\.json|CMU 16_33/);
 assert.match(html,/mocap\.cs\.cmu\.edu/);
 for(const id of ['play','step','reset','timeline','speed','smooth'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/data-view="front"/);
 assert.match(html,/data-view="side"/);
 assert.match(html,/data-view="oblique"/);
});
test('sample evidence is explicitly bounded and does not claim full-catalogue acceptance',()=>{
 assert.equal(evidence.sourceClipId,'CMU 16_33');
 assert.equal(evidence.frames,285);
 assert.equal(evidence.joints,31);
 assert.ok(evidence.raw.rms>evidence.threeTapBinomialPreview.rms);
 assert.ok(evidence.limitations.some(x=>x.includes('not the full CMU or Mesh2Motion catalogue')));
});

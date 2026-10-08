import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRESETS,STAGES,createPresetState,presetRecord} from '../full/ui/PresetCatalogue.mjs';
import {defaultState,validateState} from '../full/src/State.mjs';
const meta=JSON.parse(await readFile(new URL('../full/assets/anny-all/anny-model.json',import.meta.url)));
assert.equal(PRESETS.length,36);assert.equal(new Set(PRESETS.map(p=>p.id)).size,36);
const defaults=defaultState(),before=JSON.stringify(defaults);const signatures=new Set();
for(const stage of STAGES){const rows=PRESETS.filter(p=>p.stage===stage.id);assert.equal(rows.length,6);assert.equal(rows.filter(p=>p.phenotypes.gender===1).length,3);assert.equal(rows.filter(p=>p.phenotypes.gender===0).length,3);}
for(const p of PRESETS){const state=createPresetState(p.id,defaults);assert.equal(state.owners.rig,'anny');assert.equal(state.headShapeComposition,'shared-layers/1');for(const[k,v]of Object.entries(p.phenotypes)){assert.ok(meta.phenotype_labels.includes(k));assert.ok(v>=0&&v<=1);}for(const[k,v]of Object.entries(p.localChanges)){assert.ok(meta.local_change_labels.includes(k),k);assert.ok(Math.abs(v)<=.22,k);}for(const k of['african','asian','caucasian'])assert.equal(state.anny.phenotypes[k],.5);assert.equal(state.gnm.identity.every(v=>v===0),true);assert.equal(state.mhr.identity.every(v=>v===0),true);assert.deepEqual(presetRecord(p.id,defaults).state,state);signatures.add(JSON.stringify(state));state.anny.localChanges={};state.gnm.identity[0]=9;}
assert.equal(signatures.size,36);assert.equal(JSON.stringify(defaults),before);assert.throws(()=>createPresetState('missing',defaults));console.log('PASS: 36 distinct bounded native presets, 6 balanced stages, complete independent states, exact record export.');

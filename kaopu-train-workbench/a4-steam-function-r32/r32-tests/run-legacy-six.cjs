'use strict';
// Portable local harness suite. No network/browser/GPU. Original test scopes kept.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),tests=['test_dynamic_js.js','test_installation_adapter.js','test_topology_integration.js','test_topology_materials.js','test-steam-whole-integration.js','test_material_renderer.js'];
const results=tests.map(test=>{const start=performance.now(),r=spawnSync(process.execPath,[test],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});const row={test,exit:r.status,error:r.error?.message,seconds:(performance.now()-start)/1000,stdout:r.stdout,stderr:r.stderr};console.log(JSON.stringify({test,exit:row.exit,error:row.error,seconds:row.seconds}));return row;});
const output=path.join(__dirname,'legacy-results','SIX_TEST_SUITE_RESULT.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({status:results.every(r=>r.exit===0)?'PASS':'FAIL',scope:'Local model math and explicit all-MISS DOM/GL facades; no pixels/GPU/browser',results},null,2)+'\n');if(results.some(r=>r.exit!==0))process.exitCode=1;

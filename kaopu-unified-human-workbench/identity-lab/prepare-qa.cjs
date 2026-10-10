// Geometry checks still execute the original model and viewer geometry updates.
// Only their redundant image rendering is held; all pixel/visual tests render
// normally afterward. This is a test optimization, not a production bypass.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.join(__dirname,'verify.cjs');let s=fs.readFileSync(file,'utf8');
const hold="await page.evaluate(()=>{const v=__IDENTITY_QA__.viewer();window.__ET13_RENDER_RESTORE__=v.render;v.render=()=>{};});";
const resume="await page.evaluate(()=>{const v=__IDENTITY_QA__.viewer();v.render=window.__ET13_RENDER_RESTORE__;delete window.__ET13_RENDER_RESTORE__;v.render();});";
const replacements=[
 ['for(const row of catalog){',hold+'\n for(const row of catalog){'],
 ['const unilateral=await page.evaluate',resume+'\n const unilateral=await page.evaluate'],
 ['for(const id of await page.evaluate(()=>fullCommonWorkbench.allPresets().map(p=>p.id))){',hold+'\n for(const id of await page.evaluate(()=>fullCommonWorkbench.allPresets().map(p=>p.id))){'],
 ["check('72 original preset archives retained',report.presets.length===72);","check('72 original preset archives retained',report.presets.length===72);\n "+resume]
];
for(const [a,b]of replacements){if(s.includes(b))continue;assert.equal(s.split(a).length,2,'Test anchor missing');s=s.replace(a,()=>b);}
fs.writeFileSync(file,s);

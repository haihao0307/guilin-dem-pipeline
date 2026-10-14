'use strict';
const fs=require('fs'),Module=require('module'),assert=require('node:assert/strict');
let src=fs.readFileSync(__dirname+'/../brow-lash-r01/verify.cjs','utf8');
const patch=(a,b)=>{assert(src.includes(a),'verification adapter '+a);src=src.replace(a,()=>b);};
src=src.replaceAll('BROW-LASH-R01','BROW-LASH-R02').replaceAll('/brow-lash-r01/preview.html','/brow-lash-r02/preview.html');
src=src.replaceAll('lifelikeIdle.ready()','browLash.groom().focusBlink.ready');
patch('const r=lifelikeIdle.runtime();r.pause(true);','browLash.groom().focusBlink.cancel();');
patch("q.final=await p.evaluate(()=>browLash.report());",`q.final=await p.evaluate(()=>browLash.report());
check('only two native blink targets; full idle never prepared',await p.evaluate(()=>browLash.groom().focusBlink.geometry.morphAttributes.position.length===2&&!window.__R05_IDLE_STARTED__));
const snapshot=await p.evaluate(()=>({revision:browLash.report().revision,prep:browLash.report().focusedBlink.preparationMS}));
await p.evaluate(async()=>{await browLash.prepareBlink();browLash.closure(.5);browLash.closure(0);});
check('repeat closure does not regrow hairs or repeat preparation',await p.evaluate(saved=>browLash.report().revision===saved.revision&&browLash.report().focusedBlink.preparationMS===saved.prep,snapshot));
check('native authoring arrays remain exact after blinking',await p.evaluate(()=>{const m=__IDENTITY_QA__.model();return m.positions.every((v,i)=>v===__BL_TEST.positions[i])&&m.faces.every((v,i)=>v===__BL_TEST.faces[i]);}));
q.final=await p.evaluate(()=>browLash.report());`);
// Execute under this directory so old QA serves and stores only the new candidate.
const generated=new Module(__filename,module);generated.filename=__filename;generated.paths=module.paths;generated._compile(src,__filename);

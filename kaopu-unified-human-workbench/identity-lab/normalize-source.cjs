// Narrow, idempotent source migrations. Each replacement is explicit and
// checks its unique old anchor; generated source is committed after browser QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function migrate(name,replacements){const file=path.join(__dirname,name);let source=fs.readFileSync(file,'utf8');for(const [before,after]of replacements){if(source.includes(after))continue;assert.equal(source.split(before).length,2,'Expected unique source anchor in '+name);source=source.replace(before,()=>after);}fs.writeFileSync(file,source);}
migrate('TraitMaps.mjs',[
 ['Math.exp(-((y-287)/18)**2)','Math.exp(-Math.pow((y-287)/18,2))'],
 ['Math.exp(-(Math.abs(x)/(24+38*s.freckleSpread))**4)','Math.exp(-Math.pow(Math.abs(x)/(24+38*s.freckleSpread),4))']
]);
migrate('IdentityUI.mjs',[
 ['archive:controller.archive()});}}finally','archive:{...model.archive(),surface:structuredClone(original.surface)}});}}finally'],
 ['const changed=()=>sync();',`const changed=()=>{sync();const s=controller.state();for(const input of panel.querySelectorAll('input[data-kind]')){if(input===document.activeElement)continue;const k=input.dataset.key,t=input.dataset.kind;let v;if(t==='native'){const row=NATIVE_FEATURES.find(r=>r.id===k),keys=nativeKeys(row,side);v=keys.reduce((a,key)=>a+(s.anny.localChanges[key]||0),0)/keys.length;}else if(t==='host')v=viewer.skin.settings[k];else if(t==='body')v=s.anny.phenotypes[k];else v=api[t][k];input.value=v;const out=input.parentElement.querySelector('output');if(out)out.textContent=typeof v==='number'?v.toFixed(2):v;}};`],
 ["if(b.dataset.group){group=b.dataset.group;render();return;}","if(b.dataset.group){group=b.dataset.group;render();if(group==='眼睛')model.eyeSurface.viewEyes?.();else if(group==='鼻子')document.querySelector('[data-face-closeup=\\\"nose\\\"]')?.click();else if(group==='嘴唇')document.querySelector('[data-face-closeup=\\\"mouth\\\"]')?.click();else if(group!=='体格')viewer.view('face');else viewer.view('three');return;}"]
]);

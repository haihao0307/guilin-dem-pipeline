// Explicit, idempotent source migrations; tested output is retained in Git.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function migrate(name,replacements){const file=path.join(__dirname,name);let source=fs.readFileSync(file,'utf8');for(const [before,after]of replacements){if(source.includes(after))continue;assert.equal(source.split(before).length,2,'Expected unique source anchor in '+name+': '+before.slice(0,70));source=source.replace(before,()=>after);}fs.writeFileSync(file,source);}
migrate('TraitMaps.mjs',[
 ['Math.exp(-((y-287)/18)**2)','Math.exp(-Math.pow((y-287)/18,2))'],
 ['Math.exp(-(Math.abs(x)/(24+38*s.freckleSpread))**4)','Math.exp(-Math.pow(Math.abs(x)/(24+38*s.freckleSpread),4))']
]);
migrate('IdentityUI.mjs',[
 ['archive:controller.archive()});}}finally','archive:{...model.archive(),surface:structuredClone(original.surface)}});}}finally'],
 ['lastSeed=1729,pending=null;','lastSeed=1729,pending=null,editing=false;'],
 ['function transact(fn){saveUndo();try{const value=fn();sync();return value;}catch(e){history.pop();status(e.message,true);throw e;}}','function transact(fn){saveUndo();editing=true;try{const value=fn();sync();return value;}catch(e){history.pop();status(e.message,true);throw e;}finally{editing=false;}}'],
 ['const changed=()=>sync();',`const changed=()=>{sync();if(!editing)eyeBase=null;const s=controller.state();for(const input of panel.querySelectorAll('input[data-kind]')){if(input===document.activeElement)continue;const k=input.dataset.key,t=input.dataset.kind;let v;if(t==='native'){const row=NATIVE_FEATURES.find(r=>r.id===k),keys=nativeKeys(row,side);v=keys.reduce((a,key)=>a+(s.anny.localChanges[key]||0),0)/keys.length;}else if(t==='host')v=viewer.skin.settings[k];else if(t==='body')v=s.anny.phenotypes[k];else v=api[t][k];input.value=v;const out=input.parentElement.querySelector('output');if(out)out.textContent=typeof v==='number'?v.toFixed(2):v;}const toggle=document.getElementById('identityEnabled');if(toggle)toggle.checked=api.traits.enabled;};`],
 ["$('identityFields').innerHTML=html;if($('identitySide'))", "$('identityFields').innerHTML=html;if(group==='皮肤'){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id='identityEnabled';input.checked=api.traits.enabled;label.append('启用附加身份皮肤',input);$('identityFields').prepend(label);}if($('identitySide'))"],
 ["if(el.id==='identitySide'){side=el.value;render();}","if(el.id==='identityEnabled'){try{update({traits:{enabled:el.checked}});}catch(e){status(e.message,true);}}else if(el.id==='identitySide'){side=el.value;render();}"],
 ["if(b.dataset.group){group=b.dataset.group;render();return;}","if(b.dataset.group){group=b.dataset.group;render();if(group==='眼睛')model.eyeSurface.viewEyes?.();else if(group==='鼻子')model.faceSurface.featureView('nose');else if(group==='嘴唇')model.faceSurface.featureView('mouth');else if(group!=='体格')viewer.view('face');else viewer.view('three');return;}"]
]);
migrate('verify.cjs',[
 ['report.batch={count:batch.count,hashes:batch.items.map(x=>x.geometryHash)};','fs.writeFileSync(OUT+"/identity-batch.json",JSON.stringify(batch,null,2));report.batch={count:batch.count,hashes:batch.items.map(x=>x.geometryHash)};'],
 ['report.nativeControls.push(result);','report.nativeControls.push(result);if(report.nativeControls.length%10===0)console.log("native controls checked",report.nativeControls.length);'],
 ['report.traitControls.push({key,value,before,after,pixelsChanged:a!==b});','report.traitControls.push({key,value,before,after,pixelsChanged:a!==b});console.log("trait rendered",key);']
]);

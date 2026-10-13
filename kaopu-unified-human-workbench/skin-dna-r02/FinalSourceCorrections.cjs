const fs=require('fs'),assert=require('node:assert/strict');
module.exports=out=>{const read=n=>fs.readFileSync(out+'/'+n,'utf8'),put=(n,s)=>fs.writeFileSync(out+'/'+n,s),once=(s,a,b)=>{assert.equal(s.split(a).length,2,'Final source anchor: '+a.slice(0,90));return s.replace(a,()=>b);};
 let p=read('SkinProfile.mjs');p=once(p,'鼻颊不对称雀斑 · 微红与薄皮分区','浅色基底 · 颊部微红 · 不制造雀斑');put('SkinProfile.mjs',p);
 let v=read('EntryView.mjs');const begin=v.indexOf(' function recover(){'),end=v.indexOf("\n document.getElementById('sd-recover')",begin);assert(begin>0&&end>begin);
 v=v.slice(0,begin)+` function recover(){
  const idle=window.lifelikeIdle?.runtime?.(),vr=viewer.render,ir=idle?.originalRender;let suppressed=0;const hold=()=>{suppressed++;};viewer.render=hold;if(idle)idle.originalRender=hold;
  try{if(!api.archive().enabled)api.compare();api.channel(0);document.getElementById('sd-channel').value='0';model.regionalFace.settings.diagnostic=0;viewer.regionalSkin.update(model.regionalFace.settings);api.view('face');}
  finally{viewer.render=vr;if(idle)idle.originalRender=ir;}
  if(ir)ir();else vr.call(viewer);R.coalescedRecoveryDraws=(R.coalescedRecoveryDraws||0)+suppressed;label(api.archive());shell.scrollTop=0;window.scrollTo(0,0);
 }`+v.slice(end);
 v=once(v,'recover();apply();const gl=','recover();const gl=');
 v=once(v,'firstFrame:R.firstFrame,errors:','firstFrame:R.firstFrame,coalescedRecoveryDraws:R.coalescedRecoveryDraws||0,errors:');
 v=once(v,"R.phase='皮肤显示未完成';stopped=true;","R.phase='皮肤显示未完成';window.__LIP_P3__?.fail?.(e.message);stopped=true;");
 v=once(v,"R.phase='显示未完成，请复制皮肤诊断';document.getElementById", "R.phase='显示未完成，请复制皮肤诊断';window.__LIP_P3__?.fail?.(R.phase);document.getElementById");
 v=once(v,"R.phase='本版肤质已绘制';label", "R.phase='本版肤质已绘制';const caption=document.getElementById('model-caption');if(caption)caption.textContent='同一人物 · 显示 '+viewer.geometry.attributes.position.count.toLocaleString()+' 顶点 · '+(viewer.geometry.index.count/3).toLocaleString()+' 面';label");put('EntryView.mjs',v);
 fs.rmSync(out+'/refine.cjs',{force:true});put('test.mjs',"// R02 authoritative checks; no obsolete R01 optical formula.\nimport './unit.cjs';\n");fs.copyFileSync(__filename,out+'/FinalSourceCorrections.cjs');
 console.log('Final UI wording, coalesced recovery and strict failure propagation applied');
};

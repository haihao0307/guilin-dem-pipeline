const assert=require('node:assert/strict');
exports.adapt=(s,rel,log)=>{const once=(a,b)=>{assert.equal(s.split(a).length,2,'R02 adapter drift '+rel+' '+a.slice(0,80));s=s.replace(a,()=>b);log.push({path:rel,rule:'SKIN-R02',anchor:a.slice(0,90)});};
 if(rel.endsWith('/idle-r01/IdleRuntime.mjs')){
  once("invalidate(){if(this.disposed)return;", "invalidate(){if(this.disposed)return;if(globalThis.__SKIN_REVIEW_STATIC__&&!this.reviewActivated){clearTimeout(this.debounce);this.playing=false;this.ready=false;this.status='肤质静态审查 · 原生待机按需准备';this.notify();return;}");
  once('pause(value=true){this.playing=!value;', 'pause(value=true){if(!value&&globalThis.__SKIN_REVIEW_STATIC__&&!this.reviewActivated){this.reviewActivated=true;this.invalidate();}this.playing=!value;');
 }
 if(rel.endsWith('/idle-r01/IdleUI.mjs'))once("if(!disposed)viewer.view('face');", "if(!disposed&&!globalThis.__SKIN_REVIEW_STATIC__)viewer.view('face');");
 if(rel.endsWith('/skin-dna-r02/Startup.mjs')){
  once("<strong>人物总台 R04 · 耳 R06 / 唇 ET19 / P3 恢复</strong>","<strong>皮肤自然规律 R02 · 准备真实三维画面</strong>");
  once('v.startupFinalFrame){settled=true;', 'v.startupFinalFrame&&window.__SKIN_REVIEW__?.ready){settled=true;');
  once("stage:P.stage,ready:R.ready,paused:R.paused,errors:R.errors,transport:R.transport.snapshot()", "stage:P.stage,ready:R.ready,paused:R.paused,errors:R.errors,skinReview:window.skinDNA?.opening?.(),transport:R.transport.snapshot()");
  once("P.stage='三维已就绪'", "P.stage='新版肤质已绘制 · 可直接切换'");
 }
 return s;
};

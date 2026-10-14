/* Normalized inspection around original APIs; optical/mechanical programs remain native. */
(()=>{
 const id=new URLSearchParams(globalThis.__FABRIC_QUERY__||'').get('engine');
 const css=document.createElement('style');css.textContent=`
 html,body{scroll-behavior:auto!important}body{margin:0!important}
 body[data-collection-engine=raywave] header,body[data-collection-engine=raywave] .intro,body[data-collection-engine=raywave] .collection,body[data-collection-engine=raywave] footer{display:none!important}
 body[data-collection-engine=raywave] main{max-width:none!important;margin:0!important;padding:8px!important}
 body[data-collection-engine=raywave] .workspace{grid-template-columns:minmax(0,1fr) 285px!important;gap:10px!important}
 body[data-collection-engine=raywave] .viewport{min-height:580px!important;height:calc(100vh - 92px)!important}
 body[data-collection-engine=raywave] .inspector{max-height:calc(100vh - 92px)!important;overflow:auto!important}
 body[data-collection-engine=raywave] .telemetry{margin-top:6px!important}
 body[data-collection-engine=legacy] .masthead,body[data-collection-engine=legacy] #fabric-tabs,body[data-collection-engine=legacy] .page-header,body[data-collection-engine=legacy] .intro,body[data-collection-engine=legacy] footer{display:none!important}
 body[data-collection-engine=legacy] main{padding:10px 15px!important;max-width:none!important}body[data-collection-engine=legacy] .preview canvas{height:calc(100vh - 140px)!important;min-height:400px}body[data-collection-engine=raywave] .workspace{height:calc(100vh - 88px)!important}
 body[data-collection-engine=denim]{grid-template-rows:minmax(0,1fr)!important}body[data-collection-engine=denim]>header{display:none!important}body[data-collection-engine=denim]>main{grid-row:1!important;height:100%!important;min-height:0!important}
 @media(max-width:750px){body[data-collection-engine=raywave] .workspace{display:flex!important;flex-direction:column!important}body[data-collection-engine=raywave] .viewport{height:68vh!important;min-height:390px!important}body[data-collection-engine=raywave] .inspector{max-height:none!important;width:100%!important}}
 `;document.head.append(css);document.body.dataset.collectionEngine=id;
 function api(){if(id==='legacy')return typeof FabricWorkbench!=='undefined'?FabricWorkbench:null;if(id==='raywave')return window.FabricLab;if(id==='denim')return window.__DENIM_WORKBENCH__;if(id==='leather')return window.LEATHER_ATELIER;return null;}
 function report(){if(window.__FABRIC_BOOT_ERRORS__?.length)return {engine:id,ready:false,error:window.__FABRIC_BOOT_ERRORS__.join(' | ')};const a=api();if(!a)return {engine:id,ready:false};if(id==='raywave'&&document.documentElement.dataset.ready!=='true')return {engine:id,ready:false};if(id==='denim'&&(!a.ready||!a.lastFrame))return {engine:id,ready:false};if(id==='leather'&&!a.ready)return {engine:id,ready:false};
  try{if(id==='legacy')return {engine:id,ready:document.documentElement.dataset.ready==='true',native:a.report(),physicsMode:'appearance-only'};
   if(id==='raywave'){const r=a.report();return {engine:id,ready:r.ready,native:r,physicsMode:'native',lighting:r.eb1?'EB1-1.1.0':'native-original'};}
   if(id==='denim')return {engine:id,ready:!!a.ready&&!!a.lastFrame,native:{version:a.version,state:{...a.state},frame:a.lastFrame,physics:a.physicsReport()},physicsMode:'native'};
   if(id==='leather')return {engine:id,ready:!!a.ready,native:a.snapshot(),physicsMode:'native'};
  }catch(error){return {engine:id,ready:false,error:error.message};}
 }
 window.FABRIC_NATIVE={api,report,select:async(item)=>{const a=api();if(!a)throw Error('原生系统尚未就绪');
  if(id==='legacy')a.set({fabric:item.native});
  if(id==='raywave'){const wait=async()=>{const start=performance.now();while(document.documentElement.dataset.ready!=='true'){if(performance.now()-start>180000)throw Error('原生布料切换尚未完成');await new Promise(r=>setTimeout(r,60));}};if(a.report().preset!==item.native){await a.setPreset(item.native);await wait();}if(item.values){await a.set(item.values);await wait();}}
 },capture:()=>{const a=api();if(id==='legacy')return a.report().state;if(id==='denim')return {...a.state};if(id==='leather')return a.snapshot();if(id==='raywave'){const values={};for(const el of document.querySelectorAll('.inspector input,.inspector select'))if(el.id&&!el.closest('#eb1-panel'))values[el.id]=el.type==='checkbox'?el.checked:el.value;return {values,preset:a.report().preset,view:a.report().view,eb1:window.__EB1__?.audit?.()};}return null;},restore:async(state)=>{const a=api();if(!state||!a)return;if(id==='legacy')a.set(state);if(id==='denim')a.setState(state);if(id==='leather'){a.selectMaterial(state.material);a.configure(state.config);a.selectProduct(state.product);}if(id==='raywave'){await a.set(state.values);}},dispose:()=>{try{const a=api();if(id==='raywave')a?.pause();if(id==='leather')a?.pausePhysics();if(id==='denim')a?.setState({animate:false});}finally{window.__FABRIC_LIFECYCLE__?.dispose();}}};
 document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&a.getAttribute('href')?.startsWith('./')){e.preventDefault();parent.postMessage({type:'fabric-native-navigation',href:a.getAttribute('href'),engine:id},'*');}});
})();

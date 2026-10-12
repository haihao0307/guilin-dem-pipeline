/** Review tools share the existing model, renderer and archive. */
export function mountRefinementReview({model,viewer,controller}){
 const panel=document.getElementById('identityPanel'),host=document.createElement('section');host.id='refinement-review';
 host.innerHTML=`<strong>R03 · 唇色 / 耳廓精修</strong><div class="r03-tools"><button data-r03-view="left">左耳近看</button><button data-r03-view="right">右耳近看</button><button data-r03-view="lips">唇色检查</button><button data-r03-view="face">整脸</button></div><details><summary>颜色、受光与表面检查</summary><div class="r03-tools"><button data-r03-layer="beauty">正常材质</button><button data-r03-layer="color">纯底色</button><button data-r03-layer="normal">微法线</button><button data-r03-layer="roughness">粗糙度</button></div><label>原生唇色 <input aria-label="原生唇色" type="color" id="r03-lip-color"></label><label>唇色混合 <input aria-label="唇色混合" type="range" id="r03-lip-mix" min="0" max="1" step=".01"></label><div class="r03-tools"><button data-r03-tint="natural">自然暖玫瑰</button><button data-r03-tint="muted">低饱和唇色</button><button data-r03-tint="deep">深色唇红</button><button data-r03-tint="original">恢复原唇色</button></div><small>这些是人工校色预设，不代表某种肤色、年龄或族群。色值写入原人物档案。</small></details>`;
 panel.insertBefore(host,document.getElementById('identityTabs'));
 const initial={lipColor:viewer.skin.settings.lipColor,lipMix:viewer.skin.settings.lipMix};let disposed=false;
 const sync=()=>{host.querySelector('#r03-lip-color').value=viewer.skin.settings.lipColor;host.querySelector('#r03-lip-mix').value=viewer.skin.settings.lipMix;};
 function view(key){viewer.earLight.intensity=0;model.eyeSurface.set({gray:false,grid:false});model.faceSurface.set({layer:'beauty'});viewer.skin.earAudit(0);controller.changed();
  if(key==='lips'){lipWorkbench.open();document.body.classList.add('ear-focus');viewer.resize();lipWorkbench.view('front');}
  else if(key==='face'){earWorkbench.open();earWorkbench.view('face');}
  else {earWorkbench.open();earWorkbench.view(key);earWorkbench.view('macro');}
  viewer.render();sync();
 }
 function layer(key){const n=['beauty','color','normal','roughness'].indexOf(key);if(n<0)throw Error('Unknown inspection layer');model.faceSurface.set({layer:key});viewer.skin.earAudit(n);viewer.render();}
 function tint(key){const colors={natural:{lipColor:'#995d59',lipMix:.69},muted:{lipColor:'#966862',lipMix:.63},deep:{lipColor:'#693f3b',lipMix:.73},original:initial};if(!colors[key])throw Error('Unknown lip tint');viewer.skin.set(colors[key]);sync();}
 const click=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.r03View)view(b.dataset.r03View);else if(b.dataset.r03Layer)layer(b.dataset.r03Layer);else if(b.dataset.r03Tint)tint(b.dataset.r03Tint);};
 const input=e=>{if(e.target.id==='r03-lip-color')viewer.skin.set({lipColor:e.target.value});if(e.target.id==='r03-lip-mix')viewer.skin.set({lipMix:Number(e.target.value)});sync();};
 host.addEventListener('click',click);host.addEventListener('input',input);controller.addEventListener('change',sync);
 const previous=model.earStructure.disposeUI;model.earStructure.disposeUI=()=>{disposed=true;host.remove();controller.removeEventListener('change',sync);previous?.();};
 window.refinementWorkbench={version:'EAR-R03.0',ready:false,view,layer,tint,archive:()=>controller.archive(),report:()=>viewer.report()};
 Promise.all([viewer.skin.faceReady,viewer.skin.naturalEyesReady]).then(()=>setTimeout(()=>{if(disposed)return;view('left');refinementWorkbench.ready=true;},1300));sync();
}

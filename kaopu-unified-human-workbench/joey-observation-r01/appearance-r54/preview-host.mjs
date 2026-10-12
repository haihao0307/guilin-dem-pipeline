const frame=document.querySelector('#native'),status=document.querySelector('#status'),progress=document.querySelector('#progress'),loading=document.querySelector('#loading'),retry=document.querySelector('#retry');
const core=new URL('../../',import.meta.url),hostURL=new URL('index-before-main-eyes-20261011.html',core);
const params=new URLSearchParams(location.search);
// The CI server mounts the same fixed engine under /native. No arbitrary host,
// upload endpoint or cross-origin model is accepted by this test-only override.
if(location.hostname==='127.0.0.1'&&params.get('qa')==='native')hostURL.href=new URL('/native/kaopu-unified-human-workbench/index-before-main-eyes-20261011.html',location.origin).href;
function fail(error){status.textContent='载入未完成';progress.textContent=String(error.message||error);retry.hidden=false;loading.hidden=false;frame.style.visibility='hidden';}
retry.onclick=()=>location.reload();
frame.addEventListener('load',()=>{
 try{
  const doc=frame.contentDocument,base=new URL('.',hostURL),map=doc.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:{'/native/kaopu-unified-human-workbench/':base.href}});doc.head.append(map);
  const style=doc.createElement('style');style.textContent='html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;display:block!important}body>header,body>nav,#control-shell,.view-tools,.motion-studio{display:none!important}main,.model-stage,#stage{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;grid-template-columns:none!important}#stage canvas{display:block;width:100%!important;height:100%!important}';doc.head.append(style);
  const script=doc.createElement('script');script.type='module';script.textContent=`import {mountPreview} from ${JSON.stringify(new URL('./install-preview.mjs',import.meta.url).href)};mountPreview().catch(error=>parent.postMessage({type:'r54-error',message:error.message},location.origin));`;doc.body.append(script);
 }catch(e){fail(e);}
});
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;const m=e.data;if(m?.type==='r54-progress'){progress.textContent=m.message;status.textContent=m.message;}if(m?.type==='r54-error')fail(m.message);if(m?.type==='r54-ready'){status.textContent='R54 静态候选';loading.hidden=true;frame.style.visibility='visible';for(const b of document.querySelectorAll('.tools button'))b.disabled=false;window.r54PreviewReport=m.report;}});
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{try{frame.contentWindow.r54Preview.view(b.dataset.view);for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));}catch(e){fail(e);}};
for(const[id,key,label]of[['hair-toggle','hair','覆盖发层'],['eye-toggle','eye','程序眼表']])document.getElementById(id).onclick=e=>{try{const b=e.currentTarget,on=b.getAttribute('aria-pressed')!=='true';frame.contentWindow.r54Preview[key](on);b.setAttribute('aria-pressed',String(on));b.textContent=label+'：'+(on?'开':'关');}catch(x){fail(x);}};
frame.src=hostURL.href;

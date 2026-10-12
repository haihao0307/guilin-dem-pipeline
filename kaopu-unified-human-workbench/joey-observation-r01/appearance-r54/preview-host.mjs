const frame=document.querySelector('#native'),status=document.querySelector('#status'),progress=document.querySelector('#progress'),loading=document.querySelector('#loading'),retry=document.querySelector('#retry');
const hostURL=new URL('./native-host.html?v=r54-startup-2',import.meta.url);
function fail(error){window.r54Boot.fail(error);}
retry.onclick=()=>location.reload();
window.r54Boot.stage('1/5 正在打开原生人物页面');
frame.addEventListener('error',()=>fail('原生页面载入失败，请重新载入。'));
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;const m=e.data;if(m?.type==='r54-progress'){window.r54Boot.stage(m.message);}if(m?.type==='r54-error')fail(m.message);if(m?.type==='r54-ready'){status.textContent='R54 静态候选';window.r54Boot.ready();frame.style.visibility='visible';for(const b of document.querySelectorAll('.tools button'))b.disabled=false;window.r54PreviewReport=m.report;}});
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{try{frame.contentWindow.r54Preview.view(b.dataset.view);for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));}catch(e){fail(e);}};
for(const[id,key,label]of[['hair-toggle','hair','覆盖发层'],['eye-toggle','eye','程序眼表']])document.getElementById(id).onclick=e=>{try{const b=e.currentTarget,on=b.getAttribute('aria-pressed')!=='true';frame.contentWindow.r54Preview[key](on);b.setAttribute('aria-pressed',String(on));b.textContent=label+'：'+(on?'开':'关');}catch(x){fail(x);}};
frame.src=hostURL.href;

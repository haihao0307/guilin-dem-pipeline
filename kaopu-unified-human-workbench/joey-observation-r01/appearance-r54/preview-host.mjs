const frame=document.querySelector('#native'),status=document.querySelector('#status'),progress=document.querySelector('#progress'),loading=document.querySelector('#loading'),retry=document.querySelector('#retry');
const hostURL=new URL('./native-host.html?v=r54-device-diagnostic-3',import.meta.url);
function fail(error){window.r54Boot.fail(error);}
retry.onclick=()=>location.reload();
window.r54Boot.stage('1/5 正在打开原生人物页面');
frame.addEventListener('error',()=>fail('原生页面载入失败，请重新载入。'));
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;const m=e.data;if(m?.type==='r54-diagnostic'){window.r54DeviceDiagnostic=m.report;document.querySelector('#device-diagnostic').hidden=false;document.querySelector('#diagnostic-text').textContent=m.text;}if(m?.type==='r54-progress'){window.r54Boot.stage(m.message);}if(m?.type==='r54-error')fail(m.message);if(m?.type==='r54-ready'&&window.r54PreviewState.phase!=='error'){status.textContent='R54 静态候选';window.r54Boot.ready();frame.style.visibility='visible';for(const b of document.querySelectorAll('.tools button'))b.disabled=false;window.r54PreviewReport=m.report;}});
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{try{frame.contentWindow.r54Preview.view(b.dataset.view);for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));}catch(e){fail(e);}};
for(const[id,key,label]of[['hair-toggle','hair','覆盖发层'],['eye-toggle','eye','程序眼表']])document.getElementById(id).onclick=e=>{try{const b=e.currentTarget,on=b.getAttribute('aria-pressed')!=='true';frame.contentWindow.r54Preview[key](on);b.setAttribute('aria-pressed',String(on));b.textContent=label+'：'+(on?'开':'关');}catch(x){fail(x);}};
frame.src=hostURL.href;

const diagnosticJSON=()=>JSON.stringify(window.r54DeviceDiagnostic,null,2);
document.querySelector('#copy-diagnostic').onclick=async()=>{const result=document.querySelector('#diagnostic-action-status');try{await navigator.clipboard.writeText(diagnosticJSON());result.textContent='完整诊断已复制；未自动发送。';}catch{result.textContent='此浏览器未允许复制，请使用下载诊断，或长按上方文字复制。';}};
document.querySelector('#download-diagnostic').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([diagnosticJSON()],{type:'application/json'}));a.href=url;a.download='r54-device-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);document.querySelector('#diagnostic-action-status').textContent='已请求保存本机诊断；未自动发送。';};

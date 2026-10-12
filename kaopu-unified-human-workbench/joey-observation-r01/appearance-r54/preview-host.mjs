import {diagnoseR52Device,formatR52Diagnostic} from './R52DeviceDiagnostic.mjs?v=r54-device-diagnostic-3';
const frame=document.querySelector('#native'),status=document.querySelector('#status'),progress=document.querySelector('#progress'),loading=document.querySelector('#loading'),retry=document.querySelector('#retry');
const hostURL=new URL('./native-host.html?v=r54-device-diagnostic-3',import.meta.url);
function fail(error){window.r54Boot.fail(error);}
retry.onclick=()=>location.reload();
window.r54Boot.stage('1/5 正在打开原生人物页面');
frame.addEventListener('error',()=>fail('原生页面载入失败，请重新载入。'));
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;const m=e.data;if(m?.type==='r54-diagnostic'){window.r54DeviceDiagnostic=m.report;document.querySelector('#device-diagnostic').hidden=false;document.querySelector('#diagnostic-text').textContent=m.text;}if(m?.type==='r54-progress'){window.r54Boot.stage(m.message);}if(m?.type==='r54-error')fail(m.message);if(m?.type==='r54-ready'&&window.r54PreviewState.phase!=='error'){status.textContent='R54 静态候选';window.r54Boot.ready();frame.style.visibility='visible';for(const b of document.querySelectorAll('.tools button'))b.disabled=false;window.r54PreviewReport=m.report;}});
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{try{frame.contentWindow.r54Preview.view(b.dataset.view);for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));}catch(e){fail(e);}};
for(const[id,key,label]of[['hair-toggle','hair','覆盖发层'],['eye-toggle','eye','程序眼表']])document.getElementById(id).onclick=e=>{try{const b=e.currentTarget,on=b.getAttribute('aria-pressed')!=='true';frame.contentWindow.r54Preview[key](on);b.setAttribute('aria-pressed',String(on));b.textContent=label+'：'+(on?'开':'关');}catch(x){fail(x);}};
// The visible parent owns diagnostic work. No data leaves this device.
let diagnosticStarted=false;
window.r54ReceiveFailure=input=>{
 if(diagnosticStarted)return;diagnosticStarted=true;
 // Recreate typed arrays in this realm without numeric conversion or mutating the source.
 const copyTyped=(value,type,name)=>{if(Object.prototype.toString.call(value)!==name)throw Error('诊断快照类型不符');return new type(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength));};
 let snapshot;try{snapshot={positions:copyTyped(input.positions,Float32Array,'[object Float32Array]'),faces:copyTyped(input.faces,Uint32Array,'[object Uint32Array]'),state:structuredClone(input.state),archive:structuredClone(input.archive),nativeArchive:structuredClone(input.nativeArchive)};}catch(error){fail(input.error+'；快照复制失败：'+error.message);return;}
 fail('启动失败：'+input.error);
 const panel=document.querySelector('#device-diagnostic'),text=document.querySelector('#diagnostic-text'),copy=document.querySelector('#copy-diagnostic'),download=document.querySelector('#download-diagnostic');
 panel.hidden=false;copy.disabled=true;download.disabled=true;
 const stage=message=>{text.textContent='正在本机完成诊断：'+message+'\n未知输出继续停止显示，不会自动上传。';window.r54DiagnosticStage=message;};stage('校验故障快照');
 window.r54DiagnosticPromise=(async()=>{
  let report;try{report=await diagnoseR52Device({...snapshot,onProgress:stage});}catch(error){report={schema:'R54-device-diagnostic/3',failure:error.message,geometryAccepted:false,geometryWritten:false,automaticUpload:false,checks:{}};}
  report.executionContext='visible parent page; exact failed snapshot copied before await';
  window.r54DeviceDiagnostic=report;text.textContent=formatR52Diagnostic(report);window.r54DiagnosticStage='complete';copy.disabled=false;download.disabled=false;return report;
 })();
};
frame.src=hostURL.href;

const diagnosticJSON=()=>JSON.stringify(window.r54DeviceDiagnostic,null,2);
document.querySelector('#copy-diagnostic').onclick=async()=>{const result=document.querySelector('#diagnostic-action-status'),button=document.querySelector('#copy-diagnostic');result.textContent='正在复制完整诊断…';button.disabled=true;let timeout;try{await Promise.race([navigator.clipboard.writeText(diagnosticJSON()),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('copy timeout')),5000);})]);result.textContent='完整诊断已复制；未自动发送。';}catch{result.textContent='未确认复制完成，请下载诊断，或长按上方文字复制。';}finally{clearTimeout(timeout);button.disabled=false;}};
document.querySelector('#download-diagnostic').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([diagnosticJSON()],{type:'application/json'}));a.href=url;a.download='r54-device-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);document.querySelector('#diagnostic-action-status').textContent='已请求保存本机诊断；未自动发送。';};

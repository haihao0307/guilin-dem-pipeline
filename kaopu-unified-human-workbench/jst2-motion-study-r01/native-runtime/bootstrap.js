/* One authoritative native scene, with original bytes served from this folder. */
window.__MOTION_DEFER_IDLE__ = true;
window.__NATIVE_ASSETS__ = {requests:[],errors:[],started:performance.now()};
window.__NATIVE_BOOT_ERRORS__=[];
window.__NATIVE_REPORT_BOOT_FAILURE__=message=>{
  message=String(message||'原生人物初始化失败');
  if(!window.__NATIVE_BOOT_ERRORS__.includes(message))window.__NATIVE_BOOT_ERRORS__.push(message);
  const graphics=/webgl|graphics context|图形上下文/i.test(message);
  const title=document.getElementById('native-status'),detail=document.getElementById('native-status-detail'),overlay=document.getElementById('native-loading');
  if(title)title.textContent=graphics?'当前浏览器无法启动 WebGL 2':'原生人物载入失败';
  if(detail)detail.textContent=graphics?'图形上下文创建失败。人物数据与骨架仍保留；请在支持 WebGL 2 的浏览器中重新打开。具体错误：'+message:message;
  if(overlay){overlay.hidden=false;const spinner=overlay.querySelector('.pulse');if(spinner)spinner.style.display='none';}
};
addEventListener('error',event=>{
  const message=event.error?.message||event.message;
  if(message)window.__NATIVE_REPORT_BOOT_FAILURE__(message);
});
addEventListener('unhandledrejection',event=>window.__NATIVE_REPORT_BOOT_FAILURE__(event.reason?.message||event.reason));
addEventListener('webglcontextcreationerror',event=>window.__NATIVE_REPORT_BOOT_FAILURE__('WebGL 2 context creation failed: '+(event.statusMessage||'graphics context unavailable')),true);
addEventListener('webglcontextlost',()=>window.__NATIVE_REPORT_BOOT_FAILURE__('WebGL 2 graphics context lost; reload the page to reconstruct the original person'),true);
(() => {
  const nativeBase='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/';
  const faceBase='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/02f596def9d07ebfc187e1eb18ad345a57c8a6b6/kaopu-unified-human-workbench/face-transfer/assets/';
  const fetchOriginal=window.fetch.bind(window);
  const localURL=u=>new URL((window.__NATIVE_ASSET_BASE__||'assets/')+u.replace(/^assets\//,''),location.href).href;
  window.__NATIVE_IMAGE_URL__ = value => {
    const url=String(value);
    if(url===faceBase+'detail.png'||url===faceBase+'chroma.png')return localURL('assets/'+url.split('/').pop());
    if(url.startsWith('data:')||url.startsWith('blob:'))return url;
    throw Error('Unmapped native image: '+url);
  };
  window.fetch=async function(resource,init){
    const url=String(resource instanceof Request?resource.url:resource);
    let target=url;
    if(url.startsWith(nativeBase))target=localURL(url.slice(nativeBase.length));
    else if(url.startsWith(faceBase))target=window.__NATIVE_IMAGE_URL__(url);
    const parsed=new URL(target,location.href);
    if(!['data:','blob:'].includes(parsed.protocol)&&parsed.origin!==location.origin){
      const error='Unexpected external native fetch: '+url;
      window.__NATIVE_ASSETS__.errors.push(error);throw Error(error);
    }
    const record={source:url,target:parsed.href,time:performance.now()};
    window.__NATIVE_ASSETS__.requests.push(record);
    try{
      const result=await fetchOriginal(resource instanceof Request?new Request(parsed.href,resource):parsed.href,init);
      record.status=result.status;
      if(!result.ok)window.__NATIVE_ASSETS__.errors.push('HTTP '+result.status+' '+parsed.href);
      return result;
    }catch(error){record.error=String(error.message||error);window.__NATIVE_ASSETS__.errors.push(record.error);throw error;}
  };
})();

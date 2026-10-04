/* Verified byte streaming and explicit startup stages. No asset quality reduction. */
(function(){'use strict';
const state={stage:'idle',message:'',loaded:0,total:0,startedAt:0,error:null};
const emit=patch=>{Object.assign(state,patch);window.dispatchEvent(new CustomEvent('rabbitloadprogress',{detail:{...state}}));};
async function fetchBytes(url,total,label,expected){
 const controller=new AbortController();let idle,absolute,loaded=0;
 const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort('下载30秒没有新数据'),30000);};
 absolute=setTimeout(()=>controller.abort('下载超过90秒'),90000);arm();
 emit({stage:'download',message:label,loaded:0,total,error:null});
 try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status+'：'+label);
  const chunks=[];if(response.body?.getReader){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;arm();emit({loaded,total,message:label});}}else{const value=new Uint8Array(await response.arrayBuffer());chunks.push(value);loaded=value.length;emit({loaded,total});}
  const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  emit({stage:'verify',message:'核验原始资源',loaded,total});
  if(!crypto.subtle)throw Error('此浏览器缺少安全资源校验接口，请用Safari直接打开网址');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(expected&&digest!==expected)throw Error('原始资源完整性校验失败：'+label);return bytes;
 }catch(error){throw Error(controller.signal.aborted?'网络等待超时，请点击重试':error.message);}finally{clearTimeout(idle);clearTimeout(absolute);}
}
const cache=new Map();
window.rabbitLoadProgress={state,emit,fetchBytes};
window.ensureRabbitAsset=async path=>{
 const value=WORKBENCH_BUNDLE.assets[path];if(!value)throw Error('缺少原始资源 '+path);
 if(value.startsWith('data:'))return value;
 if(!cache.has(path)){const meta=WORKBENCH_BUNDLE.assetMeta?.[path];if(!meta)throw Error('缺少原始资源校验 '+path);cache.set(path,fetchBytes(value,meta.bytes,'原始静态毛发遮罩',meta.sha256).then(bytes=>URL.createObjectURL(new Blob([bytes],{type:'image/png'}))).catch(error=>{cache.delete(path);throw error;}));}
 return cache.get(path);
};
})();

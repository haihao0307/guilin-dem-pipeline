import {createPatternEngine} from './vendor/pattern-engine.mjs';
const engine=createPatternEngine();let busy=false,verified=false;
const root=new URL('../../',import.meta.url),assetBase=new URL('garment-pattern-catalogue-r01/browser/',root);
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
async function verify(){
 if(verified)return;
 const a=await fetch(new URL('SOURCE_LOCK.json',import.meta.url));if(!a.ok)throw Error('无法读取本版制版来源记录');
 const lock=await a.json(),key='garment-pattern-catalogue-r01/browser/runtime-manifest.json';
 const r=await fetch(new URL(key,root));if(!r.ok)throw Error('原制版环境暂不可用');
 if(await sha(await r.arrayBuffer())!==lock.files[key])throw Error('共享制版环境已变更，须先重新校验版本；没有使用替代算法');
 verified=true;
}
self.onmessage=async({data})=>{
 if(data?.type!=='generate'||busy)return;busy=true;const id=data.id;
 try{
  await verify();
  const pattern=await engine.generate(data.request,{assetBase:assetBase.href},p=>self.postMessage({id,type:'progress',progress:p}));
  if(pattern.validation?.analytic2DPass!==true)throw Error('当前人物纸样检查未通过');
  self.postMessage({id,type:'result',pattern});
 }catch(e){self.postMessage({id,type:'error',message:String(e.message||e)});}finally{busy=false;}
};

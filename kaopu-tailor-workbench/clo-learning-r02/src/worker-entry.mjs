import '../generated/native-adapter.mjs';
const nativeHandler=self.onmessage;
let files=null;
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function inflate(s){return new Uint8Array(await new Response(new Blob([decode(s)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
self.fetch=async url=>{
 if(!files)throw Error('Embedded source transport is not ready');
 const u=new URL(String(url));
 if(u.origin!=='https://kaopu-embedded.invalid')throw Error('External source request rejected');
 const name=u.pathname.split('/').at(-1),data=files[name];
 if(!data)throw Error('Missing embedded source asset: '+name);
 return new Response(data,{status:200});
};
self.onmessage=async event=>{
 const data=event.data;
 try{
  if(data.type==='init-study'){
   const a=data.assets;
   files={'common-body.json':await inflate(a.bodyGzip),'common-body.sdfd.gz':decode(a.sdfGzip),'body-sdf-grid.json':new TextEncoder().encode(a.metaText),'joint-r043c.wasm':decode(a.wasm)};
   await nativeHandler({data:{type:'boot',root:'https://kaopu-embedded.invalid/backend/',patternBase:'https://kaopu-embedded.invalid/disabled-python/'}});
  }else{
   if(!['load-design-variant','run','pause','resume','invalidate','status','export'].includes(data.type))throw Error('Unsupported study command');
   await nativeHandler(event);
  }
 }catch(e){self.postMessage({type:'error',requestId:data.requestId,message:e.message});}
};

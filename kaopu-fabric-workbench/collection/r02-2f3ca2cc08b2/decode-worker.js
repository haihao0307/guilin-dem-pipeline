/* Byte-only worker: receives no URLs, access keys or credentials; never accesses the network. */
self.onmessage=async({data:pack})=>{try{
 const files=[];
 for(const row of pack.files){let data;
  if(row.codec==='fp16-delta4-byteplanes'){
   const src=row.data,count=src.byteLength/2;if(!Number.isInteger(count)||row.outputBytes!==src.byteLength)throw Error('光学数据长度错误');const half=new Uint16Array(count);
   for(let i=0;i<count;i++)half[i]=((src[i]|src[i+count]<<8)+(i>=4?half[i-4]:0))&65535;
   data=new Uint8Array(half.buffer);
  }else data=row.data.slice();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==row.sha256)throw Error('还原后的资源校验失败 '+row.path);
  files.push({...row,data});
 }
 self.postMessage({ok:true,pack:{...pack,files,byteLength:files.reduce((n,f)=>n+f.data.byteLength,0)}},files.map(f=>f.data.buffer));
}catch(e){self.postMessage({ok:false,error:e.message});}};

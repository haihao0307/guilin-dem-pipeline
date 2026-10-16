import{decodeTerrainPacket}from'./decode.mjs';
let queue=Promise.resolve();
self.onmessage=event=>{const{id,meta,encoded}=event.data;queue=queue.then(async()=>{try{const result=await decodeTerrainPacket(meta,encoded);self.postMessage({id,result},Object.values(result.arrays).map(a=>a.buffer));}catch(error){self.postMessage({id,error:String(error.stack||error)});}});};

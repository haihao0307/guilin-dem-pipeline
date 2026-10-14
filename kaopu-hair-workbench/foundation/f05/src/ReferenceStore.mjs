export function referenceStore(){
 const memory=new Map();let connection;
 const db=()=>connection??=new Promise((resolve,reject)=>{const r=indexedDB.open('kaopu.hair.F05.references',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 async function transact(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('images',mode),r=fn(t.objectStore('images'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
 return {async put(id,blob){memory.set(id,blob);try{await transact('readwrite',s=>s.put(blob,id));return true;}catch{return false;}},async get(id){if(memory.has(id))return memory.get(id);try{return await transact('readonly',s=>s.get(id));}catch{return null;}}};
}
export async function inspectReference(file){
 if(file.size>12*1024*1024||file.size<12)throw Error('请选择12MB以内的 PNG、JPEG 或 WebP 图片');
 const bytes=new Uint8Array(await file.arrayBuffer()),type=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 if(!type)throw Error('图片内容不是支持的格式');
 const blob=new Blob([bytes],{type}),image=await createImageBitmap(blob),width=image.width,height=image.height;image.close();
 if(width>20000||height>20000||width*height>80000000)throw Error('参考图尺寸过大');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 return{blob,evidence:{id:sha256,sha256,fileName:file.name.slice(0,200),mime:type,width,height,view:'unknown',source:'user-local',observation:'unanalysed',hiddenAreas:'unobserved'}};
}

import {BodySDF,ClothSolver} from './material-physics.mjs';
let solvers=[],sdf=null;
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function checked(url,hash){const r=await fetch(url);if(!r.ok)throw Error('碰撞体 HTTP '+r.status);const b=await r.arrayBuffer();if(hash&&await digest(b)!==hash)throw Error('原人物碰撞数据校验失败');return b;}
function frame(id){const rows=solvers.map(s=>({positions:s.output.slice(),normals:s.normals.slice(),audit:s.audit(true)}));const buffers=rows.flatMap(r=>[r.positions.buffer,r.normals.buffer]);self.postMessage({id,rows},buffers);}
self.onmessage=async({data:d})=>{try{if(d.command==='init'){
 const m=JSON.parse(new TextDecoder().decode(await checked(new URL('./assets/body-sdf-grid.json',import.meta.url),d.lock.sdfMetadataSHA256))),compressed=await checked(new URL('./assets/common-body.sdfd.gz',import.meta.url),d.lock.sdfFileSHA256),raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();sdf=new BodySDF(m,new Int16Array(raw),d.lock.groundShiftM);
 solvers=d.rows.map((r,i)=>new ClothSolver(r.packet,r.positions,{sdf,family:r.info.family,doubleLayer:r.info.settings.doubleLayer,role:i?'bottom':'top',...d.settings}));for(let n=0;n<8;n++){for(const s of solvers)s.step(1/30);self.postMessage({id:d.id,progress:(n+1)/8});}frame(d.id);
 }else if(d.command==='step'){for(const s of solvers)s.step(1/60);frame(d.id);
 }else if(d.command==='settle'){const n=Math.max(1,Math.min(60,Math.ceil((d.seconds||.5)*30)));for(let j=0;j<n;j++){for(const s of solvers)s.step(1/30);if(j%5===0)self.postMessage({id:d.id,progress:(j+1)/n});}frame(d.id);
 }else if(d.command==='tug'){solvers.forEach(s=>s.tug());for(const s of solvers)s.step(1/60);frame(d.id);
 }else if(d.command==='reset'){solvers.forEach(s=>s.reset());frame(d.id);
 }else if(d.command==='settings'){solvers.forEach(s=>s.set(d.settings));frame(d.id);
 }else throw Error('UNKNOWN_CLOTH_COMMAND');
 }catch(e){self.postMessage({id:d.id,error:e.message,stack:e.stack});}};

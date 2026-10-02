// CPU only. Decode immutable actual source, no DOM/browser/GPU and no source writes.
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
export const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export async function readLegacySource(){
 const htmlPath=new URL('../../local-r14/dist/KAOPU_FISH_DENSE_HABITAT_R14.html',import.meta.url),source=fs.readFileSync(new URL('../../local-r14/src/instrument.js',import.meta.url),'utf8'),html=fs.readFileSync(htmlPath,'utf8'),match=html.match(/<script id="fishData"[^>]*data-bytes="(\d+)">([^<]+)<\/script>/);
 const alphabet=Array.from({length:94},(_,i)=>String.fromCharCode(33+i)).filter(c=>!['<','>','&',"'",'"','`','\\'].includes(c)).slice(0,85).join(''),map=new Uint8Array(128),out=new Uint8Array(+match[1]);for(let i=0;i<85;i++)map[alphabet.charCodeAt(i)]=i;
 for(let i=0,o=0;i<match[2].length;i+=5,o+=4){let v=0;for(let k=0;k<5;k++)v=v*85+map[match[2].charCodeAt(i+k)];for(let k=3;k>=0;k--){if(o+k<out.length)out[o+k]=v%256;v=Math.floor(v/256);}}
 const context={TextDecoder,TextEncoder,ArrayBuffer,DataView,Uint8Array,Uint16Array,Uint32Array,Int16Array,Float32Array,Float64Array,Blob,Response,DecompressionStream};vm.createContext(context);vm.runInContext(source,context);const h=await context.KaopuFishSchool.build(out);
 return {h,sourceProof:{htmlSha256:sha(html),instrumentSha256:sha(source),carrierSha256:sha(out),vertices:h.positions.length/3,triangles:h.indices.length/3,positionsSha256:sha(h.positions),indicesSha256:sha(h.indices),weightsSha256:sha(h.weights)}};
}
if(process.argv.includes('--dump')){
 const {h,sourceProof}=await readLegacySource(),dir=new URL('../../.cache/legacy-oral-r04/',import.meta.url);fs.mkdirSync(dir,{recursive:true});for(const [name,a] of [['positions',h.positions],['indices',h.indices],['weights',h.weights]])fs.writeFileSync(new URL(name+'.bin',dir),Buffer.from(a.buffer,a.byteOffset,a.byteLength));fs.writeFileSync(new URL('source.json',dir),JSON.stringify({sourceProof,metadata:h.metadata}));
 const bounds=channel=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let positive=0,full=0;for(let i=0;i<h.positions.length/3;i++)if(h.weights[i*12+channel]){positive++;if(h.weights[i*12+channel]===255)full++;for(let k=0;k<3;k++){min[k]=Math.min(min[k],h.positions[i*3+k]);max[k]=Math.max(max[k],h.positions[i*3+k]);}}return {min,max,positive,full};};console.log(JSON.stringify({sourceProof,jaw:bounds(2),gill:bounds(3),metadataJaw:h.metadata.continuum.jaw,metadataGill:h.metadata.continuum.gill}));
}

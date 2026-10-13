import * as THREE from '../full/source/registration-vendor/three.module.js';
/** Same source PNG pixels and sampling; no Canvas2D premultiply/unpremultiply.
 * The source hashes make this a bounded decoder, not a generic image importer. */
const EYE_PNG_SHA256=['6cf688756e0867bcae6ce911b8a6a68e0fad0113998087506e41ca6cc642ba70','ea78bf4b3bae42e463d6f809d7d02321ad768da5e8d16fba034d6067e9fb653e','04112d02ad7df944a083cc8964efd318f9a3a285853878b8b1ce6e30bf933207'];
const RGBA_SHA256=['72e92b530fb910976e22d02ebf0e6630e2ff75bdde757bf588b2b0f92f8b8d06','86f67a61679bf3438de0cc152cca4b3553cba41daceac6810e99d62796c552fd','c9dc71bd634accc720846e0389fb4fbff73a6a129c339771f3b5fcbb07b2adc5'];
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
async function decode(url,i){
 if(!url.startsWith('data:image/png;base64,'))throw Error('Expected embedded pinned eye PNG');const str=atob(url.slice(url.indexOf(',')+1)),bytes=Uint8Array.from(str,c=>c.charCodeAt(0));if(await digest(bytes)!==EYE_PNG_SHA256[i])throw Error('Eye source PNG hash changed');
 const v=new DataView(bytes.buffer);if(v.getUint32(0)!==0x89504e47||v.getUint32(4)!==0x0d0a1a0a)throw Error('Bad PNG signature');let channels=0,ended=false;const chunks=[];
 for(let at=8;at+12<=bytes.length;){const len=v.getUint32(at),type=String.fromCharCode(...bytes.subarray(at+4,at+8)),start=at+8,end=start+len;if(end+4>bytes.length)throw Error('Truncated PNG');if(type==='IHDR'){const color=bytes[start+9];if(len!==13||v.getUint32(start)!==1024||v.getUint32(start+4)!==1024||bytes[start+8]!==8||![2,6].includes(color)||bytes[start+10]||bytes[start+11]||bytes[start+12])throw Error('Unsupported pinned PNG format');channels=color===6?4:3;}else if(type==='IDAT')chunks.push(bytes.subarray(start,end));else if(type==='IEND'){ended=true;break;}at=end+4;}
 if(!ended||!channels||!chunks.length)throw Error('Incomplete eye PNG');const stream=new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate')),raw=new Uint8Array(await new Response(stream).arrayBuffer()),stride=1024*channels;if(raw.length!==(stride+1)*1024)throw Error('Invalid PNG inflation length');const data=new Uint8Array(stride*1024);
 for(let y=0;y<1024;y++){const dst=y*stride,src=y*(stride+1),filter=raw[src];if(filter>4)throw Error('Invalid PNG row filter');for(let x=0;x<stride;x++){const a=x>=channels?data[dst+x-channels]:0,b=y?data[dst-stride+x]:0,c=y&&x>=channels?data[dst-stride+x-channels]:0,p=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);data[dst+x]=(raw[src+1+x]+p)&255;}}
 const rgba=new Uint8Array(1024*1024*4);if(channels===4)rgba.set(data);else for(let p=0;p<1024*1024;p++){rgba.set(data.subarray(p*3,p*3+3),p*4);rgba[p*4+3]=255;}if(await digest(rgba)!==RGBA_SHA256[i])throw Error('Decoded eye pixels differ from independent source proof');return rgba;
}
export function createPackedFallback(){const a=new Uint8Array(3*4);for(let i=0;i<3;i++)a.set([180,178,166,255],i*4);const t=new THREE.DataArrayTexture(a,1,1,3);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;}
export async function createPackedEyeColors(source){
 if(source.length!==3)throw Error('Exactly three eye colour textures required');const w=source[0].image.width,h=source[0].image.height;for(const t of source)if(t.image.width!==w||t.image.height!==h||t.colorSpace!==THREE.SRGBColorSpace||t.flipY!==false||t.wrapS!==THREE.ClampToEdgeWrapping||t.wrapT!==THREE.ClampToEdgeWrapping||t.minFilter!==THREE.LinearMipmapLinearFilter||t.magFilter!==THREE.LinearFilter)throw Error('Eye source sampling contract changed');
 const data=new Uint8Array(w*h*4*3);for(let i=0;i<3;i++)data.set(await decode(source[i].image.src,i),i*w*h*4);
 const texture=new THREE.DataArrayTexture(data,w,h,3);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
 const report={version:'EYE-COLOR-SAMPLER-PACK-2',sources:3,layers:3,width:w,height:h,colorSpace:'sRGB',vesselDataSeparate:true,sourceResized:false,geometryChanged:false,baseBytes:data.byteLength,savedFragmentSamplers:2,allPixelsCopied:true,transparentTexelRGBPreserved:true,sourceSHA256:EYE_PNG_SHA256,decodedRGBASHA256:RGBA_SHA256};
 return {texture,source,report,dispose(){texture.dispose();}};
}

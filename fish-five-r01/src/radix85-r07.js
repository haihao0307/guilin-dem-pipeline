export const RADIX85_ALPHABET=Array.from({length:94},(_,i)=>String.fromCharCode(33+i)).filter(c=>!['<','>','&',"'",'"','`','\\'].includes(c)).slice(0,85).join('');
// Every five safe ASCII characters encode four exact bytes. Yield between
// chunks so even a large standalone source can be cancelled without a UI lock.
export async function decodeRadix85(text,length,signal){
 if(!Number.isSafeInteger(length)||length<=0||text.length!==Math.ceil(length/4)*5)throw Error('离线模型编码长度不符');
 const map=new Int16Array(128).fill(-1),bytes=new Uint8Array(length);for(let i=0;i<85;i++)map[RADIX85_ALPHABET.charCodeAt(i)]=i;
 let out=0;for(let start=0;start<text.length;start+=327680){if(signal?.aborted)throw new DOMException('Selection cancelled','AbortError');const end=Math.min(text.length,start+327680);for(let i=start;i<end;i+=5){let v=0;for(let k=0;k<5;k++){const d=map[text.charCodeAt(i+k)];if(d===undefined||d<0)throw Error('离线模型编码字符不符');v=v*85+d;}if(v>4294967295)throw Error('离线模型编码溢出');for(let k=3;k>=0;k--){if(out+k<length)bytes[out+k]=v%256;v=Math.floor(v/256);}out+=4;}if(end<text.length)await new Promise(resolve=>setTimeout(resolve,0));}return bytes;
}

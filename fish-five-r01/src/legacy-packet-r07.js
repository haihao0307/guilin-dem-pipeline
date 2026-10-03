// FBR7 stores the immutable source package once, without an ASCII copy inside
// another HTML document. Every original sample, texture and program survives.
export function decodeLegacyPacket(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length<16||String.fromCharCode(...bytes.subarray(0,4))!=='FBR7'||view.getUint32(4,true)!==1)throw Error('海狼源数据版本不符');
 const htmlLength=view.getUint32(8,true),scoreLength=view.getUint32(12,true),offset=Math.ceil((16+htmlLength)/8)*8;if(offset+scoreLength!==bytes.length)throw Error('海狼源数据长度不符');
 const html=new TextDecoder().decode(bytes.subarray(16,16+htmlLength));if(html.split('__FISH_PACKET_TOKEN_R07__').length!==2)throw Error('海狼源程序入口缺失');return {html,scoreBytes:bytes.subarray(offset),sourceBytes:scoreLength};
}
const packets=new Map();let sequence=0;
export function stageLegacyPacket(packet){
 const token='r07-'+(++sequence);packets.set(token,packet.scoreBytes);
 globalThis.__FISH_BARRACUDA_PACKETS_R07__={take(key){const bytes=packets.get(key);if(!bytes)throw Error('海狼源参数未就绪');packets.delete(key);return bytes;}};
 return {token,html:packet.html.replace('__FISH_PACKET_TOKEN_R07__',token),release(){packets.delete(token);}};
}

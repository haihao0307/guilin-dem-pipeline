/** Exact approved native outputs. No coordinate rounding, geometry replacement,
 * tolerance, shape parameter change or unknown hash acceptance occurs here.
 * Apple WebKit's independently exported output differs from the original at
 * vertex19758.x only, by one FP32 ULP (1.4210854715202004e-14 metres).
 * Evidence: original native R52 .f32 vs Actions38304595739 Apple ARM output;
 * both repeated restores stable, archive and actual module bytes identical.
 */
export const R52_REFERENCE_SHA='199e277439ac12afdcaa0587e4acbfd28e4fbadd5297d30060cab0d508677b19';
export const R52_ARCHIVE_SHA='bc3fa19166d4793d5a769bb24496da55697a6de71fb2a0eb93dde8bbf3352b9a';
export const R52_APPROVED_OUTPUTS=Object.freeze({
 [R52_REFERENCE_SHA]:'original-native-output',
 '44182e5d09b220db744dc1bcfb6e83e0057e076fce9710b9cdd9fba92d5ce47e':'verified-apple-webkit-one-ulp'
});
export async function sha256(bytes){
 const a=ArrayBuffer.isView(bytes)?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):new Uint8Array(bytes);
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a.slice()))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function sorted(value){if(Array.isArray(value))return value.map(sorted);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));return value;}
export async function verifyR52Archive(bytes){const actual=await sha256(bytes);if(actual!==R52_ARCHIVE_SHA)throw Error('固定 R52 参数文件校验失败：'+actual);return JSON.parse(new TextDecoder().decode(bytes));}
export async function verifyR52Geometry(positions,state,archiveState){
 if(!(positions instanceof Float32Array)||positions.length!==25417*3||!positions.every(Number.isFinite))throw Error('固定 R52 网格格式或有限数校验失败');
 if(JSON.stringify(sorted(state))!==JSON.stringify(sorted(archiveState)))throw Error('实际人物参数与固定 R52 不一致');
 const actualSHA=await sha256(positions),variant=R52_APPROVED_OUTPUTS[actualSHA];
 if(!variant)throw Error('固定 R52 输出未通过校验（'+actualSHA+'）。已停止显示，请保留此错误信息。');
 return Object.freeze({schema:'R52-output-lock/2',actualSHA,referenceSHA:R52_REFERENCE_SHA,variant,exactApprovedHash:true,geometryReplaced:false});
}

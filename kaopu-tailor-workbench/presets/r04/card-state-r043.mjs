/** Display real pipeline state; no synthetic image or clothing fallback. */
export function cardState(id,index,readiness){
 const entry=index.rows?.[id],failure=index.failed?.[id],material=readiness.rows?.[id];
 if(entry)return{kind:entry.qualityPassed?'static-pass':'needs-repair',label:entry.qualityPassed?'静态检查通过':'已算出 · 仍需修复',reason:entry.qualityPassed?'原静态门槛通过，非动态穿着认证。':'完整求解结果仍有自交、开缝或应变问题；点击查看原检查。',hasResult:true};
 if(index.checkpoints?.[id])return{kind:'solve-aborted',label:'中间状态 · 未完成',reason:failure?.reason||'保留真实有限坐标供检查；不是完成的成衣。',hasResult:false,hasCheckpoint:true};
 if(failure){const phase=failure.phase||'';const limited=/material|preflight/.test(phase);return{kind:limited?'material-blocked':'solve-aborted',label:limited?'材料 / 缝边受限':'求解已中止',reason:failure.reason||'该款没有完整求解结果；不是缩略图仍在下载。',phase,hasResult:false};}
 if(material?.status==='native-material-rejected')return{kind:'material-blocked',label:'材料网格受限',reason:material.reason||'原材料检查未通过。',hasResult:false};
 return{kind:'not-computed',label:'尚未完成缝合计算',reason:'原纸样可读取；当前没有可展示的完整求解记录。',hasResult:false};
}
export function matchesQuality(state,filter){return filter==='all'||filter==='no-result'&&!state.hasResult||state.kind===filter;}
export function summarizeCards(rows,index,readiness){const result={all:rows.length,'static-pass':0,'needs-repair':0,'no-result':0};for(const row of rows){const s=cardState(row.id,index,readiness);if(s.hasResult)result[s.kind]++;else result['no-result']++;}return result;}

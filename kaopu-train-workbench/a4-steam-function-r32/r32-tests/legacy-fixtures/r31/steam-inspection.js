/* Whole-object anatomical status only. No second clock, pressure solver or part viewer. */
(function(root){'use strict';
const stateNames={connected_candidate:'候选实体已连接',open_break:'明确未接通',unverified:'资料或验证待补',missing:'尚缺接口'};
function inspection(theta,installation){
 const C=root.DYNAMIC?.steamPathCandidate;
 if(!C)return {mode:installation.mode,installed:false,theta,knownBreaks:['主汽连接候选尚未安装'],wholeSteamNetworkComplete:false};
 const details=installation.mode==='candidate'&&typeof C.inspection==='function'?C.inspection(theta,installation):{};
 return { ...details,installed:true,theta,mode:installation.mode,wholeSteamNetworkComplete:false,physicalPressureSimulation:false,historicalValveEventsVerified:false };
}
function update(theta,installation){
 const element=document.getElementById('steam-path-state');if(!element)return;
 const count=document.getElementById('steam-count');if(count&&root.SCENE&&root.DYNAMIC)count.textContent=String(root.SCENE.parts.filter(p=>root.DYNAMIC.visible(p,{mode:'candidate',beta:installation.beta})).length);
 const report=inspection(theta,installation);root.STEAM_INSPECTION.last=report;
 const C=root.DYNAMIC?.steamPathCandidate;
 if(installation.mode==='baseline'){element.textContent='当前保留原基线：不增加主汽管或汽口。切到同一整车候选可检查新增连接；历史失败与未接接口仍保留。';return;}
 const lines=[`同一 Time · theta ${theta.toFixed(4)} rad；中缸安装 ${(installation.beta*180/Math.PI).toFixed(3)}°。`];
 if(!C){lines.push('主汽连接候选尚未安装，不报告连通。');}
 else{
  const entries=Array.isArray(C.status)?C.status:Array.isArray(C.graph?.edges)?C.graph.edges:[];
  const connections=entries.filter(row=>row.state==='connected_candidate');
  const pending=entries.filter(row=>row.state==='unverified');
  lines.push(`已建候选连接 ${connections.length} 条；配汽或安装待证关系 ${pending.length} 条。数量只描述当前几何，不是汽流验证。`);
  if(entries.length<4)for(const row of entries)lines.push(`${row.label||row.id}: ${stateNames[row.state]||row.state||'待独立核验'}${row.reason?'；'+row.reason:''}`);
  const chambers=report.workingChambers||[];
  if(chambers.length)lines.push('缸端几何腔长（随活塞，不是压力）：'+chambers.map(q=>`${({left:'左',middle:'中',right:'右'})[q.side]||q.side} 后 ${((q.rearRange[1]-q.rearRange[0])*1000).toFixed(1)} / 前 ${((q.frontRange[1]-q.frontRange[0])*1000).toFixed(1)} mm`).join('；'));
  const breaks=report.knownBreaks||C.knownBreaks||[];
  if(breaks.length)lines.push('明确断点：'+(breaks.length>3?'上游取汽 / 调节与锅内主汽管；过热元件去回路；内部排汽汇合与双喷口分配':breaks.map(x=>typeof x==='string'?x:x.label||x.id).join('；')));
 }
 lines.push('工作腔随现有活塞同相位改变；不另造时钟，不把几何容积当真实汽压或配汽事件。');element.textContent=lines.join('\n');
}
root.STEAM_INSPECTION={inspection,update,last:null};
if(root.RESEARCH_UI){const old=root.RESEARCH_UI.showRendered;root.RESEARCH_UI.showRendered=function(theta,installation,appearance){old.call(this,theta,installation,appearance);update(theta,installation);};}
})(typeof globalThis!=='undefined'?globalThis:this);

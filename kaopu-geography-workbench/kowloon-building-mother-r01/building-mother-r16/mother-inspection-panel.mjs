export function readInspectionDimensions(search=''){
 const q=new URLSearchParams(search),wall=Number(q.get('wall')??.14),glass=Number(q.get('glass')??.006);
 if(![.12,.14,.18].includes(wall)||![.006,.009].includes(glass))throw Error('Unknown inspection parameter');
 return{wallThickness:wall,windowFrameDepth:wall,windowGlassThickness:glass};
}
export function showCoverage(element,model){
 const m=model.buildingMother,a=m.retainedRelations,c=a?.counts;
 element.textContent=(model.caseId==='lowrise'?'R13实接：墙剖切实体封口；凹轮廓分区修复及全层采样通达；3组源窗联动继续保留，仍为2层。':'保留原有主楼生成器与用途检查；龍總独立平面保留门槛/洞口，普通门扇暂不表达，未配准真实壳；仓库未伪造装卸口。')+'\n'+(a?`现有模型：${a.retainedDesignFloorCount} 个设计层节点，${a.stairs.length} 个梯连接，${a.lifts.length} 个电梯接口；${c.columns} 柱、${c.beams} 梁、${c.openingChains} 条完整门窗归属链。`:'源平面独立候选。')+'\n'+(model.caseId==='kcc'?'已观察22层平面：每层3梯、2条梯路、6户入口；6楼例外保留。实际楼壳配准未完成。':model.caseId==='warehouse'?'保留2个地下设计节点、2个裙楼设计节点和12个上部节点；这不是实测全楼层数。原货运接口未证实设备与停层。':'实际室内标高、户型、柱梁仍未核准；三组窗为源面投影范围，不是实测净尺寸。')+'\n检查色：梯段/平台浅紫，扶手深灰蓝。所有原外形和尺度保持，不将学习草图尺寸套入实楼。';
}
export function bindInspectionPanel({host,dimensions,onFocus}){
 const title=document.createElement('h3');title.textContent='低层楼联动验证（设计参数，非实测）';host.append(title);
 const p=document.createElement('p');p.textContent='墙厚同时驱动墙体、洞口与框深；玻璃厚度独立。切换会从原始种子重新生成三栋，同页保留原照片证据。';host.append(p);
 for(const [key,label,values]of[['wall','墙厚 / 框深',[.12,.14,.18]],['glass','玻璃厚度',[.006,.009]]]){const l=document.createElement('label');l.textContent=label;const select=document.createElement('select');select.id='inspection-'+key;for(const v of values){const o=document.createElement('option');o.value=v;o.textContent=v+' m';o.selected=v===dimensions[key==='wall'?'wallThickness':'windowGlassThickness'];select.append(o);}select.onchange=()=>{const u=new URL(location.href);u.searchParams.set(key,select.value);u.searchParams.set('focus','windows');location.assign(u);};l.append(select);host.append(l);}
 const b=document.createElement('button');b.id='inspect-source-windows';b.textContent='定位北面3组观察窗（其他面见上表）';b.onclick=onFocus;host.append(b);
}

export function showUsage(element,model){const u=model.usageRelations;if(!u){element.textContent='用途与通道未登记';return;}element.textContent=u.useLabel+'\n'+u.keyCaution+'\n'+u.floorUseEvidence.map(f=>f.statement).join('\n')+'\n'+u.entranceRoles.map(e=>e.label).join('\n')+'\n门位、净尺寸、前后向与人员/货物流线均须证据匹配；未核角色不生成实楼门。';}

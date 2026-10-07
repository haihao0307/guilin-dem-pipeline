import{exportCommon}from'../src/CommonExports.mjs';
import{groupTitle}from'./catalog.mjs';
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const sourceName={gnm:'GNM',anny:'Anny',mhr:'MHR',body:'当前身体骨架',rig:'当前骨架',expression:'当前表情源'};
const ownerName={rig:'骨架与姿态',headRig:'头颈动作',expression:'面部表情',headShape:'头部形状',gaze:'眼部驱动'};
const sourceUnit=row=>({'gnm.identity':'原生 PCA 系数','gnm.expression':'原生表情系数','gnm.rotation':'轴角向量 · rad','gnm.translation':'GNM 原生 XYZ · m','anny.pose':'旋转向量 · ° · local-ref','anny.translations':'骨局部平移 · m','anny.phenotypes':'原生形态值','anny.localChanges':'原生局部系数','anny.facialActions':'原生面部动作','mhr.identity':'原生 PCA 系数','mhr.pose':'原生混合单位 · 不换算','mhr.expression':'原生表情系数'}[row.group]||row.unit||'原生值');
const browserWindow=row=>row.bounds||(row.group.includes('translation')?[-.1,.1]:row.group==='gnm.rotation'?[-Math.PI,Math.PI]:[-3,3]);
export function mountPanel(root,controller,{screenshot}={}){
 let active=true,frame=0,query='',source='all',group='anny.phenotypes';const queued=new Map(),rowNodes=new Map(),urls=new Set();
 root.replaceChildren();root.classList.add('full-parameter-panel');
 const top=el('div','panel-top'),heading=el('div','panel-heading'),headingText=el('strong','','共同模型参数'),count=el('span','muted');heading.append(headingText,count);top.append(heading);
 const owners=el('div','owner-grid'),ownerControls=new Map();
 function addOwner(key,config,reserved=false){const label=el('label','owner-field',ownerName[key]||key),select=el('select');select.dataset.owner=key;for(const value of [...new Set([...(config.values||[]),...(config.plannedValues||[])])]){const option=el('option','',sourceName[value]||value);option.value=value;option.disabled=reserved||!config.values.includes(value);if(option.disabled)option.textContent+=' · 待接';select.append(option);}select.disabled=reserved;select.title=reserved?'该来源字段尚未启用，不能影响模型':config.meaning;label.append(select);ownerControls.set(key,{select,reserved,config});return label;}
 for(const[key,config]of Object.entries(controller.catalog.contract.currentOwners))owners.append(addOwner(key,config));top.append(owners);
 const pending=el('details','pending-sources'),pendingTitle=el('summary','','头形与凝视来源 · 待接'),pendingGrid=el('div','owner-grid');for(const[key,config]of Object.entries(controller.catalog.contract.reservedOwnersNotYetCallable))pendingGrid.append(addOwner(key,config,true));pending.append(pendingTitle,pendingGrid,el('p','muted','只有已接入的来源能改变当前模型；灰色项保留真实缺口。'));if(Object.keys(controller.catalog.contract.reservedOwnersNotYetCallable).length)top.append(pending);else{pending.replaceChildren(el('summary','','实验边界'),el('p','muted','婴儿/新生耳部适配仍未验收，牙列尚未做成长适配；极端表情可能穿插。MHR eyesLook 是眼周几何场，没有独立眼球旋转参数。皮肤和毛发仍独立。'));top.append(pending);}
 const sourceTabs=el('div','source-tabs');sourceTabs.setAttribute('aria-label','筛选教师参数');for(const value of ['all','gnm','anny','mhr']){const b=el('button','source-tab',value==='all'?'全部':sourceName[value]);b.type='button';b.dataset.source=value;b.setAttribute('aria-pressed',String(value===source));sourceTabs.append(b);}top.append(sourceTabs);
 const search=el('input','parameter-search');search.type='search';search.placeholder='搜索参数、骨骼名或编号';search.setAttribute('aria-label','搜索全部原生参数');top.append(search);
 const categories=el('select','group-select');categories.setAttribute('aria-label','参数分类');const all=el('option','','所有分类');all.value='';categories.append(all);for(const g of controller.catalog.groups){const option=el('option','',g.title+' · '+controller.catalog.rows.filter(r=>r.group===g.id).length);option.value=g.id;categories.append(option);}const interfaces=el('option','','其他接口与待接范围');interfaces.value='__interfaces';categories.append(interfaces);const exportsOption=el('option','','导出当前共同人物');exportsOption.value='__exports';categories.append(exportsOption);categories.value=group;top.append(categories);
 const groupInfo=el('p','group-info'),actions=el('div','group-actions'),resetGroup=el('button','','重置此分类'),resetSource=el('button','','重置此教师');resetGroup.type=resetSource.type='button';resetGroup.dataset.action='reset-group';resetSource.dataset.action='reset-source';actions.append(resetGroup,resetSource);top.append(groupInfo,actions);
 const list=el('div','parameter-scroll');list.tabIndex=0;list.setAttribute('aria-label','可独立滚动的参数列表');
 const bottom=el('div','panel-bottom'),status=el('div','edit-status','同一模型已载入'),archiveActions=el('div','archive-actions');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 for(const[action,label]of[['save','保存档案'],['load','恢复档案'],['reset-all','全部默认']]){const b=el('button','',label);b.type='button';b.dataset.action=action;archiveActions.append(b);}const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='common-profile-file';bottom.append(status,archiveActions,file);root.append(top,list,bottom);
 const report=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error);};
 const clearQueue=()=>{cancelAnimationFrame(frame);frame=0;queued.clear();};
 const flush=()=>{frame=0;if(!active)return;const values=[...queued];queued.clear();try{for(const[key,value]of values)controller.set(key,value);report(values.some(([key])=>!controller.status(controller.catalog.byKey.get(key)).active)?'配置已保存；非当前来源的值不会改变网格':'已更新同一个模型');}catch(e){report(e.message,true);sync();}};
 const queue=(row,value)=>{queued.set(row.key,value);if(!frame)frame=requestAnimationFrame(flush);};
 function addRow(row){
  const item=el('div','parameter-row');item.dataset.parameter=row.key;const title=el('div','parameter-label'),label=el('label','',row.label),badge=el('span','state-badge');title.append(label,badge);item.append(title);
  const hint=el('div','parameter-hint',sourceName[row.source]+' · '+sourceUnit(row));item.append(hint);const control=el('div','parameter-control');let range,number,toggle;
  if(row.kind==='boolean'){toggle=el('input');toggle.type='checkbox';toggle.id='param-'+row.key.replace(/[^a-zA-Z0-9]/g,'-');toggle.dataset.parameterInput=row.key;label.htmlFor=toggle.id;control.append(toggle);}
  else{
   const bounds=browserWindow(row);range=el('input','parameter-range');range.type='range';range.min=bounds[0];range.max=bounds[1];range.step='any';range.setAttribute('aria-label',row.label+(row.bounds?'，原生范围':'，浏览窗口范围'));range.dataset.parameterInput=row.key;
   number=el('input','parameter-number');number.type='number';number.step='any';number.inputMode='decimal';number.id='param-'+row.key.replace(/[^a-zA-Z0-9]/g,'-');number.dataset.parameterInput=row.key;label.htmlFor=number.id;
   if(row.bounds){number.min=row.bounds[0];number.max=row.bounds[1];}control.append(range,number);const reset=el('button','parameter-reset','↺');reset.type='button';reset.dataset.resetParameter=row.key;reset.title='重置 '+row.label;reset.setAttribute('aria-label',reset.title);control.append(reset);
  }
  item.append(control);const reason=el('div','parameter-reason');item.append(reason);
  if(row.group==='anny.phenotypes'&&row.nativeLabel==='age'){const anchors=el('div','age-anchors');for(const a of controller.catalog.groups.find(g=>g.id===row.group).ageAnchors){const title={newborn:'新生',baby:'婴儿',child:'儿童',young:'青年',old:'老年'}[a.label];const b=el('button','',title);b.type='button';b.dataset.ageAnchor=String(a.value);b.title=a.label+' · '+a.value;anchors.append(b);}item.append(anchors);}
  rowNodes.set(row.key,{item,row,range,number,toggle,badge,reason});return item;
 }
 function download(data,mime,name){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type:mime}));urls.add(url);const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);}
 function renderRows(){
  if(group==='__exports'){rowNodes.clear();list.replaceChildren();const note=el('p','muted','导出当前共同网格和当前姿态。GLB/USD 保留骨架并按原 MHR 网页约定取每顶点最强 4 权重；后续原生参数动画需在本台恢复档案再计算。完整权重 JSON 另存，皮肤/毛发不在本次导出。');list.append(note);for(const[format,label]of[['obj','OBJ 当前几何'],['glb','GLB 当前姿态与骨架'],['usda','USD 当前姿态与骨架'],['snapshot','完整权重与参数 JSON'],['png','当前视图 PNG']]){const row=el('div','interface-row'),b=el('button','',label);b.type='button';b.dataset.exportFormat=format;row.append(b);list.append(row);}count.textContent='当前姿态快照';groupInfo.textContent='参数档案可完整恢复原生驱动；通用格式不是原求值器的替代品。';resetGroup.disabled=resetSource.disabled=true;return;}
  if(group==='__interfaces'){
   rowNodes.clear();list.replaceChildren();const descriptions={
    'Anny per-bone translation':['Anny · 每骨平移','104 × 3 原生平移分量；眼骨由眼部驱动决定，非当前来源只保存。','anny.translations'],
    'GNM eye/teeth/mouth components':['GNM · 眼、牙齿与口腔','保留当前原生结构；跨教师内部解剖对应尚未全部验证。'],
    'MHR nonlinear correctives':['MHR · 非线性修正','身体驱动使用原生 MLP；只有 MHR 接管骨架时生效。','mhr.correctives'],
    'MHR 7 LOD views':['MHR · 7 级 LOD','共同模型保持固定拓扑；额外预览与导出策略待接。'],
    'Anny alternative rig/topology and independent parts':['Anny · 其他骨架与独立部件','需要独立对应和验收；不能通过换一张教师网格冒充共同模型。'],
    'Face R02 photos/video fitting':['照片与视频拟合','现有独立功能尚未接入此共同模型；这里不提供假按钮。'],
    'Face R02 Groom hair/brows/lashes':['头发、眉毛与睫毛','固定顶点对应与形变跟随仍待接入。'],
    'Skin/S3-Face':['皮肤与 S3-Face','皮肤仍是独立实验，不表示已实现 S3-Face 等效推理。'],
    'Clothing':['服装','独立工作台；不计作本页已完成的共同人体功能。']
   };
   for(const item of controller.catalog.contract.additionalInterfaces||[]){const text=descriptions[item.name]||[item.name,item.status],box=el('div','interface-row');box.append(el('strong','',text[0]),el('p','muted',text[1]));const button=el('button','',text[2]?'查看实际参数':'待接入 / 待验收');button.type='button';button.disabled=!text[2];if(text[2])button.dataset.openGroup=text[2];box.append(button);list.append(box);}count.textContent=(controller.catalog.contract.additionalInterfaces||[]).length+' 类接口';groupInfo.textContent='这是完整性清单；禁用项仍是未完成工作，不计入可用功能。';resetGroup.disabled=resetSource.disabled=true;return;
  }
  rowNodes.clear();const q=query.toLowerCase(),rows=controller.catalog.rows.filter(r=>(source==='all'||r.source===source)&&(!group||r.group===group)&&(!q||[r.label,r.nativeLabel,r.key,groupTitle(r.group)].join(' ').toLowerCase().includes(q)));
  const fragment=document.createDocumentFragment();for(const row of rows)fragment.append(addRow(row));if(!rows.length)fragment.append(el('p','empty-parameters','没有匹配的参数'));list.replaceChildren(fragment);list.scrollTop=0;count.textContent=rows.length+' 项';
  const g=controller.catalog.groups.find(g=>g.id===group);groupInfo.textContent=g?.id==='anny.translations'?'额外 104 骨 × 3 个平移分量，未计入 1596 标量目录。':g&&controller.catalog.rows.some(r=>r.group===group&&!r.bounds&&r.kind!=='boolean')?'滑条只是浏览窗口，不是官方硬限；数值框保留原生未限定范围。':'按原生名称、单位与范围显示；1596 项目录不等于全部验收。';resetGroup.disabled=!group;resetSource.disabled=source==='all';sync();
 }
 function sync(){
  if(!active)return;const state=controller.state();for(const[key,{select,reserved,config}]of ownerControls)select.value=reserved?config.default:state.owners[key];
  for(const n of rowNodes.values()){
   const s=controller.status(n.row),value=controller.value(n.row);n.item.dataset.parameterState=s.kind;n.badge.textContent=s.label;n.reason.textContent=s.reason;
   if(n.toggle){n.toggle.checked=value;n.toggle.disabled=!s.editable;}
   if(n.number){if(document.activeElement!==n.number)n.number.value=String(value);n.number.disabled=!s.editable;n.number.title=sourceUnit(n.row)+' · '+String(value);n.range.disabled=!s.editable;n.range.value=String(value);n.range.title=n.row.bounds?'原生范围 '+n.row.bounds.join(' … '):'浏览窗口 '+n.range.min+' … '+n.range.max+'；超出窗口可直接输入';n.item.querySelector('[data-reset-parameter]').disabled=!s.editable;}
  }
  root.dataset.revision=String(controller.revision);root.dispatchEvent(new CustomEvent('workbench-panel-state',{detail:{owners:state.owners,summary:controller.summary()}}));
 }
 const onInput=e=>{const key=e.target.dataset.parameterInput;if(!key)return;const row=controller.catalog.byKey.get(key);if(e.target.type==='range'){const value=Number(e.target.value),n=rowNodes.get(key);n.number.value=String(value);queue(row,value);}};
 const onChange=e=>{try{if(e.target.dataset.owner){flush();controller.setOwner(e.target.dataset.owner,e.target.value);report('已切换来源；各教师保存值保留');return;}const key=e.target.dataset.parameterInput;if(key){clearQueue();if(e.target.type==='number'&&e.target.value.trim()==='')throw Error('请输入有限数值');controller.set(key,e.target.type==='checkbox'?e.target.checked:Number(e.target.value));report(controller.status(controller.catalog.byKey.get(key)).active?'已更新同一个模型':'配置已保存，当前来源不生效');}}catch(error){report(error.message,true);sync();}};
 const onClick=async e=>{const button=e.target.closest('button');if(!button||button.disabled)return;try{
  if(button.dataset.exportFormat){clearQueue();const format=button.dataset.exportFormat;if(format==='png'){const blob=await screenshot();if(active)download(blob,'image/png','common-person-view.png');}else{const out=exportCommon(controller.model,format);download(out.data,out.mime,out.filename);report('已导出当前共同姿态；最强 4 权重的最大省略比例 '+(100*out.weightReduction.maxOmittedFraction).toFixed(2)+'%');}return;}
  if(button.dataset.openGroup){group=button.dataset.openGroup;categories.value=group;query=search.value='';source=controller.catalog.groups.find(g=>g.id===group).source;for(const b of sourceTabs.children)b.setAttribute('aria-pressed',String(b.dataset.source===source));renderRows();return;}
  if(button.dataset.source){source=button.dataset.source;for(const b of sourceTabs.children)b.setAttribute('aria-pressed',String(b.dataset.source===source));group=source==='all'?'anny.phenotypes':controller.catalog.groups.find(g=>g.source===source).id;categories.value=group;query=search.value='';renderRows();return;}
  if(button.dataset.resetParameter){clearQueue();const row=controller.catalog.byKey.get(button.dataset.resetParameter);controller.set(row.key,row.defaultValue);report('参数已复位');return;}
  if(button.dataset.ageAnchor!==undefined){clearQueue();controller.set('anny.phenotypes:age',Number(button.dataset.ageAnchor));report('年龄锚点已按同一原生数值更新');return;}
  const action=button.dataset.action;if(!action)return;clearQueue();
  if(action==='reset-group')controller.resetGroup(group);if(action==='reset-source')controller.resetSource(source);if(action==='reset-all')controller.resetAll();
  if(action==='load'){file.value='';file.click();return;}
  if(action==='save'){const url=URL.createObjectURL(new Blob([JSON.stringify(controller.archive(),null,2)],{type:'application/json'}));urls.add(url);const a=el('a');a.href=url;a.download='common-person-archive.json';a.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);report('已导出全部配置，包括非活动来源');return;}report('已恢复默认值');
 }catch(error){report(error.message,true);sync();}};
 const onFile=async()=>{const selected=file.files?.[0];if(!selected)return;try{if(selected.size>10*1024*1024)throw Error('档案过大');const data=JSON.parse(await selected.text());if(!active)return;clearQueue();controller.restore(data);report('已恢复同一拓扑档案；未选中的来源仍只保存');}catch(e){if(active)report('恢复失败：'+e.message,true);}};
 const onSearch=()=>{query=search.value;if(query){group='';categories.value='';}renderRows();};const onCategory=()=>{group=categories.value;if(group&&group!=='__interfaces'&&group!=='__exports'){source=controller.catalog.groups.find(g=>g.id===group).source;for(const b of sourceTabs.children)b.setAttribute('aria-pressed',String(b.dataset.source===source));}renderRows();};
 root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('click',onClick);search.addEventListener('input',onSearch);categories.addEventListener('change',onCategory);file.addEventListener('change',onFile);controller.addEventListener('change',sync);renderRows();
 return {sync,report,renderRows,destroy(){active=false;clearQueue();for(const url of urls)URL.revokeObjectURL(url);urls.clear();root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.removeEventListener('click',onClick);search.removeEventListener('input',onSearch);categories.removeEventListener('change',onCategory);file.removeEventListener('change',onFile);controller.removeEventListener('change',sync);root.replaceChildren();}};
}

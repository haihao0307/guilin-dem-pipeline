const names={
 'gnm.identity':'GNM · 头部形状','gnm.expression':'GNM · 原生表情','gnm.rotation':'GNM · 头颈与眼球姿态','gnm.translation':'GNM · 头部平移',
 'anny.phenotypes':'Anny · 整体体型','anny.localChanges':'Anny · 局部形态','anny.facialActions':'Anny · 52 面部动作','anny.pose':'Anny · 骨骼旋转','anny.translations':'Anny · 骨骼平移',
 'mhr.identity':'MHR · 45 身份轴','mhr.pose':'MHR · 骨架与姿态','mhr.expression':'MHR · 72 表情','mhr.correctives':'MHR · 非线性修正'
};
const phenotypeNames={gender:'性别形态',age:'年龄形态',muscle:'肌肉形态',weight:'体重形态',height:'身高形态',proportions:'身体比例',cupsize:'胸部体积',firmness:'胸部紧实形态',african:'Anny african 原生形态轴',asian:'Anny asian 原生形态轴',caucasian:'Anny caucasian 原生形态轴'};
const axis=['X','Y','Z'];
export function buildCatalog(contract){
 const groups=contract.parameterGroups.map(group=>({...group,title:names[group.id]||group.id,source:group.id.split('.')[0]}));
 const rows=[];
 for(const group of groups){
  const add=(key,path,label,extra={})=>rows.push({key:group.id+':'+key,group:group.id,source:group.source,path,label,nativeLabel:String(key),unit:group.unit||'',defaultValue:group.default??0,catalogScalar:group.id!=='anny.translations'&&group.type!=='boolean',...extra});
  const path=group.id.split('.');
  if(group.type==='boolean'){add('enabled',path,'启用原生非线性修正',{kind:'boolean',defaultValue:true});continue;}
  if(group.type==='bone-vectors-object'){
   for(const bone of group.labels)for(let i=0;i<3;i++)add(bone+'.'+axis[i],[...path,bone,i],bone+' · '+axis[i],{bone,axis:i,nativeLabel:bone,bounds:group.bounds,defaultValue:0});
  }else if(group.type==='sparse-object'){
   for(const label of group.labels)add(label,[...path,label],phenotypeNames[label]||label,{nativeLabel:label,bounds:label==='age'?group.ageBounds:group.bounds,defaultValue:label==='age'?2/3:group.id==='anny.phenotypes'?.5:0});
  }else{
   for(let i=0;i<group.count;i++){
    let label=group.labels?.[i]||String(i+1).padStart(3,'0');
    if(group.id==='gnm.rotation')label=group.joints[Math.floor(i/3)]+' · '+axis[i%3];
    if(group.id==='gnm.translation')label=axis[i];
    add(i,[...path,i],label,{index:i,bounds:group.boundsByIndex?.[i]||group.bounds,locked:group.lockedIndices?.includes(i)||false,nativeLabel:group.labels?.[i]||label});
   }
  }
 }
 if(rows.filter(r=>r.catalogScalar).length!==1603)throw Error('Unexpected native parameter catalog size');
 if(rows.filter(r=>r.locked).length!==37)throw Error('Unexpected MHR native lock count');
 return {groups,rows,byKey:new Map(rows.map(r=>[r.key,r])),contract};
}
export function valueAt(state,row){let node=state;for(const key of row.path){node=node?.[key];if(node===undefined)return row.defaultValue;}return node;}
export function writeValue(state,row,value){
 if(row.kind==='boolean'){if(typeof value!=='boolean')throw Error('需要布尔值');}
 else{if(!Number.isFinite(value))throw Error('需要有限数值');if(row.bounds&&(value<row.bounds[0]||value>row.bounds[1]))throw Error('超出原生范围 '+row.bounds.join(' … '));}
 let node=state;for(let i=0;i<row.path.length-1;i++){const key=row.path[i];if(node[key]===undefined)node[key]=typeof row.path[i+1]==='number'?[0,0,0]:{};node=node[key];}node[row.path.at(-1)]=value;
 return state;
}
export function rowStatus(row,state,{localGate,modelReady=true,bodyDriver=true,semanticHead=false}={}){
 if(row.group==='anny.localChanges'&&row.nativeLabel==='nipple-point-incr')return{editable:false,active:false,kind:'native-null',label:'原拓扑无影响',reason:'官方 Anny 固定拓扑已裁去此目标的全部顶点，原骨缓存也为零；保留目录与档案值，不伪造形变'};
 if(row.locked)return {editable:false,active:false,kind:'locked',label:'原生锁定',reason:'官方通道范围为 0；保留目录位置，不开放调节'};
 if(!modelReady)return {editable:false,active:false,kind:'loading',label:'待加载',reason:'同一模型载入后可用'};
 if(!semanticHead&&['anny.facialActions','mhr.expression'].includes(row.group))return {editable:false,active:false,kind:'pending',label:'映射待验证',reason:'参数会保存在档案中；当前未转入同一头部，不产生形变'};
 if(!semanticHead&&['anny.pose','anny.translations'].includes(row.group)&&['eye.L','eye.R'].includes(row.bone))return {editable:false,active:false,kind:'pending',label:'眼球映射待接',reason:'原生眼骨尚未接入共同眼球；不能用头骨代替'};
 if(row.group==='anny.localChanges'){
  const gate=localGate?.[row.nativeLabel];
  if(!gate||gate.enabled===false)return {editable:false,active:false,kind:'pending',label:'部位校核中',reason:gate?.reason||'正在依据真实源形变区分身体与头部支持，不按名字猜测映射'};
 }
 if(row.source==='mhr'&&!bodyDriver)return {editable:false,active:false,kind:'pending',label:'身体驱动待加载',reason:'当前模型未装配 MHR 身体适配器'};
 const shared=state.headShapeComposition==='shared-layers/1';
 let active=true,reason='当前共同模型生效',label;
 if(row.group==='gnm.identity')active=shared||state.owners.headShape==='gnm';
 if(row.group==='gnm.expression')active=state.owners.expression==='gnm';
 if(row.group==='anny.facialActions')active=state.owners.expression==='anny'&&(!row.nativeLabel.startsWith('eyeLook')||state.owners.gaze==='expression');
 if(row.group==='mhr.expression')active=state.owners.expression==='mhr'&&(!row.nativeLabel.startsWith('eyesLook')||state.owners.gaze==='expression');
 if(row.group==='anny.localChanges'&&localGate[row.nativeLabel]?.headOnly)active=shared||state.owners.headShape==='anny';
 if(['gnm.rotation','gnm.translation'].includes(row.group))active=semanticHead&&row.group==='gnm.rotation'&&row.index>=6?state.owners.gaze==='gnm':state.owners.headRig==='gnm';
 if(['anny.pose','anny.translations'].includes(row.group)){
  active=state.owners.rig==='anny';
  if((/^neck\d+$/.test(row.bone)||row.bone==='head')&&state.owners.headRig==='gnm')active=false;
  if(['eye.L','eye.R'].includes(row.bone))active=state.owners.rig==='anny'&&state.owners.gaze==='rig';
 }
 if(['mhr.pose','mhr.correctives'].includes(row.group))active=state.owners.rig==='mhr';
 if(row.group==='mhr.pose'&&row.index>=24&&row.index<=29&&state.owners.headRig==='gnm')active=false;
 if(!active)reason='数值可以保存；当前来源没有接管此部位，因此不会影响网格';
 if(!active&&row.group==='mhr.pose')reason=state.owners.rig!=='mhr'?'选择「骨架与姿态：MHR」使此原生参数驱动当前人物':'选择「头颈动作：当前身体骨架」使用 MHR 头颈；GNM 表情仍可同时保留';
 if(!active&&row.group==='anny.localChanges'&&localGate?.[row.nativeLabel]?.headOnly)reason='选择「头部形状：共同叠加」让此原生头部形态与 GNM 一同生效；旧档数值已保留';
 if(['anny.phenotypes','mhr.identity'].includes(row.group)&&active){reason=shared?'源形态同时作用身体与可见头部；GNM身份与表情保留，跨源适配仍需视觉检查':'旧单源模式：共同身体形态生效，头部细部由头形来源决定';label=shared?'身体 + 头部':'共同身体';}
 if(row.group==='anny.localChanges'&&active){const gate=localGate[row.nativeLabel];reason=shared?'原生局部形变进入同一人物，含其头部范围':gate.reason;label=gate.headOnly?'头部生效':gate.partial&&!shared&&state.owners.headShape!=='anny'?'身体部分生效':'当前生效';}
 if(row.group==='mhr.expression'&&row.nativeLabel.startsWith('eyesLook')&&active)reason='原生眼缘/眼周形变；MHR此接口没有独立虹膜、瞳孔或眼球转角';
 if(row.group==='anny.phenotypes'&&['cupsize','firmness'].includes(row.nativeLabel))reason+='；原源按性别与年龄条件生效；男性与婴儿配置可为零';
 if(row.group==='anny.phenotypes'&&['african','asian','caucasian'].includes(row.nativeLabel))reason+='；三个原生形态权重共同归一化，全0按原模型回退均分';
 return {editable:true,active,kind:active?'active':'inactive',label:label||(active?'当前生效':'仅保存'),reason};
}
export const groupTitle=id=>names[id]||id;

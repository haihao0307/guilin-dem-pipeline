const names={
 'gnm.identity':'GNM · 头部形状','gnm.expression':'GNM · 原生表情','gnm.rotation':'GNM · 头颈与眼球姿态','gnm.translation':'GNM · 头部平移',
 'anny.phenotypes':'Anny · 整体体型','anny.localChanges':'Anny · 局部形态','anny.facialActions':'Anny · 52 面部动作','anny.pose':'Anny · 骨骼旋转','anny.translations':'Anny · 骨骼平移',
 'mhr.identity':'MHR · 45 身份轴','mhr.pose':'MHR · 骨架与姿态','mhr.expression':'MHR · 72 表情','mhr.correctives':'MHR · 非线性修正'
};
const phenotypeNames={gender:'性别形态',age:'年龄形态',muscle:'肌肉形态',weight:'体重形态',height:'身高形态',proportions:'身体比例'};
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
 if(rows.filter(r=>r.catalogScalar).length!==1596)throw Error('Unexpected native parameter catalog size');
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
export function rowStatus(row,state,{localGate,modelReady=true,bodyDriver=true}={}){
 if(row.locked)return {editable:false,active:false,kind:'locked',label:'原生锁定',reason:'官方通道范围为 0；保留目录位置，不开放调节'};
 if(!modelReady)return {editable:false,active:false,kind:'loading',label:'待加载',reason:'同一模型载入后可用'};
 if(['anny.facialActions','mhr.expression'].includes(row.group))return {editable:false,active:false,kind:'pending',label:'映射待验证',reason:'参数会保存在档案中；当前未转入同一头部，不产生形变'};
 if(['anny.pose','anny.translations'].includes(row.group)&&['eye.L','eye.R'].includes(row.bone))return {editable:false,active:false,kind:'pending',label:'眼球映射待接',reason:'原生眼骨尚未接入共同眼球；不能用头骨代替'};
 if(row.group==='anny.localChanges'){
  const gate=localGate?.[row.nativeLabel];
  if(!gate||gate.enabled===false)return {editable:false,active:false,kind:'pending',label:'部位校核中',reason:gate?.reason||'正在依据真实源形变区分身体与头部支持，不按名字猜测映射'};
 }
 if(row.source==='mhr'&&!bodyDriver)return {editable:false,active:false,kind:'pending',label:'身体驱动待加载',reason:'当前模型未装配 MHR 身体适配器'};
 let active=true,reason='当前共同模型生效',label;
 if(row.group==='gnm.expression')active=state.owners.expression==='gnm';
 if(['gnm.rotation','gnm.translation'].includes(row.group))active=state.owners.headRig==='gnm';
 if(['anny.pose','anny.translations'].includes(row.group)){
  active=state.owners.rig==='anny';
  if((/^neck\d+$/.test(row.bone)||row.bone==='head')&&state.owners.headRig==='gnm')active=false;
 }
 if(['mhr.pose','mhr.correctives'].includes(row.group))active=state.owners.rig==='mhr';
 if(row.group==='mhr.pose'&&row.index>=24&&row.index<=29&&state.owners.headRig==='gnm')active=false;
 if(!active)reason='数值可以保存；当前来源没有接管此部位，因此不会影响网格';
 if(['anny.phenotypes','mhr.identity'].includes(row.group)&&active){reason='已连接身体；跨教师头形转移仍单独校核，不能据身体变化宣称脸部已接通';label='身体生效';}
 if(row.group==='anny.localChanges'&&active){const gate=localGate[row.nativeLabel];reason=gate.reason;label=gate.partial?'身体部分生效':'身体生效';}
 return {editable:true,active,kind:active?'active':'inactive',label:label||(active?'当前生效':'仅保存'),reason};
}
export const groupTitle=id=>names[id]||id;

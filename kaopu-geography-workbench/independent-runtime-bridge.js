/* New independent cases only. The seven R17 scene files and runtime remain unchanged. */
(()=>{
'use strict';
const cases=window.KaopuIndependentCases||{},byName=new Map(Object.entries(cases).map(([key,value])=>[SCENES[key].name,{key,...value}]));
const $=id=>document.getElementById(id),detail=$('detail'),name=$('sceneName'),source=$('sourceText'),identity=$('identity'),teacherState=$('teacherState');
const sourceDetails=$('sourceDetails'),baseParagraphs=[...sourceDetails.querySelectorAll('p')].filter(p=>p!==source),teacherHeading=$('teacherPanel').querySelector('h2'),baseHeading=teacherHeading.textContent;
const extra=document.createElement('p');extra.id='independentSceneDetails';extra.hidden=true;sourceDetails.append(extra);const initialized=new Set();
function setText(node,text){if(node.textContent!==text)node.textContent=text;}
function sync(){
 const meta=!detail.hidden?byName.get(name.textContent):null;
 for(const p of baseParagraphs)p.hidden=!!meta;
 extra.hidden=!meta;
 if(!meta){setText(teacherHeading,baseHeading);return;}
 if(!initialized.has(meta.key)){
  initialized.add(meta.key);$('quality').value=String(meta.defaultWidth||720);$('quality').dispatchEvent(new Event('change',{bubbles:true}));
 }
 setText(identity,'GPU 实时计算 · KAOPU 独立学习案例 · 无外部贴图 / 视频');
 setText(source,meta.description);
 setText(extra,'形体、程序材质、镜头与动画为独立实现，参考原作仅用于方法学习。不是老师原码或原图复刻；没有物理流体、通用碰撞或实测尺寸声明。');
 setText(teacherHeading,meta.shortName+' · 自有帧预览');
 setText(teacherState,'预览来自本案例实际渲染；可自行选取本机学习录屏，不控制主场景时间。');
}
const observer=new MutationObserver(sync);
observer.observe(name,{childList:true,subtree:true});observer.observe(detail,{attributes:true,attributeFilter:['hidden']});observer.observe(source,{childList:true});observer.observe(identity,{childList:true});observer.observe(teacherState,{childList:true});
sync();
})();

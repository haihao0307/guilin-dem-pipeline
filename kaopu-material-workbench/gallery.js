'use strict';
(()=>{
const cases=[
 ['wet','01','Wet Stone','湿石、水膜与苔层','原案例'],['iq','02','IQ 岩石','云母颗粒与平滑裁切','已锚定'],
 ['volcanic','03','火山岩','多层噪声形成的孔洞','已锚定'],['analytic','04','解析石头','解析法线与细密岩面','已锚定'],
 ['05','05','云状石灰','噪声映射为云状色阶','材质练习'],['06','06','脏污混合','深浅斑块与遮罩混合','材质练习'],
 ['07','07','晶格矿物','细胞分区与颗粒边缘','材质练习'],['08','08','层理岩','扭曲波纹形成层理','材质练习'],
 ['09','09','磨损金属','划痕、粗糙度与反光','材质练习'],['10','10','方向风化','方向渐变与噪声显色','材质练习']
];
const $=id=>document.getElementById(id),rigKey='KAOPU_MATERIAL_SHARED_RIG_R18';
let active=null,frame=null,sharedRig=null,lastCard=null;
try{
 sharedRig=JSON.parse(localStorage.getItem(rigKey)||'null');
 if(!sharedRig){const saved=JSON.parse(localStorage.getItem('KAOPU_MATERIAL_R16')||'null');if(saved?.version===16&&saved.rig)sharedRig=saved.rig;}
 if(!sharedRig){const saved=JSON.parse(localStorage.getItem('KAOPU_MATERIAL_STUDIES_R01')||'null');if(saved?.version==='study-r01'&&saved.rig)sharedRig=saved.rig;}
}catch{}
function storeRig(r){sharedRig=JSON.parse(JSON.stringify(r));try{localStorage.setItem(rigKey,JSON.stringify(sharedRig));}catch{}}
function runtime(){try{return frame?.contentWindow?.KAOPU_STUDIO||frame?.contentWindow?.KAOPU_STUDIES;}catch{return null;}}
function closeFrame(){const api=runtime();if(api?.ready){storeRig(api.getState().rig);api.flushSave?.();}frame?.remove();frame=null;}
function address(id,push){const url=new URL(location.href);url.searchParams.delete('v');if(id)url.searchParams.set('case',id);else url.searchParams.delete('case');if(push)history.pushState({case:id},'',url);}
function show(id,push=true){
 const item=cases.find(x=>x[0]===id);closeFrame();active=item?.[0]||null;
 $('overview').hidden=!!active;$('caseView').hidden=!active;document.body.classList.toggle('viewing',!!active);address(active,push);
 if(!item){document.title='KAOPU 材质工作台 · 图形总台';lastCard?.focus({preventScroll:true});return;}
 $('viewerTitle').textContent=item[1]+' / '+item[2];document.title=item[1]+' '+item[2]+' · KAOPU 材质工作台';$('viewerStatus').textContent='正在载入实时材质…';
 frame=document.createElement('iframe');frame.id='caseFrame';frame.title=item[1]+' '+item[2]+' 完整材质控制室';frame.allow='fullscreen';frame.setAttribute('allowfullscreen','');
 frame.src=(['wet','iq','volcanic','analytic'].includes(id)?'anchors-r16.html':'study-r01/index.html')+'?case='+id+'&embedded=1&v=20261007';
 $('frameHost').append(frame);$('backToOverview').focus({preventScroll:true});window.scrollTo(0,0);
}
for(const [id,n,title,description,type] of cases){const b=document.createElement('button');b.type='button';b.className='caseCard';b.dataset.case=id;b.setAttribute('aria-label',n+' '+title+'，进入工作台');b.innerHTML=`<img src="thumbnails/${id}.png" alt="${title}实际渲染" width="552" height="423" loading="${n<='04'?'eager':'lazy'}"><span class="cardText"><span class="cardNumber">${n} / ${type}</span><strong>${title}</strong><p>${description}</p><span class="enter">打开工作台 ↗</span></span>`;b.onclick=()=>{lastCard=b;show(id);};$('caseGrid').append(b);}
window.addEventListener('message',e=>{if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin)return;const m=e.data;if(!m||m.type!=='kaopu-viewer')return;if(m.action==='ready'){if(sharedRig)frame.contentWindow.postMessage({type:'kaopu-host',action:'rig',rig:sharedRig},location.origin);else storeRig(m.rig);$('viewerStatus').textContent='实时渲染 · 共用双灯';}if(m.action==='rig')storeRig(m.rig);if(m.action==='height')frame.style.height=Math.max(400,m.height)+'px';if(m.action==='overview')show(null);if(m.action==='error')$('viewerStatus').textContent=m.message;});
$('backToOverview').onclick=()=>show(null);window.addEventListener('popstate',()=>show(new URLSearchParams(location.search).get('case'),false));
window.KAOPU_GALLERY={version:'20261007',cases:cases.map(c=>({id:c[0],number:c[1],title:c[2]})),show,back:()=>show(null),getState:()=>({active,sharedRig}),runtime};
show(new URLSearchParams(location.search).get('case'),false);
})();

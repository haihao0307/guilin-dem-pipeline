'use strict';
const items=[
 {src:'./assets/exterior-wide-r02.png',title:'R02 / 01 · 横版门头构图提案',alt:'向两侧延展、保持中央门头完整的横版外景概念提案'},
 {src:'./assets/interior-layout-r02.png',title:'R02 / 02 · 室内布局试案',alt:'调整办公室、成年秘书、保安朝向与总控座位的室内布局试案'},
 {src:'./assets/HONG_KONG_GENERAL_LOST_FOUND_OFFICE_AD1911_ACCEPTED.png',title:'00 / 已确认门头与构图',alt:'HONG KONG GENERAL LOST & FOUND OFFICE A.D.1911 黑白门头原图'},
 {src:'./assets/interior-core-r01.png',title:'01 / 室内核心场景 · 概念图',alt:'老局室内与传送带核心场景概念图'},
 {src:'./assets/tea-newspaper-r01.png',title:'02 / 茶与报纸 · 概念图',alt:'茶杯与报纸的开场近景概念图'},
 {src:'./assets/deadpan-chaos-r01.png',title:'03 / 冷面混乱 · 概念图',alt:'冷面角色、枪战、蛇与包裹堆积并行的概念图'}
];
const dialog=document.getElementById('lightbox'),img=document.getElementById('viewer-image');let current=0,opener=null;
function show(i){current=(i+items.length)%items.length;const item=items[current];img.src=item.src;img.alt=item.alt;document.getElementById('viewer-title').textContent=item.title;document.getElementById('viewer-count').textContent=String(current+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');document.getElementById('original-link').href=item.src;}
document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{opener=button;show(Number(button.dataset.image));dialog.showModal();document.body.style.overflow='hidden';}));
document.getElementById('close-viewer').addEventListener('click',()=>dialog.close());document.getElementById('previous').addEventListener('click',()=>show(current-1));document.getElementById('next').addEventListener('click',()=>show(current+1));
dialog.addEventListener('close',()=>{document.body.style.overflow='';opener?.focus({preventScroll:true});});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();show(current+1)}if(e.key==='ArrowLeft'){e.preventDefault();show(current-1)}});

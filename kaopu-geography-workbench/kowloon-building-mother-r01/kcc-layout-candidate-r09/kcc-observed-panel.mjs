import{selectObserved,KCC_ID}from'./kcc-observed-layout.mjs';
const NS='http://www.w3.org/2000/svg';
export function createObservedPanel({element,getBuilding,onInspect=()=>{}}){
 let selectedFloor=5,caseId=null,selectedId=null;
 const el=(tag,txt)=>{const e=document.createElement(tag);if(txt)e.textContent=txt;return e;};
 const svg=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
 function selectNode(id){const layout=selectObserved(getBuilding('kcc'),selectedFloor);const n=layout?.nodes.find(n=>n.id===id);if(!n)return;selectedId=id;const detail={node:n,relations:layout.edges.filter(e=>e.from===id||e.to===id),worldPlacement:'未核准，不冒充已落位',sourceUrl:layout.sourceUrl};element.querySelector('[data-observed-detail]').textContent=JSON.stringify(detail,null,2);onInspect(detail);for(const g of element.querySelectorAll('[data-observed-node]'))g.setAttribute('stroke',g.dataset.observedNode===id?'#345b8e':'#697681');}
 function refresh(){element.replaceChildren();element.hidden=caseId!=='kcc';if(element.hidden)return;const layout=selectObserved(getBuilding('kcc'),selectedFloor);element.append(el('h3','龍總 · 已核对平面布局'));
 const note=el('p','这是原平面坐标的待定位布局，不是已装入外壳的三维实况。外壳高度不变；3 梯、两侧梯路、6 户入口已有证据。');note.className='warning';element.append(note);
 const select=el('select');select.dataset.observedFloor='true';for(let f=4;f<=27;f++){const o=el('option',`${f}/F${f===4||f===27?' · 缺已核对平面':''}`);o.value=f;o.selected=f===selectedFloor;select.append(o);}select.onchange=()=>{selectedFloor=Number(select.value);selectedId=null;refresh();};element.append(select);
 if(!layout?.supported){element.append(el('p',layout?.reason??'未绑定'));return;}
 const a=el('a',`查看 ${layout.family==='lower'?'5–17':'18–26'}/F 原平面 ↗`);a.href=layout.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';element.append(a);
 const drawing=svg('svg',{viewBox:'140 150 1080 760',role:'img','aria-label':`${selectedFloor}楼已观察布局，未配准`});drawing.style.cssText='display:block;width:100%;background:#f3f4f2;margin:12px 0;';
 const colors={dwelling:'#e6e2d5',lift_interface:'#d2e1e6',lobby:'#e5eadc',meter_room:'#e6ddce',sixth_floor_platform:'#d7e7dc'};
 for(const n of layout.nodes.filter(n=>n.polygon)){
 const g=svg('g',{'data-observed-node':n.id,tabindex:0,role:'button','aria-label':n.label??n.type,stroke:'#697681'});g.style.cursor='pointer';g.append(svg('polygon',{points:n.polygon.map(p=>p.join(',')).join(' '),fill:colors[n.type]??'#ddd','stroke-width':2}));
 const xs=n.polygon.map(p=>p[0]),ys=n.polygon.map(p=>p[1]);const label=svg('text',{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,'font-size':n.type==='dwelling'?24:15,'text-anchor':'middle',stroke:'none',fill:'#354454'});label.textContent=n.label??({lift_interface:'电梯',lobby:'大堂',meter_room:'电表',sixth_floor_platform:'6楼平台'})[n.type]??'';g.append(label);g.onclick=()=>selectNode(n.id);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id);}};drawing.append(g);}
 drawing.append(svg('polygon',{points:layout.stairEnvelope.map(p=>p.join(',')).join(' '),fill:'#ddd9e8',stroke:'#697681','stroke-width':2}));
 for(const n of layout.nodes.filter(n=>['entry_door','stair_route_entry'].includes(n.type))){const g=svg('g',{'data-observed-node':n.id,tabindex:0,role:'button','aria-label':n.type,stroke:'#697681'});g.style.cursor='pointer';g.append(svg('circle',{cx:n.point[0],cy:n.point[1],r:10,fill:n.type==='entry_door'?'#b9cbd9':'#c0b8d1','stroke-width':2}));g.onclick=()=>selectNode(n.id);g.onkeydown=e=>{if(e.key==='Enter'){selectNode(n.id);}};drawing.append(g);}
 element.append(drawing,el('p',`${selectedFloor}/F · 淡蓝：电梯；淡紫：梯路；圆点：入口。点击查看归属和连接。${selectedFloor===6?' 本层显示六楼平台。':' 不把六楼平台复制到本层。'}`));
 const detail=el('pre','选择一个构件查看证据关系。');detail.dataset.observedDetail='true';detail.style.cssText='white-space:pre-wrap;max-height:260px;overflow:auto';element.append(detail);if(selectedId)selectNode(selectedId);
 }
 return{selectCase(id){caseId=id;refresh();},refresh,selectNode,snapshot(){return{caseId,selectedFloor,selectedId,registration:'unresolved',worldGeometryEnabled:false};}};
}

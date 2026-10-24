import {WAREHOUSE_CANDIDATES} from './warehouse-observed-candidates.mjs';
import {OFFICIAL_FACE_TEXTURES} from './official-face-textures.mjs';
import {createOfficialTextureView} from './official-texture-view.mjs';
/** Evidence inventory, never infer absence from a blank rendered face. */
export function openingFaceInventory(building){
 const model=building.localModel??building,caseId=building.caseId??model.caseId;
 const records=model.hostedComponents?.records??[];
 const rows=[];
 if(caseId==='lowrise'){
  const north=records.filter(r=>r.role==='source_supported_design_proposal');
  const east=records.filter(r=>r.role==='observed_glazed_group_static_representation');
  rows.push({face:'北侧源面 p120',sourcePatchId:'p120',status:'observed',count:north.length,label:`${north.length} 组观察窗：已接设计墙洞与框玻璃；真实净尺寸、开启方式和室内层位未核。`});
  rows.push({face:'东侧源面 p112 / p113 / p114',sourcePatchId:'p112',status:'observed_glazed_group',count:east.length,label:`${east.length} 组已观察玻璃开口：保留原静态分格；窗或门类型、下边界及室内墙洞关系未完全核准。`});
  rows.push({face:'其他立面 / 底层 / 遮挡区域',sourcePatchId:null,status:'unknown',count:null,label:'逐窗位置与洞口类型未完成核对；未生成不等于没有窗，不用重复窗补满。'});
 } else rows.push({face:caseId==='kcc'?'龍總各外立面':'仓库各外立面',sourcePatchId:null,status:'unknown',count:null,label:caseId==='kcc'?'源标准层平面已接入每类4处明确侧窗，见下方独立三维候选；真实楼壳尚未配准，全栋外窗总数未知，未把设备和暗带认成窗。':'人员门、货物门、装卸口与窗分别待证；不把每个矩形构件当窗或货车入口。'});
 return{caseId,rows,absenceInferred:false,actualDimensionsVerified:false};
}
export function showOpeningEvidence(element,building,onSelectFace){
 element.replaceChildren();const h=document.createElement('h3');h.textContent='各面窗 / 开口证据';element.append(h);
 const inv=openingFaceInventory(building);for(const row of inv.rows){const p=document.createElement('p');p.textContent=row.face+'：'+row.label;element.append(p);if(row.sourcePatchId){const b=document.createElement('button');b.textContent='定位 '+row.face;b.dataset.openingFace=row.sourcePatchId;b.onclick=()=>onSelectFace(row.sourcePatchId);element.append(b);}}
 if(inv.caseId==='warehouse')showWarehouseCandidates(element,onSelectFace);
 if(inv.caseId==='kcc'){const a=document.createElement('a');a.href='https://www.hk01.com/article/60279717';a.textContent='龍總真实外窗照片来源（外链，不是本模型已配准照片）';a.target='_blank';a.rel='noopener';element.append(a);}
 const p=document.createElement('p');p.className='warning';p.textContent='洞顶支承：已有门窗墙头仅作为设计支承候选；不能看见墙头就宣称过梁已结构验算。入口 / 龍總 2.10 m、低楼室内 2.15 m 是既有暂定门洞参数，不是香港统一门扇高或实楼测量。';element.append(p);
 const head=building.localModel?.openingHeadRelations;if(head){const s=document.createElement('p');s.textContent='洞顶关系登记：'+(head.relations?.length??0)+' 项；洞口、墙头与本层上界共享同一标高基准，未知承重方式明确保留。';element.append(s);}
}

function showWarehouseCandidates(element,onSelectFace){
 const d=OFFICIAL_FACE_TEXTURES.cases.warehouse.faces.find(x=>x.sourcePatchId==='p012');
 const box=document.createElement('div');box.id='warehouseCandidateEvidence';element.append(box);
 const select=c=>{onSelectFace(c.sourcePatchId);box.replaceChildren();const title=document.createElement('p');title.textContent=c.id+' · p012 下缘矩形网格构件候选，不认定为窗或穿墙洞';box.append(title);const svg=createOfficialTextureView(d);svg.setAttribute('viewBox','100 650 800 90');svg.style.maxHeight='220px';const NS='http://www.w3.org/2000/svg';for(const q of WAREHOUSE_CANDIDATES){const [x,y,x1,y1]=q.atlasBBoxXYXY,r=document.createElementNS(NS,'rect');for(const[k,v]of Object.entries({x:x-d.atlasCropXYXY[0],y:y-d.atlasCropXYXY[1],width:x1-x,height:y1-y,fill:'none',stroke:q.id===c.id?'#bc6b3b':'#4c8290','stroke-width':q.id===c.id?3:1.5}))r.setAttribute(k,v);svg.append(r);}box.append(svg);const note=document.createElement('p');note.textContent='原始政府模型图集实像素，框为观察标记。3D定位目前精确到宿主源面；没有把像素框猜成源面内部米制开洞。用途、玻璃、框扇、墙穿透和洞顶支承均待核。';box.append(note);const pre=document.createElement('pre');pre.textContent=JSON.stringify({id:c.id,belongsTo:c.ownerId,atlasBBoxXYXY:c.atlasBBoxXYXY,classification:c.classification,wallCut:false,windowEmitter:false},null,2);box.append(pre);};
 for(const [i,c]of WAREHOUSE_CANDIDATES.entries()){const b=document.createElement('button');b.dataset.warehouseCandidate=c.id;b.textContent='候选 '+(i+1)+' · 定位源面与原图';b.onclick=()=>select(c);element.insertBefore(b,box);}
}

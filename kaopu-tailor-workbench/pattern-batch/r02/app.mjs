import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let report,rows=[],current,packet,cloth,threads,body,serial=0,category='全部',query='',showBody=true,insideMode=false,showSeams=true,fullBody=false,view='three',bodyData;
const cache=new Map(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.005,25);
const qualityLabels={'cloth-intersections':'布面穿插','tension-over-15pct':'局部拉伸超限','compression-over-15pct':'局部挤皱超限','needle-gap-over-0.25mm':'针脚间隙待处理','whole-seam-separation-over-0.25mm':'接缝间隙待处理','whole-seam-audit-unresolved':'部分接缝待复核'};
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=.06;controls.maxDistance=6;
scene.add(new THREE.HemisphereLight(0xf7f9ef,0x6b7467,2.1));
const key=new THREE.DirectionalLight(0xfff1d7,3.1);key.position.set(-2.4,3.7,3.6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1.5;key.shadow.camera.right=1.5;key.shadow.camera.top=2.6;key.shadow.camera.bottom=-.4;key.shadow.normalBias=.001;scene.add(key);
const fill=new THREE.DirectionalLight(0xd6e5ff,1.35);fill.position.set(2.8,1.8,-2.4);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.ShadowMaterial({opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
const observer=new ResizeObserver(()=>{const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()});observer.observe($('viewport'));
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
function toast(s){$('toast').textContent=s;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,4500)}
async function readJSON(url){const r=await fetch(url);if(!r.ok)throw Error('读取失败：'+url);if(String(url).endsWith('.gz')){const stream=r.body.pipeThrough(new DecompressionStream('gzip'));return new Response(stream).json()}return r.json()}
async function readPacket(row){if(cache.has(row.id))return cache.get(row.id);const r=await fetch('./data/'+row.file);if(!r.ok)throw Error('这款三维结果尚未生成');const bytes=await r.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==row.sha256)throw Error('三维结果版本不匹配');const p=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();cache.set(row.id,p);if(cache.size>6)cache.delete(cache.keys().next().value);return p}
function pointsOf(p){if(p.record)return p.record.positionsMm;const a=p.checkpoint?.positionsM;if(!a)throw Error('没有可显示的缝制结果');return Array.from({length:a.length/3},(_,i)=>a.slice(i*3,i*3+3).map(x=>x*1000))}
function release(object){if(!object)return;scene.remove(object);object.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())})}
function makeCloth(p){const points=pointsOf(p),verts=Float32Array.from(points.flat().map(x=>x/1000)),faces=[],colors=[];let offset=0;
 for(const panel of p.spec.panels){for(const t of panel.triangles)faces.push(...t.map(i=>i+offset));for(let i=0;i<panel.uvMm.length;i++)colors.push(.82,.79,.66);offset+=panel.uvMm.length}
 if(points.length!==offset)throw Error('裁片与三维坐标数量不匹配');
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(verts,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(faces);geometry.computeVertexNormals();geometry.computeBoundingBox();
 const material=new THREE.MeshStandardMaterial({color:0xe6dfc8,roughness:.85,metalness:0,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.sourcePositionsMm=points;mesh.userData.sourceSpec=p.spec;return mesh;
}
function makeThreads(p,mesh){const coords=mesh.geometry.attributes.position.array,normals=mesh.geometry.attributes.normal.array,offsets=new Map();let off=0;for(const panel of p.spec.panels){offsets.set(panel.id,off);off+=panel.uvMm.length}
 const panels=new Map(p.spec.panels.map(p=>[p.id,p])),verts=[];let rowCount=0;
 for(const seam of p.spec.seams){
  if(!seam.isInternalReinforcement)continue;
  const panel=panels.get(seam.a.panelId),ids=panel.edges[seam.a.edge],offset=offsets.get(panel.id);rowCount++;
  let traveled=0;
  for(let i=0;i<ids.length-1;i++){
   const a=offset+ids[i],b=offset+ids[i+1],A=new THREE.Vector3().fromArray(coords,a*3),B=new THREE.Vector3().fromArray(coords,b*3),length=A.distanceTo(B);if(length<1e-8)continue;
   const na=new THREE.Vector3().fromArray(normals,a*3),nb=new THREE.Vector3().fromArray(normals,b*3);
   // Draw on the material's inward side; endpoints follow actual solved cloth.
   if(na.dot(new THREE.Vector3(A.x,0,A.z))>0)na.negate();if(nb.dot(new THREE.Vector3(B.x,0,B.z))>0)nb.negate();A.addScaledVector(na,.00035);B.addScaledVector(nb,.00035);
   const pitch=.0042,dash=.0026;let local=0;
   while(local<length){const phase=(traveled+local)%pitch,advance=Math.min(length-local,(phase<dash?dash:pitch)-phase+1e-10);if(phase<dash){const x=A.clone().lerp(B,local/length),y=A.clone().lerp(B,(local+advance)/length);verts.push(...x.toArray(),...y.toArray())}local+=advance}
   traveled+=length;
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x355346,transparent:true,opacity:.9,depthTest:true}));lines.userData.rowCount=rowCount;return lines;
}
function fit(direction=view){if(!cloth)return;const box=new THREE.Box3().setFromObject(cloth);if(fullBody&&body)box.union(new THREE.Box3().setFromObject(body));const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const vectors={front:[0,.08,1],back:[0,.08,-1],side:[1,.08,0],three:[.85,.28,1.3]},dir=new THREE.Vector3(...vectors[direction]).normalize(),distance=Math.max(size.y,size.x/camera.aspect,size.z)*.64/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));camera.position.copy(center).addScaledVector(dir,Math.max(.25,distance));controls.target.copy(center);controls.update();camera.updateProjectionMatrix();
 view=direction;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}
function setToggles(){if(body)body.visible=showBody&&!insideMode;if(cloth)cloth.material.side=insideMode?THREE.BackSide:THREE.DoubleSide;if(threads)threads.visible=showSeams;
 for(const [id,value]of [['body-toggle',showBody],['inside-toggle',insideMode],['seams-toggle',showSeams],['focus-toggle',fullBody]]){$(id).classList.toggle('active',value);$(id).setAttribute('aria-pressed',String(value))}
 $('mode-label').textContent=insideMode?'内侧补强车缝线':'裁片缝合三维试样';
}
function renderCards(){const list=rows.filter(r=>(category==='全部'||r.category===category)&&(!query||`${r.id} ${r.name}`.toLowerCase().includes(query.toLowerCase())));$('style-count').textContent=list.length+' 款';
 $('cards').innerHTML=list.map(r=>`<button class="card ${current?.id===r.id?'selected':''}" data-id="${r.id}" aria-label="查看${esc(r.name)}三维服装">${r.thumbnail?`<img src="${r.thumbnail}" alt="${esc(r.name)}真实三维渲染" loading="lazy">`:'<div class="placeholder">三维缝制结果</div>'}<div class="card-copy"><strong>${esc(r.name)}</strong><small><span>${r.id}</span><em>${r.complete?'已缝制':r.has3D?'待完成试样':'待缝制'}</em></small></div></button>`).join('');
 document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category===category));
}
async function select(id){const row=rows.find(r=>r.id===id);if(!row)throw Error('Unknown garment');const token=++serial;$('loading').hidden=false;$('loading').textContent='读取 '+row.name+'…';
 try{const data=await readPacket(row);if(token!==serial)return;release(cloth);release(threads);packet=data;current=row;cloth=makeCloth(data);scene.add(cloth);threads=makeThreads(data,cloth);scene.add(threads);setToggles();fit();
 $('title').textContent=row.name;$('category-name').textContent=`${row.id} / ${row.category}`;$('state').textContent=row.complete?(row.staticPassed?'三维试样 · 静态检查通过':'三维试样 · 仍有待修项'):'缝制中间试样 · 待修复';
 const source=JSON.parse(JSON.stringify(data.spec.source.internalReinforcement||{}));$('description').textContent='由对应的原二维裁片网格，按原接缝与工序缝合形成。';$('construction').textContent=`${data.spec.panels.length} 块裁片 · ${source.primarySeams||0} 组原接缝 · ${source.reinforcedSeams||0} 条内侧补强车缝线`;
 const failures=data.record?.staticGate?.failures||[];$('quality').textContent=`${row.complete?'缝制流程已运行完成。':'当前保留有限中间状态，尚未完成成衣。'}${failures.length?'仍有'+failures.map(x=>qualityLabels[x]||x).join('、')+'，检查未通过。':data.error?'当前缝制尚有未解决的问题。':'三维结果需继续做材料和动态验收。'} 补强排距在新增缝份内按窄角自适应，原净纸样不缩放；第二排缝合约束参与实际求解。抗撕裂强度尚未经过实物标定。`;
 $('paper-link').href=`../r01/版型总览.html#${id}`;renderCards();history.replaceState(null,'','#'+id);$('loading').hidden=true;$('toast').hidden=true;
 }catch(error){if(token===serial){$('loading').textContent=error.message;toast(error.message)}throw error}
}
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function objText(p){let text=`# ${p.id} - exact source sewing result in metres; not a fit certificate\n`,offset=0;const positions=pointsOf(p),offsets=new Map(),panels=new Map(p.spec.panels.map(x=>[x.id,x]));for(const v of positions)text+='v '+v.map(x=>(x/1000).toPrecision(12)).join(' ')+'\n';for(const panel of p.spec.panels){offsets.set(panel.id,offset);text+='g '+panel.id+'\n';for(const t of panel.triangles)text+='f '+t.map(i=>i+offset+1).join(' ')+'\n';offset+=panel.uvMm.length}for(const seam of p.spec.seams){if(!seam.isInternalReinforcement)continue;const ref=seam.a;text+='g inner_stitch_'+seam.id+'\n'+'l '+panels.get(ref.panelId).edges[ref.edge].map(i=>i+offsets.get(ref.panelId)+1).join(' ')+'\n'}return text}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>fit(b.dataset.view));
$('body-toggle').onclick=()=>{showBody=!showBody;setToggles()};$('inside-toggle').onclick=()=>{insideMode=!insideMode;setToggles()};$('seams-toggle').onclick=()=>{showSeams=!showSeams;setToggles()};$('focus-toggle').onclick=()=>{fullBody=!fullBody;setToggles();fit()};
$('search').oninput=e=>{query=e.target.value;renderCards()};$('categories').onclick=e=>{const b=e.target.closest('button');if(b){category=b.dataset.category;renderCards()}};$('cards').onclick=e=>{const b=e.target.closest('[data-id]');if(b)select(b.dataset.id).catch(()=>{})};
$('export-obj').onclick=()=>{if(packet)download(objText(packet),`${current.id}-${current.name}.obj`,'text/plain')};$('export-record').onclick=()=>{if(packet)download(JSON.stringify(packet),`${current.id}-sewing-record.json`,'application/json')};
async function init(){
 [report,bodyData]=await Promise.all([readJSON('./data/BATCH_REPORT.json'),readJSON('./backend/assets/common-body.json')]);rows=report.rows;
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(bodyData.positionsMm.flat().map(x=>x/1000),3));geo.setIndex(bodyData.triangles.flat());geo.computeVertexNormals();body=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x70796d,roughness:.9}));body.castShadow=body.receiveShadow=true;scene.add(body);
 $('categories').innerHTML=['全部','上装','裤装','半裙','连衣裙','连体裤'].map(c=>`<button data-category="${c}">${c}</button>`).join('');$('batch-status').textContent=`${report.has3DCount} / 60 款三维结果`;renderCards();
 window.KAOPU3DBatch={select,getState:()=>({id:current?.id,complete:current?.complete,sourceVertices:cloth?.geometry.attributes.position.count,sourceTriangles:cloth?.geometry.index.count/3,reinforcedRows:threads?.userData.rowCount,bodyVisible:body?.visible,insideMode,sourceSHA256:current?.sha256}),getReport:()=>structuredClone(report),setView:fit,
  captureThumbnail:async(id)=>{await select(id);insideMode=false;showBody=true;fullBody=false;setToggles();const ratio=renderer.getPixelRatio(),size=renderer.getSize(new THREE.Vector2());renderer.setPixelRatio(1);renderer.setSize(360,430,false);camera.aspect=360/430;camera.updateProjectionMatrix();fit('three');renderer.render(scene,camera);const data=renderer.domElement.toDataURL('image/png');renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);camera.aspect=size.x/size.y;camera.updateProjectionMatrix();fit('three');return data},getBounds:()=>({cloth:new THREE.Box3().setFromObject(cloth).getSize(new THREE.Vector3()).toArray()}),renderer};
 const initial=decodeURIComponent(location.hash.slice(1));await select(rows.some(r=>r.id===initial)?initial:rows.find(r=>r.complete)?.id||rows[0].id);
}
init().catch(e=>{console.error(e);$('loading').textContent=e.message;toast(e.message)});

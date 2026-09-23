import * as THREE from 'three';
// Display overlays retain complete source vertex/skin fields, with selected face indices only.
export function installSurfaceRegions(ctx){
 const {meshes,state,qa,applyDisplay,scenes,cam,controls,preset,originals}=ctx;
 const $=s=>document.querySelector(s),data=JSON.parse($('#surfaceRegions').textContent);$('#surfaceRegions').remove();
 const selection={id:'all',isolate:false,seams:false,axial:false};let helpers=[];
 const panel=document.createElement('div');panel.className='section';panel.id='regionPanel';
 panel.innerHTML=`<h2>01B　源表面分区 · R005</h2><p class="sub">先沿原始连接关系拆读，不切掉数据，不凭骨名决定解剖。</p><select id="regionSelect" class="w100" aria-label="源表面分区"><option value="all">全鱼 · 17 个候选分区</option></select><div class="row"><button id="regionIsolate">单独观察</button><button id="regionFocus">放大部位</button></div><div class="row"><button id="regionSeams">连接边界</button><button id="regionClear">恢复全鱼</button></div><p class="sub" id="regionInfo">所有 7,944 个原始三角形都有唯一归属；命名仍待核准。</p><select id="sectionScope" class="w100" aria-label="截面范围"><option value="all">截面：全部源表面</option><option value="axial">截面：头部外表面 + 轴向躯干</option></select><p class="sub" id="scopeInfo">切换轴体范围后排除独立鳍面、鳍条带、眼球、角膜及口腔内表面。尺寸仍为归一单位。</p><details><summary>证据与未解问题</summary><pre id="regionEvidence"></pre></details>`;
 $('#canonicalPanel').after(panel);
 for(const p of data.parts){const o=document.createElement('option');o.value=p.id;o.textContent=p.label+' · '+p.sourceTriangles.length+' 面';$('#regionSelect').appendChild(o);}
 const seamLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x74ffb9,depthTest:false,transparent:true,opacity:.95}));seamLines.frustumCulled=false;seamLines.renderOrder=25;seamLines.visible=false;scenes[1].add(seamLines);
 const gapLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xff8e55,depthTest:false}));gapLines.frustumCulled=false;gapLines.renderOrder=26;gapLines.visible=false;scenes[1].add(gapLines);
 function setLines(object,values){object.geometry.dispose();object.geometry=new THREE.BufferGeometry();object.geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));}
 function part(){return data.parts.find(p=>p.id===selection.id);}
 function disposeHelpers(){helpers.forEach(m=>{m.removeFromParent();m.geometry.dispose();});helpers=[];}
 function buildHelpers(){disposeHelpers();const p=part();if(!p)return;const source=meshes[1][p.mesh],g=new THREE.BufferGeometry();for(const [k,a]of Object.entries(source.geometry.attributes))g.setAttribute(k,a);g.setIndex(p.sourceTriangles.flatMap(f=>Array.from(source.geometry.index.array.subarray(f*3,f*3+3))));
  const helper=new THREE.SkinnedMesh(g,source.material);helper.name='R005_DisplayOnly_'+p.id;helper.matrixAutoUpdate=false;helper.matrix.copy(source.matrix);helper.frustumCulled=false;source.parent.add(helper);helper.updateMatrixWorld(true);helper.bind(source.skeleton,source.bindMatrix);helper.bindMode=source.bindMode;helper.userData.region=p.id;helper.userData.sourceMesh=p.mesh;helpers.push(helper);
 }
 function colorPart(){const p=part();if(!p)return;state.heat=true;state.joint=-1;$('#jointSelect').value='-1';$('#groupSelect').value='-1';const cold=new THREE.Color(0x183c48),hot=new THREE.Color(0xff773b);meshes[1].forEach((m,mi)=>{const c=m.geometry.attributes.color,hit=new Set(mi===p.mesh?p.sourceVertices:[]);for(let i=0;i<c.count;i++){const v=hit.has(i)?hot:cold;c.setXYZ(i,v.r,v.g,v.b);}c.needsUpdate=true;});}
 function choose(id){if(id!=='all'&&!data.parts.some(p=>p.id===id))throw Error('Unknown source part');selection.id=id;$('#regionSelect').value=id;qa.regionSelected=id;const p=part();state.heat=!!p&&!selection.isolate;disposeHelpers();if(p){colorPart();if(selection.isolate){state.heat=false;buildHelpers();}}else selection.isolate=false;
  $('#regionIsolate').classList.toggle('active',selection.isolate);$('#regionInfo').textContent=p?p.label+' · '+p.sourceTriangles.length+' 个源三角形 · '+p.sourceVertices.length+' 个原索引顶点。'+(selection.isolate?'单独显示，不删除其余数据。':'高亮查看，原鱼保持完整。'):'所有 7,944 个原始三角形都有唯一归属；命名仍待核准。';
  $('#regionEvidence').textContent=JSON.stringify(p?{part:p.id,mesh:p.mesh,indexedIslands:p.indexedIslandIds,bounds:p.bounds,controlSupport:p.sourceControlSupport.slice(0,5),labelBasis:p.labelBasis,naturalAnatomyApproved:false}:{unresolved:data.unresolved},null,2);applyDisplay();update();
 }
 function apply(){const p=part();if(selection.isolate&&p){meshes[1].forEach(m=>m.visible=false);helpers.forEach(m=>{m.visible=true;m.material=state.heat?originals[m.userData.sourceMesh]:meshes[1][m.userData.sourceMesh].material;});}else helpers.forEach(m=>m.visible=false);seamLines.visible=selection.seams;gapLines.visible=selection.seams;qa.regionIsolated=selection.isolate&&!!p;qa.regionRenderedTriangles=selection.isolate&&p?p.sourceTriangles.length:7944;}
 function update(){const surfaces=ctx.getSurfaces();if(!surfaces?.length)return;let max=0,shown=0;const lines=[],gaps=[];
  for(const seam of data.seams){const a=seam.a,b=seam.b,pa=surfaces[a.mesh].p,pb=surfaces[b.mesh].p;const visible=selection.id==='all'||a.part===selection.id||b.part===selection.id;
   for(let k=0;k<2;k++){const va=Array.from(pa.subarray(a.vertices[k]*3,a.vertices[k]*3+3)),vb=Array.from(pb.subarray(b.vertices[k]*3,b.vertices[k]*3+3));const d=Math.hypot(...va.map((v,i)=>v-vb[i]));max=Math.max(max,d);if(visible&&selection.seams){lines.push(...va);if(d>1e-7)gaps.push(...va,...vb);}}
   if(visible)shown++;
  }
  qa.seamCurrentMaxGap=max;qa.seamMaxObserved=Math.max(qa.seamMaxObserved||0,max);qa.seamShownEdges=shown;
  if(selection.seams){setLines(seamLines,lines);setLines(gapLines,gaps);}qa.sectionScope=selection.axial?'axial':'all';
 }
 function focus(){const p=part();if(!p)return;const surf=ctx.getSurfaces()[p.mesh].p,box=new THREE.Box3();for(const i of p.sourceVertices)box.expandByPoint(new THREE.Vector3().fromArray(surf,i*3));const center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3()),direction=cam.position.clone().sub(controls.target).normalize();controls.target.copy(center);cam.position.copy(center).addScaledVector(direction,3);cam.zoom=Math.max(1,Math.min(7,.55/Math.max(extent.x,extent.y,extent.z)));cam.updateProjectionMatrix();controls.update();qa.regionFocus=p.id;}
 function restore(keepHeat=false){selection.id='all';selection.isolate=false;$('#regionSelect').value='all';$('#regionIsolate').classList.remove('active');disposeHelpers();if(!keepHeat)state.heat=false;applyDisplay();qa.regionSelected='all';}
 function setScope(axial){selection.axial=axial;$('#sectionScope').value=axial?'axial':'all';state.sections=true;document.querySelector('[data-toggle="sections"]').classList.add('active');ctx.refreshSections();applyDisplay();qa.sectionScope=axial?'axial':'all';$('#scopeInfo').textContent=axial?'轴体范围已排除附属鳍面：200 个静息站位共 8,784 条可追溯交线。中心仅为包络中点，不冒称解剖中轴。':'全部原始表面：200 个静息站位共 22,816 条交线。';}
 function acceptFace(mi,face){return !selection.isolate||selection.id==='all'||data.parts[data.faceToPart[mi][face]].id===selection.id;}
 function acceptSectionFace(mi,face){return !selection.axial||data.axialSurfaceParts.includes(data.parts[data.faceToPart[mi][face]].id);}
 $('#regionSelect').onchange=e=>choose(e.target.value);$('#regionIsolate').onclick=()=>{if(selection.id==='all')choose('trunk');selection.isolate=!selection.isolate;choose(selection.id);};$('#regionFocus').onclick=focus;$('#regionClear').onclick=()=>{restore();preset('side');};$('#regionSeams').onclick=()=>{selection.seams=!selection.seams;$('#regionSeams').classList.toggle('active',selection.seams);apply();update();};$('#sectionScope').onchange=e=>setScope(e.target.value==='axial');
 for(const id of ['#groupSelect','#jointSelect'])$(id).addEventListener('change',()=>restore(true));
 qa.regions={version:data.version,parts:data.parts.length,sourceTriangles:7944,exactSourceSeamEdges:data.seams.length,axialSourceParts:data.axialSurfaceParts,anatomicalPartitionApproved:false};
 const api={data,selection,choose,apply,update,focus,restore,setScope,acceptFace,acceptSectionFace,helpers:()=>helpers};window.FISH_REGIONS=api;return api;
}

// Injected into R9 experiment module by build.py; uses that module's one scene.
let fusionRootMesh=null,rootsVisible=false,fusionSaveTimer=0;
const FUSION_VERSION='R10.0 / R3 + R9';
function installFusionUI(){
 const slider=row=>{const[k,label,min,max,step,value]=row;return `<label class="slider" for="${k}"><span>${label}</span><output id="${k}Value">${value}</output><input id="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;};
 const regional=document.createElement('details');regional.id='fusionRegions';regional.open=true;regional.innerHTML='<summary>R3 分区发根 · 导向与细丝</summary><p>在真实头皮上调整；旧长发使用老师原发根，不强行重画。</p><div class="editor-grid">'+CONTROL_GROUPS.scalp.map(slider).join('')+'</div>';$('panel-hair').append(regional);
 const beard=document.createElement('div');beard.className='editor-grid';beard.innerHTML=CONTROL_GROUPS.beard.map(slider).join('');$('panel-beard').append(beard);
 const presets=document.createElement('div');presets.className='row';presets.innerHTML='<button id="fusionStubble">自然全脸胡茬</button><button id="fusionBeard">自然短络腮胡</button>';$('panel-beard').insertBefore(presets,$('panel-beard').children[2]);
 $('fusionStubble').onclick=()=>setGroom({beardVisible:true,beardDensity:78,beardLength:20,beardWidth:85,moustacheCoverage:85,chinCoverage:100,beardJawCoverage:90,beardCheekCoverage:70,beardSideburnCoverage:85,beardCurl:24,beardVariation:70});
 $('fusionBeard').onclick=()=>setGroom({beardVisible:true,beardDensity:94,beardLength:55,beardWidth:90,moustacheCoverage:95,chinCoverage:100,beardJawCoverage:100,beardCheekCoverage:88,beardSideburnCoverage:95,beardCurl:38,beardVariation:65});
 const inspect=document.createElement('div');inspect.className='row fusion-inspect';inspect.innerHTML='<button id="fusionTop">头顶近看</button><button id="fusionLeft">左耳周</button><button id="fusionRight">右耳周</button><button id="fusionNape">后脑 / 后颈</button><button id="fusionFace">胡须近看</button><button id="fusionRoots" aria-pressed="false">查看真实发根</button>';$('cameraDeck').append(inspect);
 for(const[key,view]of [['fusionTop','top'],['fusionLeft','left'],['fusionRight','right'],['fusionNape','nape'],['fusionFace','beard']])$(key).onclick=()=>fusionCamera(view);
 $('fusionRoots').onclick=()=>setRoots(!rootsVisible);
 const save=document.createElement('div');save.className='row';save.innerHTML='<button id="fusionSave">保存本机</button><button id="fusionRestore">恢复本机</button><button id="fusionExport">导出参数</button><button id="fusionImport">导入参数</button><input id="fusionFile" type="file" accept=".json,application/json" hidden>';$('gnmControlScroll').append(save);
 $('fusionSave').onclick=()=>{try{localStorage.setItem('kaopu.hair.fusion.r10',JSON.stringify(fusionSnapshot()));message('R10 参数已保存到此浏览器；旧版不受影响')}catch(e){message('保存失败：'+e.message)}};
 $('fusionRestore').onclick=()=>{try{const v=localStorage.getItem('kaopu.hair.fusion.r10');if(!v)throw Error('本机还没有 R10 存档');loadFusionSnapshot(JSON.parse(v));message('已恢复 R10 参数')}catch(e){message('恢复失败：'+e.message)}};
 $('fusionExport').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(fusionSnapshot(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='kaopu-hair-r10.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 $('fusionImport').onclick=()=>$('fusionFile').click();$('fusionFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>100000)throw Error('参数文件过大');loadFusionSnapshot(JSON.parse(await f.text()));message('已导入 R10 参数')}catch(err){message('导入失败：'+err.message)}finally{e.target.value=''}};
 const quality=document.createElement('p');quality.innerHTML='质量：<a href="?quality=near">96k 特写</a> · <a href="?quality=balanced">64k 平衡</a> · <a href="?quality=light">36k 轻量</a>。更换质量会重新载入。<br>紫：后颈，蓝：耳周，绿：头顶，金：前额。<br>TEN24 指定女性尚未接入；这里没有用另一张脸冒充。';$('gnmControlScroll').append(quality);
 const light=document.createElement('button');light.textContent='R3 柔和底光';light.id='fusionR3Light';$('panel-look').prepend(light);light.onclick=()=>{scene.children.filter(o=>o.isHemisphereLight).forEach(o=>o.intensity=.8);lights.forEach(l=>l.shadow.radius=12);renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.needsUpdate=true;render()};
 const style=document.createElement('style');style.textContent='.fusion-inspect{gap:5px;flex-wrap:wrap}#fusionRegions summary{font-weight:700}#gnmControlScroll p{line-height:1.6}.wb-header strong:after{content:" · R10.0 融合版";color:#d9bc87}#legacyStyles{border:1px solid #67735d;border-radius:7px;padding:8px}#cameraDeck{max-height:210px;overflow:auto}#fusionRoots[aria-pressed=true]{background:#746044}';document.head.append(style);
}
function fusionQuality(){const q=new URLSearchParams(location.search).get('quality');return q==='light'||(!q&&innerWidth<700)?36000:q==='balanced'?64000:96000}
function refreshFusionRadii(){
 if(!legacyHair)return;const g=legacyHair.mesh.geometry,per=legacyHair.options.segments+1,n=legacyHair.options.count,a=g.attributes.strandRadius.array,along=g.attributes.along.array,random=g.attributes.strandRandom.array;
 for(let i=0;i<n;i++){const root=legacyHair.binding.templateRoots.subarray(i*3,i*3+3),margin=legacyHair.binding.safetyMargin(root),w=regionWeights(root),edge=1-Math.min(1,Math.max(0,margin/.013)),fine=1-.45*edge*fusion.hairRootFine/100;
 for(let j=0;j<per*2;j++){const k=i*per*2+j;a[k]=(n>=64000?.00005:.000075)*(1-.32*w.nape)*fine*(.72+.55*random[k])*(1-.87*along[k]**4)}}g.attributes.strandRadius.needsUpdate=true;
 const b=legacyFace.regions.beard,bg=b.mesh.geometry,bp=b.options.segments+1,ar=bg.attributes.strandRadius.array;
 for(let i=0;i<b.options.count;i++){const r=b.random[i],variation=fusion.beardVariation/100;for(let j=0;j<bp*2;j++){const k=i*bp*2+j,s=bg.attributes.along.array[k];ar[k]=.000065*(1+variation*(r-.5)*.8)*(1-.88*s**3)}}bg.attributes.strandRadius.needsUpdate=true;
 opacitySystem?.markDirty('R10 per-root taper / regional parameters');
}
function fusionCamera(which){
 if(!ready)return;setRotate(false);const views={top:[[.015,.61,.005],[0,.353,0]],left:[[.28,.305,.052],[.065,.285,.015]],right:[[-.28,.305,.052],[-.065,.285,.015]],nape:[[.03,.293,-.34],[0,.270,-.03]],beard:[[.075,.238,.39],[0,.233,.079]]};const v=views[which];if(!v)throw Error('Unknown inspection view');camera.zoom=1;state.zoom=1;state.view='detail-'+which;camera.updateProjectionMatrix();orbit._sphericalDelta.set(0,0,0);orbit._panOffset.set(0,0,0);orbit._scale=1;camera.position.fromArray(v[0]);orbit.target.fromArray(v[1]);camera.lookAt(orbit.target);orbit.update();syncMaterials();syncUI();render();
}
function setRoots(value){rootsVisible=!!value;applyVisibility();refreshFusionRoots();render();$('fusionRoots')?.setAttribute('aria-pressed',String(rootsVisible));}
function refreshFusionRoots(){
 if(!legacyHair||!teacherMeshes.length)return;
 if(fusionRootMesh){scene.remove(fusionRootMesh);fusionRootMesh.geometry.dispose();fusionRootMesh.material.dispose();fusionRootMesh=null}
 if(!rootsVisible)return;
 const points=[],colors=[];const teacher=['original','chin-trim','cropped-trim'].includes(groom.style);
 if(groom.hairVisible){const owner=teacher?bindings[0]:legacyHair,count=teacher?owner.count:owner.activeCount,per=teacher?owner.segments+1:owner.options.segments+1,source=teacher?teacherMeshes[0].geometry.attributes.position.array:owner.latestPoints;
 for(let j=0;j<count;j++){const i=teacher?j:owner.activeRoots[j],q=i*per*(teacher?6:3),p=Array.from(source.subarray(q,q+3));points.push(...p);const w=regionWeights(p),c=new THREE.Color(w.nape>.4?'#c58cff':w.ear>.25?'#54b8ff':w.crown>.5?'#66deb0':'#efc86f');colors.push(...c.toArray())}}
 if(groom.beardVisible){const b=legacyFace.regions.beard,idx=b.geometry.index.array,per=b.options.segments+1,seen=new Set();for(let j=0;j<b.geometry.drawRange.count;j+=b.options.segments*6){const i=Math.floor(idx[j]/(per*2));if(seen.has(i))continue;seen.add(i);points.push(...b.latestPoints.subarray(i*per*3,i*per*3+3));colors.push(.85,.48,.30)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));fusionRootMesh=new THREE.Points(g,new THREE.PointsMaterial({size:.0007,vertexColors:true,sizeAttenuation:true}));fusionRootMesh.name='R10 exact surface root inspection';scene.add(fusionRootMesh);legacyHair.mesh.visible=false;teacherMeshes[0].visible=false;legacyFace.regions.beard.mesh.visible=false;
}
function fusionSnapshot(){return{schema:'kaopu.hair.groom@1.0',version:FUSION_VERSION,sourceRevision:'40861390bb57673c677a08d5216286d2dcbcf4da',subject:'gnm-original',units:'metre',groom:{...groom},case:state.case,light:state.light}}
function loadFusionSnapshot(v){if(v?.schema!=='kaopu.hair.groom@1.0'||v.subject!=='gnm-original'||!v.groom||typeof v.groom!=='object')throw Error('不是有效的 R10 毛发参数');if(!['neutral','smile','surprise','identity'].includes(v.case)||!['both','warm','cool','ambient'].includes(v.light))throw Error('存档的表情或灯光无效');setGroom(v.groom);setCase(v.case);setLight(v.light);setRoots(false)}
function fusionDiagnostics(){
 if(!legacyHair)return{version:FUSION_VERSION,ready:false};const h=legacyHair,b=h.binding,counts={crown:0,front:0,left:0,right:0,ear:0,nape:0};for(let j=0;j<h.activeCount;j++){const i=h.activeRoots[j],p=b.templateRoots.subarray(i*3,i*3+3),w=regionWeights(p);if(w.crown>.5)counts.crown++;if(p[2]>.055)counts.front++;if(w.side>.4)counts[p[0]>0?'left':'right']++;if(w.ear>.25)counts.ear++;if(w.nape>.4)counts.nape++}
 const meshes=[h.mesh,...teacherMeshes,...Object.values(legacyFace.regions).map(r=>r.mesh)],geometryBytes=meshes.reduce((n,m)=>n+Object.values(m.geometry.attributes).reduce((a,b)=>a+b.array.byteLength,0)+(m.geometry.index?.array.byteLength||0),0);
 return{version:FUSION_VERSION,ready,oneScene:true,headCount:scene.children.filter(o=>o===head).length,source:'R3 region roots + R9 teacher source curves and editor',qualityRoots:h.options.count,regionalRootCounts:counts,rootsVisible,geometryBytes,controlCount:Object.keys(DEFAULT_GROOM).length,physics:false,ten24Loaded:false,productionAccepted:false,snapshotSchema:'kaopu.hair.groom@1.0'};
}

from pathlib import Path
p=Path('G:/DEM/Wenzhou_3D_Lab_R3_20260909/site/dist/r3-1')
s=(p/'app.js').read_text(encoding='utf-8')
s=s.replace("let renderer,controls,contract,patch,mesh,wireBase,markers,origin,extent;", "let renderer,controls,contract,patch,mesh,wireBase,markers,origin,extent,land,rivers,hydro,landCanvas,landPixels;\nlet landBounds,maskSize,renderSkip=1;")
s=s.replace("'mountains'","'overview'",1)
s=s.replace("空白为无数据或范围外", "海域已裁除 · 河道为地图线位")
s=s.replace("if(bound!==undefined)$('approximation-info')", "if(bound===undefined)$('approximation-info').textContent='当前显示层的近似高度界尚未核定；不代表实测精度。';\n if(bound!==undefined)$('approximation-info')")
s=s.replace("fetchChecked('/r3-1/data/'+path)", "fetchChecked(path.startsWith('/')?path:'/r3-1/data/'+path)")
s=s.replace("m.map?.dispose();m.dispose();", "m.map?.dispose();m.alphaMap?.dispose();m.dispose();")
s=s.replace("rows.findLastIndex(i=>patch.rowIndices[i]<=r)", "Math.floor((r-patch.rowIndices[0])/(patch.rowIndices[1]-patch.rowIndices[0])/renderSkip)")
s=s.replace("cols.findLastIndex(k=>patch.columnIndices[k]<=c)", "Math.floor((c-patch.columnIndices[0])/(patch.columnIndices[1]-patch.columnIndices[0])/renderSkip)")
s=s.replace("clearObject(mesh);clearObject(wireBase);clearObject(markers);", "clearObject(mesh);clearObject(wireBase);clearObject(markers);clearObject(hydro);")
s=s.replace("const skip=mobile&&patch.rows*patch.columns>180000?2:1;", "const skip=mobile&&patch.rows*patch.columns>180000?2:1;renderSkip=skip;")
s=s.replace("const positions=new Float32Array", "const uv=new Float32Array(nr*nc*2);\n const positions=new Float32Array")
s=s.replace("const r=rows[j],c=cols[i],h=", "uv[(j*nc+i)*2]=i/(nc-1);uv[(j*nc+i)*2+1]=1-j/(nr-1);\n   const r=rows[j],c=cols[i],h=")
s=s.replace("g.setIndex(indices);", "g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(indices);")
s=s.replace("mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true", "const mask=makeLandMask([e0,n1,e1,n0],mobile);\n mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({alphaMap:mask,alphaTest:.5,vertexColors:true")
s=s.replace("scene.add(wireBase);", "wireBase.visible=false;scene.add(wireBase);")
s=s.replace("fitCamera();status();", "makeHydro();fitCamera();status();")
s=s.replace("for(const p of contract.patches.filter(p=>p.id.startsWith('query-')))", "const decode=b=>JSON.parse(new TextDecoder().decode(b));\n   [land,rivers]=await Promise.all([checkedBytes(contract.hydrography.landFile,contract.hydrography.landSha256).then(decode),checkedBytes(contract.hydrography.riversFile,contract.hydrography.riversSha256).then(decode)]);\n   for(const p of contract.patches.filter(p=>!['mountains','overview'].includes(p.id)))")
s=s.replace("await selectPatch('mountains');", "$('show-rivers').onchange=()=>{hydro.children.filter(o=>o.userData.layer==='river').forEach(o=>o.visible=$('show-rivers').checked);requestRender();};\n   $('show-coast').onchange=()=>{hydro.children.filter(o=>o.userData.layer==='coast').forEach(o=>o.visible=$('show-coast').checked);requestRender();};\n   await selectPatch('overview');")
s=s.replace("start();", """
// Polygon rings and map curves are persistent evidence. This alpha texture and
// draped buffers are disposable display products, never measurement objects.
function makeLandMask(bounds,mobile){
 landBounds=bounds;const [w,s,e,n]=bounds;
 const limit=Math.min(renderer.capabilities.maxTextureSize,mobile?2048:4096);
 maskSize=[Math.min(limit,Math.max(256,Math.ceil((e-w)/25))),Math.min(limit,Math.max(256,Math.ceil((n-s)/25)))];
 landCanvas=document.createElement('canvas');[landCanvas.width,landCanvas.height]=maskSize;
 const ctx=landCanvas.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='black';ctx.fillRect(0,0,...maskSize);ctx.fillStyle='white';
 for(const polygon of land.polygons){
   ctx.beginPath();
   for(const ring of polygon){ring.forEach(([x,y],i)=>{const xx=(x-w)/(e-w)*maskSize[0],yy=(n-y)/(n-s)*maskSize[1];if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);});ctx.closePath();}
   ctx.fill('evenodd');
 }
 landPixels=ctx.getImageData(0,0,...maskSize).data;
 const texture=new THREE.CanvasTexture(landCanvas);texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 state.coastMask={size:maskSize,texelM:[(e-w)/maskSize[0],(n-s)/maskSize[1]],kind:'temporary display mask',gpuUncompressedBytes:maskSize[0]*maskSize[1]*4};
 return texture;
}
function onDisplayedLand(e,n){
 const [w,s,ee,nn]=landBounds;if(e<w||e>ee||n<s||n>nn)return false;
 const x=Math.min(maskSize[0]-1,Math.floor((e-w)/(ee-w)*maskSize[0])),y=Math.min(maskSize[1]-1,Math.floor((nn-n)/(nn-s)*maskSize[1]));
 return landPixels[(y*maskSize[0]+x)*4+1]>=128;
}
function makeHydro(){
 hydro=new THREE.Group();scene.add(hydro);let count=0;
 const lift=Math.max(...extent)*.000015; // kilometres, display-only offset
 const step=state.displayStepM*.5;
 function draw(lines,color,layer,opacity){
   const points=[];
   for(const line of lines)for(let k=1;k<line.length;k++){
     const a=line[k-1],b=line[k];
     if(Math.max(a[0],b[0])<landBounds[0]||Math.min(a[0],b[0])>landBounds[2]||Math.max(a[1],b[1])<landBounds[1]||Math.min(a[1],b[1])>landBounds[3])continue;
     const parts=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));let previous=null;
     for(let j=0;j<=parts;j++){
       const t=j/parts,e=a[0]+(b[0]-a[0])*t,n=a[1]+(b[1]-a[1])*t,h=surfaceHeight(e,n);
       const valid=h!==null&&(layer==='coast'||onDisplayedLand(e,n));
       const next=valid?[(e-origin[0])/1000,h/1000*exaggeration+lift,(origin[1]-n)/1000]:null;
       if(previous&&next){const midE=a[0]+(b[0]-a[0])*(j-.5)/parts,midN=a[1]+(b[1]-a[1])*(j-.5)/parts;
         if(surfaceHeight(midE,midN)!==null&&(layer==='coast'||onDisplayedLand(midE,midN)))points.push(...previous,...next);}
       previous=next;
     }
   }
   if(!points.length)return;
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
   const line=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));line.userData.layer=layer;line.visible=$(layer==='coast'?'show-coast':'show-rivers').checked;hydro.add(line);count+=points.length/6;
 }
 for(const [kind,color,opacity] of [['river','#67dcff',1],['canal','#4ca9e7',.8],['stream','#4c91b2',.6],['tidal_channel','#baa5ff',.9]])draw(rivers.features.filter(f=>f.kind===kind).flatMap(f=>f.landDisplayLines),color,'river',opacity);
 draw(land.coastlines,'#c7e7d0','coast',.72);
 state.hydroSegments=count;state.waterLevel=null;state.visualLineLiftM=lift*1000;
 state.seaSurfaceCreated=false;state.dataWindowOutlineVisible=false;
 canvas.dataset.hydroSegments=String(count);
}
start();
""")
(p/'app.js').write_text(s,encoding='utf-8')
h=(p/'index.html').read_text(encoding='utf-8').replace('地形 R3</title>','地形 R3.1</title>')
h=h.replace('<div id="query-card"', '<div class="hydro-options"><label><input id="show-rivers" type="checkbox" checked> 河流标注</label><label><input id="show-coast" type="checkbox" checked> 海岸线</label><small>青：河流 · 蓝：沟渠/溪流<br>地图线位，非水面高度</small></div><div id="query-card"')
h=h.replace('虚线是选取范围，不是崖壁或海岸。','海域按 OSM 预处理陆地区域裁除，未创建假水面。陆地区域包含内陆水域，不等于处处干地。海岸显示采用临时像素遮罩，小岛在远景可能小于一个显示像素。')
h=h.replace('<dt>起伏增强</dt>', '<dt>海岸与河流</dt><dd>海岸使用 2026-09-09 下载的 FOSSGIS/OSM 预处理陆地面；不是即时潮位线。河流使用 2026-08 的混合归档地图线位，未确认完整覆盖全域。河宽、水位、河床与物理连接未知。线条随显示地形抬高少量以便辨认，不是测量高度。</dd><dt>起伏增强</dt>')
h=h.replace('</footer>', '</footer><a class="attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>')
(p/'index.html').write_text(h,encoding='utf-8')
with (p/'style.css').open('a',encoding='utf-8') as f:f.write('\n.hydro-options{display:grid;gap:5px;border-top:1px solid #60748855;padding-top:8px;margin-top:6px}.hydro-options label{display:flex;align-items:center;gap:5px;color:#c2dfed}.hydro-options input{accent-color:#67dcff}.attribution{position:absolute;bottom:6px;right:30px;color:#94adbd;font-size:10px;text-decoration:none}.attribution:hover{text-decoration:underline}@media(max-width:760px){.hydro-options small{display:none}.attribution{right:16px;bottom:3px;font-size:9px}}')

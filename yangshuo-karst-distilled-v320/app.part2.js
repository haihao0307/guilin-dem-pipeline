  terrainGroup=new THREE.Group();scene.add(terrainGroup);
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
}

async function ensureSourceIndex(){
  if(state.sourceIndex)return state.sourceIndex;
  progress(5,'连接真实高程','读取同源 2048 候选窗口索引。');
  const response=await fetch(`${DATA_ROOT}/index.json?v=${BUILD_VERSION}`,{cache:'no-cache'});if(!response.ok)throw new Error(`真实高程索引 HTTP ${response.status}`);
  const index=await response.json();
  if(index?.source?.sha256!==SOURCE_SHA)throw new Error('真实 DEM SHA256 与锁定值不符');
  if(index?.source?.pixelSpacingMeters!==SOURCE_SPACING)throw new Error('真实 DEM 分辨率与 12.5 米锁定值不符');
  if(index?.grid?.[0]!==SOURCE_GRID||index?.grid?.[1]!==SOURCE_GRID)throw new Error('候选源网格并非 2048 × 2048');
  state.sourceIndex=index;$('truthCheck').className='dot ok';return index;
}

async function readCandidate(id){
  if(state.candidateCache.has(id))return state.candidateCache.get(id);
  const candidate=CANDIDATES[id];progress(11,'读取原生像元',`候选 ${id} · ${candidate.name}`);
  const manifestResponse=await fetch(`${DATA_ROOT}/${id}/manifest.json?v=${BUILD_VERSION}`,{cache:'no-cache'});if(!manifestResponse.ok)throw new Error(`候选 ${id} 清单 HTTP ${manifestResponse.status}`);
  const manifest=await manifestResponse.json();if(manifest.sourceSha256!==SOURCE_SHA)throw new Error(`候选 ${id} 源 SHA256 不符`);if(manifest.grid?.[0]!==2048||manifest.grid?.[1]!==2048||manifest.pixelSpacingMeters!==12.5)throw new Error(`候选 ${id} 网格合同不符`);
  const response=await fetch(`${DATA_ROOT}/${id}/${manifest.heightFile}?v=${BUILD_VERSION}`,{cache:'force-cache'});if(!response.ok)throw new Error(`候选 ${id} 高程 HTTP ${response.status}`);
  const buffer=await response.arrayBuffer();if(buffer.byteLength!==2048*2048*2)throw new Error(`候选 ${id} 高程字节数不符`);
  progress(17,'校验高程哈希',`候选 ${id} · SHA256`);const actual=await sha256Hex(buffer);if(actual!==manifest.heightSha256)throw new Error(`候选 ${id} 高程 SHA256 不符`);
  let data=new Int16Array(buffer);if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1){const swapped=new Int16Array(data.length),view=new DataView(buffer);for(let i=0;i<swapped.length;i++)swapped[i]=view.getInt16(i*2,true);data=swapped}
  const result={candidate,data,manifest};state.candidateCache.set(id,result);return result;
}

async function ensureRiverData(){
  if(state.projectedRiverLines)return state.projectedRiverLines;
  progress(20,'读取漓江骨架','加载批准的漓江中心线并投影到 EPSG:32649。');
  const response=await fetch(`${RIVER_URL}?v=${BUILD_VERSION}`,{cache:'force-cache'});if(!response.ok)throw new Error(`漓江矢量 HTTP ${response.status}`);
  state.riverGeoJSON=await response.json();
  const lines=[];
  const pushGeometry=g=>{if(!g)return;if(g.type==='LineString')lines.push(g.coordinates);else if(g.type==='MultiLineString')g.coordinates.forEach(c=>lines.push(c));else if(g.type==='GeometryCollection')g.geometries.forEach(pushGeometry)};
  for(const feature of state.riverGeoJSON.features||[])pushGeometry(feature.geometry);
  state.projectedRiverLines=lines.map(line=>line.map(ll=>proj4('EPSG:4326','EPSG:32649',ll)));
  return state.projectedRiverLines;
}

function validHeight(v){return Number.isFinite(v)&&v!==0&&v>-1000&&v<10000}
function samplePixel(data,col,row){const c=clamp(Math.round(col),0,2047),r=clamp(Math.round(row),0,2047),v=data[r*2048+c];return validHeight(v)?v:null}
function sampleSource(data,candidate,x,y){
  const [minX,minY,maxX,maxY]=candidate.bounds;const fx=clamp((x-minX)/SOURCE_SPACING,0,2047),fy=clamp((maxY-y)/SOURCE_SPACING,0,2047);const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(2047,x0+1),y1=Math.min(2047,y0+1),tx=fx-x0,ty=fy-y0;
  const vals=[data[y0*2048+x0],data[y0*2048+x1],data[y1*2048+x0],data[y1*2048+x1]];const good=vals.filter(validHeight);if(!good.length)return 0;const fallback=good.reduce((a,b)=>a+b,0)/good.length;const a=validHeight(vals[0])?vals[0]:fallback,b=validHeight(vals[1])?vals[1]:fallback,c=validHeight(vals[2])?vals[2]:fallback,d=validHeight(vals[3])?vals[3]:fallback;return lerp(lerp(a,b,tx),lerp(c,d,tx),ty);
}
function slopeAtSource(data,candidate,x,y,step=SOURCE_SPACING){const hx=sampleSource(data,candidate,x+step,y)-sampleSource(data,candidate,x-step,y),hy=sampleSource(data,candidate,x,y+step)-sampleSource(data,candidate,x,y-step);return Math.atan(Math.hypot(hx,hy)/(2*step))*180/Math.PI}
function ringReliefAt(data,candidate,x,y,radius){const center=sampleSource(data,candidate,x,y);let sum=0,count=0;for(let k=0;k<16;k++){const a=k/16*Math.PI*2;sum+=sampleSource(data,candidate,x+Math.cos(a)*radius,y+Math.sin(a)*radius);count++}return sum/count-center}

function pickFocus(data,candidate,mode){
  const [minX,minY,maxX,maxY]=candidate.bounds;const cx=(minX+maxX)/2,cy=(minY+maxY)/2;let best={x:cx,y:cy,score:-Infinity};const radius=mode==='cliff'?3000:2500;const step=mode==='cliff'?75:100;
  for(let y=cy-radius;y<=cy+radius;y+=step)for(let x=cx-radius;x<=cx+radius;x+=step){if(x<minX+700||x>maxX-700||y<minY+700||y>maxY-700)continue;const h=sampleSource(data,candidate,x,y),s=slopeAtSource(data,candidate,x,y,25),ringA=ringReliefAt(data,candidate,x,y,300),ringB=ringReliefAt(data,candidate,x,y,650),dist=Math.hypot(x-cx,y-cy);
    let score=0;if(mode==='cliff')score=s*6+(-ringA)*1.4+(-ringB)*.55-dist*.001;else if(mode==='paddy')score=ringA*1.7+ringB*.8-s*15-h*.018-dist*.0012;else score=ringA*1.55+ringB*.9-s*9-h*.012-dist*.0008;
    if(score>best.score)best={x,y,score,height:h,slope:s,ringA,ringB};
  }
  return best;
}

function clipProjectedLine(line,bounds,margin=0){const [minX,minY,maxX,maxY]=bounds,runs=[];let run=[];for(const p of line){const inside=p[0]>=minX-margin&&p[0]<=maxX+margin&&p[1]>=minY-margin&&p[1]<=maxY+margin;if(inside)run.push(p);else{if(run.length>1)runs.push(run);run=[]}}if(run.length>1)runs.push(run);return runs}
function resampleLine(points,step){if(points.length<2)return[];const out=[{x:points[0][0],y:points[0][1],s:0}];let carry=0,total=0;for(let i=1;i<points.length;i++){let ax=points[i-1][0],ay=points[i-1][1],bx=points[i][0],by=points[i][1],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(len<1e-6)continue;let at=step-carry;while(at<=len){const t=at/len;total+=step;out.push({x:ax+dx*t,y:ay+dy*t,s:total});at+=step}carry=len-(at-step)}return out}
function selectRiverModel(candidate,data,projectedLines){
  const runs=projectedLines.flatMap(line=>clipProjectedLine(line,candidate.bounds,0));if(!runs.length)return null;const [minX,minY,maxX,maxY]=candidate.bounds,cx=(minX+maxX)/2,cy=(minY+maxY)/2;let bestRun=runs[0],bestDistance=Infinity;for(const run of runs){for(const p of run){const d=Math.hypot(p[0]-cx,p[1]-cy);if(d<bestDistance){bestDistance=d;bestRun=run}}}
  const dense=resampleLine(bestRun,RIVER_SAMPLE_METERS);if(dense.length<3)return null;let focus=dense[0],focusScore=-Infinity;for(let i=4;i<dense.length-4;i++){const p=dense[i],d=Math.hypot(p.x-cx,p.y-cy),relief=-ringReliefAt(data,candidate,p.x,p.y,350),slope=slopeAtSource(data,candidate,p.x,p.y,25),score=relief*.8+slope*2-d*.0015;if(score>focusScore){focusScore=score;focus=p}}

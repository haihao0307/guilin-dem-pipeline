  }
  return{...analysis,peaks,macro,micro,final,tone,stats:{macroMin,macroMax,microMin,microMax,ratioMin:Number.isFinite(ratioMin)?ratioMin:0,ratioMax:Number.isFinite(ratioMax)?ratioMax:0,valleyMeanMacroAbs:valleyVertices?valleyMacroAbs/valleyVertices:0,valleyVertices}};
}

function buildRegionalFields(analysis){
  const {n,truth,relief,karst,valley,extent}=analysis,final=new Float32Array(n*n),tone=new Float32Array(n*n),macro=new Float32Array(n*n),micro=new Float32Array(n*n);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,lx=(x/(n-1)-.5)*extent,ly=(z/(n-1)-.5)*extent,edge=edgeFeather(lx,ly,extent,.06);const d=clamp(relief[i]*.12,0,28)*karst[i]*(1-valley[i])*.65*edge;macro[i]=d;final[i]=truth[i]+state.enhanceMix*d*state.macro;tone[i]=clamp(valley[i]*.45-karst[i]*.08,0,1)}
  let macroMax=0;for(const value of macro)if(value>macroMax)macroMax=value;return{...analysis,macro,micro,final,tone,peaks:[],stats:{macroMin:0,macroMax,microMin:0,microMax:0,ratioMin:0,ratioMax:0,valleyMeanMacroAbs:0,valleyVertices:0}};
}

function sampleField(field,worldX,worldY,key='final'){
  const {center,extent,n}=field,fx=clamp((worldX-(center.x-extent*.5))/extent*(n-1),0,n-1),fy=clamp((worldY-(center.y-extent*.5))/extent*(n-1),0,n-1),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(n-1,x0+1),y1=Math.min(n-1,y0+1),tx=fx-x0,ty=fy-y0,a=field[key][y0*n+x0],b=field[key][y0*n+x1],c=field[key][y1*n+x0],d=field[key][y1*n+x1];return lerp(lerp(a,b,tx),lerp(c,d,tx),ty)
}

function paddyDetail(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const mask=valleyMask*smoothstep(10,2.5,slopeDeg);if(mask<.001)return{delta:0,bund:0,channel:0,mask:0};const warpX=fbm(worldX*.004,worldY*.004,seed+11,3)*18,warpY=fbm(worldX*.004+5.1,worldY*.004-2.3,seed+31,3)*18;const cell=worley((worldX+warpX)*.021,(worldY+warpY)*.012,seed+53);const boundary=smoothstep(.18,.035,cell.f2-cell.f1);const levelStep=.42+hash21(cell.cellX,cell.cellZ,seed+79)*.18;const terrace=Math.round((base+fbm(worldX*.008,worldY*.008,seed+97,3)*.12)/levelStep)*levelStep;const flatten=clamp((terrace-base)*.76,-.42,.42);const channelPhase=Math.abs(Math.sin((worldX*.021+worldY*.013)+fbm(worldX*.006,worldY*.006,seed+121,3)*2.2));const channel=smoothstep(.12,.015,channelPhase)*smoothstep(.08,.28,cell.f1)*.22;const bund=boundary*(.24+hash21(cell.cellX,cell.cellZ,seed+149)*.22);const delta=clamp((flatten+bund-channel)*mask,-.52,.54);return{delta,bund:bund*mask,channel:channel*mask,mask};
}

function chooseLocalCenter(preset,focus,paddyFocus,riverModel){if(preset.detailMode==='paddy')return{x:paddyFocus.x,y:paddyFocus.y};if(preset.detailMode==='river'&&riverModel)return{x:riverModel.focus.x,y:riverModel.focus.y};return{x:focus.x,y:focus.y}}

function prepareRiverSections(riverModel,localCenter,extent,data,candidate){
  if(!riverModel)return null;const half=extent*.7,pts=riverModel.all.filter(p=>Math.abs(p.x-localCenter.x)<=half&&Math.abs(p.y-localCenter.y)<=half);if(pts.length<8)return null;const centerHeights=pts.map(p=>sampleSource(data,candidate,p.x,p.y)),smoothed=centerHeights.map((_,i)=>{let sum=0,count=0;for(let j=Math.max(0,i-5);j<=Math.min(pts.length-1,i+5);j++){sum+=centerHeights[j];count++}return sum/count});let meanS=0,meanH=0;for(let i=0;i<pts.length;i++){meanS+=pts[i].s;meanH+=smoothed[i]}meanS/=pts.length;meanH/=pts.length;let num=0,den=0;for(let i=0;i<pts.length;i++){num+=(pts[i].s-meanS)*(smoothed[i]-meanH);den+=(pts[i].s-meanS)**2}const slope=clamp(den?num/den:0,-.006,.006),intercept=meanH-slope*meanS;const sections=[];
  for(let i=0;i<pts.length;i++){const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1,tx=dx/len,ty=dy/len,nx=-ty,ny=tx;let curvature=0;if(i>0&&i<pts.length-1){const a=Math.atan2(pts[i].y-pts[i-1].y,pts[i].x-pts[i-1].x),b=Math.atan2(pts[i+1].y-pts[i].y,pts[i+1].x-pts[i].x);curvature=Math.atan2(Math.sin(b-a),Math.cos(b-a))}const width=clamp(59+fbm(pts[i].x*.0025,pts[i].y*.0025,211,3)*17-Math.abs(curvature)*24,44,94),water=intercept+slope*pts[i].s-.18;sections.push({...pts[i],tx,ty,nx,ny,width,water,curvature})}
  return sections;
}

function nearestRiver(sectionList,x,y){if(!sectionList)return null;let best=null,bestD=Infinity;for(let i=0;i<sectionList.length;i++){const s=sectionList[i],dx=x-s.x,dy=y-s.y,d=Math.abs(dx*s.nx+dy*s.ny),along=Math.abs(dx*s.tx+dy*s.ty);if(along>RIVER_SAMPLE_METERS*2.2)continue;const metric=d+along*.18;if(metric<bestD){bestD=metric;best={section:s,index:i,distance:d,side:Math.sign(dx*s.nx+dy*s.ny)||1}}}return best}

function buildLocalFields(contextField,localCenter,mode,data,candidate,riverSections){
  const n=DETAIL_GRID,extent=DETAIL_EXTENT,spacing=DETAIL_SPACING,half=extent*.5,truth=new Float32Array(n*n),final=new Float32Array(n*n),tone=new Float32Array(n*n),paddyMask=new Float32Array(n*n),macro=new Float32Array(n*n),micro=new Float32Array(n*n),worldX=new Float64Array(n),worldY=new Float64Array(n);for(let i=0;i<n;i++){worldX[i]=localCenter.x-half+i*spacing;worldY[i]=localCenter.y-half+i*spacing}
  let paddyVertices=0,karstVertices=0,riverVertices=0,bundMax=0,minClear=Infinity,maxClear=0,sumClear=0,clearSamples=0,penetration=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=worldX[x],wy=worldY[z],t=sampleSource(data,candidate,wx,wy),contextMacro=sampleField(contextField,wx,wy,'macro'),contextMicro=sampleField(contextField,wx,wy,'micro'),v=sampleField(contextField,wx,wy,'valley'),k=sampleField(contextField,wx,wy,'karst'),s=slopeAtSource(data,candidate,wx,wy,6.25),edge=edgeFeather(wx-localCenter.x,wy-localCenter.y,extent,.08);truth[i]=t;let base=t+state.enhanceMix*(contextMacro*state.macro+contextMicro*state.process);macro[i]=contextMacro;let localMicro=processMicro(wx,wy,0.01,0.01,k,503)*.42*edge;micro[i]=contextMicro+localMicro;
    if(mode==='cliff'){base+=state.enhanceMix*localMicro*state.process;if(k>.25)karstVertices++}
    let paddy={delta:0,bund:0,channel:0,mask:0};if(mode==='paddy'){paddy=paddyDetail(wx,wy,t,base,v,s,601);base+=state.enhanceMix*paddy.delta*state.bund*edge;paddyMask[i]=paddy.mask;if(paddy.mask>.35)paddyVertices++;bundMax=Math.max(bundMax,paddy.bund)}
    if(mode==='river'&&riverSections){const nearest=nearestRiver(riverSections,wx,wy);if(nearest){const q=nearest.distance/(nearest.section.width*.5),bank=smoothstep(1.28,.96,q),channel=smoothstep(1.02,0,q),clear=.36+3.34*Math.pow(channel,1.38);const target=nearest.section.water-clear*state.river;const blend=clamp(Math.max(channel,bank*.32)*edge,0,1);base=lerp(base,Math.min(base,target),state.enhanceMix*blend);if(q<=1.02){riverVertices++;const actualClear=nearest.section.water-base;minClear=Math.min(minClear,actualClear);maxClear=Math.max(maxClear,actualClear);sumClear+=actualClear;clearSamples++;penetration=Math.max(penetration,base-nearest.section.water)}}}
    final[i]=base;tone[i]=clamp((mode==='paddy'?paddy.mask:v*.35)-k*.12,0,1);
  }
  return{truth,final,tone,paddyMask,macro,micro,n,extent,spacing,center:localCenter,worldX,worldY,stats:{paddyVertices,karstVertices,riverVertices,bundMax,minClear:Number.isFinite(minClear)?minClear:0,maxClear,meanClear:clearSamples?sumClear/clearSamples:0,clearSamples,penetration:Math.max(0,penetration)}};

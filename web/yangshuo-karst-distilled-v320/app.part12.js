/* v3.3.0 rich geomorphology distillation: frequency bands, tower grammar, erosion, paddy and river fields. */
state.tone=true;
$('toneToggle').classList.add('active');
$('toneToggle').textContent='丰富地貌色彩';

function quinticV330(t){return t*t*t*(t*(t*6-15)+10)}
function bandNoiseV330(x,y,frequency,seed,octaves=3){return fbm(x*frequency,y*frequency,seed,octaves)}
function gaborV330(x,y,angle,wavelength,seed=0){
  const ca=Math.cos(angle),sa=Math.sin(angle),u=(x*ca+y*sa)/wavelength,v=(-x*sa+y*ca)/wavelength;
  const phase=bandNoiseV330(x,y,1/(wavelength*3.7),seed+17,3)*Math.PI*1.8;
  const carrier=Math.sin((u+phase)*Math.PI*2);
  const envelope=.58+.42*bandNoiseV330(v,u,.23,seed+41,3);
  return carrier*envelope;
}
function turbulenceV330(x,y,seed=0,octaves=5){
  let sum=0,amp=.55,freq=1,norm=0;
  for(let i=0;i<octaves;i++){sum+=Math.abs(valueNoise(x*freq,y*freq,seed+i*23.17))*amp;norm+=amp;freq*=2.09;amp*=.52}
  return sum/Math.max(norm,1e-6);
}
function parcelGrammarV330(worldX,worldY,seed=0){
  const warpX=fbm(worldX*.0027,worldY*.0027,seed+11,4)*34+fbm(worldX*.011,worldY*.011,seed+29,2)*6;
  const warpY=fbm(worldX*.0027+7.7,worldY*.0027-4.2,seed+41,4)*34+fbm(worldX*.011-5.3,worldY*.011+9.1,seed+57,2)*6;
  const cell=worley((worldX+warpX)*.0145,(worldY+warpY)*.0105,seed+73);
  const edgeGap=cell.f2-cell.f1;
  const boundary=smoothstep(.125,.018,edgeGap);
  const diagonal=Math.abs(Math.sin((worldX*.0125+worldY*.0062)+fbm(worldX*.0038,worldY*.0038,seed+97,3)*2.7));
  const secondary=Math.abs(Math.sin((worldX*-.0048+worldY*.0155)+fbm(worldX*.006,worldY*.006,seed+121,3)*1.8));
  const irrigation=Math.max(smoothstep(.09,.014,diagonal),smoothstep(.075,.012,secondary)*.68)*smoothstep(.08,.34,cell.f1);
  const fieldSeed=hash21(cell.cellX,cell.cellZ,seed+149);
  const wetness=clamp((fieldSeed-.58)*2.8,0,1)*(.62+.38*fbm(worldX*.004,worldY*.004,seed+163,3));
  return{cell,boundary,irrigation,fieldSeed,wetness};
}

const analyzeGridV330=analyzeGrid;
analyzeGrid=function(grid){
  const analysis=analyzeGridV330(grid),{truth,n,spacing,small,medium,coarse}=analysis;
  const curvature=new Float32Array(n*n),ruggedness=new Float32Array(n*n),wetness=new Float32Array(n*n),sediment=new Float32Array(n*n),exposure=new Float32Array(n*n),flow=new Float32Array(n*n);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,x0=Math.max(0,x-1),x1=Math.min(n-1,x+1),z0=Math.max(0,z-1),z1=Math.min(n-1,z+1);
    const lap=(small[z*n+x0]+small[z*n+x1]+small[z0*n+x]+small[z1*n+x]-4*small[i])/Math.max(1,spacing);
    const local=Math.abs(truth[i]-medium[i]),broad=Math.abs(medium[i]-coarse[i]);
    curvature[i]=clamp(lap/3.2,-1,1);ruggedness[i]=clamp(local/18+broad/90,0,1);
    const valley=analysis.valley[i],slope=analysis.slope[i],concave=smoothstep(.32,-.52,curvature[i]);
    wetness[i]=clamp(valley*.62+concave*.32+smoothstep(18,3,slope)*.18,0,1);
    sediment[i]=clamp(valley*.52+concave*.55-smoothstep(28,52,slope)*.5,0,1);
    exposure[i]=clamp(smoothstep(24,57,slope)*(.52+.48*analysis.karst[i])+ruggedness[i]*.22,0,1);
    flow[i]=clamp(concave*smoothstep(4,42,slope)+valley*.25,0,1);
  }
  return{...analysis,curvature,ruggedness,wetness,sediment,exposure,flow};
};

function detectPeaksRichV330(analysis,maxPeaks=52){
  const {n,spacing,medium,coarse,worldX,worldY,slope}=analysis,candidates=[];
  const step=Math.max(1,Math.round(72/spacing)),radius=Math.max(2,Math.round(125/spacing));
  for(let z=radius;z<n-radius;z+=step)for(let x=radius;x<n-radius;x+=step){
    const i=z*n+x,prominence=medium[i]-coarse[i];if(prominence<11.5)continue;
    const h=medium[i];let isPeak=true;
    for(const [dx,dz] of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){
      if(medium[(z+dz)*n+x+dx]>h){isPeak=false;break}
    }
    if(!isPeak)continue;
    const texture=ridged(worldX[x]*.0012,worldY[z]*.0012,23,4),asym=Math.abs(fbm(worldX[x]*.0007,worldY[z]*.0007,67,3));
    candidates.push({x:worldX[x],y:worldY[z],gridX:x,gridY:z,prominence,floor:coarse[i],score:prominence*2.15+slope[i]*.32+texture*13+asym*6});
  }
  candidates.sort((a,b)=>b.score-a.score);const peaks=[];
  for(const candidate of candidates){
    const minimumDistance=clamp(175+candidate.prominence*.62,190,430);
    if(peaks.some(peak=>Math.hypot(peak.x-candidate.x,peak.y-candidate.y)<minimumDistance))continue;
    const rank=peaks.length,major=rank<18,seed=Math.floor(hash21(candidate.x*.01,candidate.y*.01,331)*100000);
    const h=hash21(candidate.x*.013,candidate.y*.013,347),h2=hash21(candidate.x*.017,candidate.y*.017,359);
    const targetHeight=major?clamp(candidate.prominence*1.38+92+h*105,150,365):clamp(candidate.prominence*1.08+52+h*72,82,235);
    const ratio=1.24+h2*.92;
    const meanRadius=clamp(targetHeight/(2*ratio),38,148),stretch=.72+hash21(candidate.x*.021,candidate.y*.021,373)*.72;
    Object.assign(candidate,{targetHeight,ratio,radiusX:meanRadius*stretch,radiusY:meanRadius/stretch,angle:hash21(candidate.x*.027,candidate.y*.027,389)*Math.PI,seed,wallPower:3.1+hash21(candidate.x*.031,candidate.y*.031,401)*3.8,crownPower:.32+hash21(candidate.x*.037,candidate.y*.037,419)*.26});
    peaks.push(candidate);if(peaks.length>=maxPeaks)break;
  }
  return peaks;
}
detectPeaks=detectPeaksRichV330;

function buildPeakLinksV330(peaks){
  const links=[];
  for(let i=0;i<peaks.length;i++){
    const a=peaks[i],near=peaks.map((b,j)=>({b,j,d:j===i?Infinity:Math.hypot(a.x-b.x,a.y-b.y)})).sort((u,v)=>u.d-v.d).slice(0,1);
    for(const {b,j,d} of near){
      if(j<i||d<250||d>760)continue;
      const seed=hash21(a.seed,b.seed,433),width=clamp(44+d*.065,58,116),height=Math.min(a.targetHeight,b.targetHeight)*(.16+seed*.12);
      links.push({a,b,d,width,height,seed});
    }
  }
  return links;
}
function peakLinkAtV330(worldX,worldY,links){
  let delta=0;
  for(const link of links){
    const ax=link.a.x,ay=link.a.y,bx=link.b.x,by=link.b.y,dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
    const t=clamp(((worldX-ax)*dx+(worldY-ay)*dy)/den,.08,.92),px=ax+dx*t,py=ay+dy*t,d=Math.hypot(worldX-px,worldY-py);
    if(d>link.width*1.8)continue;
    const along=Math.sin(t*Math.PI),profile=Math.pow(clamp(1-d/link.width,0,1),.55)*along;
    const warp=.78+.22*fbm(worldX*.0028,worldY*.0028,link.seed,3);
    delta=Math.max(delta,link.height*profile*warp);
  }
  return delta;
}

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let best=-Infinity,second=-Infinity,bestRatio=0,bestInfluence=0,footCut=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.45||Math.abs(qy)>1.45)continue;
    const az=Math.atan2(qy,qx),lobe=1+.10*Math.cos(az*3+peak.seed*.0017)+.045*Math.cos(az*5-peak.angle);
    qx/=lobe;qy/=lobe;
    const warpScale=.0019,wx=fbm(worldX*warpScale,worldY*warpScale,peak.seed+7,4),wy=fbm(worldX*warpScale+8.1,worldY*warpScale-5.2,peak.seed+23,4);
    qx+=wx*.07;qy+=wy*.07;
    const r=Math.hypot(qx,qy);if(r>1.30)continue;
    const radial=clamp(r,0,1);
    const wall=Math.pow(clamp(1-Math.pow(radial,peak.wallPower),0,1),.38);
    const crown=Math.pow(clamp(1-radial,0,1),peak.crownPower);
    const shoulder=1-.10*smoothstep(.48,.78,radial)+.05*ridged(worldX*.0055,worldY*.0055,peak.seed+61,3);
    const profile=clamp((wall*.76+crown*.24)*shoulder,0,1.16);
    const desired=peak.floor+peak.targetHeight*profile+fineResidual*.10;
    const influence=1-smoothstep(1.00,1.28,r),candidate=(desired-zBase)*influence;
    const ring=smoothstep(.86,.99,r)*(1-smoothstep(.99,1.24,r));footCut=Math.max(footCut,peak.targetHeight*.07*ring);
    if(candidate>best){second=best;best=candidate;bestRatio=peak.ratio;bestInfluence=influence}else if(candidate>second)second=candidate;
  }
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};
  const blended=Number.isFinite(second)?smoothMaxV322(best,second,18):best;
  return{delta:blended-footCut,influence:bestInfluence,ratio:bestRatio};
};

processMicro=function(worldX,worldY,gx,gy,karstMask,seed=0){
  if(karstMask<.001)return 0;
  const slopeAngle=Math.atan2(gy,gx),contourAngle=slopeAngle+Math.PI*.5;
  const [wx,wy]=domainWarp(worldX*.0038,worldY*.0038,seed+3);
  const macroRidge=(ridged(wx*1.45,wy*1.45,seed+17,5)-.56)*1.05;
  const contour=gaborV330(worldX,worldY,contourAngle,26,seed+41)*.34;
  const grooves=-Math.pow(clamp((gaborV330(worldX,worldY,slopeAngle,18,seed+67)+1)*.5,0,1),5)*1.35;
  const solution=worley(worldX*.020+fbm(worldX*.0024,worldY*.0024,seed+83)*.8,worldY*.020,seed+97);
  const pockets=-smoothstep(.34,.065,solution.f1)*.72;
  const crackCellA=worley(worldX*.010,worldY*.010,seed+113),crackCellB=worley(worldX*.026,worldY*.026,seed+137),crackCellC=worley(worldX*.061,worldY*.061,seed+151);
  const crackA=-smoothstep(.105,.014,crackCellA.f2-crackCellA.f1)*.62;
  const crackB=-smoothstep(.080,.010,crackCellB.f2-crackCellB.f1)*.38;
  const crackC=-smoothstep(.055,.008,crackCellC.f2-crackCellC.f1)*.16;
  const crumble=(turbulenceV330(worldX*.016,worldY*.016,seed+179,4)-.48)*.32;
  return clamp((macroRidge+contour+grooves+pockets+crackA+crackB+crackC+crumble)*karstMask,-4.2,2.4);
};

paddyDetail=function(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const parent=valleyMask*smoothstep(12,2.2,slopeDeg);if(parent<.001)return{delta:0,bund:0,channel:0,mask:0};
  const grammar=parcelGrammarV330(worldX,worldY,seed),terraceStep=.34+grammar.fieldSeed*.22;
  const contourWarp=fbm(worldX*.005,worldY*.005,seed+211,3)*.16;
  const terrace=Math.round((base+contourWarp)/terraceStep)*terraceStep;
  const flatten=clamp((terrace-base)*.68,-.38,.38);
  const bund=grammar.boundary*(.18+grammar.fieldSeed*.25);
  const channel=grammar.irrigation*(.12+.12*(1-grammar.fieldSeed));
  const micro=(fbm(worldX*.095,worldY*.095,seed+239,2)*.035)*(1-grammar.boundary);
  const delta=clamp((flatten+bund-channel+micro)*parent,-.48,.46);
  return{delta,bund:bund*parent,channel:channel*parent,mask:parent,fieldSeed:grammar.fieldSeed,wetness:grammar.wetness};
};

const prepareRiverSectionsV330=prepareRiverSections;
prepareRiverSections=function(riverModel,localCenter,extent,data,candidate){
  const base=prepareRiverSectionsV330(riverModel,localCenter,extent,data,candidate);if(!base?.length)return base;
  const smooth=[];const radius=9;
  for(let i=0;i<base.length;i++){
    let sx=0,sy=0,sw=0,sh=0,count=0;
    for(let j=Math.max(0,i-radius);j<=Math.min(base.length-1,i+radius);j++){const w=1-Math.abs(j-i)/(radius+1);sx+=base[j].x*w;sy+=base[j].y*w;sw+=base[j].width*w;sh+=base[j].water*w;count+=w}
    smooth.push({...base[i],x:sx/count,y:sy/count,width:clamp(sw/count*1.28,68,148),water:sh/count});
  }
  for(let i=0;i<smooth.length;i++){
    const prev=smooth[Math.max(0,i-1)],next=smooth[Math.min(smooth.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;
    smooth[i].tx=dx/len;smooth[i].ty=dy/len;smooth[i].nx=-smooth[i].ty;smooth[i].ny=smooth[i].tx;
    if(i>0&&i<smooth.length-1){const a=Math.atan2(smooth[i].y-smooth[i-1].y,smooth[i].x-smooth[i-1].x),b=Math.atan2(smooth[i+1].y-smooth[i].y,smooth[i+1].x-smooth[i].x);smooth[i].curvature=Math.atan2(Math.sin(b-a),Math.cos(b-a))}
  }
  state.richRiverSections=smooth;return smooth;
};

const buildRegionalFieldsV330=buildRegionalFields;
buildRegionalFields=function(analysis){
  const {n,truth,small,worldX,worldY,valley,karst,extent}=analysis,peaks=detectPeaksRichV330(analysis,isMobile?34:48),links=buildPeakLinksV330(peaks),final=new Float32Array(n*n),tone=new Float32Array(n*n),macro=new Float32Array(n*n),micro=new Float32Array(n*n);
  let macroMin=Infinity,macroMax=-Infinity;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,lx=(x/(n-1)-.5)*extent,ly=(z/(n-1)-.5)*extent,edge=edgeFeather(lx,ly,extent,.075),zBase=lerp(truth[i],small[i],.82),env=peakEnvelopeAt(worldX[x],worldY[z],zBase,truth[i]-small[i],peaks);
    const link=peakLinkAtV330(worldX[x],worldY[z],links),protect=1-valley[i]*.995;
    const delta=valley[i]>.58?0:clamp((Math.max(0,env.delta)*.48+link*.28)*protect*edge,-8,86);
    macro[i]=delta;final[i]=zBase+state.enhanceMix*delta*state.macro;tone[i]=clamp(valley[i]*.72+analysis.wetness[i]*.18-karst[i]*.08,0,1);macroMin=Math.min(macroMin,delta);macroMax=Math.max(macroMax,delta);
  }
  return{...analysis,macro,micro,final,tone,peaks,links,stats:{macroMin,macroMax,microMin:0,microMax:0,ratioMin:0,ratioMax:0,valleyMeanMacroAbs:0,valleyVertices:0}};
};

buildContextFields=function(analysis,peaks,mode){
  const {n,truth,small,worldX,worldY,gradX,gradY,valley,karst,paddy,extent}=analysis,links=buildPeakLinksV330(peaks);
  const macro=new Float32Array(n*n),micro=new Float32Array(n*n),final=new Float32Array(n*n),tone=new Float32Array(n*n),erosion=new Float32Array(n*n),talus=new Float32Array(n*n);
  let macroMin=Infinity,macroMax=-Infinity,microMin=Infinity,microMax=-Infinity,ratioMin=Infinity,ratioMax=-Infinity,valleyMacroAbs=0,valleyVertices=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,lx=(x/(n-1)-.5)*extent,ly=(z/(n-1)-.5)*extent,edge=edgeFeather(lx,ly,extent,.12),zBase=lerp(truth[i],small[i],.48),fine=truth[i]-small[i];
    const env=peakEnvelopeAt(worldX[x],worldY[z],zBase,fine,peaks),bridge=peakLinkAtV330(worldX[x],worldY[z],links),slope=analysis.slope[i];
    const flowGroove=-smoothstep(.70,.94,ridged(worldX[x]*.0062+fbm(worldX[x]*.0015,worldY[z]*.0015,529,3),worldY[z]*.0062,547,4))*smoothstep(12,47,slope)*3.6;
    const thermal=smoothstep(18,36,slope)*(1-smoothstep(41,64,slope))*(.45+.55*analysis.sediment[i])*1.25;
    const parentProtect=1-valley[i]*.998;
    let macroDelta=(Math.max(0,env.delta)+bridge*.72+flowGroove+thermal)*parentProtect*edge;
    if(mode==='paddy')macroDelta*=.78;
    if(valley[i]>.58)macroDelta=0;
    macroDelta=clamp(macroDelta,-24,235);
    const microDelta=processMicro(worldX[x],worldY[z],gradX[i],gradY[i],karst[i],317)*.32*edge;
    macro[i]=macroDelta;micro[i]=microDelta;erosion[i]=flowGroove;talus[i]=thermal;
    final[i]=zBase+state.enhanceMix*(macroDelta*state.macro+microDelta*state.process);
    tone[i]=clamp(paddy[i]*.98+analysis.wetness[i]*.34+valley[i]*.16-analysis.exposure[i]*.22,0,1);
    macroMin=Math.min(macroMin,macroDelta);macroMax=Math.max(macroMax,macroDelta);microMin=Math.min(microMin,microDelta);microMax=Math.max(microMax,microDelta);
    if(env.ratio>0){ratioMin=Math.min(ratioMin,env.ratio);ratioMax=Math.max(ratioMax,env.ratio)}if(valley[i]>.6){valleyMacroAbs+=Math.abs(macroDelta);valleyVertices++}
  }
  return{...analysis,peaks,links,macro,micro,erosion,talus,final,tone,stats:{macroMin,macroMax,microMin,microMax,ratioMin:Number.isFinite(ratioMin)?ratioMin:0,ratioMax:Number.isFinite(ratioMax)?ratioMax:0,valleyMeanMacroAbs:valleyVertices?valleyMacroAbs/valleyVertices:0,valleyVertices}};
};

const applyRiverToFieldV330=applyRiverToFieldV322;
applyRiverToFieldV322=function(field,sections){
  const result=applyRiverToFieldV330(field,sections),index=makeRiverIndexV322(sections),riverQ=new Float32Array(field.n*field.n),riverSide=new Float32Array(field.n*field.n);
  riverQ.fill(99);
  if(index)for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
    const i=z*field.n+x,nearest=nearestRiverV322(index,field.worldX[x],field.worldY[z]);if(!nearest)continue;
    riverQ[i]=nearest.distance/(nearest.section.width*.5);riverSide[i]=nearest.side;
  }
  result.riverQ=riverQ;result.riverSide=riverSide;return result;
};

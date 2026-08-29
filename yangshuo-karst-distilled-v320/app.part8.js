/* v3.2.3 DEM-led peak profile and de-quantised base. */
pickFocus=function(data,candidate,mode){
  const [minX,minY,maxX,maxY]=candidate.bounds,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  let best={x:cx,y:cy,score:-Infinity};
  const radius=mode==='cliff'?3900:5200,step=mode==='cliff'?90:125;
  for(let y=cy-radius;y<=cy+radius;y+=step)for(let x=cx-radius;x<=cx+radius;x+=step){
    if(x<minX+950||x>maxX-950||y<minY+950||y>maxY-950)continue;
    const h=sampleSource(data,candidate,x,y),s=slopeAtSource(data,candidate,x,y,37.5);
    const r300=ringReliefAt(data,candidate,x,y,300),r700=ringReliefAt(data,candidate,x,y,700),r1400=ringReliefAt(data,candidate,x,y,1400);
    const distance=Math.hypot(x-cx,y-cy);let score;
    if(mode==='cliff')score=s*4.8+(-r300)*.9+(-r700)*.42-distance*.0007;
    else if(mode==='paddy')score=r300*.75+r700*1.65+r1400*.82-s*24-h*.012-distance*.00035;
    else score=r300*.55+r700*1.15+r1400*.52-s*10-h*.006-distance*.00024;
    if(score>best.score)best={x,y,score,height:h,slope:s,r300,r700,r1400};
  }
  return best;
};

detectPeaks=function(analysis,maxPeaks=38){
  const {n,spacing,medium,coarse,worldX,worldY}=analysis,candidates=[];
  const step=Math.max(2,Math.round(75/spacing)),radius=Math.max(2,Math.round(112/spacing));
  for(let z=radius;z<n-radius;z+=step)for(let x=radius;x<n-radius;x+=step){
    const i=z*n+x,prominence=medium[i]-coarse[i];if(prominence<15)continue;
    const h=medium[i];let peak=true;
    for(const [dx,dz] of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]])if(medium[(z+dz)*n+x+dx]>h){peak=false;break}
    if(!peak)continue;
    const score=prominence*1.9+analysis.slope[i]*.28+ridged(worldX[x]*.0014,worldY[z]*.0014,19,3)*8;
    candidates.push({x:worldX[x],y:worldY[z],gridX:x,gridY:z,prominence,floor:coarse[i],score});
  }
  candidates.sort((a,b)=>b.score-a.score);const peaks=[];
  for(const candidate of candidates){
    const minimumDistance=clamp(235+candidate.prominence*.72,255,520);
    if(peaks.some(peak=>Math.hypot(peak.x-candidate.x,peak.y-candidate.y)<minimumDistance))continue;
    const rank=peaks.length,major=rank<14,h=hash21(candidate.x*.01,candidate.y*.01,31),h2=hash21(candidate.x*.013,candidate.y*.013,47);
    candidate.targetHeight=major?clamp(candidate.prominence*1.18+58+h*54,92,215):clamp(candidate.prominence*.96+32+h*40,58,145);
    candidate.ratio=1.02+h2*.55;
    const meanRadius=clamp(candidate.targetHeight/(candidate.ratio*2)*1.45,62,190),stretch=.76+hash21(candidate.x*.017,candidate.y*.017,73)*.58;
    candidate.radiusX=meanRadius*stretch;candidate.radiusY=meanRadius/stretch;candidate.angle=hash21(candidate.x*.021,candidate.y*.021,91)*Math.PI;candidate.seed=Math.floor(hash21(candidate.x,candidate.y,131)*100000);
    peaks.push(candidate);if(peaks.length>=maxPeaks)break;
  }
  return peaks;
};

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let bestDelta=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;if(Math.abs(qx)>1.42||Math.abs(qy)>1.42)continue;
    const angle=Math.atan2(qy,qx),angular=1+.09*Math.cos(angle*3+peak.angle)+.045*Math.cos(angle*5+peak.seed*.001);qx/=angular;qy/=angular;
    qx+=fbm(worldX*.0018,worldY*.0018,peak.seed,3)*.055;qy+=fbm(worldX*.0018+7.2,worldY*.0018-3.8,peak.seed+19,3)*.055;
    const radius=Math.hypot(qx,qy);if(radius>1.28)continue;
    const radial=clamp(radius,0,1),profile=Math.pow(clamp(1-Math.pow(radial,4.4),0,1),.82),actualRelief=Math.max(0,zBase-peak.floor);
    const existingShape=actualRelief*(1+.16*smoothstep(18,peak.targetHeight,actualRelief)),profileShape=peak.targetHeight*profile,desiredRelief=Math.max(existingShape,lerp(actualRelief,profileShape,.46));
    const influence=1-smoothstep(.98,1.27,radius),footRing=smoothstep(.88,1.01,radius)*(1-smoothstep(1.01,1.24,radius));
    const delta=(desiredRelief-actualRelief)*influence-Math.min(12,peak.targetHeight*.055)*footRing;
    if(delta>bestDelta){bestDelta=delta;bestRatio=peak.ratio;bestInfluence=influence}
  }
  if(!Number.isFinite(bestDelta))return{delta:0,influence:0,ratio:0};return{delta:bestDelta,influence:bestInfluence,ratio:bestRatio};
};

buildRegionalFields=function(analysis){
  const {n,truth,small,relief,karst,valley,extent}=analysis,final=new Float32Array(n*n),tone=new Float32Array(n*n),macro=new Float32Array(n*n),micro=new Float32Array(n*n);let macroMax=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,lx=(x/(n-1)-.5)*extent,ly=(z/(n-1)-.5)*extent,edge=edgeFeather(lx,ly,extent,.07),zBase=lerp(truth[i],small[i],.88),delta=clamp(relief[i]*.045,0,11)*karst[i]*(1-valley[i])*.45*edge;
    macro[i]=delta;final[i]=zBase+state.enhanceMix*delta*state.macro;tone[i]=clamp(valley[i]*.42-karst[i]*.05,0,1);macroMax=Math.max(macroMax,delta);
  }
  return{...analysis,macro,micro,final,tone,peaks:[],stats:{macroMin:0,macroMax,microMin:0,microMax:0,ratioMin:0,ratioMax:0,valleyMeanMacroAbs:0,valleyVertices:0}};
};

buildContextFields=function(analysis,peaks,mode){
  const {n,truth,small,worldX,worldY,gradX,gradY,valley,karst,paddy,extent}=analysis,macro=new Float32Array(n*n),micro=new Float32Array(n*n),final=new Float32Array(n*n),tone=new Float32Array(n*n);
  let macroMin=Infinity,macroMax=-Infinity,microMin=Infinity,microMax=-Infinity,ratioMin=Infinity,ratioMax=-Infinity,valleyMacroAbs=0,valleyVertices=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,lx=(x/(n-1)-.5)*extent,ly=(z/(n-1)-.5)*extent,edge=edgeFeather(lx,ly,extent,.14),zBase=lerp(truth[i],small[i],.78),fine=truth[i]-small[i],envelope=peakEnvelopeAt(worldX[x],worldY[z],zBase,fine,peaks);
    let macroDelta=valley[i]>.52?0:clamp(envelope.delta,-14,76)*(1-valley[i]*.998)*edge;if(mode==='paddy')macroDelta*=.66;
    const microDelta=processMicro(worldX[x],worldY[z],gradX[i],gradY[i],karst[i],317)*.10*edge;
    macro[i]=macroDelta;micro[i]=microDelta;final[i]=zBase+state.enhanceMix*(macroDelta*state.macro+microDelta*state.process);tone[i]=clamp(paddy[i]*.90+valley[i]*.18-karst[i]*.06,0,1);
    macroMin=Math.min(macroMin,macroDelta);macroMax=Math.max(macroMax,macroDelta);microMin=Math.min(microMin,microDelta);microMax=Math.max(microMax,microDelta);
    if(envelope.ratio>0){ratioMin=Math.min(ratioMin,envelope.ratio);ratioMax=Math.max(ratioMax,envelope.ratio)}if(valley[i]>.6){valleyMacroAbs+=Math.abs(macroDelta);valleyVertices++}
  }
  return{...analysis,peaks,macro,micro,final,tone,stats:{macroMin,macroMax,microMin,microMax,ratioMin:Number.isFinite(ratioMin)?ratioMin:0,ratioMax:Number.isFinite(ratioMax)?ratioMax:0,valleyMeanMacroAbs:valleyVertices?valleyMacroAbs/valleyVertices:0,valleyVertices}};
};

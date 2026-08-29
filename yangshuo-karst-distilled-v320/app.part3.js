  return{all:dense,focus};
}

function sampleTruthGrid(data,candidate,center,extent,n){
  const spacing=extent/(n-1),half=extent*.5,truth=new Float32Array(n*n),worldX=new Float64Array(n),worldY=new Float64Array(n);
  for(let i=0;i<n;i++){worldX[i]=center.x-half+i*spacing;worldY[i]=center.y-half+i*spacing}
  let min=Infinity,max=-Infinity,valid=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const h=sampleSource(data,candidate,worldX[x],worldY[z]),i=z*n+x;truth[i]=h;if(validHeight(h)){min=Math.min(min,h);max=Math.max(max,h);valid++}}
  return{truth,n,spacing,extent,center,worldX,worldY,min,max,validFraction:valid/truth.length};
}

function boxBlur(src,n,radius){
  if(radius<=0)return new Float32Array(src);const w=n+1,integral=new Float64Array(w*w);
  for(let z=0;z<n;z++){let row=0;for(let x=0;x<n;x++){row+=src[z*n+x];integral[(z+1)*w+x+1]=integral[z*w+x+1]+row}}
  const out=new Float32Array(n*n);
  for(let z=0;z<n;z++){const z0=Math.max(0,z-radius),z1=Math.min(n-1,z+radius);for(let x=0;x<n;x++){const x0=Math.max(0,x-radius),x1=Math.min(n-1,x+radius);const sum=integral[(z1+1)*w+x1+1]-integral[z0*w+x1+1]-integral[(z1+1)*w+x0]+integral[z0*w+x0];out[z*n+x]=sum/((x1-x0+1)*(z1-z0+1))}}
  return out;
}

function analyzeGrid(grid){
  const {truth,n,spacing}=grid;const small=boxBlur(truth,n,Math.max(1,Math.round(25/spacing))),medium=boxBlur(truth,n,Math.max(2,Math.round(90/spacing))),coarse=boxBlur(truth,n,Math.max(3,Math.round(360/spacing)));
  const relief=new Float32Array(n*n),slope=new Float32Array(n*n),gradX=new Float32Array(n*n),gradY=new Float32Array(n*n),valley=new Float32Array(n*n),karst=new Float32Array(n*n),paddy=new Float32Array(n*n);
  let valleyCount=0,karstCount=0,paddyCount=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,x0=Math.max(0,x-1),x1=Math.min(n-1,x+1),z0=Math.max(0,z-1),z1=Math.min(n-1,z+1);const gx=(small[z*n+x1]-small[z*n+x0])/((x1-x0)*spacing||1),gy=(small[z1*n+x]-small[z0*n+x])/((z1-z0)*spacing||1);const deg=Math.atan(Math.hypot(gx,gy))*180/Math.PI,r=medium[i]-coarse[i];
    relief[i]=r;slope[i]=deg;gradX[i]=gx;gradY[i]=gy;
    const v=smoothstep(18,-8,r)*smoothstep(11,2,deg);const k=smoothstep(8,42,r)*(1-smoothstep(58,82,deg));const f=v*smoothstep(8,2,deg);
    valley[i]=v;karst[i]=k;paddy[i]=f;if(v>.5)valleyCount++;if(k>.35)karstCount++;if(f>.5)paddyCount++;
  }
  return{...grid,small,medium,coarse,relief,slope,gradX,gradY,valley,karst,paddy,valleyFraction:valleyCount/truth.length,karstFraction:karstCount/truth.length,paddyFraction:paddyCount/truth.length};
}

function detectPeaks(analysis,maxPeaks=58){
  const {n,spacing,medium,coarse,worldX,worldY}=analysis,candidates=[],step=Math.max(2,Math.round(50/spacing)),r=Math.max(2,Math.round(75/spacing));
  for(let z=r;z<n-r;z+=step)for(let x=r;x<n-r;x+=step){const i=z*n+x,prom=medium[i]-coarse[i];if(prom<18)continue;const h=medium[i];let peak=true;for(const [dx,dz] of [[-r,0],[r,0],[0,-r],[0,r],[-r,-r],[r,-r],[-r,r],[r,r]])if(medium[(z+dz)*n+x+dx]>h){peak=false;break}if(!peak)continue;const rough=ridged(worldX[x]*.0018,worldY[z]*.0018,19,3),score=prom*1.5+analysis.slope[i]*.6+rough*12;candidates.push({x:worldX[x],y:worldY[z],gridX:x,gridY:z,prominence:prom,floor:coarse[i],score})}
  candidates.sort((a,b)=>b.score-a.score);const peaks=[];
  for(const c of candidates){const minimumDistance=clamp(90+c.prominence*.28,100,230);if(peaks.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<minimumDistance))continue;const h=hash21(c.x*.01,c.y*.01,31),h2=hash21(c.x*.013,c.y*.013,47),targetHeight=c.prominence+clamp(c.prominence*.34+10+h*24,14,78),ratio=1.22+h2*.92,meanRadius=clamp(targetHeight/(ratio*2),48,165),stretch=.76+hash21(c.x*.017,c.y*.017,73)*.58;c.targetHeight=targetHeight;c.ratio=ratio;c.radiusX=meanRadius*stretch;c.radiusY=meanRadius/stretch;c.angle=hash21(c.x*.021,c.y*.021,91)*Math.PI;c.profile=.34+hash21(c.x*.027,c.y*.027,113)*.18;c.seed=Math.floor(hash21(c.x,c.y,131)*100000);peaks.push(c);if(peaks.length>=maxPeaks)break}
  return peaks;
}

function peakEnvelopeAt(worldX,worldY,truth,fineResidual,peaks){
  let best=-Infinity,bestInfluence=0,bestRatio=0;
  for(const p of peaks){const ca=Math.cos(p.angle),sa=Math.sin(p.angle),dx=worldX-p.x,dy=worldY-p.y;let qx=(dx*ca+dy*sa)/p.radiusX,qy=(-dx*sa+dy*ca)/p.radiusY;if(Math.abs(qx)>1.55||Math.abs(qy)>1.55)continue;const warpX=fbm(worldX*.0024,worldY*.0024,p.seed,3)*.13,warpY=fbm(worldX*.0024+7.2,worldY*.0024-3.8,p.seed+19,3)*.13;qx+=warpX;qy+=warpY;const r=Math.hypot(qx,qy);if(r>1.38)continue;const t=clamp(1-r,0,1);let profile=Math.pow(t,p.profile)*(0.72+0.28*Math.pow(t,2.4));const asym=1+(valueNoise(worldX*.0065,worldY*.0065,p.seed+7)*.07)+(Math.cos(Math.atan2(qy,qx)*3+p.angle)*.035*t);profile*=clamp(asym,.82,1.16);const candidate=p.floor+p.targetHeight*profile+fineResidual*.28;const influence=smoothstep(1.38,.82,r);if(candidate>best){best=candidate;bestInfluence=influence;bestRatio=p.ratio}}
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};return{delta:(best-truth)*bestInfluence,influence:bestInfluence,ratio:bestRatio};
}

function processMicro(worldX,worldY,gx,gy,karstMask,seed=0){
  if(karstMask<.001)return 0;const [wx,wy]=domainWarp(worldX*.0055,worldY*.0055,seed+3);const ridge=ridged(wx*2.2,wy*2.2,seed+17,4)-.55;const cell=worley(worldX*.028+fbm(worldX*.002,worldY*.002,seed+33)*.8,worldY*.028,seed+71);const pits=-smoothstep(.37,.08,cell.f1)*.72;
  const angle=Math.atan2(gy,gx)+Math.PI*.5,along=worldX*Math.cos(angle)+worldY*Math.sin(angle),across=-worldX*Math.sin(angle)+worldY*Math.cos(angle);const flowPhase=across*.045+fbm(worldX*.004,worldY*.004,seed+91,3)*2.4;const flow=-Math.pow(clamp(1-Math.abs(Math.sin(flowPhase)),0,1),7)*1.05;const layer=Math.sin(along*.065+fbm(worldX*.003,worldY*.003,seed+121,3)*1.7)*.36;const crackA=-Math.pow(clamp(1-Math.abs(Math.sin((worldX*.082+worldY*.027)+fbm(worldX*.006,worldY*.006,seed+151)*2.8)),0,1),10)*.82;const crackB=-Math.pow(clamp(1-Math.abs(Math.sin((worldX*-.036+worldY*.094)+fbm(worldX*.011,worldY*.011,seed+181)*1.9)),0,1),13)*.42;return clamp((ridge*1.15+pits+flow+layer+crackA+crackB)*karstMask,-2.6,2.2);
}

function buildContextFields(analysis,peaks,mode){
  const {n,truth,small,worldX,worldY,gradX,gradY,valley,karst,paddy,extent}=analysis,macro=new Float32Array(n*n),micro=new Float32Array(n*n),final=new Float32Array(n*n),tone=new Float32Array(n*n);let macroMin=Infinity,macroMax=-Infinity,microMin=Infinity,microMax=-Infinity,ratioMin=Infinity,ratioMax=-Infinity,valleyMacroAbs=0,valleyVertices=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,localX=(x/(n-1)-.5)*extent,localY=(z/(n-1)-.5)*extent,edge=edgeFeather(localX,localY,extent,.095),fine=truth[i]-small[i];const env=peakEnvelopeAt(worldX[x],worldY[z],truth[i],fine,peaks);let md=valley[i]>.52?0:clamp(env.delta,-32,92)*(1-valley[i]*.98)*edge;if(mode==='paddy')md*=.72;const mi=processMicro(worldX[x],worldY[z],gradX[i],gradY[i],karst[i],317)*edge;macro[i]=md;micro[i]=mi;final[i]=truth[i]+state.enhanceMix*(md*state.macro+mi*state.process);tone[i]=clamp(paddy[i]*.95+valley[i]*.22-karst[i]*.12,0,1);macroMin=Math.min(macroMin,md);macroMax=Math.max(macroMax,md);microMin=Math.min(microMin,mi);microMax=Math.max(microMax,mi);if(env.ratio>0){ratioMin=Math.min(ratioMin,env.ratio);ratioMax=Math.max(ratioMax,env.ratio)}if(valley[i]>.6){valleyMacroAbs+=Math.abs(md);valleyVertices++}

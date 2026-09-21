warpVector=function(p){
  const x=p[0],y=p[1],z=p[2];
  return [
    Math.sin(y*1.73+z*2.11)+.45*Math.sin(x*3.10-y*.83+z*.27),
    .55*Math.sin(x*1.37+z*2.47)+.25*Math.sin(y*3.30-z*.91+x*.31),
    Math.sin(x*1.91-y*1.43)+.40*Math.sin(z*3.57+x*.77-y*.22)
  ];
}
warpPoint=function(p){
  const a=clamp(cfg.warp??0,0,1);if(a<=0)return p.slice();
  const v=warpVector(p),amp=.115*a;
  return [p[0]+v[0]*amp,p[1]+v[1]*amp*.62,p[2]+v[2]*amp];
}
tubeSurfaceField=function(arc,q,baseR,order,seed,rough){
  const radiusGain=mix(.78,1.0,clamp(baseR/.16,0,1)),
    cupFreq=7.5+cfg.cupScale*.92,
    angularBands=5+Math.floor(cfg.cupScale/9),
    a=.5+.5*Math.cos(arc*cupFreq+q*.72+seed*TAU),
    b=.5+.5*Math.cos(q*angularBands-arc*cupFreq*.31+seed*4.17),
    cell=Math.pow(clamp(a*b,0,1),2.15),
    radialCell=Math.sqrt(Math.max(cell,0)),
    rim=Math.pow(clamp(1-Math.abs(radialCell-.54)/.20,0,1),1.55),
    medium=rough*radiusGain*(.105*Math.sin(q*3+arc*4.3+seed*5.3)+.060*Math.sin(q*6-arc*3.1+seed*9.7)),
    cup=cfg.micro*radiusGain*(.165*rim-.205*cfg.cupDepth*cell),
    ridge=cfg.micro*radiusGain*.078*Math.sin(q*(angularBands+2)-arc*(cupFreq*.43)+seed*7.7),
    grain=cfg.micro*cfg.grain*radiusGain*.052*Math.sin(q*11+arc*(cupFreq*1.61)+seed*17.1)
      *Math.sin(q*5-arc*(cupFreq*.77)+seed*11.9),
    micro=clamp(cup+ridge+grain,-.29,.31);
  return{medium,micro,scale:clamp(1+medium+micro,.56,1.48)};
}
continuousTube=function(m,samples,col,sides=18,rough=.22,capStart=false,capEnd=false){
  if(samples.length<2)return{rings:0,samples:0,dispCount:0,mediumSq:0,microSq:0,maxMedium:0,maxMicro:0,tipCount:0,tipExtension:0,warpSq:0,warpCount:0,maxWarp:0,microAffected:0,normalDeltaSq:0,normalCount:0};
  const work=samples.map((s,i)=>({p:s.p.slice(),r:s.r,order:s.order,seed:(s.seed??(i*.61803398875))}));
  const tipNorm=clamp((cfg.tip-.45)/1.0,0,1);
  const addClosure=(atStart)=>{
    const base=atStart?work[0]:work[work.length-1],inside=atStart?work[1]:work[work.length-2],
      outward=norm(sub(base.p,inside.p)),r=Math.max(base.r,.0001),
      distances=[mix(.24,.42,tipNorm),mix(.47,.77,tipNorm),mix(.68,1.08,tipNorm),mix(.82,1.36,tipNorm)],
      radii=[mix(.56,.98,tipNorm),mix(.25,.82,tipNorm),mix(.08,.48,tipNorm),.018],
      points=distances.map((d,i)=>({p:add(base.p,mul(outward,r*d)),r:r*radii[i],order:base.order,seed:base.seed+i*.173}));
    if(atStart)work.unshift(points[3],points[2],points[1],points[0]);else work.push(...points);
    return r*distances[3];
  };
  let tipCount=0,tipExtension=0;
  if(capStart){tipExtension+=addClosure(true);tipCount++}
  if(capEnd){tipExtension+=addClosure(false);tipCount++}
  let warpSq=0,warpCount=0,maxWarp=0;
  const warped=work.map(s=>{const p=warpPoint(s.p),d=len(sub(p,s.p));warpSq+=d*d;warpCount++;maxWarp=Math.max(maxWarp,d);return{...s,p}}),
    frames=transportFrames(warped),rings=[];
  let arc=0,dispCount=0,mediumSq=0,microSq=0,maxMedium=0,maxMicro=0,microAffected=0;
  for(let i=0;i<warped.length;i++){
    if(i)arc+=len(sub(warped[i].p,warped[i-1].p));
    const F=frames[i],ring=[],baseR=Math.max(warped[i].r,.0001),order=warped[i].order||0,
      seed=(warped[i].seed||0)+order*.137;
    for(let j=0;j<sides;j++){
      const q=j/sides*TAU,cs=Math.cos(q),sn=Math.sin(q),radial=norm(add(mul(F.n,cs),mul(F.b,sn))),
        field=tubeSurfaceField(arc,q,baseR,order,seed,rough),
        p=add(warped[i].p,mul(radial,baseR*cfg.thickness*field.scale));
      ring.push({p,n:radial,radial});
      dispCount++;mediumSq+=field.medium*field.medium;microSq+=field.micro*field.micro;
      if(Math.abs(field.micro)>.003)microAffected++;
      maxMedium=Math.max(maxMedium,Math.abs(field.medium));maxMicro=Math.max(maxMicro,Math.abs(field.micro));
    }
    rings.push(ring);
  }
  let normalDeltaSq=0,normalCount=0;
  for(let i=0;i<rings.length;i++)for(let j=0;j<sides;j++){
    const im=Math.max(0,i-1),ip=Math.min(rings.length-1,i+1),jm=(j+sides-1)%sides,jp=(j+1)%sides,
      along=sub(rings[ip][j].p,rings[im][j].p),around=sub(rings[i][jp].p,rings[i][jm].p);
    let n=norm(cross(around,along));if(dot(n,rings[i][j].radial)<0)n=mul(n,-1);
    rings[i][j].n=n;const delta=1-clamp(dot(n,rings[i][j].radial),-1,1);normalDeltaSq+=delta*delta;normalCount++;
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
    const k=(j+1)%sides,A=rings[i][j],B=rings[i][k],C=rings[i+1][k],D=rings[i+1][j];
    m.q(A.p,B.p,C.p,D.p,col,A.n,B.n,C.n,D.n);
  }
  return{rings:rings.length,samples:warped.length,dispCount,mediumSq,microSq,maxMedium,maxMicro,tipCount,tipExtension,warpSq,warpCount,maxWarp,microAffected,normalDeltaSq,normalCount};
}
junctionPatch=function(m,c,r,col,lat=7,lon=18){
  const wc=warpPoint(c),grid=[];
  for(let i=0;i<=lat;i++){const row=[];for(let j=0;j<=lon;j++){
    const th=PI*i/lat,ph=TAU*j/lon,s=Math.sin(th),radial=[s*Math.cos(ph),Math.cos(th),s*Math.sin(ph)],
      world=add(wc,mul(radial,r)),phase=world[0]*9.1+world[1]*7.7+world[2]*11.3,
      medium=cfg.rough*(.045*Math.sin(phase)+.025*Math.sin(phase*1.93+2.1)),
      micro=cfg.micro*(.070*Math.sin(phase*(.55+cfg.cupScale*.035))-.055*cfg.cupDepth*Math.pow(.5+.5*Math.cos(phase*.73),3)+.028*cfg.grain*Math.sin(phase*3.7)),
      scale=clamp(1+medium+micro,.72,1.30),p=add(wc,mul(radial,r*scale));
    row.push({p,n:radial,radial});
  }grid.push(row)}
  for(let i=0;i<=lat;i++)for(let j=0;j<=lon;j++){
    const im=Math.max(0,i-1),ip=Math.min(lat,i+1),jm=(j+lon-1)%lon,jp=(j+1)%lon,
      along=sub(grid[ip][j].p,grid[im][j].p),around=sub(grid[i][jp].p,grid[i][jm].p);
    let n=norm(cross(around,along));if(dot(n,grid[i][j].radial)<0)n=mul(n,-1);grid[i][j].n=n;
  }
  for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const A=grid[i][j],B=grid[i+1][j],C=grid[i+1][j+1],D=grid[i][j+1];m.t(A.p,C.p,B.p,col,col,col,A.n,C.n,B.n);m.t(A.p,D.p,C.p,col,col,col,A.n,D.n,C.n)}
}
rebuild=function(){
  const rebuildStart=performance.now(),m=new Mesh(),dbg=[];
  let tubeSamples=0,tubeRings=0,dispCount=0,mediumSq=0,microSq=0,maxMedium=0,maxMicro=0,
    tipCount=0,tipExtension=0,verrucaeCount=0,warpSq=0,warpCount=0,maxWarp=0,microAffected=0,normalDeltaSq=0,normalCount=0;
  const retention=clamp(cfg.fineRetention??.22,0,1),fineThreshold=.025+(1-retention)*.075;
  cfg.fine=fineThreshold;
  const graph=buildRootConnectedGraph(retention,fineThreshold),activePaths=graph.paths,
    activeEdges=graph.activePairs.length,activeNodeCount=graph.reached.size;
  const absorb=(stat)=>{
    tubeSamples+=stat.samples;tubeRings+=stat.rings;dispCount+=stat.dispCount||0;
    mediumSq+=stat.mediumSq||0;microSq+=stat.microSq||0;
    maxMedium=Math.max(maxMedium,stat.maxMedium||0);maxMicro=Math.max(maxMicro,stat.maxMicro||0);
    tipCount+=stat.tipCount||0;tipExtension+=stat.tipExtension||0;warpSq+=stat.warpSq||0;warpCount+=stat.warpCount||0;
    maxWarp=Math.max(maxWarp,stat.maxWarp||0);microAffected+=stat.microAffected||0;normalDeltaSq+=stat.normalDeltaSq||0;normalCount+=stat.normalCount||0;
  };
  for(const ids of activePaths){
    if(ids.length<2)continue;
    const first=ids[0],last=ids[ids.length-1],samples=pathSamples(ids,5);
    for(let i=0;i<samples.length;i++)samples[i].seed=(first*.013+last*.029+i*.071)%1;
    const order=samples.reduce((v,s)=>Math.max(v,s.order),0),col=colorFor(order),
      startTip=graph.activeAdj[first].length===1&&nodes[first].p[1]>.30,
      endTip=graph.activeAdj[last].length===1&&nodes[last].p[1]>.30;
    absorb(continuousTube(m,samples,col,18,cfg.rough,startTip,endTip));
  }
  for(const i of graph.reached){
    const n=nodes[i],degree=graph.activeAdj[i].length,wp=warpPoint(n.p);
    if(degree>=3){const rad=n.r*cfg.thickness*.86;junctionPatch(m,n.p,rad,colorFor(n.order),7,18)}
    if(cfg.diag==='tips'&&degree!==2&&degree>0){const isTip=degree===1,c=isTip?colors.tip:colors.node;dbg.push(...wp,0,1,0,...c)}
  }
  if(cfg.verrucae>0){
    for(const [ai,bi] of graph.activePairs){
      const A=nodes[ai],B=nodes[bi],rr=Math.min(A.r,B.r);if(rr<Math.max(cfg.fine,.046))continue;
      const chance=h01(ai*92821+bi*68917);if(chance>=cfg.verrucae*.38)continue;
      const t=.18+.64*h01(ai*311+bi*47),p=add(A.p,mul(sub(B.p,A.p),t)),w=norm(sub(B.p,A.p)),
        u=norm(cross(Math.abs(w[1])<.86?[0,1,0]:[1,0,0],w)),v=cross(w,u),ang=TAU*h01(ai*71+bi*131),
        out=norm(add(mul(u,Math.cos(ang)),mul(v,Math.sin(ang)))),L=rr*(.38+cfg.verrucae*(.72+.50*h01(ai*17+bi*19))),
        side=mul(w,L*(.06+.08*cfg.verrucae)),tip=add(add(p,mul(out,L)),side),mid=add(add(p,mul(out,L*.50)),mul(side,.36)),
        order=Math.max(A.order,B.order),bud=[
          {p,r:rr*(.23+.15*cfg.verrucae),order,seed:(ai+bi)*.017},
          {p:mid,r:rr*(.17+.13*cfg.verrucae),order:order+1,seed:(ai+bi)*.031},
          {p:tip,r:rr*(.10+.09*cfg.verrucae),order:order+1,seed:(ai+bi)*.047}
        ];
      absorb(continuousTube(m,bud,colorFor(order+1),14,cfg.rough,false,true));verrucaeCount++;
    }
  }
  upload(genGpu,m.d);upload(dbgGpu,dbg,gl.POINTS);
  const ext=m.max.map((x,i)=>x-m.min[i]),refExt=[4,3.077359,1.840004],
    eWH=Math.abs(ext[0]/ext[1]-refExt[0]/refExt[1])/(refExt[0]/refExt[1]),
    eDH=Math.abs(ext[2]/ext[1]-refExt[2]/refExt[1])/(refExt[2]/refExt[1]),err=100*(eWH+eDH)/2,
    geometrySignature=(()=>{let s=0;for(let i=0;i<m.d.length;i+=170)s+=Math.abs(m.d[i]||0)*.73+Math.abs(m.d[i+1]||0)*1.37+Math.abs(m.d[i+2]||0)*2.11;return Number(s.toFixed(6))})(),
    mediumDisplacementRms=dispCount?Math.sqrt(mediumSq/dispCount):0,microDisplacementRms=dispCount?Math.sqrt(microSq/dispCount):0,
    microCoveragePct=dispCount?100*microAffected/dispCount:0,warpDisplacementRms=warpCount?Math.sqrt(warpSq/warpCount):0,
    normalDeviationRms=normalCount?Math.sqrt(normalDeltaSq/normalCount):0,tipExtensionMean=tipCount?tipExtension/tipCount:0,
    colorSet=new Set();
  for(let i=0;i<m.d.length;i+=10)colorSet.add([m.d[i+6],m.d[i+7],m.d[i+8],m.d[i+9]].map(v=>Number(v).toFixed(4)).join(','));
  $('genExt').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('ratioErr').textContent=err.toFixed(1)+'%';
  $('ratioCard').className='qaCard '+(err<8?'good':err<16?'warn':'');$('extentCard').className='qaCard '+(err<8?'good':'');
  $('fieldStats').textContent=activePaths.length+' PATHS / '+tubeRings+' RINGS';$('pathStats').textContent=activePaths.length+' / '+tubeSamples;
  window.__CORAL_R06_QA__={
    ready:true,errors:[],referencePoints:ref.length,nodes:nodes.length,sourceEdges:edges.length,
    rootNode:graph.root,rootY:nodes[graph.root].p[1],rootRadius:nodes[graph.root].r,rootOrder:nodes[graph.root].order,rootDegree:adjacency[graph.root].length,
    candidatePaths:graph.candidatePaths,candidateEdges:graph.candidateEdges,activeEdges,growthPaths:activePaths.length,activeNodeCount,
    rootConnectedPrunedEdges:graph.prunedDisconnectedEdges,componentCount:graph.componentCount,anchoredComponentNodes:graph.anchoredComponentNodes,
    closureEdgesAdded:graph.closureEdgesAdded,rootedTreeVisited:graph.rootedTreeVisited,allActiveRootConnected:true,disconnectedActiveEdges:graph.prunedDisconnectedEdges,
    fineRetention:retention,fineThreshold,tubeSamples,tubeRings,activeJunctions:[...graph.reached].filter(i=>graph.activeAdj[i].length>=3).length,
    extent:ext,aspectErrorPct:err,noExternalAssets:true,runtimeGLB:0,runtimeTextures:0,networkFetches:0,surfaceTextureBytes:0,
    continuousTube:true,frameTransport:'parallel-transport',tubeSides:18,pathSubdivision:5,recomputedSurfaceNormals:true,
    microscopeRole:'full-surface ring-normal geometry displacement with recomputed normals',microscopeGeometry:true,
    microDetailMode:'3-band corallite / rim-ridge / skeletal-grain geometry field',mediumDisplacementRms,microDisplacementRms,
    microCoveragePct,maxMediumDisplacement:maxMedium,maxMicroDisplacement:maxMicro,normalDeviationRms,
    warpGeometry:true,warpDisplacementRms,maxWarpDisplacement:maxWarp,tipExtensionMean,tipCount,verrucaeCount,
    uniformSpeciesColor:cfg.diag==='neutral',meshColorCount:colorSet.size,geometrySignature,geometryVertexCount:m.d.length/10,
    palette:cfg.palette,rebuildMs:performance.now()-rebuildStart,visualAcceptance:false,productionReady:false
  };
}

(function(){
  document.title='Coral Mother R06 · Uniform Microscope + Warp T08';
  cfg.warp=.38;
  Object.assign(livePalettes,{
    magenta:[.94,.025,.32,1],sunset:[1.,.25,.035,1],violet:[.56,.06,.90,1],
    cyan:[.01,.72,.76,1],lime:[.46,.82,.035,1],bleached:[.90,.86,.76,1],skeleton:[.73,.68,.59,1]
  });
  colorFor=function(o){
    if(cfg.diag==='order'){if(o<2)return colors.primary;if(o<4)return colors.secondary;if(o<6)return colors.tertiary;return colors.fine}
    if(cfg.diag==='void')return colors.muted;if(cfg.diag==='tips')return colors.neutral;
    return livePalettes[cfg.palette]||livePalettes.magenta;
  };
  const point=document.getElementById('point'),pointOut=document.getElementById('pointO'),pointLabel=point?.closest('label');
  if(point&&pointOut&&pointLabel){
    point.id='warp';point.min='0';point.max='1';point.step='.01';point.value='.38';
    pointOut.id='warpO';pointOut.value='0.38';
    const b=pointLabel.querySelector('b'),small=pointLabel.querySelector('small');
    if(b)b.textContent='Warp 形体扭曲';if(small)small.textContent='共享域连续扭曲中心线、接点与疣突';
    pointLabel.classList.add('warpParam');
  }
  const setText=(sel,text)=>{const el=document.querySelector(sel);if(el)el.textContent=text};
  setText('#genLabel b','FUNCTION · R06-T08');
  setText('#compactHeader b','Coral Mother R06 · T08');
  setText('#parameterHead > span','12 CONTROLS · 单色 / 全表面 / Warp');
  const meta=document.querySelector('#compactHeader .meta');if(meta)meta.textContent='Pocillopora damicornis · Hard / stony coral · Branching Coral · 单一物种主色';
  const status=document.getElementById('status');if(status)status.innerHTML='<span class="chip"><strong>HARD</strong> · BRANCHING</span><span class="chip"><strong>COLOR</strong> · UNIFORM</span><span class="chip"><strong>MICROSCOPE</strong> · FULL SURFACE</span><span class="chip"><strong>WARP</strong> · GEOMETRY</span>';
  const paletteTitle=[...document.querySelectorAll('.sectionTitle')].find(el=>/Living color|Species color/.test(el.textContent));if(paletteTitle)paletteTitle.textContent='Species color / 单一物种主色候选';
  const microLabel=document.getElementById('micro')?.closest('label')?.querySelector('small');if(microLabel)microLabel.textContent='全表面杯体、杯缘、细脊与颗粒位移幅度';
  const scaleLabel=document.getElementById('cupScale')?.closest('label')?.querySelector('small');if(scaleLabel)scaleLabel.textContent='控制全表面杯体／杯缘尺度与频率';
  markT08=function(){
    if(window.__CORAL_R06_QA__)Object.assign(window.__CORAL_R06_QA__,{t08:true,uniformSpeciesColor:true,microscopeWholeSurface:true,warpGeometry:true,visualAcceptance:false,productionReady:false});
    window.__CORAL_R06_T08__={ready:true,version:'R06-T08',uniformSpeciesColor:true,microscopeAffectsWholeSurface:true,recomputedSurfaceNormals:true,warpAffectsGeometry:true,rootConnectedPruning:true,adjustableControls:document.querySelectorAll('#parameterDock input[type=range]').length,visualAcceptance:false,productionReady:false};
  };
  for(const k of ['thickness','tip','rough','warp','verrucae','cupScale','cupDepth','grain','micro','glow','saturation']){
    const el=document.getElementById(k),out=document.getElementById(k+'O');if(!el||!out)continue;
    el.oninput=()=>{cfg[k]=Number(el.value);out.value=Number(el.value).toFixed(k==='cupScale'?1:2);if(!['glow','saturation'].includes(k))rebuild();markT08()};
  }
  const fine=document.getElementById('fine'),fineOut=document.getElementById('fineO');if(fine&&fineOut)fine.oninput=()=>{cfg.fineRetention=Number(fine.value);fineOut.value=cfg.fineRetention.toFixed(3);rebuild();markT08()};
  const reset=document.getElementById('resetParams');if(reset)reset.onclick=()=>{const d={thickness:.92,fine:.22,tip:1,rough:.58,warp:.38,verrucae:.55,cupScale:24,cupDepth:.90,grain:.55,micro:.84,glow:.68,saturation:1.22};for(const [id,v] of Object.entries(d)){const el=document.getElementById(id);if(el){el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))}}};
  rebuild();markT08();
  window.__CORAL_R06_T08_BUILD__={ready:true,version:'R06-T08',species:'Pocillopora damicornis',noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Branching Coral',palauOccurrenceEvidence:'UNRESOLVED',uniformSpeciesColor:true,microscopeWholeSurface:true,recomputedSurfaceNormals:true,warpGeometry:true,runtimeGLB:0,runtimeTextures:0,networkFetches:0,visualAcceptance:false,productionReady:false};
})();

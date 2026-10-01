/* Install the four original contoured waistbands on measured parent waist
 * vertices. This is temporary authoring placement, followed by original UV
 * metric projection and completed source stitch DOFs. Main panels are fixed
 * during handling. No paper, UV, mass or material is rewritten. */
function continueShortsWaistbands(simulation,frame,{maximumSweeps=1200,closeLeftOpening=true}={}){
 const s=simulation,ids=['WFL','WFR','WBR','WBL'],active=new Set(ids),pattern=s.pattern;
 if(!pattern||!frame?.up||!s.dofs)throw Error('Waist installation requires source pattern, measured frame and prior stitch DOFs');
 const before=JSON.stringify(s.particles.filter(p=>!active.has(p.pieceId)).map(p=>p.pos));
 const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);
 const main=s.particles.filter(p=>['FL','FR','BR','BL'].includes(p.pieceId)&&p.uv[1]===0),center=[0,0,0];
 for(const p of main)for(let k=0;k<3;k++)center[k]+=p.pos[k]/main.length;
 const newSeams=s.seams.filter(x=>(/^waist-|^waistband-/.test(x.id))&&(closeLeftOpening||x.id!=='waistband-BL-FL'));
 if(newSeams.length!==(closeLeftOpening?8:7))throw Error('Expected the original waistband source seams for this opening state');
 if(!closeLeftOpening){for(const id of ['side-opening-left','waistband-BL-FL']){const opening=s.seams.find(x=>x.id===id);if(!opening||opening.pairs.some(p=>p.started))throw Error('Open waistband stage requires the untouched original left opening');}}
 for(const p of s.particles)p.invMass=active.has(p.pieceId)?p.freeInvMass:0;
 for(const id of ids){
  const piece=pattern.pieces.find(x=>x.id===id),range=s.ranges.get(id),seam=s.seams.find(x=>x.id==='waist-'+piece.parentPanel),n=piece.grid.columns,rows=piece.grid.rows;
  if(!piece?.sourceContour||seam.pairs.length!==n+1)throw Error('Original sampled waistband contour required');
  const lower=seam.pairs.map(pair=>[...s.particles[pair.a].pos]);
  for(let c=0;c<=n;c++){
   const radial=sub(lower[c],center),vertical=dot(radial,frame.up);for(let k=0;k<3;k++)radial[k]-=vertical*frame.up[k];
   const radius=Math.hypot(...radial),fraction=1-piece.sourceContour.upperLength/piece.sourceContour.lowerLength;
   const inward=radius*fraction,height=piece.sourceContour.height;
   if(Math.abs(inward)>=height)throw Error('Measured waist contour cannot retain original cross-strip height');
   const upHeight=Math.sqrt(height*height-inward*inward);
   for(let r=0;r<=rows;r++){
    const t=r/rows,p=s.particles[range.offset+r*(n+1)+c];
    p.pos=lower[c].map((v,k)=>v+t*(upHeight*frame.up[k]-fraction*radial[k]));p.previous=[...p.pos];p.velocity=[0,0,0];
   }
  }
 }
 const completed=s.seams.filter(seam=>!newSeams.includes(seam)&&seam.pairs.every(pair=>pair.started&&s.dofs.same(pair.a,pair.b)));
 s.dofs=createShortsStitchDofs(s.particles,{joinTolerance:s.options.stitchJoinToleranceM});
 for(const seam of completed)for(const pair of seam.pairs)if(!s.dofs.same(pair.a,pair.b))s.dofs.join(pair.a,pair.b,{started:true,closureProgress:1});
 // The lower boundary is already on the actual parent boundary. Commit these
 // equality constraints before relaxing only free waistband rows.
 for(const seam of newSeams.filter(x=>x.id.startsWith('waist-')))for(const pair of seam.pairs){
  pair.started=true;pair.initialGap=0;if(!s.dofs.same(pair.a,pair.b)&&!s.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))throw Error('Parent waist source stitch failed');
 }
 const metrics=s.metrics.filter(x=>active.has(x.pieceId)),ring=newSeams.filter(x=>x.id.startsWith('waistband-'));
 const pull=()=>{for(const seam of ring)for(const pair of seam.pairs){const d=sub(s.particles[pair.a].pos,s.particles[pair.b].pos),length=Math.hypot(...d);if(length>1e-14)s.dofs.project([pair.a,pair.b],[d.map(v=>v/length),d.map(v=>-v/length)],length);}};
 let sweeps=0,material,gap;
 for(;sweeps<maximumSweeps;sweeps++){
  // Handling constrains the same original triangle principal stretches to the
  // existing 5% envelope. Forcing *zero* strain while the accepted parent waist
  // has nonzero measured strain is incompatible with a fixed lower boundary.
  for(const c of metrics)swcProjectPrincipalEnvelope(c,s.particles,s.dofs,.048);pull();
  if(sweeps%20===19){material=scMetricReport(metrics,s.particles);gap=Math.max(...ring.flatMap(x=>x.pairs.map(p=>scDist(s.particles[p.a].pos,s.particles[p.b].pos))));if(material.valid&&material.maxAbsPrincipalStrain<.049&&gap<1e-8)break;}
 }
 material=scMetricReport(metrics,s.particles);gap=Math.max(...ring.flatMap(x=>x.pairs.map(p=>scDist(s.particles[p.a].pos,s.particles[p.b].pos))));
 if(!material.valid||material.maxAbsPrincipalStrain>.05||gap>1e-7)throw Error('Original waistband handling incompatibility '+JSON.stringify({sweeps,gap,material}));
 for(const seam of newSeams){for(const pair of seam.pairs){pair.started=true;pair.initialGap=0;s.particles[pair.a].previous=[...s.particles[pair.a].pos];s.particles[pair.b].previous=[...s.particles[pair.b].pos];if(!s.dofs.same(pair.a,pair.b)&&!s.dofs.join(pair.a,pair.b,{started:true,closureProgress:1,requirePreviousClosure:true}))throw Error('Waistband source junction failed');}seam.progress=1;seam.start=s.time-seam.duration;seam.needleIndex=seam.pairs.length;}
 const mainUnchanged=before===JSON.stringify(s.particles.filter(p=>!active.has(p.pieceId)).map(p=>p.pos));
 if(!mainUnchanged)throw Error('Main panels changed during waistband handling');
 for(const p of s.particles){p.previous=[...p.pos];p.velocity=[0,0,0];}
 return {waistbandAttached:true,waistbandConnected:closeLeftOpening,waistbandRingClosed:closeLeftOpening,leftOpeningPreserved:!closeLeftOpening,mainUnchanged,closedSeamIds:newSeams.map(x=>x.id),pendingSeamIds:closeLeftOpening?[]:['side-opening-left','waistband-BL-FL'],sweeps,maximumGapM:gap,material,physicalCalibration:false,visualAcceptance:false,productionReady:false};
}

function continueShortsOpenWaistbands(simulation,frame,options={}){
 return continueShortsWaistbands(simulation,frame,{...options,closeLeftOpening:false});
}

function swcProjectPrincipalEnvelope(c,particles,dofs,tolerance){
 for(let pass=0;pass<2;pass++){
  const u=[0,0,0],v=[0,0,0],origin=particles[c.indices[0]].pos;
  for(let j=1;j<3;j++)for(let k=0;k<3;k++){const d=particles[c.indices[j]].pos[k]-origin[k];u[k]+=c.gradientU[j]*d;v[k]+=c.gradientV[j]*d;}
  const dot=(a,b)=>a.reduce((sum,x,k)=>sum+x*b[k],0),a=dot(u,u),b=dot(u,v),d=dot(v,v),angle=.5*Math.atan2(2*b,a-d);
  const e=pass===0?[Math.cos(angle),Math.sin(angle)]:[-Math.sin(angle),Math.cos(angle)],f=u.map((x,k)=>x*e[0]+v[k]*e[1]),sigma=Math.hypot(...f);
  if(sigma<1e-12)throw Error('Collapsed original waistband material axis');
  const target=Math.max(1-tolerance,Math.min(1+tolerance,sigma));if(target===sigma)continue;
  const gradients=c.indices.map((_,j)=>f.map(x=>x/sigma*(e[0]*c.gradientU[j]+e[1]*c.gradientV[j])));
  dofs.project(c.indices,gradients,sigma-target);
 }
}

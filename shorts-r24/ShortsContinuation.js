/* Continue the accepted R2.4 source, then verify original seam topology,
 * cloth metric, body witnesses, self-contact and independent cuff loops. */
function shortsContinuationContactDomain(s,active){
 const triangles=s.triangleRecords.filter(t=>active.has(t.pieceId)),edges=s.edges.filter(e=>active.has(s.particles[e.a].pieceId)),indices=[];
 s.particles.forEach((p,i)=>{if(active.has(p.pieceId))indices.push(i);});
 s.contactTriangleRecords=triangles;s.contactEdges=edges;s.contactParticleIndices=indices;
 s.continuousContact=createShortsContinuousContact(s.particles,triangles,edges,{thickness:s.options.thickness,maxCandidates:s.options.maxSelfCandidates,dofs:s.dofs,motionLimit:true});
 s.surfaceContact=new ShortsSurfaceContact(s.particles,triangles,s.body,{clearanceM:s.options.thickness,toleranceM:.001,dofs:s.dofs,includeOnlyIncidentVertices:true});
 s.triangleBodyContact=new ShortsTriangleBodyContact(s.particles,triangles,s.body,{clearanceM:s.options.thickness,toleranceM:.001,dofs:s.dofs,maxCandidates:s.options.triangleBodyMaxCandidates,maxWitnessQueries:s.options.triangleBodyMaxWitnessQueries});
 s.knownTriangleBodyState=null;s.continuousHistory={detectedCrossingCount:0,uncertainCount:0,budgetExceeded:false};
 for(const p of s.particles){p.previous=[...p.pos];p.velocity=[0,0,0];p.bodyFreeBall=null;}
 s._sync();
}
function auditShortsContinuation(s,frame,handling){
 s._selfContact(false);
 const report=s.report(),closed=s.seams.filter(seam=>seam.pairs.every(p=>p.started&&s.dofs.same(p.a,p.b))).map(seam=>({id:seam.id,pairCount:seam.pairs.length,maximumGapM:Math.max(...seam.pairs.map(p=>scDist(s.particles[p.a].pos,s.particles[p.b].pos)))}));
 const closedIds=new Set(closed.map(x=>x.id));
 const active=new Set(['FL','FR','BL','BR']);if(closedIds.has('gusset-FL'))active.add('G');if(closedIds.has('waist-FL'))for(const id of ['WFL','WFR','WBL','WBR'])active.add(id);
 const triangles=s.triangleRecords.filter(t=>active.has(t.pieceId));let intersection=null;
 for(let i=0;i<triangles.length&&!intersection;i++){
  const a=triangles[i],ap=a.indices.map(k=>s.particles[k].pos),ab=sd23Bounds(ap);
  for(let j=i+1;j<triangles.length;j++){const b=triangles[j];if(a.indices.some(x=>b.indices.some(y=>s.dofs.same(x,y))))continue;
   const bp=b.indices.map(k=>s.particles[k].pos);if(sd23BoundsOverlap(ab,sd23Bounds(bp),1e-9)&&sd23TrianglesIntersect(ap,bp,1e-9)){intersection={a:a.pieceId,b:b.pieceId,aIndices:a.indices,bIndices:b.indices};break;}
  }
 }
 const material=report.material,cuffs={left:sd23CuffReport(s,frame,'FL','BL'),right:sd23CuffReport(s,frame,'FR','BR')};
 const bodyContact=report.surfaceContact?.passed===true&&report.triangleBodyContact?.passed===true&&report.bodyPenetrationM<=.001;
 const self=report.selfContact,swept=self?.swept,selfContact=self?.enabled===true&&!self.budgetExceeded&&self.unresolvedCount===0&&(!swept||(!swept.budgetExceeded&&swept.uncertainCount===0&&swept.unresolvedCount===0));
 const cuffsValid=Object.values(cuffs).every(c=>c.positiveArea&&c.projectedAreaM2>1e-4&&c.closureGapM<=s.options.stitchJoinToleranceM);
 const sideOpeningClosed=closedIds.has('side-opening-left'),waistbandConnected=['waist-FL','waist-FR','waist-BL','waist-BR','waistband-FL-FR','waistband-FR-BR','waistband-BR-BL','waistband-BL-FL'].every(id=>closedIds.has(id)),gussetConnected=['FL','FR','BL','BR'].every(id=>closedIds.has('gusset-'+id));
 const priorClosed=['outseam-left','inseam-left','outseam-right','inseam-right','center-front','center-back'].every(id=>closedIds.has(id));
 const parent=s.particles.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(const seam of s.seams)if(closedIds.has(seam.id))for(const p of seam.pairs)parent[find(p.a)]=find(p.b);
 let expectedDofs=true;for(let i=0;i<parent.length&&expectedDofs;i++)for(let j=i+1;j<parent.length;j++)if(s.dofs.same(i,j)!==(find(i)===find(j))){expectedDofs=false;break;}
 const sourceIdentityPreserved=s.continuationSourceIdentity===JSON.stringify({pattern:s.pattern.pieces.map(p=>({id:p.id,uv:p.materialCoordinates,triangles:p.triangles,boundaries:p.boundaries})),particles:s.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))});
 const orangeUnchanged=s.continuationOrange===JSON.stringify(s.particles.filter(p=>['FR','BR'].includes(p.pieceId)).map(p=>p.pos));
 const waistbandAttached=['waist-FL','waist-FR','waist-BL','waist-BR','waistband-FL-FR','waistband-FR-BR','waistband-BR-BL'].every(id=>closedIds.has(id));
 const mainUnchanged=s.continuationMain===JSON.stringify(s.particles.filter(p=>['FL','FR','BL','BR'].includes(p.pieceId)).map(p=>p.pos));
 const pendingUnstarted=s.seams.filter(seam=>seam.id.startsWith('gusset-')||seam.id==='side-opening-left'||seam.id==='waistband-BL-FL').every(seam=>seam.pairs.every(p=>!p.started));
 const valid=priorClosed&&waistbandAttached&&mainUnchanged&&pendingUnstarted&&sourceIdentityPreserved&&orangeUnchanged&&expectedDofs&&material.valid&&material.maxAbsPrincipalStrain<=.05&&bodyContact&&selfContact&&cuffsValid&&!intersection;
 return {version:'R2.4-open-waist-continuation-20261001',valid,partialCheckpoint:true,sourceIdentityPreserved,mainUnchanged,orangeUnchanged,expectedDofs,pendingUnstarted,handling,closedSeams:closed,activePieces:[...active],sideOpeningClosed,waistbandAttached,waistbandConnected,gussetConnected,priorClosed,cuffs,cuffsValid,material,bodyContact,selfContact,strictUnexpectedIntersectionFree:!intersection,intersection,bodyPenetrationM:report.bodyPenetrationM,surfaceContact:report.surfaceContact,triangleBodyContact:report.triangleBodyContact,selfContactReport:self,step:s.stepIndex,authoringProjectionIteration:s.authoringProjectionIteration??0,visualAcceptance:false,motionValidated:false,productionReady:false};
}
const shortsR24OriginalAssemble=ClothShorts.prototype.assembleOnce;
ClothShorts.prototype.assembleOnce=async function(maxSteps,onProgress){
 const original=await shortsR24OriginalAssemble.call(this,maxSteps,onProgress);
 if(!this.riseReview||!this.riseReport?.valid)return original;
 const s=this.simulation,frame=this.riseState.report.bodyFrame;
 s.continuationSourceIdentity=JSON.stringify({pattern:s.pattern.pieces.map(p=>({id:p.id,uv:p.materialCoordinates,triangles:p.triangles,boundaries:p.boundaries})),particles:s.particles.map(p=>({uv:p.uv,mass:p.mass,pieceId:p.pieceId}))});
 s.continuationOrange=JSON.stringify(s.particles.filter(p=>['FR','BR'].includes(p.pieceId)).map(p=>p.pos));
 s.continuationMain=JSON.stringify(s.particles.filter(p=>['FL','FR','BL','BR'].includes(p.pieceId)).map(p=>p.pos));
 this.assemblyState='continuation-handling';
 // Enter a stationary authoring workspace only after the accepted rise gate.
 // The last R2.4 substep still has earlier previous positions; new handling
 // placement must begin at the accepted current state, not that prior motion.
 for(const p of s.particles){p.previous=[...p.pos];p.velocity=[0,0,0];}
 const handling={waist:continueShortsWaistbands(s,frame,{closeLeftOpening:false})};
 const active=new Set(['FL','FR','BL','BR','WFL','WFR','WBL','WBR']);
 // Keep the accepted right panels exactly fixed; only newly assembled pieces
 // and blue main panels participate in the new contact relaxation.
 const completed=s.seams.filter(seam=>seam.pairs.every(p=>p.started&&s.dofs.same(p.a,p.b)));
 for(const p of s.particles)p.invMass=p.pieceId.startsWith('W')?p.freeInvMass:0;
 s.dofs=createShortsStitchDofs(s.particles,{joinTolerance:s.options.stitchJoinToleranceM});
 for(const seam of completed){seam.start=s.time-seam.duration;seam.progress=1;for(const pair of seam.pairs)s.dofs.join(pair.a,pair.b,{started:true,closureProgress:1});}
 for(const support of s.temporarySupports){support.start=[...s.particles[support.index].pos];support.targetHeight=support.start[1];support.lambda.fill(0);if(!active.has(s.particles[support.index].pieceId))support.active=false;}
 // Rebase original waist handling grips too. Their constructor starts were
 // the floating flat workspace, and would otherwise pull an installed band
 // back out of the garment on its first contact step.
 for(const support of s.supports){support.start=[...s.particles[support.index].pos];support.target=[...support.start];support.lambda.fill(0);support.slackLambda=0;}
 shortsContinuationContactDomain(s,active);this.displayReady=true;
 this.continuationReport=auditShortsContinuation(s,frame,handling);
 const initialGate={material:this.continuationReport.material.maxAbsPrincipalStrain,body:this.continuationReport.bodyContact,self:this.continuationReport.selfContact,intersection:this.continuationReport.intersection};
 const metrics=s.metrics.filter(c=>c.pieceId.startsWith('W'));
 for(let i=0;i<24&&!this.continuationReport.valid;i++){
  this.assemblyState='continuation-contact-check';this.body.update();
  for(let j=0;j<100;j++)for(const c of metrics)swcProjectPrincipalEnvelope(c,s.particles,s.dofs,.048);
  s._coupledContact(1,true);s._sync();s.authoringProjectionIteration=i+1;this.dirty=true;
  this.continuationReport=auditShortsContinuation(s,frame,handling);onProgress((i+1)/24);
  await new Promise(resolve=>setTimeout(resolve,0));
  for(const p of s.particles){p.previous=[...p.pos];p.velocity=[0,0,0];}
 }
 this.dirty=true;this.assemblyState=this.continuationReport.valid?'continuation-ready':'continuation-checkpoint-failed';
 this.continuationReport.initialGate=initialGate;
 this.assemblyReport={...s.report(),rise:this.riseReport,continuation:this.continuationReport,assemblyState:this.assemblyState,assemblySteps:s.stepIndex};
 return this.assemblyReport;
};
const shortsR24OriginalDiagnostics=ClothShorts.prototype.diagnostics;
ClothShorts.prototype.diagnostics=function(){return {...shortsR24OriginalDiagnostics.call(this),continuation:this.continuationReport??null};};
// Readable authoring API for source-aware diagnostics. No stored geometry.
window.__ShortsContinuationTools={waist:continueShortsWaistbands,contact:shortsContinuationContactDomain,audit:auditShortsContinuation,dofs:createShortsStitchDofs,metric:scMetricReport,envelope:swcProjectPrincipalEnvelope};

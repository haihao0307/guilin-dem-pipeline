/** Solve the same diagonally dominant regional implicit system as R05.
 * Fuse independent X/Y/Z neighbor walks without changing sum order. Stop early
 * only when an entire sweep changes no IEEE-754 value; all later sweeps would
 * then be identical. The original scalar 8-sweep path remains a QA reference.
 * An approximate tolerance was rejected: contact branch choices amplified tiny
 * differences over long trajectories. No tolerance is relaxed for speed.
 */
export function solveRegionalVelocity(m,coefficient,fixedIterations=0){
 let contraction=0;
 for(let i=0;i<m.count;i++)if(m.weight[i]>=.02)contraction=Math.max(contraction,coefficient*m.couplingSum[i]/m.diag[i]);
 const boundFactor=contraction<1?contraction/(1-contraction):Infinity;
 let bound=Infinity,iterations=0;
 for(let it=0;it<8;it++){
  let update=0;
  for(let i=0;i<m.count;i++){
   const k=i*3;
   if(m.weight[i]<.02){m.work[k]=m.work[k+1]=m.work[k+2]=0;continue;}
   if(fixedIterations===8){
    for(let d=0;d<3;d++){let sum=0;for(let a=0;a<m.adj[i].length;a++)sum+=m.coupling[i][a]*m.work[m.adj[i][a]*3+d];const value=(m.rhs[k+d]+coefficient*sum)/m.diag[i];update=Math.max(update,Math.abs(value-m.work[k+d]));m.work[k+d]=value;}
   }else{
    let x=0,y=0,z=0;
    for(let a=0;a<m.adj[i].length;a++){const j=m.adj[i][a]*3,w=m.coupling[i][a];x+=w*m.work[j];y+=w*m.work[j+1];z+=w*m.work[j+2];}
    x=(m.rhs[k]+coefficient*x)/m.diag[i];y=(m.rhs[k+1]+coefficient*y)/m.diag[i];z=(m.rhs[k+2]+coefficient*z)/m.diag[i];
    update=Math.max(update,Math.abs(x-m.work[k]),Math.abs(y-m.work[k+1]),Math.abs(z-m.work[k+2]));m.work[k]=x;m.work[k+1]=y;m.work[k+2]=z;
   }
  }
  iterations=it+1;bound=update*boundFactor;
  if(!fixedIterations&&update===0)break;
 }
 m.lastSolveIterations=iterations;m.velocityErrorBound=bound;
}

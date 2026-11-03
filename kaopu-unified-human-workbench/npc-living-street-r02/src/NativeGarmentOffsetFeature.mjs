/** Local contact-query adapter, not a change to the original cloth material.
 * Find the minimum Euclidean offset satisfying at most three witnessed face
 * planes. Enumerating their active subsets is a complete 3D KKT solve for
 * this small convex linearization. No multiplier survives this one query.
 * The caller must still verify the actual full body, material side and bound;
 * plane feasibility alone is never a body-contact acceptance certificate.
 */
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function solve(matrix,rhs){
  const n=rhs.length,A=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let i=0;i<n;i++){
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;
    if(Math.abs(A[pivot][i])<1e-14)return null;
    [A[i],A[pivot]]=[A[pivot],A[i]];const scale=A[i][i];
    for(let k=i;k<=n;k++)A[i][k]/=scale;
    for(let j=0;j<n;j++)if(j!==i){const scale=A[j][i];for(let k=i;k<=n;k++)A[j][k]-=scale*A[i][k];}
  }
  return A.map(row=>row[n]);
}
export function solvePositiveOffsetFeature(planes,point,margin){
  if(planes.length<2||planes.length>3)throw Error('OFFSET_FEATURE_REQUIRES_TWO_OR_THREE_ACTUAL_WITNESSES');
  const deficits=planes.map(p=>margin-dot(p.normal,point.map((v,k)=>v-p.point[k]))),gram=planes.map(a=>planes.map(b=>dot(a.normal,b.normal)));
  let best=null,bestSquared=Infinity;
  for(let mask=1;mask<(1<<planes.length);mask++){
    const active=[];for(let i=0;i<planes.length;i++)if(mask&(1<<i))active.push(i);
    const multipliers=solve(active.map(i=>active.map(j=>gram[i][j])),active.map(i=>deficits[i]));
    // Negative KKT multipliers require removing that plane from the active
    // set, not pulling inwards or accumulating an old exterior constraint.
    if(!multipliers||multipliers.some(v=>!Number.isFinite(v)||v<0))continue;
    const delta=[0,1,2].map(k=>multipliers.reduce((v,lambda,j)=>v+lambda*planes[active[j]].normal[k],0));
    const residuals=planes.map((p,i)=>dot(p.normal,delta)-deficits[i]);
    // Same 1e-10 metre arithmetic allowance as the existing endpoint test.
    // The source 4 mm audit margin and every planning target remain intact.
    if(residuals.some(v=>v< -1e-10))continue;
    const squared=dot(delta,delta);if(!Number.isFinite(squared)||squared>=bestSquared)continue;
    bestSquared=squared;best={delta,squared,activeFaces:active.map(i=>planes[i].face),witnessFaces:planes.map(p=>p.face),multipliers,residuals};
  }
  return best;
}

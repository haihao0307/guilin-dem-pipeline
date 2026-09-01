/** Independent closed-domain 3D MAC pressure reference, version 0.1.0.
 * SI: spacing m, velocity m/s, pressure Pa, density kg/m^3, divergence 1/s.
 * Constant density, stationary voxel solids, slip boundaries, no free surface.
 * This is one operator. It is not a complete liquid, smoke or combustion solver.
 */
export const VERSION = '0.1.0-pressure-reference';
const KEYS = new Set(['nx','ny','nz','spacing','dt','density','fluid','u','v','w','tolerance','maxIterations']);

export function makeMacGrid(nx, ny, nz, spacing = [1, 1, 1]) {
  if (![nx,ny,nz].every(x => Number.isInteger(x) && x >= 1) || nx*ny*nz > 2_000_000)
    throw new RangeError('Grid requires positive dimensions and at most 2000000 cells');
  if (!Array.isArray(spacing) || spacing.length !== 3 || !spacing.every(x => Number.isFinite(x) && x > 0))
    throw new RangeError('Spacing must contain three positive finite metre values');
  return {nx, ny, nz, spacing:[...spacing], fluid:new Uint8Array(nx*ny*nz).fill(1),
    u:new Float64Array((nx+1)*ny*nz), v:new Float64Array(nx*(ny+1)*nz), w:new Float64Array(nx*ny*(nz+1))};
}

export function projectClosedMac(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options object required');
  for (const key of Object.keys(options)) if (!KEYS.has(key)) throw new Error('Unsupported option: '+key);
  const {nx,ny,nz,spacing,fluid,u,v,w,dt,density=1000,tolerance=1e-8,maxIterations=1000} = options;
  const result = makeMacGrid(nx,ny,nz,spacing);
  if (![dt,density,tolerance].every(x=>Number.isFinite(x)&&x>0) || !Number.isInteger(maxIterations) || maxIterations<0)
    throw new RangeError('Invalid timestep, density, tolerance or iteration budget');
  const total = nx*ny*nz, sizes=[total,result.u.length,result.v.length,result.w.length];
  for (const [i, values] of [fluid,u,v,w].entries()) {
    if (!ArrayBuffer.isView(values) || values.length!==sizes[i]) throw new TypeError('Field length/type mismatch');
    for (const x of values) if (!Number.isFinite(x) || (i===0 && x!==0 && x!==1)) throw new TypeError('Invalid field value');
  }
  result.fluid.set(fluid); result.u.set(u); result.v.set(v); result.w.set(w);
  const id=(i,j,k)=>(k*ny+j)*nx+i;
  const ui=(i,j,k)=>(k*ny+j)*(nx+1)+i;
  const vi=(i,j,k)=>(k*(ny+1)+j)*nx+i;
  const wi=(i,j,k)=>(k*ny+j)*nx+i;
  // Each physical face is represented exactly once. Solids and exterior are fixed.
  const faces=[],blocked=[]; let blockedFaces=0, maxRemovedNormalSpeed=0;
  function face(field,index,a,b,axis) {
    if(a>=0 && b>=0 && fluid[a] && fluid[b]) faces.push({field,index,a,b,axis});
    else {blocked.push({field,index,axis});blockedFaces++;maxRemovedNormalSpeed=Math.max(maxRemovedNormalSpeed,Math.abs(result[field][index]));result[field][index]=0;}
  }
  for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<=nx;i++) face('u',ui(i,j,k),i>0?id(i-1,j,k):-1,i<nx?id(i,j,k):-1,0);
  for(let k=0;k<nz;k++) for(let j=0;j<=ny;j++) for(let i=0;i<nx;i++) face('v',vi(i,j,k),j>0?id(i,j-1,k):-1,j<ny?id(i,j,k):-1,1);
  for(let k=0;k<=nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) face('w',wi(i,j,k),k>0?id(i,j,k-1):-1,k<nz?id(i,j,k):-1,2);
  const diagonal=new Float64Array(total), neighbors=Array.from({length:total},()=>[]);
  for(const f of faces){const weight=1/spacing[f.axis]**2;diagonal[f.a]+=weight;diagonal[f.b]+=weight;neighbors[f.a].push(f.b);neighbors[f.b].push(f.a);}
  const seen=new Uint8Array(total), components=[];
  for(let i=0;i<total;i++) if(fluid[i]&&!seen[i]){
    const c=[i];seen[i]=1;
    for(let p=0;p<c.length;p++) for(const q of neighbors[c[p]]) if(!seen[q]){seen[q]=1;c.push(q);}
    components.push(c);
  }
  function gauge(x){for(const c of components){let sum=0;for(const i of c)sum+=x[i];const mean=sum/c.length;for(const i of c)x[i]-=mean;}}
  function divergence(fields){const d=new Float64Array(total);for(const f of faces){const q=fields[f.field][f.index]/spacing[f.axis];d[f.a]+=q;d[f.b]-=q;}return d;}
  function matvec(p,out){out.fill(0);for(const f of faces){const q=(p[f.a]-p[f.b])/spacing[f.axis]**2;out[f.a]+=q;out[f.b]-=q;}}
  function maxAbs(x){let m=0;for(const v of x)m=Math.max(m,Math.abs(v));return m;}
  function dot(a,b){let s=0;for(let i=0;i<total;i++)s+=a[i]*b[i];return s;}
  function energy(fields){let s=0;for(const f of faces)s+=fields[f.field][f.index]**2;return .5*density*spacing[0]*spacing[1]*spacing[2]*s;}
  const before=divergence(result), initialEnergy=energy(result), pressure=new Float64Array(total);
  const rhs=Float64Array.from(before,x=>-density/dt*x);
  // Closed cells cannot support a net expansion source. Only roundoff is tolerated.
  const compatibility=[];
  for(const c of components){let sum=0,abs=0;for(const i of c){sum+=before[i];abs+=Math.abs(before[i]);}
    if(Math.abs(sum)>Math.max(1e-12,abs*1e-12))throw Error('Incompatible closed component divergence');
    compatibility.push({cellCount:c.length,divergenceSum:sum});}
  gauge(rhs);
  const r=rhs.slice(), z=new Float64Array(total), direction=new Float64Array(total), ad=new Float64Array(total);
  function precondition(){for(let i=0;i<total;i++)z[i]=diagonal[i]>0?r[i]/diagonal[i]:0;gauge(z);}
  precondition();direction.set(z);let rz=dot(r,z), iterations=0;
  const pressureTolerance=tolerance*density/dt;
  let residual=maxAbs(r), reason='converged';
  while(residual>pressureTolerance && iterations<maxIterations){
    matvec(direction,ad);const denom=dot(direction,ad);
    if(!(denom>0)||!Number.isFinite(denom)||!Number.isFinite(rz)){reason='linear_solver_breakdown';break;}
    const alpha=rz/denom;
    for(let i=0;i<total;i++){pressure[i]+=alpha*direction[i];r[i]-=alpha*ad[i];}
    iterations++;gauge(pressure);
    // Recompute actual residual rather than trusting accumulated recurrences.
    matvec(pressure,ad);for(let i=0;i<total;i++)r[i]=rhs[i]-ad[i];gauge(r);
    residual=maxAbs(r);if(residual<=pressureTolerance)break;
    precondition();const next=dot(r,z);const beta=next/rz;
    for(let i=0;i<total;i++)direction[i]=z[i]+beta*direction[i];gauge(direction);rz=next;
  }
  const linearConverged=residual<=pressureTolerance;
  if(!linearConverged && reason==='converged')reason='iteration_budget_exhausted';
  if(linearConverged)for(const f of faces)result[f.field][f.index]-=dt/density*(pressure[f.b]-pressure[f.a])/spacing[f.axis];
  const after=divergence(result), actualMax=maxAbs(after);
  const accepted=linearConverged && actualMax<=tolerance*1.01+1e-13;
  if(linearConverged&&!accepted)reason='actual_divergence_tolerance_failed';
  return {accepted,reason,iterations,pressure:accepted?pressure:null,velocity:accepted?{u:result.u,v:result.v,w:result.w}:null,
    metrics:{divergenceUnit:'1/s',beforeMaxDivergence:maxAbs(before),afterMaxDivergence:actualMax,
      tolerance,linearResidualMax:residual,kineticEnergyBeforeJ:initialEnergy,kineticEnergyAfterJ:energy(result),
      blockedFaces,maxRemovedNormalSpeedMps:maxRemovedNormalSpeed,blockedNormalFluxM3s:blocked.reduce((sum,f)=>sum+Math.abs(result[f.field][f.index])*spacing.filter((_,i)=>i!==f.axis).reduce((a,b)=>a*b,1),0),
      componentCount:components.length,compatibility},
    capabilities:{closedStationaryVoxelSolids:true,freeSurface:false,movingSolids:false,expansionSource:false,
      advection:false,particleGridTransfer:false,combustion:false,gpuRuntime:false}};
}

// NEW coarse front/return geometry receiver. Original GPU field + normals are supplied unchanged.
// 30 source samples, 40 front triangles + 36 return triangles. No visible texture.
import {BRICK_HALF,BRICK_MODEL_SCALE} from './r312-geometry-original.mjs';
export function makeOriginalFrontChart({materialFamily=0}={}){
 const [hx,hy,hz]=BRICK_HALF,r=(materialFamily===2?.072:materialFamily===3?.045:.055)*BRICK_MODEL_SCALE;
 const xs=[-hx,-hx+r,-hx*.4,hx*.4,hx-r,hx],ys=[-hy,-hy+r,0,hy-r,hy],positions=[],indices=[];
 for(const y of ys)for(const x of xs)positions.push(x,y,hz);
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){const a=j*xs.length+i,b=a+1,c=a+xs.length,d=c+1;indices.push(a,b,d,a,d,c);}
 const boundary=[];for(let i=0;i<xs.length;i++)boundary.push(i);for(let j=1;j<ys.length;j++)boundary.push(j*xs.length+xs.length-1);for(let i=xs.length-2;i>=0;i--)boundary.push((ys.length-1)*xs.length+i);for(let j=ys.length-2;j>0;j--)boundary.push(j*xs.length);
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices),vertexCount:positions.length/3,triangleCount:indices.length/3,boundary,chartHalf:[...BRICK_HALF],tangentRadius:r,proof:{newReceiverLOD:true,originalFieldUnchanged:true,frontTriangles:40,returnTriangles:36,gpuTested:false}};
}
export function receiveOriginalFrontSamples(chart,sampled,{mortarZ=.030}={}){
 if(chart.vertexCount!==30||sampled.positions.length!==90||sampled.normals.length!==90)throw Error('Expected 30 original front samples');
 if(!Number.isFinite(mortarZ)||mortarZ<0||mortarZ>=Math.min(...chart.boundary.map(i=>sampled.positions[i*3+2]))-.001)throw Error('Mortar plane must lie behind all sampled front boundary points');
 if(![...sampled.positions,...sampled.normals].every(Number.isFinite))throw Error('Finite source samples required');
 const p=[...sampled.positions],n=[...sampled.normals],indices=[...chart.indices],sourcePoints=[...sampled.positions];
 for(let j=0;j<chart.boundary.length;j++){
  const a=chart.boundary[j],b=chart.boundary[(j+1)%chart.boundary.length],A=Array.from(sampled.positions.slice(a*3,a*3+3)),B=Array.from(sampled.positions.slice(b*3,b*3+3)),Ar=[A[0],A[1],mortarZ],Br=[B[0],B[1],mortarZ],dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy),N=[dy/l,-dx/l,0],base=p.length/3;
  p.push(...A,...B,...Ar,...Br);n.push(...N,...N,...N,...N);sourcePoints.push(...A,...B,...Ar,...Br);indices.push(base,base+2,base+1,base+1,base+2,base+3);
 }
 return {positions:new Float32Array(p),normals:new Float32Array(n),sourcePositions:new Float32Array(sourcePoints),indices:new Uint16Array(indices),vertexCount:p.length/3,triangleCount:indices.length/3,proof:{frontOriginalFieldSampled:true,frontNormalsOriginalAtVertices:true,returnGeometryNew:true,backClosureByOpaqueMortar:true,sourcePositionDomainUnscaled:true,variant:sampled.variant,mortarZ,gpuTested:false,...chart.proof}};
}
export function sampleOriginalFrontReceiver(sampler,parameters,options={}){
 // sampler is existing createBrickSampler(hostRenderer), not another renderer.
 const chart=makeOriginalFrontChart(parameters),sampled=sampler.sample(chart,parameters);
 return {data:receiveOriginalFrontSamples(chart,sampled,options),chart,sampled};
}

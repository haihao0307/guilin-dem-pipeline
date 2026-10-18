/** R03 certified 21-station hub patch; source eccentric shaft and end caps stay untouched. */
import {HUB_PATCH_RULES} from './hub-profile-data.mjs';
export {HUB_PATCH_RULES};
const TAU=Math.PI*2;
export function hubMeridian(u,options={}) {
  const p=(options.rules||HUB_PATCH_RULES).profile;
  if(u<0||u>p.length-1)throw new RangeError('Open meridian: no wrap or cap inference');
  const a=Math.min(Math.floor(u),p.length-2),f=u-a;
  return [(p[a].x*(1-f)+p[a+1].x*f)*(options.axialScale??1)+(options.halfGaugeDelta??0),(p[a].radius*(1-f)+p[a+1].radius*f)*(options.radiusScale??1)];
}
export function hubSurfacePoint(u,theta,side=1,options={}) {
  const [x,r]=hubMeridian(u,options),center=(options.rules||HUB_PATCH_RULES).centerYZ;
  return [side*x,center[0]+r*Math.cos(theta),center[1]+r*Math.sin(theta)];
}
export function generateHubPatchData(options={}) {
  const rules=options.rules||HUB_PATCH_RULES,N=options.angularSegments||rules.angularSegments,L=rules.profile.length,sides=options.side?[options.side]:[-1,1],positions=[],indices=[],groups=[];
  for(const side of sides) {
    const offset=positions.length/3;
    for(let k=0;k<L;k++)for(let j=0;j<N;j++)positions.push(...hubSurfacePoint(k,TAU*j/N,side,options));
    for(let k=0;k<L-1;k++) {
      const start=indices.length;
      for(let j=0;j<N;j++){const a=offset+k*N+j,b=offset+k*N+(j+1)%N,c=offset+(k+1)*N+j,d=offset+(k+1)*N+(j+1)%N;indices.push(...(side>0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
      groups.push({start,count:indices.length-start,side,band:k,materialIndex:3});
    }
  }
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices),groups,sourceIndependent:true,sourceBuffersUsed:false,openPatch:true};
}
/** Register only analytically certified ring stations. All unlearned vertices remain bit-exact. */
export function reconstructHubPatchPositions(positions,options={}) {
  const rules=options.rules||HUB_PATCH_RULES,out=new Float32Array(positions),kinds=new Uint8Array(positions.length/3),stations=new Int16Array(kinds.length).fill(-1);let maximumDisplacement=0;
  for(let i=0;i<kinds.length;i++) {
    const x=positions[3*i],y=positions[3*i+1],z=positions[3*i+2],side=x<0?-1:1,r=Math.hypot(y-rules.centerYZ[0],z-rules.centerYZ[1]);
    if(Math.abs(x)<.51||r>.237||r<.04)continue;
    for(let k=0;k<rules.profile.length;k++) {
      const p=rules.profile[k];if(Math.hypot(Math.abs(x)-p.x,r-p.radius)>rules.selectionTolerance)continue;
      const theta=Math.round(Math.atan2(z-rules.centerYZ[1],y-rules.centerYZ[0])*rules.angularSegments/TAU)*TAU/rules.angularSegments;
      const reference=hubSurfacePoint(k,theta,side,{rules});if(Math.hypot(reference[0]-x,reference[1]-y,reference[2]-z)>rules.selectionTolerance)continue;
      out.set(hubSurfacePoint(k,theta,side,options),3*i);kinds[i]=1;stations[i]=k;maximumDisplacement=Math.max(maximumDisplacement,Math.hypot(out[3*i]-x,out[3*i+1]-y,out[3*i+2]-z));break;
    }
  }
  return {positions:out,kinds,stations,maximumDisplacement};
}

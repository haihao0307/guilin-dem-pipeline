/** Original bounded numerical repair, not an expanded geometry tolerance.
 * Frozen R07 analytic intervals, EPS, coverage, normals, fields and materials stay intact.
 * A redundant world-point -> local-point own-solid check may reject a valid cap
 * after Float32 cancellation. Only convex GLASS depth-cap events sufficiently
 * far from every planar edge can recover. All other events keep the old test.
 * gamma(24) is a conservative arithmetic budget for the two affine paths and
 * slab endpoint reconstruction, treating packed F32 inputs as authoritative.
 * It is NOT a bound on arbitrary non-IEEE devices or the complete CSG renderer.
 */
export const FLOAT32_UNIT_ROUNDOFF=2**-24;
export const GAMMA24=24*FLOAT32_UNIT_ROUNDOFF/(1-24*FLOAT32_UNIT_ROUNDOFF);
const gamma=n=>n*FLOAT32_UNIT_ROUNDOFF/(1-n*FLOAT32_UNIT_ROUNDOFF);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function glassEndpointError(p,ro,rd,t){
 const axes=[p.u,p.v,p.w],o=axes.map(a=>dot(a,ro.map((x,i)=>x-p.origin[i]))),d=axes.map(a=>dot(a,rd));
 const S=ro.map((x,i)=>Math.abs(x)+Math.abs(p.origin[i])+Math.abs(rd[i])*Math.abs(t));
 const Bo=axes.map(a=>gamma(6)*dot(a.map(Math.abs),ro.map((x,i)=>Math.abs(x)+Math.abs(p.origin[i]))));
 const Bd=axes.map(a=>gamma(5)*dot(a.map(Math.abs),rd.map(Math.abs)));
 const Bq=axes.map(a=>gamma(8)*dot(a.map(Math.abs),S));
 const den=Math.abs(d[2])-Bd[2];
 if(!(den>0&&Math.abs(d[2])>=.00001))return {axes:[Infinity,Infinity,Infinity],radius:Infinity};
 const Et=(Bo[2]+Math.abs(t)*Bd[2]+2*gamma(1)*(p.halfDepth+Math.abs(o[2])))/den;
 const e=axes.map((a,j)=>Math.max(GAMMA24*dot(a.map(Math.abs),S),Bq[j]+(Math.abs(d[j])+Bd[j])*Et));
 return {axes:e,radius:Math.hypot(...e),tError:Et};
}
export const GLASS_ENDPOINT_GLSL=`
// This is a candidate-local roundoff budget, never apertureEPS or ray advancement.
float apertureGlassEndpointBudget(AperturePart p,vec3 ro,vec3 rd,float t){
 const float u=0.000000059604644775390625;
 const float g1=u/(1.0-u),g5=(5.0*u)/(1.0-5.0*u),g6=(6.0*u)/(1.0-6.0*u),g8=(8.0*u)/(1.0-8.0*u),g24=(24.0*u)/(1.0-24.0*u);
 vec3 au=abs(p.u),av=abs(p.v),aw=abs(p.w),r=abs(ro)+abs(p.origin),dr=abs(rd),s=r+dr*abs(t);
 vec3 bo=g6*vec3(dot(au,r),dot(av,r),dot(aw,r));
 vec3 bd=g5*vec3(dot(au,dr),dot(av,dr),dot(aw,dr));
 vec3 bq=g8*vec3(dot(au,s),dot(av,s),dot(aw,s));
 vec3 o=aperturePartLocal(p,ro),d=aperturePartDirection(p,rd);
 float den=abs(d.z)-bd.z;if(!(den>0.0))return apertureINF;
 float et=(bo.z+abs(t)*bd.z+2.0*g1*(p.halfDepth+abs(o.z)))/den;
 // The interval parameter error also affects x/y, especially at grazing incidence.
 vec3 error=max(g24*vec3(dot(au,s),dot(av,s),dot(aw,s)),bq+(abs(d)+bd)*et);
 return length(error);
}
bool apertureOwnEndpointVerified(AperturePart p,vec3 ro,vec3 rd,float t,vec3 point,vec3 q,vec3 normal){
 if(aperturePositiveNeighbour(apertureIntervals(p,point,-normal)))return true;
 // Convex finite panes only. Frames, leaves, inner holes and corners are unchanged.
 if(p.role!=6.0||p.hasInner)return false;
 vec3 o=aperturePartLocal(p,ro),d=aperturePartDirection(p,rd);
 if(abs(d.z)<0.00001)return false;
 vec2 cap=apertureSlab(o.z,d.z,-p.halfDepth,p.halfDepth);
 bool entry=t==cap.x,exitEvent=t==cap.y;
 if(!entry&&!exitEvent)return false;
 float error=apertureGlassEndpointBudget(p,ro,rd,t);
 if(!(error>0.0&&error<p.halfDepth*0.25))return false;
 if(abs(abs(q.z)-p.halfDepth)>error)return false;
 if(apertureRectDistance(q.xy,p.outer,p.radii.x)>=-4.0*error)return false;
 float outwardSign=(entry?-1.0:1.0)*(d.z<0.0?-1.0:1.0);
 if(dot(normal,normalize(p.w)*outwardSign)<0.9999)return false;
 return true;
}
`;
export const ORIGINAL_OWN_CHECK='!aperturePositiveNeighbour(apertureIntervals(p,point,-n))';
export const BOUNDED_OWN_CHECK='!apertureOwnEndpointVerified(p,ro,rd,candidate,point,q,n)';
export function withBoundedGlassEndpointVerification(glsl){
 if(glsl.split(ORIGINAL_OWN_CHECK).length!==2)throw Error('Frozen own-endpoint shader changed; refusing broad replacement');
 const anchor='bool apertureTraceRayFiltered(';
 if(glsl.split(anchor).length!==2)throw Error('Frozen trace declaration changed');
 return glsl.replace(anchor,GLASS_ENDPOINT_GLSL+'\n'+anchor).replace(ORIGINAL_OWN_CHECK,BOUNDED_OWN_CHECK);
}

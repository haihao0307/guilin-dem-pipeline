/** Analytic line-tube recovery only after the unchanged primary field trace is unresolved.
 * Original continuous line/arc centerlines and field normals remain authoritative.
 */
import {buildStairRailGLSL,traceStairRails,railToLocal,railToWorld,stairRailRayInterval,queryStairRailLocal} from '../whole-building-r01/rails.mjs';
const dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]),mul=(a,s)=>a.map(v=>v*s),EPS=.00008;
export function lineTubeRay(piece,ro,rd,lo,hi){
 const ba=sub(piece.end,piece.start),L=Math.hypot(...ba),axis=mul(ba,1/L),oa=sub(ro,piece.start),z=dot(oa,axis),dz=dot(rd,axis),q=sub(oa,mul(axis,z)),v=sub(rd,mul(axis,dz)),a=dot(v,v),R=piece.tubeRadius;let best=Infinity,uncertain=false;
 const accept=(t,axial,valid)=>{const te=16*2**-23*(1+Math.abs(t)+Math.abs(lo)+Math.abs(hi)),ze=16*2**-23*(1+Math.abs(z)+Math.abs(dz*t)+L);if(t>=lo-te&&t<=hi+te&&(Math.abs(axial)<ze||Math.abs(axial-L)<ze||Math.abs(t-lo)<te||Math.abs(t-hi)<te))uncertain=true;if(valid&&t>=lo&&t<=hi)best=Math.min(best,t);};
 if(a>0&&a<=1e-12)uncertain=true;
 if(a>1e-12){const c=-dot(q,v)/a,near=add(q,mul(v,c)),gap=R*R-dot(near,near);if(Math.abs(gap)<16*2**-23*(R*R+dot(near,near)+R*(Math.hypot(...q)+Math.abs(c)*Math.hypot(...v))))uncertain=true;if(gap>=0){const d=Math.sqrt(gap/a);for(const t of[c-d,c+d])accept(t,z+dz*t,z+dz*t>=0&&z+dz*t<=L);}}
 for(const [center,side]of[[piece.start,0],[piece.end,1]]){const m=sub(ro,center),c=-dot(m,rd),near=add(m,mul(rd,c)),gap=R*R-dot(near,near);if(Math.abs(gap)<16*2**-23*(R*R+dot(near,near)+R*(Math.hypot(...m)+Math.abs(c))))uncertain=true;if(gap>=0){const d=Math.sqrt(gap);for(const t of[c-d,c+d])accept(t,z+dz*t,side?z+dz*t>=L:z+dz*t<=0);}}
 return{t:best,uncertain};
}
export function rescueStairRail(spec,origin,direction,primary,{maxDistance=200}={}){
 if(primary.status!=='unresolved')return primary;
 const norm=mul(direction,1/Math.hypot(...direction)),ro=railToLocal(origin,spec.frame),rawDirection=sub(railToLocal(add(origin,norm),spec.frame),ro),rd=mul(rawDirection,1/Math.hypot(...rawDirection)),start=Math.max(0,primary.t-2e-5);let best=maxDistance,found=false,unresolved=Infinity;
 if(queryStairRailLocal(spec.template,add(ro,mul(rd,start))).inside)return primary;
 for(const piece of spec.template.primitives){const span=stairRailRayInterval(ro,rd,{min:piece.surfaceBounds.min.map(v=>v-EPS),max:piece.surfaceBounds.max.map(v=>v+EPS)},best);if(!span)continue;const lo=Math.max(start,span.near),hi=Math.min(best,span.far);if(hi<lo)continue;
  if(piece.kind==='line'){const h=lineTubeRay(piece,ro,rd,lo,hi);if(h.uncertain){unresolved=Math.min(unresolved,lo);continue;}if(Number.isFinite(h.t)){best=h.t;found=true;}}
  else{let t=lo,done=false;for(let i=0;i<160;i++){const h=queryStairRailLocal({...spec.template,primitives:[piece]},add(ro,mul(rd,t)));if(Math.abs(h.distance)<=EPS){best=t;found=true;done=true;break;}const next=t+Math.abs(h.distance)*.85;if(next>hi){done=true;break;}if(next===t)break;t=next;}if(!done)unresolved=Math.min(unresolved,t);}
 }
 if(unresolved<=best)return{status:'unresolved',hit:null,t:unresolved,reason:'bounded_rescue_uncertain'};
 return found?{...queryStairRailLocal(spec.template,add(ro,mul(rd,best))),status:'hit',hit:true,t:best,local:add(ro,mul(rd,best)),point:railToWorld(add(ro,mul(rd,best)),spec.frame),railId:spec.id}:{status:'miss',hit:false,reason:'all_piece_intervals_resolved'};
}
export function traceEvidenceRail(spec,origin,direction,options={}){return rescueStairRail(spec,origin,direction,traceStairRails(spec,origin,direction,options),options);}
export function buildEvidenceStairRailGLSL(){const src=buildStairRailGLSL();if(src.split('int wholeRailTrace(').length!==2)throw Error('Rail trace source contract');return src.replace('int wholeRailTrace(','int wholeRailTracePrimary(')+`
float evidenceRailPieceDistance(vec3 p,int i){vec4 k=wholeRailData(i,0),a=wholeRailData(i,1);vec3 b=wholeRailData(i,2).xyz;float d2=k.x<.5?wholeRailLineSquared(p,a.xyz,b):wholeRailArcSquared(p,wholeRailData(i,3).xyz,wholeRailData(i,4).xyz,wholeRailData(i,5).xyz,k.z,k.w,a.w,a.xyz,b);return sqrt(max(d2,0.))-k.y;}
bool evidenceRailPieceInterval(vec3 ro,vec3 rd,vec3 low,vec3 high,float limit,out vec2 span){span=vec2(0.,limit);for(int a=0;a<3;a++){if(abs(rd[a])<1e-12){if(ro[a]<low[a]||ro[a]>high[a])return false;}else{float x=(low[a]-ro[a])/rd[a],y=(high[a]-ro[a])/rd[a];span.x=max(span.x,min(x,y));span.y=min(span.y,max(x,y));if(span.x>span.y)return false;}}return true;}
void evidenceLineCandidate(float t,float s,float z,float dz,float L,vec2 span,bool valid,inout float best,inout bool uncertain){float te=16.*1.1920929e-7*(1.+abs(t)+abs(span.x)+abs(span.y)),ze=16.*1.1920929e-7*(1.+abs(z)+abs(dz*t)+L);if(t>=span.x-te&&t<=span.y+te&&(abs(s)<ze||abs(s-L)<ze||abs(t-span.x)<te||abs(t-span.y)<te))uncertain=true;if(valid&&t>=span.x&&t<=span.y)best=min(best,t);}
float evidenceLineTube(vec3 ro,vec3 rd,vec3 a0,vec3 b0,float radius,vec2 span,out bool uncertain){vec3 ab=b0-a0;float L=length(ab);vec3 axis=ab/L,oa=ro-a0;float z=dot(oa,axis),dz=dot(rd,axis);vec3 q=oa-axis*z,v=rd-axis*dz;float A=dot(v,v),best=1e20;uncertain=false;
 if(A>0.&&A<=1e-12)uncertain=true;
 if(A>1e-12){float center=-dot(q,v)/A;vec3 nearP=q+v*center;float gap=radius*radius-dot(nearP,nearP);if(abs(gap)<16.*1.1920929e-7*(radius*radius+dot(nearP,nearP)+radius*(length(q)+abs(center)*length(v))))uncertain=true;if(gap>=0.){float delta=sqrt(gap/A);for(int j=0;j<2;j++){float t=center+(j==0?-delta:delta),s=z+dz*t;evidenceLineCandidate(t,s,z,dz,L,span,s>=0.&&s<=L,best,uncertain);}}}
 for(int cap=0;cap<2;cap++){vec3 m=ro-(cap==0?a0:b0);float center=-dot(m,rd);vec3 nearP=m+rd*center;float gap=radius*radius-dot(nearP,nearP);if(abs(gap)<16.*1.1920929e-7*(radius*radius+dot(nearP,nearP)+radius*(length(m)+abs(center))))uncertain=true;if(gap>=0.){float delta=sqrt(gap);for(int j=0;j<2;j++){float t=center+(j==0?-delta:delta),s=z+dz*t;evidenceLineCandidate(t,s,z,dz,L,span,cap==0?s<=0.:s>=L,best,uncertain);}}}return best;}
int wholeRailTrace(vec3 ro,vec3 rd,float limit,out float t,out vec3 p){int status=wholeRailTracePrimary(ro,rd,limit,t,p);if(status>=0)return status;rd=normalize(rd);float start=max(0.,t-2e-5),best=limit,unresolved=1e20;bool found=false,hasUnresolved=false;if(wholeRailDistance(ro+rd*start)<0.)return -1;
 for(int i=0;i<uStairRailPieceCount;i++){vec2 span;if(!evidenceRailPieceInterval(ro,rd,wholeRailData(i,6).xyz-vec3(.00008),wholeRailData(i,7).xyz+vec3(.00008),best,span))continue;span.x=max(start,span.x);if(span.y<span.x)continue;vec4 k=wholeRailData(i,0);if(k.x<.5){bool uncertain;float hit=evidenceLineTube(ro,rd,wholeRailData(i,1).xyz,wholeRailData(i,2).xyz,k.y,span,uncertain);if(uncertain){hasUnresolved=true;unresolved=min(unresolved,span.x);continue;}if(hit<1e19){best=hit;found=true;}}
 else{float at=span.x;bool done=false;for(int j=0;j<160;j++){float d=evidenceRailPieceDistance(ro+rd*at,i);if(abs(d)<=.00008){best=at;found=true;done=true;break;}float next=at+abs(d)*.85;if(next>span.y){done=true;break;}if(next==at)break;at=next;}if(!done){hasUnresolved=true;unresolved=min(unresolved,at);}}}
 if(hasUnresolved&&unresolved<=best){t=unresolved;p=ro+rd*t;return -1;}t=best;p=ro+rd*t;return found?1:0;
}
`;}

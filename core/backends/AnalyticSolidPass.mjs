// Direct intersections with registered sphere/box functions. Screen triangles
// cover query pixels only; they never represent object surfaces.
export const analyticSolidGLSL=`
uniform int uSolidCount;uniform bool uSolidShadows;
uniform vec4 uSolidPositionKind[16],uSolidExtentMetal[16],uSolidColourRough[16];
vec2 solidInterval(int i,vec3 o,vec3 d){
 vec3 q=o-uSolidPositionKind[i].xyz,e=uSolidExtentMetal[i].xyz;
 if(uSolidPositionKind[i].w<.5){vec3 a=q/e,b=d/e,perp=cross(a,b);float A=dot(b,b),closest=-dot(a,b)/A,h=1.-dot(perp,perp)/A;if(h<0.)return vec2(1.e20,-1.e20);float halfSpan=sqrt(h/A);return vec2(closest-halfSpan,closest+halfSpan);}
 float lo=-1.e20,hi=1.e20;for(int k=0;k<3;k++){if(abs(d[k])<1.e-12){if(abs(q[k])>e[k])return vec2(1.e20,-1.e20);}else{float a=(-e[k]-q[k])/d[k],b=(e[k]-q[k])/d[k];lo=max(lo,min(a,b));hi=min(hi,max(a,b));}}return vec2(lo,hi);
}
float solidVisibility(vec3 p,vec3 l){if(!uSolidShadows)return 1.;for(int i=0;i<16;i++){if(i>=uSolidCount)break;vec2 span=solidInterval(i,p+l*.05,l);if(span.y>max(.05,span.x))return 0.;}return 1.;}
vec3 solidNormal(int i,vec3 p){vec3 q=p-uSolidPositionKind[i].xyz,e=uSolidExtentMetal[i].xyz;if(uSolidPositionKind[i].w<.5)return normalize(q/(e*e));vec3 a=abs(q/e);if(a.x>=a.y&&a.x>=a.z)return vec3(sign(q.x),0.,0.);if(a.y>=a.z)return vec3(0.,sign(q.y),0.);return vec3(0.,0.,sign(q.z));}
vec3 solidBRDF(vec3 base,float rough,float metal,vec3 n,vec3 v,vec3 l){float nl=max(0.,dot(n,l)),nv=max(.0001,dot(n,v));if(nl<=0.)return vec3(0.);vec3 h=normalize(l+v);float nh=max(0.,dot(n,h)),vh=max(0.,dot(v,h)),a=rough*rough,a2=a*a,den=nh*nh*(a2-1.)+1.,D=a2/(3.141592654*den*den);float G=.5/max(.00001,nl*sqrt(nv*nv*(1.-a2)+a2)+nv*sqrt(nl*nl*(1.-a2)+a2));vec3 F=mix(vec3(.04),base,metal)+(1.-mix(vec3(.04),base,metal))*pow(1.-vh,5.);return ((1.-F)*(1.-metal)*base/3.141592654+D*G*F)*nl;}
`;
export function uploadAnalyticSolids(gl,uniform,items){
 if(!Array.isArray(items)||items.length>16)throw Error('Analytic solid display limit is16');
 gl.uniform1i(uniform('uSolidCount'),items.length);
 const p=new Float32Array(64),e=new Float32Array(64),c=new Float32Array(64);
 items.forEach((item,i)=>{p.set([...item.position,item.kind==='box'?1:0],i*4);e.set([...item.extent,item.metalness],i*4);c.set([...item.colour,item.roughness],i*4);});
 gl.uniform4fv(uniform('uSolidPositionKind[0]'),p);gl.uniform4fv(uniform('uSolidExtentMetal[0]'),e);gl.uniform4fv(uniform('uSolidColourRough[0]'),c);
}

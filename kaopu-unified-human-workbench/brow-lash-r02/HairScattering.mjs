// Original evaluator based on Chiang et al. 2016 and PBRT 4e equations.
// Direct lights only; environment remains the host's diffuse approximation.
// Not a path tracer, inter-fiber multiple scattering, or film-quality certification.
export const hairGLSL = `
float blFresnel(float c,float eta){
 c=clamp(c,0.0,1.0);float st2=(1.0-c*c)/(eta*eta);float ct=sqrt(max(0.0,1.0-st2));
 float rs=(c-eta*ct)/(c+eta*ct),rp=(eta*c-ct)/(eta*c+ct);return .5*(rs*rs+rp*rp);
}
float blLogI0(float x){
 x=abs(x);if(x>8.0){float z=1.0/x;return x-.5*log(6.28318530718*x)+log(1.0+z*(.125+z*(.0703125+z*(.0732421875+z*.1121520996))));}
 float y=x*x*.25,term=1.0,total=1.0;
 for(int k=1;k<=15;k++){term*=y/float(k*k);total+=term;}return log(total);
}
float blM(float si,float ci,float so,float co,float variance){
 float v=max(.002,variance),z=1.0/v;
 float logSinh=z-.69314718056+log(max(1e-20,1.0-exp(-2.0*z)));
 return exp(clamp(blLogI0(ci*co/v)-si*so/v-log(2.0*v)-logSinh,-80.0,20.0));
}
float blN(float phi,float center,float scale){
 float x=mod(phi-center+3.14159265359,6.28318530718)-3.14159265359;
 float e=exp(-abs(x)/scale),normalizer=1.0-2.0/(1.0+exp(min(80.0,3.14159265359/scale)));
 return e/(scale*(1.0+e)*(1.0+e)*normalizer);
}
vec3 blFiber(float h,float so,float co,float si,float ci,float phi,vec3 pigment,float rough){
 float eta=1.55,etaPrime=sqrt(eta*eta-so*so)/max(co,.0001),go=asin(h),gt=asin(clamp(h/etaPrime,-1.0,1.0));
 float F=blFresnel(co*sqrt(max(0.0,1.0-h*h)),eta),ct=sqrt(max(.0001,1.0-so*so/(eta*eta)));
 float beta=clamp(rough,.2,.8),variance=pow(.726*beta+.812*beta*beta+3.7*pow(beta,20.0),2.0);
 float bn=clamp(beta*.92,.2,.8),width=.6266570687*(.265*bn+1.194*bn*bn+5.372*pow(bn,22.0));
 float colorScale=5.969-.215*bn+2.532*bn*bn-10.73*pow(bn,3.0)+5.574*pow(bn,4.0)+.245*pow(bn,5.0);
 vec3 absorption=pow(-log(clamp(pigment,vec3(.002),vec3(.94)))/colorScale,vec3(2.0)),T=exp(-absorption*(2.0*cos(gt)/ct));
 vec3 A0=vec3(F),A1=(1.0-F)*(1.0-F)*T,A2=A1*T*F,A3=A2*T*F/max(vec3(.00001),vec3(1.0)-T*F);
 float theta=asin(clamp(so,-1.0,1.0)),alpha=.034906585;
 float t0=theta-2.0*alpha,t1=theta+alpha,t2=theta+4.0*alpha;
 float m0=blM(si,ci,sin(t0),abs(cos(t0)),variance),m1=blM(si,ci,sin(t1),abs(cos(t1)),variance*.25),m2=blM(si,ci,sin(t2),abs(cos(t2)),variance*4.0),m3=blM(si,ci,so,co,variance*4.0);
 return A0*m0*blN(phi,-2.0*go,width)+A1*m1*blN(phi,2.0*gt-2.0*go+3.14159265359,width)+A2*m2*blN(phi,4.0*gt-2.0*go+6.28318530718,width)+A3*m3*.15915494309;
}
void blDirect(const in IncidentLight light,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){
 vec3 T=normalize(blTangentView),V=normalize(geometryViewDir),L=normalize(light.direction),N=normalize(V-T*dot(V,T)),B=normalize(cross(T,N));
 float so=clamp(dot(V,T),-.999,.999),si=clamp(dot(L,T),-.999,.999),co=sqrt(1.0-so*so),ci=sqrt(1.0-si*si),phi=atan(dot(L,B),dot(L,N));
 vec3 pigment=clamp(material.diffuseColor,vec3(.002),vec3(.94));
 // Four-point cross-section quadrature; no stochastic sample dithering.
 vec3 integrated=.1739274*(blFiber(-.8611363,so,co,si,ci,phi,pigment,material.roughness)+blFiber(.8611363,so,co,si,ci,phi,pigment,material.roughness))+.3260726*(blFiber(-.3399810,so,co,si,ci,phi,pigment,material.roughness)+blFiber(.3399810,so,co,si,ci,phi,pigment,material.roughness));
 reflectedLight.directSpecular+=light.color*integrated;
}
#undef RE_Direct
#define RE_Direct blDirect
`;

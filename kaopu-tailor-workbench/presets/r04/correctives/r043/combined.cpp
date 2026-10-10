// R07 f64 mathematical kernel; original rest material remains unchanged.
using f64=double;using i32=int;using i16=short;using usize=unsigned;
template<class T> inline T load(usize p){return *reinterpret_cast<T*>(p);}
template<class T,class U> inline void store(usize p,U v){*reinterpret_cast<T*>(p)=static_cast<T>(v);}
inline double max2(double a,double b){return a>b?a:b;}
inline double min2(double a,double b){return a<b?a:b;}
// Original KAOPU f64 kernels. Same ordered XPBD/strain/body projections.
// JS supplies the original Math trigonometric functions. No reduced iterations.
usize pos=0;usize inv=0;usize alias=0;usize ci=0;usize cf=0;usize ti=0;usize tf=0;usize edges=0;usize sdf=0;
i32 N=0;i32 C=0;i32 T=0;i32 E=0;i32 nx=0;i32 ny=0;i32 nz=0;
f64 ox=0;f64 oy=0;f64 oz=0;f64 spacing=5;f64 quant=.05;
f64 gx=0;f64 gy=0;f64 gz=0;f64 sd=0;bool valid=false;
i32 contacts=0;
__attribute__((export_name("configure"))) void configure(usize p,usize w,usize a,usize cidx,usize cdata,usize tidx,usize tdata,usize eidx,usize field,i32 n,i32 c,i32 t,i32 e,i32 dx,i32 dy,i32 dz,f64 x,f64 y,f64 z,f64 step,f64 q){pos=p;inv=w;alias=a;ci=cidx;cf=cdata;ti=tidx;tf=tdata;edges=eidx;sdf=field;N=n;C=c;T=t;E=e;nx=dx;ny=dy;nz=dz;ox=x;oy=y;oz=z;spacing=step;quant=q;}
__attribute__((export_name("point"))) usize point(i32 i){return pos+usize(load<i32>(alias+usize(i)*4))*24;}
__attribute__((export_name("weight"))) f64 weight(i32 i){return load<f64>(inv+usize(i)*8);}
__attribute__((export_name("norm"))) f64 norm(f64 x,f64 y,f64 z){return __builtin_sqrt(x*x+y*y+z*z);}
__attribute__((export_name("add"))) void add(usize p,f64 x,f64 y,f64 z){store<f64>(p,load<f64>(p)+x);store<f64>(p+8,load<f64>(p+8)+y);store<f64>(p+16,load<f64>(p+16)+z);}
__attribute__((export_name("setConstraintCount"))) void setConstraintCount(i32 count){C=count;}
__attribute__((export_name("prepare"))) void prepare(f64 h,f64 elapsed){contacts=0;for(auto i=0;i<C;i++){auto d=cf+usize(i)*80;store<f64>(d+40,0);store<f64>(d+64,load<f64>(d+8)/(h*h));auto rest=load<f64>(d);auto target=rest;if(load<f64>(d+56)!=0)target=rest+(load<f64>(d+16)-rest)*max2(0,1-(elapsed-load<f64>(d+24))/load<f64>(d+32));store<f64>(d+72,target);}}
__attribute__((export_name("distances"))) void distances(i32 begin,i32 end){for(auto i=begin;i<end;i++){auto d=cf+usize(i)*80;if(load<f64>(d+48)!=0)continue;auto a=load<i32>(ci+usize(i)*8);auto b=load<i32>(ci+usize(i)*8+4);auto pa=point(a);auto pb=point(b);auto w1=weight(a);auto w2=weight(b);auto dx=load<f64>(pa)-load<f64>(pb);auto dy=load<f64>(pa+8)-load<f64>(pb+8);auto dz=load<f64>(pa+16)-load<f64>(pb+16);auto len=norm(dx,dy,dz);if(len<1e-12||w1+w2==0)continue;auto alpha=load<f64>(d+64);auto lambda=load<f64>(d+40);auto dl=(-(len-load<f64>(d+72))-alpha*lambda)/(w1+w2+alpha);auto f=dl/len;store<f64>(d+40,lambda+dl);add(pa,w1*f*dx,w1*f*dy,w1*f*dz);add(pb,-w2*f*dx,-w2*f*dy,-w2*f*dz);}}
__attribute__((export_name("strains"))) void strains(){for(auto t=0;t<T;t++){auto ids=ti+usize(t)*12;auto coef=tf+usize(t)*48;auto a=load<i32>(ids);auto b=load<i32>(ids+4);auto c=load<i32>(ids+8);auto pa=point(a);auto pb=point(b);auto pc=point(c);auto u0=load<f64>(coef);auto u1=load<f64>(coef+8);auto u2=load<f64>(coef+16);auto v0=load<f64>(coef+24);auto v1=load<f64>(coef+32);auto v2=load<f64>(coef+40);
 auto ax=load<f64>(pa);auto ay=load<f64>(pa+8);auto az=load<f64>(pa+16);auto bx=load<f64>(pb);auto by=load<f64>(pb+8);auto bz=load<f64>(pb+16);auto cx=load<f64>(pc);auto cy=load<f64>(pc+8);auto cz=load<f64>(pc+16);auto ux=ax*u0+bx*u1+cx*u2;auto uy=ay*u0+by*u1+cy*u2;auto uz=az*u0+bz*u1+cz*u2;auto vx=ax*v0+bx*v1+cx*v2;auto vy=ay*v0+by*v1+cy*v2;auto vz=az*v0+bz*v1+cz*v2;
 auto aa=ux*ux+uy*uy+uz*uz;auto bb=vx*vx+vy*vy+vz*vz;auto ab=ux*vx+uy*vy+uz*vz;auto radius=__builtin_fabs(ab);if(min2(aa,bb)-radius>=.985*.985+1e-12&&max2(aa,bb)+radius<=1.015*1.015-1e-12)continue;
 auto delta=aa-bb;auto rad=norm(delta,2*ab,0);f64 co=1;f64 si=0;
 if(rad>1e-30){if(delta>=0){co=__builtin_sqrt(.5*(1+delta/rad));si=ab/(rad*co);}else{si=(ab<0?-1.0:1.0)*__builtin_sqrt(.5*(1-delta/rad));co=ab==0?0:ab/(rad*si);}}
 for(auto mode=0;mode<2;mode++){if(mode){ax=load<f64>(pa);ay=load<f64>(pa+8);az=load<f64>(pa+16);bx=load<f64>(pb);by=load<f64>(pb+8);bz=load<f64>(pb+16);cx=load<f64>(pc);cy=load<f64>(pc+8);cz=load<f64>(pc+16);ux=ax*u0+bx*u1+cx*u2;uy=ay*u0+by*u1+cy*u2;uz=az*u0+bz*u1+cz*u2;vx=ax*v0+bx*v1+cx*v2;vy=ay*v0+by*v1+cy*v2;vz=az*v0+bz*v1+cz*v2;}
 auto qx=mode?-si:co;auto qy=mode?co:si;auto x=ux*qx+vx*qy;auto y=uy*qx+vy*qy;auto z=uz*qx+vz*qy;auto len=norm(x,y,z);auto target=max2(.985,min2(1.015,len));if(__builtin_fabs(len-target)<1e-6||len<1e-9)continue;auto ca=u0*qx+v0*qy;auto cb=u1*qx+v1*qy;auto cc=u2*qx+v2*qy;auto wa=weight(a);auto wb=weight(b);auto wc=weight(c);auto den=wa*ca*ca+wb*cb*cb+wc*cc*cc;if(den<1e-12)continue;auto factor=-(len-target)/(den*len);auto fa=wa*ca*factor;auto fb=wb*cb*factor;auto fc=wc*cc*factor;add(pa,fa*x,fa*y,fa*z);add(pb,fb*x,fb*y,fb*z);add(pc,fc*x,fc*y,fc*z);}
 }}
__attribute__((export_name("field"))) f64 field(i32 i){return f64(load<i16>(sdf+usize(i)*2));}
__attribute__((export_name("sample"))) void sample(f64 x,f64 y,f64 z,f64 margin){auto fx=(x*1000-ox)/spacing;auto fy=(y*1000-oy)/spacing;auto fz=(z*1000-oz)/spacing;if(fx<0||fy<0||fz<0||fx>=nx-1||fy>=ny-1||fz>=nz-1){valid=false;return;}valid=true;auto i=i32(__builtin_floor(fx));auto j=i32(__builtin_floor(fy));auto k=i32(__builtin_floor(fz));auto u=fx-f64(i);auto v=fy-f64(j);auto w=fz-f64(k);auto o=(k*ny+j)*nx+i;auto nxy=nx*ny;auto p=field(o);auto q=field(o+1);auto r=field(o+nx);auto s=field(o+nx+1);auto t=field(o+nxy);auto b=field(o+nxy+1);auto c=field(o+nxy+nx);auto e=field(o+nxy+nx+1);auto lo=(p*(1-u)+q*u)*(1-v)+(r*(1-u)+s*u)*v;auto hi=(t*(1-u)+b*u)*(1-v)+(c*(1-u)+e*u)*v;sd=(lo*(1-w)+hi*w)*quant*.001;if(sd>=margin)return;auto dx=((q-p)*(1-v)+(s-r)*v)*(1-w)+((b-t)*(1-v)+(e-c)*v)*w;auto dy=((r-p)*(1-u)+(s-q)*u)*(1-w)+((c-t)*(1-u)+(e-b)*u)*w;auto dz=hi-lo;auto n=norm(dx,dy,dz);gx=n?dx/n:0;gy=n?dy/n:1;gz=n?dz/n:0;}
__attribute__((export_name("vertices"))) void vertices(f64 margin){for(auto i=0;i<N;i++){if(weight(i)==0)continue;auto p=point(i);sample(load<f64>(p),load<f64>(p+8),load<f64>(p+16),margin);if(valid&&sd<margin){auto d=margin-sd;add(p,gx*d,gy*d,gz*d);contacts++;}}}
__attribute__((export_name("contact"))) void contact(i32 a,i32 b,i32 c,bool three,f64 margin){auto pa=point(a);auto pb=point(b);auto pc=point(c);auto w=three?1.0/3:.5;auto x=load<f64>(pa)*w+load<f64>(pb)*w;auto y=load<f64>(pa+8)*w+load<f64>(pb+8)*w;auto z=load<f64>(pa+16)*w+load<f64>(pb+16)*w;auto wa=weight(a);auto wb=weight(b);auto wc=three?weight(c):0;auto sum=wa*w*w+wb*w*w;if(three){x+=load<f64>(pc)*w;y+=load<f64>(pc+8)*w;z+=load<f64>(pc+16)*w;sum+=wc*w*w;}sample(x,y,z,margin);if(!valid||sd>=margin||sum<1e-12)return;auto lambda=(margin-sd)/sum;auto fa=wa*w*lambda;auto fb=wb*w*lambda;add(pa,gx*fa,gy*fa,gz*fa);add(pb,gx*fb,gy*fb,gz*fb);if(three){auto fc=wc*w*lambda;add(pc,gx*fc,gy*fc,gz*fc);}contacts++;}
__attribute__((export_name("surfaces"))) void surfaces(){for(auto i=0;i<E;i++){auto p=edges+usize(i)*8;contact(load<i32>(p),load<i32>(p+4),0,false,.0015);}for(auto i=0;i<T;i++){auto p=ti+usize(i)*12;contact(load<i32>(p),load<i32>(p+4),load<i32>(p+8),true,.0015);}}

__attribute__((export_name("getContacts"))) int getContacts(){return contacts;}
// R07 local/global geometric relaxation. Not a calibrated fabric simulator.
// Uses original triangle material gradients and active original stitch pairs.
usize rhs=0,sol=0,res=0,dir=0,aptr=0,zptr=0,diag=0;f64 gdamp=.01,gseam=30,gbody=20;
__attribute__((export_name("configureGlobal"))) void configureGlobal(usize B,usize X,usize R,usize P,usize A,usize Z,usize D){rhs=B;sol=X;res=R;dir=P;aptr=A;zptr=Z;diag=D;}
inline int root(int a){return load<i32>(alias+usize(a)*4);}
inline double row(usize p,int i,int j){return load<double>(p+usize(i*3+j)*8);}
inline void put(usize p,int i,int j,double x){store<double>(p+usize(i*3+j)*8,x);}
inline void plus(usize p,int i,int j,double x){put(p,i,j,row(p,i,j)+x);}
inline double coeff(int t,int k){return load<double>(tf+usize(t*6+k)*8);}
inline double tarea(int t){return .5/__builtin_fabs(coeff(t,1)*coeff(t,5)-coeff(t,2)*coeff(t,4));}
void multiply(usize x,usize out,int base){
 for(int i=0;i<N;i++)for(int j=0;j<3;j++)put(out,i,j,load<double>(diag+usize(i)*8)*row(x,i,j));
 for(int t=0;t<T;t++){
  int ids[3];double u[3],v[3];for(int k=0;k<3;k++){ids[k]=root(load<int>(ti+usize(t*3+k)*4));u[k]=coeff(t,k);v[k]=coeff(t,k+3);}
  double a=tarea(t);
  for(int j=0;j<3;j++){double U=0,V=0;for(int k=0;k<3;k++){U+=u[k]*row(x,ids[k],j);V+=v[k]*row(x,ids[k],j);}for(int k=0;k<3;k++)plus(out,ids[k],j,a*(u[k]*U+v[k]*V));}
 }
 for(int i=base;i<C;i++){auto d=cf+usize(i)*80;if(load<double>(d+48)!=0)continue;int a=root(load<int>(ci+usize(i)*8)),b=root(load<int>(ci+usize(i)*8+4));if(a==b)continue;for(int j=0;j<3;j++){double v=gseam*(row(x,a,j)-row(x,b,j));plus(out,a,j,v);plus(out,b,j,-v);}}
}
__attribute__((export_name("globalProject"))) double globalProject(int base,int iterations,double damp,double seam,double body){
 gdamp=damp;gseam=seam;gbody=body;
 usize pre=zptr+usize(N*3)*8;
 for(int i=0;i<N;i++){
  auto p=point(i);double w=root(i)==i?gdamp:1.0;double target[3]={load<double>(p),load<double>(p+8),load<double>(p+16)};
  if(root(i)==i){sample(target[0],target[1],target[2],.0035);if(valid&&sd<.0035){double d=.0035-sd;target[0]+=gx*d;target[1]+=gy*d;target[2]+=gz*d;w+=gbody;}}
  if(weight(i)==0&&root(i)==i)w+=1e6;
  store<double>(diag+usize(i)*8,w);store<double>(pre+usize(i)*8,w);
  for(int j=0;j<3;j++){put(sol,i,j,load<double>(p+usize(j)*8));put(rhs,i,j,w*target[j]);}
 }
 for(int t=0;t<T;t++){
  int ids[3];double u[3],v[3],U[3]={0,0,0},V[3]={0,0,0};for(int k=0;k<3;k++){ids[k]=root(load<int>(ti+usize(t*3+k)*4));u[k]=coeff(t,k);v[k]=coeff(t,k+3);for(int j=0;j<3;j++){U[j]+=u[k]*row(sol,ids[k],j);V[j]+=v[k]*row(sol,ids[k],j);}}
  double aa=0,bb=0,ab=0;for(int j=0;j<3;j++){aa+=U[j]*U[j];bb+=V[j]*V[j];ab+=U[j]*V[j];}
  double d=aa-bb,rad=__builtin_sqrt(d*d+4*ab*ab),co=1,si=0;
  if(rad>1e-30){if(d>=0){co=__builtin_sqrt(.5*(1+d/rad));si=ab/(rad*co);}else{si=(ab<0?-1.0:1.0)*__builtin_sqrt(.5*(1-d/rad));co=ab==0?0:ab/(rad*si);}}
  double l1=__builtin_sqrt(max2(1e-20,(aa+bb+rad)*.5)),l2=__builtin_sqrt(max2(1e-20,(aa+bb-rad)*.5));
  double f1=max2(.985,min2(1.015,l1))/l1,f2=max2(.985,min2(1.015,l2))/l2;
  double m00=co*co*f1+si*si*f2,m11=si*si*f1+co*co*f2,m01=co*si*(f1-f2),area=tarea(t);
  for(int k=0;k<3;k++){
   double pc=load<double>(pre+usize(ids[k])*8);store<double>(pre+usize(ids[k])*8,pc+area*(u[k]*u[k]+v[k]*v[k]));
   for(int j=0;j<3;j++)plus(rhs,ids[k],j,area*(u[k]*(m00*U[j]+m01*V[j])+v[k]*(m01*U[j]+m11*V[j])));
  }
 }
 for(int i=base;i<C;i++){auto d=cf+usize(i)*80;if(load<double>(d+48)!=0)continue;int a=root(load<int>(ci+usize(i)*8)),b=root(load<int>(ci+usize(i)*8+4));if(a==b)continue;double dif[3],len=0;for(int j=0;j<3;j++){dif[j]=row(sol,a,j)-row(sol,b,j);len+=dif[j]*dif[j];}len=__builtin_sqrt(max2(len,1e-24));double target=load<double>(d+72);
  for(int j=0;j<3;j++){double v=gseam*target*dif[j]/len;plus(rhs,a,j,v);plus(rhs,b,j,-v);}
  store<double>(pre+usize(a)*8,load<double>(pre+usize(a)*8)+gseam);store<double>(pre+usize(b)*8,load<double>(pre+usize(b)*8)+gseam);
 }
 multiply(sol,aptr,base);double rr=0;
 for(int i=0;i<N;i++)for(int j=0;j<3;j++){double r=row(rhs,i,j)-row(aptr,i,j),z=r/load<double>(pre+usize(i)*8);put(res,i,j,r);put(dir,i,j,z);rr+=r*z;}
 for(int it=0;it<iterations&&rr>1e-20;it++){
  multiply(dir,aptr,base);double den=0;for(int i=0;i<N;i++)for(int j=0;j<3;j++)den+=row(dir,i,j)*row(aptr,i,j);if(den<1e-25)break;double alpha=rr/den;
  double nr=0;for(int i=0;i<N;i++)for(int j=0;j<3;j++){plus(sol,i,j,alpha*row(dir,i,j));plus(res,i,j,-alpha*row(aptr,i,j));double r=row(res,i,j),z=r/load<double>(pre+usize(i)*8);put(zptr,i,j,z);nr+=r*z;}
  double beta=nr/rr;rr=nr;for(int i=0;i<N;i++)for(int j=0;j<3;j++)put(dir,i,j,row(zptr,i,j)+beta*row(dir,i,j));
 }
 double err=0;for(int i=0;i<N;i++)if(root(i)==i){auto p=point(i);for(int j=0;j<3;j++){double next=row(sol,i,j);err=max2(err,__builtin_fabs(next-load<double>(p+usize(j)*8)));store<double>(p+usize(j)*8,next);}}
 return err;
}
// Source-bound waist loops are material constraints, not world-space position pins.
// Their edges come from the original waistband interfaces and original rest UVs.
namespace fit43 {
 usize edges=0,spans=0,targets=0,scratch=0;int loops=0;bool exterior=false;
 double lo[3],hi[3];
 double get(usize p,int i){return load<double>(p+usize(i)*8);}
 void add(usize p,int i,double v){store<double>(p+usize(i)*8,get(p,i)+v);}
 bool outside(const double p[3],double& value,double n[3]){
  if(!exterior)return false;double d[3];value=0;
  for(int k=0;k<3;k++){d[k]=p[k]<lo[k]?p[k]-lo[k]:p[k]>hi[k]?p[k]-hi[k]:0;value+=d[k]*d[k];}
  value=__builtin_sqrt(value);if(value<=0)return false;
  for(int k=0;k<3;k++)n[k]=d[k]/value;return true;
 }
 double perimeter(usize X,int loop){
  const int first=load<int>(spans+usize(loop*2)*4),end=load<int>(spans+usize(loop*2+1)*4);double length=0;
  for(int i=0;i<N*3;i++)store<double>(scratch+usize(i)*8,0.0);
  for(int j=first;j<end;j++){
   const int a=root(load<int>(edges+usize(j*2)*4)),b=root(load<int>(edges+usize(j*2+1)*4));if(a==b)continue;
   double v[3];for(int k=0;k<3;k++)v[k]=get(X,3*a+k)-get(X,3*b+k);
   const double d=norm(v[0],v[1],v[2]);if(d<1e-12)continue;length+=d;
   for(int k=0;k<3;k++){add(scratch,a*3+k,v[k]/d);add(scratch,b*3+k,-v[k]/d);}
  }return length;
 }
 double energy(usize X,usize G){
  double E=0;for(int j=0;j<loops;j++){
   double C=max2(0.0,perimeter(X,j)-get(targets,j));if(C==0)continue;
   const double stiffness=1000;E+=stiffness*C*C;
   for(int i=0;i<N*3;i++)add(G,i,2*stiffness*C*get(scratch,i));
  }return E;
 }
 void project(int repeats){
  for(int k=0;k<repeats;k++)for(int j=0;j<loops;j++){
   double C=max2(0.0,perimeter(pos,j)-get(targets,j));if(C<1e-9)continue;
   double den=0;for(int i=0;i<N;i++)if(root(i)==i){double sq=0;for(int a=0;a<3;a++){double g=get(scratch,i*3+a);sq+=g*g;}den+=weight(i)*sq;}
   if(den<1e-12)continue;const double lambda=-C/den;
   for(int i=0;i<N;i++)if(root(i)==i)for(int a=0;a<3;a++)add(pos,i*3+a,weight(i)*lambda*get(scratch,i*3+a));
  }
 }
}
__attribute__((export_name("setBodyExterior43"))) void setBodyExterior43(double lx,double ly,double lz,double hx,double hy,double hz){fit43::lo[0]=lx;fit43::lo[1]=ly;fit43::lo[2]=lz;fit43::hi[0]=hx;fit43::hi[1]=hy;fit43::hi[2]=hz;fit43::exterior=true;}
__attribute__((export_name("setWaistLoops43"))) void setWaistLoops43(usize edges,usize spans,usize targets,usize scratch,int count){fit43::edges=edges;fit43::spans=spans;fit43::targets=targets;fit43::scratch=scratch;fit43::loops=count;}
__attribute__((export_name("waistProject43"))) void waistProject43(int repeats){fit43::project(repeats);}
// Original implementation of bounded L-BFGS geometric refinement.
// This is a static fitting objective, not calibrated fabric dynamics or IPC.
// All material gradients, stitch identities and the body field are inherited.
namespace qn {
constexpr int H=12;usize x=0,g=0,trial=0,tg=0,direction=0,work=0,reference=0,hs=0,hy=0,guideIds=0,guideMargins=0;
int guides=0,base=0,count=0,next=0,iterations=0,rejected=0,status=0;double current=0,initial=0,alphas[H],rhos[H],previousEnergy=0,maxMove=0,gradNorm=0;
inline double get(usize a,int i){return load<double>(a+usize(i)*8);}inline void set(usize a,int i,double v){store<double>(a+usize(i)*8,v);}inline void addv(usize a,int i,double v){set(a,i,get(a,i)+v);}inline double clip(double v,double a,double b){return max2(a,min2(v,b));}
inline bool finite(double v){return __builtin_isfinite(v);}
inline double dotv(const double*a,const double*b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
void at(usize q,int i,double out[3]){i=root(i);for(int k=0;k<3;k++)out[k]=get(q,3*i+k);}
void gradadd(usize q,int i,const double a[3],double scale){i=root(i);for(int k=0;k<3;k++)addv(q,3*i+k,a[k]*scale);}
// Exact derivative of the same trilinearly interpolated original body SDF.
bool bodySample(const double p[3],double &value,double n[3]){
 double f[3]={(p[0]*1000-ox)/spacing,(p[1]*1000-oy)/spacing,(p[2]*1000-oz)/spacing};
 if(f[0]<0||f[1]<0||f[2]<0||f[0]>=nx-1||f[1]>=ny-1||f[2]>=nz-1)return fit43::outside(p,value,n);
 int i=(int)__builtin_floor(f[0]),j=(int)__builtin_floor(f[1]),k=(int)__builtin_floor(f[2]);double u=f[0]-i,v=f[1]-j,w=f[2]-k;int o=(k*ny+j)*nx+i,nxy=nx*ny;
 double a=field(o),b=field(o+1),c=field(o+nx),d=field(o+nx+1),e=field(o+nxy),ff=field(o+nxy+1),gg=field(o+nxy+nx),hh=field(o+nxy+nx+1);
 double lo=(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v,hi=(e*(1-u)+ff*u)*(1-v)+(gg*(1-u)+hh*u)*v;
 value=(lo*(1-w)+hi*w)*quant*.001;
 n[0]=(((b-a)*(1-v)+(d-c)*v)*(1-w)+((ff-e)*(1-v)+(hh-gg)*v)*w)*quant/spacing;
 n[1]=(((c-a)*(1-u)+(d-b)*u)*(1-w)+((gg-e)*(1-u)+(hh-ff)*u)*w)*quant/spacing;n[2]=(hi-lo)*quant/spacing;return true;
}
double energy(usize X,usize G){
 const double mu=1000,bodyWeight=100,seamWeight=100,guideWeight=100;double out=0;
 for(int i=0;i<N*3;i++)set(G,i,0);
 for(int t=0;t<T;t++){
  int ids[3];double u[3],v[3],U[3]={0,0,0},V[3]={0,0,0};
  for(int a=0;a<3;a++){ids[a]=root(load<int>(ti+usize(t*3+a)*4));u[a]=coeff(t,a);v[a]=coeff(t,a+3);for(int k=0;k<3;k++){U[k]+=u[a]*get(X,ids[a]*3+k);V[k]+=v[a]*get(X,ids[a]*3+k);}}
  double aa=dotv(U,U),bb=dotv(V,V),ab=dotv(U,V),delta=aa-bb,rad=__builtin_sqrt(delta*delta+4*ab*ab),co=1,si=0;
  if(rad>1e-30){if(delta>=0){co=__builtin_sqrt(.5*(1+delta/rad));si=ab/(rad*co);}else{si=(ab<0?-1:1)*__builtin_sqrt(.5*(1-delta/rad));co=ab==0?0:ab/(rad*si);}}
  double s1=__builtin_sqrt(max2(1e-20,(aa+bb+rad)*.5)),s2=__builtin_sqrt(max2(1e-20,(aa+bb-rad)*.5)),area=tarea(t);
  double e1=s1-clip(s1,.985,1.015),e2=s2-clip(s2,.985,1.015),h1=s1-clip(s1,.88,1.12),h2=s2-clip(s2,.88,1.12);
  out+=area*(e1*e1+e2*e2+mu*(h1*h1+h2*h2));double a1=2*area*(e1+mu*h1)/s1,a2=2*area*(e2+mu*h2)/s2;
  double m00=co*co*a1+si*si*a2,m11=si*si*a1+co*co*a2,m01=co*si*(a1-a2);
  for(int a=0;a<3;a++)for(int k=0;k<3;k++)addv(G,ids[a]*3+k,u[a]*(m00*U[k]+m01*V[k])+v[a]*(m01*U[k]+m11*V[k]));
 }
 for(int i=0;i<N;i++)if(root(i)==i){double p[3],n[3],sdq;at(X,i,p);if(!bodySample(p,sdq,n))return 1e100;double pen=min2(0,sdq-.0035);out+=bodyWeight*pen*pen;gradadd(G,i,n,2*bodyWeight*pen);
  for(int k=0;k<3;k++){double diff=p[k]-get(reference,i*3+k);out+=.00002*diff*diff;addv(G,i*3+k,.00004*diff);}
 }
 for(int c=base;c<C;c++){
  auto p=cf+usize(c)*80;if(load<double>(p+48)!=0)continue;int a=root(load<int>(ci+usize(c)*8)),b=root(load<int>(ci+usize(c)*8+4));if(a==b)continue;
  for(int k=0;k<3;k++){double d=get(X,a*3+k)-get(X,b*3+k);out+=seamWeight*d*d;addv(G,a*3+k,2*seamWeight*d);addv(G,b*3+k,-2*seamWeight*d);}
 }
 for(int z=0;z<guides;z++){
  int ids[4];double P[4][3],t[3],w[3],u[3];for(int j=0;j<4;j++){ids[j]=root(load<int>(guideIds+usize(z*4+j)*4));at(X,ids[j],P[j]);}
  for(int k=0;k<3;k++){t[k]=P[1][k]-P[0][k];w[k]=P[2][k]-P[0][k];u[k]=P[3][k]-P[0][k];}
  double L=dotv(t,t),a=dotv(w,u),b=dotv(t,w),c=dotv(t,u),d=dotv(w,w),h=L*a-b*c,q=L*d-b*b,D=__builtin_sqrt(max2(1e-24,L*q));
  // Reject degenerate guide frames; do not silently invent a normal.
  if(L<1e-20||q<1e-24)return 1e100;
  double pen=h/D+get(guideMargins,z);if(pen<=0)continue;out+=guideWeight*pen*pen;
  for(int k=0;k<3;k++){
   double dHt=2*t[k]*a-w[k]*c-u[k]*b,dHw=L*u[k]-t[k]*c,dHu=L*w[k]-t[k]*b;
   double dDt=(t[k]*q+L*(t[k]*d-b*w[k]))/D,dDw=L*(L*w[k]-b*t[k])/D;
   double gt=dHt/D-h*dDt/(D*D),gw=dHw/D-h*dDw/(D*D),gu=dHu/D,scale=2*guideWeight*pen;
   addv(G,ids[0]*3+k,scale*(-gt-gw-gu));addv(G,ids[1]*3+k,scale*gt);addv(G,ids[2]*3+k,scale*gw);addv(G,ids[3]*3+k,scale*gu);
  }
 }
 out+=fit43::energy(X,G);return finite(out)?out:1e100;
}
double dot(usize a,usize b){double s=0;for(int i=0;i<N*3;i++)s+=get(a,i)*get(b,i);return s;}
void copy(usize a,usize b){for(int i=0;i<N*3;i++)set(b,i,get(a,i));}
void init(usize memory,usize gi,usize gm,int ng,int bc){int k=N*3;usize sz=usize(k)*8;x=memory;g=x+sz;trial=g+sz;tg=trial+sz;direction=tg+sz;work=direction+sz;reference=work+sz;hs=reference+sz;hy=hs+H*sz;guideIds=gi;guideMargins=gm;guides=ng;base=bc;count=next=iterations=rejected=status=0;
 for(int i=0;i<N;i++)for(int j=0;j<3;j++){double v=load<double>(point(i)+usize(j)*8);set(x,i*3+j,v);set(reference,i*3+j,v);}current=initial=energy(x,g);gradNorm=__builtin_sqrt(dot(g,g));if(!finite(current)||current>=1e99)status=-1;
}
int step(){
 if(status)return status;copy(g,work);usize sz=usize(N*3)*8;
 for(int j=0;j<count;j++){int ix=(next-1-j+H)%H;usize ss=hs+ix*sz,yy=hy+ix*sz;double a=rhos[ix]*dot(ss,work);alphas[ix]=a;for(int i=0;i<N*3;i++)set(work,i,get(work,i)-a*get(yy,i));}
 double gamma=.001;if(count){int ix=(next-1+H)%H;double yy=dot(hy+ix*sz,hy+ix*sz);gamma=yy>1e-30?(1/rhos[ix])/yy:.001;}
 for(int i=0;i<N*3;i++)set(direction,i,gamma*get(work,i));
 for(int j=count-1;j>=0;j--){int ix=(next-1-j+H)%H;usize ss=hs+ix*sz,yy=hy+ix*sz;double b=rhos[ix]*dot(yy,direction);for(int i=0;i<N*3;i++)addv(direction,i,get(ss,i)*(alphas[ix]-b));}
 for(int i=0;i<N*3;i++)set(direction,i,-get(direction,i));double slope=dot(g,direction);
 if(slope>=-1e-24){count=next=0;for(int i=0;i<N*3;i++)set(direction,i,-.001*get(g,i));slope=dot(g,direction);}
 double largest=0;for(int i=0;i<N;i++){double d[3]={get(direction,3*i),get(direction,3*i+1),get(direction,3*i+2)};largest=max2(largest,__builtin_sqrt(dotv(d,d)));}
 if(!finite(largest)||!finite(slope)){status=-2;return status;}if(gradNorm<1e-8){status=1;return status;}
 double alpha=min2(1.0,.0005/max2(largest,1e-30)),e=0;int bt=0;
 for(;bt<32;bt++){for(int i=0;i<N*3;i++)set(trial,i,get(x,i)+alpha*get(direction,i));e=energy(trial,tg);if(finite(e)&&e<1e99&&e<=current+1e-4*alpha*slope)break;alpha*=.5;}
 rejected+=bt;if(bt==32){status=2;return status;}
 usize ss=hs+next*sz,yy=hy+next*sz;double sy=0,sn=0,yn=0;for(int i=0;i<N*3;i++){double s=get(trial,i)-get(x,i),y=get(tg,i)-get(g,i);sy+=s*y;sn+=s*s;yn+=y*y;}
 if(sy>1e-25&&sy>1e-14*__builtin_sqrt(sn*yn)){for(int i=0;i<N*3;i++){set(ss,i,get(trial,i)-get(x,i));set(yy,i,get(tg,i)-get(g,i));}rhos[next]=1/sy;next=(next+1)%H;count=count<H?count+1:H;}
 previousEnergy=current;current=e;maxMove=alpha*largest;copy(trial,x);copy(tg,g);gradNorm=__builtin_sqrt(dot(g,g));iterations++;
 for(int i=0;i<N;i++)if(root(i)==i)for(int j=0;j<3;j++)store<double>(point(i)+usize(j)*8,get(x,3*i+j));return 0;
}
}
__attribute__((export_name("qnInit"))) void qnInit(usize m,usize gi,usize gm,int ng,int base){qn::init(m,gi,gm,ng,base);}
__attribute__((export_name("qnStep"))) int qnStep(){return qn::step();}
__attribute__((export_name("qnEnergy"))) double qnEnergy(){return qn::current;}
__attribute__((export_name("qnInitialEnergy"))) double qnInitialEnergy(){return qn::initial;}
__attribute__((export_name("qnGradNorm"))) double qnGradNorm(){return qn::gradNorm;}
__attribute__((export_name("qnIterations"))) int qnIterations(){return qn::iterations;}
__attribute__((export_name("qnBacktracks"))) int qnBacktracks(){return qn::rejected;}
__attribute__((export_name("qnStatus"))) int qnStatus(){return qn::status;}
__attribute__((export_name("qnPositionPtr"))) usize qnPositionPtr(){return qn::x;}
__attribute__((export_name("qnGradientPtr"))) usize qnGradientPtr(){return qn::g;}
__attribute__((export_name("qnEvaluate"))) double qnEvaluate(){return qn::energy(qn::x,qn::g);}

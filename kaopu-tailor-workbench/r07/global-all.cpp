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

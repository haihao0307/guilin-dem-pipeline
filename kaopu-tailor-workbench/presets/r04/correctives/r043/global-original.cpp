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

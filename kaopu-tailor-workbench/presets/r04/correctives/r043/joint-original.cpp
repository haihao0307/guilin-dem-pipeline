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
 if(f[0]<0||f[1]<0||f[2]<0||f[0]>=nx-1||f[1]>=ny-1||f[2]>=nz-1)return false;
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
 return finite(out)?out:1e100;
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

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

// Original R06 full-body signed-distance authoring tool. No substitute body geometry.
// Exact nearest source triangle; sign from area-weighted interpolated vertex normal.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <limits>
#include <numeric>
#include <vector>
struct V { double x,y,z; double operator[](int i)const{return i==0?x:i==1?y:z;} };
V operator+(V a,V b){return {a.x+b.x,a.y+b.y,a.z+b.z};}
V operator-(V a,V b){return {a.x-b.x,a.y-b.y,a.z-b.z};}
V operator*(V a,double b){return {a.x*b,a.y*b,a.z*b};}
double dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;}
V cross(V a,V b){return {a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}
V normal(V a){double l=sqrt(dot(a,a));return l>1e-14?a*(1/l):V{0,1,0};}
struct Tri {int a,b,c; V lo,hi,mid;};
struct Node {V lo,hi;int left=-1,right=-1,start=0,end=0;};
std::vector<V> vertices,normals; std::vector<Tri> triangles;std::vector<int> order;std::vector<Node> tree;
V low(V a,V b){return {std::min(a.x,b.x),std::min(a.y,b.y),std::min(a.z,b.z)};}
V high(V a,V b){return {std::max(a.x,b.x),std::max(a.y,b.y),std::max(a.z,b.z)};}
int build(int first,int last){
 Node n;n.lo={1e20,1e20,1e20};n.hi={-1e20,-1e20,-1e20};n.start=first;n.end=last;
 for(int i=first;i<last;i++){auto&t=triangles[order[i]];n.lo=low(n.lo,t.lo);n.hi=high(n.hi,t.hi);}
 int id=tree.size();tree.push_back(n);
 if(last-first>8){V d=n.hi-n.lo;int axis=d.y>d.x?1:0;if(d.z>d[axis])axis=2;int mid=(first+last)/2;
 std::nth_element(order.begin()+first,order.begin()+mid,order.begin()+last,[axis](int a,int b){return triangles[a].mid[axis]<triangles[b].mid[axis];});
 int left=build(first,mid),right=build(mid,last);tree[id].left=left;tree[id].right=right;}
 return id;
}
double boxDistance(V p,const Node&n){double s=0;for(int i=0;i<3;i++){double a=std::max({n.lo[i]-p[i],0.0,p[i]-n.hi[i]});s+=a*a;}return s;}
V closest(V p,V a,V b,V c,double&u,double&v){
 V ab=b-a,ac=c-a,ap=p-a;double d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0){u=v=0;return a;}
 V bp=p-b;double d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3){u=1;v=0;return b;}
 double vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){u=d1/(d1-d3);v=0;return a+ab*u;}
 V cp=p-c;double d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6){u=0;v=1;return c;}
 double vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){u=0;v=d2/(d2-d6);return a+ac*v;}
 double va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){v=(d4-d3)/((d4-d3)+(d5-d6));u=1-v;return b+(c-b)*v;}
 double den=va+vb+vc;if(std::abs(den)<1e-24){u=v=0;return a;}u=vb/den;v=vc/den;return a+ab*u+ac*v;
}
double signedDistance(V p){
 double best=1e30,bu=0,bv=0;int bt=-1;V bq{};int stack[128],sp=0;stack[sp++]=0;
 while(sp){const Node&n=tree[stack[--sp]];if(boxDistance(p,n)>best)continue;
 if(n.left<0){for(int j=n.start;j<n.end;j++){int ti=order[j];auto&t=triangles[ti];double u,v;V q=closest(p,vertices[t.a],vertices[t.b],vertices[t.c],u,v);V dq=p-q;double d=dot(dq,dq);if(d<best){best=d;bt=ti;bu=u;bv=v;bq=q;}}}
 else{double a=boxDistance(p,tree[n.left]),b=boxDistance(p,tree[n.right]);if(a<b){if(b<best)stack[sp++]=n.right;if(a<best)stack[sp++]=n.left;}else{if(a<best)stack[sp++]=n.left;if(b<best)stack[sp++]=n.right;}}
 }
 if(bt<0)return 1000;auto&t=triangles[bt];V n=normals[t.a]*(1-bu-bv)+normals[t.b]*bu+normals[t.c]*bv;return sqrt(best)*(dot(p-bq,n)>=0?1:-1);
}
int main(int argc,char**argv){
 if(argc!=3){std::cerr<<"input.mesh output.int16\n";return 2;}std::ifstream input(argv[1]);int nv,nf;input>>nv>>nf;if(!input||nv<3||nf<1)return 3;
 vertices.resize(nv);normals.resize(nv,{0,0,0});for(auto&v:vertices)input>>v.x>>v.y>>v.z;
 triangles.resize(nf);for(auto&t:triangles){input>>t.a>>t.b>>t.c;if(t.a<0||t.b<0||t.c<0||t.a>=nv||t.b>=nv||t.c>=nv)return 4;V a=vertices[t.a],b=vertices[t.b],c=vertices[t.c];t.lo=low(a,low(b,c));t.hi=high(a,high(b,c));t.mid=(a+b+c)*(1.0/3);V n=cross(b-a,c-a);for(int i:{t.a,t.b,t.c})normals[i]=normals[i]+n;}
 for(auto&n:normals)n=normal(n);order.resize(nf);std::iota(order.begin(),order.end(),0);tree.reserve(nf/3);build(0,nf);
 const int nx=261,ny=391,nz=131;const V origin{-650,-50,-200};std::vector<int16_t> field((size_t)nx*ny*nz);
 #pragma omp parallel for schedule(dynamic,1)
 for(int k=0;k<nz;k++)for(int j=0;j<ny;j++)for(int i=0;i<nx;i++){V p=origin+V{5.0*i,5.0*j,5.0*k};double d=signedDistance(p);field[((size_t)k*ny+j)*nx+i]=(int16_t)std::max(-32767.0,std::min(32767.0,std::round(d/.05)));}
 std::ofstream out(argv[2],std::ios::binary);out.write((char*)field.data(),field.size()*2);std::cout<<"samples "<<field.size()<<"; triangles "<<nf<<"; sign probes "<<signedDistance({640,1000,0})<<" "<<signedDistance({0,1300,0})<<"\n";
 return out?0:5;
}

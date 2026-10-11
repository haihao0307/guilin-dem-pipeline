namespace bend43b{
 usize ids=0,coeffs=0,weights=0;int count=0;
 double energy(usize X,usize G){double total=0;for(int j=0;j<count;j++){double v[3]={0,0,0},cs[4];int is[4];
  for(int a=0;a<4;a++){is[a]=root(load<int>(ids+usize(4*j+a)*4));cs[a]=load<double>(coeffs+usize(4*j+a)*8);for(int k=0;k<3;k++)v[k]+=cs[a]*load<double>(X+usize(3*is[a]+k)*8);}
  const double w=load<double>(weights+usize(j)*8);for(int k=0;k<3;k++){total+=w*v[k]*v[k];for(int a=0;a<4;a++){const usize p=G+usize(3*is[a]+k)*8;store<double>(p,load<double>(p)+2*w*v[k]*cs[a]);}}
 }return total;}
}
__attribute__((export_name("setMaterialBending43b"))) void setMaterialBending43b(usize ids,usize c,usize w,int n){bend43b::ids=ids;bend43b::coeffs=c;bend43b::weights=w;bend43b::count=n;}

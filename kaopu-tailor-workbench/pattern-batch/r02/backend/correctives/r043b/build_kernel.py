"""Build explicit source-material regularization; never modifies review thresholds."""
from pathlib import Path
import subprocess,hashlib,json
P=Path(__file__).resolve().parent;src=P.parent/'r043'
s=(src/'combined.cpp').read_text();bend=(P/'bending.cpp').read_text()
s=s.replace('namespace qn {',bend+'\nnamespace qn {',1)
assert 'out+=fit43::energy(X,G);' in s
s=s.replace('out+=fit43::energy(X,G);','out+=fit43::energy(X,G)+bend43b::energy(X,G)+surfaceBodyEnergy43b(X,G);')
quad='''// Same native body distance and derivative, evaluated at original material
// triangle centroids and edge midpoints to protect faces between cloth vertices.
double surfaceBodyEnergy43b(usize X,usize G){
 double E=0;const double weights[4][3]={{.5,.5,0},{0,.5,.5},{.5,0,.5},{1.0/3,1.0/3,1.0/3}};
 for(int t=0;t<T;t++){
  int ids[3];double P[3][3];for(int a=0;a<3;a++){ids[a]=root(load<int>(ti+usize(t*3+a)*4));at(X,ids[a],P[a]);}
  for(int j=0;j<4;j++){double p[3]={0,0,0},n[3],d;for(int a=0;a<3;a++)for(int k=0;k<3;k++)p[k]+=weights[j][a]*P[a][k];
   if(!bodySample(p,d,n))return 1e100;const double pen=min2(0.0,d-.0035);E+=100*pen*pen;
   if(pen<0)for(int a=0;a<3;a++)gradadd(G,ids[a],n,200*pen*weights[j][a]);
  }
 }return E;
}
'''
s=s.replace('double energy(usize X,usize G){\n const double mu=',quad+'\ndouble energy(usize X,usize G){\n const double mu=',1)
(P/'combined.cpp').write_text(s)
subprocess.run(['clang++','--target=wasm32','-O3','-ffp-contract=off','-nostdlib','-fno-exceptions','-fno-rtti','-Wl,--no-entry','-Wl,--export-all','-Wl,-z,stack-size=32768','-Wl,--initial-memory=131072','-o',str(P/'joint-r043b.wasm'),str(P/'combined.cpp')],check=True)
print('NATIVE43B_WASM',hashlib.sha256((P/'joint-r043b.wasm').read_bytes()).hexdigest())

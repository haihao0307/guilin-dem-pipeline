from pathlib import Path
import subprocess,hashlib
P=Path(__file__).parent;source=P.parent/'r043b/combined.cpp'
s=source.read_text();marker='double L=dotv(t,t),a=dotv(w,u),b=dotv(t,w),c=dotv(t,u),d=dotv(w,w),h=L*a-b*c,q=L*d-b*b,D=__builtin_sqrt(max2(1e-24,L*q));'
extra='''// A negative radius tags an explicit material-boundary distance constraint.
  // Positive/zero values retain the original side inequality exactly.
  if(get(guideMargins,z)<0){
   const double Ls=dotv(t,t);if(Ls<1e-20)return 1e100;
   const double alpha=clip(dotv(u,t)/Ls,0.,1.);double err[3];for(int k=0;k<3;k++)err[k]=u[k]-alpha*t[k];
   const double len=__builtin_sqrt(dotv(err,err)),tol=-get(guideMargins,z),wt=3000.;
   if(len>tol){const double pen=len-tol,scale=2*wt*pen/len;out+=wt*pen*pen;for(int k=0;k<3;k++){addv(G,ids[3]*3+k,scale*err[k]);addv(G,ids[0]*3+k,-scale*(1-alpha)*err[k]);addv(G,ids[1]*3+k,-scale*alpha*err[k]);}}
   continue;
  }
  '''
assert s.count(marker)==1;s=s.replace(marker,extra+marker);(P/'combined.cpp').write_text(s)
subprocess.run(['clang++','--target=wasm32','-O3','-ffp-contract=off','-nostdlib','-fno-exceptions','-fno-rtti','-Wl,--no-entry','-Wl,--export-all','-Wl,-z,stack-size=32768','-Wl,--initial-memory=131072','-o',str(P/'joint-r043c.wasm'),str(P/'combined.cpp')],check=True)
print('SEAM_SPAN_KERNEL',hashlib.sha256((P/'joint-r043c.wasm').read_bytes()).hexdigest())

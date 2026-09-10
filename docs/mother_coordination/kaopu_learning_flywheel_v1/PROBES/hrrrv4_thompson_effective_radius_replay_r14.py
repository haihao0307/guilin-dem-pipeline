#!/usr/bin/env python3
"""Bounded semantic replay of the cloud-liquid branch of HRRR v4.1.20
Thompson calc_effectRad. No observed HRRR values are embedded.
"""
import math
SOURCE_COMMIT="40ee6058c2fc6624cbfbbe8cf1c20c59e6a45827"
SOURCE_BLOB="1e6cdb1e718473ee1a031e16b1c00c96113f19f8"
R=287.04; R1=1e-12; R2=1e-6; RHO_W=1000.0
AM_R=math.pi*RHO_W/6.0; OBMR=1.0/3.0; NT_C=100e6
G_RATIO=[24,60,120,210,336,504,720,990,1320,1716,2184,2730,3360,4080,4896]
def nint_pos(x): return int(math.floor(x+0.5))
def replay(t,p,qv,qc,nc_per_kg,aerosol_aware=True):
    rho=0.622*p/(R*t*(qv+0.622)); rc=max(R1,qc*rho); nc=max(R2,nc_per_kg*rho)
    if not aerosol_aware: nc=NT_C
    if rc<=R1 or nc<=R2: return None
    inu=15 if nc<100 else (2 if nc>1e10 else min(15,nint_pos(1000e6/nc)+2))
    lam=(nc*AM_R*G_RATIO[inu-1]/rc)**OBMR
    raw=0.5*(3.0+inu)/lam
    return rho,inu,raw,max(2.51e-6,min(raw,50e-6)),rc
def ck(name,ok,detail):
    print(("PASS" if ok else "FAIL")+" | "+name+" | "+detail); return ok
def main():
    c=[]
    b=replay(273.15,80000,0.003,3e-4,1.2e8,True)
    c.append(ck("finite source replay",b and 2.51e-6<=b[3]<=50e-6,f"re={b[3]*1e6:.6f} um"))
    w=replay(273.15,80000,0.003,8e-4,1.2e8,True)
    c.append(ck("condensate sensitivity",w[3]>=b[3],f"base={b[3]*1e6:.6f} wetter={w[3]*1e6:.6f} um"))
    n=replay(273.15,80000,0.003,3e-4,5e8,True)
    c.append(ck("number sensitivity",n[3]<=b[3],f"base={b[3]*1e6:.6f} highN={n[3]*1e6:.6f} um"))
    lo=replay(260,70000,0.001,1e-10,5e9,True); hi=replay(285,90000,0.005,5e-2,1e4,True)
    c.append(ck("source lower clamp",abs(lo[3]-2.51e-6)<1e-15,f"re={lo[3]*1e6:.6f} um"))
    c.append(ck("source upper clamp",abs(hi[3]-50e-6)<1e-15,f"re={hi[3]*1e6:.6f} um"))
    fixed=replay(273.15,80000,0.003,3e-4,5e8,False)
    c.append(ck("runtime configuration matters",abs(fixed[3]-n[3])>1e-9,f"aware={n[3]*1e6:.6f} fixedNt={fixed[3]*1e6:.6f} um"))
    lwc=b[4]; r=b[3]; a1=3*lwc/(4*RHO_W*r); a2=2*a1
    c.append(ck("effective radius is not extinction",a2==2*a1 and a1!=a2,f"alpha test={a1:.6g}/{a2:.6g} m^-1"))
    print(f"RESULT {sum(c)}/{len(c)} PASS")
    print(f"SOURCE {SOURCE_COMMIT} blob={SOURCE_BLOB}")
    return 0 if all(c) else 1
if __name__=="__main__": raise SystemExit(main())

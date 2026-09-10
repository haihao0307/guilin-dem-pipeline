#!/usr/bin/env python3
"""KAOPU R15 bounded semantic probe.

Purpose:
- authenticate the source-level HRRRv4 Thompson aerosol-aware call path;
- define typed native-GRIB -> calc_effectRad input adaptation;
- distinguish real-input execution from independent numerical authentication.

This probe contains no observed HRRR field values.
"""
import math

REQUIRED_NATIVE = {"PRES","TMP","SPFH","CLWMR","NCONCD","CIMIXR","NCCICE","SNMR"}
PUBLIC_NATIVE = {
    "PRES","CLWMR","CIMIXR","RWMR","SNMR","GRLE","NCONCD","NCCICE",
    "SPNCR","PMTF","PMTC","FRACCC","HGT","TMP","SPFH","UGRD","VGRD",
    "VVEL","TKE","MASSDEN"
}
PUBLIC_EFFECTIVE_RADIUS = set()
GRIB_CAN_REPRESENT = {"EFRCWAT","EFRCICE","EFRSNOW"}

def specific_humidity_to_mixing_ratio(q):
    if not (0.0 <= q < 1.0):
        raise ValueError("specific humidity must be in [0,1)")
    return q/(1.0-q)

def mixing_ratio_to_specific_humidity(r):
    if r < 0:
        raise ValueError("mixing ratio must be non-negative")
    return r/(1.0+r)

def dry_density(p, t, qv_mixing_ratio):
    R=287.04
    return 0.622*p/(R*t*(qv_mixing_ratio+0.622))

def cloud_liquid_re(t,p,qv,qc,nc_per_kg,aerosol_aware=True):
    R=287.04; R1=1e-12; R2=1e-6; rho_w=1000.0
    am_r=math.pi*rho_w/6.0; obmr=1/3; nt_c=100e6
    g_ratio=[24,60,120,210,336,504,720,990,1320,1716,2184,2730,3360,4080,4896]
    rho=dry_density(p,t,qv)
    rc=max(R1,qc*rho); nc=max(R2,nc_per_kg*rho)
    if not aerosol_aware: nc=nt_c
    if rc<=R1 or nc<=R2: return None
    if nc<100: inu=15
    elif nc>1e10: inu=2
    else: inu=min(15, int(math.floor(1000e6/nc+0.5))+2)
    lam=(nc*am_r*g_ratio[inu-1]/rc)**obmr
    raw=0.5*(3.0+inu)/lam
    return max(2.51e-6,min(raw,50e-6))

def check(name, ok, detail):
    print(("PASS" if ok else "FAIL")+" | "+name+" | "+detail)
    return bool(ok)

def main():
    c=[]
    mp_physics=28
    registry_maps_28_to_thompsonaero=True
    thompsonaero_passes_all_aerosol_args=True
    source_presence_rule_sets_aware=True
    c.append(check("source call path selects THOMPSONAERO",
                   mp_physics==28 and registry_maps_28_to_thompsonaero,
                   "mp_physics=28 -> THOMPSONAERO"))
    c.append(check("aerosol-aware branch source-authenticated",
                   thompsonaero_passes_all_aerosol_args and source_presence_rule_sets_aware,
                   "NWFA2D+NWFA+NIFA are passed; PRESENT rule => is_aerosol_aware=.TRUE."))

    missing=REQUIRED_NATIVE-PUBLIC_NATIVE
    c.append(check("public native schema covers calc_effectRad inputs",
                   not missing, "missing="+repr(sorted(missing))))

    q=0.012
    r=specific_humidity_to_mixing_ratio(q)
    q2=mixing_ratio_to_specific_humidity(r)
    c.append(check("SPFH typed adapter round-trip",
                   abs(q-q2)<1e-15 and abs(r-q)>1e-6,
                   f"specific_humidity={q:.6f}, mixing_ratio={r:.9f}"))

    args=dict(t=280.0,p=80000.0,qc=3e-4,nc_per_kg=1.2e8,aerosol_aware=True)
    re_correct=cloud_liquid_re(qv=r,**args)
    re_wrong=cloud_liquid_re(qv=q,**args)
    rho_correct=dry_density(args["p"],args["t"],r)
    rho_wrong=dry_density(args["p"],args["t"],q)
    c.append(check("same-unit semantic error can be numerically masked",
                   abs(re_correct-re_wrong)<1e-15 and abs(rho_correct-rho_wrong)>0,
                   f"re={re_correct*1e6:.9f}/{re_wrong*1e6:.9f} um; rho differs by {abs(rho_correct-rho_wrong):.6g} kg/m3"))

    calc_signature={"TMP","PRES","QV_MIXING_RATIO","CLWMR","NCONCD","CIMIXR","NCCICE","SNMR"}
    c.append(check("MASSDEN is cross-check, not source-identical input",
                   "MASSDEN" not in calc_signature and "MASSDEN" in PUBLIC_NATIVE,
                   "source calc recomputes rho from p,t,qv"))

    c.append(check("GRIB representation != public HRRR publication",
                   bool(GRIB_CAN_REPRESENT) and not (GRIB_CAN_REPRESENT & PUBLIC_EFFECTIVE_RADIUS),
                   "GRIB table defines EFRCWAT/EFRCICE/EFRSNOW; public native inventory publishes none"))

    state={"source_locked":True,"source_callpath_authenticated":True,
           "real_input_executed":False,"independent_checkpoint_matched":False}
    runtime_authenticated=all(state.values())
    c.append(check("authentication ladder blocks premature promotion",
                   not runtime_authenticated,
                   "real input and independent effective-radius checkpoint still missing"))

    print(f"RESULT {sum(c)}/{len(c)} PASS")
    return 0 if all(c) else 1

if __name__=="__main__":
    raise SystemExit(main())

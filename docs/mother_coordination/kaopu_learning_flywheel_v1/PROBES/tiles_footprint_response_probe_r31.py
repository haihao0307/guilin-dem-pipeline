#!/usr/bin/env python3
"""Bounded KAOPU R31 fixture for the Tiles R2 footprint response.

This does not emulate the Tiles simplex field.  It isolates the exact response
curve used by the fixed shader commit and tests single vs repeated application
on plane waves, whose rectangular-footprint averages are analytic.
"""
from __future__ import annotations
import json, math, random

SEED = 20260911
SAMPLES = 4096
SOURCE_COMMIT = "95c97a96877a0b09660d1887ce858fe1c018a5c8"

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x-a)/(b-a)))
    return t*t*(3.0-2.0*t)

def band(footprint, scale):
    return 1.0-smoothstep(0.35, 0.95, footprint*scale)

def sinc(x):
    return 1.0 if abs(x)<1e-14 else math.sin(math.pi*x)/(math.pi*x)

def rmse(errors):
    return math.sqrt(sum(e*e for e in errors)/len(errors))

def run_case(scale, amplitude, normalized_footprint):
    rng=random.Random(SEED+int(scale*17)+int(normalized_footprint*1000))
    fp=normalized_footprint/scale
    g=band(fp, scale)
    errors={"point":[],"singleGate":[],"doubleGate":[]}
    for _ in range(SAMPLES):
        theta=rng.random()*2.0*math.pi
        phase=rng.random()*2.0*math.pi
        x=rng.random(); y=rng.random()
        u=math.cos(theta); v=math.sin(theta)
        center=amplitude*math.sin(2.0*math.pi*scale*(u*x+v*y)+phase)
        exact=center*sinc(scale*u*fp)*sinc(scale*v*fp)
        estimates={"point":center,"singleGate":center*g,"doubleGate":center*g*g}
        for k,val in estimates.items(): errors[k].append(val-exact)
    return {"scale":scale,"amplitudeMetres":amplitude,"normalizedFootprint":normalized_footprint,"footprintMetres":fp,"gate":g,"rmseMetres":{k:rmse(v) for k,v in errors.items()}}

def main():
    cases=[]
    for scale,amplitude in ((390.0,0.00012),(1167.0,0.000047)):
        for nfp in (0.35,0.50,0.65,0.80,0.95): cases.append(run_case(scale,amplitude,nfp))
    transition=[c for c in cases if 0.0<c["gate"]<1.0]
    single=sum(c["rmseMetres"]["singleGate"] for c in transition)
    double=sum(c["rmseMetres"]["doubleGate"] for c in transition)
    result={
      "schema":"kaopu-tiles-footprint-response/r31",
      "status":"Candidate",
      "fixedSource":{"repository":"haihao0307/HOUSE","commit":SOURCE_COMMIT,"path":"tiles-mother/r2-closeout-06-handmade/START_HERE.html","shaderResponse":"band(fp, scale)=1-smoothstep(.35,.95,fp*scale); grain and micro are gated during assignment and multiplied by band again in structuralHeight"},
      "fixture":{"basis":"oriented plane-wave surrogate","samplesPerCase":SAMPLES,"seed":SEED,"reference":"analytic rectangular-footprint average","scope":"response-curve counterexample; not WebGL or visual acceptance"},
      "cases":cases,
      "aggregateTransitionRmseMetres":{"singleGate":single,"doubleGate":double,"doubleOverSingle":double/single},
      "judgment":"Repeated application is not idempotent and increases error in this bounded fixture; require one declared response per signal path and measure the actual shader before changing production.",
      "frozenChanged":False,
      "productionMotherChanged":False
    }
    if not double>single*1.05: raise SystemExit("FAIL: fixture did not distinguish repeated response")
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0

if __name__=="__main__": raise SystemExit(main())

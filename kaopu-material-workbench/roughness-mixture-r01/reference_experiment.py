#!/usr/bin/env python3
"""Original, dependency-free GGX area-mixture experiment. Not a renderer.

Equations: Filament v1.56.0 D_GGX, V_SmithGGXCorrelated and F_Schlick.
Only Python stdlib runs. Files in teacher-source/ are read-only references.
The chosen model is its high-quality single-scattering specular BRDF, not all
of Filament, and not the KAOPU production renderer.
"""
import csv
import json
import math
from pathlib import Path

PI = math.pi
ROOT = Path(__file__).resolve().parent


def specular(r, view_deg, light_deg, f0=0.04, azimuth_deg=0.0):
    """GGX BRDF (sr^-1), not gamma-encoded display color.

    Signed light angle is in the view plane when azimuth_deg is zero.
    Perceptual roughness r maps to alpha = r*r. No energy compensation,
    diffuse, clearcoat, shadows, color, normal perturbation, or tone mapping.
    """
    if not (0 < r <= 1 and 0 <= f0 <= 1):
        raise ValueError('r must be in (0,1], f0 in [0,1]')
    v, l, az = map(math.radians, (view_deg, light_deg, azimuth_deg))
    nv, nl = math.cos(v), math.cos(l)
    if nv <= 0 or nl <= 0:
        raise ValueError('incident and outgoing directions must be above horizon')
    vv = (math.sin(v), 0.0, nv)
    ll = (math.sin(l)*math.cos(az), math.sin(l)*math.sin(az), nl)
    h = tuple(a+b for a,b in zip(vv,ll))
    length = math.sqrt(sum(a*a for a in h))
    h = tuple(a/length for a in h)
    nh = h[2]
    vh = max(0.0, min(1.0, sum(a*b for a,b in zip(vv,h))))
    alpha = r*r
    alpha2 = alpha*alpha
    denominator = 1.0 + (alpha2-1.0)*nh*nh
    d = alpha2/(PI*denominator*denominator)
    visibility = 0.5/(
        nl*math.sqrt(alpha2+(1-alpha2)*nv*nv)
        + nv*math.sqrt(alpha2+(1-alpha2)*nl*nl)
    )
    fresnel = f0+(1-f0)*(1-vh)**5
    return d*visibility*fresnel


def response(r, view, light):
    return specular(r, view, light)*math.cos(math.radians(light))


def mixture(r1, r2, weight, view, light):
    if not 0 <= weight <= 1:
        raise ValueError('area weight must be in [0,1]')
    return weight*response(r1,view,light)+(1-weight)*response(r2,view,light)


def roughness_models(r1,r2,w):
    return {
        'mean_perceptual_r': w*r1+(1-w)*r2,
        'mean_alpha': math.sqrt(w*r1*r1+(1-w)*r2*r2),
        'mean_alpha_squared': (w*r1**4+(1-w)*r2**4)**0.25,
        # Exact peak match for this model at N=V=L and common F0.
        # It is a diagnostic counterexample, NOT a recommended replacement.
        'normal_peak_match': (w/r1**4+(1-w)/r2**4)**-0.25,
    }


def cases():
    # KAOPU ed015e34: base ceramic r, grout r, and metres for tile/joint.
    # Dry intact front-face ceramic gives exactly base roughness. Actual
    # KAOPU ceramic also has clearcoat, intentionally disabled in this test.
    return [
        ('half_tile_half_grout',.34,.91,.5),
        ('interior_tile_one_period',.34,.91,(.298/.301)**2),
        ('exterior_tile_one_period',.29,.91,(.198*.048)/(.201*.051)),
        ('same_roughness_control',.34,.34,.5),
    ]


def main():
    out=ROOT/'results'; out.mkdir(exist_ok=True)
    rows=[]; summary=[]
    for name,r1,r2,w in cases():
        models=roughness_models(r1,r2,w)
        peak=mixture(r1,r2,w,0,0)
        ref30=mixture(r1,r2,w,0,30)
        item={'case':name,'r1':r1,'r2':r2,'area_weight_r1':w,
              'reference_peak':peak,'models':{}}
        for model,r in models.items():
            value=response(r,0,0)
            item['models'][model]={'r':r,'normal_peak':value,
                'normal_peak_error_percent':100*(value/peak-1),
                'response_at_light_30deg':response(r,0,30),
                'light_30deg_error_percent':100*(response(r,0,30)/ref30-1)}
        summary.append(item)
        for view in (0,30,60,80):
            for light in range(-85,86):
                reference=mixture(r1,r2,w,view,light)
                row={'case':name,'view_deg':view,'light_deg':light,'reference':reference}
                for model,r in models.items():
                    row[model]=response(r,view,light)
                    row[model+'_error_percent']=100*(row[model]/reference-1)
                rows.append(row)
    with (out/'angle_sweep.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    result={'version':'r01','date_utc':'2026-10-22','cases':len(cases()),
        'angle_samples':len(rows),'scalar_comparisons':len(rows)*4,
        'model':'GGX + correlated Smith + Schlick, single scattering, F0=0.04',
        'reference':'linear area mixture of two fully evaluated BRDF responses',
        'summary':summary}
    (out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    main()

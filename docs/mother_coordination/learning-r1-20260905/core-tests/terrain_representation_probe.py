"""Original CPU-only diagnostic examples; no measured terrain or third-party shaders.
The feature-aware fit receives the narrow feature location/width explicitly.
No claim of automatic feature discovery or real-terrain compression is made.
"""
from __future__ import annotations
import json, math, platform
from pathlib import Path
import numpy as np


def projected_pixels(error_m: float, depth_m: float, pixels: int = 1080, fov_deg: float = 60.0) -> float:
    if not all(math.isfinite(v) for v in (error_m, depth_m, fov_deg)):
        raise ValueError('Finite inputs required')
    if depth_m <= 0 or pixels <= 0 or not 0 < fov_deg < 180:
        raise ValueError('Invalid camera geometry')
    focal = pixels / (2 * math.tan(math.radians(fov_deg / 2)))
    return abs(error_m) * focal / depth_m


def run() -> dict:
    n = 129
    a = np.linspace(0.0, 1.0, n)
    x, z = np.meshgrid(a, a, indexing='xy')
    x, z = x.ravel(), z.ravel()
    bx, bz = np.sin(2 * np.pi * x), np.cos(2 * np.pi * z)
    basis = np.column_stack((np.ones_like(x), x, z, bx, bz, bx*bz))
    # Supplied structural feature, 1600 m square patch, narrow across x.
    ridge = np.exp(-((x-.52)/.012)**2 - ((z-.55)/.20)**2)
    source = basis @ np.array([120.,60.,-20.,40.,25.,12.]) + 20 * ridge
    rows, cols = np.indices((n,n))
    train = ((rows+cols).ravel() % 2) == 0
    test = ~train
    c0 = np.linalg.lstsq(basis[train], source[train], rcond=None)[0]
    augmented = np.column_stack((basis, ridge))
    c1 = np.linalg.lstsq(augmented[train], source[train], rcond=None)[0]
    coarse = basis @ c0
    feature_fit = augmented @ c1
    def metrics(pred):
        e = pred[test] - source[test]
        return {'test_rmse_m':float(np.sqrt(np.mean(e*e))),
                'test_max_abs_m':float(np.max(np.abs(e)))}
    m0,m1=metrics(coarse),metrics(feature_fit)
    assert m0['test_rmse_m'] < 2.0
    assert m0['test_max_abs_m'] > 15.0
    assert m1['test_max_abs_m'] < 1e-9
    # Numeric coefficients survive a normal JSON round trip in this environment.
    restored = np.array(json.loads(json.dumps(c1.tolist(),allow_nan=False)))
    assert np.array_equal(restored, c1)
    assert np.max(np.abs(augmented @ restored-feature_fit)) < 1e-9

    cameras=[]
    for depth in (1000.,3000.,5000.):
        cameras.append({'depth_m':depth,
                        'one_pixel_m':1/projected_pixels(1,depth),
                        'ten_metre_error_pixels':projected_pixels(10,depth),
                        'coarse_test_max_error_pixels':projected_pixels(m0['test_max_abs_m'],depth)})
    # Exactly averaged analytic surrogates, not a general noise filtering proof.
    theta=(np.arange(65536)+.5)*(2*np.pi/65536)
    ridged=(1-np.abs(np.sin(theta)))**2
    expected_mean=1.5-4/np.pi
    sampled_mean=float(ridged.mean())
    assert abs(sampled_mean-expected_mean)<1e-8
    amplitude,wavelength,depth=.05,.1,5000.
    slope_amplitude=2*np.pi*amplitude/wavelength
    assert projected_pixels(amplitude,depth)<.01
    assert slope_amplitude>3

    frequencies=[]
    s=4.
    while s<1000.:
        frequencies.append(s);s*=1.4
    assert len(frequencies)==17
    return {'date':'2026-09-06','runtime':{'python':platform.python_version(),'numpy':np.__version__},
      'source':'synthetic, not Wenzhou or Guilin',
      'grid':{'shape':[n,n],'extent_metres':[1600,1600],'spacing_m':12.5,
              'train':int(train.sum()),'heldout':int(test.sum())},
      'basis_fit':{'coarse_coefficients':6,'feature_aware_coefficients':7,
                   'coarse':m0,'feature_aware':m1,
                   'feature_location_and_width_supplied':True,
                   'json_coefficient_roundtrip_passed':True,
                   'observed_data_error_not_bitwise_lossless_claim':True},
      'camera_assumptions':'pinhole, 1080 vertical pixels, 60 degree vertical FOV; displacement parallel to image plane at fixed view depth',
      'camera_examples':cameras,
      'filtering':{'ridged_sine_mean_analytic':expected_mean,'ridged_sine_mean_sampled':sampled_mean,
                   'unresolved_sine_height_m':amplitude,'wavelength_m':wavelength,
                   'at_5km_projected_amplitude_pixels':projected_pixels(amplitude,depth),
                   'max_slope_m_per_m':slope_amplitude},
      'screenshot_loop_if_interpreted_literally':{'start':4,'ratio':1.4,'stop_before':1000,'iterations':len(frequencies),'outer_samples':57,'cos_calls_per_pixel_nominal':57*len(frequencies)},
      'limits':['No screenshot shader, ISF, STTF, GPU, browser or physical simulation executed',
                'Synthetic source deliberately lies in augmented basis; not evidence of generic compression ratio',
                'No ridge extraction, hydrology, topology, caves, silhouettes, antialiasing renderer or cross-device parity tested',
                'Projected error formula excludes depth changes, occlusions, shadows and nonlinear shading',
                'No production data, geometry, LOD, acceptance or linked runtime modified']}

if __name__=='__main__':
    result=run()
    print(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False))

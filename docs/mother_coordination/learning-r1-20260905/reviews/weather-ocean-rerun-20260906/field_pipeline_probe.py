"""Independent 24^3 CPU component probes, not a production smoke simulation.
A compatible periodic face-divergence/pressure-gradient pair is projected via FFT.
Transport uses constant prescribed wind, linear interpolation and limited MacCormack.
There are no obstacles, no buoyancy, no combustion, no aircraft, and no free surface.
The periodic box exists ONLY to permit analytic regression controls.
"""
from __future__ import annotations
import json, math, time, platform
import numpy as np


def divergence(velocity: np.ndarray, h: float) -> np.ndarray:
    return sum((velocity[a] - np.roll(velocity[a], 1, axis=a)) / h for a in range(3))


def gradient(pressure: np.ndarray, h: float) -> np.ndarray:
    return np.array([(np.roll(pressure, -1, axis=a) - pressure) / h for a in range(3)])


def project(velocity: np.ndarray, h: float, dt: float) -> tuple[np.ndarray, np.ndarray]:
    if velocity.ndim != 4 or velocity.shape[0] != 3 or len(set(velocity.shape[1:])) != 1:
        raise ValueError('Cubic 3-component face field required')
    if h <= 0 or dt <= 0 or not np.isfinite(velocity).all() or not math.isfinite(h+dt):
        raise ValueError('Finite inputs, positive spacing and time step required')
    n=velocity.shape[1]; f=np.fft.fftfreq(n)
    axes=np.meshgrid(f,f,f,indexing='ij')
    eigen=-4*sum(np.sin(np.pi*k)**2 for k in axes)/h**2
    eigen[0,0,0]=1.
    rhs=np.fft.fftn(divergence(velocity,h)/dt)
    ph=rhs/eigen; ph[0,0,0]=0.
    p=np.fft.ifftn(ph).real
    return velocity-dt*gradient(p,h),p


def constant_wind_transport(c: np.ndarray, wind: tuple[float,float,float], h: float, dt: float) -> np.ndarray:
    if c.ndim != 3 or h <= 0 or dt < 0 or not np.isfinite(c).all() or not np.isfinite([*wind,h,dt]).all():
        raise ValueError('Invalid transport input')
    out=c.copy()
    for axis, v in enumerate(wind):
        shift=v*dt/h; low=math.floor(shift); frac=shift-low
        out=(1-frac)*np.roll(out,low,axis=axis)+frac*np.roll(out,low+1,axis=axis)
    return out


def limited_maccormack(c: np.ndarray, wind: tuple[float,float,float], h: float, dt: float) -> np.ndarray:
    forward=constant_wind_transport(c,wind,h,dt)
    backward=constant_wind_transport(forward,tuple(-v for v in wind),h,dt)
    corrected=forward+.5*(c-backward)
    # Limit to the eight source donors; revert to first order on overshoot.
    lows=[math.floor(v*dt/h) for v in wind]
    donors=[np.roll(c,tuple(lows[a]+((mask>>a)&1) for a in range(3)),axis=(0,1,2)) for mask in range(8)]
    low=np.minimum.reduce(donors);high=np.maximum.reduce(donors)
    return np.where((corrected>=low)&(corrected<=high),corrected,forward)


def run() -> dict:
    start=time.perf_counter(); names=[]
    def check(name, condition):
        if not condition: raise AssertionError(name)
        names.append(name)
    n=24; h=.5; dt=.02
    rng=np.random.default_rng(60906)
    v=rng.normal(size=(3,n,n,n))*.3
    v0=v.copy(); vp,p=project(v,h,dt)
    before=float(np.sqrt(np.mean(divergence(v,h)**2)))
    after=float(np.sqrt(np.mean(divergence(vp,h)**2)))
    check('periodic_projection_reduces_compatible_divergence',after<1e-11*before)
    check('projection_preserves_mean_flow',np.max(np.abs(v.mean(axis=(1,2,3))-vp.mean(axis=(1,2,3))))<1e-13)
    check('projection_does_not_increase_l2_energy',float(np.sum(vp**2))<=float(np.sum(v**2))+1e-12)
    check('projection_is_idempotent_within_tolerance',np.max(np.abs(project(vp,h,dt)[0]-vp))<1e-12)
    check('projection_has_no_input_mutation',np.array_equal(v0,v))
    check('projection_time_factor_is_consistent',np.max(np.abs(project(v,h,dt/2)[0]-vp))<1e-12)
    steady=np.zeros_like(v);steady[0]=1.2
    check('uniform_flow_is_preserved',np.array_equal(project(steady,h,dt)[0],steady))
    check('pressure_equation_residual_is_small',np.max(np.abs(divergence(gradient(p,h),h)-divergence(v,h)/dt))<1e-10)
    axes=np.meshgrid(*([np.arange(n)]*3),indexing='ij')
    c=np.exp(-sum((a-12.)**2 for a in axes)/8.)
    original=c.copy(); wind=(.75,-.25,.5); mass=float(c.sum())
    for _ in range(40): c=constant_wind_transport(c,wind,h,dt)
    mass_error=abs(float(c.sum())-mass)/mass
    check('constant_wind_transport_preserves_mass_in_periodic_control',mass_error<1e-12)
    check('constant_wind_transport_remains_nonnegative',c.min()>=0)
    check('linear_transport_does_not_increase_maximum',c.max()<=original.max()+1e-12)
    check('zero_wind_preserves_density',np.array_equal(constant_wind_transport(original,(0.,0.,0.),h,dt),original))
    transported=constant_wind_transport(original,wind,h,dt)
    check('transport_does_not_mutate_source_snapshot',np.array_equal(original,np.exp(-sum((a-12.)**2 for a in axes)/8.)))
    replay=original.copy()
    for _ in range(40): replay=constant_wind_transport(replay,wind,h,dt)
    check('checkpoint_and_same_steps_replay_exactly',np.array_equal(replay,c))
    sharper=original.copy()
    for _ in range(40): sharper=limited_maccormack(sharper,wind,h,dt)
    check('limited_higher_order_transport_stays_finite_and_bounded',np.isfinite(sharper).all() and sharper.min()>=0 and sharper.max()<=original.max()+1e-12)
    check('limited_higher_order_transport_retains_more_peak_in_this_case',sharper.max()>c.max())
    check('limited_higher_order_transport_zero_wind_is_identity',np.array_equal(limited_maccormack(original,(0.,0.,0.),h,dt),original))
    # Absorption-only optical queries on the transported grid, with step size in metres.
    tau=np.sum(c,axis=0)*h*.7
    trans=np.exp(-tau)
    optical_before=c.copy()
    check('grid_ray_transmittance_has_legal_range',np.isfinite(trans).all() and np.all((trans>0)&(trans<=1)))
    check('denser_smoke_has_lower_beam_transmission',np.all(np.exp(-2*tau)<=trans))
    refined=np.repeat(c,2,axis=0)
    check('subdividing_same_density_path_preserves_optical_depth',np.max(np.abs(np.exp(-np.sum(refined,axis=0)*h/2*.7)-trans))<1e-14)
    check('optical_queries_leave_simulation_state_unchanged',np.array_equal(c,optical_before))
    # Zero divergence alone does not enforce a wall: independent counterexample.
    check('divergence_free_uniform_wind_still_crosses_a_wall',np.max(np.abs(divergence(steady,h)))==0 and steady[0,0,0,0]>0)
    return {'status':'passed','checks':len(names),'names':names,'grid':[n,n,n],
            'component_scope':['compatible periodic pressure projection','constant prescribed wind transport','absorption-only grid-ray queries'],
            'projection_divergence_rms_before':before,'projection_divergence_rms_after':after,
            'periodic_transport_relative_mass_error':mass_error,
            'transport_peak_before':float(original.max()),'transport_peak_after':float(c.max()),
            'visible_numerical_diffusion':bool(c.max()<original.max()),
            'limited_maccormack_peak_after':float(sharper.max()),
            'limited_maccormack_relative_mass_error':float((sharper.sum()-mass)/mass),
            'elapsed_ms':round(1000*(time.perf_counter()-start),3),
            'environment':{'python':platform.python_version(),'numpy':np.__version__},
            'limits':['Three components are separate regression controls, not a full Navier-Stokes time step.',
                      'Constant-wind mass result does not prove arbitrary semi-Lagrangian flow is conservative.',
                      'Periodic boundaries are a test fixture, forbidden as a silent Coast outflow substitute.',
                      'Peak preservation of limited MacCormack is measured only for this Gaussian control; it does not guarantee exact mass conservation.',
                      'No solid obstacle solver, real cloud/smoke scene, buoyancy, combustion or free-surface tested.',
                      'No rendering quality, target-device performance or aircraft aerodynamics evidence.'],
            'productionIntegration':False,'visualAcceptance':False,'productionReady':False}

if __name__=='__main__': print(json.dumps(run(),indent=2,allow_nan=False))

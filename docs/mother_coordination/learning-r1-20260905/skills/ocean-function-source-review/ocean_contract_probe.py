"""Original CPU checks motivated by source review. No third-party code executed."""
from __future__ import annotations
from dataclasses import dataclass, asdict
import json, math, platform
from pathlib import Path

@dataclass(frozen=True)
class Wave:
    amplitude: float
    wavelength: float
    steepness: float
    phase: float = 0.0
    gravity: float = 9.81
    def validate(self) -> None:
        if not all(math.isfinite(v) for v in asdict(self).values()):
            raise ValueError('Finite parameters required')
        if self.amplitude < 0 or self.wavelength <= 0 or self.steepness < 0 or self.gravity <= 0:
            raise ValueError('Invalid wave parameters')
        if self.steepness * self.amplitude * self.k >= 1:
            raise ValueError('This test requires a non-folding parameter map')
    @property
    def k(self) -> float:
        return 2*math.pi/self.wavelength
    def theta(self, q: float, t: float) -> float:
        return self.k*q - math.sqrt(self.gravity*self.k)*t + self.phase
    def position(self, q: float, t: float) -> tuple[float,float]:
        a = self.theta(q,t)
        return q + self.steepness*self.amplitude*math.cos(a), self.amplitude*math.sin(a)
    def naive_height(self, x: float, t: float) -> float:
        return self.amplitude*math.sin(self.theta(x,t))
    def height_at_world_x(self, x: float, t: float) -> tuple[float,float]:
        """Bisection inversion; x(q) is strictly increasing under validate()."""
        self.validate()
        r = self.steepness*self.amplitude
        lo,hi = x-r,x+r
        for _ in range(70):
            q=(lo+hi)/2
            if self.position(q,t)[0] < x: lo=q
            else: hi=q
        q=(lo+hi)/2
        px,h=self.position(q,t)
        return h, abs(px-x)

def main() -> dict:
    w=Wave(amplitude=.8,wavelength=8.,steepness=.7,phase=.17)
    w.validate()
    rows=[]
    for t in (0.,.4,1.7):
        for j in range(33):
            x=-4.+j*.25
            actual,residual=w.height_at_world_x(x,t)
            naive=w.naive_height(x,t)
            assert residual < 1e-12
            rows.append(dict(x=x,t=t,height=actual,naive=naive,error=abs(actual-naive)))
    # With no horizontal displacement the two queries must agree.
    flat=Wave(amplitude=.8,wavelength=8.,steepness=0.,phase=.17)
    zero_chop_error=max(abs(flat.height_at_world_x(r['x'],r['t'])[0]-flat.naive_height(r['x'],r['t'])) for r in rows)
    assert zero_chop_error < 1e-12
    assert max(r['error'] for r in rows) > .3
    # Restore a recipe and revisit the same absolute time after querying another time.
    restored=Wave(**json.loads(json.dumps(asdict(w))))
    before=[w.height_at_world_x(r['x'],r['t'])[0] for r in rows]
    _=[w.position(j*.25,100.) for j in range(10)]
    after=[restored.height_at_world_x(r['x'],r['t'])[0] for r in rows]
    assert before==after
    # Source-informed algebra check: the two formulas visible in dli/simulation.js.
    # This does not test GLSL execution, dimensions, or the correctness of the spectrum model.
    dispersion=[]
    for wavelength in (100.,10.,1.):
        k=2*math.pi/wavelength; km=370.
        initial=math.sqrt(9.81*k*(1+(k/km)**2))
        phase=math.sqrt(9.81*k*(1+k*k/km*km))
        dispersion.append(dict(wavelength=wavelength,initial_expression=initial,phase_expression=phase,ratio=phase/initial))
    result={
        'python':platform.python_version(),
        'scope':'CPU mathematical counterexample; not an execution of the linked ocean projects',
        'recipe':asdict(w),
        'invertible_world_query_cases':len(rows),
        'max_naive_query_error_m_in_this_synthetic_example':max(r['error'] for r in rows),
        'worst_case':max(rows,key=lambda r:r['error']),
        'zero_horizontal_displacement_error':zero_chop_error,
        'same_recipe_same_absolute_time_replay':before==after,
        'dli_expression_comparison':dispersion,
        'limits':['One synthetic 1D non-folding wave; not a general multi-wave inverse solver',
                  'No GPU, browser, real ocean measurement or linked-project runtime executed',
                  'No estimate of error in the linked project presets',
                  '1e-12 is float64 numerical tolerance, not an engineering standard'],
    }
    return result

if __name__=='__main__':
    print(json.dumps(main(),indent=2,allow_nan=False))

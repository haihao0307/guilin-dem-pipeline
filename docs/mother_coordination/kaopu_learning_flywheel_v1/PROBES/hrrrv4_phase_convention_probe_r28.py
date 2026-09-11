#!/usr/bin/env python3
"""KAOPU R28 phase-convention and reduction probe.

This probe is deliberately renderer-independent. It tests mathematical invariants
that must hold before a renderer-specific phase binding is promoted.

Canonical KAOPU convention used here:
- mu_physical = cos(deflection angle), so mu=+1 is straight-ahead/forward.
- HG asymmetry g>0 means forward scattering.
"""

import math

TOL = 3e-4

def hg_physical(mu, g):
    """Normalized Henyey-Greenstein for mu=cos(deflection angle), forward=+1."""
    return (1.0 - g*g) / (4.0 * math.pi * (1.0 + g*g - 2.0*g*mu)**1.5)

def hg_both_away(mu_both_away, g):
    """Equivalent PBRT-style angular convention: wi and wo both point away."""
    return (1.0 - g*g) / (4.0 * math.pi * (1.0 + g*g + 2.0*g*mu_both_away)**1.5)

def legendre(mu, order):
    if order == 0:
        return 1.0
    if order == 1:
        return mu
    if order == 2:
        return 0.5*(3.0*mu*mu - 1.0)
    raise ValueError(order)

def integrate(fn, n=30000):
    total = 0.0
    dmu = 2.0/n
    for i in range(n):
        mu = -1.0 + (i + 0.5)*dmu
        total += 2.0*math.pi*fn(mu)*dmu
    return total

def moment(g, order, n=30000):
    return integrate(lambda mu: hg_physical(mu,g)*legendre(mu,order), n)

def hemisphere_probability(g, forward=True, n=30000):
    total = 0.0
    dmu = 2.0/n
    for i in range(n):
        mu = -1.0 + (i + 0.5)*dmu
        if (mu >= 0.0) == forward:
            total += 2.0*math.pi*hg_physical(mu,g)*dmu
    return total

def mix_hg(mu, g1, g2, w2):
    return (1.0-w2)*hg_physical(mu,g1) + w2*hg_physical(mu,g2)

def mix_moment(g1, g2, w2, order):
    return (1.0-w2)*(g1**order) + w2*(g2**order)

checks = []

def check(name, condition, detail):
    checks.append((name, bool(condition), detail))

g = 0.85
m0 = moment(g,0)
m1 = moment(g,1)
m2 = moment(g,2)
check("HG normalization", abs(m0-1.0) < TOL, f"m0={m0:.9f}")
check("HG first moment equals g", abs(m1-g) < TOL, f"m1={m1:.9f}, g={g}")
check("HG second Legendre moment equals g^2", abs(m2-g*g) < TOL, f"m2={m2:.9f}, g2={g*g:.9f}")

fwd_pos = hemisphere_probability(g, True)
back_pos = hemisphere_probability(g, False)
fwd_neg = hemisphere_probability(-g, True)
back_neg = hemisphere_probability(-g, False)
check("positive canonical g is forward dominated", fwd_pos > 0.95 and back_pos < 0.05,
      f"forward={fwd_pos:.6f}, back={back_pos:.6f}")
check("sign inversion swaps forward/back hemispheres",
      abs(fwd_pos-back_neg) < TOL and abs(back_pos-fwd_neg) < TOL,
      f"+g(f,b)=({fwd_pos:.6f},{back_pos:.6f}); -g(f,b)=({fwd_neg:.6f},{back_neg:.6f})")
check("phase-sign mistake is materially large", fwd_pos/max(fwd_neg,1e-12) > 20.0,
      f"forward probability ratio correct/inverted={fwd_pos/fwd_neg:.2f}")

mus = [-1.0,-0.5,0.0,0.5,1.0]
conv_err = max(abs(hg_physical(mu,g)-hg_both_away(-mu,g)) for mu in mus)
check("direction-vector convention transforms formula without changing physics",
      conv_err < 1e-12, f"max_error={conv_err:.3e}")

# Two different dual-lobe mixtures with the same first moment g=0.85.
a_g1, a_g2 = 0.90, 0.40
a_w2 = (a_g1-g)/(a_g1-a_g2)
b_g1, b_g2 = 0.95, -0.30
b_w2 = (b_g1-g)/(b_g1-b_g2)

a_m1 = mix_moment(a_g1,a_g2,a_w2,1)
b_m1 = mix_moment(b_g1,b_g2,b_w2,1)
a_m2 = mix_moment(a_g1,a_g2,a_w2,2)
b_m2 = mix_moment(b_g1,b_g2,b_w2,2)

check("dual-lobe mixture A matches source first moment", abs(a_m1-g) < 1e-12,
      f"w2={a_w2:.6f}, m1={a_m1:.9f}")
check("dual-lobe mixture B matches source first moment", abs(b_m1-g) < 1e-12,
      f"w2={b_w2:.6f}, m1={b_m1:.9f}")
check("same first moment does not determine second moment",
      abs(a_m2-b_m2) > 0.05,
      f"A_m2={a_m2:.6f}, B_m2={b_m2:.6f}, source_HG_m2={g*g:.6f}")

a_norm = integrate(lambda mu: mix_hg(mu,a_g1,a_g2,a_w2))
b_norm = integrate(lambda mu: mix_hg(mu,b_g1,b_g2,b_w2))
check("dual-lobe mixtures remain normalized",
      abs(a_norm-1.0) < TOL and abs(b_norm-1.0) < TOL,
      f"A_norm={a_norm:.9f}, B_norm={b_norm:.9f}")

grid = [-1.0 + i*(2.0/2000.0) for i in range(2001)]
l1_ab = 0.0
l1_a_source = 0.0
dmu = 2.0/2000.0
for mu in grid:
    pa = mix_hg(mu,a_g1,a_g2,a_w2)
    pb = mix_hg(mu,b_g1,b_g2,b_w2)
    ps = hg_physical(mu,g)
    l1_ab += 2.0*math.pi*abs(pa-pb)*dmu
    l1_a_source += 2.0*math.pi*abs(pa-ps)*dmu
check("equal-g dual-lobe bindings can have different angular shapes",
      l1_ab > 0.1, f"L1(A,B)={l1_ab:.6f}")
check("matching first moment alone does not reproduce source HG",
      l1_a_source > 0.01, f"L1(A,source)={l1_a_source:.6f}")

phase_binding_fields = {
    "phase_family": "Henyey-Greenstein",
    "g_semantics": "first Legendre moment",
    "forward_definition": "mu_physical=+1",
    "direction_vector_convention": "physical propagation deflection",
    "mixture": "single_lobe",
    "normalization": "integral_over_4pi=1",
}
check("safe phase binding carries convention identity",
      len(phase_binding_fields) == 6 and phase_binding_fields["direction_vector_convention"] != "",
      str(phase_binding_fields))

passed = sum(1 for _,ok,_ in checks if ok)
for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL"), "-", name, "-", detail)
print(f"RESULT {passed}/{len(checks)} PASS")
if passed != len(checks):
    raise SystemExit(1)

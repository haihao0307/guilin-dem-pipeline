# Current Best View N07 — psrdnoise period, derivative and phase contract

Status: **Candidate partial / pinned-source CPU semantic verified**

- Lock the implementation before recording phase semantics. The pinned 2021 `stegu/psrdnoise` 2-D function uses `alpha` in radians; the legacy 2016 `webgl-noise` function used `rot=1.0` for one full turn.
- A seamless 2-D lattice period requires a positive integer x component and a positive even integer y component. Odd y input repeats after twice the declared value. Fractional components are not validated or repaired by the function.
- Nonpositive period components disable wrapping independently. This is useful for one-axis tiling but must not be recorded as two-axis continuity.
- When world coordinates are multiplied by frequency, the shader period must be expressed in the scaled coordinate domain. Each resulting x period must remain integer and each y period even integer.
- Returned derivatives are with respect to the function input. A sample `n(fx)` needs the ordinary chain factor `f` for world-space gradients; composed warp still needs the full Jacobian from N04.
- Changing `alpha` rotates lattice gradients and changes the scalar field at fixed coordinates. It is periodic after `2π`, but it does not move coordinates, water, sediment or material state. The fixed negative control also rejects interpreting it as one rigid constant-velocity translation.
- A visually flowing sequence may be useful presentation noise, but physical advection, conservation and history must remain in separate stateful processes.

Landscape/Farmland still have no acknowledgment of the earlier N02 publication, so routing is not repeated. Brick PR15/PR17 and Tiles PR11 remain verified possible entries only; no delivery or adoption is claimed.

Canonical Truth, Frozen R1 and production Mother branches remain unchanged.

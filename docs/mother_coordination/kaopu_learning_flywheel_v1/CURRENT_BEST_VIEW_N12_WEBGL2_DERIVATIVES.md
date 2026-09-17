# Current Best View — N12 WebGL2 modular derivatives

Status: **Candidate partial**

The reusable unit is not a float-returning helper alone; it is the composed scalar plus its coordinate/Jacobian, units, continuity class, seam and kink loci, derivative ownership, shader profile and semantic role.

Chrome 152 / WebGL2 / ANGLE Vulkan SwiftShader reproduced the N11 normalized seam matrix: `fract` reached `-127`, `floor` reached `128`, while `sin(2π·fract(x))` remained bounded near the analytic slope because value and first derivative close across the wrap. `abs` and the triangle wave remained bounded but changed derivative branch.

Therefore:

- discrete identity and raw wrap outputs remain classification-only unless separately reconstructed;
- a periodic composition may feed derivative filtering only after closure at the required derivative order is demonstrated;
- bounded magnitude does not establish continuous normals;
- derivative calls must occur in uniform flow and use a declared coordinate transform;
- this software WebGL result is not hardware, mobile, production or user-acceptance evidence.

Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.

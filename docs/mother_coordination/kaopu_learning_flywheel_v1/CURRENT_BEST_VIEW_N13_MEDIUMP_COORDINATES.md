# Current Best View — N13 mediump procedural coordinates

Status: **Candidate partial**

For procedural noise, warp, threshold, normal or displacement modules, precision is part of the coordinate contract. Record the coordinate space, scale/Jacobian, maximum magnitude, minimum meaningful increment and precision tier.

At `h=1/128`, a binary16-class counterexample retained every sample at offset 8, lost about half at offset 16, and collapsed 99.22% of adjacent coordinates at offset 1024. An integer cell/tile identity plus bounded local coordinate preserved the tested phase and value-noise field when the split occurred before narrowing.

Chrome 152 / ANGLE Vulkan SwiftShader reported fragment mediump precision 10 and range ±15, yet executed the tested declared-mediump phase matrix identically to highp through offset 8192. Therefore desktop SwiftShader success is not a minimum-mobile-precision gate.

Use highp for coordinate formation or split stable integer identity from bounded local interpolation before narrowing. Keep N09–N12 continuity and derivative checks separate. Hardware mobile, production-chain and user acceptance remain Unknown.

Canonical Truth, Frozen R1 and production Mother branches are unchanged.

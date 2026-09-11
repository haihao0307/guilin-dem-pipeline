# Current Best View — Gaussian SH direction R36 candidate

1. For the pinned GraphDECO convention, Niantic SPZ RDF-to-default-RUB conversion and Three.js r186 SH1-SH3 evaluator, the direction contract is compatible: normalized `splat center - camera center`, with coefficients transformed alongside coordinates.
2. The 45-coefficient, 14-direction CPU fixture passed the actual Niantic converter, actual v4 packer and actual Three loader. Maximum GraphDECO-to-Three functional difference was `1.045023e-7`, attributable to rounded viewer constants in this fixture.
3. Two negative controls are mandatory regression cases. Omitting SH conversion while flipping RDF-to-RUB directions and reversing the view vector each produced maximum error about `1.602`, so parse success and coefficient counts do not authenticate direction semantics.
4. The zero coefficient error is limited to deliberately quantization-grid values. Arbitrary learned coefficients remain lossy under SPZ and require measured error budgets.
5. This pass does not remove R35's DC-clamp incompatibility. Direction convention, DC range, arbitrary coefficient quantization, final rendering and human acceptance remain separate gates.
6. No photo reconstruction, Brush runtime, GPU/device test or human acceptance occurred. RealityScan is not replaced; splats are neither Canonical Truth nor complete Object DNA. Frozen R1 and production Mothers remain unchanged.

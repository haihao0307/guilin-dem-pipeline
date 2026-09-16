# Current Best View — Houdini HDA identity H01

Status: **Candidate partial / source-contract CPU verified**

A HIP scene plus HDA type/version is not an exact procedural identity. Houdini can resolve multiple definitions for one type, embedded and external definitions can have configurable precedence, ambiguous names depend on version/namespace rules, and unlocked instances can diverge from the saved definition.

The candidate KAOPU handoff therefore binds definition payload, exact type reference, resolution environment, selected-definition state, instance match/lock state, parameters, cook context and external-input hashes. Thirteen CPU manifest checks pass, including counterexamples where the same type/version selects different definition bytes.

This is not a Houdini runtime result and does not establish cross-machine bitwise determinism. Canonical Truth, production Mothers and Frozen R1 remain unchanged.
